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
  richtlijn?: { naam: string; versie?: string; paragraaf?: string; url?: string; uitgever?: string };
  ernst: Ernst; klasse: 'logistiek' | 'klinisch'; automatisch: boolean;
  rol: string; acties: SuggestieActie[];
}

export interface Processtap {
  id: 'voorbereiden' | 'spreekuur' | 'monitoren' | 'afronden';
  naam: string; omschrijving: string; watZieIk: string; aantal: number; aandacht: number;
}

export type Afspraakstatus =
  'gepland' | 'aangemeld' | 'wachtkamer' | 'in-consult' | 'afgerond' | 'noshow';

export interface AgendaRegel {
  id: string; tijd: string; duurMinuten: number; soort: string; titel: string;
  patientId?: string; naam?: string; leeftijd?: number; reden?: string;
  modules: ModuleChip[]; aandacht?: string; voorbereid?: boolean; intakeKlaar?: boolean;
  status: Afspraakstatus; statusLabel: string; aangemeldVia?: string; aangemeldOm?: string;
}

export interface WachtkamerIntake {
  id: string; patientId: string; naam: string;
  app: { id: string; naam: string; leverancier: string };
  opgenomenOp: string; duurSeconden: number;
  hulpvraag: string; anamnese: string;
  codesuggesties: { icpc: string; display: string; vertrouwen: number }[];
  metingen: { code: string; naam: string; waarde: number; eenheid: string }[];
  bevestigd: boolean;
}

export interface Triageverzoek {
  id: string; patientId: string; naam: string; leeftijd: number;
  binnenOp: string; kanaal: string; hulpvraag: string;
  zelftriage?: { urgentie: string; bestemming: string; toelichting: string };
  status: string;
}

export interface Autorisatieverzoek {
  id: string; patientId: string; naam: string; soort: string;
  omschrijving: string; aanleiding: string;
  ingediendDoor: { naam: string; rol: string };
  ingediendOp: string; routine: boolean; redenGeenRoutine?: string; status: string;
}

export interface Autorisatiegroep {
  soort: string; titel: string; toelichting: string;
  routine: Autorisatieverzoek[]; vraagtOordeel: Autorisatieverzoek[];
}

export interface AssistentOverzicht {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  agenda: AgendaRegel[];
  stroom: { triageNieuw: number; viaPortaal: number; viaTelefoon: number; zelfzorgAfgevangen: number };
  autorisatieIngediend: number;
  triage: Triageverzoek[];
}

export interface HuisartsOverzicht {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  agenda: AgendaRegel[];
  autorisatie: { open: number; routine: number; vraagtOordeel: number; groepen: Autorisatiegroep[] };
  team: { rol: string; naam: string; registraties: number; toelichting: string }[];
}

export interface Gebruiker {
  id: string; gebruikersnaam: string; naam: string; initialen: string;
  rol: string; functie: string; identificatie: string;
  tweefactorActief: boolean; laatsteAanmelding?: string; actief: boolean; rechten: string[];
}

export interface Zoektreffer {
  patientId: string; naam: string; geboortedatum: string; leeftijd: number;
  bsn?: string; modules: ModuleChip[]; reden: string;
}

export interface JournaalRegel {
  datum: string; encounterId: string; episodeId: string;
  episodeTitel: string; episodeIcpc?: string;
  soort: string; auteur: string; auteurRol: string; bron: string;
  regels: { letter: string; tekst: string }[];
}

export interface ExterneSectie { naam: string; regels: { label: string; waarde: string }[] }

export interface ExternDocument {
  id: string; patientId: string;
  bron: { id: string; soort: string; naam: string; portaal?: { naam: string; url: string } };
  uitwisseling: string;
  datum: string; ontvangenOp: string;
  titel: string; samenvatting: string;
  secties: ExterneSectie[];
  episodeIcpc?: string; gelezen: boolean; opOnzeVerwijzing?: boolean;
}

export type Tijdlijnitem =
  | { soort: 'contact'; datum: string; contact: JournaalRegel }
  | { soort: 'extern'; datum: string; document: ExternDocument }
  | { soort: 'overleg'; datum: string; notitie: Overlegnotitie };

export interface Bron {
  id: string; aard: string; titel: string; toelichting: string; aantal: number;
  portaal?: { naam: string; url: string }; ongelezen?: number;
}

export interface DossierHistorie {
  journaal: JournaalRegel[];
  tijdlijn: Tijdlijnitem[];
  bronnen: Bron[];
  episodes: { id: string; titel: string; status: string; icpc?: string; start?: string; aantalContacten: number }[];
  aantalContacten: number;
  aantalExtern: number;
  ongelezenExtern: number;
  aantalOverleg: number;
}

