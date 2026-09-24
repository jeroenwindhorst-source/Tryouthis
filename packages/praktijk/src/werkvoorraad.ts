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

/**
 * De toestand van een afspraak op de dag zelf.
 *
 * Dit is geen administratief veld maar het antwoord op de vraag die een zorgverlener de
 * hele ochtend stelt: zit hij er al? Een agenda die alleen tijden toont, dwingt je om
 * dat aan de assistent te vragen — en dat is precies het loopwerk dat een
 * aanmeldzuil zou moeten wegnemen.
 */
export type Afspraakstatus =
  | 'gepland'      // staat in de agenda, patiënt is er nog niet
  | 'aangemeld'    // heeft zich gemeld bij de zuil of aan de balie
  | 'wachtkamer'   // zit klaar om opgehaald te worden
  | 'in-consult'   // je bent met deze patiënt bezig
  | 'afgerond'     // consult vastgelegd
  | 'noshow';      // niet verschenen

export const STATUSLABEL: Record<Afspraakstatus, string> = {
  gepland: 'gepland',
  aangemeld: 'aangemeld',
  wachtkamer: 'in de wachtkamer',
  'in-consult': 'in consult',
  afgerond: 'afgerond',
  noshow: 'niet verschenen',
};

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
  status: Afspraakstatus;
  /** Hoe de patiënt zich meldde. Alleen gevuld zodra dat gebeurd is. */
  aangemeldVia?: 'aanmeldzuil' | 'balie' | 'telefonisch';
  aangemeldOm?: string;
}

/*
 * Hulpvragen, met de episode die ze veronderstellen.
 *
 * "Mijn suikers thuis zijn hoger dan normaal" bij iemand zonder diabetes in het dossier
 * is een zorgvraag die nergens op slaat zodra je doorklikt — en doorklikken is precies
 * wat de assistent doet. Een klacht die iedereen kan krijgen (een verzwikte enkel, een
 * blaasontsteking) draagt geen eis; een klacht die naar bestaande zorg verwijst wel.
 */
interface Hulpvraag {
  tekst: string;
  vereistIcpc?: string[];
  /** "Sinds de nieuwe tablet" veronderstelt dat er tabletten zijn. */
  vereistMedicatie?: boolean;
}

const HULPVRAGEN_TELEFOON: Hulpvraag[] = [
  { tekst: 'Hoesten sinds vier dagen, nu ook koorts' },
  { tekst: 'Pijn bij het plassen sinds gisteren' },
  { tekst: 'Uitslag op de arm na tuinieren' },
  { tekst: 'Bloeddrukmeter thuis geeft 175, wat nu?', vereistIcpc: ['K86', 'K87'] },
  { tekst: 'Enkel verzwikt bij het hardlopen' },
  { tekst: 'Slaapt al twee weken slecht, piekert veel' },
  { tekst: 'Oor zit dicht sinds het zwemmen' },
  { tekst: 'Rugpijn sinds tillen, straalt uit naar het been' },
  { tekst: 'Wond aan de voet die niet geneest', vereistIcpc: ['T90'] },
  { tekst: 'Wil graag een herhaalrecept voor de pufjes', vereistIcpc: ['R95', 'R96'] },
];

