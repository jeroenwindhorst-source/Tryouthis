import Fastify from 'fastify';
import { SYSTEEM, DEMO_SEED_WAARSCHUWING } from '@zpe/terminology';
import { vindVragenlijst, vragenlijsten, zorgprogrammas } from '@zpe/care-engine';
import { terminologie } from './terminologie.js';
import { InMemoryRepository } from './store.js';
import {
  dagstart, inclusieKandidaten, monitoringCohort, patientOverzicht,
  praktijkSamenvatting, verwerkVragenlijst,
} from './bff.js';

const repo = new InMemoryRepository();

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' } });

// In productie staat hier een strikte allowlist; de dev-server draait op een andere poort.
app.addHook('onSend', async (_req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Headers', 'content-type');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
});
app.options('/*', async (_req, reply) => reply.code(204).send());

// ── BFF: werkplek POH-Somatiek (docs/05) ────────────────────────────────────

app.get('/api/poh/dagstart', async () => dagstart(repo));
app.get('/api/poh/monitoring', async () => monitoringCohort(repo));
app.get('/api/inclusie/kandidaten', async () => inclusieKandidaten(repo));
app.get('/api/praktijk/samenvatting', async () => praktijkSamenvatting(repo));

app.post<{ Body: { patientId: string; programmaId: string; besluit: 'includeer' | 'wijs-af' } }>(
  '/api/inclusie/besluit',
  async (req, reply) => {
    const { patientId, programmaId, besluit } = req.body ?? {};
    if (!repo.dossier(patientId)) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
    if (besluit === 'includeer') repo.includeer(patientId, programmaId);
    else repo.wijsAf(patientId, programmaId);
    return { patientId, programmaId, besluit, overzicht: patientOverzicht(repo, patientId) };
  },
);

app.get<{ Params: { id: string } }>('/api/patient/:id', async (req, reply) => {
  const overzicht = patientOverzicht(repo, req.params.id);
  return overzicht ?? reply.code(404).send({ fout: 'patiënt niet gevonden' });
});

app.post<{ Params: { id: string }; Body: { intensiteit: string; reden?: string } }>(
  '/api/patient/:id/intensiteit',
  async (req, reply) => {
    if (!repo.dossier(req.params.id)) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
    // Reden wordt in productie als Provenance vastgelegd (docs/04 §4).
    repo.stelIntensiteitIn(req.params.id, req.body.intensiteit);
    return patientOverzicht(repo, req.params.id);
  },
);

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

app.get('/api/zorgprogrammas', async () =>
  zorgprogrammas.map((z) => ({
    id: z.id, naam: z.naam, versie: z.versie, richtlijn: z.richtlijn,
    activiteiten: z.activiteiten.map((a) => ({
      id: a.id, naam: a.naam, soort: a.soort, rol: a.rol,
      metingen: a.metingen.map((m) => ({ code: m.code, naam: m.naam, maxOuderdomDagen: m.maxOuderdomDagen })),
    })),
    declaratie: z.declaratie,
  })));

// ── FHIR-facade (docs/08 §5) ────────────────────────────────────────────────
// Bewust dezelfde bron als de BFF hierboven: er is geen interne API die meer kan.

app.get('/fhir/metadata', async () => ({
  resourceType: 'CapabilityStatement',
  status: 'draft',
  date: new Date().toISOString(),
  publisher: 'Zorgplatform Eerstelijn',
  kind: 'instance',
  fhirVersion: '4.0.1',
  format: ['json'],
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
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map((r) => ({ resource: r })),
  };
}

app.get<{ Querystring: { _count?: string } }>('/fhir/Patient', async (req) => {
  const max = Number(req.query._count ?? 50);
  return bundle(repo.alleDossiers().slice(0, max).map((d) => d.patient));
});

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
  const gefilterd = req.query.code
    ? observaties.filter((o) => o.code.coding?.some((c) => c.code === req.query.code))
    : observaties;
  return bundle(gefilterd);
});

app.get<{ Querystring: { patient?: string } }>('/fhir/CarePlan', async (req, reply) => {
  if (!req.query.patient) return reply.code(400).send({ fout: 'parameter patient is verplicht' });
  const overzicht = patientOverzicht(repo, req.query.patient);
  if (!overzicht) return reply.code(404).send({ fout: 'patiënt niet gevonden' });
  return bundle([{
    resourceType: 'CarePlan',
    id: `${req.query.patient}-zorgplan`,
    status: 'active',
    intent: 'plan',
    subject: { reference: `Patient/${req.query.patient}` },
    period: { start: overzicht.zorgplan.contacten[0]?.datum },
    activity: overzicht.zorgplan.contacten.map((c) => ({
      detail: {
        status: 'scheduled',
        scheduledTiming: { event: [c.datum] },
        description: `${c.soort} (${c.duurMinuten} min) — ${c.programmas.join(' + ')}`,
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
  systemen: SYSTEEM,
}));

const poort = Number(process.env.PORT ?? 3000);
app.listen({ port: poort, host: '0.0.0.0' })
  .then(() => {
    console.log(`API luistert op http://localhost:${poort}`);
    console.log(`  BFF     : /api/poh/dagstart, /api/poh/monitoring, /api/inclusie/kandidaten`);
    console.log(`  FHIR    : /fhir/metadata, /fhir/Patient, /fhir/CarePlan?patient=...`);
    console.log(`  LET OP  : ${DEMO_SEED_WAARSCHUWING}`);
  })
  .catch((fout) => { app.log.error(fout); process.exit(1); });
