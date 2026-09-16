import test from 'node:test';
import assert from 'node:assert/strict';
import { beoordeelDeclaratie, vindContactvorm } from '../dist/contactsoorten.js';
import { buitenBandbreedte, vindVerrichting } from '../dist/verrichtingen.js';

test('contactvorm: de duurstaffel bepaalt de prestatie, niet de keuze van de gebruiker', () => {
  const kort = beoordeelDeclaratie({
    vorm: 'consult', duurMinuten: 10, heeftSoep: true, heeftEpisode: true,
  });
  const lang = beoordeelDeclaratie({
    vorm: 'consult', duurMinuten: 25, heeftSoep: true, heeftEpisode: true,
  });
  assert.equal(kort.vorm, 'consult');
  assert.equal(lang.vorm, 'consult-lang');
  assert.ok(kort.declarabel && lang.declarabel);
});

test('contactvorm: zonder SOEP of episode is niets declarabel, met de reden erbij', () => {
  const beeld = beoordeelDeclaratie({ vorm: 'e-consult', heeftSoep: false, heeftEpisode: false });
  assert.equal(beeld.declarabel, false);
  assert.deepEqual(beeld.ontbreekt, ['geen SOEP-registratie', 'niet aan een episode gekoppeld']);
});

test('contactvorm: een herhaalrecept is geen prestatie en zegt waarom niet', () => {
  const beeld = beoordeelDeclaratie({ vorm: 'herhaalrecept', heeftSoep: true, heeftEpisode: true });
  assert.equal(beeld.declarabel, false);
  assert.match(beeld.toelichting, /inschrijftarief/);
  // Geen ontbrekende velden: het is niet onvolledig, het is gewoon geen consult.
  assert.deepEqual(beeld.ontbreekt, []);
});

test('contactvorm: intern overleg levert niets op, want de patiënt was er niet bij', () => {
  assert.equal(vindContactvorm('intern-overleg')?.declarabel, false);
});

test('verrichting: een afwijkende uitkomst wordt herkend, met reden', () => {
  const ecg = vindVerrichting('ecg');
  const afwijkingen = buitenBandbreedte(ecg, {
    'ecg-ritme': 'af', 'ecg-frequentie': '112', 'ecg-afwijking': 'geen',
  });
  assert.equal(afwijkingen.length, 2);
  assert.ok(afwijkingen.every((a) => a.reden.length > 0));
});

test('verrichting: normale waarden geven geen signaal', () => {
  const ecg = vindVerrichting('ecg');
  assert.deepEqual(buitenBandbreedte(ecg, {
    'ecg-ritme': 'sinus', 'ecg-frequentie': '72', 'ecg-afwijking': 'geen',
  }), []);
});
