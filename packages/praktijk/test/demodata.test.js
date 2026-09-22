import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository } from '../dist/store.js';
import { dagstart, overleg, patientOverzicht } from '../dist/bff.js';

/**
 * De demopopulatie is het product zelf zodra iemand hem laat zien.
 *
 * Deze tests bewaken niet de logica maar de geloofwaardigheid: een melding die zegt
 * "COPD met een exacerbatie in de voorgeschiedenis" moet bij iemand terechtkomen bij wie
 * dat in het dossier staat, en een klok moet een klok zijn. Wie doorklikt tijdens een
 * demo, komt precies op deze plekken uit.
 */

const repo = new InMemoryRepository();

const naam = (id) => patientOverzicht(repo, id).patient.naam;
const actieveIcpc = (id) => repo.dossier(id).episodes
  .filter((e) => e.status === 'active')
  .flatMap((e) => (e.code.coding ?? []).map((c) => c.code));
const actieveAtc = (id) => repo.dossier(id).medicatie
  .filter((m) => m.status === 'active')
  .flatMap((m) => (m.middel.coding ?? []).map((c) => c.code));
const heeft = (codes, prefixen) => prefixen.some((p) => codes.some((c) => c.startsWith(p)));

test('demodata: elke tijdstempel is een bestaande kloktijd', () => {
  const stempels = [
    ...repo.triage().map((t) => t.binnenOp),
    ...repo.agenda().map((a) => a.start),
    ...repo.agenda().map((a) => a.aangemeldOm).filter(Boolean),
  ];
  assert.ok(stempels.length > 20);
  for (const stempel of stempels) {
    const uur = Number(stempel.slice(11, 13));
    const minuut = Number(stempel.slice(14, 16));
    assert.ok(uur >= 0 && uur <= 23, `uur buiten bereik in ${stempel}`);
    assert.ok(minuut >= 0 && minuut <= 59, `minuut buiten bereik in ${stempel}`);
  }
});

test('demodata: geen twee patiënten met dezelfde naam', () => {
  const namen = repo.alleDossiers().map((d) => naam(d.patient.id));
  const uniek = new Set(namen);
  assert.equal(uniek.size, namen.length,
    `dubbele namen: ${namen.filter((n, i) => namen.indexOf(n) !== i).join(', ')}`);
});

test('demodata: dezelfde patiënt belt niet twee keer in één ochtend', () => {
  const ids = repo.triage().map((t) => t.patientId);
  assert.equal(new Set(ids).size, ids.length);
});

test('acuut: elk signaal komt bij iemand bij wie de onderbouwing in het dossier staat', () => {
  const signalen = repo.acuteSignalen();
  // De sessie begint op 0 seconden; alleen het spoedgeval is dan binnen. De rest toetsen
  // we via dezelfde lijst zodra hij compleet is — hier via de onderliggende opslag.
  assert.ok(signalen.length >= 1);

  const eisen = {
    'Belt zelf': { icpc: ['T90', 'K86'] },
    'Portaalbericht': { icpc: ['R95', 'R96'], atc: ['R03'] },
    'Thuismeter': { icpc: ['K86', 'K87'], atc: ['C09', 'C07', 'C08', 'C03'] },
    'Labuitslag': { atc: ['C09'] },
  };

  for (const signaal of signalen) {
    const sleutel = Object.keys(eisen).find((k) => signaal.samenvatting.startsWith(k));
    if (!sleutel) continue;
    const eis = eisen[sleutel];
    if (eis.icpc) {
      assert.ok(heeft(actieveIcpc(signaal.patientId), eis.icpc),
        `${signaal.naam} draagt "${signaal.samenvatting}" zonder passende episode`);
    }
    if (eis.atc) {
      assert.ok(heeft(actieveAtc(signaal.patientId), eis.atc),
        `${signaal.naam} draagt "${signaal.samenvatting}" zonder passende medicatie`);
    }
    assert.ok(repo.dossier(signaal.patientId).contacten.length >= 3,
      `${signaal.naam} heeft geen voorgeschiedenis om op te bouwen`);
  }
});

