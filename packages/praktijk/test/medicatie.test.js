import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository } from '../dist/store.js';
import { medicatieoverzicht, medicatievoorbeeld, wijzigMedicatie } from '../dist/bff.js';
import { APOTHEKEN, beschrijfWijziging, voorkeursapotheek } from '../dist/medicatie.js';

const HUISARTS = 'zv-huisarts-1';
const POH = 'zv-poh-1';

function metMedicatie(repo) {
  const dossier = repo.alleDossiers().find((d) =>
    d.medicatie.filter((m) => m.status === 'active').length > 0);
  if (!dossier) throw new Error('geen patiënt met medicatie in de demopopulatie');
  return dossier;
}

const digitaal = (repo, dossier) => ({
  route: 'digitaal', apotheekId: voorkeursapotheek(dossier).id,
});

test('medicatie: een dosering aanpassen stopt het oude en start het nieuwe op één dag', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const voor = medicatieoverzicht(repo, dossier.patient.id);
  const middel = voor.lopend[0];

  const uit = wijzigMedicatie(repo, HUISARTS, {
    patientId: dossier.patient.id,
    soort: 'dosering',
    statementId: middel.id,
    nieuw: { atc: middel.atc, naam: middel.naam, dosering: '2dd 2 tabletten' },
    reden: 'Streefwaarde niet gehaald bij de huidige dosering',
    aflevering: digitaal(repo, dossier),
  });

  assert.ok(uit, 'de wijziging hoort te lukken');
  const na = uit.overzicht;
  assert.ok(!na.lopend.some((m) => m.id === middel.id), 'het oude middel loopt niet meer');
  assert.ok(na.gestopt.some((m) => m.id === middel.id), 'het oude middel staat bij gestopt');

  const nieuw = na.lopend.find((m) => m.atc === middel.atc);
  assert.ok(nieuw, 'het nieuwe middel loopt');
  assert.equal(nieuw.dosering, '2dd 2 tabletten');
  // Beide op dezelfde dag: er zit geen gat waarin de patiënt niets gebruikt.
  const vandaag = repo.peildatum().toISOString().slice(0, 10);
  assert.equal(nieuw.begin, vandaag);
  assert.equal(na.gestopt.find((m) => m.id === middel.id).einde, vandaag);
});

test('medicatie: de lopende order voor het oude middel wordt ingetrokken, met reden', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const middel = medicatieoverzicht(repo, dossier.patient.id).lopend[0];

  // Zorg dat er iets openstaat, zodat er ook werkelijk iets in te trekken valt.
  repo.plaatsOrders([{
    patientId: dossier.patient.id, soort: 'medicatie', omschrijving: middel.naam,
    detail: middel.dosering, atc: middel.atc, vereistRecht: 'medicatie-voorschrijven',
  }], { id: HUISARTS, naam: 'Daan Verhoeven', rol: 'huisarts', rechten: ['medicatie-voorschrijven'] });

  wijzigMedicatie(repo, HUISARTS, {
    patientId: dossier.patient.id,
    soort: 'dosering',
    statementId: middel.id,
    nieuw: { atc: middel.atc, naam: middel.naam, dosering: '1dd 1 tablet' },
    reden: 'Nierfunctie gedaald — dosering aangepast',
    aflevering: digitaal(repo, dossier),
  });

  const orders = repo.orders(dossier.patient.id).filter((o) => o.atc === middel.atc);
  const oud = orders.filter((o) => o.detail === middel.dosering);
  assert.ok(oud.every((o) => o.status !== 'geplaatst' && o.status !== 'ter-autorisatie'),
    'geen enkele order voor de oude dosering loopt nog');
  assert.ok(oud.some((o) => o.status === 'ingetrokken' && o.reden),
    'een ingetrokken order draagt de reden waarom');
});

test('medicatie: het recept gaat naar de gekozen apotheek, niet naar de vaste', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const middel = medicatieoverzicht(repo, dossier.patient.id).lopend[0];
  const vaste = voorkeursapotheek(dossier);
  const andere = APOTHEKEN.find((a) => a.digitaal && a.id !== vaste.id);

  const uit = wijzigMedicatie(repo, HUISARTS, {
    patientId: dossier.patient.id,
    soort: 'dosering',
    statementId: middel.id,
    nieuw: { atc: middel.atc, naam: middel.naam, dosering: '1dd 1 tablet' },
    reden: 'Afbouwen volgens afspraak',
    aflevering: { route: 'digitaal', apotheekId: andere.id },
  });

  assert.equal(uit.order.bestemming, andere.naam);
  assert.match(uit.order.route, new RegExp(andere.naam));
});

