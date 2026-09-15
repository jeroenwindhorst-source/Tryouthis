import type { Dossier, Rol } from '@zpe/fhir-model';
import { rng, type Praktijk } from './populatie.js';

/**
 * De werkvoorraad van de praktijk: triage-instroom, autorisatieverzoeken en de agenda
 * van elke rol.
 *
 * Dit is bewust geen losse module maar onderdeel van hetzelfde dossier. In de bestaande
 * systemen leven deze stromen naast elkaar als tellers — "Autorisatie 163",
 * "Wacht op verzending: 50", "Medicatiebewaking 14 meldingen" — die groeien tot iemand
 * ze 's avonds wegklikt. Een teller is geen werkvoorraad: een werkvoorraad zegt per
 * regel waarom hij bestaat en wat de voorgestelde afhandeling is.
 */

export type Urgentie = 'spoed' | 'vandaag' | 'deze-week' | 'routine' | 'zelfzorg';
export type Bestemming = 'zelfzorg' | 'assistent' | 'poh-s' | 'huisarts' | 'spoed';
export type Kanaal = 'telefoon' | 'portaal' | 'balie' | 'e-consult';

export interface Triageverzoek {
  id: string;
  patientId: string;
  naam: string;
  leeftijd: number;
  binnenOp: string;
  kanaal: Kanaal;
  hulpvraag: string;
  /**
   * Uitkomst van de digitale zelftriage. Eén triagemodel, twee kanalen (docs/12 §2.2):
   * wie via het portaal binnenkomt heeft dit al doorlopen, wie belt niet.
   */
  zelftriage?: { urgentie: Urgentie; bestemming: Bestemming; toelichting: string };
  status: 'nieuw' | 'afgehandeld';
}

export type AutorisatieSoort =
  | 'herhaalrecept' | 'labuitslag' | 'brief' | 'poh-registratie'
  | 'medicatiewijziging' | 'verwijzing';

export interface Autorisatieverzoek {
  id: string;
  patientId: string;
  naam: string;
  soort: AutorisatieSoort;
  omschrijving: string;
  /** Waarom ligt dit er. Nooit leeg. */
  aanleiding: string;
  ingediendDoor: { naam: string; rol: Rol };
  ingediendOp: string;
  /**
   * Routine betekent: binnen protocol, geen afwijkende waarden, geen interactie.
   * Zulke verzoeken mogen in bulk. Dit onderscheid is het verschil tussen 163 regels
   * uitzoeken en 12 regels beoordelen.
   */
  routine: boolean;
  redenGeenRoutine?: string;
  status: 'open' | 'geaccordeerd' | 'afgewezen';
}

export interface AgendaItem {
  id: string;
  start: string;
  duurMinuten: number;
  rol: Rol;
  patientId?: string;
  naam?: string;
  soort: string;
  titel: string;
  reden?: string;
  status: 'gepland' | 'afgerond' | 'noshow';
}

const HULPVRAGEN_TELEFOON = [
  'Hoesten sinds vier dagen, nu ook koorts',
  'Pijn bij het plassen sinds gisteren',
  'Uitslag op de arm na tuinieren',
  'Bloeddrukmeter thuis geeft 175, wat nu?',
  'Enkel verzwikt bij het hardlopen',
  'Slaapt al twee weken slecht, piekert veel',
  'Oordopje zit vast, kind van 4',
  'Rugpijn sinds tillen, straalt uit naar het been',
  'Wond aan de voet die niet geneest',
  'Wil graag een herhaalrecept voor de pufjes',
];

const HULPVRAGEN_PORTAAL = [
  'Al een week keelpijn, nu ook slikklachten',
  'Vraag over de uitslag van het bloedonderzoek',
  'Steeds duizelig bij opstaan sinds de nieuwe tablet',
  'Jeukende plekjes op de rug, worden groter',
  'Zou graag de bloeddrukmedicatie bespreken',
  'Mijn suikers thuis zijn hoger dan normaal',
];

