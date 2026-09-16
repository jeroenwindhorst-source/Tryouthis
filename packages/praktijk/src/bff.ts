import type { Dossier, Rol, Task } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, metingReeks, numeriekeWaarde } from '@zpe/fhir-model';
import {
  automatisering, bewaakMiddel, bouwZorgplan, beoordeelInstroom, CODE, instroomOverzicht,
  planOproepen, suggesties, verwerk, vindVragenlijst, voorgesteldeOrdersets, zoekCatalogus,
  type CatalogusSoort, type Suggestie, type Zorgplan,
} from '@zpe/care-engine';
import { NIVEAU_UITLEG } from '@zpe/configuratie';
import { metingNaam } from './terminologie.js';
import { configuratie, configuratieLagen } from './configuratie-demo.js';
import { journaal, type JournaalRegel } from './historie.js';
import type { ExternDocument } from './externe-bronnen.js';
import type { NieuweOrder, Order } from './orderopslag.js';
import { bespreeklijstVoor, type NieuwBespreekpunt } from './bespreeklijst.js';
import { vindGebruiker } from './gebruikers.js';
import { gesprekkenVoor, naamVanGebruiker, ongelezenVoor } from './berichten.js';
import {
  groepeerAutorisaties, STATUSLABEL,
  type Afspraakstatus, type Autorisatiegroep, type Triageverzoek, type WachtkamerIntake,
} from './werkvoorraad.js';
import type { DossierRepository, Overlegnotitie } from './store.js';
import { PLANROUTE_UITLEG, teplannen, type NieuwAfspraakverzoek, type Planroute } from './planning.js';

/**
 * Samenstellingen per werkplek (docs/05). De FHIR-facade blijft generiek; deze laag
 * maakt er schermen van. Bevat zelf geen klinische regels — die staan in care-engine.
 *
 * De indeling volgt het werkproces van de POH, niet de structuur van het dossier:
 * voorbereiden → spreekuur → monitoren → afronden.
 */

export function volledigeNaam(dossier: Dossier): string {
  const n = dossier.patient.naam;
  return [n.voornaam ?? n.initialen, n.tussenvoegsel, n.achternaam].filter(Boolean).join(' ');
}

function planVoor(repo: DossierRepository, dossier: Dossier): Zorgplan {
  return bouwZorgplan(dossier, repo.persoonlijkPlan(dossier.patient.id), { peildatum: repo.peildatum() });
}

function suggestiesVoor(repo: DossierRepository, dossier: Dossier, plan: Zorgplan): Suggestie[] {
  const afgehandeld = repo.afgehandeldeSuggesties(dossier.patient.id);
  return suggesties(dossier, plan, repo.peildatum()).filter((s) => !afgehandeld.includes(s.regelId));
}

// ── Signalen ────────────────────────────────────────────────────────────────

export interface Signaal {
  soort: 'meetwaarde' | 'achterstand' | 'trend' | 'voorbereiding';
  ernst: 'informatief' | 'aandacht' | 'urgent';
  tekst: string;
  module?: string;
}

export function signalen(dossier: Dossier, peildatum: Date): Signaal[] {
  const lijst: Signaal[] = [];

  const hba1c = numeriekeWaarde(laatsteMeting(dossier, CODE.hba1c));
  if (hba1c !== undefined && hba1c > 64) {
    lijst.push({ soort: 'meetwaarde', ernst: hba1c > 75 ? 'urgent' : 'aandacht', module: 'glucose',
      tekst: `HbA1c ${hba1c} mmol/mol` });
  }

  const rr = numeriekeWaarde(laatsteMeting(dossier, CODE.rrSys));
  if (rr !== undefined && rr >= 160) {
    lijst.push({ soort: 'meetwaarde', ernst: rr >= 180 ? 'urgent' : 'aandacht', module: 'vaatrisico',
      tekst: `Bloeddruk ${rr} mmHg` });
  }

  const egfr = numeriekeWaarde(laatsteMeting(dossier, CODE.egfr));
  if (egfr !== undefined && egfr < 45) {
    lijst.push({ soort: 'meetwaarde', ernst: egfr < 30 ? 'urgent' : 'aandacht', module: 'nierfunctie',
      tekst: `eGFR ${egfr} ml/min` });
  }

  const ccq = metingReeks(dossier, CODE.ccq).map(numeriekeWaarde).filter((x): x is number => typeof x === 'number');
  if (ccq.length >= 2) {
    const delta = Math.round((ccq.at(-1)! - ccq.at(-2)!) * 100) / 100;
    if (delta >= 0.4) {
      lijst.push({ soort: 'trend', ernst: ccq.at(-1)! >= 2 ? 'urgent' : 'aandacht', module: 'ademhaling',
        tekst: `CCQ van ${ccq.at(-2)} naar ${ccq.at(-1)} (+${delta})` });
    } else if (ccq.length >= 3 && ccq.slice(-3).every((x) => x < 1)) {
      lijst.push({ soort: 'trend', ernst: 'informatief', module: 'ademhaling',
        tekst: 'CCQ drie metingen stabiel — minder frequent volstaat' });
    }
  }

  const heeftGlucose = dossier.episodes.some((e) => e.code.coding?.some((c) => c.code.startsWith('T90')));
  if (heeftGlucose) {
    const o = laatsteMeting(dossier, CODE.hba1c);
    const dagen = o ? Math.floor((peildatum.getTime() - new Date(o.effectief).getTime()) / 86_400_000) : Infinity;
    if (dagen > 365) {
      lijst.push({ soort: 'achterstand', ernst: 'aandacht', module: 'glucose',
        tekst: Number.isFinite(dagen) ? `HbA1c ${dagen} dagen oud` : 'HbA1c nooit bepaald' });
    }
  }

  return lijst;
}

// ── 1. Dagstart: het werkproces in één blik ─────────────────────────────────

export interface Processtap {
  id: 'voorbereiden' | 'spreekuur' | 'monitoren' | 'afronden';
  naam: string;
  omschrijving: string;
  /** Wat zie ik hier, als POH. */
  watZieIk: string;
  aantal: number;
  aandacht: number;
}

export interface Dagstart {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  /** De dag als tijdlijn — het eerste dat een zorgverlener wil zien. */
  agenda: AgendaRegel[];
  stappen: Processtap[];
  automatisering: {
    graad: number;
    vandaagAutomatisch: { titel: string; aantal: number; toelichting: string }[];
    wachtOpJou: number;
  };
  urgent: { patientId: string; naam: string; titel: string; bevinding: string }[];
}

