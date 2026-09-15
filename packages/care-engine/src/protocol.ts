import type { Rol } from '@zpe/fhir-model';
import type { Criterium } from './criteria.js';
import {
  alle, enigeVan, heeftActieveEpisode, heeftMarkering, heeftMedicatie, heeftMeting,
  metingBoven, metingOnder, metingStabielOnder, minimaalChronischeEpisodes,
  minimaalChronischeMiddelen, minimaleLeeftijd, niet, rookt,
} from './criteria.js';

/**
 * HET GEÏNTEGREERDE PROTOCOL
 *
 * Er is één protocol voor chronische zorg. Geen protocol per aandoening.
 *
 * De reden is inhoudelijk, niet technisch: een mens heeft zelden één probleem. Zodra je
 * de aandoening tot organiserend principe maakt, krijg je per definitie losse trajecten,
 * losse oproepen en losse consulten — en dat is precies wat elk bestaand systeem doet.
 *
 * In plaats daarvan is de bouwsteen de **zorgmodule**: een aandachtsgebied
 * (glucoseregulatie, vaatrisico, nierfunctie, ademhaling, leefstijl, mentaal welbevinden,
 * medicatieveiligheid, kwetsbaarheid). Per patiënt bepaalt het dossier welke modules
 * relevant zijn, en de situatie van die patiënt bepaalt hoe vaak er gemeten wordt.
 *
 * Landelijke zorgprogramma's (DM-keten, CVRM, COPD) verdwijnen niet — ze zijn nodig voor
 * declaratie en verantwoording. Maar ze zijn een *projectie* van dit plan, achteraf
 * afgeleid, en ze sturen het zorgproces niet aan. Zie `ketenkoppeling.ts`.
 */

export type ModuleId =
  | 'glucose' | 'vaatrisico' | 'nierfunctie' | 'ademhaling'
  | 'leefstijl' | 'mentaal' | 'medicatieveiligheid' | 'kwetsbaarheid';

/** Past het interval aan op basis van de feitelijke situatie van déze patiënt. */
export interface IntervalRegel {
  wanneer: Criterium;
  /** < 1 = vaker meten, > 1 = minder vaak. */
  factor: number;
  reden: string;
}

/**
 * Hoe dit item wordt vastgelegd. Niet alles is een getal: rookstatus is een gecodeerde
 * keuze en funduscopie is een verrichting. Een invoerveld dat daar niet bij past, levert
 * onbruikbare data op — en dat is precies hoe 'rookstatus' in bestaande systemen vrije
 * tekst werd.
 */
export type Invoer =
  | { soort: 'getal'; eenheid?: string }
  | { soort: 'keuze'; opties: { code: string; label: string }[] }
  | { soort: 'verrichting' }
  | { soort: 'vragenlijst'; vragenlijstId: string };

export interface Monitoritem {
  code: string;
  naam: string;
  invoer?: Invoer;
  /** Uitgangsinterval volgens richtlijn, in dagen. Het vertrekpunt, niet de uitkomst. */
  basisIntervalDagen: number;
  duurMinuten: number;
  /** Kan de patiënt dit zelf aanleveren (thuismeting of vragenlijst)? */
  zelfAanleverbaar?: boolean;
  /** Moet dit vóór het consult in een labaanvraag? */
  labVooraf?: boolean;
  /** Sommige items binnen een module gelden maar voor een deel van de patiënten. */
  relevantie?: Criterium;
  /** Regels die het interval op maat maken. */
  intervalRegels?: IntervalRegel[];
  /** Vragenlijst die dit item kan vullen, uitgezet vóór het contact. */
  vragenlijst?: string;
}

export interface Zorgmodule {
  id: ModuleId;
  naam: string;
  /** Korte, menselijke omschrijving — dit is wat de patiënt in zijn plan ziet. */
  omschrijving: string;
  icoon: string;
  /** Wanneer is dit aandachtsgebied relevant voor deze patiënt? */
  relevantie: Criterium;
  /** Wanneer is het juist níet van toepassing, ondanks relevantie. */
  uitsluiting?: Criterium;
  items: Monitoritem[];
  rol: Rol;
  richtlijnen: { naam: string; versie: string }[];
}

