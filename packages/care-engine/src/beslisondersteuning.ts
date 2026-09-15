import type { Dossier } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, metingReeks, numeriekeWaarde } from '@zpe/fhir-model';
import { CODE } from './protocol.js';
import { beoordeelInstroom } from './instroom.js';
import type { Zorgplan } from './zorgplan.js';

/**
 * BESLISSINGSONDERSTEUNING
 *
 * Twee soorten regels, bewust gescheiden (zie docs/adr/ADR-0005):
 *
 *  - **logistiek** — plannen, oproepen, labaanvragen klaarzetten, vragenlijsten uitzetten.
 *    Deze mogen automatisch draaien. Ze raken geen klinische beslissing.
 *  - **klinisch**  — alles wat het behandelbeleid beïnvloedt. Deze zijn altijd een
 *    *voorstel* aan een bevoegde zorgverlener, nooit een handeling. Dit deel valt
 *    onder de MDR en is daarom apart, versioneerbaar en volledig herleidbaar.
 *
 * Elke suggestie draagt de concrete waarden waarop hij berust. Een advies dat je niet
 * kunt narekenen, is geen advies maar een orakel.
 */

export const REGELSET_VERSIE = '2026.09.1';

export type SuggestieSoort =
  | 'meting' | 'medicatie' | 'planning' | 'leefstijl'
  | 'verwijzing' | 'module' | 'administratie' | 'zelfzorg' | 'intensiteit';

export interface SuggestieActie {
  id: string;
  label: string;
  aard: 'primair' | 'alternatief' | 'afwijzen';
  gevolg: string;
}

export interface Suggestie {
  id: string;
  regelId: string;
  regelVersie: string;
  patientId: string;
  soort: SuggestieSoort;
  titel: string;
  /** De feitelijke bevinding, met waarden en datums. Narekenbaar. */
  bevinding: string;
  /** Waarom dit ertoe doet. */
  onderbouwing: string;
  richtlijn?: { naam: string; paragraaf?: string };
  ernst: 'informatief' | 'aandacht' | 'urgent';
  klasse: 'logistiek' | 'klinisch';
  /** Alleen logistieke regels mogen automatisch. */
  automatisch: boolean;
  /** Wie hierover gaat. Bij medicatiewijziging is dat de huisarts. */
  rol: 'poh-s' | 'huisarts' | 'assistent';
  acties: SuggestieActie[];
}

interface Context {
  dossier: Dossier;
  plan: Zorgplan;
  peildatum: Date;
}

type Regel = (ctx: Context) => Suggestie[];

const AFWIJZEN: SuggestieActie = {
  id: 'afwijzen', label: 'Niet doen', aard: 'afwijzen',
  gevolg: 'Vastgelegd met reden. Deze suggestie komt niet opnieuw voor dit signaal.',
};

function maak(
  ctx: Context, regelId: string,
  velden: Omit<Suggestie, 'id' | 'regelId' | 'regelVersie' | 'patientId'>,
): Suggestie {
  return {
    id: `${ctx.dossier.patient.id}-${regelId}`,
    regelId,
    regelVersie: REGELSET_VERSIE,
    patientId: ctx.dossier.patient.id,
    ...velden,
  };
}

function waardeEnDatum(dossier: Dossier, code: string): { waarde?: number; op?: string; dagen?: number } {
  const o = laatsteMeting(dossier, code);
  if (!o) return {};
  return {
    waarde: numeriekeWaarde(o),
    op: o.effectief.slice(0, 10),
    dagen: Math.floor((Date.now() - new Date(o.effectief).getTime()) / 86_400_000),
  };
}

// ── Klinische regels — altijd een voorstel, nooit een handeling ──────────────

