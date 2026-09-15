import type { Coding } from '@zpe/fhir-model';

/**
 * Het harde onderscheid uit docs/02 §2. Dit is geen UI-vlag maar een
 * eigenschap van het concept zelf, en bepaalt of je erin mag registreren.
 */
export type RegistratieNiveau =
  /** ICPC-1 NL + de gekoppelde NHG-referentieset. Hierin registreert de huisarts. */
  | 'registratieset'
  /** Binnen de NL-huisartsen-refset, specifieker dan ICPC. Registreerbaar met ICPC-paraplu. */
  | 'uitbreidingsset'
  /** De overige ~385.000 SNOMED-concepten. Ontvangbaar en toonbaar, niet registreerbaar. */
  | 'extern';

/** Volgt FHIR ConceptMap.equivalence — bewust behouden bij ontvangst (docs/02 §4). */
export type MappingKwaliteit =
  | 'exact' | 'ruimer' | 'nauwer' | 'gedeeltelijk' | 'geen';

export interface Concept {
  /** SNOMED conceptId. */
  snomed: string;
  /** Fully Specified Name (EN), voor eenduidigheid bij beheer. */
  fsn?: string;
  /** Nederlandse voorkeursterm — wat de zorgverlener ziet. */
  display: string;
  synoniemen?: string[];
  icpc1?: string;
  icpc1Display?: string;
  niveau: RegistratieNiveau;
  equivalentie?: MappingKwaliteit;
  /** IS-A ouders binnen SNOMED; gebruikt voor subsumptie bij ontvangst. */
  ouders?: string[];
  refsets?: string[];
  status: 'active' | 'inactive';
  /** Bij inactive: het opvolgende concept. Codes worden nooit verwijderd (docs/02 §7). */
  opvolger?: string;
  geldigVanaf?: string;
  geldigTot?: string;
}

/** Een registratie draagt altijd beide codes plus het niveau en de mappingkwaliteit. */
export interface GecodeerdConcept {
  icpc1?: Coding;
  snomed?: Coding;
  niveau: RegistratieNiveau;
  equivalentie?: MappingKwaliteit;
  /** Het onbewerkte origineel zoals ontvangen. Wordt nooit weggegooid (docs/02 §5). */
  origineel?: Coding[];
  tekst?: string;
}

export interface ZoekTreffer {
  concept: Concept;
  score: number;
  /** Waarom deze treffer matchte — maakt zoeken uitlegbaar. */
  reden: 'code' | 'voorkeursterm' | 'synoniem' | 'icpc' | 'deelwoord';
}

export interface ZoekOpties {
  /** Standaard alleen wat registreerbaar is. Breder zoeken is een bewuste actie. */
  niveaus?: RegistratieNiveau[];
  limiet?: number;
  /** Beperk tot een refset, bijv. 'huisarts-diagnose'. */
  refset?: string;
}

/** Uitkomst van het verwerken van een inkomende externe code (docs/02 §5). */
export interface OntvangstResultaat {
  gecodeerd: GecodeerdConcept;
  /** Wat de gebruiker te zien krijgt. */
  advies:
    | 'overnemen'                  // zit in onze eigen set
    | 'overnemen-met-paraplu'      // uitbreidingsset, toon met ICPC-parent
    | 'tonen-als-extern-met-context' // subsumptie gevonden
    | 'tonen-als-extern';          // geen relatie; origineel volledig bewaren
  /** De dichtstbijzijnde eigen code, als die er is. */
  context?: Concept;
  toelichting: string;
}