export function dagstart(repo: DossierRepository): Dagstart {
  const peildatum = repo.peildatum();
  const datum = peildatum.toISOString().slice(0, 10);
  const afspraken = repo.spreekuur(datum);

  const voorbereidingen = consultvoorbereiding(repo);
  const monitoring = monitoringCohort(repo);
  const afronden = dagafsluiting(repo);

  // Automatisering over de patiënten van vandaag plus het monitoringcohort.
  const relevante = new Set([...afspraken.map((a) => a.patientId), ...monitoring.slice(0, 25).map((m) => m.patientId)]);
  const alleSuggesties: Suggestie[] = [];
  for (const patientId of relevante) {
    const dossier = repo.dossier(patientId);
    if (!dossier) continue;
    alleSuggesties.push(...suggestiesVoor(repo, dossier, planVoor(repo, dossier)));
  }
  const auto = automatisering(alleSuggesties);

  const perTitel = new Map<string, number>();
  for (const s of auto.automatischUitgevoerd) perTitel.set(s.titel, (perTitel.get(s.titel) ?? 0) + 1);

  const urgent = alleSuggesties
    .filter((s) => s.ernst === 'urgent')
    .slice(0, 6)
    .map((s) => ({
      patientId: s.patientId,
      naam: volledigeNaam(repo.dossier(s.patientId)!),
      titel: s.titel,
      bevinding: s.bevinding,
    }));

  return {
    datum,
    zorgverlener: { naam: 'Sanne Bakker', rol: 'POH-Somatiek' },
    agenda: agenda(repo, 'poh-s'),
    stappen: [
      {
        id: 'voorbereiden', naam: 'Voorbereiden', omschrijving: 'Spreekuur van vandaag klaarzetten',
        watZieIk: 'Per patiënt wat er binnen is, wat ontbreekt en wat er besproken moet worden.',
        aantal: voorbereidingen.length,
        aandacht: voorbereidingen.filter((v) => !v.compleet).length,
      },
      {
        id: 'spreekuur', naam: 'Spreekuur', omschrijving: 'Consulten voeren en registreren',
        watZieIk: 'Het plan van deze patiënt, de suggesties, en registratie in één scherm.',
        aantal: afspraken.length,
        aandacht: voorbereidingen.filter((v) => v.signalen.some((s) => s.ernst !== 'informatief')).length,
      },
      {
        id: 'monitoren', naam: 'Monitoren', omschrijving: 'Patiënten die ik op afstand volg',
        watZieIk: 'Alleen wie afwijkt, met de trend erbij en een voorgestelde vervolgactie.',
        aantal: monitoring.length,
        aandacht: monitoring.filter((m) => m.signalen.length > 0).length,
      },
      {
        id: 'afronden', naam: 'Afronden', omschrijving: 'Dag sluitend maken',
        watZieIk: 'Openstaande registraties, verantwoording en wat automatisch is gedaan.',
        aantal: afronden.punten.length,
        aandacht: afronden.punten.filter((p) => p.blokkerend).length,
      },
    ],
    automatisering: {
      graad: auto.automatiseringsgraad,
      vandaagAutomatisch: [...perTitel.entries()].map(([titel, aantal]) => ({
        titel, aantal,
        toelichting: auto.automatischUitgevoerd.find((s) => s.titel === titel)!.onderbouwing,
      })),
      wachtOpJou: auto.wachtOpMens.length,
    },
    urgent,
  };
}

// ── 2. Consultvoorbereiding ─────────────────────────────────────────────────

export interface Voorbereiding {
  tijd: string;
  patientId: string;
  naam: string;
  leeftijd: number;
  soort: string;
  modules: { id: string; naam: string; icoon: string }[];
  compleet: boolean;
  binnen: string[];
  ontbreekt: string[];
  signalen: Signaal[];
  /** De twee tot drie dingen die dit consult echt moeten opleveren. */
  gespreksonderwerpen: { titel: string; bevinding: string; ernst: string }[];
  doelen: { tekst: string }[];
  zelfredzaamheid?: { gemiddelde: number; niveau: string; knelpunten: string[] };
  /** Voorbereiding uit de wachtkamer, geleverd door een ingebedde partnerapp. */
  intake?: WachtkamerIntake;
}

export function consultvoorbereiding(repo: DossierRepository): Voorbereiding[] {
  const peildatum = repo.peildatum();
  const datum = peildatum.toISOString().slice(0, 10);

  return repo.spreekuur(datum).flatMap((afspraak): Voorbereiding[] => {
    const dossier = repo.dossier(afspraak.patientId);
    if (!dossier) return [];
    const plan = planVoor(repo, dossier);
    const eerste = plan.contacten[0];
    const lijst = suggestiesVoor(repo, dossier, plan);

    const binnen: string[] = [];
    const ontbreekt: string[] = [];
    for (const meting of eerste?.metingen ?? []) {
      if (meting.laatsteOp && meting.vervaltOp > datum) binnen.push(`${meting.naam} ${meting.laatsteWaarde ?? ''}`.trim());
      else ontbreekt.push(meting.naam);
    }
    if ((eerste?.vragenlijsten.length ?? 0) > 0 && dossier.patient.id.charCodeAt(6) % 3 === 0) {
      ontbreekt.push('voorbereidingsvragenlijst');
    }

    return [{
      tijd: afspraak.start.slice(11, 16),
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      soort: afspraak.soort,
      modules: plan.modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
      compleet: ontbreekt.length === 0,
      binnen,
      ontbreekt,
      signalen: signalen(dossier, peildatum),
      gespreksonderwerpen: lijst
        .filter((s) => s.klasse === 'klinisch')
        .slice(0, 3)
        .map((s) => ({ titel: s.titel, bevinding: s.bevinding, ernst: s.ernst })),
      doelen: plan.doelen.map((d) => ({ tekst: d.tekst })),
      zelfredzaamheid: plan.zelfredzaamheid
        ? {
            gemiddelde: plan.zelfredzaamheid.gemiddelde,
            niveau: plan.zelfredzaamheid.niveau,
            knelpunten: plan.zelfredzaamheid.knelpunten.map((k) => k.domein.naam),
          }
        : undefined,
      intake: repo.intakes().find((i) => i.patientId === dossier.patient.id),
    }];
  });
}

// ── 3. Monitoring ───────────────────────────────────────────────────────────

export interface MonitoringRegel {
  patientId: string;
  naam: string;
  leeftijd: number;
  modules: { id: string; naam: string; icoon: string }[];
  signalen: Signaal[];
  suggesties: Suggestie[];
  zelfredzaamheid?: { gemiddelde: number; niveau: string; richting?: string };
}

export function monitoringCohort(repo: DossierRepository): MonitoringRegel[] {
  const peildatum = repo.peildatum();
  const regels = repo.alleDossiers().flatMap((dossier): MonitoringRegel[] => {
    const bekend = repo.bekendeModules(dossier.patient.id);
    if (bekend.length === 0) return [];
    const plan = planVoor(repo, dossier);
    const sig = signalen(dossier, peildatum);
    if (plan.modules.length === 0) return [];
    return [{
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      modules: plan.modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
      signalen: sig,
      suggesties: suggestiesVoor(repo, dossier, plan).filter((s) => s.klasse === 'klinisch').slice(0, 3),
      zelfredzaamheid: plan.zelfredzaamheid && plan.zelfredzaamheid.gemiddelde > 0
        ? {
            gemiddelde: plan.zelfredzaamheid.gemiddelde,
            niveau: plan.zelfredzaamheid.niveau,
            richting: plan.zelfredzaamheid.trend?.richting,
          }
        : undefined,
    }];
  });

  // Lage of dalende zelfredzaamheid weegt mee in de volgorde: wie het zelf niet redt,
  // hoort niet onderaan te staan omdat de waarden toevallig meevallen.
  const gewicht = (r: MonitoringRegel): number => {
    const signaal = r.signalen.reduce(
      (s, x) => s + (x.ernst === 'urgent' ? 100 : x.ernst === 'aandacht' ? 10 : 1), 0,
    );
    const z = r.zelfredzaamheid;
    if (!z) return signaal;
    return signaal + (z.gemiddelde < 2.5 ? 60 : z.gemiddelde < 3.5 ? 20 : 0)
      + (z.richting === 'achteruit' ? 40 : 0);
  };
  return regels.sort((a, b) => gewicht(b) - gewicht(a));
}

// ── 4. Instroom ─────────────────────────────────────────────────────────────

export function instroom(repo: DossierRepository) {
  return instroomOverzicht(
    repo.alleDossiers(),
    (id) => repo.bekendeModules(id),
    (id) => repo.persoonlijkPlan(id),
    repo.peildatum(),
  );
}

// ── 5. Dagafsluiting ────────────────────────────────────────────────────────

