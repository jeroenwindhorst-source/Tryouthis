import Fastify from 'fastify';
import { SYSTEEM, DEMO_SEED_WAARSCHUWING } from '@zpe/terminology';
import {
  modules, ketens, vindVragenlijst, vragenlijsten, REGELSET_VERSIE,
  type CatalogusSoort, type PersoonlijkPlan,
} from '@zpe/care-engine';
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
  type NieuweTaak,
  orderOverzicht, orderVoorstellen, overleg, pakAcuutOp, patientOverzicht, plaatsLosseOrders,
  planbord, planbordPraktijk, praktijkrapportage, praktijkSamenvatting, registreerConsult,
  terminologie, verrichtingen, verwerkVragenlijst, vraagAfspraakAan, zetOpBespreeklijst,
  zoekOrders, zoekPatient,
  type Afspraakstatus, type Beoordelaar, type ConsultRegistratie, type Contactvorm,
  type Criteria, type Groepsdeelnemer, type Mediasoort, type Mediabron, type Medicatiewijziging,
  type NieuweOrder, type NieuwAfspraakverzoek, type NieuwBespreekpunt, type NieuwGroepsconsult,
} from '@zpe/praktijk';

const repo = new InMemoryRepository();
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' } });

// In productie staat hier een strikte allowlist; de dev-server draait op een andere poort.
app.addHook('onSend', async (_req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Headers', 'content-type');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
});
app.options('/*', async (_req, reply) => reply.code(204).send());

// ── Werkproces POH-Somatiek (docs/05) ───────────────────────────────────────

app.get('/api/poh/dagstart', async () => dagstart(repo));
app.get('/api/poh/voorbereiding', async () => consultvoorbereiding(repo));
app.get('/api/poh/aanloop', async () => aanloop(repo));
app.get('/api/poh/opvolgen', async () => opvolgen(repo));
app.get('/api/poh/monitoring', async () => monitoringCohort(repo));

app.get<{ Params: { id: string } }>('/api/patient/:id/vragenlijsten', async (req) =>
  vragenlijstenVoor(repo, req.params.id));

app.post<{ Params: { id: string }; Body: { door: string } }>(
  '/api/vragenlijst/:id/overnemen', async (req) =>
    ({ inzage: neemVragenlijstOver(repo, req.params.id, req.body.door) }));
app.get('/api/poh/instroom', async () => instroom(repo));
app.get('/api/poh/afronden', async () => dagafsluiting(repo));
app.get('/api/praktijk/samenvatting', async () => praktijkSamenvatting(repo));

app.get<{ Params: { id: string } }>('/api/patient/:id', async (req, reply) => {
  const overzicht = patientOverzicht(repo, req.params.id);
  return overzicht ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
});

/** Een suggestie afhandelen. Afwijzen mag altijd, maar vraagt een reden. */
app.post<{ Params: { id: string }; Body: { regelId: string; actieId: string; reden?: string } }>(
  '/api/patient/:id/suggestie',
  async (req, reply) => {
    const dossier = repo.dossier(req.params.id);
    if (!dossier) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
    const { regelId, actieId, reden } = req.body ?? {};

    // Een paar acties hebben direct effect op het plan; de rest wordt vastgelegd.
    if (actieId === 'extensief') {
      repo.bewaarPersoonlijkPlan({ ...repo.persoonlijkPlan(req.params.id), intensiteit: 'extensief' });
    }
    if (regelId.startsWith('module-') && actieId === 'toevoegen') {
      repo.markeerModuleBekend(req.params.id, regelId.replace('module-', ''));
    }
    repo.handelSuggestieAf(req.params.id, regelId, actieId, reden);
    return patientOverzicht(repo, req.params.id);
  },
);

/** Nieuwe episode openen tijdens het consult. */
app.post<{ Params: { id: string }; Body: { icpc: string; snomed?: string; display: string } }>(
  '/api/patient/:id/episode',
  async (req, reply) => {
    const id = repo.maakEpisode(req.params.id, req.body, 'zv-poh-1');
    if (!id) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
    return { episodeId: id, overzicht: patientOverzicht(repo, req.params.id) };
  },
);

