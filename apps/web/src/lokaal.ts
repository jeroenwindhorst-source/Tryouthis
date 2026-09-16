import {
  agenda, assistentOverzicht, beheer, berichten, consultvoorbereiding, controleerTweefactor,
  dagafsluiting, dagstart, dossierHistorie, gebruikersoverzicht, huisartsOverzicht, instroom,
  InMemoryRepository, intakes, meetreeksen, meldAan, monitoringCohort, orderVoorstellen,
  patientOverzicht, praktijkSamenvatting, registreerConsult, terminologie, zoekPatient,
  type ConsultRegistratie,
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
  assistent: () => traag(assistentOverzicht(repo)),
  huisarts: () => traag(huisartsOverzicht(repo)),
  agenda: (rol: string) => traag(agenda(repo, rol as 'poh-s' | 'assistent' | 'huisarts')),
  beheer: () => traag(beheer()),
  intakes: () => traag(intakes(repo)),

  aanmelden: (gebruikersnaam: string, wachtwoord: string) => {
    const uitkomst = meldAan({ gebruikersnaam, wachtwoord });
    if (uitkomst.stap === 'mislukt') return Promise.reject(new Error(uitkomst.reden));
    const { wachtwoord: _, ...gebruiker } = uitkomst.gebruiker;
    return traag({ stap: 'tweefactor' as const, gebruiker });
  },
  tweefactor: (code: string) => controleerTweefactor(code)
    ? traag({ geldig: true })
    : Promise.reject(new Error('De code klopt niet.')),
  gebruikers: () => traag(gebruikersoverzicht()),

  zoek: (q: string) => traag(zoekPatient(repo, q)),
  maakEpisode: (patientId: string, code: { icpc: string; snomed?: string; display: string }) => {
    const episodeId = repo.maakEpisode(patientId, code, 'zv-poh-1');
    if (!episodeId) return Promise.reject(new Error('patiënt niet gevonden'));
    return traag({ episodeId, overzicht: patientOverzicht(repo, patientId)! });
  },
  historie: (patientId: string, episodeId?: string) =>
    traag(dossierHistorie(repo, patientId, episodeId)!),
  meetreeksen: (patientId: string) => traag(meetreeksen(repo, patientId)),
  orders: (patientId: string) => traag(orderVoorstellen(repo, patientId)),

  berichten: (gebruikerId: string) => traag(berichten(repo, gebruikerId)),
  stuurBericht: (gesprekId: string, vanId: string, tekst: string) => {
    repo.stuurBericht(gesprekId, vanId, tekst);
    return traag(berichten(repo, vanId));
  },
  markeerGelezen: (gesprekId: string, gebruikerId: string) => {
    repo.markeerGelezen(gesprekId, gebruikerId);
    return traag(berichten(repo, gebruikerId));
  },

  handelTriageAf: (id: string) => {
    repo.handelTriageAf(id);
    return traag(assistentOverzicht(repo));
  },
  accordeer: (ids: string[]) => {
    repo.accordeer(ids);
    return traag(huisartsOverzicht(repo));
  },
  wijsAutorisatieAf: (id: string, reden: string) => {
    repo.wijsAutorisatieAf(id, reden);
    return traag(huisartsOverzicht(repo));
  },
  bevestigIntake: (id: string) => {
    repo.bevestigIntake(id);
    return traag({ intake: repo.intakes().find((i) => i.id === id)! });
  },

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

  zoekTerm: (q: string, breed: boolean) => traag({
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
