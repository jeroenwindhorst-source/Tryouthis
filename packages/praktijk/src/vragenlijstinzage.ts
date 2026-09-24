import {
  verwerk, vindVragenlijst, zichtbareVragen,
  type Actie, type Uitkomst, type Vraag, type Vragenlijst,
} from '@zpe/care-engine';
import { KANAAL_LABEL, type Vragenlijstafname } from './vragenlijstafnames.js';

/**
 * EEN INGEVULDE VRAGENLIJST TERUGLEZEN
 *
 * Twee dingen moeten hier tegelijk kunnen, en ze vragen een verschillende vorm.
 *
 * De POH wil de lijst in één oogopslag kunnen nalopen zoals de patiënt hem zag —
 * vraag voor vraag, in de rubrieken van het formulier. Dat is inzage, en daar hoort
 * niets samengevat of weggelaten te worden.
 *
 * En de POH wil het resultaat in het dossier kunnen zetten zonder over te typen. Dat is
 * overnemen, en dat vraagt juist het omgekeerde: geen vragenlijst maar een stuk lopende
 * tekst dat onder de S van de SOEP thuishoort, want het is wat de patiënt aangeeft.
 *
 * Beide vormen komen uit dezelfde afname. Wat níét gebeurt, is het stilletjes
 * wegschrijven van waarden in het dossier: dat blijft een handeling met een naam eraan
 * (ADR-0012).
 */

export interface AntwoordRegel {
  vraagId: string;
  /** Formulering voor de zorgverlener. */
  tekst: string;
  /** De vraag zoals de patiënt hem kreeg — daar gaat het gesprek over. */
  patientTekst?: string;
  kantlijn?: string;
  /** Leesbaar antwoord. Leeg als de patiënt deze vraag oversloeg. */
  antwoord: string;
  eenheid?: string;
  observatieCode?: string;
  /** Vrije tekst van de patiënt gaat letterlijk mee naar het journaal. */
  vrijeTekst: boolean;
  /** Dit antwoord heeft een regel laten afgaan. */
  opvallend: boolean;
}

export interface Rubriek {
  naam: string;
  regels: AntwoordRegel[];
}

export interface Vragenlijstsignaal {
  ernst: 'informatief' | 'aandacht' | 'urgent';
  tekst: string;
  onderbouwing: string;
}

export interface Overnamevoorstel {
  /** Voorgestelde tekst voor de S van de SOEP. */
  subjectief: string;
  /** Gestructureerde waarden, patiëntgerapporteerd tot de POH ze overneemt. */
  metingen: { code: string; naam: string; waarde: string | number; eenheid?: string }[];
  /** Wat de patiënt zelf op de agenda zette. */
  eigenOnderwerp?: string;
}

export interface Vragenlijstinzage {
  afnameId: string;
  patientId: string;
  vragenlijstId: string;
  naam: string;
  versie: string;
  doel: string;
  licentie?: string;
  uitgezetOp: string;
  ingevuldOp?: string;
  kanaal: string;
  status: 'ingevuld' | 'open';
  /** Hoe lang de uitnodiging al openstaat zonder dat er iets gebeurde. */
  openDagen?: number;
  overgenomenOp?: string;
  overgenomenDoor?: string;
  /**
   * De eigen woorden van de patiënt die deze afname het beste samenvatten.
   *
   * In een lijst met tien ingevulde vragenlijsten zegt 'vragenlijst ingevuld' niets, en
   * de regel die afging zegt wat het systeem vindt. Dit zegt wat de patiënt schreef, en
   * dat is wat de POH doet besluiten om er vandaag iets mee te doen.
   */
  kernzin?: string;
  rubrieken: Rubriek[];
  scores: { naam: string; waarde: number }[];
  signalen: Vragenlijstsignaal[];
  overname: Overnamevoorstel;
}

// ── Leesbaar maken ──────────────────────────────────────────────────────────

function leesbaar(vraag: Vraag, antwoord: unknown): string {
  if (antwoord === undefined || antwoord === null || antwoord === '') return '';
  if (vraag.opties) {
    return vraag.opties.find((o) => o.code === antwoord)?.label ?? String(antwoord);
  }
  if (vraag.type === 'ja-nee') return antwoord === true || antwoord === 'ja' ? 'Ja' : 'Nee';
  if (vraag.type === 'schaal' && vraag.schaal) {
    return `${antwoord} (van ${vraag.schaal.min} tot ${vraag.schaal.max})`;
  }
  return String(antwoord);
}

/**
 * Zinsbouw per vraag voor de S-tekst.
 *
 * Dit is met opzet een tabel en geen taalmodel. Wat in het journaal belandt moet elke
 * keer hetzelfde zijn, herleidbaar tot het antwoord waar het uit komt, en aanpasbaar
 * zonder dat er iets hoeft te worden getraind (ADR-0014). De formuleringen blijven in
 * de woorden van de patiënt: 'beweegt weinig', niet 'voldoet niet aan de beweegnorm'.
 */