/** Registratie vanuit het consult: metingen en SOEP in één handeling. */
app.post<{ Params: { id: string }; Body: ConsultRegistratie }>(
  '/api/patient/:id/consult',
  async (req, reply) => {
    const uitkomst = registreerConsult(repo, req.params.id, req.body ?? { metingen: [] });
    if (!uitkomst) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
    return { uitkomst, overzicht: patientOverzicht(repo, req.params.id) };
  },
);

/** Het persoonlijke plan aanpassen: modules, intervallen, intensiteit, voorkeuren. */
app.post<{ Params: { id: string }; Body: Partial<PersoonlijkPlan> }>(
  '/api/patient/:id/plan',
  async (req, reply) => {
    if (!repo.dossier(req.params.id)) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
    const huidig = repo.persoonlijkPlan(req.params.id);
    repo.bewaarPersoonlijkPlan({ ...huidig, ...req.body, patientId: req.params.id });
    return patientOverzicht(repo, req.params.id);
  },
);

app.post<{ Body: { patientId: string; moduleId: string } }>(
  '/api/poh/instroom/accepteer',
  async (req, reply) => {
    const { patientId, moduleId } = req.body ?? {};
    if (!repo.dossier(patientId)) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
    repo.markeerModuleBekend(patientId, moduleId);
    return patientOverzicht(repo, patientId);
  },
);

// ── Aanmelden (demo — géén echte authenticatie, zie docs/07 §2) ─────────────

app.post<{ Body: { gebruikersnaam: string; wachtwoord: string } }>(
  '/api/aanmelden',
  async (req, reply) => {
    const uitkomst = meldAan(req.body ?? { gebruikersnaam: '', wachtwoord: '' });
    if (uitkomst.stap === 'mislukt') return reply.code(401).send(uitkomst);
    const { wachtwoord, ...gebruiker } = uitkomst.gebruiker;
    return { stap: 'tweefactor', gebruiker };
  },
);

app.post<{ Body: { code: string } }>('/api/tweefactor', async (req, reply) => {
  if (!controleerTweefactor(req.body?.code ?? '')) {
    return reply.code(401).send({ fout: 'De code klopt niet.' });
  }
  return { geldig: true };
});

app.get('/api/gebruikers', async () => gebruikersoverzicht());

// ── Patiënt zoeken ──────────────────────────────────────────────────────────

app.get<{ Querystring: { q?: string } }>('/api/zoek', async (req) =>
  zoekPatient(repo, req.query.q ?? ''));

// ── Dossierdiepte ───────────────────────────────────────────────────────────

app.get<{ Params: { id: string }; Querystring: { bron?: string } }>(
  '/api/patient/:id/historie',
  async (req, reply) => {
    const historie = dossierHistorie(repo, req.params.id, req.query.bron);
    return historie ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
  },
);

app.post<{ Params: { id: string; documentId: string } }>(
  '/api/patient/:id/extern/:documentId/gelezen',
  async (req, reply) => {
    repo.markeerExternGelezen(req.params.id, req.params.documentId);
    const historie = dossierHistorie(repo, req.params.id);
    return historie ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
  },
);

app.get<{ Params: { id: string; encounterId: string } }>(
  '/api/patient/:id/contact/:encounterId',
  async (req, reply) => {
    const dossier = contactdossier(repo, req.params.id, req.params.encounterId);
    return dossier ?? reply.code(404).send({ fout: 'contact niet gevonden' });
  },
);

app.get<{ Params: { id: string } }>(
  '/api/patient/:id/medicatie',
  async (req, reply) => {
    const overzicht = medicatieoverzicht(repo, req.params.id);
    return overzicht ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
  },
);

app.post<{ Body: Medicatiewijziging }>('/api/medicatie/voorbeeld', async (req, reply) => {
  const beeld = medicatievoorbeeld(repo, req.body);
  return beeld ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
});

app.post<{ Body: { gebruikerId: string; wijziging: Medicatiewijziging } }>(
  '/api/medicatie/wijzig',
  async (req, reply) => {
    const uitkomst = wijzigMedicatie(repo, req.body.gebruikerId, req.body.wijziging);
    return uitkomst ?? reply.code(400).send({ fout: 'wijziging niet toegestaan of onvolledig' });
  },
);

