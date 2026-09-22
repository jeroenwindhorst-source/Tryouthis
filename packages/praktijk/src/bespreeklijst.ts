import type { Rol } from '@zpe/fhir-model';

/**
 * DE BESPREEKLIJST
 *
 * Het overleg tussen huisarts en praktijkondersteuner is een vast moment in de dag en
 * het is waar de samenwerking feitelijk plaatsvindt. Het wordt nu voorbereid met een
 * papiertje, een appje of een berichtje in het HIS — en dat werkt precies zo lang als
 * niemand ziek is.
 *
 * Een bespreekpunt is daarom geen bericht. Een bericht heeft één ontvanger en is klaar
 * als hij gelezen is; een bespreekpunt hoort bij een moment, heeft een vraag, en is pas
 * klaar als er een antwoord is. Dat verschil bepaalt of iets na het overleg nog
 * terug te vinden is.
 */

export type Bespreekstatus = 'open' | 'besproken' | 'vervallen';

export interface Bespreekpunt {
  id: string;
  patientId: string;
  naam: string;
  ingebrachtDoor: { id: string; naam: string; rol: Rol };
  ingebrachtOp: string;
  /** Waarom staat dit op de lijst. Nooit leeg — anders is het overleg een voorleesronde. */
  vraag: string;
  /** Wat de ander moet weten om mee te denken, uit het dossier. */
  context?: string;
  /** Met wie wil je dit bespreken. */
  voorRollen: Rol[];
  status: Bespreekstatus;
  /** Wat eruit kwam. Gaat als notitie het dossier in. */
  uitkomst?: string;
  besprokenOp?: string;
  besprokenDoor?: string;
}

export interface NieuwBespreekpunt {
  patientId: string;
  naam: string;
  vraag: string;
  context?: string;
  voorRollen: Rol[];
}

/**
 * De lijst voor het overleg van vandaag.
 *
 * Bewust niet gefilterd op wie hem inbracht: huisarts en POH kijken naar dezelfde lijst.
 * Twee lijsten met hetzelfde doel lopen altijd uit elkaar.
 */
export function bespreeklijstVoor(punten: Bespreekpunt[], rol: Rol): Bespreekpunt[] {
  return punten
    .filter((p) => p.voorRollen.includes(rol) || p.ingebrachtDoor.rol === rol)
    .sort((a, b) =>
      Number(a.status !== 'open') - Number(b.status !== 'open')
      || a.ingebrachtOp.localeCompare(b.ingebrachtOp));
}

/** Startsituatie: een paar punten die al klaarstaan voor het overleg van vandaag. */
/**
 * Kandidaat voor een bespreekpunt, met de dossierkenmerken die de vraag veronderstelt.
 *
 * Een vraag als "HbA1c blijft stijgen ondanks maximale metformine" bij iemand zonder
 * diabetes in het dossier is geen overlegpunt maar een fout die je pas ziet als je
 * doorklikt — en dat doe je in een overleg juist wél.
 */
export interface Bespreekkandidaat {
  patientId: string;
  naam: string;
  /** ICPC-codes van de actieve episodes. */
  icpc: string[];
  /** ATC-codes van de actief gebruikte middelen. */
  atc: string[];
  vrouw: boolean;
  /** Namen van de actieve middelen, zodat de context kan noemen wat iemand écht gebruikt. */
  middelen: string[];
  /** Laatste waarden uit het dossier; de context citeert deze in plaats van iets te verzinnen. */
  hba1c?: number;
  egfr?: number;
  rrSys?: number;
  zelfredzaamheid?: number;
}