const ZINNEN: Record<string, Record<string, string>> = {
  'cv-bewegen': {
    lukt: 'Beweegt naar eigen zeggen elke dag een half uur.',
    'lukt-niet': 'Komt niet aan een half uur bewegen per dag.',
    weinig: 'Beweegt weinig.',
    'weet-niet': 'Weet niet of het dagelijkse half uur bewegen lukt.',
  },
  'cv-alcohol': {
    nooit: 'Drinkt geen alcohol.',
    '1-of-minder': 'Drinkt hooguit één keer per week alcohol.',
    '2-3': 'Drinkt twee tot drie keer per week alcohol.',
    '4-of-meer': 'Drinkt vier keer per week of vaker alcohol.',
  },
  'cv-drugs': { ja: 'Gebruikt drugs.', nee: 'Gebruikt geen drugs.' },
  'cv-stress': { ja: 'Heeft veel zorgen of stress.', nee: 'Heeft weinig zorgen of stress.' },
  'cv-slaap': { ja: 'Slaapt goed.', nee: 'Slaapt slecht.' },
  'cv-steun': {
    ja: 'Heeft mensen in de omgeving die kunnen helpen.',
    nee: 'Heeft niemand in de omgeving die kan helpen.',
  },
  'cv-dagbesteding': {
    ja: 'Heeft werk of bezigheden die een goed gevoel geven.',
    nee: 'Mist werk of bezigheden die een goed gevoel geven.',
  },
  'cv-geld': { ja: 'Heeft zorgen over geld.', nee: 'Heeft geen geldzorgen.' },
  'cv-seksualiteit': {
    ja: 'Ervaart invloed van ziekte of medicatie op het seksleven.',
    nee: 'Ervaart geen invloed op het seksleven.',
    'liever-niet': 'Wil niet over seksualiteit praten.',
  },
  'js-bijwerkingen': { ja: 'Denkt last te hebben van bijwerkingen.', nee: 'Merkt geen bijwerkingen.' },
  'js-medproblemen': { ja: 'Heeft moeite met het innemen van de medicijnen.', nee: 'Neemt de medicijnen zonder problemen in.' },
  'js-klachten': { ja: 'Heeft nieuwe of veranderde klachten.', nee: 'Meldt geen nieuwe klachten.' },
  'js-oedeem': { ja: 'Heeft dikke enkels of voeten.', nee: 'Geen dikke enkels of voeten.' },
  'js-stoppen': {
    ja: 'Wil stoppen met roken.',
    misschien: 'Twijfelt over stoppen met roken.',
    nee: 'Wil niet stoppen met roken.',
  },
};

/** Vragen waarvan het antwoord letterlijk wordt overgenomen, tussen aanhalingstekens. */
const CITATEN: Record<string, string> = {
  'cv-gespreksonderwerp': 'Wil zelf bespreken',
  'cv-noodkaart': 'Over de noodkaart',
  'js-medproblemen-welke': 'Welke problemen met de medicijnen',
  'js-klachten-welke': 'Welke klachten',
};

function bouwSubjectief(
  lijst: Vragenlijst, afname: Vragenlijstafname, zichtbaar: Vraag[],
): string {
  const datum = afname.ingevuldOp?.slice(0, 10) ?? '';
  const regels: string[] = [
    `${lijst.naam} ingevuld op ${datum} ${KANAAL_LABEL[afname.kanaal]}.`,
  ];

  const cijfer = afname.antwoorden['cv-cijfer'];
  if (cijfer !== undefined) {
    regels.push(`Geeft de eigen gezondheid en het eigen leven het cijfer ${cijfer} (0-10).`);
  }

  const zinnen: string[] = [];
  for (const vraag of zichtbaar) {
    const antwoord = afname.antwoorden[vraag.id];
    if (antwoord === undefined || antwoord === '') continue;
    const zin = ZINNEN[vraag.id]?.[String(antwoord)];
    if (zin) zinnen.push(zin);
  }
  if (zinnen.length > 0) regels.push(zinnen.join(' '));

  for (const [vraagId, aanhef] of Object.entries(CITATEN)) {
    const antwoord = afname.antwoorden[vraagId];
    if (typeof antwoord === 'string' && antwoord.trim() !== '') {
      regels.push(`${aanhef}: “${antwoord.trim()}”`);
    }
  }
  return regels.join('\n');
}

/**
 * Wat een regel voorstelt, in één leesbare zin.
 *
 * Een actie is voor de motor een gestructureerd object, en dat moet ook zo blijven: het
 * is er om uitgevoerd te worden, niet om gelezen te worden. Maar in het overzicht van de
 * POH staat een regel zonder tekst er als een lege rij bij, en dan is de melding erger
 * dan geen melding.
 */
