import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository } from '../dist/store.js';
import { acuutVoor } from '../dist/acuut.js';

test('acuut: een signaal kan maar één keer opgepakt worden', () => {
  const repo = new InMemoryRepository();
  const open = repo.acuteSignalen().filter((s) => s.status === 'open');
  assert.ok(open.length > 0, 'er hoort bij het opstarten al iets binnen te zijn');

  const eerste = open[0];
  repo.pakAcuutOp(eerste.id, { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' });
  repo.pakAcuutOp(eerste.id, { id: 'zv-assistent-1', naam: 'Ilse Hendriks', rol: 'assistent' });

  const na = repo.acuteSignalen().find((s) => s.id === eerste.id);
  assert.equal(na.status, 'opgepakt');
  // Wie het eerst klikt, heeft hem. Anders denken twee mensen dat zij het doen.
  assert.equal(na.opgepaktDoor.naam, 'Daan Verhoeven');
});

test('acuut: elke rol ziet alleen wat hij kan oppakken, urgentste eerst', () => {
  const repo = new InMemoryRepository();
  const voorPoh = acuutVoor(repo.acuteSignalen(), 'poh-s');
  assert.ok(voorPoh.every((s) => s.voorRollen.includes('poh-s')));

  const alles = acuutVoor(repo.acuteSignalen(), 'huisarts');
  const spoed = alles.findIndex((s) => s.urgentie === 'spoed');
  const vandaag = alles.findIndex((s) => s.urgentie === 'vandaag');
  if (spoed !== -1 && vandaag !== -1) assert.ok(spoed < vandaag);
});

test('acuut: afhandelen legt de uitkomst vast', () => {
  const repo = new InMemoryRepository();
  const eerste = repo.acuteSignalen()[0];
  repo.pakAcuutOp(eerste.id, { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' });
  repo.handelAcuutAf(eerste.id, 'Ambulance gebeld, patiënt onderweg naar de SEH.');

  const na = repo.acuteSignalen().find((s) => s.id === eerste.id);
  assert.equal(na.status, 'afgehandeld');
  assert.match(na.uitkomst, /Ambulance/);
});
