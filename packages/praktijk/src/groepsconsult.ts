import type { Rol } from '@zpe/fhir-model';

/**
 * GROEPSCONSULTEN
 *
 * Een deel van de chronische zorg is beter in een groep dan in een spreekkamer. Acht
 * mensen met diabetes die samen leren koolhydraten herkennen, halen meer uit dat uur dan
 * acht keer tien minuten individueel — en ze halen er iets uit wat een individueel
 * consult per definitie niet kan geven: elkaar.
 *
 * Systemen ondersteunen dit vrijwel nooit, en dat is niet toevallig. Een agenda die is
 * gebouwd rond "één tijdslot, één patiënt" kan een blok met acht mensen niet weergeven,
 * en een declaratiemodel dat per consult rekent, weet niet wat het ermee moet. Het gevolg
 * is dat de POH een Excel bijhoudt en de registratie achteraf één voor één invoert.
 *
 * Hier is een groepsconsult een eigen soort agenda-item met deelnemers. De registratie
 * gebeurt na afloop per deelnemer — want het consult is gezamenlijk, het dossier niet.
 */

export type Groepsstatus = 'gepland' | 'bezig' | 'afgerond' | 'geannuleerd';

export type Deelnemerstatus = 'uitgenodigd' | 'aangemeld' | 'aanwezig' | 'afgemeld' | 'niet-verschenen';

export const DEELNEMERSTATUS_LABEL: Record<Deelnemerstatus, string> = {
  uitgenodigd: 'uitgenodigd', aangemeld: 'aangemeld', aanwezig: 'aanwezig',
  afgemeld: 'afgemeld', 'niet-verschenen': 'niet verschenen',
};

export interface Groepsdeelnemer {
  patientId: string;
  naam: string;
  status: Deelnemerstatus;
  /** Waarom past deze patiënt bij dit thema. Nooit leeg: anders is het een willekeurige lijst. */
  onderbouwing: string;
  toegevoegdOp: string;
  /** Is er na afloop per deelnemer geregistreerd? */
  geregistreerd?: boolean;
}

export interface Groepsconsult {
  id: string;
  titel: string;
  thema: string;
  /** Welk aandachtsgebied dit raakt; bepaalt wie het systeem voorstelt. */
  module: string;
  begeleider: { id: string; naam: string; rol: Rol };
  start: string;
  duurMinuten: number;
  plaats: string;
  maxDeelnemers: number;
  status: Groepsstatus;
  /** Wat er in dit uur gebeurt. Staat ook in de uitnodiging aan de patiënt. */
  programma: string[];
  deelnemers: Groepsdeelnemer[];
}

export interface NieuwGroepsconsult {
  titel: string;
  thema: string;
  module: string;
  start: string;
  duurMinuten: number;
  plaats: string;
  maxDeelnemers: number;
  programma: string[];
}

