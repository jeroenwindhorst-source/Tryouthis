import test from 'node:test';
import assert from 'node:assert/strict';
import { bouwZorgplan, beoordeelInclusie, planOproepen } from '../dist/index.js';
import { maakDossier, multimorbideDossier } from './helpers.js';

const PEILDATUM = new Date('2026-09-15T08:00:00+02:00');

test('multimorbiditeit: drie zorgprogramma’s worden samengevoegd tot minder contacten', () => {
  const dossier = multimorbideDossier();
  const plan = bouwZorgplan(dossier, ['dm2', 'cvrm', 'copd'], 'basis', { peildatum: PEILDATUM });

  assert.ok(plan.contacten.length > 0, 'er moet een planning zijn');
  assert.ok(
    plan.vergelijking.metSamenvoeging < plan.vergelijking.zonderSamenvoeging,
    `samenvoeging moet contacten besparen; nu ${plan.vergelijking.metSamenvoeging} vs ${plan.vergelijking.zonderSamenvoeging}`,
  );
  assert.ok(plan.vergelijking.bespaardeContacten >= 3,
    `verwacht minstens 3 bespaarde contacten, kreeg ${plan.vergelijking.bespaardeContacten}`);
  assert.ok(plan.vergelijking.bespaardeMinuten > 0, 'samenvoeging moet ook consulttijd besparen');
});

test('een gedeelde meting wordt één keer gepland en telt voor meerdere programma’s', () => {
  const dossier = multimorbideDossier();
  const plan = bouwZorgplan(dossier, ['dm2', 'cvrm', 'copd'], 'basis', { peildatum: PEILDATUM });

  // Bloeddruk zit in zowel DM2 als CVRM; gewicht in alle drie.
  const gedeeld = plan.contacten.flatMap((c) => c.metingen).filter((m) => m.programmas.length > 1);
  assert.ok(gedeeld.length > 0, 'er moet minstens één gedeelde meting zijn');

  for (const contact of plan.contacten) {
    const codes = contact.metingen.map((m) => m.code);
    assert.equal(new Set(codes).size, codes.length, 'binnen één contact mag geen meting dubbel staan');
  }

  const rr = plan.contacten.flatMap((c) => c.metingen).find((m) => m.code === '8480-6');
  assert.ok(rr, 'bloeddruk moet gepland zijn');
  assert.ok(rr.programmas.includes('dm2') && rr.programmas.includes('cvrm'),
    'bloeddruk moet voor DM2 én CVRM tellen');
});

test('geen enkele meting wordt later gepland dan de datum waarop hij verloopt', () => {
  const dossier = multimorbideDossier();
  const plan = bouwZorgplan(dossier, ['dm2', 'cvrm', 'copd'], 'basis', { peildatum: PEILDATUM });

  for (const contact of plan.contacten) {
    for (const meting of contact.metingen) {
      assert.ok(contact.datum <= meting.vervaltOp,
        `${meting.naam} vervalt ${meting.vervaltOp} maar staat gepland op ${contact.datum}`);
    }
  }
});

test('intensiteit stuurt de planning: extensief plant minder, intensief meer', () => {
  const dossier = multimorbideDossier();
  const opties = { peildatum: PEILDATUM };
  const basis = bouwZorgplan(dossier, ['dm2', 'cvrm', 'copd'], 'basis', opties);
  const extensief = bouwZorgplan(dossier, ['dm2', 'cvrm', 'copd'], 'extensief', opties);
  const intensief = bouwZorgplan(dossier, ['dm2', 'cvrm', 'copd'], 'intensief', opties);

  assert.ok(extensief.contacten.length <= basis.contacten.length,
    'extensief mag niet méér contacten opleveren dan basis');
  assert.ok(intensief.contacten.length >= basis.contacten.length,
    'intensief moet minstens zoveel contacten opleveren als basis');
});

test('palliatieve intensiteit zet het protocol uit, met uitleg', () => {
  const dossier = multimorbideDossier();
  const plan = bouwZorgplan(dossier, ['dm2', 'cvrm', 'copd'], 'palliatief', { peildatum: PEILDATUM });
  assert.equal(plan.contacten.length, 0);
  assert.ok(plan.toelichting.join(' ').includes('palliatief'));
});

test('eigen regie levert geen oproepen op', () => {
  const dossier = multimorbideDossier();
  const plan = bouwZorgplan(dossier, ['dm2', 'cvrm'], 'eigen-regie', { peildatum: PEILDATUM });
  assert.deepEqual(planOproepen(plan, dossier.patient, { peildatum: PEILDATUM }), []);
});

test('inclusie herkent kandidaten en levert onderbouwing', () => {
  const dossier = multimorbideDossier();
  const resultaat = beoordeelInclusie(dossier, [], undefined, PEILDATUM);

  const ids = resultaat.nieuweKandidaten.map((k) => k.programmaId).sort();
  assert.deepEqual(ids, ['copd', 'cvrm', 'dm2']);
  for (const kandidaat of resultaat.nieuweKandidaten) {
    assert.ok(kandidaat.onderbouwing.length > 0, 'elke kandidaat moet een onderbouwing hebben');
    assert.ok((kandidaat.gevolgen ?? []).length > 0, 'gevolgen van inclusie moeten zichtbaar zijn');
  }
});

test('exclusie: DM type 1 hoort niet in de DM2-keten', () => {
  const dossier = maakDossier({
    episodes: [
      { titel: 'Diabetes mellitus type 2', icpc: 'T90.02' },
      { titel: 'Diabetes mellitus type 1', icpc: 'T89' },
    ],
  });
  const resultaat = beoordeelInclusie(dossier, [], undefined, PEILDATUM);
  const dm2 = resultaat.beoordelingen.find((b) => b.programmaId === 'dm2');
  assert.equal(dm2.status, 'uitgesloten');
});

test('leeftijdscriterium sluit een te jonge patiënt uit van COPD-ketenzorg', () => {
  const dossier = maakDossier({
    geboortedatum: '1998-01-01',
    episodes: [{ titel: 'Chronische bronchitis/COPD', icpc: 'R95' }],
  });
  const resultaat = beoordeelInclusie(dossier, [], undefined, PEILDATUM);
  const copd = resultaat.beoordelingen.find((b) => b.programmaId === 'copd');
  assert.equal(copd.status, 'uitgesloten');
  assert.match(copd.onderbouwing, /leeftijd/);
});
