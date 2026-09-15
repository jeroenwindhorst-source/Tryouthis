/** Bouwt een synthetisch dossier voor de tests. Geen productiedata — nooit (docs/07 §4). */
export const HERKOMST = {
  bron: 'zorgverlener',
  vastgelegdOp: '2026-01-10T10:00:00+01:00',
  auteurId: 'zv-1',
  auteurRol: 'poh-s',
};

export function maakDossier({ geboortedatum = '1958-04-02', episodes = [], observaties = [] } = {}) {
  return {
    patient: {
      resourceType: 'Patient',
      id: 'pat-1',
      identifier: [{ system: 'http://fhir.nl/fhir/NamingSystem/bsn', value: '999999011' }],
      naam: { voornaam: 'Test', achternaam: 'Patiënt' },
      geboortedatum,
      geslacht: 'female',
      portaalActief: true,
      communicatievoorkeur: 'portaal',
    },
    episodes: episodes.map((e, i) => ({
      resourceType: 'EpisodeOfCare',
      id: `ep-${i + 1}`,
      patientId: 'pat-1',
      status: 'active',
      titel: e.titel,
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icpc-1-nl', code: e.icpc, display: e.titel }] },
      periode: { start: e.start ?? '2019-03-11' },
      herkomst: HERKOMST,
    })),
    condities: [],
    contacten: [],
    deelcontacten: [],
    observaties: observaties.map((o, i) => ({
      resourceType: 'Observation',
      id: `obs-${i + 1}`,
      patientId: 'pat-1',
      code: { coding: [{ system: 'http://loinc.org', code: o.code }] },
      effectief: o.op,
      waarde: { value: o.waarde, unit: o.eenheid ?? '' },
      status: 'final',
      herkomst: o.herkomst ?? HERKOMST,
    })),
    medicatie: [],
    markeringen: [],
    taken: [],
    afspraken: [],
  };
}

/** Patiënt met DM2 + hypertensie + COPD — de casus uit docs/04 §2. */
export function multimorbideDossier() {
  return maakDossier({
    geboortedatum: '1955-02-01',
    episodes: [
      { titel: 'Diabetes mellitus type 2', icpc: 'T90.02' },
      { titel: 'Hypertensie zonder orgaanbeschadiging', icpc: 'K86' },
      { titel: 'Chronische bronchitis/COPD', icpc: 'R95' },
    ],
    observaties: [
      { code: '59261-8', waarde: 71, eenheid: 'mmol/mol', op: '2026-08-01T09:00:00+02:00' },
      { code: '8480-6', waarde: 148, eenheid: 'mmHg', op: '2026-08-01T09:00:00+02:00' },
      { code: '29463-7', waarde: 88, eenheid: 'kg', op: '2026-08-01T09:00:00+02:00' },
      { code: 'ccq-totaal', waarde: 1.8, op: '2026-06-15T09:00:00+02:00' },
    ],
  });
}
