import test from 'node:test';
import assert from 'node:assert/strict';
import { bouwZorgplan, leegPersoonlijkPlan, suggesties, automatisering } from '../dist/index.js';
import { maakDossier, multimorbideDossier, stabielDossier } from './helpers.js';

const PEILDATUM = new Date('2026-09-15T08:00:00+02:00');

function voor(dossier, aanpassing = {}) {
  const plan = bouwZorgplan(
    dossier, { ...leegPersoonlijkPlan(dossier.patient.id), ...aanpassing }, { peildatum: PEILDATUM },
  );
  return { plan, lijst: suggesties(dossier, plan, PEILDATUM) };
}

test('elke suggestie is narekenbaar: bevinding, onderbouwing en regelversie', () => {
  const { lijst } = voor(multimorbideDossier());
  assert.ok(lijst.length > 0);
  for (const s of lijst) {
    assert.ok(s.bevinding.length > 0, `${s.regelId} mist een bevinding`);
    assert.ok(s.onderbouwing.length > 0, `${s.regelId} mist een onderbouwing`);
    assert.ok(s.regelVersie.length > 0, `${s.regelId} mist een versie (MDR-eis)`);
    assert.ok(s.acties.length > 0, `${s.regelId} biedt geen actie aan`);
    assert.ok(s.acties.some((a) => a.aard === 'afwijzen'), `${s.regelId} moet afwijzen toestaan`);
    for (const actie of s.acties) {
      assert.ok(actie.gevolg.length > 0, `actie ${actie.id} moet zeggen wat er gebeurt`);
    }
  }
});

test('klinische suggesties draaien nooit automatisch', () => {
  const { lijst } = voor(multimorbideDossier());
  for (const s of lijst.filter((x) => x.klasse === 'klinisch')) {
    assert.equal(s.automatisch, false, `${s.regelId} is klinisch en mag niet automatisch`);
  }
});

test('logistieke suggesties mogen wel automatisch', () => {
  const { lijst } = voor(multimorbideDossier());
  const logistiek = lijst.filter((x) => x.klasse === 'logistiek');
  assert.ok(logistiek.length > 0, 'er moet logistiek werk zijn om te automatiseren');
  assert.ok(logistiek.some((s) => s.automatisch));
});

test('ontregelde glucose levert een voorstel met de feitelijke waarde erin', () => {
  const { lijst } = voor(multimorbideDossier());
  const s = lijst.find((x) => x.regelId === 'glucose-ontregeld');
  assert.ok(s, 'HbA1c 71 hoort een suggestie op te leveren');
  assert.match(s.bevinding, /71 mmol\/mol/);
  assert.equal(s.klasse, 'klinisch');
  assert.ok(s.richtlijn.naam.includes('NHG'));
});

test('bloeddruk boven 160 stelt eerst een thuismeetreeks voor, niet meteen medicatie', () => {
  const dossier = maakDossier({
    episodes: [{ titel: 'Hypertensie zonder orgaanbeschadiging', icpc: 'K86' }],
    observaties: [{ code: '8480-6', waarde: 168, eenheid: 'mmHg', op: '2026-08-20T09:00:00+02:00' }],
  });
  const { lijst } = voor(dossier);
  const s = lijst.find((x) => x.regelId === 'bloeddruk-te-hoog');
  assert.ok(s);
  assert.equal(s.acties[0].id, 'thuismeetreeks', 'de eerste actie hoort de betrouwbaarste te zijn');
});

test('gedaalde nierfunctie gaat naar de huisarts, niet naar de POH', () => {
  const dossier = maakDossier({
    episodes: [{ titel: 'Diabetes mellitus type 2', icpc: 'T90.02' }],
    observaties: [
      { code: '62238-1', waarde: 62, eenheid: 'ml/min', op: '2025-09-01T09:00:00+02:00' },
      { code: '62238-1', waarde: 38, eenheid: 'ml/min', op: '2026-08-01T09:00:00+02:00' },
    ],
  });
  const { lijst } = voor(dossier);
  const s = lijst.find((x) => x.regelId === 'nierfunctie-gedaald');
  assert.ok(s);
  assert.equal(s.rol, 'huisarts');
  assert.match(s.bevinding, /38 ml\/min/);
});

test('het systeem stelt ook voor om minder te doen', () => {
  const { lijst } = voor(stabielDossier());
  const s = lijst.find((x) => x.regelId === 'afschalen-stabiel');
  assert.ok(s, 'drie stabiele metingen horen een afschaalvoorstel op te leveren');
  assert.equal(s.soort, 'intensiteit');
  assert.equal(s.acties[0].id, 'extensief');
});

test('roken levert alleen een advies op als er een relevante module actief is', () => {
  const rookt = { code: '72166-2', snomed: '77176002', display: 'Roker', op: '2026-05-01T09:00:00+02:00' };

  const metCopd = maakDossier({
    episodes: [{ titel: 'Chronische bronchitis/COPD', icpc: 'R95' }],
    observaties: [rookt],
  });
  assert.ok(voor(metCopd).lijst.some((s) => s.regelId === 'stoppen-met-roken'));

  const zonder = maakDossier({ geboortedatum: '1995-01-01', observaties: [rookt] });
  assert.ok(!voor(zonder).lijst.some((s) => s.regelId === 'stoppen-met-roken'));
});

test('urgente klinische suggesties staan bovenaan', () => {
  const dossier = maakDossier({
    episodes: [{ titel: 'Diabetes mellitus type 2', icpc: 'T90.02' }],
    observaties: [
      { code: '59261-8', waarde: 88, eenheid: 'mmol/mol', op: '2026-08-01T09:00:00+02:00' },
      { code: '8480-6', waarde: 142, eenheid: 'mmHg', op: '2026-08-01T09:00:00+02:00' },
    ],
  });
  const { lijst } = voor(dossier);
  assert.equal(lijst[0].klasse, 'klinisch');
  assert.equal(lijst[0].ernst, 'urgent');
});

test('automatisering scheidt wat vanzelf kan van wat een mens nodig heeft', () => {
  const { lijst } = voor(multimorbideDossier());
  const overzicht = automatisering(lijst);
  assert.equal(
    overzicht.automatischUitgevoerd.length + overzicht.wachtOpMens.length, lijst.length,
  );
  assert.ok(overzicht.automatischUitgevoerd.every((s) => s.klasse === 'logistiek'),
    'alleen logistiek werk mag in de automatische stapel');
  assert.ok(overzicht.automatiseringsgraad > 0 && overzicht.automatiseringsgraad < 100);
});