const glucoseOntregeld: Regel = (ctx) => {
  const reeks = metingReeks(ctx.dossier, CODE.hba1c).map(numeriekeWaarde).filter((x): x is number => typeof x === 'number');
  const { waarde, op } = waardeEnDatum(ctx.dossier, CODE.hba1c);
  if (waarde === undefined || waarde <= 64) return [];
  const stijgend = reeks.length >= 2 && reeks.at(-1)! > reeks.at(-2)!;

  return [maak(ctx, 'glucose-ontregeld', {
    soort: 'medicatie',
    titel: 'Glucoseregulatie bespreken en beleid heroverwegen',
    bevinding: `HbA1c ${waarde} mmol/mol (${op})${stijgend ? `, opgelopen vanaf ${reeks.at(-2)}` : ''}.`,
    onderbouwing:
      'Boven 64 mmol/mol is intensivering doorgaans aangewezen. Begin bij therapietrouw, ' +
      'leefstijl en inhalatie-/injectietechniek voordat er middelen bij komen — dat levert ' +
      'vaker resultaat op dan ophogen.',
    richtlijn: { naam: 'NHG-Standaard Diabetes mellitus type 2', paragraaf: 'Stappenplan bloedglucoseverlagende middelen' },
    ernst: waarde > 75 ? 'urgent' : 'aandacht',
    klasse: 'klinisch',
    automatisch: false,
    rol: 'poh-s',
    acties: [
      { id: 'agendeer-consult', label: 'Op de consultagenda zetten', aard: 'primair',
        gevolg: 'Komt als gespreksonderwerp bovenaan de voorbereiding van het eerstvolgende contact.' },
      { id: 'overleg-huisarts', label: 'Overleg huisarts aanvragen', aard: 'alternatief',
        gevolg: 'Autorisatieverzoek met context naar de huisarts; die ziet de reeks en kan in één klik tekenen.' },
      AFWIJZEN,
    ],
  })];
};

const bloeddrukTeHoog: Regel = (ctx) => {
  const reeks = metingReeks(ctx.dossier, CODE.rrSys).map(numeriekeWaarde).filter((x): x is number => typeof x === 'number');
  const { waarde, op } = waardeEnDatum(ctx.dossier, CODE.rrSys);
  if (waarde === undefined || waarde < 160) return [];
  const tweeMaal = reeks.slice(-2).filter((x) => x >= 160).length === 2;

  return [maak(ctx, 'bloeddruk-te-hoog', {
    soort: 'medicatie',
    titel: tweeMaal ? 'Bloeddruk herhaald te hoog — beleid aanpassen' : 'Bloeddruk te hoog — herhalen',
    bevinding: `Systolisch ${waarde} mmHg (${op})${tweeMaal ? `, ook de vorige meting was ${reeks.at(-2)}` : ''}.`,
    onderbouwing: tweeMaal
      ? 'Twee metingen boven 160 mmHg rechtvaardigen aanpassing van het beleid. Een thuismeetreeks ' +
        'onderscheidt praktijkhypertensie van werkelijke hypertensie en voorkomt onnodig ophogen.'
      : 'Eén verhoogde meting is onvoldoende basis voor beleid. Een thuismeetreeks is betrouwbaarder ' +
        'dan een tweede praktijkmeting.',
    richtlijn: { naam: 'NHG-Standaard Cardiovasculair risicomanagement', paragraaf: 'Bloeddrukmeting en behandeling' },
    ernst: waarde >= 180 ? 'urgent' : 'aandacht',
    klasse: 'klinisch',
    automatisch: false,
    rol: 'poh-s',
    acties: [
      { id: 'thuismeetreeks', label: 'Thuismeetreeks uitzetten (7 dagen)', aard: 'primair',
        gevolg: 'Patiënt krijgt instructie en meetschema in het portaal; de reeks komt automatisch in het dossier.' },
      { id: 'overleg-huisarts', label: 'Medicatievoorstel naar huisarts', aard: 'alternatief',
        gevolg: 'Autorisatieverzoek met de meetreeks en de huidige medicatie erbij.' },
      AFWIJZEN,
    ],
  })];
};

