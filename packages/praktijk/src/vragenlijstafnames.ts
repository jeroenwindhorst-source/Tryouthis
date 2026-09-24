import type { Antwoorden } from '@zpe/care-engine';
import { rng } from './populatie.js';

/**
 * UITGEZETTE EN INGEVULDE VRAGENLIJSTEN
 *
 * Een vragenlijst die alleen als definitie bestaat, is een formulier. Wat een dossier
 * ervan moet maken, is een *afname*: uitgezet op een moment, via een kanaal, al dan niet
 * ingevuld, en met antwoorden die nog van de patiënt zijn totdat een zorgverlener ze
 * overneemt.
 *
 * Dat laatste is het hele punt. De antwoorden staan in het dossier zodra ze binnen zijn —
 * je kunt ze lezen, ze tellen mee in de voorbereiding — maar ze zijn geen eigen
 * registratie. Pas als de POH ze overneemt, worden het waarden waarvoor de praktijk
 * instaat (ADR-0012). Tot dat moment is "de patiënt zegt dat hij 30 minuten per dag
 * beweegt" iets anders dan "wij hebben vastgesteld dat hij beweegt".
 */

export type Vragenlijstkanaal = 'portaal' | 'papier' | 'wachtkamer';

export const KANAAL_LABEL: Record<Vragenlijstkanaal, string> = {
  portaal: 'via het portaal', papier: 'op papier meegenomen', wachtkamer: 'in de wachtkamer',
};

export interface Vragenlijstafname {
  id: string;
  patientId: string;
  vragenlijstId: string;
  /** Wanneer de uitnodiging de deur uit ging. */
  uitgezetOp: string;
  kanaal: Vragenlijstkanaal;
  /** Leeg zolang de patiënt hem niet heeft ingevuld — en dát is zelf informatie. */
  ingevuldOp?: string;
  antwoorden: Antwoorden;
  /** Wanneer een zorgverlener de uitkomst in het dossier heeft overgenomen. */
  overgenomenOp?: string;
  overgenomenDoor?: string;
  /** Bij welke afspraak deze lijst hoort, als hij daarvoor is uitgezet. */
  voorAfspraakOp?: string;
}

/**
 * Antwoordprofielen.
 *
 * Niet willekeurig ingevuld: elk profiel is een herkenbaar mens, en samen dekken ze de
 * uitkomsten die de regelset kan geven. Een demopopulatie waarin iedereen alles goed doet,
 * laat precies die regels niet zien waar het systeem voor gebouwd is.
 */