export function omschrijfActie(actie: Actie): string {
  switch (actie.type) {
    case 'taak': return actie.omschrijving;
    case 'notificeer': return actie.bericht;
    case 'zelfzorgadvies': return `Zelfzorgadvies klaarzetten: ${actie.titel}`;
    case 'vervolgvraag': return 'Vervolgvraag stellen in het consult';
    case 'plan-afspraak': return `Afspraak inplannen binnen ${actie.binnenDagen} dagen`;
    case 'wijzig-intensiteit': return `Contactfrequentie naar ${actie.naar}: ${actie.reden}`;
    case 'lab-aanvraag': return `Lab aanvragen: ${actie.bepalingen.join(', ')}`;
    case 'meting-uitvragen': return `Metingen uitvragen (${actie.frequentie}): ${actie.codes.join(', ')}`;
  }
}

// ── Inzage ──────────────────────────────────────────────────────────────────

export function bouwInzage(
  afname: Vragenlijstafname, peildatum: Date,
): Vragenlijstinzage | undefined {
  const lijst = vindVragenlijst(afname.vragenlijstId);
  if (!lijst) return undefined;

  const ingevuld = Boolean(afname.ingevuldOp);
  const zichtbaar = ingevuld ? zichtbareVragen(lijst, afname.antwoorden) : lijst.vragen;
  const uitkomst: Uitkomst | undefined = ingevuld
    ? verwerk(lijst, afname.antwoorden)
    : undefined;

  // Welke vragen een regel lieten afgaan: die krijgen in het overzicht een markering,
  // zodat de POH niet hoeft te zoeken waar de melding vandaan kwam.
  const uitTriggers = new Set<string>();
  for (const { trigger } of uitkomst?.gevuurd ?? []) {
    const verzamel = (v: unknown): void => {
      if (!v || typeof v !== 'object') return;
      const node = v as { type?: string; vraag?: string; van?: unknown };
      if (node.vraag) uitTriggers.add(node.vraag);
      if (Array.isArray(node.van)) node.van.forEach(verzamel);
      else if (node.van) verzamel(node.van);
    };
    verzamel(trigger.wanneer);
  }

  const rubrieken: Rubriek[] = [];
  for (const vraag of zichtbaar) {
    const naam = vraag.rubriek ?? 'Vragen';
    let rubriek = rubrieken.find((r) => r.naam === naam);
    if (!rubriek) rubrieken.push((rubriek = { naam, regels: [] }));
    rubriek.regels.push({
      vraagId: vraag.id,
      tekst: vraag.tekst,
      patientTekst: vraag.patientTekst,
      kantlijn: vraag.kantlijn,
      antwoord: leesbaar(vraag, afname.antwoorden[vraag.id]),
      eenheid: vraag.eenheid,
      observatieCode: vraag.observatieCode,
      vrijeTekst: vraag.type === 'tekst',
      opvallend: uitTriggers.has(vraag.id),
    });
  }

  const eigenOnderwerp = afname.antwoorden['cv-gespreksonderwerp'];
  // De noodkaartvraag staat er bewust niet bij: 'Niet gebruikt' is een prima antwoord,
  // maar als samenvatting van een vragenlijst zegt het niets.
  const kernzin = ['cv-gespreksonderwerp', 'js-klachten-welke', 'js-medproblemen-welke']
    .map((id) => afname.antwoorden[id])
    .find((a): a is string => typeof a === 'string' && a.trim() !== '')
    ?.trim();
  const dagenOpen = Math.floor(
    (peildatum.getTime() - new Date(afname.uitgezetOp).getTime()) / 86_400_000,
  );

  return {
    afnameId: afname.id,
    patientId: afname.patientId,
    vragenlijstId: lijst.id,
    naam: lijst.naam,
    versie: lijst.versie,
    doel: lijst.doel,
    licentie: lijst.licentie,
    uitgezetOp: afname.uitgezetOp,
    ingevuldOp: afname.ingevuldOp,
    kanaal: KANAAL_LABEL[afname.kanaal],
    status: ingevuld ? 'ingevuld' : 'open',
    openDagen: ingevuld ? undefined : Math.max(0, dagenOpen),
    overgenomenOp: afname.overgenomenOp,
    overgenomenDoor: afname.overgenomenDoor,
    kernzin,
    rubrieken,
    scores: (uitkomst?.scores ?? []).map((s) => ({ naam: s.naam, waarde: s.waarde })),
    signalen: (uitkomst?.gevuurd ?? []).map(({ trigger, onderbouwing }) => ({
      ernst: trigger.ernst,
      tekst: trigger.dan.map(omschrijfActie).filter(Boolean).join(' '),
      onderbouwing,
    })),
    overname: {
      subjectief: ingevuld ? bouwSubjectief(lijst, afname, zichtbaar) : '',
      // Eén code, één waarde: een vraag en de score eroverheen dragen dezelfde code, en
      // twee identieke regels in het overnamevoorstel zien er uit als een fout.
      metingen: [...new Map((uitkomst?.observaties ?? []).map((o) => [o.code, o])).values()],
      eigenOnderwerp: typeof eigenOnderwerp === 'string' && eigenOnderwerp.trim() !== ''
        ? eigenOnderwerp.trim()
        : undefined,
    },
  };
}
