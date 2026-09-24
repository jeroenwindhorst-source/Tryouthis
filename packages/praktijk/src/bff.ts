import type { Dossier, Rol, Task } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, metingReeks, numeriekeWaarde } from '@zpe/fhir-model';
import {
  automatisering, bewaakMiddel, bouwZorgplan, beoordeelInstroom, CODE, doorlooptijdReden,
  doorlooptijdVan, instroomOverzicht, ketens, modules, planOproepen, REGELSET_VERSIE,
  suggesties, verwerk, vindVragenlijst, voorgesteldeOrdersets, zoekCatalogus,
  type CatalogusSoort, type Suggestie, type Zorgplan,
} from '@zpe/care-engine';
import { NIVEAU_UITLEG } from '@zpe/configuratie';
import { metingNaam } from './terminologie.js';
import { configuratie, configuratieLagen } from './configuratie-demo.js';
import { journaal, type JournaalRegel } from './historie.js';
import type { ExternDocument } from './externe-bronnen.js';
import type { NieuweOrder, Order } from './orderopslag.js';
import { bespreeklijstVoor, type NieuwBespreekpunt } from './bespreeklijst.js';
import {
  beoordeelDeclaratie, contactvormen, naarContactSoort, vindContactvorm, type Contactvorm,
} from './contactsoorten.js';
import { acuutVoor, BRON_LABEL, URGENTIE_UITLEG } from './acuut.js';
import { bouwSamenvatting } from './samenvatting.js';
import { MEDIABRON_LABEL, MEDIASOORT_LABEL, type Mediafilter } from './media.js';
import {
  APOTHEKEN, beschrijfWijziging, REDENEN, vindApotheek, voorkeursapotheek,
  WIJZIGING_LABEL, type Medicatiewijziging,
} from './medicatie.js';
import type { NieuwGroepsconsult } from './groepsconsult.js';
import {
  draaiRapport, exporteerGeaggregeerd, filtervelden, type Criteria,
} from './rapportage.js';
import {
  buitenBandbreedte, verrichtingsoorten, vindVerrichting, type Beoordelaar,
  type Verrichtinguitslag,
} from './verrichtingen.js';
import { bouwInzage, type Vragenlijstinzage } from './vragenlijstinzage.js';
import {
  takenVoor, TAAKSOORTEN, vindTaaksoort,
  type NieuweTaak, type Taaksoort, type Taaksoortdefinitie, type Werktaak,
} from './taken.js';
import { gebruikers, vindGebruiker } from './gebruikers.js';
import { gesprekkenVoor, naamVanGebruiker, ongelezenVoor } from './berichten.js';
import {
  demoNu, groepeerAutorisaties, STATUSLABEL,
  type Afspraakstatus, type Autorisatiegroep, type Triageverzoek, type WachtkamerIntake,
} from './werkvoorraad.js';
import type { DossierRepository, Overlegnotitie } from './store.js';
import { PLANROUTE_UITLEG, teplannen, type NieuwAfspraakverzoek, type Planroute } from './planning.js';

/**
 * Samenstellingen per werkplek (docs/05). De FHIR-facade blijft generiek; deze laag
 * maakt er schermen van. Bevat zelf geen klinische regels — die staan in care-engine.
 *
 * De indeling volgt het werkproces van de POH, niet de structuur van het dossier:
 * aanloop → spreekuur → opvolgen → monitoren → afronden.
 */

export function volledigeNaam(dossier: Dossier): string {
  const n = dossier.patient.naam;
  return [n.voornaam ?? n.initialen, n.tussenvoegsel, n.achternaam].filter(Boolean).join(' ');
}

function planVoor(repo: DossierRepository, dossier: Dossier): Zorgplan {
  return bouwZorgplan(dossier, repo.persoonlijkPlan(dossier.patient.id), {
    peildatum: repo.peildatum(),
    // Het protocol van déze praktijk, niet de landelijke richtlijn: een afwijking die je
    // in het beheerscherm instelt, moet meteen doorwerken in ieders zorgplan.
    protocol: repo.praktijkprotocol(),
  });
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

/** Waarom een signaal van deze soort bovenaan hoort te staan, in één regel. */
const SIGNAALTOELICHTING: Record<Signaal['soort'], string> = {
  meetwaarde: 'Waarde buiten de streefwaarde. Beoordelen vóór het volgende contact.',
  achterstand: 'De controle is te lang geleden; er is nu geen actueel beeld.',
  trend: 'Het beloop gaat de verkeerde kant op, niet één losse uitschieter.',
  voorbereiding: 'Wat voor dit contact nodig is, is nog niet binnen.',
};

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

/**
 * DE DAG VAN DE POH IN VIJF BLOKKEN
 *
 * De eerste indeling had 'voorbereiden' en 'spreekuur' naast elkaar staan, en dat liep
 * door elkaar heen: voorbereiden ging over de patiënten van vandaag, en dat is precies
 * wat je in het spreekuur doet, vlak voordat je iemand binnenroept. Twee tegels voor
 * één handeling.
 *
 * Wat er wél ontbrak, was de tijdshorizon. De blokken hieronder staan op volgorde van
 * hoe ver het moment ligt waarop er iets gebeurt:
 *
 *   Aanloop    — de komende weken: afspraken waarvan de voorbereiding niet op schema ligt.
 *   Spreekuur  — vandaag: de mensen die komen, met hun voorbereiding erbij.
 *   Opvolgen   — nu: alles wat aandacht vraagt bij wie géén afspraak heeft.
 *   Afronden   — straks: wat de dag sluitend maakt.
 *
 * 'Monitoren' stond hier als vijfde blok en is opgegaan in Opvolgen. Het ging over
 * grotendeels dezelfde mensen en dezelfde waarden: een eGFR van 40 stond in het ene blok
 * als binnengekomen uitslag en in het andere als afwijkende waarde. Twee lijsten waarvan
 * je moet onthouden in welke iets staat, kosten meer dan ze opleveren.
 *
 * Het volledige cohort dat op afstand wordt gevolgd — inclusief iedereen die stabiel is —
 * blijft bestaan, maar als overzicht onder Praktijk, niet als werkblok. 'Wie volg ik' is
 * een andere vraag dan 'wat moet ik vandaag doen', en alleen de tweede hoort in de dag.
 */
export interface Processtap {
  id: 'aanloop' | 'spreekuur' | 'opvolgen' | 'afronden';
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
  const aanloopregels = aanloop(repo);
  const opvolgregels = opvolgen(repo);
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

  /*
   * "Vraagt als eerste aandacht" is de eerste kaart waar een POH naar kijkt, en die moet
   * de vraag beantwoorden die zij op dat moment stelt: wie van vandaag springt eruit?
   *
   * Dat antwoord zat alleen in de suggesties, en een suggestie is zelden 'urgent' — een
   * voorstel om iets te doen is per definitie afgewogen. De scherpte zit in de signálen:
   * een HbA1c boven 75, een bloeddruk boven 180, een eGFR onder 30, een CCQ die met een
   * heel punt stijgt. Die stonden hier niet in, en daardoor bleef de kaart leeg terwijl
   * er wel degelijk iets uitsprong.
   */
  const urgent: Dagstart['urgent'] = [];
  const gezien = new Set<string>();

  // Wat vanochtend binnenkwam en scherp is, staat vooraan: een thuisreeks van 160 of een
  // eGFR van 40 is concreter dan welke suggestie dan ook, en het is nieuw.
  for (const regel of opvolgregels.filter((o) => o.ernst === 'urgent')) {
    if (gezien.has(regel.patientId)) continue;
    gezien.add(regel.patientId);
    urgent.push({
      patientId: regel.patientId, naam: regel.naam,
      titel: regel.titel, bevinding: regel.bevinding,
    });
  }

  for (const patientId of relevante) {
    const dossier = repo.dossier(patientId);
    if (!dossier) continue;
    for (const signaal of signalen(dossier, peildatum).filter((sg) => sg.ernst === 'urgent')) {
      if (gezien.has(patientId)) break;
      gezien.add(patientId);
      urgent.push({
        patientId,
        naam: volledigeNaam(dossier),
        titel: signaal.tekst,
        bevinding: SIGNAALTOELICHTING[signaal.soort],
      });
    }
  }
  for (const suggestie of alleSuggesties.filter((sg) => sg.ernst === 'urgent')) {
    if (gezien.has(suggestie.patientId)) continue;
    gezien.add(suggestie.patientId);
    urgent.push({
      patientId: suggestie.patientId,
      naam: volledigeNaam(repo.dossier(suggestie.patientId)!),
      titel: suggestie.titel,
      bevinding: suggestie.bevinding,
    });
  }

  return {
    datum,
    zorgverlener: { naam: 'Sanne Bakker', rol: 'POH-Somatiek' },
    agenda: agenda(repo, 'poh-s'),
    stappen: [
      {
        id: 'aanloop', naam: 'Aanloop', omschrijving: 'Komende afspraken die nog niet rond zijn',
        watZieIk: 'Wie over een paar dagen komt terwijl het bloedonderzoek of de vragenlijst '
          + 'nog niet binnen is — nu bellen of de afspraak verzetten.',
        aantal: aanloopregels.length,
        aandacht: aanloopregels.filter((a) => a.status === 'bellen' || a.status === 'verzetten').length,
      },
      {
        id: 'spreekuur', naam: 'Spreekuur', omschrijving: 'Mijn patiënten van vandaag',
        watZieIk: 'Per patiënt de voorbereiding: wat er binnen is, wat de vragenlijst zegt '
          + 'en waar dit consult over moet gaan.',
        aantal: afspraken.length,
        aandacht: voorbereidingen.filter((v) => v.signalen.some((s) => s.ernst !== 'informatief')).length,
      },
      {
        id: 'opvolgen', naam: 'Opvolgen', omschrijving: 'Vraagt aandacht, zonder afspraak',
        watZieIk: 'Uitslagen, vragenlijsten, thuismetingen en afwijkende beloopen van mensen '
          + 'die vandaag niet komen — vaak met een bericht of een recept afgehandeld.',
        aantal: opvolgregels.length,
        aandacht: opvolgregels.filter((o) => o.ernst === 'urgent').length,
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
    urgent: urgent.slice(0, 6),
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
  /**
   * Wat vóór dit consult binnen had moeten zijn en er niet is. Alleen dát is een
   * tekort; wat in de spreekkamer gemeten wordt, hoort in `tijdensConsult`.
   */
  ontbreekt: string[];
  /** Wat de POH zo meteen zelf doet: voetonderzoek, spirometrie, rookstatus. */
  tijdensConsult: string[];
  signalen: Signaal[];
  /** De twee tot drie dingen die dit consult echt moeten opleveren. */
  gespreksonderwerpen: { titel: string; bevinding: string; ernst: string }[];
  doelen: { tekst: string }[];
  zelfredzaamheid?: { gemiddelde: number; niveau: string; knelpunten: string[] };
  /** Voorbereiding uit de wachtkamer, geleverd door een ingebedde partnerapp. */
  intake?: WachtkamerIntake;
  /** De consultvoorbereidende vragenlijst met de antwoorden van de patiënt. */
  vragenlijst?: Vragenlijstinzage;
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

    /*
     * Drie stapels, niet twee.
     *
     * 'Ontbreekt' betekende hier alles wat nog geen recente waarde had — en dus stond er
     * bij vrijwel iedereen 'voetonderzoek' en 'rookstatus' bij, terwijl dat nu juist de
     * dingen zijn die de POH straks in de spreekkamer doet. Daarmee las de kaart als een
     * achterstand terwijl het gewoon de agenda van het consult was.
     *
     * Wat écht ontbreekt, is wat vooraf geregeld had moeten zijn: labuitslagen en de
     * vragenlijst. Blijft dat leeg, dan is het consult niet af te maken, en dan hoort
     * deze patiënt niet vandaag maar in de aanloop thuis.
     */
    const binnen: string[] = [];
    const ontbreekt: string[] = [];
    const tijdensConsult: string[] = [];
    for (const meting of eerste?.metingen ?? []) {
      if (meting.laatsteOp && meting.vervaltOp > datum) {
        binnen.push(`${meting.naam} ${meting.laatsteWaarde ?? ''}`.trim());
      } else if (meting.labVooraf) {
        ontbreekt.push(meting.naam);
      } else {
        tijdensConsult.push(meting.naam);
      }
    }

    const afname = repo.afnames(dossier.patient.id)
      .find((a) => a.vragenlijstId === 'vl-consultvoorbereiding');
    const vragenlijst = afname ? bouwInzage(afname, peildatum) : undefined;
    if (vragenlijst && vragenlijst.status === 'open') ontbreekt.push(vragenlijst.naam.toLowerCase());

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
      tijdensConsult,
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
      vragenlijst,
    }];
  });
}

// ── 3. Aanloop ──────────────────────────────────────────────────────────────

/**
 * DE AANLOOP NAAR EEN CONTROLE
 *
 * Wat hier zichtbaar wordt, is nu bij iedere praktijk onzichtbaar. Drie weken voor een
 * chronische controle gaat er automatisch een uitnodiging uit om bloed te laten prikken.
 * Bij de meeste mensen gebeurt dat ook. Bij een deel niet, en dat merkt de praktijk pas
 * op het moment dat de patiënt in de spreekkamer zit — waarna het consult over niets
 * gaat en er een nieuwe afspraak gemaakt moet worden.
 *
 * Het systeem weet dit allemaal ruim van tevoren. Het weet wanneer de afspraak staat,
 * wat er vooraf binnen moet zijn, wat er binnen is en hoeveel dagen er nog over zijn.
 * Het enige dat ontbrak, was een plek waar dat bij elkaar staat met een advies erbij.
 *
 * De kern is dat hetzelfde feit een ander gevolg heeft naarmate de afspraak dichterbij
 * komt. 'Nog niet geprikt' is over drie weken een herinnering, over acht dagen een
 * telefoontje, en over drie dagen een reden om de afspraak te verzetten.
 */

export type Aanloopstatus =
  | 'op-schema' | 'herinnering-loopt' | 'bellen' | 'verzetten' | 'opgepakt';

export const AANLOOPSTATUS_LABEL: Record<Aanloopstatus, string> = {
  'op-schema': 'Op schema',
  'herinnering-loopt': 'Herinnering loopt',
  bellen: 'Bellen',
  verzetten: 'Verzetten',
  opgepakt: 'Opgepakt',
};