const PROFIELEN: { naam: string; antwoorden: Antwoorden }[] = [
  {
    naam: 'draagt het alleen',
    antwoorden: {
      'cv-bewegen': 'weinig',
      'cv-alcohol': '2-3',
      'cv-drugs': 'nee',
      'cv-stress': 'ja',
      'cv-slaap': 'nee',
      'cv-steun': 'nee',
      'cv-dagbesteding': 'nee',
      'cv-geld': 'ja',
      'cv-seksualiteit': 'liever-niet',
      'cv-cijfer': 4,
      'cv-noodkaart': 'Twee keer gebruikt toen het niet goed ging. Ik durfde niet te bellen.',
      'cv-gespreksonderwerp': 'Ik red het niet meer met de eigen bijdrage van de medicijnen. '
        + 'Ik haal ze soms niet op.',
    },
  },
  {
    naam: 'gaat goed',
    antwoorden: {
      'cv-bewegen': 'lukt',
      'cv-alcohol': '1-of-minder',
      'cv-drugs': 'nee',
      'cv-stress': 'nee',
      'cv-slaap': 'ja',
      'cv-steun': 'ja',
      'cv-dagbesteding': 'ja',
      'cv-geld': 'nee',
      'cv-seksualiteit': 'nee',
      'cv-cijfer': 8,
      'cv-noodkaart': 'Niet gebruikt.',
      'cv-gespreksonderwerp': '',
    },
  },
  {
    naam: 'werk loopt over',
    antwoorden: {
      'cv-bewegen': 'lukt-niet',
      'cv-alcohol': '4-of-meer',
      'cv-drugs': 'nee',
      'cv-stress': 'ja',
      'cv-slaap': 'nee',
      'cv-steun': 'ja',
      'cv-dagbesteding': 'nee',
      'cv-geld': 'nee',
      'cv-seksualiteit': 'weet-niet',
      'cv-cijfer': 5,
      'cv-noodkaart': 'Nog niet nodig gehad.',
      'cv-gespreksonderwerp': 'Ik wil weten of ik met deze klachten nog wel kan blijven werken.',
    },
  },
  {
    naam: 'wil minder pillen',
    antwoorden: {
      'cv-bewegen': 'lukt',
      'cv-alcohol': 'nooit',
      'cv-drugs': 'nee',
      'cv-stress': 'nee',
      'cv-slaap': 'ja',
      'cv-steun': 'ja',
      'cv-dagbesteding': 'ja',
      'cv-geld': 'nee',
      'cv-seksualiteit': 'ja',
      'cv-cijfer': 7,
      'cv-noodkaart': 'Niet gebruikt.',
      'cv-gespreksonderwerp': 'Ik slik nu zes verschillende pillen. Kan daar iets af?',
    },
  },
  {
    naam: 'zorgt voor een ander',
    antwoorden: {
      'cv-bewegen': 'weinig',
      'cv-alcohol': 'nooit',
      'cv-drugs': 'nee',
      'cv-stress': 'ja',
      'cv-slaap': 'nee',
      'cv-steun': 'nee',
      'cv-dagbesteding': 'ja',
      'cv-geld': 'weet-niet',
      'cv-seksualiteit': 'liever-niet',
      'cv-cijfer': 5,
      'cv-noodkaart': 'Eén keer, voor mijn partner.',
      'cv-gespreksonderwerp': 'Ik kom aan mezelf niet toe. Mijn partner is sinds kort veel zieker.',
    },
  },
  {
    naam: 'nuchter en tevreden',
    antwoorden: {
      'cv-bewegen': 'lukt',
      'cv-alcohol': 'nooit',
      'cv-drugs': 'nee',
      'cv-stress': 'nee',
      'cv-slaap': 'ja',
      'cv-steun': 'ja',
      'cv-dagbesteding': 'ja',
      'cv-geld': 'nee',
      'cv-seksualiteit': 'nee',
      'cv-cijfer': 9,
      'cv-noodkaart': 'Niet gebruikt.',
      'cv-gespreksonderwerp': '',
    },
  },
  {
    naam: 'mantelzorger van zichzelf',
    antwoorden: {
      'cv-bewegen': 'lukt-niet',
      'cv-alcohol': '1-of-minder',
      'cv-drugs': 'nee',
      'cv-stress': 'nee',
      'cv-slaap': 'nee',
      'cv-steun': 'ja',
      'cv-dagbesteding': 'ja',
      'cv-geld': 'nee',
      'cv-seksualiteit': 'nee',
      'cv-cijfer': 6,
      'cv-noodkaart': 'Niet gebruikt.',
      'cv-gespreksonderwerp': 'Ik word \u2019s nachts drie keer wakker om te plassen. Komt dat door de pillen?',
    },
  },
  {
    naam: 'net verhuisd',
    antwoorden: {
      'cv-bewegen': 'lukt',
      'cv-alcohol': '2-3',
      'cv-drugs': 'nee',
      'cv-stress': 'ja',
      'cv-slaap': 'ja',
      'cv-steun': 'nee',
      'cv-dagbesteding': 'ja',
      'cv-geld': 'nee',
      'cv-seksualiteit': 'nee',
      'cv-cijfer': 6,
      'cv-noodkaart': 'Niet gebruikt.',
      'cv-gespreksonderwerp': 'Ik ben net verhuisd en ken hier nog niemand.',
    },
  },
  {
    naam: 'meet zelf mee',
    antwoorden: {
      'cv-bewegen': 'lukt',
      'cv-alcohol': 'nooit',
      'cv-drugs': 'nee',
      'cv-stress': 'nee',
      'cv-slaap': 'ja',
      'cv-steun': 'ja',
      'cv-dagbesteding': 'ja',
      'cv-geld': 'nee',
      'cv-seksualiteit': 'weet-niet',
      'cv-cijfer': 7,
      'cv-noodkaart': 'Niet gebruikt.',
      'cv-gespreksonderwerp': 'Ik meet thuis zelf mijn bloeddruk. Kan dat in plaats van elke keer langskomen?',
    },
  },
];

