import type { FhirDateTime } from './primitives.js';

/**
 * Herkomst van een klinische registratie. Verplicht op elke registratie.
 * Zie docs/03 §3 — zonder herkomst is AI-ondersteuning niet verantwoord en
 * is de MDR/AI Act-verantwoording niet sluitend.
 */
export type HerkomstBron =
  | 'zorgverlener'
  | 'patient'
  | 'ai-suggestie'
  | 'extern-systeem'
  | 'apparaat';

export interface AiHerkomst {
  /** Naam én versie van het model, bijv. 'soep-extractie-2.3.1'. */
  model: string;
  /** 0..1 */
  vertrouwen: number;
  /** Verplicht vóór klinisch gebruik. Ontbreekt dit, dan is de registratie een voorstel. */
  bevestigdDoor?: string;
  bevestigdOp?: FhirDateTime;
  /** Wat het model oorspronkelijk voorstelde, vóór correctie door een mens. */
  origineleSuggestie?: unknown;
}

export interface Herkomst {
  bron: HerkomstBron;
  vastgelegdOp: FhirDateTime;
  auteurId: string;
  auteurRol: Rol;
  /** Bij bron 'extern-systeem': welk systeem, met AGB/URA waar bekend. */
  systeem?: { naam: string; identificatie?: string };
  ai?: AiHerkomst;
}

export type Rol =
  | 'huisarts'
  | 'poh-s'
  | 'poh-ggz'
  | 'assistent'
  | 'waarnemer'
  | 'praktijkmanager'
  | 'patient'
  | 'systeem';

/**
 * Een registratie is klinisch geldig als hij niet van een onbevestigde AI-suggestie komt.
 * Onbevestigde suggesties tellen niet mee in indicatoren, populatiequeries of uitwisseling.
 */
export function isKlinischGeldig(h: Herkomst): boolean {
  if (h.bron !== 'ai-suggestie') return true;
  return Boolean(h.ai?.bevestigdDoor);
}