export interface Aanloopregel {
  afspraakId: string;
  patientId: string;
  naam: string;
  leeftijd: number;
  datum: string;
  tijd: string;
  /** Aantal dagen tot de afspraak. */
  dagenTot: number;
  modules: { id: string; naam: string; icoon: string }[];
  /**
   * Wat vóór het consult binnen moet zijn, met de stand van zaken per onderdeel.
   *
   * `haalbaar` is het verschil dat ertoe doet: er zijn nog genoeg dagen over voor de
   * doorlooptijd van dít onderdeel. Een vragenlijst haalt dat bijna altijd, een
   * labuitslag niet.
   */
  vooraf: {
    naam: string; binnen: boolean; op?: string;
    doorlooptijdDagen: number; haalbaar: boolean;
  }[];
  vragenlijst?: { naam: string; status: 'ingevuld' | 'open'; openDagen?: number };
  status: Aanloopstatus;
  /** Wat de POH nu zou doen. Eén zin, geen keuzemenu. */
  advies: string;
  toelichting: string;
  /**
   * De taak die hiervoor is uitgezet, als die er is.
   *
   * Zonder dit veld blijft dezelfde regel na 'bellen en herinneren' onveranderd staan, en
   * dan is de knop een demonstratie van een knop. Nu verandert de stand en staat erbij
   * wie het oppakt.
   */
  taak?: {
    id: string; titel: string; voorNaam: string;
    status: string; standLabel: string; soortLabel: string;
  };
}

const AANLOOPGEWICHT: Record<Aanloopstatus, number> = {
  verzetten: 0, bellen: 1, 'herinnering-loopt': 2, opgepakt: 3, 'op-schema': 4,
};

/** Korte weergave van een taak, voor een regel die alleen de stand hoeft te tonen. */
function taakstand(taak: Werktaak, vandaag: string): Aanloopregel['taak'] {
  const regel = verrijkTaak(taak, vandaag);
  return {
    id: regel.id, titel: regel.titel, voorNaam: regel.voorNaam,
    status: regel.status, standLabel: regel.standLabel, soortLabel: regel.soortLabel,
  };
}

export function aanloop(repo: DossierRepository): Aanloopregel[] {
  const peildatum = repo.peildatum();
  const vandaag = peildatum.toISOString().slice(0, 10);

  const openTaken = repo.werktaken().filter((t) => t.status !== 'afgerond');

  const regels = repo.aanloop().flatMap((afspraak): Aanloopregel[] => {
    const dossier = repo.dossier(afspraak.patientId);
    if (!dossier) return [];
    const plan = planVoor(repo, dossier);
    const datum = afspraak.start.slice(0, 10);
    const dagenTot = Math.round(
      (new Date(datum).getTime() - new Date(vandaag).getTime()) / 86_400_000,
    );

    /*
     * 'Binnen' is niet 'ooit geprikt'. Een LDL van vorig jaar staat in het dossier maar
     * zegt niets over de vraag of deze controle door kan gaan; daarvoor telt alleen of de
     * uitslag nog geldig is op het moment van de afspraak.
     */
    const vooraf: Aanloopregel['vooraf'] = (plan.contacten[0]?.metingen ?? [])
      .filter((m) => m.labVooraf)
      .map((m) => {
        const binnen = Boolean(m.laatsteOp) && m.vervaltOp > datum;
        return {
          naam: m.naam,
          binnen,
          op: m.laatsteOp,
          doorlooptijdDagen: m.doorlooptijdDagen,
          // Haalbaar zolang er nog meer dagen over zijn dan het onderdeel nodig heeft.
          haalbaar: binnen || dagenTot >= m.doorlooptijdDagen,
        };
      });

    const afname = repo.afnames(dossier.patient.id)
      .find((a) => a.vragenlijstId === 'vl-jaarscreening');
    const inzage = afname ? bouwInzage(afname, peildatum) : undefined;
    const openLijst = inzage?.status === 'open';

    /*
     * DE DOORLOOPTIJD VERSCHILT PER ONDERDEEL — EN DAT IS DE HELE POINTE
     *
     * Eerder gold één grens van vijf dagen voor alles wat nog binnen moest komen, en dan
     * kwam er bij een afspraak over vier dagen te staan dat óók de vragenlijst niet meer
     * op tijd zou zijn. Dat is niet waar: een vragenlijst kan de avond ervoor nog
     * ingevuld worden. Bloed prikken kan dat niet.
     *
     * De doorlooptijd hoort dus bij het onderdeel, niet bij het blok — en ze staat in het
     * protocol, waar de praktijk hem kan aanpassen als het prikpunt trager of sneller is
     * (ADR-0017). Het gevolg is dat één afspraak twee adviezen tegelijk kan opleveren:
     * dit lukt niet meer, dat lukt nog wel.
     */
    const lijstDoorlooptijd = 1;
    const open = [
      ...vooraf.filter((v) => !v.binnen),
      // In het advies heet hij gewoon 'de vragenlijst'; de volledige naam staat als
      // merkje bij de regel. Een zin met 'jaarlijkse screening — controle' erin
      // middenin leest niet meer als een advies.
      ...(openLijst
        ? [{
            naam: 'de vragenlijst', binnen: false,
            doorlooptijdDagen: lijstDoorlooptijd,
            haalbaar: dagenTot >= lijstDoorlooptijd,
          }]
        : []),
    ];
    const teLaat = open.filter((v) => !v.haalbaar);
    const kanNog = open.filter((v) => v.haalbaar);

    const status: Aanloopstatus = open.length === 0
      ? 'op-schema'
      : teLaat.length > 0 ? 'verzetten'
      // Nog haalbaar, maar de speling is op: minder dan vijf dagen marge boven de
      // doorlooptijd betekent dat wachten het alsnog laat mislukken.
      : kanNog.some((v) => dagenTot - v.doorlooptijdDagen <= 5) ? 'bellen'
      : 'herinnering-loopt';

    // Opsomming met komma's en één 'en' aan het eind. Drie keer 'en' in één zin leest
    // als een foutmelding, en dat is precies niet de indruk die dit blok moet wekken.
    const opsom = (namen: string[]) => namen.length <= 1
      ? namen.join('')
      : `${namen.slice(0, -1).join(', ')} en ${namen.at(-1)}`;

    const advies = {
      'op-schema': 'Niets te doen — alles is binnen.',
      'herinnering-loopt': `Herinnering staat uit voor ${opsom(open.map((v) => v.naam))}. `
        + `Nog ${dagenTot} dagen.`,
      bellen: `Bellen: ${opsom(kanNog.map((v) => v.naam))} nog niet binnen, en er zijn nog `
        + `${dagenTot} dagen.`,
      verzetten: `Verzetten: ${opsom(teLaat.map((v) => v.naam))} `
        + `${teLaat.length === 1 ? 'komt' : 'komen'} in ${dagenTot} dagen niet meer op tijd binnen.`,
    }[status];

    const toelichting = {
      'op-schema': 'De voorbereiding is compleet; dit consult kan doorgaan zoals gepland.',
      'herinnering-loopt': 'De automatische uitnodiging is verstuurd. Er is nog ruim tijd; '
        + 'ingrijpen is nu niet nodig.',
      bellen: 'De uitnodiging heeft niet gewerkt. Een telefoontje nu houdt de afspraak heel; '
        + 'wachten betekent dat de afspraak straks alsnog verzet moet worden.',
      verzetten: kanNog.length > 0
        // Het verschil benoemen in plaats van alles op één hoop gooien: wat nog wel kan,
        // hoeft niet mee te verhuizen naar een nieuwe afspraak.
        ? 'Prikken en de uitslag terugkrijgen kost meer dagen dan er nog zijn. Wat nog wél kan: '
          + `${opsom(kanNog.map((v) => v.naam))} — dat hoeft het verzetten niet tegen te houden, `
          + 'maar zonder uitslag gaat dit consult over niets.'
        : 'Prikken en de uitslag terugkrijgen kost meer dagen dan er nog zijn. Dit consult '
          + 'gaat zonder uitslag over niets; een week later verzetten kost minder dan het dubbel doen.',
    }[status];

    /*
     * Is er al iets voor deze afspraak uitgezet? Dan is de stand 'opgepakt', ongeacht wat
     * er nog ontbreekt. Anders blijft dezelfde regel schreeuwen terwijl er iemand mee
     * bezig is — en dat is precies waarom mensen zulke lijsten gaan negeren.
     */
    const taak = openTaken.find(
      (t) => t.bron.soort === 'aanloop' && t.bron.verwijzing === afspraak.id,
    );

    return [{
      afspraakId: afspraak.id,
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      datum,
      tijd: afspraak.start.slice(11, 16),
      dagenTot,
      modules: plan.modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
      vooraf,
      vragenlijst: inzage
        ? { naam: inzage.naam, status: inzage.status, openDagen: inzage.openDagen }
        : undefined,
      status: taak ? 'opgepakt' : status,
      advies: taak
        ? `${taak.titel} — ligt bij ${taak.voorNaam}.`
        : advies,
      toelichting: taak
        ? `Uitgezet door ${taak.aangemaaktDoor}: ${taak.aanleiding}`
        : toelichting,
      taak: taak ? taakstand(taak, vandaag) : undefined,
    }];
  });

  return regels.sort((a, b) =>
    AANLOOPGEWICHT[a.status] - AANLOOPGEWICHT[b.status] || a.dagenTot - b.dagenTot);
}

// ── 4. Opvolgen ─────────────────────────────────────────────────────────────

/**
 * WAT ER BINNENKWAM EN OM EEN BESLUIT VRAAGT
 *
 * Alles wat aandacht vraagt bij iemand die vandaag niet op het spreekuur staat, op één
 * plek en in één vorm: aanleiding, bevinding, voorstel, en drie knoppen om het af te
 * handelen.
 *
 * Dit blok stond eerst náást 'monitoren', en dat werkte niet. Ze gingen over grotendeels
 * dezelfde mensen: dezelfde eGFR van 40 stond hier als binnengekomen uitslag en daar als
 * afwijkende waarde. Twee lijsten met overlappende inhoud kosten meer dan ze opleveren,
 * want je moet er steeds achter komen in welke van de twee iets staat.
 *
 * De aanleiding blijft wél zichtbaar, want die bepaalt hoe je reageert:
 *
 *   labuitslag   — kwam binnen op een aanvraag van de praktijk
 *   vragenlijst  — de patiënt heeft iets opgeschreven
 *   thuismeting  — de patiënt meet zelf, en de reeks wijkt af
 *   signaal      — niets kwam binnen; het beloop in het dossier wijkt af
 *
 * Eén regel per aanleiding, en nooit twee regels over hetzelfde: wie een uitslag heeft
 * die om een besluit vraagt, krijgt niet ook nog een signaal over diezelfde waarde.
 *
 * Wie geen aanleiding heeft, staat hier niet. Het volledige cohort dat op afstand wordt
 * gevolgd — inclusief iedereen die stabiel is — staat onder Praktijk › Mijn cohort.
 */

export type Opvolgbron = 'labuitslag' | 'vragenlijst' | 'thuismeting' | 'signaal';

export const OPVOLGBRON_LABEL: Record<Opvolgbron, string> = {
  labuitslag: 'Labuitslag binnen',
  vragenlijst: 'Vragenlijst ingevuld',
  thuismeting: 'Thuismetingen',
  signaal: 'Uit het beloop',
};

export interface Opvolgregel {
  id: string;
  patientId: string;
  naam: string;
  leeftijd: number;
  bron: Opvolgbron;
  /** Wanneer het binnenkwam. */
  binnenOp: string;
  titel: string;
  bevinding: string;
  ernst: 'informatief' | 'aandacht' | 'urgent';
  /** Wat het systeem voorstelt te doen — de POH beslist. */
  voorstel: string;
  modules: { id: string; naam: string; icoon: string }[];
  zelfredzaamheid?: { gemiddelde: number; niveau: string; richting?: string };
  /**
   * Afhandelbare suggesties. Bij een signaal uit het beloop zijn dat de voorstellen die
   * eerder onder 'monitoren' stonden — hier direct af te handelen in plaats van in een
   * tweede scherm dat over grotendeels dezelfde mensen ging.
   */
  suggesties: Suggestie[];
  /** De taak die hiervoor is uitgezet, als die er is. */
  taak?: {
    id: string; titel: string; voorNaam: string;
    status: string; standLabel: string; soortLabel: string;
  };
}

const ERNSTGEWICHT = { urgent: 0, aandacht: 1, informatief: 2 } as const;

/** De laatste dag waarop er iets gemeten is — het anker voor een signaal zonder eigen datum. */
function laatsteMeetdatum(dossier: Dossier): string | undefined {
  return dossier.observaties
    .map((o) => o.effectief.slice(0, 10))
    .sort()
    .at(-1);
}