const ZELFZORGADVIEZEN: Record<string, { urgentie: Urgentie; bestemming: Bestemming; toelichting: string }> = {
  keel: { urgentie: 'zelfzorg', bestemming: 'zelfzorg',
    toelichting: 'Geen alarmsignalen. Zelfzorgadvies gegeven; contact bij koorts boven 3 dagen.' },
  uitslag: { urgentie: 'deze-week', bestemming: 'assistent',
    toelichting: 'Geen koorts, geen uitbreiding. Foto meegestuurd; beoordeling deze week volstaat.' },
  duizelig: { urgentie: 'vandaag', bestemming: 'huisarts',
    toelichting: 'Klachten sinds start nieuwe medicatie — beoordeling vandaag gewenst.' },
  suikers: { urgentie: 'deze-week', bestemming: 'poh-s',
    toelichting: 'Thuiswaarden verhoogd zonder alarmsignalen; hoort bij de POH.' },
};

function zelftriageVoor(hulpvraag: string) {
  for (const [sleutel, uitkomst] of Object.entries(ZELFZORGADVIEZEN)) {
    if (hulpvraag.toLowerCase().includes(sleutel)) return uitkomst;
  }
  return { urgentie: 'deze-week' as Urgentie, bestemming: 'assistent' as Bestemming,
    toelichting: 'Geen alarmsignalen in de vragenlijst; afspraak binnen een week voorgesteld.' };
}

const MIDDELEN_HERHAAL = [
  'Metformine 500mg', 'Simvastatine 40mg', 'Ramipril 5mg', 'Omeprazol 20mg',
  'Salbutamol inhalatie', 'Levothyroxine 75mcg', 'Amlodipine 5mg', 'Paracetamol 500mg',
];

/** Bepalingen met een plausibele waarde, binnen en buiten de referentie. */
const BEPALINGEN: { naam: string; eenheid: string; normaal: [number, number]; afwijkend: [number, number] }[] = [
  { naam: 'Hb', eenheid: 'mmol/l', normaal: [7.8, 9.4], afwijkend: [5.9, 7.2] },
  { naam: 'HbA1c', eenheid: 'mmol/mol', normaal: [42, 52], afwijkend: [66, 89] },
  { naam: 'eGFR', eenheid: 'ml/min', normaal: [68, 96], afwijkend: [28, 44] },
  { naam: 'LDL-cholesterol', eenheid: 'mmol/l', normaal: [1.4, 2.4], afwijkend: [3.6, 5.1] },
  { naam: 'TSH', eenheid: 'mU/l', normaal: [0.6, 3.8], afwijkend: [6.4, 12.8] },
  { naam: 'Kalium', eenheid: 'mmol/l', normaal: [3.7, 4.8], afwijkend: [5.4, 6.1] },
];

function naamVan(dossier: Dossier): string {
  const n = dossier.patient.naam;
  return [n.voornaam, n.tussenvoegsel, n.achternaam].filter(Boolean).join(' ');
}

function tijd(peildatum: Date, uur: number, minuut: number): string {
  const d = new Date(peildatum);
  d.setHours(uur, minuut, 0, 0);
  return d.toISOString();
}

/** Triage-instroom van vandaag: telefonisch én digitaal, in één stroom. */
export function genereerTriage(praktijk: Praktijk, zaad = 7): Triageverzoek[] {
  const willekeurig = rng(zaad);
  const verzoeken: Triageverzoek[] = [];
  const kandidaten = praktijk.dossiers;

  for (let i = 0; i < 14; i++) {
    const dossier = kandidaten[Math.floor(willekeurig() * kandidaten.length)];
    const viaPortaal = willekeurig() < 0.45 && dossier.patient.portaalActief;
    const hulpvraag = viaPortaal
      ? HULPVRAGEN_PORTAAL[Math.floor(willekeurig() * HULPVRAGEN_PORTAAL.length)]
      : HULPVRAGEN_TELEFOON[Math.floor(willekeurig() * HULPVRAGEN_TELEFOON.length)];

    const geboren = new Date(dossier.patient.geboortedatum);
    const leeftijd = praktijk.peildatum.getFullYear() - geboren.getFullYear();

    verzoeken.push({
      id: `triage-${i + 1}`,
      patientId: dossier.patient.id,
      naam: naamVan(dossier),
      leeftijd,
      binnenOp: tijd(praktijk.peildatum, 8, 5 + i * 7),
      kanaal: viaPortaal ? 'portaal' : willekeurig() < 0.15 ? 'balie' : 'telefoon',
      hulpvraag,
      zelftriage: viaPortaal ? zelftriageVoor(hulpvraag) : undefined,
      status: 'nieuw',
    });
  }
  return verzoeken.sort((a, b) => a.binnenOp.localeCompare(b.binnenOp));
}