export interface Meetreeks {
  code: string; naam: string; soort: 'lab' | 'lichamelijk' | 'vragenlijst' | 'verrichting';
  eenheid?: string; relevantNu: boolean;
  laatste?: number; laatsteOp?: string; verschil?: number;
  punten: { op: string; waarde: number; bron?: string }[];
  streef?: { onder?: number; boven?: number; label: string };
  vanPatient?: number;
}

export interface OrderRegel {
  id: string; soort: string; omschrijving: string; detail?: string; atc?: string;
  levert?: string[]; vereistRecht: string; standaardAan: boolean; toelichting?: string;
}

export interface Waarschuwing { ernst: string; tekst: string; bron?: string }

export interface VoorgesteldeOrderSet {
  set: {
    id: string; naam: string; waarvoor: string; module?: string;
    richtlijn?: { naam: string; versie?: string; paragraaf?: string; url?: string; uitgever?: string };
    regels: OrderRegel[];
  };
  onderbouwing: string;
  waarschuwingen: Waarschuwing[];
}

export interface Catalogustreffer {
  id: string; soort: 'medicatie' | 'lab' | 'verwijzing' | 'onderzoek' | 'afspraak';
  naam: string; detail: string; varianten: string[];
  atc?: string; levert?: string[]; route?: string;
  instellingen?: string[]; portaal?: { naam: string; url: string };
  bijRol?: string; duurMinuten?: number; vorm?: string;
  vereistRecht: string;
  waarschuwingen: Waarschuwing[];
}

export interface NieuweOrder {
  patientId: string; soort: string; omschrijving: string; detail?: string;
  atc?: string; route?: string; bestemming?: string;
  bijRol?: string; duurMinuten?: number; planroute?: string;
  uitSet?: { id: string; naam: string };
  richtlijn?: { naam: string; versie?: string; paragraaf?: string; url?: string; uitgever?: string };
  waarschuwingen?: Waarschuwing[]; levert?: string[]; vereistRecht: string;
}

export interface Order {
  id: string; patientId: string; soort: string; omschrijving: string;
  detail?: string; atc?: string; route?: string; bestemming?: string;
  uitSet?: { id: string; naam: string };
  richtlijn?: { naam: string; versie?: string; paragraaf?: string; url?: string; uitgever?: string };
  waarschuwingen: Waarschuwing[]; levert?: string[];
  geplaatstOp: string; geplaatstDoor: { id: string; naam: string; rol: string };
  status: 'ter-autorisatie' | 'geplaatst' | 'uitgevoerd' | 'afgewezen' | 'ingetrokken';
  afgehandeldOp?: string; afgehandeldDoor?: string; reden?: string; deelcontactId?: string;
}

export interface Orderoverzicht {
  openstaand: Order[];
  afgehandeld: Order[];
  voorstellen: VoorgesteldeOrderSet[];
  medicatie: { naam: string; atc?: string; dosering: string; chronisch: boolean }[];
}

export interface Bespreekpunt {
  id: string; patientId: string; naam: string;
  ingebrachtDoor: { id: string; naam: string; rol: string };
  ingebrachtOp: string; vraag: string; context?: string;
  voorRollen: string[]; status: string;
  uitkomst?: string; besprokenOp?: string; besprokenDoor?: string;
}

export interface Overleg {
  blok?: { tijd: string; duurMinuten: number; titel: string };
  open: Bespreekpunt[];
  besproken: Bespreekpunt[];
}

export type Planroute = 'zelf' | 'assistent' | 'portaal' | 'automatisch';

export interface Slot {
  id: string; rol: string; start: string; tijd: string; duurMinuten: number;
  patientPlanbaar: boolean; bestemd?: string;
}

export interface Afspraakverzoek {
  id: string; patientId: string; naam: string; voorRol: string;
  reden: string; duurMinuten: number; route: Planroute;
  status: 'open' | 'uitgezet' | 'ingepland' | 'geannuleerd';
  aangevraagdDoor: { id: string; naam: string; rol: string };
  aangevraagdOp: string; gewensteTermijn?: string; vragenlijst?: string;
  ingepland?: { start: string; duurMinuten: number; rol: string };
  portaalVerstuurdOp?: string; toelichting?: string;
}

export type Routeuitleg = Record<string, { label: string; uitleg: string }>;