const nierfunctieGedaald: Regel = (ctx) => {
  const reeks = metingReeks(ctx.dossier, CODE.egfr).map(numeriekeWaarde).filter((x): x is number => typeof x === 'number');
  const { waarde, op } = waardeEnDatum(ctx.dossier, CODE.egfr);
  if (waarde === undefined) return [];

  const daling = reeks.length >= 2 ? Math.round(((reeks.at(-2)! - waarde) / reeks.at(-2)!) * 100) : 0;
  if (waarde >= 45 && daling < 25) return [];

  return [maak(ctx, 'nierfunctie-gedaald', {
    soort: 'medicatie',
    titel: 'Nierfunctie controleren tegen de medicatie',
    bevinding: daling >= 25
      ? `eGFR ${waarde} ml/min (${op}), een daling van ${daling}% ten opzichte van ${reeks.at(-2)}.`
      : `eGFR ${waarde} ml/min (${op}).`,
    onderbouwing:
      'Bij een eGFR onder 45 ml/min of een snelle daling moeten dosering en keuze van middelen ' +
      'opnieuw tegen het licht worden gehouden — met name metformine, NSAID’s, RAS-remmers en diuretica.',
    richtlijn: { naam: 'NHG-Standaard Chronische nierschade', paragraaf: 'Medicatiebewaking bij verminderde nierfunctie' },
    ernst: waarde < 30 ? 'urgent' : 'aandacht',
    klasse: 'klinisch',
    automatisch: false,
    rol: 'huisarts',
    acties: [
      { id: 'medicatiecheck', label: 'Medicatiebeoordeling aanvragen', aard: 'primair',
        gevolg: 'Taak naar de huisarts met de nierfunctiereeks en het actuele medicatieoverzicht.' },
      { id: 'herhaal-lab', label: 'Lab herhalen binnen 2 weken', aard: 'alternatief',
        gevolg: 'Labaanvraag klaargezet; uitslag komt terug in de werkvoorraad.' },
      AFWIJZEN,
    ],
  })];
};

const rookadvies: Regel = (ctx) => {
  const o = laatsteMeting(ctx.dossier, CODE.roken);
  const code = (o?.waarde as { code?: { code: string; display?: string } })?.code;
  if (code?.code !== '77176002') return [];
  const heeftLong = ctx.plan.modules.some((m) => m.id === 'ademhaling');
  const heeftVaat = ctx.plan.modules.some((m) => m.id === 'vaatrisico');
  if (!heeftLong && !heeftVaat) return [];

  return [maak(ctx, 'stoppen-met-roken', {
    soort: 'leefstijl',
    titel: 'Stoppen-met-rokenbegeleiding aanbieden',
    bevinding: `Patiënt rookt (vastgelegd ${o!.effectief.slice(0, 10)})${heeftLong ? ' en heeft een longaandoening' : ''}.`,
    onderbouwing:
      'Stoppen met roken is bij deze aandoeningen de interventie met verreweg de grootste ' +
      'gezondheidswinst — groter dan welke medicatieaanpassing ook. Begeleiding met ' +
      'farmacotherapie verdubbelt de slaagkans ten opzichte van alleen advies.',
    richtlijn: { naam: 'NHG-Behandelrichtlijn Stoppen met roken' },
    ernst: 'aandacht',
    klasse: 'klinisch',
    automatisch: false,
    rol: 'poh-s',
    acties: [
      { id: 'sms-traject', label: 'Begeleidingstraject starten', aard: 'primair',
        gevolg: 'Zorgmodule leefstijl krijgt een stoppen-met-rokentraject; patiënt krijgt informatie in het portaal.' },
      { id: 'later-bespreken', label: 'Later bespreken', aard: 'alternatief',
        gevolg: 'Komt terug op de voorbereiding van het volgende contact.' },
      AFWIJZEN,
    ],
  })];
};

const mentaalLaag: Regel = (ctx) => {
  const { waarde, op } = waardeEnDatum(ctx.dossier, CODE.mpg);
  if (waarde === undefined || waarde > 5) return [];

  return [maak(ctx, 'mentaal-laag', {
    soort: 'verwijzing',
    titel: 'Mentaal welbevinden bespreken',
    bevinding: `Gezondheidsoppervlakte ${waarde} van 10 (${op}).`,
    onderbouwing:
      'Een lage score bij een somatische controle is het signaal dat in de huidige werkwijze ' +
      'structureel gemist wordt: er wordt niet naar gevraagd en de lijst wordt niet gelezen. ' +
      'Hier hoort het bovenaan de consultvoorbereiding te staan.',
    ernst: 'aandacht',
    klasse: 'klinisch',
    automatisch: false,
    rol: 'poh-s',
    acties: [
      { id: 'gespreksonderwerp', label: 'Als gespreksonderwerp agenderen', aard: 'primair',
        gevolg: 'Komt bovenaan de voorbereiding van het eerstvolgende contact.' },
      { id: 'poh-ggz', label: 'Overleg POH-GGZ', aard: 'alternatief',
        gevolg: 'Interne consultatievraag naar de POH-GGZ, met toestemming van de patiënt.' },
      AFWIJZEN,
    ],
  })];
};

