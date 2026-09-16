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
  opgenomenOp: string; duurSeconden: number; waar: 'wachtkamer' | 'thuis';
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
  datum: string; tijd?: string; encounterId: string; episodeId: string;
  episodeTitel: string; episodeIcpc?: string;
  soort: string; auteur: string; auteurRol: string; bron: string;
  regels: { letter: string; tekst: string }[];
  heeftSoep: boolean;
  aantalMetingen: number;
  aantalOrders?: number;
}

export interface Eigenmetingdag {
  id: string; datum: string; via: string; bevestigd: boolean;
  metingen: { code: string; naam: string; waarde: string; eenheid?: string }[];
}

/** Alles wat op één contactmoment is vastgelegd, bij elkaar. */
export interface Contactdossier {
  encounterId: string;
  datum: string; tijd?: string; soort: string; duurMinuten?: number;
  uitvoerder: { naam: string; rol: string };
  herkomst: { bron: string; vastgelegdOp: string; auteurRol: string };
  patient: {
    naam: string; leeftijdToen: number; geboortedatum: string;
    episodesToen: { icpc?: string; titel: string }[];
    behandelgrenzen: string[];
  };
  hulpvraag?: string;
  deelcontacten: {
    id: string; episodeTitel: string; episodeIcpc?: string;
    regels: { letter: string; tekst: string }[];
  }[];
  metingen: {
    code: string; naam: string; waarde: string; eenheid?: string;
    bron: string; eigenRegistratie: boolean;
  }[];
  orders: { id: string; soort: string; omschrijving: string; detail?: string; status: string; route?: string }[];
  verrichtingen: {
    naam: string; uitgevoerdDoor: string; beoordelaar: string;
    waarden: { naam: string; waarde: string }[];
    conclusie?: string;
  }[];
  declaratie?: { code: string; omschrijving: string; declarabel: boolean; ontbreekt?: string[] };
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
  | { soort: 'overleg'; datum: string; notitie: Overlegnotitie }
  | { soort: 'eigenmeting'; datum: string; meting: Eigenmetingdag }
  | { soort: 'intake'; datum: string; intake: WachtkamerIntake };

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

/** Waar een recept heen kan. Per recept gekozen, niet één instelling per patiënt. */
export interface Apotheek {
  id: string; naam: string; plaats: string; digitaal: boolean; bijzonderheid?: string;
}

export type Afleverroute = 'digitaal' | 'print' | 'meegeven';
export type Wijzigingsoort = 'dosering' | 'vervangen' | 'stoppen' | 'starten';

export interface Medicatiewijziging {
  patientId: string;
  soort: Wijzigingsoort;
  statementId?: string;
  nieuw?: { atc: string; naam: string; dosering: string; chronisch?: boolean };
  reden: string;
  aflevering: { route: Afleverroute; apotheekId?: string; opmerking?: string };
  episodeId?: string;
}

export interface Medicatieregel {
  id: string; naam: string; atc?: string; dosering: string; chronisch: boolean;
  begin?: string; einde?: string; status: string; voorschrijver: string;
  waarschuwingen: Waarschuwing[];
  laatsteOrder?: {
    id: string; status: string; route?: string; bestemming?: string; geplaatstOp: string;
  };
}

export interface Medicatieoverzicht {
  lopend: Medicatieregel[];
  gestopt: Medicatieregel[];
  apotheken: Apotheek[];
  voorkeursapotheek: { id: string; naam: string; plaats: string };
  redenen: Record<Wijzigingsoort, string[]>;
  soortLabel: Record<Wijzigingsoort, string>;
  episodes: { id: string; titel: string; icpc?: string }[];
}

export interface Medicatievoorbeeld {
  regels: string[];
  waarschuwing?: string;
  waarschuwingen: Waarschuwing[];
}

export interface Medicatieuitkomst {
  overzicht: Medicatieoverzicht;
  order?: Order;
  naarAutorisatie: boolean;
}

export interface Catalogustreffer {
  id: string; soort: 'medicatie' | 'lab' | 'verwijzing' | 'onderzoek' | 'afspraak';
  naam: string; detail: string; varianten: string[];
  atc?: string; levert?: string[]; route?: string;
  instellingen?: string[]; portaal?: { naam: string; url: string };
  verrichtingCode?: string; bijRol?: string; duurMinuten?: number; vorm?: string;
  groepModule?: string;
  vereistRecht: string;
  waarschuwingen: Waarschuwing[];
}

export interface NieuweOrder {
  patientId: string; soort: string; omschrijving: string; detail?: string;
  atc?: string; route?: string; bestemming?: string;
  verrichtingCode?: string; bijRol?: string; duurMinuten?: number; planroute?: string;
  groepModule?: string;
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
  medicatie: { id?: string; naam: string; atc?: string; dosering: string; chronisch: boolean }[];
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

export type Contactvorm =
  | 'consult' | 'consult-lang' | 'visite' | 'visite-lang'
  | 'telefonisch' | 'e-consult' | 'videoconsult'
  | 'verrichting' | 'intern-overleg' | 'herhaalrecept';

export interface Contactvormdefinitie {
  id: Contactvorm; naam: string; wanneer: string; doorRollen: string[];
  duurGrensMinuten?: number; declarabel: boolean;
  prestatie?: { code: string; omschrijving: string; voorwaarden: string[] };
  nietDeclarabelOmdat?: string; identificatie: string;
}

export interface Declaratiebeeld {
  vorm: string; naam: string; declarabel: boolean;
  prestatie?: { code: string; omschrijving: string; voorwaarden: string[] };
  ontbreekt: string[]; toelichting: string;
}

export interface AcuutSignaal {
  id: string; patientId: string; naam: string; leeftijd: number;
  bron: string; bronLabel: string; binnenOp: string; binnenOmTijd: string;
  urgentie: string; urgentieLabel: string; opdringen: 'modaal' | 'melding';
  samenvatting: string; onderbouwing: string; voorgesteldeActie: string;
  voorRollen: string[]; status: 'open' | 'opgepakt' | 'afgehandeld';
  opgepaktDoor?: { id: string; naam: string; rol: string };
  opgepaktOp?: string; afgehandeldOp?: string; uitkomst?: string;
}

export interface Acuutbeeld {
  open: AcuutSignaal[]; opgepakt: AcuutSignaal[];
  afgehandeld: AcuutSignaal[]; alles: AcuutSignaal[];
}

export interface Uitkomstveld {
  code: string; naam: string; soort: 'getal' | 'keuze' | 'tekst';
  eenheid?: string; opties?: { code: string; label: string }[];
  normaal?: { onder?: number; boven?: number };
}

export interface Verrichtingsoort {
  code: string; naam: string; doorRollen: string[]; duurMinuten: number;
  uitkomstvelden: Uitkomstveld[];
  teleconsultatie?: { specialisme: string; toelichting: string };
  indicaties: string[];
}

export interface Verrichtingbeeld {
  open: { order: Order; soort?: Verrichtingsoort }[];
  uitslagen: {
    orderId: string; soortCode: string; soortNaam: string;
    uitgevoerdDoor: { id: string; naam: string; rol: string };
    uitgevoerdOp: string; beoordelaar: string; conclusie?: string;
    teleconsult?: { specialisme: string; vraagstelling: string; verstuurdOp: string };
    afwijkingen: { veld: string; waarde: string; reden: string }[];
    velden: { naam: string; waarde: string }[];
  }[];
  soorten: Verrichtingsoort[];
}

export interface Alinea {
  id: string; titel: string; tekst: string; bron: string;
  nadruk?: 'aandacht' | 'urgent';
}

export interface Kerngetal {
  label: string; waarde: string; onder?: string; toon?: 'ok' | 'aandacht' | 'urgent';
}

export interface Samenvatting {
  kop: string; alineas: Alinea[]; kerngetallen: Kerngetal[];
  herkomst: { soort: string; versie: string; toelichting: string };
}

export interface Mediabestand {
  id: string; patientId: string; soort: string; bron: string;
  titel: string; categorie: string; datum: string; ontvangenOp: string;
  bestandsnaam: string; groottekB: number;
  gekoppeldAan?: { soort: string; id: string; bronId?: string; omschrijving: string };
  omschrijving: string; gelezen: boolean;
}

export interface Mediabeeld {
  bestanden: Mediabestand[]; totaal: number; ongelezen: number;
  soorten: { soort: string; label: string; aantal: number }[];
  bronnen: { bron: string; label: string; aantal: number }[];
  categorieen: string[];
  jaren: string[];
}

export interface Groepsdeelnemer {
  patientId: string; naam: string; status: string;
  onderbouwing: string; toegevoegdOp: string; geregistreerd?: boolean;
}

export interface Groepsconsult {
  id: string; titel: string; thema: string; module: string;
  begeleider: { id: string; naam: string; rol: string };
  start: string; datum: string; tijd: string; duurMinuten: number;
  plaats: string; maxDeelnemers: number; status: string;
  programma: string[]; deelnemers: Groepsdeelnemer[];
  aangemeld: number;
  voorgesteld: {
    patientId: string; naam: string; leeftijd: number;
    onderbouwing: string; zelfredzaamheid?: number;
  }[];
}

export interface Filterveld {
  id: string; naam: string; uitleg: string; soort: 'keuze' | 'getal' | 'jaartal';
  opties?: { code: string; label: string }[]; eenheid?: string;
}

export interface Rapportregel {
  patientId: string; naam: string; leeftijd: number;
  modules: string[]; ketens: string[];
  kolommen: { naam: string; waarde: string; toon?: 'aandacht' | 'urgent' }[];
}

export interface Rapport {
  criteria: Record<string, string>;
  omschrijving: string; totaal: number; vanTotaal: number;
  regels: Rapportregel[];
  verdeling: { label: string; aantal: number }[];
  kolomnamen: string[];
  velden: Filterveld[];
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
  medicatie: { id?: string; naam: string; atc?: string; dosering: string; chronisch: boolean }[];
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
  declaratie?: Declaratiebeeld;
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
    contactvorm?: Contactvorm;
    duurMinuten?: number;
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
  contactdossier: (patientId: string, encounterId: string) =>
    haal<Contactdossier>(`/api/patient/${patientId}/contact/${encounterId}`),
  medicatieoverzicht: (patientId: string) =>
    haal<Medicatieoverzicht>(`/api/patient/${patientId}/medicatie`),
  medicatievoorbeeld: (wijziging: Medicatiewijziging) =>
    stuur<Medicatievoorbeeld>('/api/medicatie/voorbeeld', wijziging),
  wijzigMedicatie: (gebruikerId: string, wijziging: Medicatiewijziging) =>
    stuur<Medicatieuitkomst>('/api/medicatie/wijzig', { gebruikerId, wijziging }),
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