export interface Afsluititem {
  id: string;
  patientId?: string;
  naam: string;
  /** Wat er precies gebeurt als je dit afhandelt. Nooit impliciet. */
  actie: string;
  detail: string;
}

export interface Afsluitpunt {
  categorie: string;
  omschrijving: string;
  aantal: number;
  blokkerend: boolean;
  bulkVeilig: boolean;
  toelichting: string;
  /** De regels zelf, zodat "alles afhandelen" niet in het duister gebeurt. */
  items: Afsluititem[];
}

export function dagafsluiting(repo: DossierRepository) {
  const peildatum = repo.peildatum();
  const datum = peildatum.toISOString().slice(0, 10);
  const afspraken = repo.spreekuur(datum);

  const verantwoording: Afsluititem[] = [];
  const vragenlijsten: Afsluititem[] = [];
  const ketenGaten = new Map<string, number>();

  for (const afspraak of afspraken) {
    const dossier = repo.dossier(afspraak.patientId);
    if (!dossier) continue;
    const plan = planVoor(repo, dossier);
    const naam = volledigeNaam(dossier);

    for (const keten of plan.ketens) {
      const gaten = keten.indicatoren.filter((i) => !i.voldaan);
      if (gaten.length === 0) continue;
      ketenGaten.set(keten.naam, (ketenGaten.get(keten.naam) ?? 0) + gaten.length);
      verantwoording.push({
        id: `${dossier.patient.id}-${keten.ketenId}`,
        patientId: dossier.patient.id,
        naam,
        actie: `Labaanvraag klaarzetten voor ${gaten.map((g) => g.naam).join(', ')}`,
        detail: `${keten.naam}: ${gaten.map((g) => `${g.naam} — ${g.toelichting}`).join(' · ')}`,
      });
    }

    const lijsten = plan.contacten[0]?.vragenlijsten ?? [];
    if (lijsten.length > 0) {
      vragenlijsten.push({
        id: `${dossier.patient.id}-vl`,
        patientId: dossier.patient.id,
        naam,
        actie: `${lijsten.join(', ')} via het portaal uitzetten`,
        detail: `Voor het contact op ${plan.contacten[0].datum}. Met automatische herinnering na 5 dagen.`,
      });
    }
  }

  const punten: Afsluitpunt[] = [
    {
      categorie: 'Verantwoording',
      omschrijving: 'Patiënten met ontbrekende ketenindicatoren',
      aantal: verantwoording.length,
      blokkerend: false,
      bulkVeilig: true,
      toelichting: [...ketenGaten.entries()].map(([naam, n]) => `${naam}: ${n} gaten`).join(' · ') ||
        'Alle indicatoren zijn op orde.',
      items: verantwoording,
    },
    {
      categorie: 'Voorbereiding volgende keer',
      omschrijving: 'Vragenlijsten die klaargezet kunnen worden',
      aantal: vragenlijsten.length,
      blokkerend: false,
      bulkVeilig: true,
      toelichting: 'Logistiek werk zonder klinische beslissing — kan in één handeling.',
      items: vragenlijsten,
    },
    {
      categorie: 'Openstaande taken',
      omschrijving: 'Taken die vandaag zijn ontstaan en nog open staan',
      aantal: repo.taken().filter((t) => t.status === 'requested').length,
      blokkerend: repo.taken().some((t) => t.status === 'requested' && t.prioriteit === 'asap'),
      bulkVeilig: false,
      toelichting: 'Alles met een reden en een voorgestelde afhandeling.',
      items: repo.taken().filter((t) => t.status === 'requested').map((t) => ({
        id: t.id, patientId: t.patientId, naam: t.omschrijving,
        actie: t.voorstel?.omschrijving ?? 'Beoordelen', detail: t.aanleiding,
      })),
    },
  ];

  return { datum, punten, afgerond: punten.every((p) => p.aantal === 0) };
}

// ── 6. Patiëntoverzicht ─────────────────────────────────────────────────────

export function patientOverzicht(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const peildatum = repo.peildatum();
  const persoonlijk = repo.persoonlijkPlan(patientId);
  const plan = bouwZorgplan(dossier, persoonlijk, { peildatum });
  const oproepen = planOproepen(plan, dossier.patient, { peildatum });
  const lijst = suggestiesVoor(repo, dossier, plan);

  return {
    patient: {
      id: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      geboortedatum: dossier.patient.geboortedatum,
      geslacht: dossier.patient.geslacht,
      bsn: dossier.patient.identifier[0]?.value,
      portaalActief: dossier.patient.portaalActief,
    },
    episodes: dossier.episodes.map((e) => ({
      id: e.id, titel: e.titel, status: e.status,
      icpc: e.code.coding?.find((c) => c.system.includes('icpc'))?.code,
      start: e.periode.start,
    })),
    medicatie: dossier.medicatie.map((m) => ({
      naam: m.middel.text ?? '', atc: m.middel.coding?.[0]?.code, dosering: m.dosering, chronisch: m.chronisch,
    })),
    metingen: [...new Set(dossier.observaties.map((o) => o.code.coding?.[0]?.code))]
      .filter((c): c is string => Boolean(c))
      .map((code) => {
        const reeks = metingReeks(dossier, code);
        const laatste = reeks.at(-1);
        return {
          code, naam: metingNaam(code),
          laatste: numeriekeWaarde(laatste),
          eenheid: (laatste?.waarde as { unit?: string })?.unit,
          op: laatste?.effectief.slice(0, 10),
          bron: laatste?.herkomst.bron,
          reeks: reeks.map((o) => ({ op: o.effectief.slice(0, 10), waarde: numeriekeWaarde(o) })),
        };
      }),
    signalen: signalen(dossier, peildatum),
    zorgplan: plan,
    persoonlijk,
    suggesties: lijst,
    automatisering: automatisering(lijst),
    oproepen,
    instroom: beoordeelInstroom(dossier, repo.bekendeModules(patientId), persoonlijk, peildatum),
    intake: repo.intakes().find((i) => i.patientId === patientId),
    /** Behandelgrenzen — hoort bovenaan, niet ergens in het journaal. */
    beleid: repo.beleidsafspraken(patientId),
    /**
     * Wat er voor déze patiënt bij de huisarts ligt.
     *
     * Een dossier openen vanuit de autorisatiestapel en dan niet meer kunnen tekenen,
     * dwingt je terug naar de lijst en daar het item opnieuw op te zoeken. Het verzoek
     * hoort mee te reizen met het dossier dat je erbij opent.
     */
    autorisaties: repo.autorisaties().filter((a) => a.patientId === patientId && a.status === 'open'),
    /** Wat er nog ingepland moet worden voor deze patiënt. */
    planverzoeken: repo.afspraakverzoeken()
      .filter((v) => v.patientId === patientId && (v.status === 'open' || v.status === 'uitgezet')),
    /** Het volgende geplande contact in de agenda, als dat er is. */
    volgendeAfspraak: repo.agenda()
      .filter((a) => a.patientId === patientId && a.status === 'gepland')
      .sort((a, b) => a.start.localeCompare(b.start))[0],
  };
}

// ── 7. Praktijkbeeld ────────────────────────────────────────────────────────

