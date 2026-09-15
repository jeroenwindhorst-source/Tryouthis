import type { Dossier } from '@zpe/fhir-model';
import type { Zorgprogramma } from './zorgprogramma.js';
import { zorgprogrammas } from './zorgprogramma.js';

export type InclusieStatus = 'kandidaat' | 'geincludeerd' | 'uitgesloten' | 'afgewezen';

export interface InclusieBeoordeling {
  programmaId: string;
  programmaNaam: string;
  status: InclusieStatus;
  /** Leesbare onderbouwing — dit is wat de POH te zien krijgt. */
  onderbouwing: string;
  /** Wat er gebeurt als de POH akkoord gaat. */
  gevolgen?: string[];
}

export interface InclusieResultaat {
  patientId: string;
  beoordelingen: InclusieBeoordeling[];
  /** Programma's waarvoor deze patiënt nu in beeld komt en nog niet is ingesloten. */
  nieuweKandidaten: InclusieBeoordeling[];
}

/**
 * Casefinding over één dossier (docs/04 §1).
 *
 * Dit vervangt de datadump-naar-Excel-route. De motor draait continu; wie vandaag
 * aan de criteria gaat voldoen, staat morgen in beeld — niemand hoeft een dump te vragen.
 */
export function beoordeelInclusie(
  dossier: Dossier,
  reedsGeincludeerd: string[] = [],
  programmas: Zorgprogramma[] = zorgprogrammas,
  peildatum: Date = new Date(),
  afgewezen: string[] = [],
): InclusieResultaat {
  const beoordelingen = programmas.map((programma): InclusieBeoordeling => {
    const inclusie = programma.inclusie.evalueer(dossier, peildatum);
    const exclusie = programma.exclusie.evalueer(dossier, peildatum);

    const basis = { programmaId: programma.id, programmaNaam: programma.naam };

    if (afgewezen.includes(programma.id)) {
      return { ...basis, status: 'afgewezen', onderbouwing: 'eerder afgewezen door zorgverlener' };
    }
    if (exclusie.voldaan) {
      return { ...basis, status: 'uitgesloten', onderbouwing: exclusie.onderbouwing };
    }
    if (!inclusie.voldaan) {
      return { ...basis, status: 'uitgesloten', onderbouwing: inclusie.onderbouwing };
    }
    if (reedsGeincludeerd.includes(programma.id)) {
      return { ...basis, status: 'geincludeerd', onderbouwing: inclusie.onderbouwing };
    }
    return {
      ...basis,
      status: 'kandidaat',
      onderbouwing: inclusie.onderbouwing,
      gevolgen: [
        `Zorgplan uitgebreid met ${programma.naam} (${programma.richtlijn.naam})`,
        `Jaarplanning en oproepritme worden opnieuw berekend en samengevoegd`,
        programma.declaratie
          ? `Declaratie: ${programma.declaratie.keten}${programma.declaratie.prestatiecode ? ` (${programma.declaratie.prestatiecode})` : ''}`
          : 'Geen ketendeclaratie gekoppeld',
      ],
    };
  });

  return {
    patientId: dossier.patient.id,
    beoordelingen,
    nieuweKandidaten: beoordelingen.filter((b) => b.status === 'kandidaat'),
  };
}

export interface Indicatoruitkomst {
  indicatorId: string;
  naam: string;
  inNoemer: boolean;
  inTeller: boolean;
  onderbouwing: string;
}

/** Indicatoren per dossier — de bouwsteen voor populatierapportage (docs/11 F1.7). */
export function beoordeelIndicatoren(
  dossier: Dossier,
  programma: Zorgprogramma,
  peildatum: Date = new Date(),
): Indicatoruitkomst[] {
  return programma.indicatoren.map((ind) => {
    const noemer = ind.noemer.evalueer(dossier, peildatum);
    const teller = noemer.voldaan ? ind.teller.evalueer(dossier, peildatum) : { voldaan: false, onderbouwing: '' };
    return {
      indicatorId: ind.id,
      naam: ind.naam,
      inNoemer: noemer.voldaan,
      inTeller: teller.voldaan,
      onderbouwing: noemer.voldaan ? teller.onderbouwing : noemer.onderbouwing,
    };
  });
}