  acuut: (rol: string) => haal<Acuutbeeld>(`/api/acuut/${rol}`),
  pakAcuutOp: (id: string, gebruikerId: string, rol: string) =>
    stuur<Acuutbeeld>(`/api/acuut/${id}/oppakken`, { gebruikerId, rol }),
  handelAcuutAf: (id: string, uitkomst: string, rol: string) =>
    stuur<Acuutbeeld>(`/api/acuut/${id}/afhandelen`, { uitkomst, rol }),

  contactvormen: () => haal<Contactvormdefinitie[]>('/api/contactvormen'),

  samenvatting: (patientId: string) => haal<Samenvatting>(`/api/patient/${patientId}/samenvatting`),
  media: (patientId: string, filter?: {
    soorten?: string[]; bronnen?: string[]; categorie?: string; vraag?: string; jaar?: string;
  }) => {
    const vragen = new URLSearchParams();
    if (filter?.soorten?.length) vragen.set('soort', filter.soorten.join(','));
    if (filter?.bronnen?.length) vragen.set('bron', filter.bronnen.join(','));
    if (filter?.categorie) vragen.set('categorie', filter.categorie);
    if (filter?.vraag) vragen.set('q', filter.vraag);
    if (filter?.jaar) vragen.set('jaar', filter.jaar);
    const staart = vragen.toString();
    return haal<Mediabeeld>(`/api/patient/${patientId}/media${staart ? `?${staart}` : ''}`);
  },
  markeerMediaGelezen: (patientId: string, mediaId: string) =>
    stuur<Mediabeeld>(`/api/patient/${patientId}/media/${mediaId}/gelezen`, {}),

