import type {
  Appointment, Condition, Deelcontact, Encounter, EpisodeOfCare,
  Flag, MedicationStatement, Observation, Patient, Task,
} from './resources.js';
import { isKlinischGeldig } from './herkomst.js';

/**
 * Het dossier als samenhangend geheel — de invoer voor alle klinische regels.
 * Dit is een *view* over FHIR-resources, geen alternatief model (docs/01 §3).
 */
export interface Dossier {
  patient: Patient;
  episodes: EpisodeOfCare[];
  condities: Condition[];
  contacten: Encounter[];
  deelcontacten: Deelcontact[];
  observaties: Observation[];
  medicatie: MedicationStatement[];
  markeringen: Flag[];
  taken: Task[];
  afspraken: Appointment[];
}

export function leegDossier(patient: Patient): Dossier {
  return {
    patient,
    episodes: [], condities: [], contacten: [], deelcontacten: [],
    observaties: [], medicatie: [], markeringen: [], taken: [], afspraken: [],
  };
}

export function leeftijd(dossier: Dossier, op: Date = new Date()): number {
  const geb = new Date(dossier.patient.geboortedatum);
  let jaar = op.getFullYear() - geb.getFullYear();
  const m = op.getMonth() - geb.getMonth();
  if (m < 0 || (m === 0 && op.getDate() < geb.getDate())) jaar--;
  return jaar;
}

export function actieveEpisodes(dossier: Dossier): EpisodeOfCare[] {
  return dossier.episodes.filter((e) => e.status === 'active');
}

/**
 * Laatste klinisch geldige meting voor een code. Onbevestigde AI-suggesties
 * worden hier gefilterd — de filter zit in de datalaag, niet in beleid (docs/07 §5).
 */
export function laatsteMeting(dossier: Dossier, code: string): Observation | undefined {
  return dossier.observaties
    .filter((o) => o.status !== 'entered-in-error')
    .filter((o) => isKlinischGeldig(o.herkomst))
    .filter((o) => o.code.coding?.some((c) => c.code === code))
    .sort((a, b) => b.effectief.localeCompare(a.effectief))[0];
}

export function metingReeks(dossier: Dossier, code: string): Observation[] {
  return dossier.observaties
    .filter((o) => o.status !== 'entered-in-error')
    .filter((o) => isKlinischGeldig(o.herkomst))
    .filter((o) => o.code.coding?.some((c) => c.code === code))
    .sort((a, b) => a.effectief.localeCompare(b.effectief));
}

export function numeriekeWaarde(o: Observation | undefined): number | undefined {
  if (!o || !o.waarde) return undefined;
  const w = o.waarde as { value?: number };
  return typeof w.value === 'number' ? w.value : undefined;
}

/** Leeftijd van een meting in dagen; Infinity als de meting ontbreekt. */
export function metingOuderdomDagen(
  dossier: Dossier, code: string, peildatum: Date = new Date(),
): number {
  const o = laatsteMeting(dossier, code);
  if (!o) return Infinity;
  return Math.floor((peildatum.getTime() - new Date(o.effectief).getTime()) / 86_400_000);
}