export interface Planbord {
  rol: string; agenda: AgendaRegel[]; slots: Slot[];
  vrij: number; patientPlanbaar: number;
  teplannen: Afspraakverzoek[]; routes: Routeuitleg;
}

export interface Praktijkplanbord {
  datum: string;
  kolommen: { rol: string; agenda: AgendaRegel[]; slots: Slot[] }[];
  teplannen: Afspraakverzoek[]; routes: Routeuitleg;
}

export interface Beleidsafspraak {
  id: string; patientId: string; soort: string; besluit: string;
  samenvatting: string; besprokenMet: string;
  vastgelegdOp: string; vastgelegdDoor: { naam: string; rol: string };
  evaluatieOp?: string; toelichting?: string;
}

export interface Overlegnotitie {
  id: string; patientId: string; op: string; vraag: string; context?: string;
  uitkomst: string; ingebrachtDoor: string; besprokenDoor: string; deelnemers: string[];
}

export interface Praktijkrapportage {
  datum: string;
  populatie: {
    ingeschreven: number; metZorgvraag: number; zonderKeten: number;
    modules: { naam: string; aantal: number }[];
  };
  ketens: {
    naam: string; prestatiecode: string; patienten: number; volledig: number;
    percentage: number; knelpunten: { naam: string; aantal: number }[];
  }[];
  werkvoorraad: {
    autorisatiesOpen: number; autorisatiesRoutine: number; triageOpen: number;
    teplannen: number; bespreekpunten: number;
  };
  bezetting: {
    rol: string; afspraken: number; geboekteMinuten: number; vrijeSlots: number; noshow: number;
  }[];
}

export interface Gesprek {
  id: string; soort: 'collega' | 'patient'; onderwerp: string; deelnemers: string[];
  patientId?: string; patientNaam?: string;
  kanaal?: string; dossierwaardig?: boolean;
  aanleiding?: { soort: string; tekst: string };
  urgent: boolean;
  berichten: {
    id: string; vanId: string; van: string; tekst: string; op: string;
    gelezen: boolean; vanPatient?: boolean;
  }[];
}

export interface Berichtenbox {
  gesprekken: Gesprek[];
  collega: Gesprek[];
  patient: Gesprek[];
  ongelezen: number;
  ongelezenPatient: number;
}

export interface Beheer {
  lagen: { niveau: string; naam: string; beheerder: string; gewijzigdOp: string; uitleg: string; instellingen: string[] }[];
  instellingen: { sleutel: string; waarde: unknown; niveau: string; bron: string; overschreven: { niveau: string; bron: string }[] }[];
}

export interface Dagstart {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  agenda: AgendaRegel[];
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
  zelfredzaamheid?: { gemiddelde: number; niveau: string; knelpunten: string[] };
  intake?: WachtkamerIntake;
}

export interface MonitoringRegel {
  patientId: string; naam: string; leeftijd: number;
  modules: ModuleChip[]; signalen: Signaal[]; suggesties: Suggestie[];
  zelfredzaamheid?: { gemiddelde: number; niveau: string; richting?: string };
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

export interface Zelfredzaamheidsbeeld {
  gemiddelde: number; niveau: string; factor: number; betekenis: string;
  knelpunten: { domein: { id: string; naam: string; zorgbetekenis: string }; score: number }[];
  sterk: { domein: { id: string; naam: string }; score: number }[];
  digitaalBereikbaar: boolean; raaktModules: string[];
  trend?: { verschil: number; richting: string };
  bijgesteld?: {
    berekendNiveau: string; berekendeFactor: number; reden: string; door: string; op: string;
  };
}

export interface Zorgplan {
  patientId: string; intensiteit: string;
  zelfredzaamheid?: Zelfredzaamheidsbeeld;
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
  zelfredzaamheid?: {
    scores: Record<string, number>; afgenomenOp: string; afgenomenDoor: string;
    vorige?: { gemiddelde: number; afgenomenOp: string }; toelichting?: string;
    bijstelling?: { niveau: string; reden: string; door: string; op: string };
  };
  moduleKeuzes: { moduleId: string; aan: boolean; reden: string; door: string; op: string }[];
  itemKeuzes: { code: string; intervalDagen: number; reden: string }[];
  doelen: { id: string; tekst: string; gekoppeldeModules: string[]; afgesprokenOp: string }[];
  voorkeuren: { maxContactenPerJaar?: number; liefstThuismeting?: boolean };
}

export interface PatientOverzicht {
  patient: { id: string; naam: string; leeftijd: number; geboortedatum: string; geslacht: string; bsn?: string; portaalActief?: boolean };
  episodes: { id: string; titel: string; status: string; icpc?: string; start?: string }[];
  medicatie: { naam: string; atc?: string; dosering: string; chronisch: boolean }[];
  metingen: { code: string; naam: string; laatste?: number; eenheid?: string; op?: string; bron?: string; reeks: { op: string; waarde?: number }[] }[];
  signalen: Signaal[];
  zorgplan: Zorgplan;
  persoonlijk: PersoonlijkPlan;
  suggesties: Suggestie[];
  automatisering: { automatischUitgevoerd: Suggestie[]; wachtOpMens: Suggestie[]; automatiseringsgraad: number };
  oproepen: { uitnodigenOp: string; kanaal: string; escalatieOp: string; toelichting: string }[];
  instroom: { nieuw: { moduleId: string; naam: string; onderbouwing: string }[] };
  intake?: WachtkamerIntake;
  beleid: Beleidsafspraak[];
  autorisaties: Autorisatieverzoek[];
  planverzoeken: Afspraakverzoek[];
  volgendeAfspraak?: { id: string; start: string; duurMinuten: number; rol: string; titel: string; reden?: string };
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
    richtlijnen: { naam: string; versie: string; url?: string; uitgever?: string }[]; relevantie: string;
    items: {
      code: string; naam: string; basisIntervalDagen: number;
      zelfAanleverbaar?: boolean; labVooraf?: boolean;
      intervalRegels: { factor: number; reden: string }[];
    }[];
  }[];
  ketens: { id: string; naam: string; modules: string[]; declaratie: { prestatiecode: string; omschrijving: string } }[];
}