app.get<{ Params: { id: string } }>('/api/patient/:id/meetreeksen', async (req) =>
  meetreeksen(repo, req.params.id));

// ── Orders ──────────────────────────────────────────────────────────────────

app.get<{ Params: { id: string } }>('/api/patient/:id/orders', async (req) =>
  orderVoorstellen(repo, req.params.id));

app.get<{ Params: { id: string } }>('/api/patient/:id/orderoverzicht', async (req, reply) => {
  const overzicht = orderOverzicht(repo, req.params.id);
  return overzicht ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
});

app.get<{ Params: { id: string }; Querystring: { q?: string; soort?: string } }>(
  '/api/patient/:id/catalogus',
  async (req) => zoekOrders(repo, req.params.id, req.query.q ?? '',
    req.query.soort ? (req.query.soort.split(',') as CatalogusSoort[]) : undefined),
);

app.post<{ Body: { gebruikerId: string; orders: NieuweOrder[] } }>(
  '/api/orders',
  async (req, reply) => {
    plaatsLosseOrders(repo, req.body.gebruikerId, req.body.orders ?? []);
    const overzicht = orderOverzicht(repo, req.body.orders?.[0]?.patientId ?? '');
    return overzicht ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
  },
);

// ── Plannen ─────────────────────────────────────────────────────────────────

app.get<{ Params: { rol: string }; Querystring: { duur?: string } }>(
  '/api/planbord/:rol',
  async (req) => planbord(repo, req.params.rol as 'poh-s' | 'assistent' | 'huisarts',
    req.query.duur ? Number(req.query.duur) : undefined),
);

app.get('/api/planbord', async () => planbordPraktijk(repo));

app.post<{ Body: { gebruikerId: string; verzoek: NieuwAfspraakverzoek } }>(
  '/api/planning/verzoek',
  async (req) => {
    vraagAfspraakAan(repo, req.body.gebruikerId, req.body.verzoek);
    return planbordPraktijk(repo);
  },
);

app.post<{ Params: { id: string }; Body: { start: string } }>(
  '/api/planning/:id/inplannen',
  async (req) => {
    repo.planAfspraak(req.params.id, req.body.start);
    return planbordPraktijk(repo);
  },
);

app.post<{ Body: {
  patientId: string; rol: string; start: string; duurMinuten: number; reden: string;
} }>(
  '/api/planning/afspraak',
  async (req) => {
    repo.planLosseAfspraak({
      ...req.body, rol: req.body.rol as 'poh-s' | 'assistent' | 'huisarts',
    });
    return planbordPraktijk(repo);
  },
);

app.post<{ Params: { id: string }; Body: { reden: string } }>(
  '/api/planning/:id/annuleren',
  async (req) => {
    repo.annuleerVerzoek(req.params.id, req.body.reden);
    return planbordPraktijk(repo);
  },
);

app.get('/api/praktijk/rapportage', async () => praktijkrapportage(repo));

// ── Acute instroom ──────────────────────────────────────────────────────────

app.get<{ Params: { rol: string } }>('/api/acuut/:rol', async (req) =>
  acuteInstroom(repo, req.params.rol as 'poh-s' | 'assistent' | 'huisarts'));

app.post<{ Params: { id: string }; Body: { gebruikerId: string; rol: string } }>(
  '/api/acuut/:id/oppakken',
  async (req) => pakAcuutOp(repo, req.params.id, req.body.gebruikerId,
    req.body.rol as 'poh-s' | 'assistent' | 'huisarts'),
);

app.post<{ Params: { id: string }; Body: { uitkomst: string; rol: string } }>(
  '/api/acuut/:id/afhandelen',
  async (req) => handelAcuutAf(repo, req.params.id, req.body.uitkomst,
    req.body.rol as 'poh-s' | 'assistent' | 'huisarts'),
);

// ── Contactvormen en verrichtingen ──────────────────────────────────────────

app.get('/api/contactvormen', async () => contactvormen);

