/**
 * Toegang tot de praktijklaag. Geen klinische logica hier — die hoort in care-engine.
 *
 * Twee smaken, dezelfde interface:
 *  - **lokaal** (standaard): de motor draait in de browser. Geen server nodig.
 *  - **http**: praat met de Fastify-API, dezelfde endpoints die externe partijen zien.
 *
 * Kies http met `VITE_BACKEND=http npm run web`.
 */

import { lokaleApi } from './lokaal';

async function haal<T>(pad: string): Promise<T> {
  const antwoord = await fetch(pad);
  if (!antwoord.ok) throw new Error(`${antwoord.status} ${antwoord.statusText} bij ${pad}`);
  return antwoord.json() as Promise<T>;
}

async function stuur<T>(pad: string, body: unknown): Promise<T> {
  const antwoord = await fetch(pad, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!antwoord.ok) throw new Error(`${antwoord.status} ${antwoord.statusText} bij ${pad}`);
  return antwoord.json() as Promise<T>;
}

export type Ernst = 'informatief' | 'aandacht' | 'urgent';

export interface Signaal { soort: string; ernst: Ernst; tekst: string; module?: string }

export interface ModuleChip { id: string; naam: string; icoon: string }

export interface SuggestieActie {
  id: string; label: string; aard: 'primair' | 'alternatief' | 'afwijzen'; gevolg: string;
}

export interface Suggestie {
  id: string; regelId: string; regelVersie: string; patientId: string;
  soort: string; titel: string; bevinding: string; onderbouwing: string;
  richtlijn?: { naam: string; paragraaf?: string };
  ernst: Ernst; klasse: 'logistiek' | 'klinisch'; automatisch: boolean;
  rol: string; acties: SuggestieActie[];
}

export interface Processtap {
  id: 'voorbereiden' | 'spreekuur' | 'monitoren' | 'afronden';
  naam: string; omschrijving: string; watZieIk: string; aantal: number; aandacht: number;
}

export interface Dagstart {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  stappen: Processtap[];
  automatisering: {
    graad: number;
    vandaagAutomatisch: { titel: string; aantal: number; toelichting: string }[];
    wachtOpJou: number;
  };
  urgent: { patientId: string; naam: string; titel: string; bevinding: string }[];
}

export interface Voorbereiding {
  tijd: string; patientId: string; naam: string; leeftijd: number; soort: string;
  modules: ModuleChip[]; compleet: boolean; binnen: string[]; ontbreekt: string[];
  signalen: Signaal[];
  gespreksonderwerpen: { titel: string; bevinding: string; ernst: Ernst }[];
  doelen: { tekst: string }[];
}

export interface MonitoringRegel {
  patientId: string; naam: string; leeftijd: number;
  modules: ModuleChip[]; signalen: Signaal[]; suggesties: Suggestie[];
}

export interface InstroomRegel {
  patientId: string; naam: string; leeftijd: number;
  nieuweModules: { moduleId: string; naam: string; icoon: string; onderbouwing: string }[];
  gevolgen: string[];
  ketens: { naam: string; prestatiecode: string }[];
}

export type Invoer =
  | { soort: 'getal'; eenheid?: string }
  | { soort: 'keuze'; opties: { code: string; label: string }[] }
  | { soort: 'verrichting' }
  | { soort: 'vragenlijst'; vragenlijstId: string };

export interface GeplandItem {
  code: string; naam: string; invoer: Invoer;
  modules: string[]; intervalDagen: number; intervalReden: string;
  duurMinuten: number; zelfAanleverbaar?: boolean; labVooraf?: boolean; vragenlijst?: string;
  laatsteWaarde?: number; laatsteOp?: string; vervaltOp: string;
}

export interface GeplandContact {
  id: string; datum: string; soort: 'controle' | 'uitgebreide-controle'; rol: string;
  modules: string[]; metingen: GeplandItem[]; duurMinuten: number;
  labVooraf: string[]; vragenlijsten: string[];
}