/** Thema's die in een huisartsenpraktijk werkelijk in groepsvorm gedaan worden. */
export const GROEPSTHEMAS: {
  id: string; titel: string; thema: string; module: string;
  duurMinuten: number; maxDeelnemers: number; programma: string[];
  /** Voor wie dit bedoeld is; wordt gebruikt om deelnemers voor te stellen. */
  doelgroep: string;
}[] = [
  {
    id: 'dm-leefstijl', titel: 'Leven met diabetes', thema: 'Leefstijl bij diabetes type 2',
    module: 'glucose', duurMinuten: 90, maxDeelnemers: 10,
    doelgroep: 'Mensen met diabetes type 2 bij wie leefstijl het verschil kan maken',
    programma: [
      'Wat doet eten met je bloedsuiker — koolhydraten herkennen',
      'Bewegen: wat werkt en wat houdt vol',
      'Ervaringen uitwisselen',
      'Individuele vragen',
    ],
  },
  {
    id: 'copd-ademhaling', titel: 'Ademhaling en energie', thema: 'Omgaan met COPD',
    module: 'ademhaling', duurMinuten: 90, maxDeelnemers: 8,
    doelgroep: 'Mensen met COPD, met name na een exacerbatie',
    programma: [
      'Inhalatietechniek — samen oefenen',
      'Energie verdelen over de dag',
      'Wat te doen bij toename van klachten',
      'Vragen',
    ],
  },
  {
    id: 'stoppen-roken', titel: 'Stoppen met roken — groepstraject',
    thema: 'Begeleiding stoppen met roken', module: 'leefstijl',
    duurMinuten: 60, maxDeelnemers: 12,
    doelgroep: 'Rokers die gemotiveerd zijn te stoppen',
    programma: [
      'Waarom stoppen zo moeilijk is',
      'Een stopdatum kiezen',
      'Medicamenteuze ondersteuning',
      'Afspraken voor de komende weken',
    ],
  },
  {
    id: 'hart-vaat', titel: 'Hart en vaten in balans', thema: 'Cardiovasculair risicomanagement',
    module: 'vaatrisico', duurMinuten: 75, maxDeelnemers: 10,
    doelgroep: 'Mensen met een verhoogd vaatrisico',
    programma: [
      'Wat betekent je risicoprofiel',
      'Bloeddruk en cholesterol: wat kun je zelf doen',
      'Medicatie — waarom en hoe lang',
      'Thuis meten',
    ],
  },
  {
    id: 'kwetsbaar-ouder', titel: 'Vitaal ouder worden', thema: 'Kwetsbaarheid en zelfredzaamheid',
    module: 'kwetsbaarheid', duurMinuten: 90, maxDeelnemers: 8,
    doelgroep: 'Ouderen met verminderde zelfredzaamheid of valrisico',
    programma: [
      'Valpreventie in en om het huis',
      'Wat regelt het wijkteam',
      'Medicatie: minder kan ook beter',
      'Wat wil je zelf blijven kunnen',
    ],
  },
];

export function vindThema(id: string) {
  return GROEPSTHEMAS.find((t) => t.id === id);
}

const stempel = (dag: string, uur: number, minuut: number): string => {
  const twee = (n: number) => String(n).padStart(2, '0');
  return `${dag}T${twee(uur)}:${twee(minuut)}:00+02:00`;
};

/**
 * Twee groepsconsulten die al staan gepland.
 *
 * Eén over twee weken met deelnemers erin, en één verderop die nog leeg is — zodat
 * zichtbaar is hoe je er mensen op zet en niet alleen hoe het eruitziet als het vol is.
 */
export function genereerGroepsconsulten(
  patienten: { patientId: string; naam: string; modules: string[] }[],
  peildatum: Date,
): Groepsconsult[] {
  const poh = { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' as Rol };
  const consulten: Groepsconsult[] = [];

  const overDagen = (dagen: number) => {
    const d = new Date(peildatum);
    d.setDate(d.getDate() + dagen);
    return d.toISOString().slice(0, 10);
  };

  const eerste = GROEPSTHEMAS[0];
  const passend = patienten.filter((p) => p.modules.includes(eerste.module)).slice(0, 6);
  consulten.push({
    id: 'groep-1',
    titel: eerste.titel,
    thema: eerste.thema,
    module: eerste.module,
    begeleider: poh,
    start: stempel(overDagen(13), 14, 0),
    duurMinuten: eerste.duurMinuten,
    plaats: 'Praktijkruimte achter, De Linde',
    maxDeelnemers: eerste.maxDeelnemers,
    status: 'gepland',
    programma: eerste.programma,
    deelnemers: passend.map((p, i) => ({
      patientId: p.patientId,
      naam: p.naam,
      status: (i < 4 ? 'aangemeld' : 'uitgenodigd') as Deelnemerstatus,
      onderbouwing: 'Diabetes type 2 met leefstijl als aangrijpingspunt',
      toegevoegdOp: overDagen(-6),
    })),
  });

  const tweede = GROEPSTHEMAS[3];
  consulten.push({
    id: 'groep-2',
    titel: tweede.titel,
    thema: tweede.thema,
    module: tweede.module,
    begeleider: poh,
    start: stempel(overDagen(27), 10, 0),
    duurMinuten: tweede.duurMinuten,
    plaats: 'Praktijkruimte achter, De Linde',
    maxDeelnemers: tweede.maxDeelnemers,
    status: 'gepland',
    programma: tweede.programma,
    deelnemers: [],
  });

  return consulten;
}