app.get<{ Params: { id: string } }>('/api/patient/:id/verrichtingen', async (req, reply) => {
  const beeld = verrichtingen(repo, req.params.id);
  return beeld ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
});

app.post<{ Body: {
  gebruikerId: string; patientId: string; orderId: string; soortCode: string;
  waarden: Record<string, string>; beoordelaar: Beoordelaar;
  vraagstelling?: string; conclusie?: string;
} }>(
  '/api/verrichtingen',
  async (req, reply) => {
    const { gebruikerId, ...gegevens } = req.body;
    const beeld = legVerrichtingVast(repo, gebruikerId, gegevens);
    return beeld ?? reply.code(400).send({ fout: 'kon de verrichting niet vastleggen' });
  },
);

app.post<{ Body: {
  gesprekId: string; gebruikerId: string; tekst: string;
  contactvorm: Contactvorm; episodeId?: string; duurMinuten?: number;
} }>(
  '/api/berichten/beantwoorden',
  async (req, reply) => {
    const uitkomst = beantwoordPatientbericht(repo, req.body);
    return uitkomst ?? reply.code(404).send({ fout: 'gesprek niet gevonden' });
  },
);

// ── Samenvatting, media, groepsconsulten en rapportages ─────────────────────

app.get<{ Params: { id: string } }>('/api/patient/:id/samenvatting', async (req, reply) => {
  const beeld = samenvatting(repo, req.params.id);
  return beeld ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
});

app.get<{
  Params: { id: string };
  Querystring: { soort?: string; bron?: string; categorie?: string; q?: string; jaar?: string };
}>('/api/patient/:id/media', async (req) => media(repo, req.params.id, {
  soorten: req.query.soort ? (req.query.soort.split(',') as Mediasoort[]) : undefined,
  bronnen: req.query.bron ? (req.query.bron.split(',') as Mediabron[]) : undefined,
  categorie: req.query.categorie,
  vraag: req.query.q,
  jaar: req.query.jaar,
}));

app.post<{ Params: { id: string; mediaId: string } }>(
  '/api/patient/:id/media/:mediaId/gelezen',
  async (req) => {
    repo.markeerMediaGelezen(req.params.id, req.params.mediaId);
    return media(repo, req.params.id);
  },
);

app.get('/api/groepsconsulten', async () => groepsconsulten(repo));

app.post<{ Body: { gebruikerId: string; nieuw: NieuwGroepsconsult } }>(
  '/api/groepsconsulten',
  async (req, reply) => {
    const beeld = maakGroepsconsult(repo, req.body.gebruikerId, req.body.nieuw);
    return beeld ?? reply.code(400).send({ fout: 'kon het groepsconsult niet aanmaken' });
  },
);

app.post<{ Params: { id: string }; Body: Omit<Groepsdeelnemer, 'toegevoegdOp'> }>(
  '/api/groepsconsulten/:id/deelnemers',
  async (req) => {
    repo.voegDeelnemerToe(req.params.id, req.body);
    return groepsconsulten(repo);
  },
);

app.post<{ Params: { id: string; patientId: string } }>(
  '/api/groepsconsulten/:id/deelnemers/:patientId/verwijderen',
  async (req) => {
    repo.verwijderDeelnemer(req.params.id, req.params.patientId);
    return groepsconsulten(repo);
  },
);

app.post<{ Params: { id: string; patientId: string }; Body: { status: string } }>(
  '/api/groepsconsulten/:id/deelnemers/:patientId/status',
  async (req) => {
    repo.zetDeelnemerstatus(req.params.id, req.params.patientId,
      req.body.status as Groepsdeelnemer['status']);
    return groepsconsulten(repo);
  },
);

app.post<{ Body: Criteria }>('/api/rapport', async (req) => rapport(repo, req.body ?? {}));

app.post<{ Body: Criteria }>('/api/rapport/export', async (req) =>
  rapportExport(repo, req.body ?? {}));

// ── Overleg en bespreeklijst ────────────────────────────────────────────────

app.get<{ Params: { rol: string } }>('/api/overleg/:rol', async (req) =>
  overleg(repo, req.params.rol as 'poh-s' | 'assistent' | 'huisarts'));

