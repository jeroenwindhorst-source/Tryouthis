import type {
  CodeableConcept, Coding, DomainResource, FhirDate, FhirDateTime,
  Identifier, Period, Quantity, Reference,
} from './primitives.js';
import type { Herkomst, Rol } from './herkomst.js';

/** Alles wat klinisch is, draagt herkomst en — waar van toepassing — een episode. */
export interface KlinischeResource extends DomainResource {
  herkomst: Herkomst;
  /**
   * Verplichte episodekoppeling (docs/03 §1). Ontbreekt de episode, dan moet
   * `geenEpisodeReden` zijn ingevuld. Dit is de tweede as van de database.
   */
  episodeId?: string;
  geenEpisodeReden?: 'administratief' | 'nog-niet-geduid' | 'preventie' | 'extern-ongeduid';
}

export interface Patient extends DomainResource {
  resourceType: 'Patient';
  identifier: Identifier[];        // BSN: http://fhir.nl/fhir/NamingSystem/bsn
  naam: { voornaam?: string; initialen?: string; tussenvoegsel?: string; achternaam: string };
  geboortedatum: FhirDate;
  geslacht: 'male' | 'female' | 'other' | 'unknown';
  adres?: { straat?: string; huisnummer?: string; postcode?: string; woonplaats?: string };
  /**
   * Hoe deze mens te bereiken is (FHIR Patient.telecom).
   *
   * Meer dan één nummer, want dat is de werkelijkheid: een mobiel dat overdag uitstaat
   * en een vaste lijn waar wel wordt opgenomen. `telefoon` blijft het primaire nummer;
   * de andere staan ernaast in plaats van het te vervangen.
   *
   * `toelichting` is wat de praktijk in de loop der jaren heeft geleerd — 'belt liever
   * na drieën', 'slechthorend, spreek langzaam'. Dat staat nu in hoofden en op briefjes,
   * en het is precies wat je nodig hebt op het moment dat je de hoorn oppakt.
   */
  contact?: {
    telefoon?: string;
    mobiel?: string;
    vast?: string;
    email?: string;
    toelichting?: string;
  };
  /**
   * Naaste die gebeld mag worden (FHIR Patient.contact).
   *
   * Met wat diegene mag: informeren is iets anders dan meebeslissen, en die grens hoort
   * vastgelegd te zijn vóórdat iemand hem nodig heeft.
   */
  contactpersoon?: {
    naam: string;
    relatie: string;
    telefoon: string;
    mag: 'informeren' | 'meebeslissen' | 'alleen-in-noodgeval';
  };
  /** Voorkeurskanaal voor oproepen — bepaalt de kanaalkeuze in docs/04 §5. */
  communicatievoorkeur?: 'portaal' | 'sms' | 'email' | 'telefoon' | 'brief';
  portaalActief?: boolean;
  overleden?: boolean;
}

export type EpisodeStatus = 'active' | 'onhold' | 'finished' | 'cancelled';

export interface EpisodeOfCare extends DomainResource {
  resourceType: 'EpisodeOfCare';
  patientId: string;
  status: EpisodeStatus;
  /** Titel zoals de huisarts hem ziet, bijv. 'Diabetes mellitus type 2'. */
  titel: string;
  /** Primaire codering; altijd dual coded waar mogelijk (docs/02 §3). */
  code: CodeableConcept;
  periode: Period;
  hoofdbehandelaar?: Reference;
  /** Afgeschermde episodes (bijv. GGZ) zijn niet voor elke rol zichtbaar. */
  afgeschermd?: boolean;
  herkomst: Herkomst;
}

export type ConditionZekerheid = 'vermoeden' | 'waarschijnlijk' | 'bevestigd' | 'weerlegd';

export interface Condition extends KlinischeResource {
  resourceType: 'Condition';
  patientId: string;
  code: CodeableConcept;
  klinischeStatus: 'active' | 'recurrence' | 'remission' | 'resolved';
  zekerheid: ConditionZekerheid;
  begin?: FhirDate;
  einde?: FhirDate;
}

export type ContactSoort =
  | 'consult' | 'dubbel-consult' | 'visite' | 'telefonisch'
  | 'e-consult' | 'videoconsult' | 'balie' | 'incident' | 'monitoring';