const allesStabiel: Regel = (ctx) => {
  if (ctx.plan.intensiteit !== 'basis') return [];
  const codes = [CODE.hba1c, CODE.rrSys, CODE.ccq];
  const stabiel: string[] = [];
  for (const code of codes) {
    const reeks = metingReeks(ctx.dossier, code).map(numeriekeWaarde).filter((x): x is number => typeof x === 'number');
    if (reeks.length < 3) continue;
    const grens = code === CODE.hba1c ? 53 : code === CODE.rrSys ? 140 : 1;
    if (reeks.slice(-3).every((x) => x < grens)) stabiel.push(code);
  }
  if (stabiel.length === 0) return [];

  const namen = stabiel.map((c) => c === CODE.hba1c ? 'HbA1c' : c === CODE.rrSys ? 'bloeddruk' : 'CCQ');
  return [maak(ctx, 'afschalen-stabiel', {
    soort: 'intensiteit',
    titel: 'Minder vaak controleren is passend',
    bevinding: `${namen.join(' en ')} ${namen.length === 1 ? 'is' : 'zijn'} drie metingen achtereen op streefwaarde.`,
    onderbouwing:
      'Aanhoudend stabiele waarden rechtvaardigen een ruimer controle-interval. Dit is de suggestie ' +
      'die geen enkel bestaand systeem doet: er wordt alleen gesignaleerd wat misgaat, nooit wat ' +
      'goed genoeg gaat om minder te doen.',
    ernst: 'informatief',
    klasse: 'klinisch',
    automatisch: false,
    rol: 'poh-s',
    acties: [
      { id: 'extensief', label: 'Intensiteit naar extensief', aard: 'primair',
        gevolg: 'Alle intervallen worden met factor 1,6 opgerekt. Het plan wordt direct herberekend.' },
      { id: 'bespreken', label: 'Eerst met patiënt bespreken', aard: 'alternatief',
        gevolg: 'Komt als voorstel op de voorbereiding van het volgende contact.' },
      AFWIJZEN,
    ],
  })];
};

const nieuwAandachtsgebied: Regel = (ctx) => {
  const bekend = ctx.plan.modules.map((m) => m.id);
  const instroom = beoordeelInstroom(ctx.dossier, bekend, undefined, ctx.peildatum);
  return instroom.nieuw.map((module) => maak(ctx, `module-${module.moduleId}`, {
    soort: 'module',
    titel: `Aandachtsgebied ${module.naam.toLowerCase()} toevoegen`,
    bevinding: module.onderbouwing,
    onderbouwing:
      'Dit aandachtsgebied is relevant geworden op grond van wat er in het dossier staat. ' +
      'Toevoegen betekent niet automatisch meer contacten: de controles worden samengevoegd ' +
      'met wat er al gepland staat.',
    ernst: 'informatief',
    klasse: 'klinisch',
    automatisch: false,
    rol: 'poh-s',
    acties: [
      { id: 'toevoegen', label: 'Toevoegen aan het plan', aard: 'primair',
        gevolg: 'Plan wordt herberekend; overlappende metingen worden samengevoegd.' },
      AFWIJZEN,
    ],
  }));
};

// ── Logistieke regels — mogen automatisch ───────────────────────────────────

const labKlaarzetten: Regel = (ctx) => {
  const eerste = ctx.plan.contacten[0];
  if (!eerste) return [];
  const nodig = eerste.metingen.filter((m) => m.labVooraf);
  if (nodig.length === 0) return [];

  return [maak(ctx, 'lab-klaarzetten', {
    soort: 'administratie',
    titel: 'Labaanvraag klaarzetten vóór het contact',
    bevinding: `Contact op ${eerste.datum} vraagt ${nodig.map((m) => m.naam).join(', ')}.`,
    onderbouwing:
      'Zonder uitslag is het consult half werk en moet de patiënt terugkomen. De aanvraag kan ' +
      'zonder tussenkomst worden klaargezet: er zit geen klinische beslissing in.',
    ernst: 'informatief',
    klasse: 'logistiek',
    automatisch: true,
    rol: 'assistent',
    acties: [
      { id: 'klaarzetten', label: 'Aanvraag klaarzetten', aard: 'primair',
        gevolg: `Labformulier klaar, prikafspraak voorgesteld ruim vóór ${eerste.datum}.` },
      AFWIJZEN,
    ],
  })];
};