export function genereerBespreekpunten(
  patienten: Bespreekkandidaat[], peildatum: Date,
): Bespreekpunt[] {
  /*
   * De context wordt uit het dossier gelezen in plaats van meegeschreven.
   *
   * Een overlegpunt dat "HbA1c 71 (was 64)" zegt bij iemand van wie het dossier 58 laat
   * zien, is erger dan een overlegpunt zonder cijfers: in het overleg wordt juist
   * doorgeklikt, en dan klopt het gesprek niet meer met het scherm.
   */
  const sjablonen: {
    vraag: string;
    context: (k: Bespreekkandidaat) => string;
    door: { id: string; naam: string; rol: Rol }; voor: Rol[];
    /** Wat er in het dossier moet staan om deze vraag te kunnen stellen. */
    eis: {
      icpc?: string[]; atc?: string[]; vrouw?: boolean;
      /** Numerieke drempels, zodat de vraag past bij wat er in het dossier staat. */
      zelfredzaamheidOnder?: number; rrSysBoven?: number; hba1cBoven?: number;
    };
  }[] = [
    {
      vraag: 'HbA1c blijft stijgen ondanks maximale metformine. Tweede middel toevoegen of eerst leefstijl intensiveren?',
      context: (k) => `HbA1c ${k.hba1c ?? '?'} mmol/mol. Therapietrouw lijkt goed.`
        + `${k.egfr ? ` eGFR ${k.egfr} ml/min.` : ''} Gebruikt ${k.middelen.join(', ') || 'geen medicatie'}.`,
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      voor: ['huisarts'],
      eis: { icpc: ['T90'], atc: ['A10BA'], hba1cBoven: 63 },
    },
    {
      vraag: 'Zelfredzaamheid gedaald op drie domeinen sinds het overlijden van haar man. Wil jij meekijken?',
      context: (k) => `Zelfredzaamheid gemiddeld ${k.zelfredzaamheid ?? '?'} van 5 — onder de`
        + ' drempel waarboven zelfmanagement verantwoord is. Knelpunten onder andere op'
        + ' financiën, dagbesteding en geestelijke gezondheid.',
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      voor: ['huisarts'],
      // "Sinds het overlijden van haar man" — een vrouw met zorg die al loopt.
      // "Sinds het overlijden van haar man": een vrouw, met zorg die al loopt.
      eis: { icpc: ['T90', 'K86', 'R95'], vrouw: true, zelfredzaamheidOnder: 3.4 },
    },
    {
      vraag: 'Blijft bloeddruk boven streefwaarde houden. Ik wil de medicatie ophogen — kun jij dat autoriseren?',
      context: (k) => `Laatste praktijkmeting ${k.rrSys ?? '?'} mmHg systolisch.`
        + ` Gebruikt ${k.middelen.join(', ') || 'geen bloeddrukmedicatie'}.`,
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      voor: ['huisarts'],
      eis: { icpc: ['K86', 'K87'], atc: ['C0'], rrSysBoven: 149 },
    },
    {
      vraag: 'Na de ziekenhuisopname COPD: wie pakt de longrevalidatie op en wanneer zien we hem terug?',
      context: () => 'Ontslagbrief longgeneeskunde binnengekomen, advies longrevalidatie. Rookt nog.',
      door: { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' },
      voor: ['poh-s'],
      eis: { icpc: ['R95', 'R96'], atc: ['R03'] },
    },
  ];

  const vergeven = new Set<string>();
  const past = (k: Bespreekkandidaat, eis: (typeof sjablonen)[number]['eis']) =>
    (!eis.icpc || eis.icpc.some((p) => k.icpc.some((c) => c.startsWith(p))))
    && (!eis.atc || eis.atc.some((p) => k.atc.some((c) => c.startsWith(p))))
    && (eis.vrouw === undefined || eis.vrouw === k.vrouw)
    && (eis.zelfredzaamheidOnder === undefined
      || (k.zelfredzaamheid !== undefined && k.zelfredzaamheid < eis.zelfredzaamheidOnder))
    && (eis.rrSysBoven === undefined || (k.rrSys !== undefined && k.rrSys > eis.rrSysBoven))
    && (eis.hba1cBoven === undefined || (k.hba1c !== undefined && k.hba1c > eis.hba1cBoven));

  return sjablonen.flatMap((s, i) => {
    const patient = patienten.find((k) => !vergeven.has(k.patientId) && past(k, s.eis));
    if (!patient) return [];
    vergeven.add(patient.patientId);
    const op = new Date(peildatum);
    op.setDate(op.getDate() - (sjablonen.length - i));
    return [{
      id: `bespreek-${i + 1}`,
      patientId: patient.patientId,
      naam: patient.naam,
      ingebrachtDoor: s.door,
      ingebrachtOp: op.toISOString(),
      vraag: s.vraag,
      context: s.context(patient),
      voorRollen: s.voor,
      status: 'open' as const,
    }];
  });
}