/**
 * Autorisatieverzoeken. Bewust in de orde van grootte die een echte praktijk kent —
 * in Bricks Huisarts staat de teller in de screenshot op 163 (docs/10 §3.1).
 * Het verschil zit niet in het aantal maar in wat je ermee kunt.
 */
export function genereerAutorisaties(praktijk: Praktijk, zaad = 11): Autorisatieverzoek[] {
  const willekeurig = rng(zaad);
  const verzoeken: Autorisatieverzoek[] = [];
  const kandidaten = praktijk.dossiers;
  const kies = <T,>(l: T[]): T => l[Math.floor(willekeurig() * l.length)];

  const maak = (
    i: number, soort: AutorisatieSoort, omschrijving: string, aanleiding: string,
    door: { naam: string; rol: Rol }, routine: boolean, reden?: string,
  ): Autorisatieverzoek => {
    const dossier = kies(kandidaten);
    return {
      id: `aut-${soort}-${i}`,
      patientId: dossier.patient.id,
      naam: naamVan(dossier),
      soort, omschrijving, aanleiding,
      ingediendDoor: door,
      ingediendOp: tijd(praktijk.peildatum, 8 + (i % 6), (i * 13) % 60),
      routine,
      redenGeenRoutine: reden,
      status: 'open',
    };
  };

  const assistent = { naam: 'Ilse Hendriks', rol: 'assistent' as Rol };
  const poh = { naam: 'Sanne Bakker', rol: 'poh-s' as Rol };
  const systeem = { naam: 'Aanvraagportaal', rol: 'systeem' as Rol };

  // Herhaalrecepten: het leeuwendeel, vrijwel allemaal routine.
  for (let i = 0; i < 84; i++) {
    const middel = kies(MIDDELEN_HERHAAL);
    const bijzonder = willekeurig() < 0.07;
    verzoeken.push(maak(i, 'herhaalrecept', `${middel} — herhaling 3 maanden`,
      bijzonder
        ? `Aanvraag via portaal; laatste controle is meer dan 15 maanden geleden.`
        : `Aanvraag via portaal; chronisch gebruik, laatste controle binnen termijn.`,
      systeem, !bijzonder,
      bijzonder ? 'controle verlopen — verlengen zonder afspraak is niet passend' : undefined));
  }

  // Labuitslagen: meeste binnen referentie. Met de werkelijke waarde erbij, want een
  // uitslag zonder getal is geen uitslag.
  for (let i = 0; i < 46; i++) {
    const bepaling = kies(BEPALINGEN);
    const afwijkend = willekeurig() < 0.22;
    const [laag, hoog] = afwijkend ? bepaling.afwijkend : bepaling.normaal;
    const decimalen = bepaling.eenheid === 'mmol/mol' || bepaling.eenheid === 'ml/min' ? 0 : 1;
    const waarde = (laag + willekeurig() * (hoog - laag)).toFixed(decimalen);
    const vorige = (laag + willekeurig() * (hoog - laag) + (afwijkend ? -(hoog - laag) * 0.7 : 0))
      .toFixed(decimalen);

    verzoeken.push(maak(i, 'labuitslag', `${bepaling.naam} ${waarde} ${bepaling.eenheid}`,
      afwijkend
        ? `Buiten referentiewaarde en gestegen ten opzichte van ${vorige} bij de vorige bepaling.`
        : `Binnen referentiewaarde en stabiel ten opzichte van ${vorige} bij de vorige bepaling.`,
      systeem, !afwijkend,
      afwijkend ? 'afwijkende waarde met verandering ten opzichte van eerder' : undefined));
  }

  // Registraties van de POH die de huisarts formeel accordeert.
  for (let i = 0; i < 18; i++) {
    const medicatie = willekeurig() < 0.28;
    verzoeken.push(maak(i, medicatie ? 'medicatiewijziging' : 'poh-registratie',
      medicatie ? 'Voorstel ophogen bloeddrukmedicatie' : 'Chronische controle vastgelegd',
      medicatie
        ? 'POH stelt ophoging voor op basis van een thuismeetreeks; medicatiewijziging valt buiten haar bevoegdheid.'
        : 'Controle volgens protocol uitgevoerd en vastgelegd; geen afwijkingen.',
      poh, !medicatie,
      medicatie ? 'medicatiewijziging vraagt een arts' : undefined));
  }

  // Binnengekomen post en verwijzingen.
  for (let i = 0; i < 15; i++) {
    const relevant = willekeurig() < 0.35;
    verzoeken.push(maak(i, 'brief', 'Specialistenbrief ontvangen',
      relevant
        ? 'Brief bevat een gewijzigd medicatieadvies dat nog niet in het dossier staat.'
        : 'Brief bevestigt bekend beleid; geen wijzigingen ten opzichte van het dossier.',
      assistent, !relevant,
      relevant ? 'bevat een medicatieadvies dat moet worden overgenomen' : undefined));
  }

  return verzoeken;
}