export function opvolgen(repo: DossierRepository): Opvolgregel[] {
  const peildatum = repo.peildatum();
  const vandaag = peildatum.toISOString().slice(0, 10);
  // Wie vandaag komt, hoort in het spreekuur; hier staat alleen wie geen afspraak heeft.
  const vandaagOpSpreekuur = new Set(repo.spreekuur(vandaag).map((a) => a.patientId));
  const regels: Opvolgregel[] = [];

  for (const dossier of repo.alleDossiers()) {
    const patientId = dossier.patient.id;
    if (vandaagOpSpreekuur.has(patientId)) continue;
    const naam = volledigeNaam(dossier);
    const jaren = leeftijd(dossier, peildatum);
    // De aandachtsgebieden horen op elke kaart, ongeacht de aanleiding: zonder die
    // context is 'eGFR 40' een getal en niet een mens met een nierfunctie die meetelt.
    const modules = planVoor(repo, dossier).modules
      .map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon }));

    // 1. Labuitslagen die de afgelopen twee weken binnenkwamen en afwijken.
    const recentLab = dossier.observaties
      .filter((o) => o.herkomst.bron === 'extern-systeem' && o.herkomst.opEigenAanvraag
        && (peildatum.getTime() - new Date(o.effectief).getTime()) / 86_400_000 <= 14);
    for (const uitslag of recentLab) {
      const code = uitslag.code.coding?.[0]?.code;
      const waarde = numeriekeWaarde(uitslag);
      if (!code || waarde === undefined) continue;
      const grens = LABGRENS[code];
      if (!grens || !grens.buiten(waarde)) continue;
      regels.push({
        id: `opv-lab-${uitslag.id}`,
        patientId, naam, leeftijd: jaren,
        bron: 'labuitslag',
        binnenOp: uitslag.effectief.slice(0, 10),
        titel: `${metingNaam(code)} ${waarde} ${uitslag.waarde && 'unit' in uitslag.waarde ? uitslag.waarde.unit ?? '' : ''}`.trim(),
        bevinding: grens.bevinding,
        ernst: grens.ernst,
        voorstel: grens.voorstel,
        modules, suggesties: [],
      });
    }

    // 2. Ingevulde vragenlijsten waar een regel op afging.
    for (const afname of repo.afnames(patientId)) {
      if (!afname.ingevuldOp || afname.overgenomenOp) continue;
      const inzage = bouwInzage(afname, peildatum);
      const zwaarste = inzage?.signalen.find((sg) => sg.ernst !== 'informatief');
      if (!inzage || !zwaarste) continue;
      regels.push({
        id: `opv-vl-${afname.id}`,
        patientId, naam, leeftijd: jaren,
        bron: 'vragenlijst',
        binnenOp: afname.ingevuldOp.slice(0, 10),
        titel: inzage.kernzin ? `“${inzage.kernzin}”` : zwaarste.tekst,
        bevinding: `${inzage.naam}, ingevuld ${inzage.kanaal}. ${zwaarste.onderbouwing}`,
        ernst: zwaarste.ernst,
        voorstel: `${zwaarste.tekst.replace(/[.\s]*$/, '')}. Antwoorden lezen en overnemen; `
          + 'bellen als het niet tot de volgende afspraak kan wachten.',
        modules, suggesties: [],
      });
    }

    // 3. Thuisgemeten bloeddruk: niet één waarde maar het gemiddelde van de reeks.
    const thuis = dossier.observaties.filter((o) => o.herkomst.bron === 'patient'
      && o.code.coding?.[0]?.code === CODE.rrSys);
    if (thuis.length >= 5) {
      const waarden = thuis.map((o) => numeriekeWaarde(o)).filter((w): w is number => w !== undefined);
      const gemiddelde = Math.round(waarden.reduce((a, b) => a + b, 0) / waarden.length);
      const laatste = thuis.map((o) => o.effectief).sort().at(-1)!.slice(0, 10);
      if (gemiddelde >= 140) {
        regels.push({
          id: `opv-thuis-${patientId}`,
          patientId, naam, leeftijd: jaren,
          bron: 'thuismeting',
          binnenOp: laatste,
          titel: `Thuisbloeddruk gemiddeld ${gemiddelde} mmHg over ${waarden.length} metingen`,
          bevinding: 'De thuisreeks ligt boven de streefwaarde van 135 mmHg. Bij thuismeting '
            + 'telt het gemiddelde, niet de hoogste waarde.',
          ernst: gemiddelde >= 160 ? 'urgent' : 'aandacht',
          voorstel: 'Medicatie aanpassen of een kort belcontact plannen; hiervoor is geen '
            + 'spreekkamerbezoek nodig.',
          modules, suggesties: [],
        });
      }
    }
  }

  /*
   * Signalen uit het beloop: niets is binnengekomen, maar de waarden in het dossier
   * wijken af of lopen de verkeerde kant op. Dit was 'monitoren'.
   *
   * Alleen bij wie hierboven nog geen regel kreeg. Anders staat dezelfde eGFR er twee
   * keer: één keer als binnengekomen uitslag en één keer als afwijkende waarde — en dat
   * is precies de dubbeling die dit blok moest opheffen.
   */
  const metAanleiding = new Set(regels.map((r) => r.patientId));
  for (const dossier of repo.alleDossiers()) {
    const patientId = dossier.patient.id;
    if (vandaagOpSpreekuur.has(patientId) || metAanleiding.has(patientId)) continue;
    if (repo.bekendeModules(patientId).length === 0) continue;

    const sig = signalen(dossier, peildatum).filter((x) => x.ernst !== 'informatief');
    if (sig.length === 0) continue;
    const zwaarste = sig[0];
    const plan = planVoor(repo, dossier);
    if (plan.modules.length === 0) continue;
    const suggesties = suggestiesVoor(repo, dossier, plan)
      .filter((x) => x.klasse === 'klinisch').slice(0, 3);

    regels.push({
      id: `opv-sig-${patientId}`,
      patientId,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      bron: 'signaal',
      // Een signaal 'komt' niet binnen; het staat er al. De laatste meting waar het op
      // berust is het eerlijkste moment om erbij te zetten.
      binnenOp: laatsteMeetdatum(dossier) ?? vandaag,
      titel: zwaarste.tekst,
      bevinding: SIGNAALTOELICHTING[zwaarste.soort],
      ernst: zwaarste.ernst,
      voorstel: suggesties[0]?.titel
        ?? 'Beoordelen en besluiten of dit tot de volgende controle kan wachten.',
      modules: plan.modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
      zelfredzaamheid: plan.zelfredzaamheid && plan.zelfredzaamheid.gemiddelde > 0
        ? {
            gemiddelde: plan.zelfredzaamheid.gemiddelde,
            niveau: plan.zelfredzaamheid.niveau,
            richting: plan.zelfredzaamheid.trend?.richting,
          }
        : undefined,
      suggesties,
    });
  }

  /*
   * Hoogstens vijf per aanleiding. Zonder die grens vult de aanleiding met de meeste
   * rijen het hele blok — vandaag de signalen, morgen het lab — en verdwijnt juist de
   * ene thuismeting die om een besluit vroeg onder aan de lijst.
   */
  const openTaken = repo.werktaken().filter((t) => t.status !== 'afgerond');
  const metTaak = regels.map((regel): Opvolgregel => {
    const taak = openTaken.find(
      (t) => t.bron.soort === 'opvolgen' && t.bron.verwijzing === regel.id,
    );
    return taak ? { ...regel, taak: taakstand(taak, vandaag) } : regel;
  });

  const perBron = new Map<Opvolgbron, number>();
  return metTaak
    // Wat is opgepakt zakt naar beneden: het staat er nog, maar het vraagt niets meer.
    .sort((a, b) => Number(Boolean(a.taak)) - Number(Boolean(b.taak))
      || ERNSTGEWICHT[a.ernst] - ERNSTGEWICHT[b.ernst]
      || b.binnenOp.localeCompare(a.binnenOp))
    .filter((regel) => {
      const aantal = (perBron.get(regel.bron) ?? 0) + 1;
      perBron.set(regel.bron, aantal);
      return aantal <= 5;
    })
    .slice(0, 18);
}

/**
 * Wanneer een uitslag om een besluit vraagt.
 *
 * Bewust ruimer dan de streefwaarde: niet elke waarde net buiten de norm hoeft vandaag
 * behandeld te worden. Wat hier staat is de grens waarboven wachten tot de volgende
 * controle niet meer uit te leggen is.
 */
const LABGRENS: Record<string, {
  buiten: (waarde: number) => boolean;
  ernst: 'informatief' | 'aandacht' | 'urgent';
  bevinding: string;
  voorstel: string;
}> = {
  [CODE.hba1c]: {
    buiten: (w) => w >= 64,
    ernst: 'aandacht',
    bevinding: 'HbA1c boven 64 mmol/mol. De glucoseregulatie is onvoldoende.',
    voorstel: 'Medicatie intensiveren of het consult naar voren halen.',
  },
  [CODE.egfr]: {
    buiten: (w) => w < 45,
    ernst: 'urgent',
    bevinding: 'eGFR onder 45 ml/min. Dit raakt de dosering van meerdere middelen.',
    voorstel: 'Overleggen met de huisarts en de medicatie op nierfunctie nalopen.',
  },
  [CODE.ldl]: {
    buiten: (w) => w >= 3.5,
    ernst: 'aandacht',
    bevinding: 'LDL boven 3,5 mmol/l bij een verhoogd vaatrisico.',
    voorstel: 'Statine starten of ophogen; overleggen met de huisarts.',
  },
  [CODE.acr]: {
    buiten: (w) => w >= 3,
    ernst: 'aandacht',
    bevinding: 'Albumine-creatinineratio verhoogd — aanwijzing voor nierschade.',
    voorstel: 'Herhalen en de bloeddrukbehandeling opnieuw wegen.',
  },
};

/** Alle vragenlijsten van één patiënt, nieuwste eerst. */
export function vragenlijstenVoor(
  repo: DossierRepository, patientId: string,
): Vragenlijstinzage[] {
  const peildatum = repo.peildatum();
  return repo.afnames(patientId)
    .map((afname) => bouwInzage(afname, peildatum))
    .filter((x): x is Vragenlijstinzage => x !== undefined)
    .sort((a, b) => (b.ingevuldOp ?? b.uitgezetOp).localeCompare(a.ingevuldOp ?? a.uitgezetOp));
}

/**
 * Overnemen: van 'wat de patiënt zei' naar 'wat er in het dossier staat'.
 *
 * De antwoorden waren al zichtbaar — daar was geen handeling voor nodig. Wat hier
 * gebeurt is het aanvaarden ervan: vanaf nu staat de praktijk ervoor in, en dus staat
 * eronder wie dat heeft gedaan en wanneer. Dat is geen administratieve formaliteit maar
 * de grens tussen een patiëntmelding en een klinische registratie (ADR-0012).
 */
export function neemVragenlijstOver(
  repo: DossierRepository, afnameId: string, door: string,
): Vragenlijstinzage | undefined {
  repo.neemAfnameOver(afnameId, door);
  const afname = repo.afnames().find((a) => a.id === afnameId);
  return afname ? bouwInzage(afname, repo.peildatum()) : undefined;
}

// ── 4b. Werktaken ───────────────────────────────────────────────────────────

/**
 * WAT ER GEBEURT NA EEN KNOP
 *
 * 'Bellen en herinneren' was een knop die een merkje veranderde. Bij de volgende keer
 * inloggen stond dezelfde regel er weer, en niemand was gebeld. Dat is precies het soort
 * scherm dat bestaande systemen ook hebben: je ziet het probleem, maar er komt geen werk
 * uit voort.
 *
 * De tussenstap die ontbrak is de vraag *wie doet het?* — en die is niet vanzelfsprekend.
 * Bellen dat de uitslag ontbreekt kan de assistent prima; diezelfde uitslag bespreken
 * niet. Daarom gaat elke actie door hetzelfde paneel als een order: kies wat het is, kies
 * bij wie het terechtkomt, geef de aanleiding mee, en volg hem tot hij af is (ADR-0009).
 */

/** Hoe een rol in een zin heet. Niet 'poh-s' maar 'de praktijkondersteuner'. */
const ROL_LABEL: Record<string, string> = {
  huisarts: 'De huisarts',
  'poh-s': 'De praktijkondersteuner',
  'poh-ggz': 'De POH-GGZ',
  assistent: 'De assistent',
};

export interface Taakregel extends Werktaak {
  soortLabel: string;
  icoon: string;
  /** Hoe dringend, afgeleid van de uiterlijke datum — niet apart in te stellen. */
  dringend: boolean;
  /** Leesbare stand voor in de lijst. */
  standLabel: string;
}

export interface Taakkeuze extends Taaksoortdefinitie {
  /** Bij wie dit soort werk terecht kan komen, met de uitleg erbij. */
  ontvangers: { id?: string; naam: string; rol: Rol; uitleg: string }[];
}

export interface Takenoverzicht {
  /** Wat bij mij terechtkomt. */
  mijn: Taakregel[];
  /** Wat ik heb uitgezet bij een ander, zodat je kunt zien of het is opgepakt. */
  uitgezet: Taakregel[];
  open: number;
  gepland: number;
  /** De soorten werk, elk met de mogelijke ontvangers — het paneel heeft allebei nodig. */
  soorten: Taakkeuze[];
  werkblokken: typeof WERKBLOKKEN;
}

function verrijkTaak(taak: Werktaak, vandaag: string): Taakregel {
  const soort = vindTaaksoort(taak.soort);
  return {
    ...taak,
    soortLabel: soort.label,
    icoon: soort.icoon,
    dringend: taak.status !== 'afgerond' && Boolean(taak.uiterlijkOp && taak.uiterlijkOp <= vandaag),
    standLabel: taak.status === 'afgerond'
      ? `afgerond door ${taak.afgerondDoor}`
      : taak.status === 'gepland'
        ? `ingepland ${taak.geplandOp?.slice(11, 16) ?? ''}`
        : 'nog in te plannen',
  };
}

export function takenoverzicht(repo: DossierRepository, gebruikerId: string): Takenoverzicht {
  const gebruiker = vindGebruiker(gebruikerId);
  const vandaag = repo.peildatum().toISOString().slice(0, 10);
  const alle = repo.werktaken();

  const mijn = gebruiker
    ? takenVoor(alle, { id: gebruiker.id, rol: gebruiker.rol as Rol })
        .map((t) => verrijkTaak(t, vandaag))
    : [];
  const uitgezet = alle
    .filter((t) => t.aangemaaktDoor === gebruiker?.naam
      && !mijn.some((m) => m.id === t.id))
    .map((t) => verrijkTaak(t, vandaag));

  return {
    mijn,
    uitgezet,
    open: mijn.filter((t) => t.status === 'open').length,
    gepland: mijn.filter((t) => t.status === 'gepland').length,
    soorten: TAAKSOORTEN.map((s) => ({ ...s, ontvangers: taakontvangers(s.id) })),
    werkblokken: WERKBLOKKEN,
  };
}

/**
 * Wie kan dit oppakken?
 *
 * De lijst hangt aan de soort werk en niet aan een rechtenmatrix: een uitslag bespreken
 * hoort bij wie hem kan duiden, en dat is geen kwestie van autorisatie maar van vak.
 * 'De assistent' (zonder naam) en 'Ilse' zijn allebei geldig en betekenen iets anders.
 */
export function taakontvangers(soort: Taaksoort): {
  id?: string; naam: string; rol: Rol; uitleg: string;
}[] {
  const definitie = vindTaaksoort(soort);
  const ontvangers: { id?: string; naam: string; rol: Rol; uitleg: string }[] = [];
  for (const rol of definitie.rollen) {
    const persoon = gebruikers.find((g) => g.actief && (g.rol as Rol) === rol);
    ontvangers.push({
      rol,
      naam: ROL_LABEL[rol] ?? rol,
      uitleg: `Komt op de werklijst van wie er die dag is.`,
    });
    if (persoon) {
      ontvangers.push({
        id: persoon.id, rol, naam: persoon.naam,
        uitleg: 'Persoonlijk, dus niet door een collega op te pakken.',
      });
    }
  }
  return ontvangers;
}