  groepsconsulten: () => haal<Groepsconsult[]>('/api/groepsconsulten'),
  maakGroepsconsult: (gebruikerId: string, nieuw: {
    titel: string; thema: string; module: string; start: string;
    duurMinuten: number; plaats: string; maxDeelnemers: number; programma: string[];
  }) => stuur<Groepsconsult[]>('/api/groepsconsulten', { gebruikerId, nieuw }),
  voegDeelnemerToe: (groepId: string, deelnemer: {
    patientId: string; naam: string; status: string; onderbouwing: string;
  }) => stuur<Groepsconsult[]>(`/api/groepsconsulten/${groepId}/deelnemers`, deelnemer),
  verwijderDeelnemer: (groepId: string, patientId: string) =>
    stuur<Groepsconsult[]>(`/api/groepsconsulten/${groepId}/deelnemers/${patientId}/verwijderen`, {}),
  zetDeelnemerstatus: (groepId: string, patientId: string, status: string) =>
    stuur<Groepsconsult[]>(`/api/groepsconsulten/${groepId}/deelnemers/${patientId}/status`, { status }),

  rapport: (criteria: Record<string, string>) =>
    stuur<Rapport>('/api/rapport', criteria),
  rapportExport: (criteria: Record<string, string>) =>
    stuur<{ regels: Record<string, string | number>[]; toelichting: string }>(
      '/api/rapport/export', criteria),
  verrichtingen: (patientId: string) =>
    haal<Verrichtingbeeld>(`/api/patient/${patientId}/verrichtingen`),
  legVerrichtingVast: (gebruikerId: string, gegevens: {
    patientId: string; orderId: string; soortCode: string; waarden: Record<string, string>;
    beoordelaar: string; vraagstelling?: string; conclusie?: string;
  }) => stuur<Verrichtingbeeld>('/api/verrichtingen', { gebruikerId, ...gegevens }),
  beantwoordBericht: (gegevens: {
    gesprekId: string; gebruikerId: string; tekst: string;
    contactvorm: Contactvorm; episodeId?: string; duurMinuten?: number;
  }) => stuur<{ berichten: Berichtenbox; uitkomst?: RegistratieUitkomst }>(
    '/api/berichten/beantwoorden', gegevens),

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
