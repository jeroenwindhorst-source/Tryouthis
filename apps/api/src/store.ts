import type { Appointment, Dossier, Task } from '@zpe/fhir-model';
import { beoordeelInclusie, zorgprogrammas } from '@zpe/care-engine';
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
  /** Programma's waarin een patiënt is geïncludeerd. */
  inclusies(patientId: string): string[];
  includeer(patientId: string, programmaId: string): void;
  wijsAf(patientId: string, programmaId: string): void;
  afwijzingen(patientId: string): string[];
  intensiteit(patientId: string): string | undefined;
  stelIntensiteitIn(patientId: string, intensiteit: string): void;
}

export class InMemoryRepository implements DossierRepository {
  private praktijk: Praktijk;
  private afspraken: Appointment[];
  private taakLijst: Task[] = [];
  private geincludeerd = new Map<string, Set<string>>();
  private afgewezen = new Map<string, Set<string>>();
  private intensiteiten = new Map<string, string>();

  constructor(praktijk?: Praktijk) {
    this.praktijk = praktijk ?? genereerPraktijk();
    this.afspraken = genereerSpreekuur(this.praktijk);

    // Startsituatie: een deel van de patiënten zit al in de keten, de rest komt als
    // casefinding-kandidaat in beeld. Zonder dit zou de demo suggereren dat een praktijk
    // bij nul begint — terwijl de werkelijke situatie een half gevulde keten met
    // achterstand is. Dát is het probleem dat de inclusiemotor oplost.
    this.praktijk.dossiers.forEach((dossier, i) => {
      if (i % 3 === 0) return;   // ongeveer een derde blijft achterstand
      const resultaat = beoordeelInclusie(dossier, [], zorgprogrammas, this.praktijk.peildatum);
      const inAanmerking = resultaat.nieuweKandidaten.map((k) => k.programmaId);
      if (inAanmerking.length > 0) this.geincludeerd.set(dossier.patient.id, new Set(inAanmerking));
    });
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

  inclusies(patientId: string): string[] { return [...(this.geincludeerd.get(patientId) ?? [])]; }
  includeer(patientId: string, programmaId: string): void {
    const set = this.geincludeerd.get(patientId) ?? new Set();
    set.add(programmaId);
    this.geincludeerd.set(patientId, set);
    this.afgewezen.get(patientId)?.delete(programmaId);
  }
  wijsAf(patientId: string, programmaId: string): void {
    const set = this.afgewezen.get(patientId) ?? new Set();
    set.add(programmaId);
    this.afgewezen.set(patientId, set);
  }
  afwijzingen(patientId: string): string[] { return [...(this.afgewezen.get(patientId) ?? [])]; }

  intensiteit(patientId: string): string | undefined { return this.intensiteiten.get(patientId); }
  stelIntensiteitIn(patientId: string, intensiteit: string): void {
    this.intensiteiten.set(patientId, intensiteit);
  }
}