export function praktijkSamenvatting(repo: DossierRepository) {
  const dossiers = repo.alleDossiers();
  const plannen = dossiers.map((d) => planVoor(repo, d));
  const metZorg = plannen.filter((p) => p.modules.length > 0);

  // De vergelijking met de huidige inrichting geldt alléén voor patiënten die daar ook
  // daadwerkelijk in zitten. Wie onder geen enkele keten valt heeft nu niets om mee te
  // vergelijken — dat is een aparte, en minstens zo interessante, bevinding.
  const binnenKeten = metZorg.filter((p) => !p.vergelijking.valtBuitenKeten);
  const buitenKeten = metZorg.filter((p) => p.vergelijking.valtBuitenKeten);
  const multi = plannen.filter((p) => p.vergelijking.traditioneleTrajecten.length > 1);

  const traditioneel = binnenKeten.reduce((s, p) => s + p.vergelijking.traditioneleContacten, 0);
  const geintegreerd = binnenKeten.reduce((s, p) => s + p.vergelijking.geintegreerdeContacten, 0);
  const minuten = binnenKeten.reduce((s, p) => s + p.vergelijking.bespaardeMinuten, 0);

  const perModule = new Map<string, number>();
  for (const plan of plannen) {
    for (const module of plan.modules) perModule.set(module.naam, (perModule.get(module.naam) ?? 0) + 1);
  }

  // Onderwerpen die de losse ketens niet systematisch dekken maar hier wel meelopen.
  const extra = new Map<string, number>();
  for (const plan of binnenKeten) {
    for (const onderwerp of plan.vergelijking.extraOnderwerpen) {
      extra.set(onderwerp, (extra.get(onderwerp) ?? 0) + 1);
    }
  }

  return {
    patienten: dossiers.length,
    metChronischeZorg: metZorg.length,
    binnenKeten: binnenKeten.length,
    buitenKeten: buitenKeten.length,
    meerdereTrajecten: multi.length,
    contactenTraditioneel: traditioneel,
    contactenGeintegreerd: geintegreerd,
    minderContactenPerJaar: traditioneel - geintegreerd,
    /**
     * Bewust met teken: het geïntegreerde plan levert mínder contacten op, maar die
     * contacten zijn inhoudelijk breder. Netto kan de consulttijd daardoor stijgen.
     * Dat verzwijgen zou het cijfer waardeloos maken.
     */
    verschilConsulttijdUren: Math.round((minuten / 60) * 10) / 10,
    extraOnderwerpen: [...extra.entries()].map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal),
    modules: [...perModule.entries()].map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal),
  };
}

export function verwerkVragenlijst(vragenlijstId: string, antwoorden: Record<string, unknown>, historie: unknown) {
  const lijst = vindVragenlijst(vragenlijstId);
  if (!lijst) return undefined;
  return verwerk(
    lijst, antwoorden as Parameters<typeof verwerk>[1],
    (historie as Parameters<typeof verwerk>[2]) ?? [],
  );
}

export type { Task };

// ── 8. Registratie vanuit het consult ───────────────────────────────────────

export interface ConsultRegistratie {
  /**
   * Getalwaarden én gecodeerde keuzes; een rookstatus is geen getal.
   *
   * `bron` bepaalt wat de waarde is. `praktijk` betekent: jij legt hem vast en neemt hem
   * voor je rekening. `patient` betekent: de patiënt heeft hem doorgegeven en je bewaart
   * hem als zodanig — zichtbaar in het dossier, maar geen eigen registratie en dus geen
   * grondslag voor een ketenindicator (docs/03 §3).
   */
  metingen: {
    code: string; waarde?: number; keuze?: { code: string; display?: string };
    bron?: 'praktijk' | 'patient';
  }[];
  soep?: { S?: string; O?: string; E?: string; P?: string };
  episodeId?: string;
  /** Wie registreert. Bepaalt de herkomst; de rol volgt uit de gebruiker. */
  gebruikerId?: string;
}

export interface RegistratieUitkomst {
  vastgelegd: { code: string; naam: string; waarde: number | string }[];
  /** Ketenindicatoren die door deze registratie alsnog op orde zijn. */
  verantwoordingGevuld: { keten: string; indicator: string }[];
  /** Wat het systeem hierna zelf doet. */
  vervolg: string[];
}

/**
 * Legt de registratie van een consult vast en laat zien wat er automatisch uit volgt.
 *
 * Dit is het punt waar de belofte moet kloppen: de POH registreert één keer, en de
 * ketenverantwoording, de planning en de oproepen volgen daaruit — zonder dat er
 * ergens "voor de keten" of "voor de indicator" wordt ingevuld.
 */
export function registreerConsult(
  repo: DossierRepository, patientId: string, registratie: ConsultRegistratie,
): RegistratieUitkomst | undefined {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const peildatum = repo.peildatum();
  const nu = peildatum.toISOString();

  const voor = planVoor(repo, dossier);
  const gatenVoor = new Set(
    voor.ketens.flatMap((k) => k.indicatoren.filter((i) => !i.voldaan).map((i) => `${k.naam}|${i.naam}`)),
  );

  const gebruiker = registratie.gebruikerId ? vindGebruiker(registratie.gebruikerId) : undefined;
  const auteurRol = (gebruiker && gebruiker.rol !== 'administrator' ? gebruiker.rol : 'poh-s') as Rol;
  const herkomst = {
    bron: 'zorgverlener' as const,
    vastgelegdOp: nu,
    auteurId: gebruiker?.id ?? 'zv-poh-1',
    auteurRol,
  };

  // Een waarde die de patiënt zelf aanleverde krijgt zíjn herkomst, niet die van jou.
  // Dat is geen formaliteit: het bepaalt of de waarde een ketenindicator vult en of hij
  // straks als jouw registratie de deur uit gaat.
  const patientHerkomst = {
    bron: 'patient' as const,
    vastgelegdOp: nu,
    auteurId: patientId,
    auteurRol: 'patient' as Rol,
  };

  const observaties = registratie.metingen.map((m, i) => ({
    resourceType: 'Observation' as const,
    id: `${patientId}-reg-${Date.now()}-${i}`,
    patientId,
    episodeId: registratie.episodeId,
    code: { coding: [{ system: 'http://loinc.org', code: m.code }] },
    effectief: nu,
    waarde: m.keuze
      ? { code: { system: 'http://snomed.info/sct', code: m.keuze.code, display: m.keuze.display } }
      : { value: m.waarde ?? 0, unit: '' },
    status: 'final' as const,
    herkomst: m.bron === 'patient' ? patientHerkomst : herkomst,
  }));

  const soepRegels = Object.entries(registratie.soep ?? {})
    .filter(([, tekst]) => Boolean(tekst?.trim()))
    .map(([letter, tekst]) => ({ letter: letter as 'S' | 'O' | 'E' | 'P', tekst: tekst!.trim() }));

  const deelcontact = soepRegels.length > 0 && registratie.episodeId
    ? {
        resourceType: 'Deelcontact' as const,
        id: `${patientId}-dc-${Date.now()}`,
        patientId,
        encounterId: `${patientId}-enc-${Date.now()}`,
        episodeId: registratie.episodeId,
        regels: soepRegels,
        afgerond: true,
        herkomst,
      }
    : undefined;

  repo.registreer(patientId, observaties, deelcontact);

  const na = planVoor(repo, repo.dossier(patientId)!);
  const verantwoordingGevuld: RegistratieUitkomst['verantwoordingGevuld'] = [];
  for (const keten of na.ketens) {
    for (const indicator of keten.indicatoren) {
      if (indicator.voldaan && gatenVoor.has(`${keten.naam}|${indicator.naam}`)) {
        verantwoordingGevuld.push({ keten: keten.naam, indicator: indicator.naam });
      }
    }
  }

  const vervolg: string[] = [];
  if (na.contacten[0]) {
    vervolg.push(`Volgend contact herberekend naar ${na.contacten[0].datum} (${na.contacten[0].duurMinuten} min).`);
    if (na.contacten[0].labVooraf.length > 0) {
      vervolg.push(`Labaanvraag voor ${na.contacten[0].labVooraf.join(', ')} wordt automatisch klaargezet.`);
    }
    if (na.contacten[0].vragenlijsten.length > 0) {
      vervolg.push('De voorbereidende vragenlijst wordt tijdig via het portaal uitgezet.');
    }
  }
  if (verantwoordingGevuld.length > 0) {
    vervolg.push(
      `${verantwoordingGevuld.length} ketenindicator(en) zijn hiermee op orde — zonder aparte registratie.`,
    );
  }

  return {
    vastgelegd: registratie.metingen.map((m) => ({
      code: m.code, naam: metingNaam(m.code),
      waarde: m.keuze?.display ?? m.keuze?.code ?? m.waarde ?? '',
    })),
    verantwoordingGevuld,
    vervolg,
  };
}

