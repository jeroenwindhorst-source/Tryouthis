import {
  aanloop, agenda, assistentOverzicht, beheer, berichten, consultvoorbereiding, controleerTweefactor,
  dagafsluiting, dagstart, dossierHistorie, gebruikersoverzicht, huisartsOverzicht, instroom,
  acuteInstroom, beantwoordPatientbericht, contactdossier, contactvormen, groepsconsulten, handelAcuutAf,
  medicatieoverzicht, medicatievoorbeeld, wijzigMedicatie,
  maakGroepsconsult, media, rapport, rapportExport, samenvatting,
  InMemoryRepository, intakes, legVerrichtingVast, meetreeksen, meldAan, monitoringCohort,
  neemVragenlijstOver, opvolgen, vragenlijstenVoor,
  protocoloverzicht, wijzigProtocol, herstelProtocol, type Protocolwijziging,
  takenoverzicht, zetTaakUit, planTaak, rondTaakAf, planWerkblok, bereikbaarheidVoor,
  taakdossier, legContactVast, startGroepsconsult, legGroepsnotitieVast,
  type NieuweTaak,
  orderOverzicht, orderVoorstellen, overleg, pakAcuutOp, patientOverzicht, plaatsLosseOrders,
  planbord, planbordPraktijk, praktijkrapportage, praktijkSamenvatting, registreerConsult,
  terminologie, verrichtingen, vraagAfspraakAan, zetOpBespreeklijst, zoekOrders, zoekPatient,
  type Afspraakstatus, type Beoordelaar, type ConsultRegistratie, type Contactvorm,
  type Criteria, type Groepsdeelnemer, type Mediafilter, type Medicatiewijziging, type NieuweOrder,
  type NieuwAfspraakverzoek, type NieuwBespreekpunt, type NieuwGroepsconsult,
} from '@zpe/praktijk';
import {
  ketens, modules, REGELSET_VERSIE, type CatalogusSoort, type PersoonlijkPlan,
} from '@zpe/care-engine';
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
  aanloop: () => traag(aanloop(repo)),
  opvolgen: () => traag(opvolgen(repo)),
  vragenlijsten: (patientId: string) => traag(vragenlijstenVoor(repo, patientId)),
  neemVragenlijstOver: (afnameId: string, door: string) =>
    traag({ inzage: neemVragenlijstOver(repo, afnameId, door) }),
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
  historie: (patientId: string, bronId?: string) =>
    traag(dossierHistorie(repo, patientId, bronId)!),
  contactdossier: (patientId: string, encounterId: string) =>
    traag(contactdossier(repo, patientId, encounterId)!),
  medicatieoverzicht: (patientId: string) => traag(medicatieoverzicht(repo, patientId)!),
  medicatievoorbeeld: (wijziging: Medicatiewijziging) => traag(medicatievoorbeeld(repo, wijziging)!),
  wijzigMedicatie: (gebruikerId: string, wijziging: Medicatiewijziging) => {
    const uitkomst = wijzigMedicatie(repo, gebruikerId, wijziging);
    if (!uitkomst) return Promise.reject(new Error('wijziging niet toegestaan of onvolledig'));
    return traag(uitkomst);
  },
  meetreeksen: (patientId: string) => traag(meetreeksen(repo, patientId)),
  orders: (patientId: string) => traag(orderVoorstellen(repo, patientId)),
  orderOverzicht: (patientId: string) => traag(orderOverzicht(repo, patientId)!),
  zoekOrders: (patientId: string, vraag: string, soorten?: CatalogusSoort[]) =>
    traag(zoekOrders(repo, patientId, vraag, soorten)),
  plaatsOrders: (gebruikerId: string, orders: NieuweOrder[]) => {
    plaatsLosseOrders(repo, gebruikerId, orders);
    return traag(orderOverzicht(repo, orders[0]?.patientId ?? '')!);
  },
  markeerExternGelezen: (patientId: string, documentId: string) => {
    repo.markeerExternGelezen(patientId, documentId);
    return traag(dossierHistorie(repo, patientId)!);
  },

  planbord: (rol: string, duurMinuten?: number) =>
    traag(planbord(repo, rol as 'poh-s' | 'assistent' | 'huisarts', duurMinuten)),
  planbordPraktijk: () => traag(planbordPraktijk(repo)),
  vraagAfspraakAan: (gebruikerId: string, verzoek: NieuwAfspraakverzoek) => {
    vraagAfspraakAan(repo, gebruikerId, verzoek);
    return traag(planbordPraktijk(repo));
  },
  planAfspraak: (verzoekId: string, start: string) => {
    repo.planAfspraak(verzoekId, start);
    return traag(planbordPraktijk(repo));
  },
  planLosseAfspraak: (gegevens: {
    patientId: string; rol: string; start: string; duurMinuten: number; reden: string;
  }) => {
    repo.planLosseAfspraak({ ...gegevens, rol: gegevens.rol as 'poh-s' | 'assistent' | 'huisarts' });
    return traag(planbordPraktijk(repo));
  },
  annuleerVerzoek: (verzoekId: string, reden: string) => {
    repo.annuleerVerzoek(verzoekId, reden);
    return traag(planbordPraktijk(repo));
  },
  rapportage: () => traag(praktijkrapportage(repo)),

  acuut: (rol: string) => traag(acuteInstroom(repo, rol as 'poh-s' | 'assistent' | 'huisarts')),
  pakAcuutOp: (id: string, gebruikerId: string, rol: string) =>
    traag(pakAcuutOp(repo, id, gebruikerId, rol as 'poh-s' | 'assistent' | 'huisarts')),
  handelAcuutAf: (id: string, uitkomst: string, rol: string) =>
    traag(handelAcuutAf(repo, id, uitkomst, rol as 'poh-s' | 'assistent' | 'huisarts')),

  contactvormen: () => traag(contactvormen),

  samenvatting: (patientId: string) => traag(samenvatting(repo, patientId)!),
  media: (patientId: string, filter?: Mediafilter) => traag(media(repo, patientId, filter)),
  markeerMediaGelezen: (patientId: string, mediaId: string) => {
    repo.markeerMediaGelezen(patientId, mediaId);
    return traag(media(repo, patientId));
  },

  groepsconsulten: () => traag(groepsconsulten(repo)),
  maakGroepsconsult: (gebruikerId: string, nieuw: NieuwGroepsconsult) =>
    traag(maakGroepsconsult(repo, gebruikerId, nieuw)!),
  voegDeelnemerToe: (groepId: string, deelnemer: Omit<Groepsdeelnemer, 'toegevoegdOp'>) => {
    repo.voegDeelnemerToe(groepId, deelnemer);
    return traag(groepsconsulten(repo));
  },
  verwijderDeelnemer: (groepId: string, patientId: string) => {
    repo.verwijderDeelnemer(groepId, patientId);
    return traag(groepsconsulten(repo));
  },
  zetDeelnemerstatus: (groepId: string, patientId: string, status: string) => {
    repo.zetDeelnemerstatus(groepId, patientId, status as Groepsdeelnemer['status']);
    return traag(groepsconsulten(repo));
  },
  startGroepsconsult: (groepId: string) => {
    const lijst = startGroepsconsult(repo, groepId);
    if (!lijst) return Promise.reject(new Error(`Groepsconsult ${groepId} niet gevonden`));
    return traag(lijst);
  },
  legGroepsnotitieVast: (groepId: string, gegevens: {
    patientId: string; notitie: string; gebruikerId?: string;
  }) => {
    const uitkomst = legGroepsnotitieVast(repo, groepId, gegevens);
    if (!uitkomst) return Promise.reject(new Error('Deelnemer niet gevonden'));
    return traag(uitkomst);
  },

  rapport: (criteria: Criteria) => traag(rapport(repo, criteria)),
  rapportExport: (criteria: Criteria) => traag(rapportExport(repo, criteria)),
  verrichtingen: (patientId: string) => traag(verrichtingen(repo, patientId)!),
  legVerrichtingVast: (gebruikerId: string, gegevens: {
    patientId: string; orderId: string; soortCode: string; waarden: Record<string, string>;
    beoordelaar: Beoordelaar; vraagstelling?: string; conclusie?: string;
  }) => traag(legVerrichtingVast(repo, gebruikerId, gegevens)!),
  beantwoordBericht: (gegevens: {
    gesprekId: string; gebruikerId: string; tekst: string;
    contactvorm: Contactvorm; episodeId?: string; duurMinuten?: number;
  }) => traag(beantwoordPatientbericht(repo, gegevens)!),

  overleg: (rol: string) => traag(overleg(repo, rol as 'poh-s' | 'assistent' | 'huisarts')),
  zetOpBespreeklijst: (gebruikerId: string, punt: NieuwBespreekpunt) => {
    zetOpBespreeklijst(repo, gebruikerId, punt);
    const gebruiker = punt.voorRollen[0] ?? 'huisarts';
    return traag(overleg(repo, gebruiker));
  },
  handelBespreekpuntAf: (id: string, uitkomst: string, door: string, rol: string) => {
    repo.handelBespreekpuntAf(id, uitkomst, door);
    return traag(overleg(repo, rol as 'poh-s' | 'assistent' | 'huisarts'));
  },
  zetAfspraakstatus: (afspraakId: string, status: string, rol: string) => {
    repo.zetAfspraakstatus(afspraakId, status as Afspraakstatus);
    return traag(agenda(repo, rol as 'poh-s' | 'assistent' | 'huisarts'));
  },

  /**
   * Alles terug naar de beginstand.
   *
   * Een demo waarin je één keer een consult kunt afronden, is na het eerste gesprek op.
   * De generatoren gebruiken vaste zaden, dus dit levert exact dezelfde praktijk op als
   * bij het opstarten — niet iets wat er ongeveer op lijkt.
   */
  herstelDemo: () => {
    repo.herstelBeginstand();
    return traag({ hersteld: true });
  },

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

  taken: (gebruikerId: string) => traag(takenoverzicht(repo, gebruikerId)),
  bereikbaarheid: (patientId: string) => {
    const uitkomst = bereikbaarheidVoor(repo, patientId);
    if (!uitkomst) return Promise.reject(new Error(`Patiënt ${patientId} niet gevonden`));
    return traag(uitkomst);
  },
  zetTaakUit: (nieuw: NieuweTaak, door: string) => traag(zetTaakUit(repo, nieuw, door)),
  planTaak: (id: string, start: string) => traag({ taak: planTaak(repo, id, start) }),
  rondTaakAf: (id: string, door: string, uitkomst: string) =>
    traag({ taak: rondTaakAf(repo, id, door, uitkomst) }),
  taakdossier: (taakId: string) => {
    const uitkomst = taakdossier(repo, taakId);
    if (!uitkomst) return Promise.reject(new Error(`Taak ${taakId} niet gevonden`));
    return traag(uitkomst);
  },
  legContactVast: (patientId: string, gegevens: Parameters<typeof legContactVast>[2]) => {
    const uitkomst = legContactVast(repo, patientId, gegevens);
    if (!uitkomst) return Promise.reject(new Error(`Patiënt ${patientId} niet gevonden`));
    return traag(uitkomst);
  },
  planWerkblok: (blokId: string, rol: string, start: string) => {
    planWerkblok(repo, { blokId, rol, start });
    return traag(planbordPraktijk(repo));
  },

  protocol: (gebruikerId?: string) => traag(protocoloverzicht(repo, gebruikerId)),
  wijzigProtocol: (wijziging: Protocolwijziging, door: string) =>
    traag(wijzigProtocol(repo, wijziging, door)),
  herstelProtocol: (moduleId: string, itemCode: string | undefined, door: string) =>
    traag(herstelProtocol(repo, moduleId, itemCode, door)),

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