export interface Afsluititem {
  id: string; patientId?: string; naam: string; actie: string; detail: string;
}

export interface Afsluiting {
  datum: string;
  punten: {
    categorie: string; omschrijving: string; aantal: number;
    blokkerend: boolean; bulkVeilig: boolean; toelichting: string;
    items: Afsluititem[];
  }[];
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
  assistent: () => haal<AssistentOverzicht>('/api/assistent/overzicht'),
  huisarts: () => haal<HuisartsOverzicht>('/api/huisarts/overzicht'),
  agenda: (rol: string) => haal<AgendaRegel[]>(`/api/agenda/${rol}`),
  beheer: () => haal<Beheer>('/api/beheer'),
  intakes: () => haal<WachtkamerIntake[]>('/api/intakes'),
  handelTriageAf: (id: string) => stuur<AssistentOverzicht>(`/api/triage/${id}/afhandelen`, {}),
  accordeer: (ids: string[]) => stuur<HuisartsOverzicht>('/api/autorisatie/accordeer', { ids }),
  wijsAutorisatieAf: (id: string, reden: string) =>
    stuur<HuisartsOverzicht>(`/api/autorisatie/${id}/afwijzen`, { reden }),
  bevestigIntake: (id: string) =>
    stuur<{ intake: WachtkamerIntake }>(`/api/intake/${id}/bevestig`, {}),
  protocol: () => haal<Protocol>('/api/protocol'),
  patient: (id: string) => haal<PatientOverzicht>(`/api/patient/${id}`),
  suggestie: (patientId: string, regelId: string, actieId: string, reden?: string) =>
    stuur<PatientOverzicht>(`/api/patient/${patientId}/suggestie`, { regelId, actieId, reden }),
  plan: (patientId: string, wijziging: Partial<PersoonlijkPlan>) =>
    stuur<PatientOverzicht>(`/api/patient/${patientId}/plan`, wijziging),
  consult: (patientId: string, registratie: {
    metingen: {
      code: string; waarde?: number; keuze?: { code: string; display?: string };
      bron?: 'praktijk' | 'patient';
    }[];
    soep?: Record<string, string>;
    episodeId?: string;
    gebruikerId?: string;
  }) => stuur<{ uitkomst: RegistratieUitkomst; overzicht: PatientOverzicht }>(
    `/api/patient/${patientId}/consult`, registratie),
  accepteerModule: (patientId: string, moduleId: string) =>
    stuur<PatientOverzicht>('/api/poh/instroom/accepteer', { patientId, moduleId }),
  zoekTerm: (q: string, breed: boolean) =>
    haal<{ waarschuwing: string; treffers: Treffer[] }>(`/api/terminologie/zoek?q=${encodeURIComponent(q)}&breed=${breed}`),