// ── 9. Agenda ───────────────────────────────────────────────────────────────

export interface AgendaRegel {
  id: string;
  tijd: string;
  duurMinuten: number;
  soort: string;
  titel: string;
  patientId?: string;
  naam?: string;
  leeftijd?: number;
  reden?: string;
  modules: { id: string; naam: string; icoon: string }[];
  /** Kort signaal per regel, zodat de agenda zelf al vertelt waar het om gaat. */
  aandacht?: string;
  voorbereid?: boolean;
  intakeKlaar?: boolean;
  /** Waar de patiënt is: gepland, aangemeld, wachtkamer, in consult, afgerond, no-show. */
  status: Afspraakstatus;
  statusLabel: string;
  aangemeldVia?: string;
  aangemeldOm?: string;
}

/** De dag van één rol, als tijdlijn. Blokken en patiëntafspraken door elkaar. */
export function agenda(repo: DossierRepository, rol: Rol): AgendaRegel[] {
  const peildatum = repo.peildatum();
  const intakes = repo.intakes();

  return repo.agenda(rol).map((item): AgendaRegel => {
    const dossier = item.patientId ? repo.dossier(item.patientId) : undefined;
    if (!dossier) {
      return {
        id: item.id, tijd: item.start.slice(11, 16), duurMinuten: item.duurMinuten,
        soort: item.soort, titel: item.titel, reden: item.reden, modules: [],
        status: item.status, statusLabel: STATUSLABEL[item.status],
      };
    }
    const plan = planVoor(repo, dossier);
    const sig = signalen(dossier, peildatum);
    const zwaarste = sig.find((s) => s.ernst === 'urgent') ?? sig.find((s) => s.ernst === 'aandacht');
    const eerste = plan.contacten[0];
    const ontbreekt = (eerste?.metingen ?? []).filter((m) => m.labVooraf && !m.laatsteOp).length;

    return {
      id: item.id,
      tijd: item.start.slice(11, 16),
      duurMinuten: item.duurMinuten,
      soort: item.soort,
      titel: item.titel,
      patientId: dossier.patient.id,
      naam: item.naam ?? volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      reden: item.reden,
      modules: plan.modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
      aandacht: zwaarste?.tekst,
      voorbereid: rol === 'poh-s' ? ontbreekt === 0 : undefined,
      intakeKlaar: intakes.some((i) => i.patientId === dossier.patient.id),
      status: item.status,
      statusLabel: STATUSLABEL[item.status],
      aangemeldVia: item.aangemeldVia,
      aangemeldOm: item.aangemeldOm?.slice(11, 16),
    };
  });
}

// ── 10. Doktersassistent ────────────────────────────────────────────────────

export interface AssistentOverzicht {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  agenda: AgendaRegel[];
  stroom: {
    triageNieuw: number;
    viaPortaal: number;
    viaTelefoon: number;
    zelfzorgAfgevangen: number;
  };
  autorisatieIngediend: number;
  triage: Triageverzoek[];
}

export function assistentOverzicht(repo: DossierRepository): AssistentOverzicht {
  const triage = repo.triage().filter((t) => t.status === 'nieuw');
  return {
    datum: repo.peildatum().toISOString().slice(0, 10),
    zorgverlener: { naam: 'Ilse Hendriks', rol: 'Doktersassistent' },
    agenda: agenda(repo, 'assistent'),
    stroom: {
      triageNieuw: triage.length,
      viaPortaal: triage.filter((t) => t.kanaal === 'portaal').length,
      viaTelefoon: triage.filter((t) => t.kanaal !== 'portaal').length,
      zelfzorgAfgevangen: triage.filter((t) => t.zelftriage?.bestemming === 'zelfzorg').length,
    },
    autorisatieIngediend: repo.autorisaties().filter((a) => a.status === 'open').length,
    triage,
  };
}

// ── 11. Huisarts ────────────────────────────────────────────────────────────

export interface HuisartsOverzicht {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  agenda: AgendaRegel[];
  autorisatie: {
    open: number;
    routine: number;
    vraagtOordeel: number;
    groepen: Autorisatiegroep[];
  };
  /** Wat het team vandaag heeft vastgelegd, met herkomst. */
  team: { rol: string; naam: string; registraties: number; toelichting: string }[];
}

export function huisartsOverzicht(repo: DossierRepository): HuisartsOverzicht {
  const open = repo.autorisaties().filter((a) => a.status === 'open');
  const groepen = groepeerAutorisaties(repo.autorisaties());
  const datum = repo.peildatum().toISOString().slice(0, 10);

  const deelcontactenVandaag = repo.alleDossiers()
    .flatMap((d) => d.deelcontacten)
    .filter((dc) => dc.herkomst.vastgelegdOp.startsWith(datum));

  const intakes = repo.intakes();

  return {
    datum,
    zorgverlener: { naam: 'Daan Verhoeven', rol: 'Huisarts' },
    agenda: agenda(repo, 'huisarts'),
    autorisatie: {
      open: open.length,
      routine: open.filter((a) => a.routine).length,
      vraagtOordeel: open.filter((a) => !a.routine).length,
      groepen,
    },
    team: [
      {
        rol: 'poh-s', naam: 'Sanne Bakker',
        registraties: deelcontactenVandaag.filter((dc) => dc.herkomst.auteurRol === 'poh-s').length,
        toelichting: 'Chronische controles, vastgelegd in dezelfde episodes als jij gebruikt.',
      },
      {
        rol: 'assistent', naam: 'Ilse Hendriks',
        registraties: repo.triage().filter((t) => t.status === 'afgehandeld').length,
        toelichting: 'Triage en verrichtingen; afgehandelde zorgvragen van vandaag.',
      },
      {
        rol: 'systeem', naam: `${intakes[0]?.app.naam ?? 'Partnerapp'} (wachtkamer)`,
        registraties: intakes.filter((i) => i.bevestigd).length,
        toelichting: 'Voorbereiding uit de wachtkamer. Telt pas mee ná bevestiging door een mens.',
      },
    ],
  };
}

// ── 12. Wachtkamer-intakes ──────────────────────────────────────────────────

export function intakes(repo: DossierRepository) {
  return repo.intakes();
}

export function intakeVoor(repo: DossierRepository, patientId: string) {
  return repo.intakes().find((i) => i.patientId === patientId);
}

// ── 13. Beheer ──────────────────────────────────────────────────────────────

export function beheer() {
  const effectief = configuratie();
  return {
    lagen: configuratieLagen.map((laag) => ({
      niveau: laag.niveau,
      naam: laag.naam,
      beheerder: laag.beheerder,
      gewijzigdOp: laag.gewijzigdOp,
      uitleg: NIVEAU_UITLEG[laag.niveau],
      instellingen: Object.keys(laag.instellingen),
    })),
    instellingen: Object.entries(effectief).map(([sleutel, item]) => ({
      sleutel,
      waarde: item.waarde,
      niveau: item.niveau,
      bron: item.bron,
      overschreven: item.overschreven,
    })),
  };
}

// ── 14. Patiënt zoeken ──────────────────────────────────────────────────────

