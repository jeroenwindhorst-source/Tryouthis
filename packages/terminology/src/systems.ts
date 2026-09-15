/** Canonieke URI's van de codesystemen die dit systeem gebruikt. */
export const SYSTEEM = {
  icpc1nl: 'http://hl7.org/fhir/sid/icpc-1-nl',
  snomed: 'http://snomed.info/sct',
  loinc: 'http://loinc.org',
  /** NHG-tabel 45, diagnostische bepalingen. */
  nhgTabel45: 'urn:oid:2.16.840.1.113883.2.4.4.32.45',
  atc: 'http://www.whocc.no/atc',
} as const;

export type SysteemUri = (typeof SYSTEEM)[keyof typeof SYSTEEM];

/** De SNOMED CT NL-editie. Elke registratie legt de release vast (docs/02 §7). */
export const SNOMED_EDITIE = 'http://snomed.info/sct/11000146104';