export interface ActieveModule {
  id: string; naam: string; omschrijving: string; icoon: string;
  herkomst: 'automatisch' | 'handmatig-aan' | 'handmatig-uit' | 'niet-relevant';
  onderbouwing: string; rol: string;
  items: Omit<GeplandItem, 'vervaltOp'>[];
  richtlijnen: { naam: string; versie: string }[];
}

export interface Ketenbijdrage {
  ketenId: string; naam: string; grondslag: string;
  declaratie: { prestatiecode: string; omschrijving: string };
  gedektDoorModules: string[];
  indicatoren: { code: string; naam: string; voldaan: boolean; toelichting: string }[];
  volledigheid: number;
}

export interface Zorgplan {
  patientId: string; intensiteit: string;
  modules: ActieveModule[];
  nietActief: { id: string; naam: string; herkomst: string; onderbouwing: string }[];
  contacten: GeplandContact[];
  doelen: { id: string; tekst: string; gekoppeldeModules: string[]; afgesprokenOp: string }[];
  vergelijking: {
    traditioneleTrajecten: string[]; traditioneleContacten: number; geintegreerdeContacten: number;
    bespaardeContacten: number; bespaardeMinuten: number;
    valtBuitenKeten: boolean; extraOnderwerpen: string[];
  };
  ketens: Ketenbijdrage[];
  toelichting: string[];
  consequenties: string[];
}

export interface PersoonlijkPlan {
  patientId: string; intensiteit: string;
  moduleKeuzes: { moduleId: string; aan: boolean; reden: string; door: string; op: string }[];
  itemKeuzes: { code: string; intervalDagen: number; reden: string }[];
  doelen: { id: string; tekst: string; gekoppeldeModules: string[]; afgesprokenOp: string }[];
  voorkeuren: { maxContactenPerJaar?: number; liefstThuismeting?: boolean };
}

export interface PatientOverzicht {
  patient: { id: string; naam: string; leeftijd: number; geboortedatum: string; geslacht: string; bsn?: string; portaalActief?: boolean };
  episodes: { id: string; titel: string; status: string; icpc?: string; start?: string }[];
  medicatie: { naam: string; atc?: string; dosering: string; chronisch: boolean }[];
  metingen: { code: string; naam: string; laatste?: number; eenheid?: string; op?: string; reeks: { op: string; waarde?: number }[] }[];
  signalen: Signaal[];
  zorgplan: Zorgplan;
  persoonlijk: PersoonlijkPlan;
  suggesties: Suggestie[];
  automatisering: { automatischUitgevoerd: Suggestie[]; wachtOpMens: Suggestie[]; automatiseringsgraad: number };
  oproepen: { uitnodigenOp: string; kanaal: string; escalatieOp: string; toelichting: string }[];
  instroom: { nieuw: { moduleId: string; naam: string; onderbouwing: string }[] };
}

export interface RegistratieUitkomst {
  vastgelegd: { code: string; naam: string; waarde: number | string }[];
  verantwoordingGevuld: { keten: string; indicator: string }[];
  vervolg: string[];
}

export interface Praktijksamenvatting {
  patienten: number; metChronischeZorg: number; binnenKeten: number; buitenKeten: number;
  meerdereTrajecten: number; contactenTraditioneel: number; contactenGeintegreerd: number;
  minderContactenPerJaar: number; verschilConsulttijdUren: number;
  extraOnderwerpen: { naam: string; aantal: number }[];
  modules: { naam: string; aantal: number }[];
}

export interface Protocol {
  toelichting: string; regelsetVersie: string;
  modules: {
    id: string; naam: string; omschrijving: string; icoon: string; rol: string;
    richtlijnen: { naam: string; versie: string }[]; relevantie: string;
    items: {
      code: string; naam: string; basisIntervalDagen: number;
      zelfAanleverbaar?: boolean; labVooraf?: boolean;
      intervalRegels: { factor: number; reden: string }[];
    }[];
  }[];
  ketens: { id: string; naam: string; modules: string[]; declaratie: { prestatiecode: string; omschrijving: string } }[];
}