export interface Zoektreffer {
  patientId: string;
  naam: string;
  geboortedatum: string;
  leeftijd: number;
  bsn?: string;
  modules: { id: string; naam: string; icoon: string }[];
  /** Waarom deze treffer matchte — bij een naamzoekactie zelden nodig, bij BSN wel. */
  reden: string;
}

/**
 * Zoeken op naam, geboortedatum of BSN.
 *
 * Bewust ook op geboortedatum: aan de balie en aan de telefoon is dat de tweede vraag
 * die elke assistent stelt, en met drie mensen die "de Vries" heten is een naam alleen
 * niet genoeg.
 */
export function zoekPatient(repo: DossierRepository, vraag: string, limiet = 8): Zoektreffer[] {
  const q = vraag.trim().toLowerCase();
  if (q.length < 2) return [];
  const peildatum = repo.peildatum();
  const cijfers = q.replace(/\D/g, '');

  const treffers = repo.alleDossiers().flatMap((dossier): (Zoektreffer & { score: number })[] => {
    const naam = volledigeNaam(dossier).toLowerCase();
    const bsn = dossier.patient.identifier[0]?.value ?? '';
    const geboren = dossier.patient.geboortedatum;

    let score = 0;
    let reden = '';
    if (naam.startsWith(q)) { score = 100; reden = 'naam'; }
    else if (naam.includes(q)) { score = 60; reden = 'naam'; }
    else if (cijfers.length >= 4 && bsn.includes(cijfers)) { score = 90; reden = 'BSN'; }
    else if (cijfers.length >= 4 && geboren.replace(/\D/g, '').includes(cijfers)) {
      score = 70; reden = 'geboortedatum';
    }
    if (score === 0) return [];

    return [{
      score,
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      geboortedatum: geboren,
      leeftijd: leeftijd(dossier, peildatum),
      bsn,
      modules: planVoor(repo, dossier).modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
      reden,
    }];
  });

  return treffers
    .sort((a, b) => b.score - a.score || a.naam.localeCompare(b.naam))
    .slice(0, limiet)
    .map(({ score, ...rest }) => rest);
}

// ── 15. Dossierhistorie en meetreeksen ──────────────────────────────────────

/**
 * Waar een meting vandaan komt. Bepaalt hoe je hem wilt lezen: labwaarden wil je in een
 * tabel naast elkaar, een bloeddrukbeloop wil je als lijn. Eén lange lijst met alles
 * door elkaar dwingt je om per regel te bedenken wat je voor je hebt.
 */
export type Meetsoort = 'lab' | 'lichamelijk' | 'vragenlijst' | 'verrichting';

const LABCODES = new Set<string>([CODE.hba1c, CODE.ldl, CODE.egfr, CODE.acr]);
const VRAGENLIJSTCODES = new Set<string>([CODE.ccq, CODE.mpg, CODE.kwetsbaarheid]);
const VERRICHTINGCODES = new Set<string>([CODE.voet, CODE.fundus, CODE.medicatiebeoordeling]);

function meetsoort(code: string): Meetsoort {
  if (LABCODES.has(code)) return 'lab';
  if (VRAGENLIJSTCODES.has(code)) return 'vragenlijst';
  if (VERRICHTINGCODES.has(code)) return 'verrichting';
  return 'lichamelijk';
}

export interface Meetreeks {
  code: string;
  naam: string;
  soort: Meetsoort;
  eenheid?: string;
  /** Hoort deze meting bij het eerstvolgende contact? Bepaalt of hij standaard zichtbaar is. */
  relevantNu: boolean;
  laatste?: number;
  laatsteOp?: string;
  /** Verschil met de meting daarvoor; null als er maar één meting is. */
  verschil?: number;
  punten: { op: string; waarde: number; bron?: string }[];
  /** Referentie- of streefwaarden om tegen af te zetten in de grafiek. */
  streef?: { onder?: number; boven?: number; label: string };
  /** Hoeveel punten door de patiënt zelf zijn aangeleverd. */
  vanPatient?: number;
}

const STREEFWAARDEN: Record<string, { onder?: number; boven?: number; label: string }> = {
  [CODE.hba1c]: { boven: 53, label: 'streefwaarde ≤ 53 mmol/mol' },
  [CODE.rrSys]: { boven: 140, label: 'streefwaarde < 140 mmHg' },
  [CODE.ldl]: { boven: 2.6, label: 'streefwaarde < 2,6 mmol/l' },
  [CODE.egfr]: { onder: 60, label: 'aandacht onder 60 ml/min' },
  [CODE.ccq]: { boven: 1.0, label: 'stabiel onder 1,0' },
};

/** Alle meetreeksen van een patiënt, met de reeks erbij zodat een beloop te tekenen is. */
export function meetreeksen(repo: DossierRepository, patientId: string): Meetreeks[] {
  const dossier = repo.dossier(patientId);
  if (!dossier) return [];
  const plan = planVoor(repo, dossier);
  const nuRelevant = new Set((plan.contacten[0]?.metingen ?? []).map((m) => m.code));

  const codes = [...new Set(dossier.observaties.map((o) => o.code.coding?.[0]?.code))]
    .filter((c): c is string => Boolean(c));

  return codes
    .map((code): Meetreeks => {
      const reeks = metingReeks(dossier, code);
      const punten = reeks
        .map((o) => ({
          op: o.effectief.slice(0, 10), waarde: numeriekeWaarde(o), bron: o.herkomst.bron,
        }))
        .flatMap((p) => (typeof p.waarde === 'number'
          ? [{ op: p.op, waarde: p.waarde, bron: p.bron as string }]
          : []));
      const laatste = punten.at(-1);
      const vorige = punten.at(-2);
      return {
        code,
        naam: metingNaam(code),
        soort: meetsoort(code),
        eenheid: (reeks.at(-1)?.waarde as { unit?: string })?.unit || undefined,
        relevantNu: nuRelevant.has(code),
        laatste: laatste?.waarde,
        laatsteOp: laatste?.op,
        verschil: laatste && vorige ? Math.round((laatste.waarde - vorige.waarde) * 10) / 10 : undefined,
        punten,
        streef: STREEFWAARDEN[code],
        vanPatient: punten.filter((p) => p.bron === 'patient').length,
      };
    })
    // Gecodeerde observaties (rookstatus, verrichtingen zonder getal) horen niet in een
    // reeksenoverzicht: er valt geen beloop van te tekenen en een regel met "0 metingen"
    // suggereert dat er iets ontbreekt terwijl het gewoon een ander soort gegeven is.
    .filter((m) => m.punten.length > 0)
    .sort((a, b) => Number(b.relevantNu) - Number(a.relevantNu) || b.punten.length - a.punten.length);
}

/**
 * Eén tijdlijn, twee soorten inhoud.
 *
 * Wat wij zelf vastlegden staat in SOEP; wat van buiten kwam heeft de structuur van de
 * standaard waarlangs het binnenkwam. Dat samenvoegen tot één SOEP-achtige lijst zou de
 * herkomst wegpoetsen, en dat is precies het verschil dat een zorgverlener moet zien.
 * Daarom: dezelfde chronologie, verschillende vorm.
 */
export type Tijdlijnitem =
  | { soort: 'contact'; datum: string; contact: JournaalRegel }
  | { soort: 'extern'; datum: string; document: ExternDocument }
  | { soort: 'overleg'; datum: string; notitie: Overlegnotitie };

export interface Bron {
  id: string;
  /** 'episode' voor eigen huisartsenzorg, anders de externe bronsoort. */
  aard: 'episode' | 'ziekenhuis' | 'thuiszorg' | 'paramedisch' | 'ggz' | 'apotheek' | 'spoed';
  titel: string;
  toelichting: string;
  aantal: number;
  /** Ingang naar het systeem van de bron. Geen koppeling, wel de plek waar je hem legt. */
  portaal?: { naam: string; url: string };
  ongelezen?: number;
}