test('bespreeklijst: elke vraag past bij het dossier waarover hij gaat', () => {
  const punten = overleg(repo, 'poh-s').open;
  assert.ok(punten.length >= 3);

  for (const punt of punten) {
    const icpc = actieveIcpc(punt.patientId);
    assert.ok(icpc.length > 0, `${punt.naam} staat op de bespreeklijst met een leeg dossier`);

    if (punt.vraag.includes('metformine')) {
      assert.ok(heeft(icpc, ['T90']), 'een metforminevraag hoort bij diabetes');
      assert.ok(heeft(actieveAtc(punt.patientId), ['A10BA']), 'en bij iemand die metformine gebruikt');
    }
    if (punt.vraag.includes('haar man')) {
      assert.equal(repo.dossier(punt.patientId).patient.geslacht, 'female');
    }
    if (punt.vraag.includes('bloeddruk')) {
      assert.ok(heeft(icpc, ['K86', 'K87']), 'een bloeddrukvraag hoort bij hypertensie');
    }
    if (punt.vraag.includes('COPD')) {
      assert.ok(heeft(icpc, ['R95', 'R96']), 'een COPD-vraag hoort bij COPD');
    }
  }
});

test('bespreeklijst: de context citeert het dossier in plaats van te verzinnen', () => {
  for (const punt of overleg(repo, 'poh-s').open) {
    assert.ok(punt.context && punt.context.trim() !== '');
    // Een context die een middel noemt, noemt een middel dat deze patiënt gebruikt.
    const genoemd = punt.context.match(/Gebruikt ([^.]+)\./)?.[1];
    if (!genoemd || genoemd.startsWith('geen')) continue;
    const eigen = repo.dossier(punt.patientId).medicatie
      .filter((m) => m.status === 'active')
      .map((m) => m.middel.text);
    for (const middel of genoemd.split(', ')) {
      assert.ok(eigen.includes(middel), `${punt.naam}: context noemt ${middel}, dossier niet`);
    }
  }
});

test('wachtkamer: een voorbereiding over een chronische aandoening landt bij wie hem heeft', () => {
  const vereist = { 'T90.02': ['T90'], K86: ['K86', 'K87'], R95: ['R95', 'R96'] };
  for (const intake of repo.intakes()) {
    const eerste = intake.codesuggesties[0]?.icpc;
    const prefixen = vereist[eerste];
    if (!prefixen) continue;
    assert.ok(heeft(actieveIcpc(intake.patientId), prefixen),
      `${intake.naam} kreeg een voorbereiding over ${eerste} zonder die episode`);
  }
});

test('dagstart: "vraagt als eerste aandacht" is niet structureel leeg', () => {
  const dag = dagstart(repo);
  assert.ok(dag.urgent.length > 0,
    'de eerste kaart van de POH hoort te tonen wie eruit springt');
  for (const regel of dag.urgent) {
    assert.ok(regel.naam && regel.titel && regel.bevinding);
  }
});

test('triage: de ochtendstroom laat alle vier de uitkomsten van de zelftriage zien', () => {
  const bestemmingen = new Set(
    repo.triage().map((t) => t.zelftriage?.bestemming).filter(Boolean),
  );
  // Zonder een POH- of huisartsroute in de lijst is er van één triagemodel voor twee
  // kanalen niets te zien, en dat is juist wat dit scherm moet tonen.
  for (const nodig of ['zelfzorg', 'assistent', 'poh-s', 'huisarts']) {
    assert.ok(bestemmingen.has(nodig), `geen enkele zorgvraag komt uit op ${nodig}`);
  }
});

test('triage: een hulpvraag over bestaande zorg hoort bij een dossier dat die zorg kent', () => {
  const eisen = {
    suikers: ['T90'],
    pufjes: ['R95', 'R96'],
    'Bloeddrukmeter thuis': ['K86', 'K87'],
    bloeddrukmedicatie: ['K86', 'K87'],
    'Wond aan de voet': ['T90'],
  };
  for (const verzoek of repo.triage()) {
    for (const [woord, prefixen] of Object.entries(eisen)) {
      if (!verzoek.hulpvraag.includes(woord)) continue;
      assert.ok(heeft(actieveIcpc(verzoek.patientId), prefixen),
        `${verzoek.naam} vraagt "${verzoek.hulpvraag}" zonder passende episode`);
    }
  }
});

test('triage: wie al een acuut signaal draagt, staat niet óók in de gewone stroom', () => {
  const acuut = new Set(repo.acuteSignalen().map((s) => s.patientId));
  for (const verzoek of repo.triage()) {
    assert.ok(!acuut.has(verzoek.patientId),
      `${verzoek.naam} komt twee keer binnen op één ochtend`);
  }
});
