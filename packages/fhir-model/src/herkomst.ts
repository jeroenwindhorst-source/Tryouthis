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
  /**
   * Bij bron 'extern-systeem': kwam dit binnen op een aanvraag van de praktijk zelf?
   *
   * Het verschil is bepalend en zit niet in het systeem maar in de aanleiding. Een
   * HbA1c die terugkomt op een labaanvraag die deze praktijk heeft uitgezet, is werk
   * van deze praktijk: zij heeft hem besteld en is verantwoordelijk voor de opvolging.
   * Een bloeddruk uit een ziekenhuisbrief of een BgZ-overdracht is dat niet — die is
   * bruikbaar in het beeld, maar vult geen ketenindicator van deze praktijk.
   *
   * Zonder dit kenmerk zou elke labuitslag onder 'niet zelf geregistreerd' vallen, en
   * omdat HbA1c en LDL vrijwel altijd uit het lab komen, zou vrijwel geen enkele
   * ketenindicator ooit gevuld raken.
   */
  opEigenAanvraag?: boolean;
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

/**
 * Is dit een registratie van de praktijk zelf?
 *
 * Een thuisgemeten bloeddruk of een gewicht dat de patiënt doorgeeft, is een echte en
 * bruikbare waarde — vaak zelfs betrouwbaarder dan de praktijkmeting. Maar het is geen
 * registratie van de praktijk, en voor een ketenindicator of een declaratie is dat
 * verschil bepalend. Wie dat onderscheid weglaat, declareert werk dat een ander deed.
 *
 * Het onderscheid is dus geen oordeel over de kwaliteit van de waarde. Het is het
 * antwoord op de vraag: wie heeft dit vastgelegd, en waarvoor mag het meetellen.
 */
export function isEigenRegistratie(h: Herkomst): boolean {
  if (h.bron === 'zorgverlener' || h.bron === 'apparaat') return true;
  if (h.bron === 'ai-suggestie') return Boolean(h.ai?.bevestigdDoor);
  // Een uitslag op een eigen aanvraag telt mee; wat van elders binnenkomt niet.
  if (h.bron === 'extern-systeem') return h.opEigenAanvraag === true;
  return false;
}