const BRONLABEL: Record<string, string> = {
  ziekenhuis: 'Ziekenhuiszorg', thuiszorg: 'Thuiszorg', paramedisch: 'Paramedische zorg',
  ggz: 'GGZ', apotheek: 'Apotheek', spoed: 'Spoedzorg buiten kantooruren',
};

export function dossierHistorie(
  repo: DossierRepository, patientId: string, bronId?: string,
) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const extern = repo.externeDocumenten(patientId);

  const episodes = dossier.episodes.map((e) => ({
    id: e.id, titel: e.titel, status: e.status,
    icpc: e.code.coding?.find((c) => c.system.includes('icpc'))?.code,
    start: e.periode.start,
    aantalContacten: dossier.deelcontacten.filter((dc) => dc.episodeId === e.id).length,
  }));

  // De bronnenkolom: eigen episodes bovenaan, daarna wat er van buiten binnenkwam.
  const externeBronnen = [...new Map(extern.map((d) => [d.bron.id, d.bron])).values()];
  const bronnen: Bron[] = [
    ...episodes.map((e): Bron => ({
      id: e.id, aard: 'episode', titel: `${e.icpc ?? ''} ${e.titel}`.trim(),
      toelichting: `Huisartsenzorg · sinds ${e.start ?? '—'}`, aantal: e.aantalContacten,
    })),
    ...externeBronnen.map((b): Bron => {
      const eigen = extern.filter((d) => d.bron.id === b.id);
      return {
        id: b.id, aard: b.soort, titel: b.naam,
        toelichting: `${BRONLABEL[b.soort] ?? b.soort} · ${[...new Set(eigen.map((d) => d.uitwisseling))].join(', ')}`,
        aantal: eigen.length,
        portaal: b.portaal,
        ongelezen: eigen.filter((d) => !d.gelezen).length,
      };
    }),
  ];

  const isEpisode = episodes.some((e) => e.id === bronId);
  const contacten = journaal(dossier, isEpisode ? bronId : undefined);
  const zichtbaarExtern = bronId
    ? (isEpisode
        // Bij een episodefilter blijft externe zorg zichtbaar als hij aan die episode hangt;
        // een ziekenhuisbrief over dezelfde diabetes hóórt in dat verhaal.
        ? extern.filter((d) => d.episodeIcpc
            && d.episodeIcpc === episodes.find((e) => e.id === bronId)?.icpc)
        : extern.filter((d) => d.bron.id === bronId))
    : extern;
  const zichtbaarContacten = bronId && !isEpisode ? [] : contacten;

  // Het teamoverleg hoort in dezelfde tijdlijn: er is over deze mens gesproken en er is
  // iets besloten. Het is geen consult, dus het krijgt geen SOEP — maar onzichtbaar
  // maken zou betekenen dat het besluit alleen in het hoofd van twee mensen bestaat.
  const notities = bronId && !isEpisode ? [] : repo.overlegnotities(patientId);

  const tijdlijn: Tijdlijnitem[] = [
    ...zichtbaarContacten.map((c): Tijdlijnitem => ({ soort: 'contact', datum: c.datum, contact: c })),
    ...zichtbaarExtern.map((d): Tijdlijnitem => ({ soort: 'extern', datum: d.datum, document: d })),
    ...notities.map((n): Tijdlijnitem => ({ soort: 'overleg', datum: n.op.slice(0, 10), notitie: n })),
  ].sort((a, b) => b.datum.localeCompare(a.datum));

  return {
    journaal: contacten,
    tijdlijn,
    bronnen,
    episodes,
    aantalContacten: dossier.deelcontacten.length,
    aantalExtern: extern.length,
    ongelezenExtern: extern.filter((d) => !d.gelezen).length,
    aantalOverleg: repo.overlegnotities(patientId).length,
  };
}

// ── 16. Orders ──────────────────────────────────────────────────────────────

export function orderVoorstellen(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return [];
  return voorgesteldeOrdersets(dossier, planVoor(repo, dossier), repo.peildatum());
}

/**
 * Het orderoverzicht: wat er loopt, wat er wacht en wat er voorgesteld wordt.
 *
 * De volgorde is die van de vraag die een zorgverlener stelt. Eerst "wat staat er open"
 * — daar moet iemand iets mee. Dan "wat is er besteld" als geheugen. Pas daarna de
 * voorstellen, want die zijn optioneel.
 */
export function orderOverzicht(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const alle = repo.orders(patientId);
  return {
    openstaand: alle.filter((o) => o.status === 'ter-autorisatie' || o.status === 'geplaatst'),
    afgehandeld: alle.filter((o) => o.status === 'uitgevoerd' || o.status === 'afgewezen'
      || o.status === 'ingetrokken').slice(0, 25),
    voorstellen: voorgesteldeOrdersets(dossier, planVoor(repo, dossier), repo.peildatum()),
    medicatie: dossier.medicatie.filter((m) => m.status === 'active').map((m) => ({
      naam: m.middel.text ?? m.middel.coding?.[0]?.display ?? 'Middel',
      atc: m.middel.coding?.[0]?.code,
      dosering: m.dosering,
      chronisch: m.chronisch,
    })),
  };
}

/**
 * Losse orders zoeken.
 *
 * De bewaking draait hier al, niet pas bij het plaatsen: een zoekresultaat dat je niet
 * mag voorschrijven moet dat meteen zeggen, niet nadat je het aan de patiënt hebt
 * uitgelegd.
 */
export function zoekOrders(
  repo: DossierRepository, patientId: string, vraag: string, soorten?: CatalogusSoort[],
) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return [];
  return zoekCatalogus(vraag, soorten).map((treffer) => ({
    ...treffer,
    waarschuwingen: treffer.atc ? bewaakMiddel(treffer.atc, dossier, repo.peildatum()) : [],
  }));
}

export function plaatsLosseOrders(
  repo: DossierRepository, gebruikerId: string, orders: NieuweOrder[],
): Order[] {
  const gebruiker = vindGebruiker(gebruikerId);
  if (!gebruiker) return [];
  if (gebruiker.rol === 'administrator') return [];
  return repo.plaatsOrders(orders, {
    id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol, rechten: gebruiker.rechten,
  });
}

// ── 17. Bespreeklijst ───────────────────────────────────────────────────────

/**
 * Het overleg als scherm.
 *
 * Eén lijst voor huisarts en POH, met per punt de vraag, de context uit het dossier en
 * ruimte voor de uitkomst. Het overlegblok in de agenda verwijst hiernaartoe, zodat het
 * blok geen halfuur zonder inhoud is.
 */
export function overleg(repo: DossierRepository, rol: Rol) {
  const punten = bespreeklijstVoor(repo.bespreekpunten(), rol);
  const blok = repo.agenda(rol).find((a) => a.soort === 'overleg');
  return {
    blok: blok ? { tijd: blok.start.slice(11, 16), duurMinuten: blok.duurMinuten, titel: blok.titel } : undefined,
    open: punten.filter((p) => p.status === 'open'),
    besproken: punten.filter((p) => p.status !== 'open'),
  };
}

// ── 18. Plannen ─────────────────────────────────────────────────────────────

/**
 * Het planbord van één rol: de dag, de vrije plekken en wat er nog moet.
 *
 * Bewust in één antwoord. Wie een plek zoekt, wil de dag ernaast zien — een lijst met
 * losse tijdstippen zonder context laat je de verkeerde plek kiezen, precies naast een
 * visiteblok of vlak voor de lunch.
 */
