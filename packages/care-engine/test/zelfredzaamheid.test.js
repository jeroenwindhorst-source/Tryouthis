import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beoordeelZelfredzaamheid, bouwZorgplan, leegPersoonlijkPlan, planOproepen, suggesties, domeinen,
} from '../dist/index.js';
import { multimorbideDossier } from './helpers.js';

const PEILDATUM = new Date('2026-09-15T08:00:00+02:00');
const opties = { peildatum: PEILDATUM };

const alleDomeinen = (score) =>
  Object.fromEntries(domeinen.filter((d) => d.id !== 'justitie').map((d) => [d.id, score]));

function metScore(score, extra = {}) {
  return {
    scores: { ...alleDomeinen(score), ...(extra.scores ?? {}) },
    afgenomenOp: '2026-06-01',
    afgenomenDoor: 'Sanne Bakker, POH-S',
    ...extra,
  };
}

test('de score vertaalt naar een niveau en een factor op de intervallen', () => {
  assert.equal(beoordeelZelfredzaamheid(metScore(1)).niveau, 'acuut');
  assert.equal(beoordeelZelfredzaamheid(metScore(3)).niveau, 'voldoende');
  assert.equal(beoordeelZelfredzaamheid(metScore(5)).niveau, 'volledig');

  assert.ok(beoordeelZelfredzaamheid(metScore(1)).factor < 1, 'laag = vaker zien');
  assert.equal(beoordeelZelfredzaamheid(metScore(3)).factor, 1);
  assert.ok(beoordeelZelfredzaamheid(metScore(5)).factor > 1, 'hoog = minder vaak zien');
});

test('dezelfde klinische waarden, andere zelfredzaamheid, ander aantal contacten', () => {
  const dossier = multimorbideDossier();
  const kwetsbaar = bouwZorgplan(dossier,
    { ...leegPersoonlijkPlan(dossier.patient.id), zelfredzaamheid: metScore(2) }, opties);
  const zelfstandig = bouwZorgplan(dossier,
    { ...leegPersoonlijkPlan(dossier.patient.id), zelfredzaamheid: metScore(5) }, opties);

  assert.ok(kwetsbaar.contacten.length > zelfstandig.contacten.length,
    `kwetsbaar ${kwetsbaar.contacten.length} vs zelfstandig ${zelfstandig.contacten.length}`);
});

test('knelpunten worden per leefdomein benoemd, niet alleen als getal', () => {
  const beeld = beoordeelZelfredzaamheid(metScore(4, {
    scores: { 'geestelijke-gezondheid': 2, adl: 1 },
  }));
  const namen = beeld.knelpunten.map((k) => k.domein.id);
  assert.ok(namen.includes('adl') && namen.includes('geestelijke-gezondheid'));
  assert.equal(beeld.knelpunten[0].domein.id, 'adl', 'het laagste domein staat bovenaan');
});

test('een laag leefdomein activeert een aandachtsgebied, ook zonder diagnose', () => {
  const beeld = beoordeelZelfredzaamheid(metScore(4, { scores: { 'geestelijke-gezondheid': 1 } }));
  assert.ok(beeld.raaktModules.includes('mentaal'));

  const dossier = multimorbideDossier();
  const plan = bouwZorgplan(dossier, {
    ...leegPersoonlijkPlan(dossier.patient.id),
    zelfredzaamheid: metScore(4, { scores: { adl: 1, 'sociaal-netwerk': 2 } }),
  }, opties);
  assert.ok(plan.modules.some((m) => m.id === 'kwetsbaarheid'),
    'kwetsbaarheid hoort actief te worden bij lage ADL, ongeacht leeftijd');
});

test('wie digitaal niet bereikbaar is, krijgt geen portaaloproep', () => {
  const dossier = multimorbideDossier();
  const plan = bouwZorgplan(dossier, {
    ...leegPersoonlijkPlan(dossier.patient.id),
    zelfredzaamheid: metScore(2, { scores: { adl: 1, huisvesting: 2 } }),
  }, opties);

  assert.equal(plan.zelfredzaamheid.digitaalBereikbaar, false);
  const oproepen = planOproepen(plan, dossier.patient, opties);
  assert.ok(oproepen.length > 0);
  assert.ok(oproepen.every((o) => o.kanaal === 'telefoon' || o.kanaal === 'brief'),
    `verwacht telefoon of brief, kreeg ${oproepen.map((o) => o.kanaal).join(', ')}`);
});

test('achteruitgang in zelfredzaamheid levert een suggestie met onderbouwing', () => {
  const dossier = multimorbideDossier();
  const persoonlijk = {
    ...leegPersoonlijkPlan(dossier.patient.id),
    zelfredzaamheid: metScore(3, { vorige: { gemiddelde: 4.1, afgenomenOp: '2025-06-01' } }),
  };
  const plan = bouwZorgplan(dossier, persoonlijk, opties);
  const lijst = suggesties(dossier, plan, PEILDATUM);

  const s = lijst.find((x) => x.regelId === 'zelfredzaamheid-gedaald');
  assert.ok(s, 'een gedaalde score hoort te signaleren');
  assert.match(s.bevinding, /1\.1 punt lager/);
  assert.equal(s.klasse, 'klinisch');
});

test('zonder afname verandert er niets aan het protocol', () => {
  const beeld = beoordeelZelfredzaamheid({ scores: {}, afgenomenOp: '', afgenomenDoor: '' });
  assert.equal(beeld.factor, 1);
  assert.match(beeld.betekenis, /nog niet in kaart/);
});
