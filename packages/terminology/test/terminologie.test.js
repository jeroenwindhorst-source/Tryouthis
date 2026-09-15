import test from 'node:test';
import assert from 'node:assert/strict';
import { maakDemoTerminologie, SYSTEEM, importeerMapping, leesCsv } from '../dist/index.js';

const t = maakDemoTerminologie();

test('zoeken geeft standaard alleen registreerbare concepten', () => {
  const treffers = t.zoek('diabetes');
  assert.ok(treffers.length > 0);
  for (const treffer of treffers) {
    assert.notEqual(treffer.concept.niveau, 'extern',
      `'${treffer.concept.display}' is extern en mag niet in een registratiescherm verschijnen`);
  }
});

test('breder zoeken is een bewuste actie en levert wél externe concepten', () => {
  const smal = t.zoek('diabetes mellitus');
  const breed = t.zoek('diabetes mellitus', { niveaus: ['registratieset', 'uitbreidingsset', 'extern'] });
  assert.ok(breed.length > smal.length, 'breder zoeken moet meer opleveren');
  assert.ok(breed.some((x) => x.concept.niveau === 'extern'));
});

test('zoeken op ICPC-code en op synoniem vindt hetzelfde concept', () => {
  const viaCode = t.zoek('T90.02')[0];
  const viaSynoniem = t.zoek('suikerziekte type 2')[0];
  assert.equal(viaCode.concept.snomed, '44054006');
  assert.equal(viaSynoniem.concept.snomed, '44054006');
});

test('registreren levert altijd dual coding op: ICPC én SNOMED', () => {
  const concept = t.lookupSnomed('13645005');
  const gecodeerd = t.codeer(concept);
  assert.equal(gecodeerd.icpc1.system, SYSTEEM.icpc1nl);
  assert.equal(gecodeerd.icpc1.code, 'R95');
  assert.equal(gecodeerd.snomed.system, SYSTEEM.snomed);
  assert.equal(gecodeerd.snomed.code, '13645005');
  assert.ok(gecodeerd.snomed.version, 'de SNOMED-release moet worden vastgelegd');
});

test('externe concepten zijn niet registreerbaar', () => {
  assert.equal(t.isRegistreerbaar('44054006'), true);   // registratieset
  assert.equal(t.isRegistreerbaar('127013003'), true);  // uitbreidingsset
  assert.equal(t.isRegistreerbaar('254837009'), false); // extern
  assert.equal(t.isRegistreerbaar('onbekend'), false);
});

test('ontvangst: code uit de eigen set mag worden overgenomen', () => {
  const uitkomst = t.ontvang([{ system: SYSTEEM.snomed, code: '44054006', display: 'Type 2 diabetes mellitus' }], 'Ziekenhuis X');
  assert.equal(uitkomst.advies, 'overnemen');
  assert.equal(uitkomst.gecodeerd.icpc1.code, 'T90.02');
});

test('ontvangst: specifiekere code komt binnen onder de ICPC-paraplu', () => {
  const uitkomst = t.ontvang([{ system: SYSTEEM.snomed, code: '127013003', display: 'Diabetic nephropathy' }]);
  assert.equal(uitkomst.advies, 'overnemen-met-paraplu');
  assert.equal(uitkomst.gecodeerd.icpc1.code, 'T90.02');
  assert.match(uitkomst.toelichting, /paraplu/);
});

test('ontvangst: onbekende code krijgt context via subsumptie en blijft extern', () => {
  const uitkomst = t.ontvang([{ system: SYSTEEM.snomed, code: '371087003', display: 'Diabetic foot ulcer' }]);
  assert.equal(uitkomst.advies, 'tonen-als-extern-met-context');
  assert.equal(uitkomst.context.snomed, '44054006');
  assert.equal(uitkomst.gecodeerd.niveau, 'extern');
});

test('ontvangst: het origineel wordt nooit weggegooid', () => {
  const origineel = [{ system: SYSTEEM.snomed, code: '254837009', display: 'Malignant neoplasm of breast' }];
  const uitkomst = t.ontvang(origineel);
  assert.equal(uitkomst.advies, 'tonen-als-extern');
  assert.deepEqual(uitkomst.gecodeerd.origineel, origineel);
});

test('ontvangst zonder SNOMED-codering faalt niet maar bewaart de inhoud', () => {
  const uitkomst = t.ontvang([{ system: 'http://example.org/lokaal', code: 'X1', display: 'Iets lokaals' }], 'Thuiszorg Y');
  assert.equal(uitkomst.advies, 'tonen-als-extern');
  assert.equal(uitkomst.gecodeerd.tekst, 'Iets lokaals');
  assert.match(uitkomst.toelichting, /Thuiszorg Y/);
});

test('mapping-import: tolerante kolomnamen, strikte uitkomst', () => {
  const csv = [
    'ICPC;ICPC omschrijving;ConceptId;Voorkeursterm;Relatie;Synoniemen',
    'T90.02;Diabetes mellitus type 2;44054006;Diabetes mellitus type 2;exact;DM2|suikerziekte',
    'R95;Chronische bronchitis/COPD;13645005;COPD;exact;',
    'T90.02;Diabetes mellitus type 2;127013003;Diabetische nefropathie;nauwer;',
    ';Zonder ICPC;12345;Iets;exact;',
  ].join('\n');

  const rapport = importeerMapping(leesCsv(csv));
  assert.equal(rapport.concepten.length, 3);
  assert.equal(rapport.overgeslagen.length, 1);
  assert.match(rapport.overgeslagen[0].reden, /icpc1Code ontbreekt/);

  const nefropathie = rapport.concepten.find((c) => c.snomed === '127013003');
  assert.equal(nefropathie.niveau, 'uitbreidingsset',
    'een nauwere mapping hoort in de uitbreidingsset, niet in de registratieset');

  const dm2 = rapport.concepten.find((c) => c.snomed === '44054006');
  assert.deepEqual(dm2.synoniemen, ['DM2', 'suikerziekte']);

  assert.equal(rapport.conflicten.length, 1,
    'één ICPC-code met twee SNOMED-codes moet als te reviewen conflict worden gemeld');
});
