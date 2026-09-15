/** FHIR R4 primitieven en datatypes — de subset die dit systeem gebruikt. */

/** ISO 8601, bijv. '2026-09-15T09:20:00+02:00' */
export type FhirDateTime = string;
/** ISO 8601 datum, bijv. '1958-04-02' */
export type FhirDate = string;

export interface Coding {
  system: string;
  code: string;
  display?: string;
  /** Versie van het codesysteem waartegen is geregistreerd. Verplicht bij SNOMED. */
  version?: string;
  userSelected?: boolean;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Reference {
  reference: string;
  display?: string;
  type?: string;
}

export interface Identifier {
  system: string;
  value: string;
  use?: 'usual' | 'official' | 'temp' | 'secondary';
}

export interface Quantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
  comparator?: '<' | '<=' | '>=' | '>';
}

export interface Period {
  start?: FhirDateTime;
  end?: FhirDateTime;
}

export interface Annotation {
  text: string;
  authorReference?: Reference;
  time?: FhirDateTime;
}

export interface DomainResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: FhirDateTime;
    profile?: string[];
  };
}