// Codes uit de terminologieseed (packages/terminology/src/seed.ts).
export const CODE = {
  hba1c: '59261-8', rrSys: '8480-6', rrDia: '8462-4', gewicht: '29463-7', bmi: '39156-5',
  ldl: '13457-7', egfr: '62238-1', acr: '14959-1', roken: '72166-2',
  fev1: '20150-9', fevRatio: '19926-5', ccq: 'ccq-totaal', mpg: 'mpg-totaal',
  voet: 'voetonderzoek-simms', fundus: 'funduscopie',
  medicatiebeoordeling: 'medicatiebeoordeling', kwetsbaarheid: 'kwetsbaarheidsscore',
} as const;

/** Gecodeerde rookstatus (SNOMED). Nooit vrije tekst — anders kun je er niets mee. */
const ROOKSTATUS = [
  { code: '77176002', label: 'Rookt' },
  { code: '8517006', label: 'Gestopt met roken' },
  { code: '266919005', label: 'Heeft nooit gerookt' },
];

const KWARTAAL = 92;
const HALFJAAR = 183;
const JAAR = 365;

/** ICPC-prefixen die als chronische aandoening tellen voor multimorbiditeit. */
export const CHRONISCHE_ICPC = [
  'T90', 'T89', 'K86', 'K87', 'K74', 'K75', 'K76', 'K77', 'K89', 'K90',
  'R95', 'R96', 'T93', 'U99', 'P76', 'P74', 'T82', 'B85',
];

/** Elke actieve module veronderstelt een chronische zorgvraag. */
const heeftChronischeZorgvraag = enigeVan([
  heeftActieveEpisode(CHRONISCHE_ICPC),
  minimaalChronischeMiddelen(3),
]);