export function zetTaakUit(
  repo: DossierRepository, nieuw: Omit<NieuweTaak, 'voorNaam'> & { voorNaam?: string },
  doorId: string,
): { taak?: Werktaak; melding: string } {
  const gebruiker = vindGebruiker(doorId);
  if (!gebruiker) return { melding: 'Onbekende gebruiker.' };
  if (nieuw.aanleiding.trim().length < 3) {
    return {
      melding: 'Een taak zonder aanleiding is een opdracht zonder context. Vul in waarom '
        + 'dit nodig is — degene die hem oppakt heeft dat nodig.',
    };
  }

  const ontvangerNaam = nieuw.voorNaam
    ?? (nieuw.voorGebruikerId
      ? vindGebruiker(nieuw.voorGebruikerId)?.naam ?? ROL_LABEL[nieuw.voorRol]
      : ROL_LABEL[nieuw.voorRol] ?? nieuw.voorRol);

  const taak = repo.maakTaak({ ...nieuw, voorNaam: ontvangerNaam }, gebruiker.naam);
  const bijZichzelf = taak.voorGebruikerId === gebruiker.id
    || (!taak.voorGebruikerId && taak.voorRol === gebruiker.rol);

  return {
    taak,
    melding: bijZichzelf
      ? 'Staat op je eigen werklijst. Plan hem in bij Plannen, of handel hem daar af.'
      : `Uitgezet bij ${ontvangerNaam}. Je ziet bij Plannen of hij is opgepakt.`,
  };
}

export function planTaak(repo: DossierRepository, id: string, start: string) {
  return repo.planTaak(id, start);
}

export function rondTaakAf(
  repo: DossierRepository, id: string, doorId: string, uitkomst: string,
) {
  const gebruiker = vindGebruiker(doorId);
  return repo.rondTaakAf(id, gebruiker?.naam ?? doorId, uitkomst);
}

/**
 * Eigen werk in de agenda zetten, zonder patiënt.
 *
 * Een agenda die alleen patiënten kent, liegt: uitslagen nalopen, terugbellen en
 * administratie kosten evenveel tijd als een consult maar zijn onzichtbaar. Het gevolg is
 * bekend — de dag zit vol en er is niets gepland voor wat er ook nog moet.
 */
export const WERKBLOKKEN: { id: string; titel: string; duurMinuten: number; reden: string }[] = [
  { id: 'bellen', titel: 'Patiënten terugbellen', duurMinuten: 20,
    reden: 'Belafspraken en openstaande terugbelverzoeken' },
  { id: 'voorbereiding', titel: 'Voorbereiding spreekuur', duurMinuten: 30,
    reden: 'Uitslagen, vragenlijsten en intakes nalopen' },
  { id: 'uitslagen', titel: 'Uitslagen nalopen', duurMinuten: 20,
    reden: 'Binnengekomen lab beoordelen en opvolgen' },
  { id: 'administratie', titel: 'Administratie', duurMinuten: 20,
    reden: 'Uitwerken, verantwoorden en registraties afronden' },
  { id: 'overleg', titel: 'Overleg', duurMinuten: 15,
    reden: 'Kort overleg met een collega' },
  { id: 'pauze', titel: 'Pauze', duurMinuten: 15,
    reden: 'Geblokkeerd, niet inplanbaar' },
];

export function planWerkblok(
  repo: DossierRepository,
  gegevens: { blokId: string; rol: string; start: string; duurMinuten?: number },
) {
  const blok = WERKBLOKKEN.find((b) => b.id === gegevens.blokId);
  if (!blok) return undefined;
  return repo.planWerkblok({
    rol: gegevens.rol as Rol,
    start: gegevens.start,
    duurMinuten: gegevens.duurMinuten ?? blok.duurMinuten,
    titel: blok.titel,
    reden: blok.reden,
  });
}

// ── 4c. Het taakdossier ─────────────────────────────────────────────────────

/**
 * WAT JE MOET WETEN VOORDAT JE BELT
 *
 * Een taak inplannen is niet hetzelfde als weten wat je gaat zeggen. Het blok staat om
 * 11:20 in de agenda, je klikt erop — en dan begint het werk pas: uitzoeken wat er bij
 * deze mens eigenlijk nog ontbreekt. Dat staat allemaal ergens (in de aanloop, in het
 * zorgplan, in de signalen), alleen niet op de plek waar je op dat moment bent. Het
 * gevolg is dat iemand met een telefoon in de hand door vier schermen loopt te klikken.
 *
 * Het taakdossier zet het bij elkaar: waarom deze taak bestaat, wat er nog niet binnen
 * is, wanneer de afspraak staat, hoe je deze mens bereikt en wat je dus wilt zeggen.
 * Een blok in de agenda is daarmee geen herinnering meer maar een voorbereid gesprek.
 */
export interface Ontbrekendonderdeel {
  naam: string;
  /**
   * Hoe dit onderdeel heet midden in een zin.
   *
   * 'Jaarlijkse screening — controle' is een correcte titel en een onmogelijke zin: wie
   * hem in een advies zet, krijgt 'vraag of Jaarlijkse screening — controle nog geregeld
   * wordt'. In het gespreksdoel heet hij daarom gewoon 'de vragenlijst'; de volledige
   * naam staat erboven in de lijst.
   */
  kort?: string;
  /** Binnen, nog open, of niet meer op tijd te krijgen. */
  stand: 'binnen' | 'open' | 'te-laat';
  toelichting: string;
}

export interface Taakdossier {
  taak: Taakregel;
  patientId?: string;
  naam: string;
  leeftijd?: number;
  modules: { id: string; naam: string; icoon: string }[];
  bereikbaarheid?: Bereikbaarheid;
  /** De afspraak waar deze taak omheen hangt, als die er is. */
  afspraak?: {
    afspraakId: string; datum: string; tijd: string; dagenTot: number;
    status: Aanloopstatus; statusLabel: string; advies: string; toelichting: string;
  };
  /** Wat er bij deze patiënt nog niet rond is — de reden dat je belt. */
  ontbreekt: Ontbrekendonderdeel[];
  signalen: Signaal[];
  /** Wat je in dit gesprek wilt bereiken. Geen keuzemenu, een paar zinnen. */
  gespreksdoel: string[];
  /** Het laatste contact, zodat je weet wat er al gezegd is. */
  laatsteContact?: { datum: string; soort: string; wie: string };
  /** Lopende episodes — het contact dat hieruit komt moet ergens aan hangen. */
  episodes: { id: string; titel: string }[];
}

/** Opsomming met komma's en één 'en' aan het eind. */
function opsomming(namen: string[]): string {
  return namen.length <= 1 ? namen.join('') : `${namen.slice(0, -1).join(', ')} en ${namen.at(-1)}`;
}

export function taakdossier(repo: DossierRepository, taakId: string): Taakdossier | undefined {
  const peildatum = repo.peildatum();
  const vandaag = peildatum.toISOString().slice(0, 10);
  const ruw = repo.werktaken().find((t) => t.id === taakId);
  if (!ruw) return undefined;

  const taak = verrijkTaak(ruw, vandaag);
  const leeg: Taakdossier = {
    taak, naam: ruw.patientNaam ?? ruw.titel, modules: [], ontbreekt: [], signalen: [],
    gespreksdoel: [ruw.aanleiding], episodes: [],
  };

  const dossier = ruw.patientId ? repo.dossier(ruw.patientId) : undefined;
  if (!dossier) return leeg;

  const plan = planVoor(repo, dossier);
  const regel = aanloop(repo).find((r) => r.patientId === dossier.patient.id);

  /*
   * De onderdelen komen uit de aanloop als die er is, en anders rechtstreeks uit het
   * zorgplan. Dat tweede geval is geen randgeval: een taak die uit Opvolgen komt, hangt
   * niet aan een afspraak, en dan is de vraag 'wat ontbreekt er' net zo relevant.
   */
  const ontbreekt: Ontbrekendonderdeel[] = [];
  if (regel) {
    for (const item of regel.vooraf) {
      ontbreekt.push({
        naam: item.naam,
        stand: item.binnen ? 'binnen' : item.haalbaar ? 'open' : 'te-laat',
        toelichting: item.binnen
          ? `Binnen op ${item.op}`
          : item.haalbaar
            ? `Nog niet binnen · kost ${item.doorlooptijdDagen} dagen, er zijn er nog ${regel.dagenTot}`
            : `Kost ${item.doorlooptijdDagen} dagen, er zijn er nog ${regel.dagenTot} — dat wordt niets meer`,
      });
    }
    if (regel.vragenlijst) {
      ontbreekt.push({
        naam: regel.vragenlijst.naam,
        kort: 'de vragenlijst',
        stand: regel.vragenlijst.status === 'ingevuld' ? 'binnen' : 'open',
        toelichting: regel.vragenlijst.status === 'ingevuld'
          ? 'Ingevuld en klaar om over te nemen in het consult'
          : `Staat ${regel.vragenlijst.openDagen ?? 0} dagen open in het portaal · kan tot de avond ervoor`,
      });
    }
  } else {
    for (const meting of plan.contacten[0]?.metingen ?? []) {
      if (!meting.labVooraf) continue;
      ontbreekt.push({
        naam: meting.naam,
        stand: meting.laatsteOp ? 'binnen' : 'open',
        toelichting: meting.laatsteOp
          ? `Laatste waarde ${meting.laatsteOp}`
          : 'Nog geen uitslag in het dossier',
      });
    }
    for (const afname of repo.afnames(dossier.patient.id)) {
      const inzage = bouwInzage(afname, peildatum);
      if (!inzage) continue;
      ontbreekt.push({
        naam: inzage.naam,
        kort: 'de vragenlijst',
        stand: inzage.status === 'ingevuld' ? 'binnen' : 'open',
        toelichting: inzage.status === 'ingevuld'
          ? 'Ingevuld en klaar om over te nemen'
          : `Staat ${inzage.openDagen ?? 0} dagen open in het portaal`,
      });
    }
  }

  const open = ontbreekt.filter((o) => o.stand === 'open');
  const teLaat = ontbreekt.filter((o) => o.stand === 'te-laat');
  const sig = signalen(dossier, peildatum);

  /*
   * Het gespreksdoel is het verschil tussen een lijstje en een voorbereiding. Het zegt
   * niet wat er ontbreekt — dat staat erboven — maar wat je er in dit telefoontje mee
   * gaat doen. Eén zin per ding dat aan de orde komt, in de volgorde waarin je het zegt.
   */
  const gespreksdoel: string[] = [];
  if (teLaat.length > 0 && regel) {
    gespreksdoel.push(
      `Leg uit dat ${opsomming(teLaat.map((o) => o.kort ?? o.naam))} niet meer op tijd binnen `
      + `${teLaat.length === 1 ? 'is' : 'zijn'} voor ${regel.datum}, en stel voor de afspraak `
      + 'een week te verzetten.',
    );
  }
  if (open.length > 0) {
    gespreksdoel.push(
      regel
        ? `Vraag of ${opsomming(open.map((o) => o.kort ?? o.naam))} deze week nog geregeld `
          + `wordt — er ${regel.dagenTot === 1 ? 'is' : 'zijn'} nog ${regel.dagenTot} dagen.`
        : `Vraag naar ${opsomming(open.map((o) => o.kort ?? o.naam))}.`,
    );
  }
  const zwaarste = sig.find((s) => s.ernst === 'urgent') ?? sig[0];
  if (zwaarste) gespreksdoel.push(`Noem wat opvalt: ${zwaarste.tekst.toLowerCase()}`);
  if (gespreksdoel.length === 0) gespreksdoel.push(ruw.aanleiding);
  gespreksdoel.push('Leg het gesprek daarna vast als contact, met een notitie in het journaal.');

  const contacten = [...dossier.contacten]
    .sort((a, b) => b.herkomst.vastgelegdOp.localeCompare(a.herkomst.vastgelegdOp));

  return {
    taak,
    patientId: dossier.patient.id,
    naam: volledigeNaam(dossier),
    leeftijd: leeftijd(dossier, peildatum),
    modules: plan.modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
    bereikbaarheid: bereikbaarheid(dossier),
    afspraak: regel
      ? {
          afspraakId: regel.afspraakId, datum: regel.datum, tijd: regel.tijd,
          dagenTot: regel.dagenTot, status: regel.status,
          statusLabel: AANLOOPSTATUS_LABEL[regel.status],
          advies: regel.advies, toelichting: regel.toelichting,
        }
      : undefined,
    ontbreekt,
    signalen: sig,
    gespreksdoel,
    laatsteContact: contacten[0]
      ? {
          datum: contacten[0].herkomst.vastgelegdOp.slice(0, 10),
          soort: contacten[0].soort,
          wie: contacten[0].uitvoerder.naam,
        }
      : undefined,
    episodes: dossier.episodes
      .filter((e) => e.status === 'active')
      .map((e) => ({ id: e.id, titel: e.titel })),
  };
}

// ── 5. Monitoring ───────────────────────────────────────────────────────────

export interface MonitoringRegel {
  patientId: string;
  naam: string;
  leeftijd: number;
  modules: { id: string; naam: string; icoon: string }[];
  signalen: Signaal[];
  suggesties: Suggestie[];
  zelfredzaamheid?: { gemiddelde: number; niveau: string; richting?: string };
  /**
   * De laatst ingevulde vragenlijst.
   *
   * Monitoren op afstand betekent nu kijken naar meetwaarden, en meetwaarden zeggen niet
   * of iemand het volhoudt. Wie in de vragenlijst aangeeft dat hij zijn medicijnen niet
   * meer ophaalt, verdient eerder aandacht dan wie een HbA1c van 59 heeft. Daarom staat
   * hij ook hier, niet alleen bij de mensen die toevallig een afspraak hebben.
   */
  vragenlijst?: Vragenlijstinzage;
}

