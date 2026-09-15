import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bouwZorgplan, leegPersoonlijkPlan, beoordeelInstroom, planOproepen, ketenbijdragen,
} from '../dist/index.js';
import { maakDossier, multimorbideDossier, stabielDossier } from './helpers.js';

const PEILDATUM = new Date('2026-09-15T08:00:00+02:00');
const opties = { peildatum: PEILDATUM };

function plan(dossier, aanpassing = {}) {
  return bouwZorgplan(
    dossier,
    { ...leegPersoonlijkPlan(dossier.patient.id), ...aanpassing },
    opties,
  );
}

test('het plan kent geen zorgprogramma’s, alleen aandachtsgebieden', () => {
  const p = plan(multimorbideDossier());
  assert.ok(p.modules.length >= 4, `verwacht meerdere modules, kreeg ${p.modules.length}`);
  for (const contact of p.contacten) {
    assert.ok(Array.isArray(contact.modules) && contact.modules.length > 0);
    assert.equal(contact.programmas, undefined, 'een contact hoort niet naar een programma te verwijzen');
  }
});

test('drie aandoeningen leveren één plan met minder contacten dan losse trajecten', () => {
  const p = plan(multimorbideDossier());
  assert.ok(p.vergelijking.traditioneleTrajecten.length >= 3,
    `verwacht ≥3 traditionele trajecten, kreeg ${p.vergelijking.traditioneleTrajecten.length}`);
  assert.ok(p.vergelijking.geintegreerdeContacten < p.vergelijking.traditioneleContacten,
    `${p.vergelijking.geintegreerdeContacten} vs ${p.vergelijking.traditioneleContacten}`);
  assert.ok(p.vergelijking.bespaardeMinuten > 0);
});

test('een meting die meerdere aandachtsgebieden bedient, wordt één keer gepland', () => {
  const p = plan(multimorbideDossier());
  for (const contact of p.contacten) {
    const codes = contact.metingen.map((m) => m.code);
    assert.equal(new Set(codes).size, codes.length, 'geen dubbele metingen binnen één contact');
  }
  const gedeeld = p.contacten.flatMap((c) => c.metingen).filter((m) => m.modules.length > 1);
  assert.ok(gedeeld.length > 0, 'er moet minstens één gedeelde meting zijn');
});

test('geen meting wordt later gepland dan de datum waarop zij verloopt', () => {
  const p = plan(multimorbideDossier());
  for (const contact of p.contacten) {
    for (const meting of contact.metingen) {
      assert.ok(contact.datum <= meting.vervaltOp,
        `${meting.naam} vervalt ${meting.vervaltOp} maar staat op ${contact.datum}`);
    }
  }
});

test('het interval volgt uit de situatie, niet uit het ziektelabel', () => {
  const ontregeld = plan(multimorbideDossier());
  const stabiel = plan(stabielDossier());

  const hba1cOntregeld = ontregeld.modules.flatMap((m) => m.items).find((i) => i.code === '59261-8');
  const hba1cStabiel = stabiel.modules.flatMap((m) => m.items).find((i) => i.code === '59261-8');

  assert.ok(hba1cOntregeld.intervalDagen < hba1cStabiel.intervalDagen,
    `ontregeld (${hba1cOntregeld.intervalDagen}d) hoort korter dan stabiel (${hba1cStabiel.intervalDagen}d)`);
  assert.match(hba1cOntregeld.intervalReden, /64/);
  assert.match(hba1cStabiel.intervalReden, /onder controle/);
});

test('een module handmatig uitzetten werkt, met vastgelegde reden', () => {
  const dossier = multimorbideDossier();
  const zonder = plan(dossier, {
    moduleKeuzes: [{
      moduleId: 'ademhaling', aan: false,
      reden: 'wordt door de longarts gevolgd', door: 'S. Bakker', op: '2026-09-15',
    }],
  });
  assert.ok(!zonder.modules.some((m) => m.id === 'ademhaling'));
  assert.ok(zonder.nietActief.some((m) => m.id === 'ademhaling' && m.herkomst === 'handmatig-uit'));
  assert.ok(zonder.consequenties.some((c) => c.includes('longarts')));
});

test('de patiënt kan een maximum aan contacten stellen; het plan past zich aan', () => {
  const dossier = multimorbideDossier();
  const standaard = plan(dossier);
  const beperkt = plan(dossier, { voorkeuren: { maxContactenPerJaar: 2 } });

  assert.ok(beperkt.contacten.length <= standaard.contacten.length);
  assert.ok(beperkt.contacten.length <= 3, `verwacht hooguit 3 contacten, kreeg ${beperkt.contacten.length}`);
  assert.ok(beperkt.consequenties.some((c) => c.includes('maximaal 2 contacten')),
    'de gevolgen van die keuze moeten expliciet benoemd worden');
});

