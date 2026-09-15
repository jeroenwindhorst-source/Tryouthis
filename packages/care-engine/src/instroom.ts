import type { Dossier } from '@zpe/fhir-model';
import { leeftijd } from '@zpe/fhir-model';
import { modules as alleModules } from './protocol.js';
import { ketenbijdragen, type Ketenbijdrage } from './ketenkoppeling.js';
import type { PersoonlijkPlan } from './zorgplan.js';

/**
 * INSTROOM — casefinding zonder programma-denken.
 *
 * De vraag is niet langer "voldoet deze patiënt aan de inclusiecriteria van het
 * DM-programma". De vraag is: **welke aandachtsgebieden zijn voor deze mens relevant
 * geworden, en weten we dat al?**
 *
 * Daarmee vervalt het inclusiebesluit als apart administratief moment. Wat overblijft
 * is een zorginhoudelijke vraag die de POH in één zin kan beantwoorden.
 */

export type ModuleStatus = 'nieuw-relevant' | 'actief' | 'niet-relevant' | 'handmatig-uit';

export interface ModuleBeoordeling {
  moduleId: string;
  naam: string;
  icoon: string;
  status: ModuleStatus;
  onderbouwing: string;
}

export interface InstroomResultaat {
  patientId: string;
  beoordelingen: ModuleBeoordeling[];
  /** Aandachtsgebieden die nieuw relevant zijn geworden en nog niet in het plan staan. */
  nieuw: ModuleBeoordeling[];
  /** Achtergrond: gevolgen voor declaratie, automatisch afgeleid. */
  ketens: Ketenbijdrage[];
}

/**
 * Beoordeelt welke modules voor deze patiënt relevant zijn.
 *
 * `bekendeModules` zijn de modules die al in het persoonlijke plan staan (en dus al
 * eerder zijn gezien). Alles wat nieuw relevant wordt, komt in beeld — continu, zonder
 * dat iemand een datadump hoeft aan te vragen.
 */
export function beoordeelInstroom(
  dossier: Dossier,
  bekendeModules: string[] = [],
  persoonlijk?: PersoonlijkPlan,
  peildatum: Date = new Date(),
): InstroomResultaat {
  const beoordelingen = alleModules.map((module): ModuleBeoordeling => {
    const keuze = persoonlijk?.moduleKeuzes.find((k) => k.moduleId === module.id);
    const relevantie = module.relevantie.evalueer(dossier, peildatum);
    const uitsluiting = module.uitsluiting?.evalueer(dossier, peildatum);
    const basis = { moduleId: module.id, naam: module.naam, icoon: module.icoon };

    if (keuze && !keuze.aan) {
      return { ...basis, status: 'handmatig-uit', onderbouwing: `uitgezet: ${keuze.reden}` };
    }
    if (uitsluiting?.voldaan) {
      return { ...basis, status: 'niet-relevant', onderbouwing: uitsluiting.onderbouwing };
    }
    if (!relevantie.voldaan) {
      return { ...basis, status: 'niet-relevant', onderbouwing: relevantie.onderbouwing };
    }
    return {
      ...basis,
      status: bekendeModules.includes(module.id) ? 'actief' : 'nieuw-relevant',
      onderbouwing: relevantie.onderbouwing,
    };
  });

  const actief = beoordelingen.filter((b) => b.status === 'actief' || b.status === 'nieuw-relevant');

  return {
    patientId: dossier.patient.id,
    beoordelingen,
    nieuw: beoordelingen.filter((b) => b.status === 'nieuw-relevant'),
    ketens: ketenbijdragen(dossier, actief.map((b) => b.moduleId), peildatum),
  };
}

export interface InstroomRegel {
  patientId: string;
  naam: string;
  leeftijd: number;
  nieuweModules: ModuleBeoordeling[];
  /** Wat er in het plan komt te staan als de POH akkoord gaat. */
  gevolgen: string[];
  /** Achtergrond: welke ketendeclaraties hierdoor gedekt raken. */
  ketens: { naam: string; prestatiecode: string }[];
}

/** Casefinding over een hele praktijk. Draait continu, niet op verzoek. */
export function instroomOverzicht(
  dossiers: Dossier[],
  bekend: (patientId: string) => string[],
  persoonlijkVan: (patientId: string) => PersoonlijkPlan | undefined,
  peildatum: Date = new Date(),
): InstroomRegel[] {
  return dossiers.flatMap((dossier) => {
    const resultaat = beoordeelInstroom(
      dossier, bekend(dossier.patient.id), persoonlijkVan(dossier.patient.id), peildatum,
    );
    if (resultaat.nieuw.length === 0) return [];

    const naam = [dossier.patient.naam.voornaam, dossier.patient.naam.tussenvoegsel, dossier.patient.naam.achternaam]
      .filter(Boolean).join(' ');

    return [{
      patientId: dossier.patient.id,
      naam,
      leeftijd: leeftijd(dossier, peildatum),
      nieuweModules: resultaat.nieuw,
      gevolgen: [
        `Zorgplan uitgebreid met ${resultaat.nieuw.map((m) => m.naam.toLowerCase()).join(', ')}`,
        'Controlemomenten worden opnieuw berekend en samengevoegd met wat er al staat',
        'Benodigde vragenlijsten en labaanvragen worden automatisch klaargezet',
      ],
      ketens: resultaat.ketens.map((k) => ({ naam: k.naam, prestatiecode: k.declaratie.prestatiecode })),
    }];
  });
}
