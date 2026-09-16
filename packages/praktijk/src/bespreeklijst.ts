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
export function genereerBespreekpunten(
  patienten: { patientId: string; naam: string }[], peildatum: Date,
): Bespreekpunt[] {
  const sjablonen: { vraag: string; context: string; door: { id: string; naam: string; rol: Rol }; voor: Rol[] }[] = [
    {
      vraag: 'HbA1c blijft stijgen ondanks maximale metformine. Tweede middel toevoegen of eerst leefstijl intensiveren?',
      context: 'HbA1c 71 mmol/mol (was 64, was 58). Therapietrouw lijkt goed. eGFR 62.',
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      voor: ['huisarts'],
    },
    {
      vraag: 'Zelfredzaamheid gedaald op drie domeinen sinds het overlijden van haar man. Wil jij meekijken?',
      context: 'ZRM gemiddeld van 3,4 naar 2,6. Knelpunten: financiën, dagbesteding, geestelijke gezondheid.',
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      voor: ['huisarts'],
    },
    {
      vraag: 'Blijft bloeddruk boven streefwaarde houden. Ik wil de medicatie ophogen — kun jij dat autoriseren?',
      context: 'Thuismeetreeks 7 dagen: gemiddeld 156/92. Gebruikt lisinopril 10 mg.',
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      voor: ['huisarts'],
    },
    {
      vraag: 'Na de ziekenhuisopname COPD: wie pakt de longrevalidatie op en wanneer zien we hem terug?',
      context: 'Ontslagbrief longgeneeskunde binnengekomen, advies longrevalidatie. Rookt nog.',
      door: { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' },
      voor: ['poh-s'],
    },
  ];

  return sjablonen.flatMap((s, i) => {
    const patient = patienten[i * 5];
    if (!patient) return [];
    const op = new Date(peildatum);
    op.setDate(op.getDate() - (sjablonen.length - i));
    return [{
      id: `bespreek-${i + 1}`,
      patientId: patient.patientId,
      naam: patient.naam,
      ingebrachtDoor: s.door,
      ingebrachtOp: op.toISOString(),
      vraag: s.vraag,
      context: s.context,
      voorRollen: s.voor,
      status: 'open' as const,
    }];
  });
}
