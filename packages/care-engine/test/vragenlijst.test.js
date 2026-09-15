import test from 'node:test';
import assert from 'node:assert/strict';
import { verwerk, zichtbareVragen, volgendeVraag, vindVragenlijst } from '../dist/index.js';

const ccq = vindVragenlijst('vl-ccq');
const mpg = vindVragenlijst('vl-mpg');

const stabiel = { 'ccq-1': 1, 'ccq-2': 2, 'ccq-3': 1, 'ccq-4': 1, 'ccq-5': 2, 'ccq-6': 1 };

test('conditionele vragen verschijnen pas als ze relevant zijn', () => {
  const zonder = zichtbareVragen(ccq, stabiel).map((v) => v.id);
  assert.ok(!zonder.includes('ccq-koorts'), 'koortsvraag hoort verborgen bij lage score');

  const benauwd = { ...stabiel, 'ccq-1': 5 };
  const met = zichtbareVragen(ccq, benauwd).map((v) => v.id);
  assert.ok(met.includes('ccq-koorts'), 'koortsvraag hoort te verschijnen bij kortademigheid in rust');
});

test('de patiëntkant krijgt één vraag per keer, in volgorde', () => {
  assert.equal(volgendeVraag(ccq, {}).id, 'ccq-1');
  assert.equal(volgendeVraag(ccq, { 'ccq-1': 0 }).id, 'ccq-2');
});

test('antwoorden landen gestructureerd, niet als tekst in het journaal', () => {
  const uitkomst = verwerk(ccq, stabiel);
  const codes = uitkomst.observaties.map((o) => o.code);
  assert.ok(codes.includes('ccq-1'), 'elk antwoord krijgt een eigen observatiecode');
  assert.ok(codes.includes('ccq-totaal'), 'de berekende score landt ook als observatie');
  const totaal = uitkomst.observaties.find((o) => o.code === 'ccq-totaal');
  assert.equal(totaal.waarde, 1.33);
});

test('verslechtering ten opzichte van de vorige meting vuurt de juiste acties af', () => {
  const nu = { 'ccq-1': 3, 'ccq-2': 4, 'ccq-3': 3, 'ccq-4': 2, 'ccq-5': 3, 'ccq-6': 2 };
  const historie = [{ datum: '2026-06-15', scores: { 'ccq-totaal': 1.8 } }];
  const uitkomst = verwerk(ccq, nu, historie);

  const ids = uitkomst.gevuurd.map((g) => g.trigger.id);
  assert.ok(ids.includes('ccq-verslechtering'), `verwacht ccq-verslechtering, kreeg ${ids.join(', ')}`);

  const soorten = uitkomst.acties.map((a) => a.type);
  assert.ok(soorten.includes('taak'));
  assert.ok(soorten.includes('plan-afspraak'));
  assert.ok(soorten.includes('zelfzorgadvies'));

  const score = uitkomst.scores.find((s) => s.id === 'ccq-totaal');
  assert.ok(score.delta > 0.4);
  assert.equal(score.relevant, true, 'de verandering moet als klinisch relevant worden gemarkeerd');

  for (const gevuurd of uitkomst.gevuurd) {
    assert.ok(gevuurd.onderbouwing.length > 0, 'elke regel moet uitleggen waarom hij vuurt (MDR)');
  }
});

test('koorts plus sputumverandering escaleert naar de huisarts', () => {
  const antwoorden = {
    'ccq-1': 5, 'ccq-2': 5, 'ccq-3': 4, 'ccq-4': 4, 'ccq-5': 4, 'ccq-6': 3,
    'ccq-koorts': 'ja', 'ccq-sputum-kleur': 'ja',
  };
  const uitkomst = verwerk(ccq, antwoorden);
  const escalatie = uitkomst.gevuurd.find((g) => g.trigger.id === 'ccq-mogelijke-exacerbatie');
  assert.ok(escalatie, 'exacerbatietrigger moet vuren');
  assert.equal(escalatie.trigger.ernst, 'urgent');
  assert.ok(uitkomst.acties.some((a) => a.type === 'notificeer' && a.rol === 'huisarts'));
});

test('het systeem stelt óók voor om minder te doen', () => {
  const historie = [
    { datum: '2025-09-01', scores: { 'ccq-totaal': 0.6 } },
    { datum: '2026-03-01', scores: { 'ccq-totaal': 0.7 } },
  ];
  const uitkomst = verwerk(ccq, { 'ccq-1': 0, 'ccq-2': 1, 'ccq-3': 1, 'ccq-4': 0, 'ccq-5': 1, 'ccq-6': 1 }, historie);
  const afschalen = uitkomst.acties.find((a) => a.type === 'wijzig-intensiteit');
  assert.ok(afschalen, 'bij drie stabiele metingen moet afschalen worden voorgesteld');
  assert.equal(afschalen.naar, 'extensief');
  assert.equal(afschalen.terBevestiging, true, 'afschalen gebeurt nooit automatisch');
});

test('ontbrekende verplichte antwoorden worden gemeld, niet stilzwijgend genegeerd', () => {
  const uitkomst = verwerk(ccq, { 'ccq-1': 1 });
  assert.ok(uitkomst.onbeantwoordVerplicht.includes('ccq-2'));
});

test('MPG signaleert laag mentaal welbevinden tijdens een somatische controle', () => {
  const uitkomst = verwerk(mpg, {
    'mpg-lich': 7, 'mpg-ment': 3, 'mpg-zing': 6, 'mpg-kwal': 6, 'mpg-mee': 6, 'mpg-dag': 7,
  });
  assert.ok(uitkomst.gevuurd.some((g) => g.trigger.id === 'mpg-laag-mentaal'));
  assert.equal(uitkomst.scores.find((s) => s.id === 'mpg-totaal').waarde, 5.83);
});