export function monitoringCohort(repo: DossierRepository): MonitoringRegel[] {
  const peildatum = repo.peildatum();
  const regels = repo.alleDossiers().flatMap((dossier): MonitoringRegel[] => {
    const bekend = repo.bekendeModules(dossier.patient.id);
    if (bekend.length === 0) return [];
    const plan = planVoor(repo, dossier);
    const sig = signalen(dossier, peildatum);
    if (plan.modules.length === 0) return [];
    const afname = repo.afnames(dossier.patient.id)
      .filter((a) => a.ingevuldOp)
      .sort((a, b) => (a.ingevuldOp ?? '').localeCompare(b.ingevuldOp ?? ''))
      .at(-1);
    return [{
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      modules: plan.modules.map((m) => ({ id: m.id, naam: m.naam, icoon: m.icoon })),
      signalen: sig,
      vragenlijst: afname ? bouwInzage(afname, peildatum) : undefined,
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

// ── 6. Instroom ─────────────────────────────────────────────────────────────

export function instroom(repo: DossierRepository) {
  return instroomOverzicht(
    repo.alleDossiers(),
    (id) => repo.bekendeModules(id),
    (id) => repo.persoonlijkPlan(id),
    repo.peildatum(),
  );
}

// ── 7. Dagafsluiting ────────────────────────────────────────────────────────

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

// ── 5b. Bereikbaarheid ──────────────────────────────────────────────────────

/**
 * HOE JE DEZE MENS BEREIKT
 *
 * Zodra het systeem 'bel deze patiënt' als taak kan uitzetten, moet het ook kunnen
 * beantwoorden hoe. Dat stond nergens: het dossier kende wel een telefoonnummer, maar
 * geen enkel scherm liet het zien — en dus zocht je het in een ander systeem op, of je
 * belde de assistent om het te vragen.
 *
 * Wat hier staat is bewust meer dan een nummer. Welk kanaal iemand zelf het liefst heeft,
 * wat de praktijk over zijn bereikbaarheid heeft geleerd, en wie er gebeld mag worden als
 * hij het zelf niet redt — met daarbij wat die naaste mag horen. Dat laatste is geen
 * detail: informeren is iets anders dan meebeslissen, en die grens hoort vastgelegd te
 * zijn vóórdat iemand hem nodig heeft.
 */

export interface Bereikbaarheidskanaal {
  soort: 'mobiel' | 'vast' | 'email' | 'portaal';
  label: string;
  waarde: string;
  /** Het kanaal dat deze patiënt zelf heeft aangegeven. */
  voorkeur: boolean;
  /** Kun je hierop bellen, of is het alleen schrijven? */
  belbaar: boolean;
}

export interface Bereikbaarheid {
  kanalen: Bereikbaarheidskanaal[];
  adres?: string;
  /** Wat de praktijk over de bereikbaarheid weet. */
  toelichting?: string;
  contactpersoon?: {
    naam: string; relatie: string; telefoon: string;
    mag: string; magUitleg: string;
  };
  portaalActief: boolean;
  /** Eén zin: waarmee zou je beginnen? */
  advies: string;
}

const MAG_UITLEG: Record<string, string> = {
  informeren: 'Mag geïnformeerd worden, niet meebeslissen.',
  meebeslissen: 'Mag meebeslissen over de zorg.',
  'alleen-in-noodgeval': 'Alleen bellen als het niet anders kan.',
};

export function bereikbaarheid(dossier: Dossier): Bereikbaarheid {
  const p = dossier.patient;
  const voorkeur = p.communicatievoorkeur;
  const kanalen: Bereikbaarheidskanaal[] = [];

  if (p.contact?.mobiel) {
    kanalen.push({
      soort: 'mobiel', label: 'Mobiel', waarde: p.contact.mobiel,
      voorkeur: voorkeur === 'telefoon' || voorkeur === 'sms', belbaar: true,
    });
  }
  if (p.contact?.vast) {
    kanalen.push({
      soort: 'vast', label: 'Vast', waarde: p.contact.vast,
      voorkeur: false, belbaar: true,
    });
  }
  if (p.contact?.email) {
    kanalen.push({
      soort: 'email', label: 'E-mail', waarde: p.contact.email,
      voorkeur: voorkeur === 'email', belbaar: false,
    });
  }
  if (p.portaalActief) {
    kanalen.push({
      soort: 'portaal', label: 'Patiëntportaal', waarde: 'Bericht via het portaal',
      voorkeur: voorkeur === 'portaal', belbaar: false,
    });
  }

  const adres = p.adres
    ? `${p.adres.straat ?? ''} ${p.adres.huisnummer ?? ''}, ${p.adres.postcode ?? ''} ${p.adres.woonplaats ?? ''}`
      .replace(/\s+/g, ' ').trim()
    : undefined;

  /*
   * Het advies leest het dossier en verzint niets. Wie heeft aangegeven het portaal te
   * willen, bel je niet als eerste — en wie een notitie heeft dat zijn mobiel overdag
   * uitstaat, bel je niet op zijn mobiel.
   */
  const voorkeurskanaal = kanalen.find((k) => k.voorkeur);
  const advies = p.contact?.toelichting
    ? p.contact.toelichting
    : voorkeurskanaal
      ? `Voorkeur van de patiënt: ${voorkeurskanaal.label.toLowerCase()}.`
      : kanalen.some((k) => k.belbaar)
        ? 'Geen voorkeur vastgelegd; begin bij het mobiele nummer.'
        : 'Geen telefoonnummer bekend. Vraag het na bij de assistent.';

  return {
    kanalen,
    adres,
    toelichting: p.contact?.toelichting,
    contactpersoon: p.contactpersoon
      ? {
          ...p.contactpersoon,
          magUitleg: MAG_UITLEG[p.contactpersoon.mag] ?? p.contactpersoon.mag,
        }
      : undefined,
    portaalActief: Boolean(p.portaalActief),
    advies,
  };
}

/** Bereikbaarheid los opvragen, voor een werklijst waar geen heel dossier bij hoeft. */
export function bereikbaarheidVoor(
  repo: DossierRepository, patientId: string,
): (Bereikbaarheid & { naam: string }) | undefined {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  return { ...bereikbaarheid(dossier), naam: volledigeNaam(dossier) };
}

// ── 6. Patiëntoverzicht ─────────────────────────────────────────────────────

export function patientOverzicht(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const peildatum = repo.peildatum();
  const persoonlijk = repo.persoonlijkPlan(patientId);
  const plan = planVoor(repo, dossier);
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
      bereikbaarheid: bereikbaarheid(dossier),
    },
    episodes: dossier.episodes.map((e) => ({
      id: e.id, titel: e.titel, status: e.status,
      icpc: e.code.coding?.find((c) => c.system.includes('icpc'))?.code,
      start: e.periode.start,
    })),
    // Alleen wat de patiënt nu gebruikt. Gestopte middelen horen in het
    // medicatiepaneel, waar de geschiedenis bij de wijziging staat — niet in de kaart
    // waar je op een spreekuur naar kijkt.
    medicatie: dossier.medicatie.filter((m) => m.status === 'active').map((m) => ({
      id: m.id,
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
  /**
   * In welke vorm dit contact plaatsvond.
   *
   * Bekend op het moment van het contact, dus hier gevraagd en niet achteraf afgeleid.
   * Bepaalt de prestatie én de identificatiesterkte (docs/19).
   */
  contactvorm?: Contactvorm;
  duurMinuten?: number;
}

export interface RegistratieUitkomst {
  vastgelegd: { code: string; naam: string; waarde: number | string }[];
  /** Ketenindicatoren die door deze registratie alsnog op orde zijn. */
  verantwoordingGevuld: { keten: string; indicator: string }[];
  /** Wat het systeem hierna zelf doet. */
  vervolg: string[];
  /** Wat dit contact administratief oplevert, en wat er eventueel nog ontbreekt. */
  declaratie?: ReturnType<typeof beoordeelDeclaratie>;
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
  // Op de demoklok, niet op de serverklok — zie demoNu().
  const nu = demoNu(peildatum);

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

  // Het contact-id staat vóór de metingen vast: elke meting die hier wordt vastgelegd
  // verwijst ernaar, zodat het journaal later kan laten zien wát er op dat moment is
  // gemeten in plaats van alleen dát er een contact was.
  const encounterId = `${patientId}-enc-${Date.now()}`;

  const observaties = registratie.metingen.map((m, i) => ({
    resourceType: 'Observation' as const,
    id: `${patientId}-reg-${Date.now()}-${i}`,
    patientId,
    encounterId,
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

  // De contactvorm bepaalt wat dit administratief is. Hij wordt gevraagd op het moment
  // van registreren en niet achteraf afgeleid: wie de vorm later moet reconstrueren, gokt.
  const vorm: Contactvorm = registratie.contactvorm ?? 'consult';
  const declaratie = beoordeelDeclaratie({
    vorm,
    duurMinuten: registratie.duurMinuten,
    heeftSoep: soepRegels.length > 0,
    heeftEpisode: Boolean(registratie.episodeId),
  });

  const contact = {
    resourceType: 'Encounter' as const,
    id: encounterId,
    patientId,
    soort: naarContactSoort(declaratie.vorm),
    status: 'finished' as const,
    periode: { start: nu, einde: nu },
    uitvoerder: {
      id: herkomst.auteurId,
      naam: gebruiker?.naam ?? 'Sanne Bakker',
      rol: auteurRol,
    },
    duurMinuten: registratie.duurMinuten,
    declaratie: declaratie.prestatie
      ? {
          code: declaratie.prestatie.code,
          omschrijving: declaratie.prestatie.omschrijving,
          declarabel: declaratie.declarabel,
          ontbreekt: declaratie.ontbreekt,
        }
      : undefined,
    herkomst,
  };

  const deelcontact = soepRegels.length > 0 && registratie.episodeId
    ? {
        resourceType: 'Deelcontact' as const,
        id: `${patientId}-dc-${Date.now()}`,
        patientId,
        encounterId,
        episodeId: registratie.episodeId,
        regels: soepRegels,
        afgerond: true,
        herkomst,
      }
    : undefined;

  // Het contact zelf gaat altijd het dossier in, ook als er geen SOEP-tekst is getypt.
  // Er ís iets gebeurd: iemand heeft deze mens gezien of gesproken en metingen vastgelegd.
  // Dat alleen bewaren als er tekst bij staat, betekent dat een deel van de zorg uit het
  // journaal verdwijnt — en precies dat maakt een dossier onbetrouwbaar.
  repo.dossier(patientId)?.contacten.push(contact);
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
    declaratie,
  };
}


/**
 * EEN GESPREK VASTLEGGEN ALS CONTACT
 *
 * 'Gesprek vastleggen als contact' was een knop die het venster sloot. Daarna stond er
 * niets in het journaal — wat erger is dan geen knop, want nu denkt iemand dat het is
 * vastgelegd. En precies bij een telefoontje is dat kwalijk: het is vaak het enige spoor
 * dat er contact is geweest, en zonder dat spoor belt de volgende collega opnieuw.
 *
 * Een telefonisch consult is hier daarom hetzelfde soort ding als een consult op de
 * praktijk: een Encounter met een uitvoerder, een duur, een prestatie en — als er iets
 * gezegd is dat ertoe doet — een deelcontact met SOEP aan een episode. De notitie is
 * geen extraatje maar het verschil tussen een belpoging en een contact, en de
 * declaratieregel zegt het ook: telefonisch is alleen een prestatie als het inhoudelijk
 * is vastgelegd.
 */
export interface Gespreksvastlegging {
  /** Wat er is gezegd. Landt als S-regel in het deelcontact. */
  notitie?: string;
  /** Wat er is afgesproken. Landt als P-regel. */
  afspraak?: string;
  contactvorm?: Contactvorm;
  duurMinuten?: number;
  episodeId?: string;
  /** Welk nummer of kanaal is gebruikt. Komt in de bevestiging, niet in het dossier. */
  kanaal?: string;
  /** De taak die hiermee af is, als het gesprek uit een taak voortkwam. */
  taakId?: string;
  gebruikerId?: string;
}

export interface Gespreksuitkomst {
  melding: string;
  /** Wat dit administratief oplevert, en wat er eventueel nog ontbreekt. */
  declaratie?: ReturnType<typeof beoordeelDeclaratie>;
  /** De journaalregel die er zojuist bij is gekomen. */
  regel?: JournaalRegel;
  /** De taak die hiermee is afgerond, als die er was. */
  taak?: Taakregel;
}

export function legContactVast(
  repo: DossierRepository, patientId: string, gegevens: Gespreksvastlegging,
): Gespreksuitkomst | undefined {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;

  const vorm: Contactvorm = gegevens.contactvorm ?? 'telefonisch';
  const notitie = gegevens.notitie?.trim();
  const afspraak = gegevens.afspraak?.trim();

  /*
   * Zonder episode kan er geen deelcontact zijn, en dan zou de notitie nergens aan
   * hangen. In plaats van de gebruiker daarmee lastig te vallen kiezen we de lopende
   * episode — en als er meerdere zijn, die van het aandachtsgebied waar deze taak over
   * gaat. Handmatig kiezen kan altijd nog; dat is het veld `episodeId`.
   */
  const lopend = dossier.episodes.filter((e) => e.status === 'active');
  const episodeId = gegevens.episodeId ?? lopend[0]?.id;

  const uitkomst = registreerConsult(repo, patientId, {
    metingen: [],
    soep: { S: notitie, P: afspraak },
    episodeId,
    gebruikerId: gegevens.gebruikerId,
    contactvorm: vorm,
    duurMinuten: gegevens.duurMinuten ?? 10,
  });
  if (!uitkomst) return undefined;

  let taak: Taakregel | undefined;
  if (gegevens.taakId) {
    const vandaag = repo.peildatum().toISOString().slice(0, 10);
    const afgerond = rondTaakAf(
      repo, gegevens.taakId, gegevens.gebruikerId ?? 'zv-poh-1',
      notitie ? `Gebeld. ${notitie}` : 'Gebeld; gesprek vastgelegd als contact.',
    );
    if (afgerond) taak = verrijkTaak(afgerond, vandaag);
  }

  const vormnaam = vindContactvorm(vorm)?.naam ?? vorm;
  const waar = gegevens.kanaal ? ` via ${gegevens.kanaal}` : '';
  const melding = notitie
    ? `${vormnaam}${waar} vastgelegd in het journaal van ${volledigeNaam(dossier)}.`
    : `${vormnaam}${waar} vastgelegd. Zonder notitie staat er alleen dát er contact was — `
      + 'en telefonisch telt pas als prestatie als er inhoudelijk iets is vastgelegd.';

  return {
    melding,
    declaratie: uitkomst.declaratie,
    regel: journaal(repo.dossier(patientId)!)[0],
    taak,
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
  /**
   * De werktaak achter dit blok, als het er een is.
   *
   * Zonder dit veld is een ingepland blok een tekstje met een tijd erbij: je weet dat je
   * om 11:20 iemand moet bellen, maar niet waarover. Met het taak-id erbij is het blok
   * een ingang naar het taakdossier — wat er ontbreekt, hoe je deze mens bereikt en wat
   * je wilt zeggen.
   */
  taakId?: string;
}

/** De dag van één rol, als tijdlijn. Blokken en patiëntafspraken door elkaar. */
export function agenda(repo: DossierRepository, rol: Rol): AgendaRegel[] {
  const peildatum = repo.peildatum();
  const intakes = repo.intakes();
  const taakBij = new Map(
    repo.werktaken().filter((t) => t.agendaItemId).map((t) => [t.agendaItemId!, t.id]),
  );

  return repo.agenda(rol).map((item): AgendaRegel => {
    const dossier = item.patientId ? repo.dossier(item.patientId) : undefined;
    if (!dossier) {
      return {
        id: item.id, tijd: item.start.slice(11, 16), duurMinuten: item.duurMinuten,
        soort: item.soort, titel: item.titel, reden: item.reden, modules: [],
        status: item.status, statusLabel: STATUSLABEL[item.status],
        taakId: taakBij.get(item.id),
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
      taakId: taakBij.get(item.id),
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

// ── 13. Het protocol ────────────────────────────────────────────────────────

/**
 * HET PROTOCOL, INZIEN ÉN AANPASSEN
 *
 * Een protocolscherm dat alleen laat zien wat de richtlijn zegt, is een folder. De
 * praktijk wijkt er hoe dan ook van af — het prikpunt is traag, de optometrist doet de
 * fundus, bij deze populatie wordt vaker gecontroleerd — en zonder plek om dat vast te
 * leggen zit die kennis in hoofden en losse afspraken.
 *
 * Daarom staat per onderdeel de richtlijnwaarde náást de praktijkwaarde, met wie hem
 * veranderde, wanneer en waarom. Aanpassen kan, terugzetten ook, en allebei is zichtbaar.
 * Dat is niet strenger dan nodig: een regelset die het handelen beïnvloedt moet
 * herleidbaar zijn tot wie wat besloot (docs/07).
 */

export interface Protocolitem {
  code: string;
  naam: string;
  /** Wat de richtlijn zegt. Verandert nooit door een praktijkinstelling. */
  richtlijn: {
    intervalDagen: number;
    doorlooptijdDagen: number;
    labVooraf: boolean;
  };
  /** Wat deze praktijk hanteert. Gelijk aan de richtlijn tenzij er is afgeweken. */
  praktijk: {
    intervalDagen: number;
    doorlooptijdDagen: number;
    labVooraf: boolean;
    actief: boolean;
  };
  doorlooptijdReden: string;
  zelfAanleverbaar: boolean;
  vragenlijst?: string;
  intervalRegels: { factor: number; reden: string }[];
  /** De afwijking zelf, als die er is. */
  afwijking?: { reden: string; door: string; op: string };
}

export interface Protocolmodule {
  id: string;
  naam: string;
  omschrijving: string;
  icoon: string;
  rol: string;
  relevantie: string;
  richtlijnen: { naam: string; versie: string; url?: string }[];
  actief: boolean;
  afwijking?: { reden: string; door: string; op: string };
  items: Protocolitem[];
}

export interface Protocoloverzicht {
  toelichting: string;
  regelsetVersie: string;
  modules: Protocolmodule[];
  ketens: {
    id: string; naam: string; modules: string[];
    declaratie: { prestatiecode: string; omschrijving: string };
  }[];
  /** Hoeveel onderdelen van de richtlijn afwijken — het getal waar een manager naar kijkt. */
  aantalAfwijkingen: number;
  magAanpassen: boolean;
}

export function protocoloverzicht(
  repo: DossierRepository, gebruikerId?: string,
): Protocoloverzicht {
  const aanpassingen = repo.protocolaanpassingen();
  const vind = (moduleId: string, itemCode?: string) =>
    aanpassingen.find((a) => a.moduleId === moduleId && a.itemCode === itemCode);
  const gebruiker = gebruikerId ? vindGebruiker(gebruikerId) : undefined;

  return {
    toelichting:
      'Eén geïntegreerd protocol, opgebouwd uit aandachtsgebieden. Er is geen protocol per '
      + 'aandoening; landelijke ketens worden achteraf afgeleid.',
    regelsetVersie: REGELSET_VERSIE,
    aantalAfwijkingen: aanpassingen.length,
    magAanpassen: Boolean(gebruiker?.rechten.includes('protocol-aanpassen')),
    modules: modules.map((module): Protocolmodule => {
      const moduleAfwijking = vind(module.id);
      return {
        id: module.id,
        naam: module.naam,
        omschrijving: module.omschrijving,
        icoon: module.icoon,
        rol: module.rol,
        relevantie: module.relevantie.omschrijving,
        richtlijnen: module.richtlijnen,
        actief: moduleAfwijking?.actief !== false,
        afwijking: moduleAfwijking
          ? { reden: moduleAfwijking.reden, door: moduleAfwijking.door, op: moduleAfwijking.op }
          : undefined,
        items: module.items.map((item): Protocolitem => {
          const a = vind(module.id, item.code);
          const richtlijn = {
            intervalDagen: item.basisIntervalDagen,
            doorlooptijdDagen: doorlooptijdVan(item),
            labVooraf: Boolean(item.labVooraf),
          };
          return {
            code: item.code,
            naam: item.naam,
            richtlijn,
            praktijk: {
              intervalDagen: a?.intervalDagen ?? richtlijn.intervalDagen,
              doorlooptijdDagen: a?.doorlooptijdDagen ?? richtlijn.doorlooptijdDagen,
              labVooraf: a?.labVooraf ?? richtlijn.labVooraf,
              actief: a?.actief !== false,
            },
            doorlooptijdReden: doorlooptijdReden(item),
            zelfAanleverbaar: Boolean(item.zelfAanleverbaar),
            vragenlijst: item.vragenlijst,
            intervalRegels: (item.intervalRegels ?? []).map((r) => ({ factor: r.factor, reden: r.reden })),
            afwijking: a ? { reden: a.reden, door: a.door, op: a.op } : undefined,
          };
        }),
      };
    }),
    ketens: ketens.map((k) => ({
      id: k.id, naam: k.naam, modules: k.modules, declaratie: k.declaratie,
    })),
  };
}

export interface Protocolwijziging {
  moduleId: string;
  itemCode?: string;
  actief?: boolean;
  intervalDagen?: number;
  doorlooptijdDagen?: number;
  labVooraf?: boolean;
  reden: string;
}

/**
 * Een protocolwijziging doorvoeren.
 *
 * Twee dingen zijn verplicht en niet te omzeilen: het recht en de reden. Zonder recht
 * gebeurt er niets; zonder reden ook niet. Een afwijking zonder onderbouwing is over een
 * half jaar niet te onderscheiden van een vergissing, en dan wordt hij hersteld door
 * iemand die niet weet waarom hij bestond — of erger: hij blijft staan terwijl niemand
 * hem nog kan verdedigen.
 */
export function wijzigProtocol(
  repo: DossierRepository, wijziging: Protocolwijziging, doorId: string,
): { uitgevoerd: boolean; melding: string; overzicht: Protocoloverzicht } {
  const gebruiker = vindGebruiker(doorId);
  if (!gebruiker?.rechten.includes('protocol-aanpassen')) {
    return {
      uitgevoerd: false,
      melding: 'Je hebt geen recht om het protocol aan te passen.',
      overzicht: protocoloverzicht(repo, doorId),
    };
  }
  if (wijziging.reden.trim().length < 5) {
    return {
      uitgevoerd: false,
      melding: 'Een afwijking van de richtlijn vraagt een reden. Zonder die reden is hij '
        + 'over een half jaar niet te onderscheiden van een vergissing.',
      overzicht: protocoloverzicht(repo, doorId),
    };
  }

  repo.pasProtocolAan({
    moduleId: wijziging.moduleId,
    itemCode: wijziging.itemCode,
    actief: wijziging.actief,
    intervalDagen: wijziging.intervalDagen,
    doorlooptijdDagen: wijziging.doorlooptijdDagen,
    labVooraf: wijziging.labVooraf,
    reden: wijziging.reden.trim(),
    door: gebruiker.naam,
    op: new Date().toISOString().slice(0, 10),
  });

  return {
    uitgevoerd: true,
    melding: 'Aangepast. Dit werkt meteen door in alle zorgplannen en in de aanloop.',
    overzicht: protocoloverzicht(repo, doorId),
  };
}

/** Een afwijking terugdraaien naar de richtlijn. */
export function herstelProtocol(
  repo: DossierRepository, moduleId: string, itemCode: string | undefined, doorId: string,
): { uitgevoerd: boolean; melding: string; overzicht: Protocoloverzicht } {
  const gebruiker = vindGebruiker(doorId);
  if (!gebruiker?.rechten.includes('protocol-aanpassen')) {
    return {
      uitgevoerd: false,
      melding: 'Je hebt geen recht om het protocol aan te passen.',
      overzicht: protocoloverzicht(repo, doorId),
    };
  }
  repo.herstelProtocolonderdeel(moduleId, itemCode);
  return {
    uitgevoerd: true,
    melding: 'Teruggezet naar de richtlijn.',
    overzicht: protocoloverzicht(repo, doorId),
  };
}

// ── 14. Beheer ──────────────────────────────────────────────────────────────


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
  | { soort: 'overleg'; datum: string; notitie: Overlegnotitie }
  | { soort: 'eigenmeting'; datum: string; meting: Eigenmetingdag }
  | { soort: 'vragenlijst'; datum: string; inzage: Vragenlijstinzage }
  | { soort: 'intake'; datum: string; intake: WachtkamerIntake };

export type Tijdlijnsoort = Tijdlijnitem['soort'];

/** Wat een filterknop boven de tijdlijn moet zeggen, en hoe hij heet. */
export const TIJDLIJNSOORT_LABEL: Record<Tijdlijnsoort, string> = {
  contact: 'Contacten',
  extern: 'Van buiten',
  overleg: 'Overleg',
  eigenmeting: 'Thuismetingen',
  vragenlijst: 'Vragenlijsten',
  intake: 'Wachtkamer',
};

/**
 * Welke soorten van de patiënt zelf komen.
 *
 * Dit is het onderscheid waar de filterknop 'door de patiënt aangeleverd' op staat, en
 * het is hetzelfde onderscheid als in ADR-0012: deze regels zijn echt en bruikbaar, maar
 * ze zijn niet door de praktijk vastgelegd.
 */
export const PATIENTSOORTEN: Tijdlijnsoort[] = ['eigenmeting', 'vragenlijst', 'intake'];

/**
 * Wat de patiënt zelf heeft vastgelegd, op één dag.
 *
 * Dit hoort in het journaal — anders verdwijnt wat iemand zelf doorgeeft in een grafiek
 * en is er in de tijdlijn niets van terug te zien. Maar het hoort er niet als consult: er
 * is geen zorgverlener bij geweest, er is niets beoordeeld, en het vult geen
 * ketenindicator (ADR-0012). Vandaar een eigen soort met een eigen vorm.
 */
export interface Eigenmetingdag {
  id: string;
  datum: string;
  metingen: { code: string; naam: string; waarde: string; eenheid?: string }[];
  /** Waar het vandaan kwam: de patiënt zelf, of een apparaat dat hij thuis gebruikt. */
  via: string;
  bevestigd: boolean;
}

/** Vaste id van de bron 'wat de patiënt zelf aanleverde'. */
export const PATIENTBRON = 'bron-patient';

export interface Bron {
  id: string;
  /** 'episode' voor eigen huisartsenzorg, 'patient' voor eigen aanlevering, anders extern. */
  aard: 'episode' | 'patient' | 'ziekenhuis' | 'thuiszorg' | 'paramedisch' | 'ggz' | 'apotheek' | 'spoed';
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
  const aantalPatientregels = dossier.observaties.filter(
    (o) => o.herkomst.bron === 'patient' || o.herkomst.auteurRol === 'patient',
  ).length
    + repo.afnames(patientId).filter((a) => a.ingevuldOp).length
    + (repo.intakes().some((i) => i.patientId === patientId) ? 1 : 0);

  const bronnen: Bron[] = [
    ...(aantalPatientregels > 0 ? [{
      id: PATIENTBRON, aard: 'patient' as const,
      titel: 'Door de patiënt aangeleverd',
      toelichting: 'Thuismetingen, vragenlijsten en wachtkamervoorbereiding',
      aantal: aantalPatientregels,
    }] : []),
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
  /*
   * De patiëntbron is geen echte bron maar een dwarsdoorsnede: alles wat déze mens zelf
   * heeft aangeleverd, ongeacht bij welke episode het hoort. Die vraag — 'laat mij eens
   * zien wat hij zelf heeft doorgegeven' — is nu alleen te beantwoorden door het hele
   * journaal door te scrollen en de regels er met het oog uit te pikken.
   */
  const alleenPatient = bronId === PATIENTBRON;
  const contacten = journaal(dossier, isEpisode ? bronId : undefined);
  const zichtbaarExtern = alleenPatient ? [] : bronId
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
  const notities = bronId ? [] : repo.overlegnotities(patientId);

  // Wat de patiënt zelf bewaarde, gegroepeerd per dag. Los per meting zou het journaal
  // onleesbaar maken bij iemand die dagelijks zijn bloeddruk doorgeeft.
  const eigenPerDag = new Map<string, Eigenmetingdag>();
  for (const obs of dossier.observaties) {
    const vanPatient = obs.herkomst.bron === 'patient' || obs.herkomst.auteurRol === 'patient';
    if (!vanPatient) continue;
    const datum = obs.effectief.slice(0, 10);
    const bestaand = eigenPerDag.get(datum) ?? {
      id: `eigen-${datum}`,
      datum,
      metingen: [],
      via: obs.bronApparaat?.naam ?? 'door de patiënt zelf ingevoerd',
      // Een meting die aan een contact hangt is tijdens dat contact besproken; los
      // binnengekomen waarden zijn dat niet, en dat verschil moet je kunnen zien.
      bevestigd: Boolean(obs.encounterId),
    };
    const waarde = obs.waarde && 'value' in obs.waarde
      ? String(obs.waarde.value)
      : obs.waarde && 'code' in obs.waarde
        ? obs.waarde.code.display ?? obs.waarde.code.code
        : obs.waarde && 'tekst' in obs.waarde ? obs.waarde.tekst : '—';
    bestaand.metingen.push({
      code: obs.code.coding?.[0]?.code ?? '',
      naam: metingNaam(obs.code.coding?.[0]?.code ?? ''),
      waarde,
      eenheid: obs.waarde && 'value' in obs.waarde ? obs.waarde.unit : undefined,
    });
    eigenPerDag.set(datum, bestaand);
  }
  const eigenmetingen = bronId && !alleenPatient ? [] : [...eigenPerDag.values()];

  /*
   * Ingevulde vragenlijsten horen in het journaal.
   *
   * Zonder deze regel is een overgenomen vragenlijst alleen nog terug te vinden als
   * tekst in de S van het consult waarin hij is overgenomen — en dan is niet meer te
   * zien dat het de patiënt was die dat opschreef, wanneer hij dat deed, en wat hij op
   * de vragen antwoordde die níét in de samenvatting pasten.
   *
   * Hij staat op de dag waarop de patiënt hem invulde, niet op de dag van het consult.
   * Dat is wanneer hij bestond.
   */
  const vragenlijsten = bronId && !alleenPatient
    ? []
    : repo.afnames(patientId)
        .filter((a) => a.ingevuldOp)
        .map((a) => bouwInzage(a, repo.peildatum()))
        .filter((x): x is Vragenlijstinzage => x !== undefined);

  // De voorbereiding uit de wachtkamer hoort ook in de tijdlijn. Hij is geen consult —
  // een partnerapp heeft een gesprek omgezet naar tekst — maar hij is wél de aanleiding
  // voor wat daarna is vastgelegd, en zonder hem mist dat verhaal zijn begin.
  const intake = bronId && !alleenPatient
    ? undefined
    : repo.intakes().find((i) => i.patientId === patientId);

  const tijdlijn: Tijdlijnitem[] = [
    ...zichtbaarContacten.map((c): Tijdlijnitem => ({ soort: 'contact', datum: c.datum, contact: c })),
    ...zichtbaarExtern.map((d): Tijdlijnitem => ({ soort: 'extern', datum: d.datum, document: d })),
    ...notities.map((n): Tijdlijnitem => ({ soort: 'overleg', datum: n.op.slice(0, 10), notitie: n })),
    ...eigenmetingen.map((m): Tijdlijnitem => ({ soort: 'eigenmeting', datum: m.datum, meting: m })),
    ...vragenlijsten.map((inzage): Tijdlijnitem => ({
      soort: 'vragenlijst', datum: inzage.ingevuldOp!.slice(0, 10), inzage,
    })),
    ...(intake
      ? [{ soort: 'intake' as const, datum: intake.opgenomenOp.slice(0, 10), intake }]
      : []),
  ].sort((a, b) => b.datum.localeCompare(a.datum));

  return {
    journaal: contacten,
    tijdlijn,
    bronnen,
    episodes,
    aantalContacten: dossier.contacten.length,
    aantalExtern: extern.length,
    ongelezenExtern: extern.filter((d) => !d.gelezen).length,
    aantalOverleg: repo.overlegnotities(patientId).length,
  };
}

/**
 * HET HELE CONTACT — alles wat op één moment is vastgelegd
 *
 * In een journaalregel staat de SOEP-tekst, en dat is maar een deel van wat er tijdens een
 * consult gebeurde. Er zijn metingen gedaan, er zijn orders uitgezet, er is een verrichting
 * verricht, er is een declaratieregel ontstaan. Dat staat nu allemaal op een andere plek in
 * het systeem, terwijl het bij elkaar hoort: het is één gebeurtenis.
 *
 * Het gaat om reconstrueerbaarheid. Als je over een jaar wilt weten waarom je toen iets
 * besloot, moet je kunnen zien wat je op dát moment voor je had — en niet wat er sindsdien
 * bij is gekomen. Daarom worden de gegevens hier per contact bij elkaar gezocht en niet
 * "de huidige stand van zaken" getoond.
 */
export interface Contactdossier {
  encounterId: string;
  datum: string;
  tijd?: string;
  soort: string;
  duurMinuten?: number;
  uitvoerder: { naam: string; rol: string };
  herkomst: { bron: string; vastgelegdOp: string; auteurRol: string };
  /** De patiënt zoals hij er op dát moment voor stond. */
  patient: {
    naam: string;
    leeftijdToen: number;
    geboortedatum: string;
    episodesToen: { icpc?: string; titel: string }[];
    behandelgrenzen: string[];
  };
  hulpvraag?: string;
  /** Per deelcontact: één contact kan meerdere episodes raken (docs/03 §2). */
  deelcontacten: {
    id: string;
    episodeTitel: string;
    episodeIcpc?: string;
    regels: { letter: string; tekst: string }[];
  }[];
  metingen: {
    code: string; naam: string; waarde: string; eenheid?: string;
    bron: string; eigenRegistratie: boolean;
  }[];
  orders: { id: string; soort: string; omschrijving: string; detail?: string; status: string; route?: string }[];
  verrichtingen: {
    naam: string; uitgevoerdDoor: string; beoordelaar: string;
    waarden: { naam: string; waarde: string }[];
    conclusie?: string;
  }[];
  declaratie?: { code: string; omschrijving: string; declarabel: boolean; ontbreekt?: string[] };
}

export function contactdossier(
  repo: DossierRepository, patientId: string, encounterId: string,
): Contactdossier | undefined {
  const dossier = repo.dossier(patientId);
  const contact = dossier?.contacten.find((c) => c.id === encounterId);
  if (!dossier || !contact) return undefined;

  const op = contact.herkomst.vastgelegdOp;
  const deelcontacten = dossier.deelcontacten.filter((dc) => dc.encounterId === encounterId);
  const orders = repo.orders(patientId).filter((o) =>
    deelcontacten.some((dc) => dc.id === o.deelcontactId)
    || o.geplaatstOp.slice(0, 10) === op.slice(0, 10));

  const uitslagen = repo.verrichtinguitslagen(patientId)
    .filter((u) => orders.some((o) => o.id === u.orderId));

  // Leeftijd tóén, niet nu. Bij een contact van drie jaar geleden maakt dat uit, en het
  // is precies het soort detail waardoor een oud dossier ineens klopt.
  const geboren = new Date(dossier.patient.geboortedatum);
  const toen = new Date(op);
  let leeftijdToen = toen.getFullYear() - geboren.getFullYear();
  const maand = toen.getMonth() - geboren.getMonth();
  if (maand < 0 || (maand === 0 && toen.getDate() < geboren.getDate())) leeftijdToen -= 1;

  return {
    encounterId,
    datum: op.slice(0, 10),
    tijd: op.slice(11, 16) || undefined,
    soort: contact.soort,
    duurMinuten: contact.duurMinuten,
    uitvoerder: { naam: contact.uitvoerder.naam, rol: contact.uitvoerder.rol },
    herkomst: {
      bron: contact.herkomst.bron,
      vastgelegdOp: op,
      auteurRol: contact.herkomst.auteurRol,
    },
    patient: {
      naam: volledigeNaam(dossier),
      leeftijdToen,
      geboortedatum: dossier.patient.geboortedatum,
      episodesToen: dossier.episodes
        .filter((e) => !e.periode.start || e.periode.start <= op)
        .map((e) => ({
          icpc: e.code.coding?.find((c) => c.system.includes('icpc'))?.code,
          titel: e.titel,
        })),
      // Alleen wat er tóén al vastlag. Een behandelgrens die later is afgesproken, hoort
      // niet bij het beeld waarin dit besluit is genomen.
      behandelgrenzen: repo.beleidsafspraken(patientId)
        .filter((b) => b.vastgelegdOp <= op)
        .map((b) => b.samenvatting),
    },
    hulpvraag: contact.hulpvraag,
    deelcontacten: deelcontacten.map((dc) => {
      const episode = dossier.episodes.find((e) => e.id === dc.episodeId);
      return {
        id: dc.id,
        episodeTitel: episode?.titel ?? 'Geen episode',
        episodeIcpc: episode?.code.coding?.find((c) => c.system.includes('icpc'))?.code,
        regels: dc.regels.map((r) => ({ letter: r.letter, tekst: r.tekst })),
      };
    }),
    metingen: dossier.observaties
      .filter((o) => o.encounterId === encounterId)
      .map((o) => {
        const code = o.code.coding?.[0]?.code ?? '';
        const waarde = o.waarde && 'value' in o.waarde
          ? String(o.waarde.value)
          : o.waarde && 'code' in o.waarde
            ? o.waarde.code.display ?? o.waarde.code.code
            : o.waarde && 'tekst' in o.waarde ? o.waarde.tekst : '—';
        return {
          code,
          naam: metingNaam(code),
          waarde,
          eenheid: o.waarde && 'value' in o.waarde ? o.waarde.unit : undefined,
          bron: o.herkomst.bron,
          // Alleen wat een zorgverlener zelf vaststelde telt als eigen registratie en
          // vult een ketenindicator. Wat de patiënt aanleverde is klinisch bruikbaar
          // maar niet van jou (ADR-0012).
          eigenRegistratie: o.herkomst.bron === 'zorgverlener',
        };
      }),
    orders: orders.map((o) => ({
      id: o.id, soort: o.soort, omschrijving: o.omschrijving,
      detail: o.detail, status: o.status, route: o.route,
    })),
    verrichtingen: uitslagen.map((u) => {
      const soort = vindVerrichting(u.soortCode);
      return {
        naam: soort?.naam ?? u.soortCode,
        uitgevoerdDoor: u.uitgevoerdDoor.naam,
        beoordelaar: u.beoordelaar,
        waarden: (soort?.uitkomstvelden ?? []).map((veld) => ({
          naam: veld.naam,
          waarde: veld.soort === 'keuze'
            ? (veld.opties?.find((o) => o.code === u.waarden[veld.code])?.label
              ?? u.waarden[veld.code] ?? '—')
            : `${u.waarden[veld.code] ?? '—'}${veld.eenheid ? ` ${veld.eenheid}` : ''}`,
        })),
        conclusie: u.conclusie,
      };
    }),
    declaratie: contact.declaratie,
  };
}

// ── 15b. Medicatie wijzigen ─────────────────────────────────────────────────

/** De bron waarmee de bewaking dubbelmedicatie markeert; zie packages/care-engine/catalogus.ts. */
const DUBBELMEDICATIE = 'medicatiebewaking — dubbelmedicatie';

/**
 * Het medicatieoverzicht zoals het paneel het nodig heeft.
 *
 * Lopende middelen mét hun openstaande order, gestopte middelen eronder, en de apotheken
 * waar dit recept heen kan. Dat laatste hoort erbij en niet in een instelling: de keuze
 * wordt per recept gemaakt, want de patiënt is vandaag hier en morgen bij zijn dochter.
 */
export function medicatieoverzicht(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const orders = repo.orders(patientId);
  const peildatum = repo.peildatum();

  const bij = (middel: { middel: { coding?: { code: string }[] } }) => {
    const atc = middel.middel.coding?.[0]?.code;
    return orders
      .filter((o) => o.soort === 'medicatie' && o.atc === atc)
      .sort((a, b) => b.geplaatstOp.localeCompare(a.geplaatstOp))[0];
  };

  const naarRegel = (m: (typeof dossier.medicatie)[number]) => {
    const atc = m.middel.coding?.[0]?.code;
    const laatste = bij(m);
    return {
      id: m.id,
      naam: m.middel.text ?? m.middel.coding?.[0]?.display ?? 'Middel',
      atc,
      dosering: m.dosering,
      chronisch: m.chronisch,
      begin: m.begin,
      einde: m.einde,
      status: m.status,
      voorschrijver: m.herkomst.auteurRol,
      // De waarschuwingen zoals ze nú gelden: een nierfunctie die gedaald is, maakt een
      // middel dat vorig jaar prima was vandaag een aandachtspunt.
      //
      // Behalve de dubbelmedicatiecheck: die vuurt per definitie op elk middel dat de
      // patiënt gebruikt, en "dit middel staat al in het dossier" naast het middel dat
      // in het dossier staat, is ruis die de echte waarschuwingen onzichtbaar maakt.
      waarschuwingen: atc
        ? bewaakMiddel(atc, dossier, peildatum).filter((w) => w.bron !== DUBBELMEDICATIE)
        : [],
      laatsteOrder: laatste
        ? {
            id: laatste.id, status: laatste.status, route: laatste.route,
            bestemming: laatste.bestemming, geplaatstOp: laatste.geplaatstOp.slice(0, 10),
          }
        : undefined,
    };
  };

  const vaste = voorkeursapotheek(dossier);
  return {
    lopend: dossier.medicatie.filter((m) => m.status === 'active').map(naarRegel),
    gestopt: dossier.medicatie
      .filter((m) => m.status !== 'active')
      .sort((a, b) => (b.einde ?? '').localeCompare(a.einde ?? ''))
      .slice(0, 12)
      .map(naarRegel),
    apotheken: APOTHEKEN,
    voorkeursapotheek: { id: vaste.id, naam: vaste.naam, plaats: vaste.plaats },
    redenen: REDENEN,
    soortLabel: WIJZIGING_LABEL,
    episodes: dossier.episodes
      .filter((e) => e.status === 'active')
      .map((e) => ({
        id: e.id, titel: e.titel,
        icpc: e.code.coding?.find((c) => c.system.includes('icpc'))?.code,
      })),
  };
}

/**
 * Wat er gaat gebeuren, vóórdat het gebeurt.
 *
 * Het paneel vraagt dit op terwijl de gebruiker nog aan het kiezen is. Dezelfde functie
 * die de zinnen maakt, zit in de domeinlaag — zodat de samenvatting die je leest en de
 * handeling die volgt niet uit elkaar kunnen lopen.
 */
export function medicatievoorbeeld(
  repo: DossierRepository, wijziging: Medicatiewijziging,
) {
  const dossier = repo.dossier(wijziging.patientId);
  if (!dossier) return undefined;
  const huidig = wijziging.statementId
    ? dossier.medicatie.find((m) => m.id === wijziging.statementId)
    : undefined;
  // Bij het aanpassen van een bestaand middel is de dubbelmedicatiemelding het advies dat
  // je op dat moment juist opvolgt — dan is hij geen waarschuwing maar een bevestiging.
  // Bij vervangen door een ánder middel dat de patiënt al gebruikt, blijft hij staan.
  const zelfdeAlsHuidig = Boolean(
    huidig && wijziging.nieuw?.atc && huidig.middel.coding?.[0]?.code === wijziging.nieuw.atc,
  );
  const nieuweWaarschuwingen = (wijziging.nieuw?.atc
    ? bewaakMiddel(wijziging.nieuw.atc, dossier, repo.peildatum())
    : []
  ).filter((w) => !(zelfdeAlsHuidig && w.bron === DUBBELMEDICATIE));
  return { ...beschrijfWijziging(wijziging, huidig), waarschuwingen: nieuweWaarschuwingen };
}

export function wijzigMedicatie(
  repo: DossierRepository, gebruikerId: string, wijziging: Medicatiewijziging,
) {
  const gebruiker = vindGebruiker(gebruikerId);
  if (!gebruiker || gebruiker.rol === 'administrator') return undefined;
  if (!wijziging.reden.trim()) return undefined;

  // Een apotheek die niet elektronisch ontvangt, krijgt geen elektronisch recept. Dat
  // stilletjes omzetten naar printen zou betekenen dat de zorgverlener denkt dat het
  // verstuurd is terwijl er een vel papier in een la ligt.
  const apotheek = wijziging.aflevering.apotheekId
    ? vindApotheek(wijziging.aflevering.apotheekId) : undefined;
  if (wijziging.aflevering.route === 'digitaal' && (!apotheek || !apotheek.digitaal)) {
    return undefined;
  }

  const order = repo.wijzigMedicatie(wijziging, {
    id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol, rechten: gebruiker.rechten,
  });
  const overzicht = medicatieoverzicht(repo, wijziging.patientId);
  if (!overzicht) return undefined;

  return {
    overzicht,
    order,
    // De POH stelt voor, de huisarts schrijft voor (docs/16 §4). Dat verschil is hier
    // zichtbaar in plaats van verstopt in een foutmelding achteraf.
    naarAutorisatie: order?.status === 'ter-autorisatie',
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

// ── 18b. Acute instroom ─────────────────────────────────────────────────────

/**
 * Wat er nú binnenkomt en door iemand opgepakt moet worden.
 *
 * Bewust geen teller maar een lijst met een claim. Een cijfertje dat van 3 naar 4 gaat
 * terwijl je een consult doet, ziet niemand; en als drie mensen hetzelfde signaal zien
 * zonder dat zichtbaar is wie ermee bezig is, gaan er twee bellen of geen enkele.
 */
export function acuteInstroom(repo: DossierRepository, rol: Rol) {
  const eigen = acuutVoor(repo.acuteSignalen(), rol);
  const verrijk = (s: (typeof eigen)[number]) => ({
    ...s,
    bronLabel: BRON_LABEL[s.bron],
    urgentieLabel: URGENTIE_UITLEG[s.urgentie].label,
    opdringen: URGENTIE_UITLEG[s.urgentie].opdringen,
    binnenOmTijd: s.binnenOp.slice(11, 16),
  });

  return {
    open: eigen.filter((s) => s.status === 'open').map(verrijk),
    opgepakt: eigen.filter((s) => s.status === 'opgepakt').map(verrijk),
    afgehandeld: eigen.filter((s) => s.status === 'afgehandeld').map(verrijk),
    /** Alles wat deze rol kan oppakken, ongeacht status — voor het overzichtsscherm. */
    alles: eigen.map(verrijk),
  };
}

export function pakAcuutOp(repo: DossierRepository, id: string, gebruikerId: string, rol: Rol) {
  const gebruiker = vindGebruiker(gebruikerId);
  if (gebruiker && gebruiker.rol !== 'administrator') {
    repo.pakAcuutOp(id, { id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol });
  }
  return acuteInstroom(repo, rol);
}

export function handelAcuutAf(repo: DossierRepository, id: string, uitkomst: string, rol: Rol) {
  repo.handelAcuutAf(id, uitkomst);
  return acuteInstroom(repo, rol);
}

// ── 18c. Verrichtingen ──────────────────────────────────────────────────────

/**
 * Wat er aan verrichtingen openstaat en wat er al uit kwam.
 *
 * Een order voor een ECG is niet af als het ECG gemaakt is: er komt een strook uit en er
 * moet iemand naar kijken. Dat spoor houdt dit overzicht vast — van aanvraag tot oordeel,
 * met de uitvoerder erbij, want dat is vaak een ander dan de aanvrager.
 */
export function verrichtingen(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const orders = repo.orders(patientId).filter((o) => o.soort === 'onderzoek');
  const uitslagen = repo.verrichtinguitslagen(patientId);
  const gedaan = new Set(uitslagen.map((u) => u.orderId));

  return {
    open: orders
      .filter((o) => !gedaan.has(o.id) && o.status !== 'afgewezen' && o.status !== 'ingetrokken')
      .map((o) => ({
        order: o,
        // Via de code uit de catalogus, niet via naamvergelijking: een verrichting die
        // hernoemd wordt, mag niet stilletjes zijn uitkomstvelden kwijtraken.
        soort: o.verrichtingCode ? vindVerrichting(o.verrichtingCode) : undefined,
      })),
    uitslagen: uitslagen.map((u) => {
      const soort = vindVerrichting(u.soortCode);
      return {
        ...u,
        soortNaam: soort?.naam ?? u.soortCode,
        afwijkingen: soort ? buitenBandbreedte(soort, u.waarden) : [],
        velden: (soort?.uitkomstvelden ?? []).map((veld) => ({
          naam: veld.naam,
          waarde: veld.soort === 'keuze'
            ? (veld.opties?.find((o) => o.code === u.waarden[veld.code])?.label
              ?? u.waarden[veld.code] ?? '')
            : `${u.waarden[veld.code] ?? ''}${veld.eenheid ? ` ${veld.eenheid}` : ''}`.trim(),
        })).filter((v) => v.waarde !== ''),
      };
    }),
    soorten: verrichtingsoorten,
  };
}

export function legVerrichtingVast(
  repo: DossierRepository,
  gebruikerId: string,
  gegevens: {
    patientId: string; orderId: string; soortCode: string; waarden: Record<string, string>;
    beoordelaar: Beoordelaar; vraagstelling?: string; conclusie?: string;
  },
) {
  const gebruiker = vindGebruiker(gebruikerId);
  if (!gebruiker || gebruiker.rol === 'administrator') return undefined;
  const soort = vindVerrichting(gegevens.soortCode);
  const nu = new Date().toISOString();

  const uitslag: Verrichtinguitslag = {
    orderId: gegevens.orderId,
    soortCode: gegevens.soortCode,
    uitgevoerdDoor: { id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol },
    uitgevoerdOp: nu,
    waarden: gegevens.waarden,
    beoordelaar: gegevens.beoordelaar,
    conclusie: gegevens.conclusie,
    teleconsult: gegevens.beoordelaar === 'teleconsultatie' && soort?.teleconsultatie
      ? {
          specialisme: soort.teleconsultatie.specialisme,
          vraagstelling: gegevens.vraagstelling ?? 'Beoordeling gevraagd',
          verstuurdOp: nu,
        }
      : undefined,
  };
  repo.legVerrichtingVast(uitslag);
  return verrichtingen(repo, gegevens.patientId);
}

/**
 * Een patiëntbericht beantwoorden én vastleggen.
 *
 * Dit is waar het kanaal zijn waarde krijgt of verliest. Een antwoord dat alleen in het
 * berichtenbakje blijft staan, bestaat over twee weken niet meer. Daarom gaat het
 * antwoord hier tegelijk als deelcontact het dossier in, mét de contactvorm — want een
 * e-consult is administratief iets anders dan een telefoontje, en dat is bekend op dit
 * moment en niet achteraf.
 */
export function beantwoordPatientbericht(
  repo: DossierRepository,
  gegevens: {
    gesprekId: string; gebruikerId: string; tekst: string;
    contactvorm: Contactvorm; episodeId?: string;
    soep?: { S?: string; O?: string; E?: string; P?: string };
    duurMinuten?: number;
  },
) {
  const gesprek = repo.alleGesprekken().find((g) => g.id === gegevens.gesprekId);
  if (!gesprek?.patientId) return undefined;

  repo.stuurBericht(gegevens.gesprekId, gegevens.gebruikerId, gegevens.tekst);

  const vraag = gesprek.berichten.find((b) => b.vanId === gesprek.patientId)?.tekst ?? '';
  const uitkomst = registreerConsult(repo, gesprek.patientId, {
    metingen: [],
    soep: {
      S: gegevens.soep?.S ?? vraag,
      O: gegevens.soep?.O,
      E: gegevens.soep?.E,
      P: gegevens.soep?.P ?? gegevens.tekst,
    },
    episodeId: gegevens.episodeId,
    gebruikerId: gegevens.gebruikerId,
    contactvorm: gegevens.contactvorm,
    duurMinuten: gegevens.duurMinuten,
  });

  return { berichten: berichten(repo, gegevens.gebruikerId), uitkomst };
}

export { contactvormen, vindContactvorm, beoordeelDeclaratie };
export type { Contactvorm };

// ── 18d. Samenvatting, media en groepsconsulten ─────────────────────────────

/**
 * Het dossier in vijf alinea's.
 *
 * De eerste vraag bij een dossier dat je niet kent is niet "wat is de laatste HbA1c" maar
 * "wie is dit en wat speelt er". Dat antwoord staat verspreid over acht kaarten en wordt
 * nu door elke zorgverlener opnieuw samengesteld door te lezen.
 */
export function samenvatting(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  return bouwSamenvatting({
    dossier,
    plan: planVoor(repo, dossier),
    peildatum: repo.peildatum(),
    extern: repo.externeDocumenten(patientId),
    beleid: repo.beleidsafspraken(patientId),
    orders: repo.orders(patientId),
    openAutorisaties: repo.autorisaties()
      .filter((a) => a.patientId === patientId && a.status === 'open').length,
    openBespreekpunten: repo.bespreekpunten()
      .filter((p) => p.patientId === patientId && p.status === 'open').length,
  });
}

export function media(repo: DossierRepository, patientId: string, filter?: Mediafilter) {
  const alle = repo.media(patientId);
  const gefilterd = repo.media(patientId, filter);
  return {
    bestanden: gefilterd,
    totaal: alle.length,
    ongelezen: alle.filter((m) => !m.gelezen).length,
    /** Facetten uit wat er werkelijk is; een filter op een lege categorie helpt niemand. */
    soorten: [...new Set(alle.map((m) => m.soort))]
      .map((soort) => ({ soort, label: MEDIASOORT_LABEL[soort], aantal: alle.filter((m) => m.soort === soort).length })),
    bronnen: [...new Set(alle.map((m) => m.bron))]
      .map((bron) => ({ bron, label: MEDIABRON_LABEL[bron], aantal: alle.filter((m) => m.bron === bron).length })),
    categorieen: [...new Set(alle.map((m) => m.categorie))].sort(),
    jaren: [...new Set(alle.map((m) => m.datum.slice(0, 4)))].sort().reverse(),
  };
}

/**
 * Groepsconsulten, met per consult wie er nog bij zou passen.
 *
 * Dat laatste is het verschil tussen een agenda-item en een werkinstrument: wie een
 * groepsconsult plant, wil niet zelf 48 dossiers doorzoeken op wie ervoor in aanmerking
 * komt.
 */
export function groepsconsulten(repo: DossierRepository) {
  const peildatum = repo.peildatum();
  return repo.groepsconsulten().map((groep) => {
    const alDeelnemer = new Set(groep.deelnemers.map((d) => d.patientId));
    const voorgesteld = repo.alleDossiers()
      .filter((d) => !alDeelnemer.has(d.patient.id))
      .map((dossier) => ({ dossier, plan: planVoor(repo, dossier) }))
      .filter(({ plan }) => plan.modules.some((m) => m.id === groep.module))
      .slice(0, 12)
      .map(({ dossier, plan }) => ({
        patientId: dossier.patient.id,
        naam: volledigeNaam(dossier),
        leeftijd: leeftijd(dossier, peildatum),
        onderbouwing: plan.modules.find((m) => m.id === groep.module)?.onderbouwing
          ?? 'Aandachtsgebied is actief in het zorgplan',
        zelfredzaamheid: plan.zelfredzaamheid?.gemiddelde,
      }));
    return {
      ...groep,
      tijd: groep.start.slice(11, 16),
      datum: groep.start.slice(0, 10),
      aangemeld: groep.deelnemers.filter((d) => d.status === 'aangemeld' || d.status === 'aanwezig').length,
      voorgesteld,
    };
  });
}

export function maakGroepsconsult(
  repo: DossierRepository, gebruikerId: string, nieuw: NieuwGroepsconsult,
) {
  const gebruiker = vindGebruiker(gebruikerId);
  if (!gebruiker || gebruiker.rol === 'administrator') return undefined;
  repo.maakGroepsconsult(nieuw, { id: gebruiker.id, naam: gebruiker.naam, rol: gebruiker.rol });
  return groepsconsulten(repo);
}


/**
 * EEN GROEPSCONSULT STARTEN, EN PER DEELNEMER REGISTREREN
 *
 * Het overzicht van wie er komt was er al. Wat ontbrak is wat er daarna gebeurt: het
 * consult begint, er wordt anderhalf uur gepraat, en dan moet er voor acht mensen iets in
 * acht dossiers. In de praktijk gebeurt dat achteraf uit het hoofd, of helemaal niet.
 *
 * Daarom kan het consult hier gestart worden en staat er tijdens de bijeenkomst per
 * deelnemer een veld. Wat je daar typt, wordt een contact in het dossier van díe mens —
 * met de groep als aanleiding en het thema als episode-ingang. Het consult is
 * gezamenlijk, het dossier niet.
 */
export function startGroepsconsult(repo: DossierRepository, groepId: string) {
  const groep = repo.groepsconsulten().find((g) => g.id === groepId);
  if (!groep) return undefined;
  repo.zetGroepsstatus(groepId, groep.status === 'bezig' ? 'afgerond' : 'bezig');
  return groepsconsulten(repo);
}

export interface Groepsnotitie {
  patientId: string;
  notitie: string;
  gebruikerId?: string;
}

export function legGroepsnotitieVast(
  repo: DossierRepository, groepId: string, gegevens: Groepsnotitie,
): { melding: string; groepen: ReturnType<typeof groepsconsulten> } | undefined {
  const groep = repo.groepsconsulten().find((g) => g.id === groepId);
  const deelnemer = groep?.deelnemers.find((d) => d.patientId === gegevens.patientId);
  if (!groep || !deelnemer) return undefined;
  if (gegevens.notitie.trim().length < 3) {
    return {
      melding: 'Een lege notitie levert een contact op waar niemand iets aan heeft. '
        + 'Schrijf op wat er voor deze deelnemer uit kwam.',
      groepen: groepsconsulten(repo),
    };
  }

  const uitkomst = legContactVast(repo, gegevens.patientId, {
    notitie: gegevens.notitie,
    afspraak: `Deelgenomen aan het groepsconsult "${groep.titel}" (${groep.thema}).`,
    contactvorm: 'groepsconsult',
    duurMinuten: groep.duurMinuten,
    gebruikerId: gegevens.gebruikerId,
  });
  if (!uitkomst) return undefined;

  repo.markeerDeelnemerGeregistreerd(groepId, gegevens.patientId);
  return {
    melding: `Vastgelegd in het dossier van ${deelnemer.naam}.`,
    groepen: groepsconsulten(repo),
  };
}

// ── 18e. Rapportages ────────────────────────────────────────────────────────

/**
 * Een zoekvraag over de hele praktijk.
 *
 * Draait over dezelfde zorgplannen die het zorgproces gebruikt. Geen aparte
 * datawarehouse-definitie die na een half jaar uit de pas loopt met het scherm van de POH.
 */
export function rapport(repo: DossierRepository, criteria: Criteria) {
  const dossiers = repo.alleDossiers().map((dossier) => ({
    dossier, plan: planVoor(repo, dossier),
  }));
  return {
    ...draaiRapport(dossiers, criteria, repo.peildatum()),
    velden: filtervelden,
  };
}

export function rapportExport(repo: DossierRepository, criteria: Criteria) {
  const dossiers = repo.alleDossiers().map((dossier) => ({
    dossier, plan: planVoor(repo, dossier),
  }));
  return exporteerGeaggregeerd(draaiRapport(dossiers, criteria, repo.peildatum()));
}

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