export interface Encounter extends KlinischeResource {
  resourceType: 'Encounter';
  patientId: string;
  soort: ContactSoort;
  status: 'planned' | 'in-progress' | 'finished' | 'cancelled';
  periode: Period;
  uitvoerder: { id: string; naam: string; rol: Rol };
  /** De hulpvraag zoals de patiënt hem stelde — startpunt van het contact (docs/12 §2.2). */
  hulpvraag?: string;
  duurMinuten?: number;
  /**
   * Wat dit contact administratief oplevert.
   *
   * Afgeleid uit de vorm en de inhoud, niet apart ingevoerd. De vorm is bekend op het
   * moment van het contact; wie de declaratie later moet reconstrueren, gokt (docs/19).
   */
  declaratie?: {
    code: string;
    omschrijving: string;
    declarabel: boolean;
    /** Wat er ontbrak; leeg betekent in orde. */
    ontbreekt?: string[];
  };
}

export type SoepLetter = 'S' | 'O' | 'E' | 'P';

export interface SoepRegel {
  letter: SoepLetter;
  tekst: string;
  /** Gecodeerd waar mogelijk; bij E vrijwel altijd (ICPC + SNOMED). */
  code?: CodeableConcept;
  /** Verwijzing naar een Observation als deze regel een meting is. */
  observationId?: string;
}

/** Het deelcontact: één contact kan meerdere episodes raken (docs/03 §2). */
export interface Deelcontact extends KlinischeResource {
  resourceType: 'Deelcontact';
  patientId: string;
  encounterId: string;
  episodeId: string;
  regels: SoepRegel[];
  afgerond: boolean;
}

export interface Observation extends KlinischeResource {
  resourceType: 'Observation';
  patientId: string;
  /**
   * Bij welk contact deze meting is vastgelegd (FHIR: Observation.encounter).
   *
   * Zonder die verwijzing is een meting een los getal met een datum en moet je achteraf
   * raden bij welk consult hij hoorde. Metingen die de patiënt zelf thuis doet hebben
   * hem niet — die horen juist bij géén contact, en dat is informatie.
   */
  encounterId?: string;
  code: CodeableConcept;
  effectief: FhirDateTime;
  waarde?: Quantity | { code: Coding } | { tekst: string } | { booleaans: boolean };
  status: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  /** Bij patiëntgerapporteerde of apparaatmetingen. */
  bronApparaat?: { naam: string; identificatie?: string };
  interpretatie?: 'normaal' | 'laag' | 'hoog' | 'kritiek';
}

export type TaakCategorie =
  | 'oproep' | 'uitslag-beoordelen' | 'autorisatie' | 'terugbelverzoek'
  | 'vragenlijst-uitzetten' | 'signaal-monitoring' | 'administratief'
  | 'inclusie-voorstel' | 'no-show';

export interface VoorgesteldeActie {
  type: string;
  omschrijving: string;
  payload?: Record<string, unknown>;
  /** Mag dit item veilig in bulk worden afgehandeld? Zie docs/03 §6. */
  bulkVeilig?: boolean;
}

export interface Task extends KlinischeResource {
  resourceType: 'Task';
  patientId?: string;
  categorie: TaakCategorie;
  status: 'requested' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
  prioriteit: 'routine' | 'urgent' | 'asap';
  omschrijving: string;
  /** Waaróm bestaat dit item. Nooit leeg — een teller zonder reden is geen werkvoorraad. */
  aanleiding: string;
  voorstel?: VoorgesteldeActie;
  toegewezenAan: { rol: Rol; persoonId?: string };
  vervaltOp?: FhirDateTime;
  bron: 'protocol' | 'regel' | 'mens' | 'extern';
}

export interface Appointment extends DomainResource {
  resourceType: 'Appointment';
  patientId: string;
  start: FhirDateTime;
  eindeMinuten: number;
  soort: ContactSoort;
  /** Afspraaktype bepaalt duur, rol en welke vragenlijst wordt uitgezet (docs/12 §2.3). */
  afspraakType: string;
  uitvoerder: { id: string; naam: string; rol: Rol };
  status: 'proposed' | 'booked' | 'fulfilled' | 'noshow' | 'cancelled';
  /** Zorgprogramma's die met dit contact worden bediend — kern van de samenvoeging. */
  programmas?: string[];
  reden?: string;
}

export interface Flag extends KlinischeResource {
  resourceType: 'Flag';
  patientId: string;
  /** Attentieregel of ruiter (docs/10 §4.5), maar gecodeerd in plaats van vrije tekst. */
  soort: 'attentie' | 'ruiter' | 'behandelgrens';
  code?: CodeableConcept;
  tekst: string;
  actief: boolean;
}

export interface MedicationStatement extends KlinischeResource {
  resourceType: 'MedicationStatement';
  patientId: string;
  middel: CodeableConcept;
  dosering: string;
  chronisch: boolean;
  status: 'active' | 'stopped' | 'completed';
  begin?: FhirDate;
  einde?: FhirDate;
}