const ASSISTENT_BLOKKEN = [
  { uur: 8, minuut: 0, duur: 60, titel: 'Telefonisch spreekuur', soort: 'blok' },
  { uur: 11, minuut: 0, duur: 30, titel: 'Uitslagen en post routeren', soort: 'blok' },
  { uur: 15, minuut: 30, duur: 45, titel: 'Terugbellen en herhaalrecepten', soort: 'blok' },
];

const ASSISTENT_VERRICHTINGEN = [
  'Bloeddrukmeting', 'Injectie', 'Oren uitspuiten', 'Wratten aanstippen',
  'Uitstrijkje', 'Wondcontrole', 'Hechtingen verwijderen', 'Bloedafname',
];

const HUISARTS_REDENEN = [
  'Hoesten met koorts', 'Buikpijn', 'Moeheid', 'Huidafwijking beoordelen',
  'Gewrichtsklachten', 'Somberheid', 'Duizeligheid', 'Controle na ziekenhuisopname',
  'Uitslag bespreken', 'Rugklachten',
];

/** De agenda van alle drie de rollen op één dag. */
export function genereerAgenda(praktijk: Praktijk, zaad = 21): AgendaItem[] {
  const willekeurig = rng(zaad);
  const items: AgendaItem[] = [];
  const kandidaten = praktijk.dossiers;
  const kies = <T,>(l: T[]): T => l[Math.floor(willekeurig() * l.length)];

  // Doktersassistent: blokken plus losse verrichtingen aan de balie.
  for (const blok of ASSISTENT_BLOKKEN) {
    items.push({
      id: `ag-as-blok-${blok.uur}`,
      start: tijd(praktijk.peildatum, blok.uur, blok.minuut),
      duurMinuten: blok.duur, rol: 'assistent', soort: blok.soort,
      titel: blok.titel, status: 'gepland',
    });
  }
  for (let i = 0; i < 8; i++) {
    const dossier = kies(kandidaten);
    const uur = 9 + Math.floor(i / 2);
    items.push({
      id: `ag-as-${i}`,
      start: tijd(praktijk.peildatum, uur, (i % 2) * 20 + 10),
      duurMinuten: 10, rol: 'assistent',
      patientId: dossier.patient.id, naam: naamVan(dossier),
      soort: 'verrichting', titel: kies(ASSISTENT_VERRICHTINGEN),
      status: 'gepland',
    });
  }

  // Huisarts: spreekuur van tien minuten, visites en een telefonisch spreekuur.
  const tijden: [number, number][] = [
    [8, 30], [8, 40], [8, 50], [9, 0], [9, 10], [9, 20], [9, 30], [9, 40],
    [10, 0], [10, 10], [10, 20], [10, 30],
    [13, 30], [13, 40], [13, 50], [14, 0], [14, 10], [14, 20],
  ];
  tijden.forEach(([uur, minuut], i) => {
    const dossier = kies(kandidaten);
    const eConsult = willekeurig() < 0.18;
    items.push({
      id: `ag-ha-${i}`,
      start: tijd(praktijk.peildatum, uur, minuut),
      duurMinuten: eConsult ? 5 : 10, rol: 'huisarts',
      patientId: dossier.patient.id, naam: naamVan(dossier),
      soort: eConsult ? 'e-consult' : 'consult',
      titel: eConsult ? 'E-consult' : 'Consult',
      reden: kies(HUISARTS_REDENEN),
      status: 'gepland',
    });
  });
  items.push({
    id: 'ag-ha-visite',
    start: tijd(praktijk.peildatum, 12, 0), duurMinuten: 60, rol: 'huisarts',
    soort: 'blok', titel: 'Visites', status: 'gepland',
  });
  items.push({
    id: 'ag-ha-overleg',
    start: tijd(praktijk.peildatum, 11, 0), duurMinuten: 30, rol: 'huisarts',
    soort: 'blok', titel: 'Overleg met POH en assistent', status: 'gepland',
  });

  return items.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Wat een ingebedde partnerapp oplevert.
 *
 * De patiënt doet in de wachtkamer een gesproken voorbereiding; die komt terug als
 * gestructureerde anamnese met codesuggesties. Cruciaal: dit is en blijft een
 * *suggestie* van een externe partij. Het draagt herkomst, het telt nergens in mee
 * zolang het niet bevestigd is, en de zorgverlener ziet aan wie het heeft vastgelegd
 * (docs/03 §3). Zonder dat onderscheid is naadloze integratie hetzelfde als
 * ongecontroleerd vertrouwen.
 */
export interface WachtkamerIntake {
  id: string;
  patientId: string;
  naam: string;
  app: { id: string; naam: string; leverancier: string };
  opgenomenOp: string;
  duurSeconden: number;
  hulpvraag: string;
  anamnese: string;
  codesuggesties: { icpc: string; display: string; vertrouwen: number }[];
  metingen: { code: string; naam: string; waarde: number; eenheid: string }[];
  bevestigd: boolean;
}

const INTAKES: Omit<WachtkamerIntake, 'id' | 'patientId' | 'naam' | 'app' | 'opgenomenOp' | 'bevestigd'>[] = [
  {
    duurSeconden: 138,
    hulpvraag: 'Ik ben de laatste weken sneller moe en mijn voeten tintelen ’s avonds.',
    anamnese:
      'Sinds ongeveer zes weken toenemende vermoeidheid. Tintelingen in beide voeten, vooral ’s avonds ' +
      'en in bed, geen pijn. Loopt nog dagelijks een half uur. Drinkt meer dan voorheen. Gebruikt de ' +
      'metformine trouw, soms ’s avonds vergeten. Geen koorts, geen wondjes aan de voeten opgemerkt.',
    codesuggesties: [
      { icpc: 'T90.02', display: 'Diabetes mellitus type 2', vertrouwen: 0.94 },
      { icpc: 'N05', display: 'Tintelende vingers/voeten/tenen', vertrouwen: 0.81 },
      { icpc: 'A04', display: 'Moeheid/zwakte', vertrouwen: 0.72 },
    ],
    metingen: [{ code: '29463-7', naam: 'Gewicht', waarde: 84.2, eenheid: 'kg' }],
  },
  {
    duurSeconden: 96,
    hulpvraag: 'Mijn bloeddruk thuis is de laatste tijd hoger, ik maak me er zorgen over.',
    anamnese:
      'Meet zelf twee keer per week. Waarden de laatste twee weken rond 155/90, voorheen rond 135/80. ' +
      'Geen hoofdpijn, geen visusklachten, geen pijn op de borst. Neemt de medicatie zoals afgesproken. ' +
      'Sinds een maand meer werkdruk en slechter slapen.',
    codesuggesties: [
      { icpc: 'K86', display: 'Hypertensie zonder orgaanbeschadiging', vertrouwen: 0.91 },
      { icpc: 'P06', display: 'Slapeloosheid', vertrouwen: 0.64 },
    ],
    metingen: [
      { code: '8480-6', naam: 'Bloeddruk systolisch', waarde: 155, eenheid: 'mmHg' },
      { code: '8462-4', naam: 'Bloeddruk diastolisch', waarde: 90, eenheid: 'mmHg' },
    ],
  },
  {
    duurSeconden: 174,
    hulpvraag: 'Ik word ’s nachts wakker van het hoesten en ben benauwder bij het traplopen.',
    anamnese:
      'Toename van hoesten sinds ongeveer tien dagen, vooral ’s nachts. Meer slijm dan gebruikelijk, ' +
      'kleur niet veranderd. Benauwd bij traplopen, moet halverwege stoppen. Gebruikt de luchtwegverwijder ' +
      'vaker dan voorgeschreven. Geen koorts. Rookt nog ongeveer tien sigaretten per dag.',
    codesuggesties: [
      { icpc: 'R95', display: 'Chronische bronchitis/COPD', vertrouwen: 0.89 },
      { icpc: 'R05', display: 'Hoesten', vertrouwen: 0.85 },
      { icpc: 'P17', display: 'Tabaksmisbruik', vertrouwen: 0.78 },
    ],
    metingen: [],
  },
];

/** Wachtkamer-intakes van vandaag, gekoppeld aan patiënten die op het spreekuur staan. */
export function genereerIntakes(
  praktijk: Praktijk, agendaItems: AgendaItem[], app: { id: string; naam: string; leverancier: string },
): WachtkamerIntake[] {
  const metPatient = agendaItems.filter((a) => a.patientId);
  return INTAKES.flatMap((sjabloon, i) => {
    const item = metPatient[i * 3];
    if (!item?.patientId) return [];
    const dossier = praktijk.dossiers.find((d) => d.patient.id === item.patientId);
    if (!dossier) return [];
    const start = new Date(item.start);
    start.setMinutes(start.getMinutes() - 12);
    return [{
      ...sjabloon,
      id: `intake-${i + 1}`,
      patientId: item.patientId,
      naam: item.naam ?? naamVan(dossier),
      app,
      opgenomenOp: start.toISOString(),
      bevestigd: false,
    }];
  });
}

/** Groepeert autorisatieverzoeken zoals een mens ze wil zien: op soort, routine apart. */
export interface Autorisatiegroep {
  soort: AutorisatieSoort;
  titel: string;
  toelichting: string;
  routine: Autorisatieverzoek[];
  vraagtOordeel: Autorisatieverzoek[];
}

const GROEPTITELS: Record<AutorisatieSoort, { titel: string; toelichting: string }> = {
  herhaalrecept: { titel: 'Herhaalrecepten',
    toelichting: 'Chronisch gebruik met een controle binnen de termijn kan in één handeling.' },
  labuitslag: { titel: 'Labuitslagen',
    toelichting: 'Waarden binnen referentie en stabiel ten opzichte van eerder.' },
  brief: { titel: 'Binnengekomen post',
    toelichting: 'Brieven die bekend beleid bevestigen vragen geen actie.' },
  'poh-registratie': { titel: 'Registraties van de POH',
    toelichting: 'Controles volgens protocol, zonder afwijkingen.' },
  medicatiewijziging: { titel: 'Medicatiewijzigingen',
    toelichting: 'Valt buiten de bevoegdheid van de POH en vraagt altijd een arts.' },
  verwijzing: { titel: 'Verwijzingen', toelichting: 'Verwijzingen ter accordering.' },
};

export function groepeerAutorisaties(verzoeken: Autorisatieverzoek[]): Autorisatiegroep[] {
  const open = verzoeken.filter((v) => v.status === 'open');
  const soorten = [...new Set(open.map((v) => v.soort))];
  return soorten
    .map((soort) => ({
      soort,
      titel: GROEPTITELS[soort].titel,
      toelichting: GROEPTITELS[soort].toelichting,
      routine: open.filter((v) => v.soort === soort && v.routine),
      vraagtOordeel: open.filter((v) => v.soort === soort && !v.routine),
    }))
    .sort((a, b) => b.vraagtOordeel.length - a.vraagtOordeel.length);
}
