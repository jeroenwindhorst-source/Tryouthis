import type { Dossier, Rol, Task } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, metingReeks, numeriekeWaarde } from '@zpe/fhir-model';
import {
  automatisering, bouwZorgplan, beoordeelInstroom, CODE, instroomOverzicht,
  planOproepen, suggesties, verwerk, vindVragenlijst,
  type Suggestie, type Zorgplan,
} from '@zpe/care-engine';
import { NIVEAU_UITLEG } from '@zpe/configuratie';
import { metingNaam } from './terminologie.js';
import { configuratie, configuratieLagen } from './configuratie-demo.js';
import {
  groepeerAutorisaties, type Autorisatiegroep, type Triageverzoek, type WachtkamerIntake,
} from './werkvoorraad.js';
import type { DossierRepository } from './store.js';

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

export interface Afsluitpunt {
  categorie: string;
  omschrijving: string;
  aantal: number;
  blokkerend: boolean;
  bulkVeilig: boolean;
  toelichting: string;
}

export function dagafsluiting(repo: DossierRepository) {
  const peildatum = repo.peildatum();
  const datum = peildatum.toISOString().slice(0, 10);
  const afspraken = repo.spreekuur(datum);

  let indicatorenOnvolledig = 0;
  let zonderVragenlijst = 0;
  const ketenGaten = new Map<string, number>();

  for (const afspraak of afspraken) {
    const dossier = repo.dossier(afspraak.patientId);
    if (!dossier) continue;
    const plan = planVoor(repo, dossier);
    for (const keten of plan.ketens) {
      const gaten = keten.indicatoren.filter((i) => !i.voldaan).length;
      if (gaten > 0) {
        indicatorenOnvolledig++;
        ketenGaten.set(keten.naam, (ketenGaten.get(keten.naam) ?? 0) + gaten);
      }
    }
    if ((plan.contacten[0]?.vragenlijsten.length ?? 0) > 0) zonderVragenlijst++;
  }

  const punten: Afsluitpunt[] = [
    {
      categorie: 'Verantwoording',
      omschrijving: 'Patiënten met ontbrekende ketenindicatoren',
      aantal: indicatorenOnvolledig,
      blokkerend: false,
      bulkVeilig: true,
      toelichting: [...ketenGaten.entries()].map(([naam, n]) => `${naam}: ${n} gaten`).join(' · ') ||
        'Alle indicatoren zijn op orde.',
    },
    {
      categorie: 'Voorbereiding volgende keer',
      omschrijving: 'Vragenlijsten die klaargezet kunnen worden',
      aantal: zonderVragenlijst,
      blokkerend: false,
      bulkVeilig: true,
      toelichting: 'Logistiek werk zonder klinische beslissing — kan in één handeling.',
    },
    {
      categorie: 'Openstaande taken',
      omschrijving: 'Taken die vandaag zijn ontstaan en nog open staan',
      aantal: repo.taken().filter((t) => t.status === 'requested').length,
      blokkerend: repo.taken().some((t) => t.status === 'requested' && t.prioriteit === 'asap'),
      bulkVeilig: false,
      toelichting: 'Alles met een reden en een voorgestelde afhandeling.',
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
  /** Getalwaarden én gecodeerde keuzes; een rookstatus is geen getal. */
  metingen: { code: string; waarde?: number; keuze?: { code: string; display?: string } }[];
  soep?: { S?: string; O?: string; E?: string; P?: string };
  episodeId?: string;
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

  const herkomst = {
    bron: 'zorgverlener' as const,
    vastgelegdOp: nu,
    auteurId: 'zv-poh-1',
    auteurRol: 'poh-s' as const,
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
    herkomst,
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
        soort: item.soort, titel: item.titel, modules: [],
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
