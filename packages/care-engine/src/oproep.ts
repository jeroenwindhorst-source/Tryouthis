import type { Herkomst, Patient, Task } from '@zpe/fhir-model';
import { modules } from './protocol.js';
import type { GeplandContact, Zorgplan } from './zorgplan.js';

function moduleNamen(ids: string[]): string {
  return ids.map((id) => modules.find((m) => m.id === id)?.naam.toLowerCase() ?? id).join(', ');
}

/**
 * Oproepproces (docs/04 §5). Vervangt Excel + handmatig bellen.
 *
 * Belangrijk detail: uitblijvende respons is geen stilte maar een werkitem met reden.
 * Dat is de functie 'Monitoring uitval' uit het AHA-functiemodel (docs/11).
 */
export type Kanaal = 'portaal' | 'sms' | 'email' | 'telefoon' | 'brief';

export interface OproepPlan {
  contact: GeplandContact;
  /** Wanneer de eerste uitnodiging de deur uit gaat. */
  uitnodigenOp: string;
  kanaal: Kanaal;
  herinneringen: { op: string; kanaal: Kanaal }[];
  /** Wanneer een mens het overneemt als er niets gebeurt. */
  escalatieOp: string;
  toelichting: string;
}

const DAG = 86_400_000;
const isoDatum = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Kanaalkeuze op basis van voorkeur en mogelijkheden. Digitaal eerst — niet omdat het
 * goedkoper is, maar omdat de responssnelheid hoger ligt en de assistent er geen
 * werk aan heeft. Telefoon blijft bestaan voor wie niet digitaal kan.
 */
export function kiesKanaal(patient: Patient, digitaalBereikbaar = true): Kanaal {
  // Digitaal eerst, maar niet als de zelfredzaamheid dat niet toelaat: een portaalbericht
  // aan iemand die het niet opent, is geen oproep maar een gemiste patiënt.
  if (!digitaalBereikbaar) return patient.contact?.telefoon ? 'telefoon' : 'brief';
  const voorkeur = patient.communicatievoorkeur;
  if (voorkeur === 'portaal' && patient.portaalActief) return 'portaal';
  if (voorkeur && voorkeur !== 'portaal') return voorkeur;
  if (patient.portaalActief) return 'portaal';
  if (patient.contact?.email) return 'email';
  if (patient.contact?.telefoon) return 'sms';
  return 'brief';
}

export interface OproepOpties {
  /** Hoeveel dagen vóór de streefdatum de uitnodiging wordt verstuurd. */
  voorlooptijdDagen?: number;
  herinneringNaDagen?: number;
  escalatieNaDagen?: number;
  peildatum?: Date;
}

export function planOproepen(
  plan: Zorgplan, patient: Patient, opties: OproepOpties = {},
): OproepPlan[] {
  const voorloop = opties.voorlooptijdDagen ?? 28;
  const herinnering = opties.herinneringNaDagen ?? 10;
  const escalatie = opties.escalatieNaDagen ?? 21;
  const nu = (opties.peildatum ?? new Date()).getTime();

  if (plan.intensiteit === 'eigen-regie') {
    return [];   // geen oproepen; bewaking op uitblijvende metingen loopt apart
  }

  const kanaal = kiesKanaal(patient, plan.zelfredzaamheid?.digitaalBereikbaar ?? true);

  return plan.contacten.map((contact) => {
    const streef = new Date(contact.datum).getTime();
    const uitnodigen = Math.max(nu, streef - voorloop * DAG);
    return {
      contact,
      uitnodigenOp: isoDatum(uitnodigen),
      kanaal,
      herinneringen: [{ op: isoDatum(uitnodigen + herinnering * DAG), kanaal: kanaal === 'portaal' ? 'sms' : kanaal }],
      escalatieOp: isoDatum(uitnodigen + escalatie * DAG),
      toelichting:
        `Uitnodiging via ${kanaal} voor ${moduleNamen(contact.modules)} ` +
        `(${contact.duurMinuten} min). Geen respons na ${escalatie} dagen → terugbelverzoek voor de assistent.`,
    };
  });
}

/** Zet oproepplannen om in concrete werkitems met reden en voorgestelde actie. */
export function oproepTaken(
  oproepen: OproepPlan[], patientId: string, herkomst: Herkomst,
): Task[] {
  return oproepen.map((oproep, i) => ({
    resourceType: 'Task',
    id: `${patientId}-oproep-${i + 1}`,
    patientId,
    categorie: 'oproep',
    status: 'requested',
    prioriteit: 'routine',
    omschrijving: `Oproep ${moduleNamen(oproep.contact.modules)} — ${oproep.contact.datum}`,
    aanleiding:
      `Volgens het zorgplan is ${oproep.contact.metingen.map((m) => m.naam).join(', ')} ` +
      `toe aan herhaling op ${oproep.contact.datum}.`,
    voorstel: {
      type: 'verstuur-uitnodiging',
      omschrijving: oproep.toelichting,
      payload: { kanaal: oproep.kanaal, contactId: oproep.contact.id, datum: oproep.contact.datum },
      bulkVeilig: true,
    },
    toegewezenAan: { rol: 'poh-s' },
    vervaltOp: oproep.escalatieOp,
    bron: 'protocol',
    herkomst,
  }));
}