app.post<{ Body: { gebruikerId: string; punt: NieuwBespreekpunt } }>(
  '/api/bespreeklijst',
  async (req) => {
    zetOpBespreeklijst(repo, req.body.gebruikerId, req.body.punt);
    return overleg(repo, req.body.punt.voorRollen[0] ?? 'huisarts');
  },
);

app.post<{ Params: { id: string }; Body: { uitkomst: string; door: string; rol: string } }>(
  '/api/bespreeklijst/:id/afhandelen',
  async (req) => {
    repo.handelBespreekpuntAf(req.params.id, req.body.uitkomst, req.body.door);
    return overleg(repo, req.body.rol as 'poh-s' | 'assistent' | 'huisarts');
  },
);

app.post<{ Params: { id: string }; Body: { status: string; rol: string } }>(
  '/api/agenda/:id/status',
  async (req) => {
    repo.zetAfspraakstatus(req.params.id, req.body.status as Afspraakstatus);
    return agenda(repo, req.body.rol as 'poh-s' | 'assistent' | 'huisarts');
  },
);

/**
 * De demo terugzetten naar de beginstand.
 *
 * Staat bewust achter een eigen endpoint en niet achter een queryparameter op iets
 * anders: dit gooit alle mutaties weg en dat hoort een expliciete handeling te zijn.
 * In een echte omgeving bestaat dit endpoint niet.
 */
app.post('/api/demo/herstel', async () => {
  repo.herstelBeginstand();
  return { hersteld: true };
});

// ── Interne communicatie ────────────────────────────────────────────────────

app.get<{ Params: { gebruikerId: string } }>('/api/berichten/:gebruikerId', async (req) =>
  berichten(repo, req.params.gebruikerId));

app.post<{ Params: { gesprekId: string }; Body: { vanId: string; tekst: string } }>(
  '/api/berichten/:gesprekId',
  async (req) => {
    repo.stuurBericht(req.params.gesprekId, req.body.vanId, req.body.tekst);
    return berichten(repo, req.body.vanId);
  },
);

app.post<{ Params: { gesprekId: string }; Body: { gebruikerId: string } }>(
  '/api/berichten/:gesprekId/gelezen',
  async (req) => {
    repo.markeerGelezen(req.params.gesprekId, req.body.gebruikerId);
    return berichten(repo, req.body.gebruikerId);
  },
);

// ── Andere rollen: doktersassistent en huisarts (docs/05) ───────────────────

app.get('/api/assistent/overzicht', async () => assistentOverzicht(repo));
app.get('/api/huisarts/overzicht', async () => huisartsOverzicht(repo));

app.get<{ Params: { rol: string } }>('/api/agenda/:rol', async (req) =>
  agenda(repo, req.params.rol as 'poh-s' | 'assistent' | 'huisarts'));

app.post<{ Params: { id: string } }>('/api/triage/:id/afhandelen', async (req) => {
  repo.handelTriageAf(req.params.id);
  return assistentOverzicht(repo);
});

/** Routineverzoeken in één handeling accorderen — het verschil met 163 losse regels. */
app.post<{ Body: { ids: string[] } }>('/api/autorisatie/accordeer', async (req) => {
  repo.accordeer(req.body?.ids ?? []);
  return huisartsOverzicht(repo);
});

app.post<{ Params: { id: string }; Body: { reden: string } }>(
  '/api/autorisatie/:id/afwijzen',
  async (req) => {
    repo.wijsAutorisatieAf(req.params.id, req.body?.reden ?? 'geen reden opgegeven');
    return huisartsOverzicht(repo);
  },
);

// ── Ingebedde partnerapps ───────────────────────────────────────────────────

app.get('/api/intakes', async () => intakes(repo));

app.post<{ Params: { id: string } }>('/api/intake/:id/bevestig', async (req, reply) => {
  const intake = repo.intakes().find((i) => i.id === req.params.id);
  if (!intake) return reply.code(404).send({ fout: 'intake niet gevonden' });
  repo.bevestigIntake(req.params.id);
  return { intake: repo.intakes().find((i) => i.id === req.params.id) };
});

// ── Configuratie (docs/14) ──────────────────────────────────────────────────