export interface Afsluiting {
  datum: string;
  punten: { categorie: string; omschrijving: string; aantal: number; blokkerend: boolean; bulkVeilig: boolean; toelichting: string }[];
  afgerond: boolean;
}

export interface Treffer {
  concept: {
    snomed: string; display: string; icpc1?: string; icpc1Display?: string;
    niveau: 'registratieset' | 'uitbreidingsset' | 'extern'; fsn?: string;
  };
  score: number; reden: string;
}

export interface Ontvangst {
  advies: string; toelichting: string;
  context?: { display: string; icpc1?: string };
  gecodeerd: { niveau: string; icpc1?: { code: string; display?: string }; snomed?: { code: string; display?: string } };
}

const httpApi = {
  dagstart: () => haal<Dagstart>('/api/poh/dagstart'),
  voorbereiding: () => haal<Voorbereiding[]>('/api/poh/voorbereiding'),
  monitoring: () => haal<MonitoringRegel[]>('/api/poh/monitoring'),
  instroom: () => haal<InstroomRegel[]>('/api/poh/instroom'),
  afronden: () => haal<Afsluiting>('/api/poh/afronden'),
  praktijk: () => haal<Praktijksamenvatting>('/api/praktijk/samenvatting'),
  protocol: () => haal<Protocol>('/api/protocol'),
  patient: (id: string) => haal<PatientOverzicht>(`/api/patient/${id}`),
  suggestie: (patientId: string, regelId: string, actieId: string, reden?: string) =>
    stuur<PatientOverzicht>(`/api/patient/${patientId}/suggestie`, { regelId, actieId, reden }),
  plan: (patientId: string, wijziging: Partial<PersoonlijkPlan>) =>
    stuur<PatientOverzicht>(`/api/patient/${patientId}/plan`, wijziging),
  consult: (patientId: string, registratie: {
    metingen: { code: string; waarde?: number; keuze?: { code: string; display?: string } }[];
    soep?: Record<string, string>;
    episodeId?: string;
  }) => stuur<{ uitkomst: RegistratieUitkomst; overzicht: PatientOverzicht }>(
    `/api/patient/${patientId}/consult`, registratie),
  accepteerModule: (patientId: string, moduleId: string) =>
    stuur<PatientOverzicht>('/api/poh/instroom/accepteer', { patientId, moduleId }),
  zoek: (q: string, breed: boolean) =>
    haal<{ waarschuwing: string; treffers: Treffer[] }>(`/api/terminologie/zoek?q=${encodeURIComponent(q)}&breed=${breed}`),
  ontvang: (code: string, display: string) =>
    stuur<Ontvangst>('/api/terminologie/ontvang', {
      codings: [{ system: 'http://snomed.info/sct', code, display }], bron: 'Ziekenhuis (demo)',
    }),
};

/**
 * De browserversie importeert de hele domeinlaag; dat mag alleen als hij ook gebruikt
 * wordt, anders zit die code voor niets in de http-bundel. Vite schudt dat er niet uit
 * bij een statische import, dus de keuze valt hier expliciet.
 */
export const api: typeof httpApi =
  import.meta.env.VITE_BACKEND === 'http' ? httpApi : (lokaleApi as unknown as typeof httpApi);

export const MODULE_NAAM: Record<string, string> = {
  glucose: 'Glucose', vaatrisico: 'Vaatrisico', nierfunctie: 'Nierfunctie',
  ademhaling: 'Longen', leefstijl: 'Leefstijl', mentaal: 'Mentaal',
  medicatieveiligheid: 'Medicatie', kwetsbaarheid: 'Kwetsbaarheid',
};
