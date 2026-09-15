/** Dunne client op de BFF. Geen klinische logica hier — die hoort in care-engine. */

async function haal<T>(pad: string): Promise<T> {
  const antwoord = await fetch(pad);
  if (!antwoord.ok) throw new Error(`${antwoord.status} ${antwoord.statusText} bij ${pad}`);
  return antwoord.json() as Promise<T>;
}

async function stuur<T>(pad: string, body: unknown): Promise<T> {
  const antwoord = await fetch(pad, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!antwoord.ok) throw new Error(`${antwoord.status} ${antwoord.statusText} bij ${pad}`);
  return antwoord.json() as Promise<T>;
}

export interface Signaal { soort: string; ernst: 'informatief' | 'aandacht' | 'urgent'; tekst: string }

export interface Dagregel {
  tijd: string; patientId: string; naam: string; leeftijd: number; soort: string;
  programmas: string[]; voorbereidingCompleet: boolean; ontbreekt: string[]; signalen: Signaal[];
}

export interface Dagstart {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  spreekuur: Dagregel[];
  samenvatting: { afspraken: number; vragenAandacht: number; voorbereidingIncompleet: number };
  werkvoorraad: { categorie: string; aantal: number; toelichting: string }[];
}

export interface MonitoringRegel {
  patientId: string; naam: string; leeftijd: number; programmas: string[];
  signalen: Signaal[]; voorstellen: { actie: string; omschrijving: string }[];
}

export interface Kandidaat {
  patientId: string; naam: string; leeftijd: number;
  programmaId: string; programmaNaam: string; onderbouwing: string; gevolgen: string[];
}

export interface BenodigdeMeting {
  code: string; naam: string; vervaltOp: string; programmas: string[];
  duurMinuten: number; zelfAanleverbaar?: boolean; labVooraf?: boolean;
  laatsteWaarde?: number; laatsteOp?: string;
}

export interface GeplandContact {
  id: string; datum: string; soort: 'controle' | 'jaarcontrole'; rol: string;
  programmas: string[]; metingen: BenodigdeMeting[]; duurMinuten: number;
  labVooraf: string[]; vragenlijsten: string[];
}

export interface Zorgplan {
  patientId: string; programmas: string[]; intensiteit: string;
  contacten: GeplandContact[];
  vergelijking: { zonderSamenvoeging: number; metSamenvoeging: number; bespaardeContacten: number; bespaardeMinuten: number };
  toelichting: string[];
}

export interface PatientOverzicht {
  patient: { id: string; naam: string; leeftijd: number; geboortedatum: string; geslacht: string; bsn?: string; portaalActief?: boolean };
  episodes: { id: string; titel: string; status: string; icpc?: string; snomed?: string; start?: string }[];
  metingen: { code: string; naam: string; laatste?: number; eenheid?: string; op?: string; reeks: { op: string; waarde?: number }[] }[];
  signalen: Signaal[];
  zorgplan: Zorgplan;
  oproepen: { uitnodigenOp: string; kanaal: string; escalatieOp: string; toelichting: string; contact: GeplandContact }[];
  inclusie: { beoordelingen: { programmaId: string; programmaNaam: string; status: string; onderbouwing: string }[] };
  intensiteit: string;
}

export interface Praktijksamenvatting {
  patienten: number; metZorgprogramma: number; multimorbide: number;
  contactenZonderSamenvoeging: number; contactenMetSamenvoeging: number;
  bespaardeContactenPerJaar: number; bespaardeUrenPerJaar: number;
}

export interface Treffer {
  concept: {
    snomed: string; display: string; icpc1?: string; icpc1Display?: string;
    niveau: 'registratieset' | 'uitbreidingsset' | 'extern'; synoniemen?: string[]; fsn?: string;
  };
  score: number; reden: string;
}

export interface Ontvangst {
  advies: string; toelichting: string;
  context?: { display: string; icpc1?: string };
  gecodeerd: { niveau: string; icpc1?: { code: string; display?: string }; snomed?: { code: string; display?: string } };
}

export const api = {
  dagstart: () => haal<Dagstart>('/api/poh/dagstart'),
  monitoring: () => haal<MonitoringRegel[]>('/api/poh/monitoring'),
  kandidaten: () => haal<Kandidaat[]>('/api/inclusie/kandidaten'),
  praktijk: () => haal<Praktijksamenvatting>('/api/praktijk/samenvatting'),
  patient: (id: string) => haal<PatientOverzicht>(`/api/patient/${id}`),
  besluit: (patientId: string, programmaId: string, besluit: 'includeer' | 'wijs-af') =>
    stuur<{ overzicht: PatientOverzicht }>('/api/inclusie/besluit', { patientId, programmaId, besluit }),
  intensiteit: (patientId: string, intensiteit: string) =>
    stuur<PatientOverzicht>(`/api/patient/${patientId}/intensiteit`, { intensiteit }),
  zoek: (q: string, breed: boolean) =>
    haal<{ waarschuwing: string; treffers: Treffer[] }>(`/api/terminologie/zoek?q=${encodeURIComponent(q)}&breed=${breed}`),
  ontvang: (code: string, display: string) =>
    stuur<Ontvangst>('/api/terminologie/ontvang', {
      codings: [{ system: 'http://snomed.info/sct', code, display }],
      bron: 'Ziekenhuis (demo)',
    }),
};

export const PROGRAMMA_NAAM: Record<string, string> = {
  dm2: 'DM2', cvrm: 'CVRM', copd: 'COPD',
};
