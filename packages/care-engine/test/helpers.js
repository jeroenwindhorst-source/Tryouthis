/** Synthetische dossiers voor de tests. Nooit productiedata (docs/07 §4). */
export const HERKOMST = {
  bron: 'zorgverlener',
  vastgelegdOp: '2026-01-10T10:00:00+01:00',
  auteurId: 'zv-1',
  auteurRol: 'poh-s',
};

export function maakDossier({
  geboortedatum = '1958-04-02', episodes = [], observaties = [], medicatie = [], markeringen = [],
} = {}) {
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
      waarde: o.code === '72166-2'
        ? { code: { system: 'http://snomed.info/sct', code: o.snomed, display: o.display } }
        : { value: o.waarde, unit: o.eenheid ?? '' },
      status: 'final',
      herkomst: o.herkomst ?? HERKOMST,
    })),
    medicatie: medicatie.map((m, i) => ({
      resourceType: 'MedicationStatement',
      id: `med-${i + 1}`,
      patientId: 'pat-1',
      middel: { coding: [{ system: 'http://www.whocc.no/atc', code: m.atc }], text: m.naam },
      dosering: m.dosering ?? '1dd1',
      chronisch: m.chronisch ?? true,
      status: 'active',
      herkomst: HERKOMST,
    })),
    markeringen: markeringen.map((t, i) => ({
      resourceType: 'Flag', id: `flag-${i + 1}`, patientId: 'pat-1',
      soort: 'ruiter', tekst: t, actief: true, herkomst: HERKOMST,
    })),
    taken: [],
    afspraken: [],
  };
}

/** Diabetes + hypertensie + COPD: de casus waar drie losse trajecten ontstaan. */
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

/** Alles al jaren op streefwaarde — de patiënt die minder zorg nodig heeft. */
export function stabielDossier() {
  return maakDossier({
    geboortedatum: '1962-05-20',
    episodes: [{ titel: 'Diabetes mellitus type 2', icpc: 'T90.02' }],
    observaties: [
      { code: '59261-8', waarde: 46, eenheid: 'mmol/mol', op: '2025-09-01T09:00:00+02:00' },
      { code: '59261-8', waarde: 47, eenheid: 'mmol/mol', op: '2026-02-01T09:00:00+01:00' },
      { code: '59261-8', waarde: 45, eenheid: 'mmol/mol', op: '2026-08-01T09:00:00+02:00' },
      { code: '8480-6', waarde: 126, eenheid: 'mmHg', op: '2026-02-01T09:00:00+01:00' },
      { code: '8480-6', waarde: 128, eenheid: 'mmHg', op: '2026-08-01T09:00:00+02:00' },
    ],
  });
}