const HULPVRAGEN_PORTAAL: Hulpvraag[] = [
  { tekst: 'Al een week keelpijn, nu ook slikklachten' },
  { tekst: 'Vraag over de uitslag van het bloedonderzoek', vereistIcpc: ['T90', 'K86', 'U99', 'T93'] },
  { tekst: 'Steeds duizelig bij opstaan sinds de nieuwe tablet', vereistMedicatie: true },
  { tekst: 'Jeukende plekjes op de rug, worden groter' },
  { tekst: 'Zou graag de bloeddrukmedicatie bespreken', vereistIcpc: ['K86', 'K87'] },
  { tekst: 'Mijn suikers thuis zijn hoger dan normaal', vereistIcpc: ['T90'] },
  // Drie vragen zonder voorwaarde, zodat er voor elk dossier iets passends overblijft.
  { tekst: 'Blauwe plek op mijn been zonder dat ik me gestoten heb' },
  { tekst: 'Al twee weken hoofdpijn aan het eind van de dag' },
  { tekst: 'Mag ik met deze klachten naar de fysiotherapeut?' },
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

/**
 * Een tijdstip op de praktijkdag.
 *
 * Bewust met een vaste offset en niet als UTC-instant. De agenda van een praktijk is een
 * *wandklok*: een afspraak van kwart voor negen is kwart voor negen, waar de server ook
 * staat. Toen dit als `toISOString()` werd opgeslagen en de afspraken uit de populatie
 * met `+02:00`, stonden er twee conventies door elkaar in dezelfde lijst — en daardoor
 * stond het halve spreekuur ten onrechte op 'afgerond'.
 */
function tijd(peildatum: Date, uur: number, minuut: number): string {
  const dag = peildatum.toISOString().slice(0, 10);
  const tweecijferig = (n: number) => String(n).padStart(2, '0');
  // Minuten die over het uur heen lopen, rollen door. Zonder deze twee regels levert
  // een reeks als "8 uur + i × 7 minuten" tijdstippen op als 08:61 en 08:96 — en een
  // demo waarin de klok niet klopt, is een demo waarin niets meer klopt.
  const totaal = uur * 60 + minuut;
  return `${dag}T${tweecijferig(Math.floor(totaal / 60) % 24)}:${tweecijferig(totaal % 60)}:00+02:00`;
}

/** Minuten sinds middernacht, gelezen van de wandklok in de tijdstempel zelf. */
function minutenOpDeDag(tijdstempel: string): number {
  return Number(tijdstempel.slice(11, 13)) * 60 + Number(tijdstempel.slice(14, 16));
}

/** Triage-instroom van vandaag: telefonisch én digitaal, in één stroom. */
export function genereerTriage(
  praktijk: Praktijk, zaad = 7, alElders: Set<string> = new Set(),
): Triageverzoek[] {
  const willekeurig = rng(zaad);
  const verzoeken: Triageverzoek[] = [];
  const kandidaten = praktijk.dossiers.filter((d) => !alElders.has(d.patient.id));

  // Eén patiënt komt hoogstens één keer in de ochtendstroom voor. Dezelfde mevrouw die
  // binnen zeven minuten twee keer belt over twee verschillende klachten, leidt in een
  // demo de aandacht af van waar het over gaat.
  const alGebeld = new Set<string>();
  const alGevraagd = new Set<string>();
  const heeft = (dossier: Dossier, vraag: Hulpvraag) => {
    if (vraag.vereistMedicatie && !dossier.medicatie.some((m) => m.status === 'active')) return false;
    if (!vraag.vereistIcpc) return true;
    return dossier.episodes
      .filter((e) => e.status === 'active')
      .some((e) => (e.code.coding ?? []).some((c) =>
        vraag.vereistIcpc!.some((p) => c.code.startsWith(p))));
  };

  /*
   * De ochtendstroom dekt alle vier de triage-uitkomsten.
   *
   * De digitale triage kan uitkomen op zelfzorg, op de assistent, op de POH of op de
   * huisarts, en dat onderscheid is het hele punt van één triagemodel voor twee kanalen.
   * Met puur loten zat er geregeld geen enkele POH- of huisartsroute in de lijst, en dan
   * is er niets te zien. Deze vier gaan daarom vooraan, elk bij iemand bij wie de klacht
   * kán kloppen; de rest van de ochtend wordt daarna geloot zoals altijd.
   */
  const etalage = [
    'Mijn suikers thuis zijn hoger dan normaal',      // → POH
    'Steeds duizelig bij opstaan sinds de nieuwe tablet', // → huisarts, vandaag
    'Jeukende plekjes op de rug, worden groter',      // → assistent, deze week
    'Al een week keelpijn, nu ook slikklachten',      // → zelfzorg
  ].map((tekst) => HULPVRAGEN_PORTAAL.find((h) => h.tekst === tekst)!);

  const kiesVoor = (vraag: Hulpvraag, moetPortaal: boolean) => kandidaten.find((d) =>
    !alGebeld.has(d.patient.id)
    && (!moetPortaal || d.patient.portaalActief)
    && heeft(d, vraag));

  for (let i = 0; i < 14; i++) {
    const etalagevraag = etalage[i];
    let dossier = etalagevraag
      ? kiesVoor(etalagevraag, true)
      : kandidaten[Math.floor(willekeurig() * kandidaten.length)];
    if (!dossier) dossier = kandidaten[Math.floor(willekeurig() * kandidaten.length)];
    for (let poging = 0; alGebeld.has(dossier.patient.id) && poging < kandidaten.length; poging++) {
      dossier = kandidaten[(kandidaten.indexOf(dossier) + 1) % kandidaten.length];
    }
    alGebeld.add(dossier.patient.id);
    const viaPortaal = etalagevraag
      ? true
      : willekeurig() < 0.45 && dossier.patient.portaalActief;

    // Eerst loten, dan doorschuiven tot de klacht bij dit dossier kán horen én nog niet
    // eerder die ochtend voorbijkwam. Drie keer "hoesten met koorts" onder elkaar leest
    // als een kopieerfout, ook als het toeval is.
    const lijst = viaPortaal ? HULPVRAGEN_PORTAAL : HULPVRAGEN_TELEFOON;
    const start = Math.floor(willekeurig() * lijst.length);
    let keuze = etalagevraag;
    if (!keuze) {
      for (let stap = 0; stap < lijst.length; stap++) {
        const kandidaat = lijst[(start + stap) % lijst.length];
        if (heeft(dossier, kandidaat) && !alGevraagd.has(kandidaat.tekst)) {
          keuze = kandidaat;
          break;
        }
      }
    }
    // Is alles al een keer langsgekomen, dan telt alleen nog of het dossier past.
    for (let stap = 0; !keuze && stap < lijst.length; stap++) {
      const kandidaat = lijst[(start + stap) % lijst.length];
      if (heeft(dossier, kandidaat)) keuze = kandidaat;
    }
    const hulpvraag = (keuze ?? lijst[start]).tekst;
    alGevraagd.add(hulpvraag);

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
  // Het teamoverleg staat bij alle drie de rollen op hetzelfde moment in de agenda.
  // Eén blok in één agenda is geen afspraak maar een voornemen.
  for (const rol of ['huisarts', 'poh-s', 'assistent'] as Rol[]) {
    items.push({
      id: `ag-overleg-${rol}`,
      start: tijd(praktijk.peildatum, 11, 0), duurMinuten: 30, rol,
      soort: 'overleg', titel: 'Overleg met het team', status: 'gepland',
      reden: 'Patiënten van de bespreeklijst doorlopen',
    });
  }

  // De POH begint met voorbereiden. Dat is werk en hoort dus tijd in de agenda te
  // krijgen; anders gebeurt het tussendoor en dus niet.
  items.push({
    id: 'ag-poh-voorbereiden',
    start: tijd(praktijk.peildatum, 8, 0), duurMinuten: 30, rol: 'poh-s',
    soort: 'blok', titel: 'Voorbereiding spreekuur', status: 'gepland',
    reden: 'Uitslagen, vragenlijsten en intakes van vandaag nalopen',
  });
  items.push({
    id: 'ag-poh-administratie',
    start: tijd(praktijk.peildatum, 16, 0), duurMinuten: 30, rol: 'poh-s',
    soort: 'blok', titel: 'Afronden en uitwerken', status: 'gepland',
  });

  return zetDagstatus(items.sort((a, b) => a.start.localeCompare(b.start)), praktijk.peildatum);
}

/**
 * De dag zoals hij er halverwege de ochtend uitziet.
 *
 * Een demo waarin alles 'gepland' staat, laat juist niet zien waar dit veld voor is.
 * De statussen hieronder zijn afgeleid van één vast moment op de dag — het spreekuur
 * loopt, een paar mensen zitten in de wachtkamer, één is niet komen opdagen.
 */
export const DEMO_KLOK = { uur: 10, minuut: 20 };

/**
 * Het tijdstip van een registratie die nú gebeurt.
 *
 * De demopraktijk staat stil op 10:20. Een contact dat je tijdens een demonstratie
 * vastlegt, hoort op dat moment in het journaal te landen en niet op de kloktijd van de
 * server — anders staat er ineens een telefonisch consult om 03:37 tussen een spreekuur
 * dat om 08:40 begon, en klopt de volgorde van het journaal niet meer met het verhaal.
 *
 * De seconden en milliseconden blijven echt, zodat twee registraties achter elkaar nog
 * steeds in de goede volgorde staan.
 */
export function demoNu(peildatum: Date): string {
  const tweecijferig = (n: number) => String(n).padStart(2, '0');
  const echt = new Date();
  return `${peildatum.toISOString().slice(0, 10)}T`
    + `${tweecijferig(DEMO_KLOK.uur)}:${tweecijferig(DEMO_KLOK.minuut)}:`
    + `${tweecijferig(echt.getSeconds())}.${String(echt.getMilliseconds()).padStart(3, '0')}Z`;
}

export function zetDagstatus(items: AgendaItem[], peildatum: Date): AgendaItem[] {
  const nu = DEMO_KLOK.uur * 60 + DEMO_KLOK.minuut;
  const dag = peildatum.toISOString().slice(0, 10);
  const tweecijferig = (n: number) => String(n).padStart(2, '0');
  const klok = (minuten: number) =>
    `${dag}T${tweecijferig(Math.floor(minuten / 60))}:${tweecijferig(minuten % 60)}:00+02:00`;

  const perRol = new Map<string, number>();
  return items.map((item) => {
    if (!item.patientId) return item;
    const start = minutenOpDeDag(item.start);
    const eind = start + item.duurMinuten;
    const teller = (perRol.get(item.rol) ?? 0) + 1;
    perRol.set(item.rol, teller);

    if (eind <= nu) {
      // Eén no-show per rol, zodat het geval bestaat zonder de dag te vullen.
      if (teller === 3) return { ...item, status: 'noshow' as const };
      return { ...item, status: 'afgerond' as const,
        aangemeldVia: 'aanmeldzuil' as const, aangemeldOm: klok(Math.max(0, start - 9)) };
    }
    if (start <= nu) {
      return { ...item, status: 'in-consult' as const,
        aangemeldVia: 'aanmeldzuil' as const, aangemeldOm: klok(Math.max(0, start - 11)) };
    }
    if (start - nu <= 12) {
      return { ...item, status: 'wachtkamer' as const,
        aangemeldVia: 'aanmeldzuil' as const, aangemeldOm: klok(nu - 2) };
    }
    if (start - nu <= 25) {
      return { ...item, status: 'aangemeld' as const,
        aangemeldVia: teller % 2 === 0 ? 'balie' as const : 'aanmeldzuil' as const,
        aangemeldOm: klok(nu - 6) };
    }
    return item;
  });
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
  /** Waar de voorbereiding is gedaan. Thuis betekent: meer tijd, en de partner zat erbij. */
  waar: 'wachtkamer' | 'thuis';
  duurSeconden: number;
  hulpvraag: string;
  anamnese: string;
  codesuggesties: { icpc: string; display: string; vertrouwen: number }[];
  metingen: { code: string; naam: string; waarde: number; eenheid: string }[];
  bevestigd: boolean;
}

/**
 * De voorbereidingen, elk met de episode die het dossier moet hebben.
 *
 * Een gesproken voorbereiding over "ik gebruik de metformine trouw" bij iemand zonder
 * diabetes in het dossier is niet alleen onzin, het ondermijnt precies wat deze functie
 * moet laten zien: dat een partnerapp gestructureerde, controleerbare tekst oplevert.
 * Waar de klacht nieuw is — een blaasontsteking, somberheid, de partner die vergeetachtig
 * wordt — hoort er juist géén eis te staan.
 */
const INTAKES: (Omit<WachtkamerIntake, 'id' | 'patientId' | 'naam' | 'app' | 'opgenomenOp' | 'bevestigd'>
  & { vereistIcpc?: string[] })[] = [
  {
    waar: 'wachtkamer',
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
    vereistIcpc: ['T90'],
  },
  {
    waar: 'thuis',
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
    vereistIcpc: ['K86', 'K87'],
  },
  {
    waar: 'wachtkamer',
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
    vereistIcpc: ['R95', 'R96'],
  },

  {
    waar: 'thuis',
    duurSeconden: 211,
    hulpvraag: 'Mijn man vergeet steeds meer en ik weet niet goed wat ik ermee moet.',
    anamnese:
      'Voorbereiding thuis gedaan, echtgenote voerde het woord. Sinds ongeveer een jaar toenemende ' +
      'vergeetachtigheid: herhaalt vragen, vergeet afspraken, laat het gas aan staan. Kan zich nog wel ' +
      'zelfstandig wassen en aankleden. Boodschappen lukt niet meer alleen. Geen wegrakingen, geen ' +
      'krachtsverlies. Slaapt slecht, ’s nachts onrustig. Echtgenote geeft aan het zwaar te hebben.',
    codesuggesties: [
      { icpc: 'P70', display: 'Dementie', vertrouwen: 0.68 },
      { icpc: 'P20', display: 'Geheugen-/concentratie-/oriëntatiestoornis', vertrouwen: 0.86 },
      { icpc: 'Z14', display: 'Ziekte partner', vertrouwen: 0.59 },
    ],
    metingen: [],
  },

  {
    waar: 'wachtkamer',
    duurSeconden: 84,
    hulpvraag: 'Ik heb al drie dagen pijn bij het plassen en moet steeds naar het toilet.',
    anamnese:
      'Sinds drie dagen pijnlijke, frequente mictie met loze aandrang. Geen koorts, geen flankpijn, ' +
      'geen bloed bij de urine gezien. Niet eerder blaasontsteking gehad dit jaar. Drinkt weinig. ' +
      'Geen zwangerschap, geen relevante medicatie.',
    codesuggesties: [
      { icpc: 'U71', display: 'Cystitis/urineweginfectie', vertrouwen: 0.92 },
      { icpc: 'U02', display: 'Frequente/pijnlijke mictie', vertrouwen: 0.88 },
    ],
    metingen: [{ code: '8310-5', naam: 'Temperatuur', waarde: 36.9, eenheid: '°C' }],
  },

  {
    waar: 'thuis',
    duurSeconden: 165,
    hulpvraag: 'Ik voel me al maanden somber en kom nergens meer toe.',
    anamnese:
      'Sinds ongeveer vier maanden somberheid, vrijwel dagelijks. Weinig plezier in dingen die eerder ' +
      'wel plezier gaven. Slaapt slecht in en wordt vroeg wakker. Eetlust verminderd, enkele kilo’s ' +
      'afgevallen. Werkt nog, maar functioneert moeizaam. Geen gedachten aan zelfdoding, desgevraagd ' +
      'expliciet ontkend. Drinkt drie tot vier glazen alcohol per avond, is toegenomen.',
    codesuggesties: [
      { icpc: 'P76', display: 'Depressieve stoornis', vertrouwen: 0.83 },
      { icpc: 'P06', display: 'Slapeloosheid', vertrouwen: 0.74 },
      { icpc: 'P15', display: 'Chronisch alcoholmisbruik', vertrouwen: 0.61 },
    ],
    metingen: [],
  },
];

/** Wachtkamer-intakes van vandaag, gekoppeld aan patiënten die op het spreekuur staan. */
export function genereerIntakes(
  praktijk: Praktijk, agendaItems: AgendaItem[], app: { id: string; naam: string; leverancier: string },
): WachtkamerIntake[] {
  const metPatient = agendaItems.filter((a) => a.patientId);
  const vergeven = new Set<string>();
  const heeft = (dossier: Dossier, prefixen: string[]) => dossier.episodes
    .filter((e) => e.status === 'active')
    .some((e) => (e.code.coding ?? []).some((c) => prefixen.some((p) => c.code.startsWith(p))));

  return INTAKES.flatMap(({ vereistIcpc, ...sjabloon }, i) => {
    // De voorbereiding komt bij iemand bij wie hij kán kloppen: een verhaal over de
    // metformine hoort bij een dossier met diabetes erin.
    const item = metPatient.find((a) => {
      if (!a.patientId || vergeven.has(a.patientId)) return false;
      if (!vereistIcpc) return true;
      const d = praktijk.dossiers.find((x) => x.patient.id === a.patientId);
      return d ? heeft(d, vereistIcpc) : false;
    });
    if (!item?.patientId) return [];
    vergeven.add(item.patientId);
    const dossier = praktijk.dossiers.find((d) => d.patient.id === item.patientId);
    if (!dossier) return [];
    const start = new Date(item.start);
    // In de wachtkamer vlak voor de afspraak; thuis de avond ervoor.
    if (sjabloon.waar === 'thuis') start.setDate(start.getDate() - 1);
    start.setMinutes(start.getMinutes() - (sjabloon.waar === 'thuis' ? -180 : 12));
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