  aanmelden: (gebruikersnaam: string, wachtwoord: string) =>
    stuur<{ stap: 'tweefactor'; gebruiker: Gebruiker }>('/api/aanmelden', { gebruikersnaam, wachtwoord }),
  tweefactor: (code: string) => stuur<{ geldig: boolean }>('/api/tweefactor', { code }),
  gebruikers: () => haal<Gebruiker[]>('/api/gebruikers'),

  zoek: (q: string) => haal<Zoektreffer[]>(`/api/zoek?q=${encodeURIComponent(q)}`),
  maakEpisode: (patientId: string, code: { icpc: string; snomed?: string; display: string }) =>
    stuur<{ episodeId: string; overzicht: PatientOverzicht }>(`/api/patient/${patientId}/episode`, code),
  historie: (patientId: string, bronId?: string) =>
    haal<DossierHistorie>(`/api/patient/${patientId}/historie${bronId ? `?bron=${encodeURIComponent(bronId)}` : ''}`),
  meetreeksen: (patientId: string) => haal<Meetreeks[]>(`/api/patient/${patientId}/meetreeksen`),
  orders: (patientId: string) => haal<VoorgesteldeOrderSet[]>(`/api/patient/${patientId}/orders`),
  orderOverzicht: (patientId: string) => haal<Orderoverzicht>(`/api/patient/${patientId}/orderoverzicht`),
  zoekOrders: (patientId: string, vraag: string, soorten?: string[]) =>
    haal<Catalogustreffer[]>(
      `/api/patient/${patientId}/catalogus?q=${encodeURIComponent(vraag)}`
      + (soorten?.length ? `&soort=${soorten.join(',')}` : '')),
  plaatsOrders: (gebruikerId: string, orders: NieuweOrder[]) =>
    stuur<Orderoverzicht>('/api/orders', { gebruikerId, orders }),
  markeerExternGelezen: (patientId: string, documentId: string) =>
    stuur<DossierHistorie>(`/api/patient/${patientId}/extern/${documentId}/gelezen`, {}),

  planbord: (rol: string, duurMinuten?: number) =>
    haal<Planbord>(`/api/planbord/${rol}${duurMinuten ? `?duur=${duurMinuten}` : ''}`),
  planbordPraktijk: () => haal<Praktijkplanbord>('/api/planbord'),
  vraagAfspraakAan: (gebruikerId: string, verzoek: {
    patientId: string; naam: string; voorRol: string; reden: string;
    duurMinuten?: number; route: string; gewensteTermijn?: string; vragenlijst?: string;
  }) => stuur<Praktijkplanbord>('/api/planning/verzoek', { gebruikerId, verzoek }),
  planAfspraak: (verzoekId: string, start: string) =>
    stuur<Praktijkplanbord>(`/api/planning/${verzoekId}/inplannen`, { start }),
  planLosseAfspraak: (gegevens: {
    patientId: string; rol: string; start: string; duurMinuten: number; reden: string;
  }) => stuur<Praktijkplanbord>('/api/planning/afspraak', gegevens),
  annuleerVerzoek: (verzoekId: string, reden: string) =>
    stuur<Praktijkplanbord>(`/api/planning/${verzoekId}/annuleren`, { reden }),
  rapportage: () => haal<Praktijkrapportage>('/api/praktijk/rapportage'),

  overleg: (rol: string) => haal<Overleg>(`/api/overleg/${rol}`),
  zetOpBespreeklijst: (gebruikerId: string, punt: {
    patientId: string; naam: string; vraag: string; context?: string; voorRollen: string[];
  }) => stuur<Overleg>('/api/bespreeklijst', { gebruikerId, punt }),
  handelBespreekpuntAf: (id: string, uitkomst: string, door: string, rol: string) =>
    stuur<Overleg>(`/api/bespreeklijst/${id}/afhandelen`, { uitkomst, door, rol }),
  zetAfspraakstatus: (afspraakId: string, status: string, rol: string) =>
    stuur<AgendaRegel[]>(`/api/agenda/${afspraakId}/status`, { status, rol }),
  herstelDemo: () => stuur<{ hersteld: boolean }>('/api/demo/herstel', {}),

  berichten: (gebruikerId: string) => haal<Berichtenbox>(`/api/berichten/${gebruikerId}`),
  stuurBericht: (gesprekId: string, vanId: string, tekst: string) =>
    stuur<Berichtenbox>(`/api/berichten/${gesprekId}`, { vanId, tekst }),
  markeerGelezen: (gesprekId: string, gebruikerId: string) =>
    stuur<Berichtenbox>(`/api/berichten/${gesprekId}/gelezen`, { gebruikerId }),
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