/** Wat iemand op de jaarlijkse screening invult, afhankelijk van hoe het gaat. */
const SCREENINGPROFIELEN: { naam: string; antwoorden: Antwoorden }[] = [
  {
    naam: 'alles bij',
    antwoorden: {
      'js-lengte': 174, 'js-gewicht': 79, 'js-rr': 138, 'js-pols': 72,
      'js-roken': '266919005',
      'js-bijwerkingen': 'nee', 'js-medproblemen': 'nee', 'js-klachten': 'nee',
    },
  },
  {
    naam: 'bijwerkingen en klachten',
    antwoorden: {
      'js-lengte': 168, 'js-gewicht': 91, 'js-rr': 152, 'js-pols': 78, 'js-buik': 106,
      'js-roken': '77176002', 'js-stoppen': 'misschien',
      'js-bijwerkingen': 'ja',
      'js-medproblemen': 'ja',
      'js-medproblemen-welke': 'De waterpil laat ik weg als ik weg moet, dan moet ik steeds naar de wc.',
      'js-klachten': 'ja',
      'js-klachten-welke': 'Ik ben sneller moe bij het traplopen dan een half jaar geleden.',
      'js-oedeem': 'ja',
    },
  },
  {
    naam: 'longaanvallen',
    antwoorden: {
      'js-lengte': 181, 'js-gewicht': 68, 'js-rr': 128, 'js-pols': 84,
      'js-roken': '77176002', 'js-stoppen': 'ja',
      'js-bijwerkingen': 'nee', 'js-medproblemen': 'nee',
      'js-klachten': 'ja',
      'js-klachten-welke': 'Ik word ’s nachts wakker van het hoesten.',
      'js-longaanvallen': 3,
    },
  },
  {
    naam: 'twijfelt over de pillen',
    antwoorden: {
      'js-lengte': 165, 'js-gewicht': 74, 'js-rr': 144, 'js-pols': 70,
      'js-roken': '8517006',
      'js-bijwerkingen': 'ja',
      'js-medproblemen': 'ja',
      'js-medproblemen-welke': 'Ik ben duizelig sinds de nieuwe tablet erbij kwam.',
      'js-klachten': 'nee',
    },
  },
  {
    naam: 'wil stoppen met roken',
    antwoorden: {
      'js-lengte': 178, 'js-gewicht': 88, 'js-rr': 136, 'js-pols': 76, 'js-buik': 102,
      'js-roken': '77176002', 'js-stoppen': 'ja',
      'js-bijwerkingen': 'nee', 'js-medproblemen': 'nee', 'js-klachten': 'nee',
    },
  },
  {
    naam: 'prikplekken',
    antwoorden: {
      'js-lengte': 171, 'js-gewicht': 96, 'js-rr': 149, 'js-pols': 88,
      'js-roken': '266919005',
      'js-bijwerkingen': 'nee', 'js-medproblemen': 'nee',
      'js-klachten': 'ja',
      'js-klachten-welke': 'De plek op mijn buik waar ik prik voelt hard en bobbelig aan.',
      'js-prikplekken': 'ja',
    },
  },
  {
    naam: 'alles goed, maar moe',
    antwoorden: {
      'js-lengte': 160, 'js-gewicht': 63, 'js-rr': 131, 'js-pols': 68,
      'js-roken': '266919005',
      'js-bijwerkingen': 'nee', 'js-medproblemen': 'nee',
      'js-klachten': 'ja',
      'js-klachten-welke': 'Ik ben de hele dag moe, ook als ik goed geslapen heb.',
    },
  },
];

export interface Afnameopdracht {
  patientId: string;
  vragenlijstId: string;
  /** Datum van de afspraak waar de lijst bij hoort. */
  voorAfspraakOp?: string;
  /** Vult de patiënt hem in? Niet iedereen doet dat, en dat is de helft van het verhaal. */
  ingevuld: boolean;
  kanaal: Vragenlijstkanaal;
  /** Hoeveel dagen vóór de afspraak de lijst is uitgezet. */
  uitgezetDagenVoor: number;
  /**
   * Een met name genoemd antwoordprofiel.
   *
   * Voor het grootste deel van de praktijk mag het toeval bepalen wie welk verhaal
   * krijgt. Voor de eerste patiënten van het spreekuur niet: daar begint een demonstratie
   * mee, en dan hoort er een dossier te liggen waar iets in staat.
   */
  profiel?: string;
  /**
   * Beperking van de profielkeuze.
   *
   * Nodig omdat twee patiëntgerapporteerde bronnen niet met elkaar in tegenspraak mogen
   * zijn. Wie in de wachtkamer vertelt al maanden somber te zijn, kan in de vragenlijst
   * niet een 9 voor zijn leven hebben gegeven — dat is precies het soort tegenstrijdigheid
   * dat een demo onderuit haalt, en in een echt dossier een reden om het systeem niet meer
   * te vertrouwen.
   */
  profielUit?: string[];
}

/**
 * Bouwt de afnames. Deterministisch: dezelfde patiënt krijgt altijd hetzelfde profiel,
 * zodat een demo twee keer achter elkaar hetzelfde verhaal vertelt.
 */