export function planbord(repo: DossierRepository, rol: Rol, duurMinuten?: number) {
  const slots = repo.vrijeSlots(rol, duurMinuten);
  return {
    rol,
    agenda: agenda(repo, rol),
    slots: slots.map((s) => ({ ...s, tijd: s.start.slice(11, 16) })),
    vrij: slots.length,
    patientPlanbaar: slots.filter((s) => s.patientPlanbaar).length,
    teplannen: teplannen(repo.afspraakverzoeken()),
    routes: PLANROUTE_UITLEG,
  };
}

/**
 * Het planbord van de assistent: alle drie de agenda's naast elkaar.
 *
 * Dit is het werk van de assistent en niet van het systeem: iemand aan de lijn krijgen
 * en die in de juiste agenda op de juiste plek zetten. Daarvoor moet je alle drie de
 * agenda's tegelijk zien, want "past het bij de POH of moet het naar de huisarts" is de
 * eerste vraag en niet de laatste.
 */
export function planbordPraktijk(repo: DossierRepository) {
  const rollen: Rol[] = ['huisarts', 'poh-s', 'assistent'];
  return {
    datum: repo.peildatum().toISOString().slice(0, 10),
    kolommen: rollen.map((rol) => ({
      rol,
      agenda: agenda(repo, rol),
      slots: repo.vrijeSlots(rol).map((s) => ({ ...s, tijd: s.start.slice(11, 16) })),
    })),
    teplannen: teplannen(repo.afspraakverzoeken()),
    routes: PLANROUTE_UITLEG,
  };
}

export function vraagAfspraakAan(
  repo: DossierRepository, gebruikerId: string, verzoek: NieuwAfspraakverzoek,
) {
  const gebruiker = vindGebruiker(gebruikerId);
  if (!gebruiker || gebruiker.rol === 'administrator') return undefined;
  return repo.maakAfspraakverzoek(verzoek, {
    id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol,
  });
}

export type { Planroute };

// ── 19. Praktijkrapportage ──────────────────────────────────────────────────

/**
 * Wat een praktijkmanager wil weten.
 *
 * Niet "hoeveel consulten waren er" — dat weet iedereen wel. Wel: lopen we ergens
 * declaraties mis doordat de registratie niet compleet is, en waar zit dat dan? Dat is
 * precies de vraag waarvoor praktijken nu een datadump naar Excel doen.
 *
 * De rapportage rekent daarom terug vanuit de ketenindicatoren die het systeem toch al
 * afleidt. Geen aparte registratie, geen aparte telling: dezelfde bron als het
 * zorgproces, zodat de cijfers niet uiteen kunnen lopen.
 */
export function praktijkrapportage(repo: DossierRepository) {
  const peildatum = repo.peildatum();
  const dossiers = repo.alleDossiers();

  const perKeten = new Map<string, {
    naam: string; prestatiecode: string; patienten: number; volledig: number;
    ontbrekend: Map<string, number>;
  }>();

  let metZorgvraag = 0;
  let zonderKeten = 0;
  const modulesTelling = new Map<string, number>();

  for (const dossier of dossiers) {
    const plan = planVoor(repo, dossier);
    if (plan.modules.length === 0) continue;
    metZorgvraag++;
    for (const module of plan.modules) {
      modulesTelling.set(module.naam, (modulesTelling.get(module.naam) ?? 0) + 1);
    }
    if (plan.ketens.length === 0) { zonderKeten++; continue; }

    for (const keten of plan.ketens) {
      const regel = perKeten.get(keten.ketenId) ?? {
        naam: keten.naam, prestatiecode: keten.declaratie.prestatiecode,
        patienten: 0, volledig: 0, ontbrekend: new Map<string, number>(),
      };
      regel.patienten++;
      if (keten.volledigheid === 1) regel.volledig++;
      for (const indicator of keten.indicatoren.filter((i) => !i.voldaan)) {
        regel.ontbrekend.set(indicator.naam, (regel.ontbrekend.get(indicator.naam) ?? 0) + 1);
      }
      perKeten.set(keten.ketenId, regel);
    }
  }

  const ketens = [...perKeten.values()].map((k) => ({
    naam: k.naam,
    prestatiecode: k.prestatiecode,
    patienten: k.patienten,
    volledig: k.volledig,
    percentage: k.patienten === 0 ? 0 : Math.round((k.volledig / k.patienten) * 100),
    /** Waar het op vastloopt, grootste knelpunt eerst — daar valt de winst te halen. */
    knelpunten: [...k.ontbrekend.entries()]
      .map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal)
      .slice(0, 4),
  })).sort((a, b) => b.patienten - a.patienten);

  const autorisaties = repo.autorisaties();
  const agendaVandaag = repo.agenda();

  return {
    datum: peildatum.toISOString().slice(0, 10),
    populatie: {
      ingeschreven: dossiers.length,
      metZorgvraag,
      zonderKeten,
      modules: [...modulesTelling.entries()]
        .map(([naam, aantal]) => ({ naam, aantal }))
        .sort((a, b) => b.aantal - a.aantal),
    },
    ketens,
    werkvoorraad: {
      autorisatiesOpen: autorisaties.filter((a) => a.status === 'open').length,
      autorisatiesRoutine: autorisaties.filter((a) => a.status === 'open' && a.routine).length,
      triageOpen: repo.triage().filter((t) => t.status === 'nieuw').length,
      teplannen: teplannen(repo.afspraakverzoeken()).length,
      bespreekpunten: repo.bespreekpunten().filter((p) => p.status === 'open').length,
    },
    bezetting: ['huisarts', 'poh-s', 'assistent'].map((rol) => {
      const eigen = agendaVandaag.filter((a) => a.rol === rol);
      const geboekt = eigen.filter((a) => a.patientId);
      const minuten = geboekt.reduce((som, a) => som + a.duurMinuten, 0);
      return {
        rol,
        afspraken: geboekt.length,
        geboekteMinuten: minuten,
        vrijeSlots: repo.vrijeSlots(rol as Rol).length,
        noshow: eigen.filter((a) => a.status === 'noshow').length,
      };
    }),
  };
}

export function zetOpBespreeklijst(
  repo: DossierRepository, gebruikerId: string, punt: NieuwBespreekpunt,
) {
  const gebruiker = vindGebruiker(gebruikerId);
  if (!gebruiker || gebruiker.rol === 'administrator') return undefined;
  return repo.zetOpBespreeklijst(punt, {
    id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol,
  });
}

// ── 17. Berichten ───────────────────────────────────────────────────────────

export function berichten(repo: DossierRepository, gebruikerId: string) {
  const eigen = gesprekkenVoor(repo.alleGesprekken(), gebruikerId);
  // Bij een patiëntgesprek is de afzender de patiënt en niet een gebruiker; die naam
  // staat in het gesprek zelf. Zonder deze omweg heet de patiënt naar zijn eigen id.
  const verrijk = (g: (typeof eigen)[number]) => ({
    ...g,
    berichten: g.berichten.map((b) => ({
      ...b,
      van: b.vanId === g.patientId ? (g.patientNaam ?? 'Patiënt') : naamVanGebruiker(b.vanId),
      vanPatient: b.vanId === g.patientId,
    })),
  });

  const alle = eigen.map(verrijk);
  return {
    gesprekken: alle,
    collega: alle.filter((g) => g.soort !== 'patient'),
    patient: alle.filter((g) => g.soort === 'patient'),
    ongelezen: ongelezenVoor(repo.alleGesprekken(), gebruikerId),
    ongelezenPatient: ongelezenVoor(
      repo.alleGesprekken().filter((g) => g.soort === 'patient'), gebruikerId),
  };
}
