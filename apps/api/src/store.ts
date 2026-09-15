import type { Appointment, Deelcontact, Dossier, Observation, Task } from '@zpe/fhir-model';
import {
  beoordeelInstroom, leegPersoonlijkPlan, type PersoonlijkPlan,
} from '@zpe/care-engine';
import { genereerPraktijk, genereerSpreekuur, type Praktijk } from './populatie.js';

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
}

export class InMemoryRepository implements DossierRepository {
  private praktijk: Praktijk;
  private afspraken: Appointment[];
  private taakLijst: Task[] = [];
  private plannen = new Map<string, PersoonlijkPlan>();
  private bekend = new Map<string, Set<string>>();
  private afgehandeld = new Map<string, Map<string, { besluit: string; reden?: string }>>();

  constructor(praktijk?: Praktijk) {
    this.praktijk = praktijk ?? genereerPraktijk();
    this.afspraken = genereerSpreekuur(this.praktijk);

    // Startsituatie: bij twee derde van de patiënten zijn de relevante aandachtsgebieden
    // al eens gezien; bij de rest niet. Dat laatste is de achterstand die de praktijk
    // nu met een datadump en een Excel probeert op te sporen.
    this.praktijk.dossiers.forEach((dossier, i) => {
      if (i % 3 === 0) return;
      const resultaat = beoordeelInstroom(dossier, [], undefined, this.praktijk.peildatum);
      const set = new Set(resultaat.nieuw.map((m) => m.moduleId));
      if (set.size > 0) this.bekend.set(dossier.patient.id, set);
    });

    // Een paar patiënten hebben expliciete persoonlijke afspraken — anders lijkt
    // personalisatie een theoretische mogelijkheid in plaats van dagelijks gebruik.
    const metPlan = this.praktijk.dossiers.filter((_, i) => i % 11 === 4);
    for (const dossier of metPlan) {
      this.plannen.set(dossier.patient.id, {
        ...leegPersoonlijkPlan(dossier.patient.id),
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

  peildatum(): Date { return this.praktijk.peildatum; }
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
