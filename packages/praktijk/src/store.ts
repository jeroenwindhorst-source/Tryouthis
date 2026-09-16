import type { Appointment, Deelcontact, Dossier, Observation, Rol, Task } from '@zpe/fhir-model';
import {
  beoordeelInstroom, leegPersoonlijkPlan, type PersoonlijkPlan,
} from '@zpe/care-engine';
import {
  genereerPraktijk, genereerSpreekuur, genereerZelfredzaamheid, type Praktijk,
} from './populatie.js';
import { appsVoor } from './configuratie-demo.js';
import { bouwHistorie } from './historie.js';
import { genereerGesprekken, type Gesprek } from './berichten.js';
import {
  genereerAgenda, genereerAutorisaties, genereerIntakes, genereerTriage,
  type AgendaItem, type Autorisatieverzoek, type Triageverzoek, type WachtkamerIntake,
} from './werkvoorraad.js';

/**
 * Opslaginterface. De in-memory implementatie hieronder en de Postgres-implementatie
 * (docs/01 §2) delen deze interface, zodat de domeinlogica los van de opslag getest
 * kan worden en de vertical slice draait zonder infrastructuur.
 */
export interface DossierRepository {
  peildatum(): Date;
  alleDossiers(): Dossier[];
  dossier(patientId: string): Dossier | undefined;
  spreekuur(datum: string): Appointment[];
  taken(): Task[];
  voegTaakToe(taak: Task): void;
  /** Het persoonlijke plan: modules, intervallen, doelen en voorkeuren van deze mens. */
  persoonlijkPlan(patientId: string): PersoonlijkPlan;
  bewaarPersoonlijkPlan(plan: PersoonlijkPlan): void;
  /** Aandachtsgebieden die al eerder in beeld zijn geweest. */
  bekendeModules(patientId: string): string[];
  markeerModuleBekend(patientId: string, moduleId: string): void;
  /** Suggesties die de zorgverlener heeft afgehandeld — komen niet terug. */
  afgehandeldeSuggesties(patientId: string): string[];
  handelSuggestieAf(patientId: string, regelId: string, besluit: string, reden?: string): void;
  /** Registratie vanuit het consult: metingen en het SOEP-deelcontact. */
  registreer(patientId: string, observaties: Observation[], deelcontact?: Deelcontact): void;

  /** De agenda van één rol, of van de hele praktijk. */
  agenda(rol?: Rol): AgendaItem[];
  /** Triage-instroom van vandaag: telefonisch én digitaal, in één stroom. */
  triage(): Triageverzoek[];
  handelTriageAf(id: string): void;
  /** Autorisatieverzoeken die op de huisarts wachten. */
  autorisaties(): Autorisatieverzoek[];
  accordeer(ids: string[]): void;
  wijsAutorisatieAf(id: string, reden: string): void;
  /** Wat ingebedde partnerapps in de wachtkamer hebben opgeleverd. */
  intakes(): WachtkamerIntake[];
  bevestigIntake(id: string): void;
  /** Nieuwe episode openen vanuit het consult. */
  maakEpisode(patientId: string, code: { icpc: string; snomed?: string; display: string }, door: string): string | undefined;
  /** Interne communicatie tussen teamleden. */
  alleGesprekken(): Gesprek[];
  stuurBericht(gesprekId: string, vanId: string, tekst: string): void;
  markeerGelezen(gesprekId: string, gebruikerId: string): void;
}

export class InMemoryRepository implements DossierRepository {
  private praktijk: Praktijk;
  private afspraken: Appointment[];
  private taakLijst: Task[] = [];
  private plannen = new Map<string, PersoonlijkPlan>();
  private agendaItems: AgendaItem[];
  private triageLijst: Triageverzoek[];
  private autorisatieLijst: Autorisatieverzoek[];
  private intakeLijst: WachtkamerIntake[];
  private gesprekken: Gesprek[];
  private bekend = new Map<string, Set<string>>();
  private afgehandeld = new Map<string, Map<string, { besluit: string; reden?: string }>>();