test('medicatie: een apotheek zonder elektronische ontvangst krijgt geen digitaal recept', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const middel = medicatieoverzicht(repo, dossier.patient.id).lopend[0];
  const papieren = APOTHEKEN.find((a) => !a.digitaal);

  const uit = wijzigMedicatie(repo, HUISARTS, {
    patientId: dossier.patient.id,
    soort: 'dosering',
    statementId: middel.id,
    nieuw: { atc: middel.atc, naam: middel.naam, dosering: '1dd 1 tablet' },
    reden: 'Bijwerkingen bij de huidige dosering',
    aflevering: { route: 'digitaal', apotheekId: papieren.id },
  });

  // Stilletjes omzetten naar printen zou betekenen dat de zorgverlener denkt dat het
  // verstuurd is terwijl er een vel papier in een la ligt.
  assert.equal(uit, undefined);
  const nog = medicatieoverzicht(repo, dossier.patient.id);
  assert.ok(nog.lopend.some((m) => m.id === middel.id), 'er is niets gewijzigd');
});

test('medicatie: stoppen levert geen recept op', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const middel = medicatieoverzicht(repo, dossier.patient.id).lopend[0];
  const voorAantal = repo.orders(dossier.patient.id).length;

  const uit = wijzigMedicatie(repo, HUISARTS, {
    patientId: dossier.patient.id,
    soort: 'stoppen',
    statementId: middel.id,
    reden: 'Niet langer geïndiceerd',
    aflevering: { route: 'meegeven' },
  });

  assert.equal(uit.order, undefined);
  assert.equal(repo.orders(dossier.patient.id).length, voorAantal);
  assert.ok(!uit.overzicht.lopend.some((m) => m.id === middel.id));
});

test('medicatie: zonder reden gebeurt er niets', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const middel = medicatieoverzicht(repo, dossier.patient.id).lopend[0];

  const uit = wijzigMedicatie(repo, HUISARTS, {
    patientId: dossier.patient.id,
    soort: 'stoppen',
    statementId: middel.id,
    reden: '   ',
    aflevering: { route: 'meegeven' },
  });
  assert.equal(uit, undefined);
  assert.ok(medicatieoverzicht(repo, dossier.patient.id).lopend.some((m) => m.id === middel.id));
});

test('medicatie: de POH wijzigt het dossier, het recept wacht op de huisarts', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const middel = medicatieoverzicht(repo, dossier.patient.id).lopend[0];

  const uit = wijzigMedicatie(repo, POH, {
    patientId: dossier.patient.id,
    soort: 'dosering',
    statementId: middel.id,
    nieuw: { atc: middel.atc, naam: middel.naam, dosering: '1dd 1 tablet' },
    reden: 'Bijwerkingen bij de huidige dosering',
    aflevering: digitaal(repo, dossier),
  });

  assert.equal(uit.naarAutorisatie, true);
  assert.equal(uit.order.status, 'ter-autorisatie');
  // Het verzoek komt met onderbouwing bij de huisarts terecht en niet in een la.
  assert.ok(repo.autorisaties().some((a) => a.omschrijving.includes(middel.naam)));
});

test('medicatie: het voorbeeld zegt vooraf precies wat er gaat gebeuren', () => {
  const repo = new InMemoryRepository();
  const dossier = metMedicatie(repo);
  const middel = medicatieoverzicht(repo, dossier.patient.id).lopend[0];

  const beeld = medicatievoorbeeld(repo, {
    patientId: dossier.patient.id,
    soort: 'dosering',
    statementId: middel.id,
    nieuw: { atc: middel.atc, naam: middel.naam, dosering: '2dd 2 tabletten' },
    reden: 'test',
    aflevering: digitaal(repo, dossier),
  });

  assert.ok(beeld.regels.some((r) => r.includes('stopt vandaag')));
  assert.ok(beeld.regels.some((r) => r.includes('start vandaag')));
  assert.ok(beeld.regels.some((r) => r.includes('ingetrokken')));
  assert.ok(beeld.regels.some((r) => r.includes('elektronisch')));
  // Een dosering aanpassen is precies wat de dubbelmedicatiemelding adviseert; die
  // melding hier tonen zou betekenen dat je wordt gewaarschuwd voor je eigen oplossing.
  assert.ok(!beeld.waarschuwingen.some((w) => w.bron?.includes('dubbelmedicatie')));
});

test('medicatie: een papieren apotheek wordt vóór het versturen benoemd', () => {
  const papieren = APOTHEKEN.find((a) => !a.digitaal);
  const { waarschuwing } = beschrijfWijziging({
    patientId: 'x', soort: 'starten', reden: 'test',
    nieuw: { atc: 'N02BE01', naam: 'Paracetamol 500 mg', dosering: '3dd 2' },
    aflevering: { route: 'digitaal', apotheekId: papieren.id },
  });
  assert.ok(waarschuwing && waarschuwing.includes(papieren.naam));
});