test('een persoonlijke intervalafspraak overrulet protocol én situatie', () => {
  const p = plan(multimorbideDossier(), {
    itemKeuzes: [{ code: '59261-8', intervalDagen: 180, reden: 'patiënt wil niet vaker prikken' }],
  });
  const hba1c = p.modules.flatMap((m) => m.items).find((i) => i.code === '59261-8');
  assert.equal(hba1c.intervalDagen, 180);
  assert.match(hba1c.intervalReden, /persoonlijke afspraak/);
});

test('palliatief beleid zet het protocol uit en zegt wat dat betekent', () => {
  const p = plan(multimorbideDossier(), { intensiteit: 'palliatief' });
  assert.equal(p.contacten.length, 0);
  assert.equal(p.modules.length, 0);
  assert.ok(p.consequenties.some((c) => c.includes('bewuste keuze')));
});

test('eigen regie levert geen oproepen op, maar wel bewaking', () => {
  const dossier = multimorbideDossier();
  const p = plan(dossier, { intensiteit: 'eigen-regie' });
  assert.deepEqual(planOproepen(p, dossier.patient, opties), []);
  assert.ok(p.consequenties.some((c) => c.includes('geen stilte')));
});

test('ketens worden automatisch afgeleid en sturen het plan niet aan', () => {
  const p = plan(multimorbideDossier());
  const ids = p.ketens.map((k) => k.ketenId).sort();
  assert.deepEqual(ids, ['copd', 'cvrm', 'dm']);
  for (const keten of p.ketens) {
    assert.ok(keten.grondslag.length > 0, 'elke keten moet zeggen waarom hij van toepassing is');
    assert.ok(keten.declaratie.prestatiecode.length > 0);
    assert.ok(keten.indicatoren.length > 0);
  }
});

test('indicatoren tonen welke verantwoording nog ontbreekt', () => {
  const dossier = multimorbideDossier();
  const bijdragen = ketenbijdragen(dossier, ['glucose', 'vaatrisico'], PEILDATUM);
  const dm = bijdragen.find((k) => k.ketenId === 'dm');
  assert.ok(dm.volledigheid < 1, 'niet alle indicatoren zijn gevuld in dit dossier');
  const ontbrekend = dm.indicatoren.filter((i) => !i.voldaan);
  assert.ok(ontbrekend.every((i) => i.toelichting.length > 0), 'elk gat moet een toelichting hebben');
});

test('instroom is een zorginhoudelijke vraag, geen inclusiebesluit', () => {
  const resultaat = beoordeelInstroom(multimorbideDossier(), [], undefined, PEILDATUM);
  const nieuw = resultaat.nieuw.map((m) => m.moduleId).sort();
  assert.ok(nieuw.includes('glucose') && nieuw.includes('vaatrisico') && nieuw.includes('ademhaling'));
  for (const module of resultaat.nieuw) {
    assert.ok(module.onderbouwing.length > 0);
  }
});

test('een module wordt niet relevant zonder grondslag in het dossier', () => {
  const dossier = maakDossier({
    geboortedatum: '1990-01-01',
    episodes: [{ titel: 'Artrose overig', icpc: 'L91' }],
  });
  const resultaat = beoordeelInstroom(dossier, [], undefined, PEILDATUM);
  assert.equal(resultaat.nieuw.length, 0, 'artrose alleen activeert geen chronische aandachtsgebieden');
});

test('medicatieveiligheid komt op bij polyfarmacie, ongeacht diagnose', () => {
  const dossier = maakDossier({
    geboortedatum: '1944-03-03',
    episodes: [{ titel: 'Hypertensie zonder orgaanbeschadiging', icpc: 'K86' }],
    medicatie: [
      { atc: 'C09AA05', naam: 'Ramipril' }, { atc: 'C07AB07', naam: 'Bisoprolol' },
      { atc: 'C10AA01', naam: 'Simvastatine' }, { atc: 'A02BC01', naam: 'Omeprazol' },
      { atc: 'N02BE01', naam: 'Paracetamol' },
    ],
  });
  const p = plan(dossier);
  assert.ok(p.modules.some((m) => m.id === 'medicatieveiligheid'),
    'vijf chronische middelen horen medicatieveiligheid te activeren');
});