  constructor(praktijk?: Praktijk) {
    this.praktijk = praktijk ?? genereerPraktijk();

    // Drie jaar dossierhistorie: contacten met SOEP en de bijbehorende meetreeksen.
    // Zonder historie is er niets om in terug te kijken, en dan lijkt elk dossier nieuw.
    this.praktijk.dossiers.forEach((dossier, i) => {
      const extra = bouwHistorie(dossier, this.praktijk.peildatum, 3000 + i);
      dossier.contacten.push(...extra.contacten);
      dossier.deelcontacten.push(...extra.deelcontacten);
      dossier.observaties.push(...extra.observaties);
    });

    this.gesprekken = genereerGesprekken(this.praktijk);
    this.afspraken = genereerSpreekuur(this.praktijk);
    this.agendaItems = [
      ...genereerAgenda(this.praktijk),
      ...this.afspraken.map((a): AgendaItem => ({
        id: a.id, start: a.start, duurMinuten: a.eindeMinuten, rol: 'poh-s',
        patientId: a.patientId, naam: this.naamVan(a.patientId),
        soort: a.soort, titel: 'Chronische controle', reden: a.reden, status: 'gepland',
      })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    this.triageLijst = genereerTriage(this.praktijk);
    this.autorisatieLijst = genereerAutorisaties(this.praktijk);

    const wachtkamerApp = appsVoor('wachtkamer')[0];
    this.intakeLijst = wachtkamerApp
      ? genereerIntakes(this.praktijk, this.agendaItems.filter((a) => a.rol === 'poh-s'), {
          id: wachtkamerApp.id, naam: wachtkamerApp.naam, leverancier: wachtkamerApp.leverancier,
        })
      : [];

    // Startsituatie: bij twee derde van de patiënten zijn de relevante aandachtsgebieden
    // al eens gezien; bij de rest niet. Dat laatste is de achterstand die de praktijk
    // nu met een datadump en een Excel probeert op te sporen.
    this.praktijk.dossiers.forEach((dossier, i) => {
      if (i % 3 === 0) return;
      const resultaat = beoordeelInstroom(dossier, [], undefined, this.praktijk.peildatum);
      const set = new Set(resultaat.nieuw.map((m) => m.moduleId));
      if (set.size > 0) this.bekend.set(dossier.patient.id, set);
    });

    // Zelfredzaamheid is bij deze praktijk de leidende factor voor contactfrequentie,
    // dus hij hoort bij vrijwel iedereen in beeld te zijn — niet bij een enkeling.
    this.praktijk.dossiers.forEach((dossier, i) => {
      const bekend = this.bekend.get(dossier.patient.id);
      if (!bekend || bekend.size === 0) return;
      this.plannen.set(dossier.patient.id, {
        ...leegPersoonlijkPlan(dossier.patient.id),
        zelfredzaamheid: genereerZelfredzaamheid(dossier, this.praktijk.peildatum, 9000 + i),
      });
    });

    // Een paar patiënten hebben daarnaast expliciete afspraken over contactfrequentie.
    const metPlan = this.praktijk.dossiers.filter((_, i) => i % 11 === 4);
    for (const dossier of metPlan) {
      this.plannen.set(dossier.patient.id, {
        ...this.persoonlijkPlan(dossier.patient.id),
        voorkeuren: { maxContactenPerJaar: 2 },
        doelen: [{
          id: `${dossier.patient.id}-doel-1`,
          tekst: 'Ik wil zonder rollator naar de markt kunnen blijven lopen.',
          gekoppeldeModules: ['leefstijl', 'vaatrisico'],
          afgesprokenOp: this.praktijk.peildatum.toISOString().slice(0, 10),
        }],
      });
    }
  }

  private naamVan(patientId: string): string {
    const dossier = this.dossier(patientId);
    if (!dossier) return patientId;
    const n = dossier.patient.naam;
    return [n.voornaam, n.tussenvoegsel, n.achternaam].filter(Boolean).join(' ');
  }

  peildatum(): Date { return this.praktijk.peildatum; }

  agenda(rol?: Rol): AgendaItem[] {
    return rol ? this.agendaItems.filter((a) => a.rol === rol) : this.agendaItems;
  }
  triage(): Triageverzoek[] { return this.triageLijst; }
  handelTriageAf(id: string): void {
    const verzoek = this.triageLijst.find((t) => t.id === id);
    if (verzoek) verzoek.status = 'afgehandeld';
  }
  autorisaties(): Autorisatieverzoek[] { return this.autorisatieLijst; }
  accordeer(ids: string[]): void {
    const set = new Set(ids);
    for (const verzoek of this.autorisatieLijst) {
      if (set.has(verzoek.id)) verzoek.status = 'geaccordeerd';
    }
  }
  wijsAutorisatieAf(id: string, reden: string): void {
    const verzoek = this.autorisatieLijst.find((v) => v.id === id);
    if (verzoek) { verzoek.status = 'afgewezen'; verzoek.aanleiding = `${verzoek.aanleiding} — afgewezen: ${reden}`; }
  }
  maakEpisode(
    patientId: string, code: { icpc: string; snomed?: string; display: string }, door: string,
  ): string | undefined {
    const dossier = this.dossier(patientId);
    if (!dossier) return undefined;
    const nu = new Date().toISOString();
    const id = `${patientId}-ep-${dossier.episodes.length + 1}`;
    dossier.episodes.push({
      resourceType: 'EpisodeOfCare',
      id,
      patientId,
      status: 'active',
      titel: code.display,
      code: {
        coding: [
          { system: 'http://hl7.org/fhir/sid/icpc-1-nl', code: code.icpc, display: code.display },
          ...(code.snomed
            ? [{ system: 'http://snomed.info/sct', code: code.snomed, display: code.display }]
            : []),
        ],
        text: code.display,
      },
      periode: { start: nu.slice(0, 10) },
      herkomst: { bron: 'zorgverlener', vastgelegdOp: nu, auteurId: door, auteurRol: 'poh-s' },
    });
    return id;
  }

  alleGesprekken(): Gesprek[] { return this.gesprekken; }
  stuurBericht(gesprekId: string, vanId: string, tekst: string): void {
    const gesprek = this.gesprekken.find((g) => g.id === gesprekId);
    if (!gesprek) return;
    gesprek.berichten.push({
      id: `bericht-${gesprekId}-${gesprek.berichten.length + 1}`,
      vanId, tekst, op: new Date().toISOString(), gelezen: true,
    });
  }
  markeerGelezen(gesprekId: string, gebruikerId: string): void {
    const gesprek = this.gesprekken.find((g) => g.id === gesprekId);
    if (!gesprek) return;
    for (const bericht of gesprek.berichten) {
      if (bericht.vanId !== gebruikerId) bericht.gelezen = true;
    }
  }

  intakes(): WachtkamerIntake[] { return this.intakeLijst; }
  bevestigIntake(id: string): void {
    const intake = this.intakeLijst.find((i) => i.id === id);
    if (intake) intake.bevestigd = true;
  }
  alleDossiers(): Dossier[] { return this.praktijk.dossiers; }
  dossier(patientId: string): Dossier | undefined {
    return this.praktijk.dossiers.find((d) => d.patient.id === patientId);
  }
  spreekuur(datum: string): Appointment[] {
    return this.afspraken.filter((a) => a.start.startsWith(datum));
  }
  taken(): Task[] { return this.taakLijst; }
  voegTaakToe(taak: Task): void { this.taakLijst.push(taak); }

  persoonlijkPlan(patientId: string): PersoonlijkPlan {
    return this.plannen.get(patientId) ?? leegPersoonlijkPlan(patientId);
  }
  bewaarPersoonlijkPlan(plan: PersoonlijkPlan): void {
    this.plannen.set(plan.patientId, plan);
  }

  bekendeModules(patientId: string): string[] { return [...(this.bekend.get(patientId) ?? [])]; }
  markeerModuleBekend(patientId: string, moduleId: string): void {
    const set = this.bekend.get(patientId) ?? new Set();
    set.add(moduleId);
    this.bekend.set(patientId, set);
  }

  registreer(patientId: string, observaties: Observation[], deelcontact?: Deelcontact): void {
    const dossier = this.dossier(patientId);
    if (!dossier) return;
    dossier.observaties.push(...observaties);
    if (deelcontact) dossier.deelcontacten.push(deelcontact);
  }

  afgehandeldeSuggesties(patientId: string): string[] {
    return [...(this.afgehandeld.get(patientId)?.keys() ?? [])];
  }
  handelSuggestieAf(patientId: string, regelId: string, besluit: string, reden?: string): void {
    const kaart = this.afgehandeld.get(patientId) ?? new Map();
    kaart.set(regelId, { besluit, reden });
    this.afgehandeld.set(patientId, kaart);
  }
}