const vragenlijstUitzetten: Regel = (ctx) => {
  const eerste = ctx.plan.contacten[0];
  if (!eerste || eerste.vragenlijsten.length === 0) return [];

  return [maak(ctx, 'vragenlijst-uitzetten', {
    soort: 'administratie',
    titel: 'Consultvoorbereidende vragenlijst uitzetten',
    bevinding: `Contact op ${eerste.datum} hoort voorbereid te worden met ${eerste.vragenlijsten.join(', ')}.`,
    onderbouwing:
      'De vragenlijst hoort vóór het consult ingevuld te zijn, niet erna in het journaal geplakt. ' +
      'Uitzetten is logistiek en kan automatisch; de uitkomst verschijnt in de voorbereiding.',
    ernst: 'informatief',
    klasse: 'logistiek',
    automatisch: true,
    rol: 'assistent',
    acties: [
      { id: 'uitzetten', label: 'Nu uitzetten via portaal', aard: 'primair',
        gevolg: 'Patiënt krijgt de lijst met herinnering; uitkomst komt gestructureerd in het dossier.' },
      AFWIJZEN,
    ],
  })];
};

const thuismetingAanbieden: Regel = (ctx) => {
  if (!ctx.dossier.patient.portaalActief) return [];
  const thuis = ctx.plan.contacten.flatMap((c) => c.metingen).filter((m) => m.zelfAanleverbaar);
  const uniek = [...new Map(thuis.map((m) => [m.code, m])).values()];
  if (uniek.length < 2) return [];

  return [maak(ctx, 'thuismeting-aanbieden', {
    soort: 'meting',
    titel: 'Thuismeting aanbieden in plaats van praktijkbezoek',
    bevinding: `${uniek.map((m) => m.naam.toLowerCase()).join(', ')} kunnen thuis worden gemeten.`,
    onderbouwing:
      'Thuismetingen zijn bij bloeddruk betrouwbaarder dan praktijkmetingen en schelen de patiënt ' +
      'een rit. Aanbieden is logistiek; of het klinisch passend is, beoordeelt de zorgverlener.',
    ernst: 'informatief',
    klasse: 'logistiek',
    automatisch: false,
    rol: 'poh-s',
    acties: [
      { id: 'aanbieden', label: 'Aanbieden via portaal', aard: 'primair',
        gevolg: 'Patiënt krijgt uitleg en meetschema; metingen landen automatisch in het dossier.' },
      AFWIJZEN,
    ],
  })];
};

const REGELS: Regel[] = [
  glucoseOntregeld, bloeddrukTeHoog, nierfunctieGedaald, rookadvies, mentaalLaag,
  allesStabiel, nieuwAandachtsgebied,
  labKlaarzetten, vragenlijstUitzetten, thuismetingAanbieden,
];

const ERNST_GEWICHT = { urgent: 3, aandacht: 2, informatief: 1 };

/** Draait de volledige regelset over één dossier plus zijn plan. */
export function suggesties(dossier: Dossier, plan: Zorgplan, peildatum: Date = new Date()): Suggestie[] {
  const ctx: Context = { dossier, plan, peildatum };
  return REGELS.flatMap((regel) => regel(ctx))
    .sort((a, b) => {
      if (a.klasse !== b.klasse) return a.klasse === 'klinisch' ? -1 : 1;
      return ERNST_GEWICHT[b.ernst] - ERNST_GEWICHT[a.ernst];
    });
}

export interface AutomatiseringsOverzicht {
  automatischUitgevoerd: Suggestie[];
  wachtOpMens: Suggestie[];
  /** Aandeel van het werk dat zonder tussenkomst kan. */
  automatiseringsgraad: number;
}

/**
 * Scheidt wat vanzelf kan van wat een mens nodig heeft. Dit is de kern van de belofte:
 * niet "AI neemt het over", maar "het systeem doet het saaie deel en laat het
 * oordeel aan de zorgverlener".
 */
export function automatisering(lijst: Suggestie[]): AutomatiseringsOverzicht {
  const automatisch = lijst.filter((s) => s.automatisch);
  const mens = lijst.filter((s) => !s.automatisch);
  return {
    automatischUitgevoerd: automatisch,
    wachtOpMens: mens,
    automatiseringsgraad: lijst.length === 0 ? 0 : Math.round((automatisch.length / lijst.length) * 100),
  };
}

export { leeftijd };
