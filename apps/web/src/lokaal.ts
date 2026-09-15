import {
  consultvoorbereiding, dagafsluiting, dagstart, instroom, InMemoryRepository,
  monitoringCohort, patientOverzicht, praktijkSamenvatting, registreerConsult,
  terminologie, type ConsultRegistratie,
} from '@zpe/praktijk';
import { ketens, modules, REGELSET_VERSIE, type PersoonlijkPlan } from '@zpe/care-engine';
import { DEMO_SEED_WAARSCHUWING } from '@zpe/terminology';

/**
 * Dezelfde praktijklaag, maar dan volledig in de browser.
 *
 * Er verandert geen regel domeinlogica: `@zpe/praktijk` bevat geen HTTP en geen
 * Node-afhankelijkheden, dus de motor die in de server draait draait hier net zo goed.
 * Daardoor is er een demoversie die zonder infrastructuur werkt — en, belangrijker, is
 * bewezen dat de domeinlaag echt losstaat van het transport (docs/08 §1).
 *
 * Mutaties leven in het geheugen van het tabblad: verversen betekent opnieuw beginnen.
 */
const repo = new InMemoryRepository();

/** Kleine vertraging, zodat laadtoestanden in de UI ook echt geoefend worden. */
const traag = <T>(waarde: T): Promise<T> =>
  new Promise((klaar) => setTimeout(() => klaar(waarde), 40));

export const lokaleApi = {
  dagstart: () => traag(dagstart(repo)),
  voorbereiding: () => traag(consultvoorbereiding(repo)),
  monitoring: () => traag(monitoringCohort(repo)),
  instroom: () => traag(instroom(repo)),
  afronden: () => traag(dagafsluiting(repo)),
  praktijk: () => traag(praktijkSamenvatting(repo)),

  protocol: () => traag({
    toelichting:
      'Eén geïntegreerd protocol, opgebouwd uit aandachtsgebieden. Er is geen protocol per ' +
      'aandoening; landelijke ketens worden achteraf afgeleid.',
    regelsetVersie: REGELSET_VERSIE,
    modules: modules.map((m) => ({
      id: m.id, naam: m.naam, omschrijving: m.omschrijving, icoon: m.icoon, rol: m.rol,
      richtlijnen: m.richtlijnen,
      relevantie: m.relevantie.omschrijving,
      items: m.items.map((i) => ({
        code: i.code, naam: i.naam, basisIntervalDagen: i.basisIntervalDagen,
        zelfAanleverbaar: i.zelfAanleverbaar, labVooraf: i.labVooraf,
        intervalRegels: (i.intervalRegels ?? []).map((r) => ({ factor: r.factor, reden: r.reden })),
      })),
    })),
    ketens: ketens.map((k) => ({
      id: k.id, naam: k.naam, modules: k.modules, declaratie: k.declaratie,
    })),
  }),

  patient: (id: string) => {
    const overzicht = patientOverzicht(repo, id);
    if (!overzicht) return Promise.reject(new Error(`Patiënt ${id} niet gevonden`));
    return traag(overzicht);
  },

  suggestie: (patientId: string, regelId: string, actieId: string, reden?: string) => {
    if (actieId === 'extensief') {
      repo.bewaarPersoonlijkPlan({ ...repo.persoonlijkPlan(patientId), intensiteit: 'extensief' });
    }
    if (regelId.startsWith('module-') && actieId === 'toevoegen') {
      repo.markeerModuleBekend(patientId, regelId.replace('module-', ''));
    }
    repo.handelSuggestieAf(patientId, regelId, actieId, reden);
    return traag(patientOverzicht(repo, patientId)!);
  },

  plan: (patientId: string, wijziging: Partial<PersoonlijkPlan>) => {
    repo.bewaarPersoonlijkPlan({ ...repo.persoonlijkPlan(patientId), ...wijziging, patientId });
    return traag(patientOverzicht(repo, patientId)!);
  },

  consult: (patientId: string, registratie: ConsultRegistratie) => {
    const uitkomst = registreerConsult(repo, patientId, registratie);
    if (!uitkomst) return Promise.reject(new Error(`Patiënt ${patientId} niet gevonden`));
    return traag({ uitkomst, overzicht: patientOverzicht(repo, patientId)! });
  },

  accepteerModule: (patientId: string, moduleId: string) => {
    repo.markeerModuleBekend(patientId, moduleId);
    return traag(patientOverzicht(repo, patientId)!);
  },

  zoek: (q: string, breed: boolean) => traag({
    waarschuwing: DEMO_SEED_WAARSCHUWING,
    treffers: terminologie.zoek(q, {
      niveaus: breed
        ? ['registratieset', 'uitbreidingsset', 'extern']
        : ['registratieset', 'uitbreidingsset'],
      limiet: 20,
    }),
  }),

  ontvang: (code: string, display: string) => traag(
    terminologie.ontvang([{ system: 'http://snomed.info/sct', code, display }], 'Ziekenhuis (demo)'),
  ),
};