export const modules: Zorgmodule[] = [
  {
    id: 'glucose',
    naam: 'Glucoseregulatie',
    omschrijving: 'Hoe uw bloedsuiker zich gedraagt en wat dat voor u betekent.',
    icoon: 'druppel',
    rol: 'poh-s',
    richtlijnen: [{ naam: 'NHG-Standaard Diabetes mellitus type 2', versie: 'M01' }],
    relevantie: enigeVan([
      heeftActieveEpisode(['T90', 'T89', 'B85.01']),
      heeftMedicatie('A10', 'bloedglucoseverlagend middel'),
      metingBoven(CODE.hba1c, 'HbA1c', 47, 3 * JAAR),
    ]),
    uitsluiting: heeftMarkering('palliatief'),
    items: [
      {
        code: CODE.hba1c, naam: 'HbA1c', basisIntervalDagen: KWARTAAL, duurMinuten: 2, labVooraf: true,
        invoer: { soort: 'getal', eenheid: 'mmol/mol' },
        intervalRegels: [
          { wanneer: metingStabielOnder(CODE.hba1c, 'HbA1c', 53, 2), factor: 2,
            reden: 'HbA1c al twee metingen goed onder controle — halfjaarlijks volstaat' },
          { wanneer: metingBoven(CODE.hba1c, 'HbA1c', 64, JAAR), factor: 0.5,
            reden: 'HbA1c boven 64 mmol/mol — korter interval tot het beter is' },
        ],
      },
      {
        code: CODE.voet, naam: 'Voetonderzoek', basisIntervalDagen: JAAR, duurMinuten: 8,
        relevantie: heeftActieveEpisode(['T90', 'T89']),
        invoer: { soort: 'keuze', opties: [
          { code: '0', label: 'Simms 0 — geen verhoogd risico' },
          { code: '1', label: 'Simms 1 — verlies protectieve sensibiliteit' },
          { code: '2', label: 'Simms 2 — ook perifeer vaatlijden of standafwijking' },
          { code: '3', label: 'Simms 3 — ulcus of amputatie in voorgeschiedenis' },
        ] },
      },
      {
        code: CODE.fundus, naam: 'Funduscontrole', basisIntervalDagen: 2 * JAAR, duurMinuten: 0,
        relevantie: heeftActieveEpisode(['T90', 'T89']),
        invoer: { soort: 'verrichting' },
      },
      // Gewicht is medebepalend voor de glucoseregulatie; gedeeld met leefstijl.
      { code: CODE.gewicht, naam: 'Gewicht', basisIntervalDagen: KWARTAAL, duurMinuten: 1, zelfAanleverbaar: true,
        invoer: { soort: 'getal', eenheid: 'kg' } },
    ],
  },

  {
    id: 'vaatrisico',
    naam: 'Hart- en vaatrisico',
    omschrijving: 'Uw bloeddruk, cholesterol en wat u kunt doen om risico te verlagen.',
    icoon: 'hart',
    rol: 'poh-s',
    richtlijnen: [{ naam: 'NHG-Standaard Cardiovasculair risicomanagement', versie: 'M84' }],
    relevantie: enigeVan([
      heeftActieveEpisode(['K74', 'K75', 'K76', 'K77', 'K89', 'K90']),  // doorgemaakte HVZ
      heeftActieveEpisode(['K86', 'K87']),                              // hypertensie
      heeftActieveEpisode(['T93']),                                     // dyslipidemie
      heeftActieveEpisode(['T90', 'T89']),                              // diabetes = verhoogd risico
      heeftActieveEpisode(['U99']),                                     // chronische nierschade
      heeftMedicatie('C10', 'cholesterolverlager'),
      alle([minimaleLeeftijd(50), rookt()]),
    ]),
    uitsluiting: heeftMarkering('palliatief'),
    items: [
      {
        code: CODE.rrSys, naam: 'Bloeddruk', basisIntervalDagen: KWARTAAL, duurMinuten: 3,
        zelfAanleverbaar: true, invoer: { soort: 'getal', eenheid: 'mmHg' },
        intervalRegels: [
          { wanneer: metingStabielOnder(CODE.rrSys, 'Bloeddruk systolisch', 140, 2), factor: 2,
            reden: 'bloeddruk al twee metingen op streefwaarde — halfjaarlijks volstaat' },
          { wanneer: metingBoven(CODE.rrSys, 'Bloeddruk systolisch', 160, JAAR), factor: 0.5,
            reden: 'bloeddruk boven 160 mmHg — korter interval tot instelling' },
        ],
      },
      { code: CODE.rrDia, naam: 'Bloeddruk diastolisch', basisIntervalDagen: KWARTAAL, duurMinuten: 0,
        zelfAanleverbaar: true, invoer: { soort: 'getal', eenheid: 'mmHg' } },
      {
        code: CODE.ldl, naam: 'LDL-cholesterol', basisIntervalDagen: JAAR, duurMinuten: 1, labVooraf: true,
        invoer: { soort: 'getal', eenheid: 'mmol/l' },
        intervalRegels: [
          { wanneer: metingOnder(CODE.ldl, 'LDL-cholesterol', 1.8, 2 * JAAR), factor: 2,
            reden: 'LDL ruim op streefwaarde — tweejaarlijks volstaat' },
        ],
      },
      // Nierfunctie en rookstatus zijn medebepalend voor het vaatrisico. Ze staan ook
      // in andere modules; de planner voegt ze samen tot één meting (zorgplan.ts).
      { code: CODE.egfr, naam: 'eGFR', basisIntervalDagen: JAAR, duurMinuten: 1, labVooraf: true,
        invoer: { soort: 'getal', eenheid: 'ml/min' } },
      { code: CODE.roken, naam: 'Rookstatus', basisIntervalDagen: JAAR, duurMinuten: 2, zelfAanleverbaar: true,
        invoer: { soort: 'keuze', opties: ROOKSTATUS } },
    ],
  },

  {
    id: 'nierfunctie',
    naam: 'Nierfunctie',
    omschrijving: 'Hoe uw nieren het doen; dat bepaalt mede welke medicijnen veilig zijn.',
    icoon: 'nier',
    rol: 'poh-s',
    richtlijnen: [{ naam: 'NHG-Standaard Chronische nierschade', versie: 'M109' }],
    relevantie: enigeVan([
      heeftActieveEpisode(['U99']),
      heeftActieveEpisode(['T90', 'T89']),
      heeftActieveEpisode(['K86', 'K87']),
      metingOnder(CODE.egfr, 'eGFR', 60, 3 * JAAR),
    ]),
    items: [
      {
        code: CODE.egfr, naam: 'eGFR', basisIntervalDagen: JAAR, duurMinuten: 1, labVooraf: true,
        invoer: { soort: 'getal', eenheid: 'ml/min' },
        intervalRegels: [
          { wanneer: metingOnder(CODE.egfr, 'eGFR', 45, 2 * JAAR), factor: 0.5,
            reden: 'eGFR onder 45 ml/min — halfjaarlijkse controle' },
          { wanneer: metingOnder(CODE.egfr, 'eGFR', 30, 2 * JAAR), factor: 0.25,
            reden: 'eGFR onder 30 ml/min — driemaandelijks, overleg met huisarts' },
        ],
      },
      { code: CODE.acr, naam: 'Albumine/creatinine-ratio', basisIntervalDagen: JAAR, duurMinuten: 1,
        labVooraf: true, invoer: { soort: 'getal', eenheid: 'mg/mmol' } },
    ],
  },

  {
    id: 'ademhaling',
    naam: 'Ademhaling en longen',
    omschrijving: 'Uw benauwdheid, hoesten en conditie, en hoe u een longaanval voorkomt.',
    icoon: 'long',
    rol: 'poh-s',
    richtlijnen: [{ naam: 'NHG-Standaard COPD', versie: 'M26' }, { naam: 'NHG-Standaard Astma bij volwassenen', versie: 'M27' }],
    relevantie: enigeVan([
      heeftActieveEpisode(['R95', 'R96']),
      heeftMedicatie('R03', 'luchtwegverwijder of inhalatiecorticosteroïd'),
    ]),
    uitsluiting: heeftMarkering('palliatief'),
    items: [
      {
        code: CODE.ccq, naam: 'Klachtenscore (CCQ)', basisIntervalDagen: HALFJAAR, duurMinuten: 4,
        zelfAanleverbaar: true, vragenlijst: 'vl-ccq',
        invoer: { soort: 'vragenlijst', vragenlijstId: 'vl-ccq' },
        intervalRegels: [
          { wanneer: metingStabielOnder(CODE.ccq, 'CCQ', 1, 3), factor: 2,
            reden: 'CCQ drie metingen stabiel onder 1,0 — jaarlijks volstaat' },
          { wanneer: metingBoven(CODE.ccq, 'CCQ', 2, JAAR), factor: 0.5,
            reden: 'CCQ boven 2,0 — frequenter volgen' },
        ],
      },
      { code: CODE.fev1, naam: 'Spirometrie (FEV1)', basisIntervalDagen: JAAR, duurMinuten: 15,
        relevantie: heeftActieveEpisode(['R95']), invoer: { soort: 'getal', eenheid: 'l' } },
      { code: CODE.fevRatio, naam: 'FEV1/FVC-ratio', basisIntervalDagen: JAAR, duurMinuten: 0,
        relevantie: heeftActieveEpisode(['R95']), invoer: { soort: 'getal' } },
      // Roken is bij longziekten de belangrijkste beïnvloedbare factor; gedeeld met leefstijl.
      { code: CODE.roken, naam: 'Rookstatus', basisIntervalDagen: JAAR, duurMinuten: 2,
        zelfAanleverbaar: true, invoer: { soort: 'keuze', opties: ROOKSTATUS } },
    ],
  },

  {
    id: 'leefstijl',
    naam: 'Leefstijl',
    omschrijving: 'Roken, bewegen, voeding en gewicht — waar u zelf het meeste invloed heeft.',
    icoon: 'blad',
    rol: 'poh-s',
    richtlijnen: [{ naam: 'NHG-Zorgmodule Leefstijl', versie: '2024' }],
    relevantie: heeftChronischeZorgvraag,
    items: [
      {
        code: CODE.roken, naam: 'Rookstatus', basisIntervalDagen: JAAR, duurMinuten: 2, zelfAanleverbaar: true,
        invoer: { soort: 'keuze', opties: ROOKSTATUS },
        intervalRegels: [
          { wanneer: rookt(), factor: 0.5, reden: 'patiënt rookt — stoppen-met-roken actief bespreken' },
        ],
      },
      { code: CODE.gewicht, naam: 'Gewicht', basisIntervalDagen: HALFJAAR, duurMinuten: 1,
        zelfAanleverbaar: true, invoer: { soort: 'getal', eenheid: 'kg' } },
    ],
  },

  {
    id: 'mentaal',
    naam: 'Mentaal welbevinden',
    omschrijving: 'Hoe het met u gaat van binnen, en wat u belangrijk vindt in uw leven.',
    icoon: 'hoofd',
    rol: 'poh-s',
    richtlijnen: [{ naam: 'Positieve Gezondheid', versie: '2024' }],
    relevantie: heeftChronischeZorgvraag,
    items: [
      { code: CODE.mpg, naam: 'Mijn Positieve Gezondheid', basisIntervalDagen: JAAR, duurMinuten: 5,
        zelfAanleverbaar: true, vragenlijst: 'vl-mpg',
        invoer: { soort: 'vragenlijst', vragenlijstId: 'vl-mpg' } },
    ],
  },

  {
    id: 'medicatieveiligheid',
    naam: 'Medicatieveiligheid',
    omschrijving: 'Of al uw medicijnen samen nog kloppen en of u ze goed kunt gebruiken.',
    icoon: 'pil',
    rol: 'huisarts',
    richtlijnen: [{ naam: 'Multidisciplinaire richtlijn Polyfarmacie bij ouderen', versie: '2020' }],
    relevantie: enigeVan([
      minimaalChronischeMiddelen(5),
      alle([minimaleLeeftijd(75), minimaalChronischeMiddelen(3)]),
      metingOnder(CODE.egfr, 'eGFR', 45, 2 * JAAR),
    ]),
    items: [
      { code: CODE.medicatiebeoordeling, naam: 'Medicatiebeoordeling', basisIntervalDagen: JAAR,
        duurMinuten: 20, invoer: { soort: 'verrichting' } },
    ],
  },

  {
    id: 'kwetsbaarheid',
    naam: 'Kwetsbaarheid en zelfredzaamheid',
    omschrijving: 'Of u nog goed uit de voeten kunt en welke steun daarbij helpt.',
    icoon: 'schild',
    rol: 'poh-s',
    richtlijnen: [{ naam: 'NHG-Standaard Complexe ouderenzorg', versie: 'M77' }],
    relevantie: alle([
      minimaleLeeftijd(75),
      minimaalChronischeEpisodes(2, CHRONISCHE_ICPC),
    ]),
    items: [
      { code: CODE.kwetsbaarheid, naam: 'Kwetsbaarheidsinventarisatie', basisIntervalDagen: JAAR,
        duurMinuten: 15, invoer: { soort: 'verrichting' } },
    ],
  },
];

export function vindModule(id: string): Zorgmodule | undefined {
  return modules.find((m) => m.id === id);
}

/** De rol die een module normaal uitvoert; bepaalt naar wie werk gaat. */
export const MODULE_ROL: Record<ModuleId, Rol> = Object.fromEntries(
  modules.map((m) => [m.id, m.rol]),
) as Record<ModuleId, Rol>;

export { niet, heeftMeting };