app.get('/api/beheer', async () => beheer());

// ── Protocol en verantwoording ──────────────────────────────────────────────

app.get<{ Params: { id: string } }>('/api/patient/:id/bereikbaarheid', async (req) =>
  bereikbaarheidVoor(repo, req.params.id));

app.get<{ Params: { id: string } }>('/api/taken/:id', async (req) =>
  takenoverzicht(repo, req.params.id));

app.post<{ Body: NieuweTaak & { door: string } }>('/api/taken', async (req) => {
  const { door, ...nieuw } = req.body;
  return zetTaakUit(repo, nieuw, door);
});

app.post<{ Params: { id: string }; Body: { start: string } }>(
  '/api/taken/:id/plannen', async (req) =>
    ({ taak: planTaak(repo, req.params.id, req.body.start) }));

app.post<{ Params: { id: string }; Body: { door: string; uitkomst: string } }>(
  '/api/taken/:id/afronden', async (req) =>
    ({ taak: rondTaakAf(repo, req.params.id, req.body.door, req.body.uitkomst) }));

app.post<{ Body: { blokId: string; rol: string; start: string } }>('/api/werkblok', async (req) => {
  planWerkblok(repo, req.body);
  return planbordPraktijk(repo);
});

app.get<{ Querystring: { gebruiker?: string } }>('/api/protocol', async (req) =>
  protocoloverzicht(repo, req.query.gebruiker));

app.post<{ Body: Protocolwijziging & { door: string } }>('/api/protocol/wijzig', async (req) => {
  const { door, ...wijziging } = req.body;
  return wijzigProtocol(repo, wijziging, door);
});

app.post<{ Body: { moduleId: string; itemCode?: string; door: string } }>(
  '/api/protocol/herstel', async (req) =>
    herstelProtocol(repo, req.body.moduleId, req.body.itemCode, req.body.door));

// ── Terminologie (docs/02) ──────────────────────────────────────────────────

app.get<{ Querystring: { q?: string; breed?: string; limiet?: string } }>(
  '/api/terminologie/zoek',
  async (req) => {
    const { q = '', breed, limiet } = req.query;
    const treffers = terminologie.zoek(q, {
      niveaus: breed === 'true'
        ? ['registratieset', 'uitbreidingsset', 'extern']
        : ['registratieset', 'uitbreidingsset'],
      limiet: limiet ? Number(limiet) : 20,
    });
    return { waarschuwing: DEMO_SEED_WAARSCHUWING, aantal: treffers.length, treffers };
  },
);

app.post<{ Body: { codings: { system: string; code: string; display?: string }[]; bron?: string } }>(
  '/api/terminologie/ontvang',
  async (req) => terminologie.ontvang(req.body.codings ?? [], req.body.bron),
);

// ── Vragenlijsten (docs/06) ─────────────────────────────────────────────────

app.get('/api/vragenlijsten', async () =>
  vragenlijsten.map((v) => ({ id: v.id, naam: v.naam, versie: v.versie, doel: v.doel, licentie: v.licentie })));

app.get<{ Params: { id: string } }>('/api/vragenlijst/:id', async (req, reply) => {
  const lijst = vindVragenlijst(req.params.id);
  return lijst ?? reply.code(404).send({ fout: 'vragenlijst niet gevonden' });
});

app.post<{ Params: { id: string }; Body: { antwoorden: Record<string, unknown>; historie?: unknown } }>(
  '/api/vragenlijst/:id/verwerk',
  async (req, reply) => {
    const uitkomst = verwerkVragenlijst(req.params.id, req.body.antwoorden ?? {}, req.body.historie);
    return uitkomst ?? reply.code(404).send({ fout: 'vragenlijst niet gevonden' });
  },
);

// ── FHIR-facade (docs/08 §5) ────────────────────────────────────────────────