export function genereerAfnames(
  opdrachten: Afnameopdracht[], peildatum: Date, zaad = 4242,
): Vragenlijstafname[] {
  const willekeurig = rng(zaad);
  /*
   * Al gebruikte profielen per vragenlijst.
   *
   * Alleen op de hash van het patiëntnummer vertrouwen werkt hier niet: de nummers
   * liggen te dicht bij elkaar en er zijn maar een handvol profielen, dus dan staan er
   * drie mensen op één ochtend met woordelijk hetzelfde verhaal. De hash bepaalt waar we
   * beginnen, daarna lopen we vooruit tot een profiel dat nog niet voorbijkwam —
   * dezelfde aanpak als bij het uitdelen van namen in de populatie.
   */
  const gebruikt = new Map<string, Set<string>>();
  const dagen = (vanaf: Date, aantal: number) => {
    const d = new Date(vanaf);
    d.setDate(d.getDate() + aantal);
    return d;
  };

  return opdrachten.flatMap((opdracht, i) => {
    const anker = opdracht.voorAfspraakOp ? new Date(opdracht.voorAfspraakOp) : peildatum;
    const uitgezet = dagen(anker, -opdracht.uitgezetDagenVoor);

    // Wat pas volgende week de deur uit gaat, bestaat vandaag nog niet. Zonder deze
    // grens ontstaan afnames die vóór hun eigen uitnodiging zijn ingevuld, en dat is
    // precies het soort onmogelijkheid dat in een demo als eerste wordt opgemerkt.
    if (uitgezet > peildatum) return [];

    // Ingevuld ergens tussen het uitzetten en vandaag. Het venster meeschuiven in plaats
    // van afkappen: anders krijgt iedereen die nog ruimte had dezelfde datum, en dat ziet
    // eruit alsof de halve praktijk vanochtend tegelijk is gaan zitten.
    const venster = Math.max(
      1,
      Math.min(
        opdracht.uitgezetDagenVoor - 1,
        Math.floor((peildatum.getTime() - uitgezet.getTime()) / 86_400_000),
      ),
    );
    const gekozen = dagen(uitgezet, 1 + Math.floor(willekeurig() * venster));
    const ingevuld = gekozen > peildatum ? peildatum : gekozen;

    // Het profiel hangt aan de patiënt, niet aan de plek in de lijst: zo krijgt dezelfde
    // mens elke keer hetzelfde verhaal, ook als de volgorde verandert, en staan er niet
    // twee buren met woordelijk dezelfde klacht onder elkaar.
    const lijst = opdracht.vragenlijstId === 'vl-jaarscreening' ? SCREENINGPROFIELEN : PROFIELEN;
    // FNV-achtige menging. Een eenvoudige som werkt hier niet: de patiëntnummers liggen
    // vlak bij elkaar, en dan krijgen buren steeds hetzelfde profiel.
    const stempel = [...opdracht.patientId].reduce(
      (hash, teken) => Math.imul(hash ^ teken.charCodeAt(0), 0x01000193), 0x811c9dc5,
    ) >>> 0;
    const pool = opdracht.profielUit
      ? lijst.filter((x) => opdracht.profielUit!.includes(x.naam))
      : lijst;
    const keuze = pool.length > 0 ? pool : lijst;
    const alGebruikt = gebruikt.get(opdracht.vragenlijstId)
      ?? gebruikt.set(opdracht.vragenlijstId, new Set()).get(opdracht.vragenlijstId)!;
    if (alGebruikt.size >= keuze.length) alGebruikt.clear();

    let gekozenProfiel = opdracht.profiel
      ? lijst.find((x) => x.naam === opdracht.profiel)
      : undefined;
    if (!gekozenProfiel) {
      const start = stempel % keuze.length;
      for (let stap = 0; stap < keuze.length; stap++) {
        const kandidaat = keuze[(start + stap) % keuze.length];
        if (!alGebruikt.has(kandidaat.naam)) { gekozenProfiel = kandidaat; break; }
      }
    }
    const profiel = gekozenProfiel ?? keuze[stempel % keuze.length];
    alGebruikt.add(profiel.naam);

    return [{
      id: `afname-${opdracht.patientId}-${i + 1}`,
      patientId: opdracht.patientId,
      vragenlijstId: opdracht.vragenlijstId,
      uitgezetOp: uitgezet.toISOString(),
      kanaal: opdracht.kanaal,
      ingevuldOp: opdracht.ingevuld ? ingevuld.toISOString() : undefined,
      antwoorden: opdracht.ingevuld ? { ...profiel.antwoorden } : {},
      voorAfspraakOp: opdracht.voorAfspraakOp,
    }];
  });
}