app.get('/fhir/metadata', async () => ({
  resourceType: 'CapabilityStatement',
  status: 'draft', date: new Date().toISOString(),
  publisher: 'Cadans', kind: 'instance',
  fhirVersion: '4.0.1', format: ['json'],
  rest: [{
    mode: 'server',
    resource: [
      { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
      { type: 'EpisodeOfCare', interaction: [{ code: 'search-type' }] },
      { type: 'Observation', interaction: [{ code: 'search-type' }] },
      { type: 'CarePlan', interaction: [{ code: 'search-type' }] },
      { type: 'Questionnaire', interaction: [{ code: 'read' }, { code: 'search-type' }] },
    ],
  }],
}));

function bundle(resources: unknown[]) {
  return { resourceType: 'Bundle', type: 'searchset', total: resources.length,
    entry: resources.map((r) => ({ resource: r })) };
}

app.get<{ Querystring: { _count?: string } }>('/fhir/Patient', async (req) =>
  bundle(repo.alleDossiers().slice(0, Number(req.query._count ?? 50)).map((d) => d.patient)));

app.get<{ Params: { id: string } }>('/fhir/Patient/:id', async (req, reply) => {
  const dossier = repo.dossier(req.params.id);
  return dossier?.patient ?? reply.code(404).send({
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient niet gevonden' }],
  });
});

app.get<{ Querystring: { patient?: string } }>('/fhir/EpisodeOfCare', async (req, reply) => {
  if (!req.query.patient) return reply.code(400).send({ fout: 'parameter patient is verplicht' });
  return bundle(repo.dossier(req.query.patient)?.episodes ?? []);
});

app.get<{ Querystring: { patient?: string; code?: string } }>('/fhir/Observation', async (req, reply) => {
  if (!req.query.patient) return reply.code(400).send({ fout: 'parameter patient is verplicht' });
  const observaties = repo.dossier(req.query.patient)?.observaties ?? [];
  return bundle(req.query.code
    ? observaties.filter((o) => o.code.coding?.some((c) => c.code === req.query.code))
    : observaties);
});

app.get<{ Querystring: { patient?: string } }>('/fhir/CarePlan', async (req, reply) => {
  if (!req.query.patient) return reply.code(400).send({ fout: 'parameter patient is verplicht' });
  const overzicht = patientOverzicht(repo, req.query.patient);
  if (!overzicht) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
  return bundle([{
    resourceType: 'CarePlan',
    id: `${req.query.patient}-zorgplan`,
    status: 'active', intent: 'plan',
    subject: { reference: `Patient/${req.query.patient}` },
    period: { start: overzicht.zorgplan.contacten[0]?.datum },
    // Eén zorgplan met categorieën per aandachtsgebied — niet één plan per aandoening.
    category: overzicht.zorgplan.modules.map((m) => ({ text: m.naam })),
    goal: overzicht.zorgplan.doelen.map((d) => ({ display: d.tekst })),
    activity: overzicht.zorgplan.contacten.map((c) => ({
      detail: {
        status: 'scheduled',
        scheduledTiming: { event: [c.datum] },
        description: `${c.soort} (${c.duurMinuten} min) — ${c.modules.join(' + ')}`,
        code: { text: c.metingen.map((m) => m.naam).join(', ') },
      },
    })),
  }]);
});

app.get('/fhir/Questionnaire', async () => bundle(vragenlijsten));

app.get('/api/gezondheid', async () => ({
  status: 'ok',
  patienten: repo.alleDossiers().length,
  terminologieConcepten: terminologie.aantal(),
  zorgmodules: modules.length,
  regelsetVersie: REGELSET_VERSIE,
  systemen: SYSTEEM,
}));

const poort = Number(process.env.PORT ?? 3000);
app.listen({ port: poort, host: '0.0.0.0' })
  .then(() => {
    console.log(`API luistert op http://localhost:${poort}`);
    console.log(`  Werkproces : /api/poh/dagstart, /aanloop, /voorbereiding, /opvolgen, /monitoring, /instroom, /afronden`);
    console.log(`  Protocol   : /api/protocol  (${modules.length} aandachtsgebieden, regelset ${REGELSET_VERSIE})`);
    console.log(`  FHIR       : /fhir/metadata, /fhir/CarePlan?patient=...`);
    console.log(`  LET OP     : ${DEMO_SEED_WAARSCHUWING}`);
  })
  .catch((fout) => { app.log.error(fout); process.exit(1); });
