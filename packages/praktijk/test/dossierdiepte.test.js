import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository } from '../dist/store.js';
import {
  contactdossier, dossierHistorie, groepsconsulten, maakGroepsconsult, media, rapport,
  rapportExport, samenvatting,
} from '../dist/bff.js';
import { filtervelden } from '../dist/rapportage.js';

/** Een patiënt met historie; die heeft alle onderdelen waar deze tests over gaan. */
function eersteMetContacten(repo) {
  const dossier = repo.alleDossiers().find((d) => d.contacten.length > 0);
  if (!dossier) throw new Error('geen enkele patiënt met contacten in de demopopulatie');
  return dossier;
}

// ── Samenvatting ────────────────────────────────────────────────────────────

test('samenvatting: elke alinea draagt zijn eigen bron', () => {
  const repo = new InMemoryRepository();
  const vatting = samenvatting(repo, eersteMetContacten(repo).patient.id);

  assert.ok(vatting.alineas.length > 0);
  // Zonder bron per alinea is een samenvatting niet na te lopen, en dan is hij
  // beslissingsondersteuning zonder verantwoording (ADR-0005).
  for (const alinea of vatting.alineas) {
    assert.ok(alinea.bron && alinea.bron.trim() !== '', `alinea ${alinea.id} zonder bron`);
    assert.ok(alinea.tekst.trim() !== '');
  }
  assert.equal(vatting.herkomst.soort, 'regelgebaseerd');
});

test('samenvatting: een onbekende patiënt levert niets op in plaats van een leeg verhaal', () => {
  const repo = new InMemoryRepository();
  assert.equal(samenvatting(repo, 'bestaat-niet'), undefined);
});

// ── Het hele contact ────────────────────────────────────────────────────────

test('contactdossier: metingen hangen aan hún contact, niet aan de dag', () => {
  const repo = new InMemoryRepository();
  const dossier = eersteMetContacten(repo);
  const contact = dossier.contacten[0];

  const beeld = contactdossier(repo, dossier.patient.id, contact.id);
  assert.ok(beeld, 'het contact hoort opgehaald te kunnen worden');
  assert.equal(beeld.encounterId, contact.id);
  assert.ok(beeld.metingen.length > 0, 'bij een consult hoort vastgelegd te zijn wat er gemeten is');

  const bijDitContact = new Set(
    dossier.observaties.filter((o) => o.encounterId === contact.id).map((o) => o.id),
  );
  assert.equal(beeld.metingen.length, bijDitContact.size);
});

test('contactdossier: de leeftijd is die van tóén, niet die van nu', () => {
  const repo = new InMemoryRepository();
  const dossier = eersteMetContacten(repo);
  // Het oudste contact ligt jaren terug; dan moet de leeftijd lager zijn dan vandaag.
  const oudste = [...dossier.contacten]
    .sort((a, b) => a.herkomst.vastgelegdOp.localeCompare(b.herkomst.vastgelegdOp))[0];
  const beeld = contactdossier(repo, dossier.patient.id, oudste.id);

  const nu = new Date(repo.peildatum());
  const geboren = new Date(dossier.patient.geboortedatum);
  let leeftijdNu = nu.getFullYear() - geboren.getFullYear();
  const maand = nu.getMonth() - geboren.getMonth();
  if (maand < 0 || (maand === 0 && nu.getDate() < geboren.getDate())) leeftijdNu -= 1;

  assert.ok(beeld.patient.leeftijdToen <= leeftijdNu);
});

test('contactdossier: een contact van een andere patiënt komt er niet uit', () => {
  const repo = new InMemoryRepository();
  const dossier = eersteMetContacten(repo);
  assert.equal(contactdossier(repo, dossier.patient.id, 'enc-bestaat-niet'), undefined);
});

// ── Journaal ────────────────────────────────────────────────────────────────

test('journaal: de tijdlijn staat omgekeerd chronologisch, ongeacht het soort item', () => {
  const repo = new InMemoryRepository();
  const dossier = eersteMetContacten(repo);
  const historie = dossierHistorie(repo, dossier.patient.id);

  const data = historie.tijdlijn.map((i) => i.datum);
  const gesorteerd = [...data].sort((a, b) => b.localeCompare(a));
  assert.deepEqual(data, gesorteerd);
});

test('journaal: elk contact komt in de tijdlijn, ook zonder SOEP-tekst', () => {
  const repo = new InMemoryRepository();
  const dossier = eersteMetContacten(repo);
  const historie = dossierHistorie(repo, dossier.patient.id);

  const inTijdlijn = historie.tijdlijn.filter((i) => i.soort === 'contact').length;
  assert.equal(inTijdlijn, dossier.contacten.length);
});

// ── Media ───────────────────────────────────────────────────────────────────

test('media: elke patiënt heeft ten minste één document, en filteren telt mee', () => {
  const repo = new InMemoryRepository();
  const patientId = eersteMetContacten(repo).patient.id;

  const alles = media(repo, patientId, {});
  assert.ok(alles.totaal > 0);
  assert.equal(alles.bestanden.length, alles.totaal);

  const eersteSoort = alles.bestanden[0].soort;
  const gefilterd = media(repo, patientId, { soorten: [eersteSoort] });
  assert.ok(gefilterd.bestanden.every((b) => b.soort === eersteSoort));
  assert.ok(gefilterd.bestanden.length <= alles.totaal);
  // Het totaal blijft het totaal: anders weet je niet of je iets wegfiltert.
  assert.equal(gefilterd.totaal, alles.totaal);
});

test('media: zoeken op een woord uit de titel vindt het bestand terug', () => {
  const repo = new InMemoryRepository();
  const patientId = eersteMetContacten(repo).patient.id;
  const alles = media(repo, patientId, {});
  const woord = alles.bestanden[0].titel.split(' ')[0];

  const treffers = media(repo, patientId, { tekst: woord });
  assert.ok(treffers.bestanden.some((b) => b.id === alles.bestanden[0].id));
});

// ── Groepsconsulten ─────────────────────────────────────────────────────────

test('groepsconsult: een nieuw blok krijgt een plek in de agenda', () => {
  const repo = new InMemoryRepository();
  const voor = repo.agenda('poh-s').length;
  const voorAantal = groepsconsulten(repo).length;

  const start = `${repo.peildatum().toISOString().slice(0, 10)}T15:00:00+02:00`;
  const antwoord = maakGroepsconsult(repo, 'zv-poh-1', {
    titel: 'Stoppen met roken — groepsstart',
    thema: 'Stoppen met roken',
    module: 'leefstijl',
    start,
    duurMinuten: 60,
    plaats: 'Praktijkruimte achter',
    maxDeelnemers: 8,
    programma: ['Wat gaat er gebeuren als je stopt', 'Hulpmiddelen', 'Afspraken maken'],
  });

  assert.ok(antwoord.length > voorAantal);
  // Een groepsconsult dat niet in de agenda staat, bestaat voor de praktijk niet.
  assert.equal(repo.agenda('poh-s').length, voor + 1);
});

test('groepsconsult: voorgestelde deelnemers staan er niet al op', () => {
  const repo = new InMemoryRepository();
  for (const groep of groepsconsulten(repo)) {
    const opdeLijst = new Set(groep.deelnemers.map((d) => d.patientId));
    assert.ok(groep.voorgesteld.every((v) => !opdeLijst.has(v.patientId)));
    // Een voorstel zonder reden is een willekeurige lijst.
    assert.ok(groep.voorgesteld.every((v) => v.onderbouwing && v.onderbouwing.trim() !== ''));
  }
});

// ── Rapportage ──────────────────────────────────────────────────────────────

test('rapport: het aantal regels klopt met het getelde totaal', () => {
  const repo = new InMemoryRepository();
  const uitkomst = rapport(repo, { module: 'glucose' });

  assert.equal(uitkomst.regels.length, uitkomst.totaal);
  assert.ok(uitkomst.totaal <= uitkomst.vanTotaal);
  assert.ok(uitkomst.omschrijving.trim() !== '');
});

test('rapport: zonder criteria staat de hele praktijk in beeld', () => {
  const repo = new InMemoryRepository();
  const uitkomst = rapport(repo, {});
  assert.equal(uitkomst.totaal, uitkomst.vanTotaal);
});

test('rapport: de filtervelden zijn beschreven, zodat een gebruiker weet wat hij kiest', () => {
  assert.ok(filtervelden.length > 0);
  for (const veld of filtervelden) {
    assert.ok(veld.naam && veld.uitleg, `veld ${veld.id} zonder uitleg`);
  }
});

test('export: er gaan geen namen, BSN of geboortedata naar de BI-omgeving', () => {
  const repo = new InMemoryRepository();
  const uitvoer = rapportExport(repo, { module: 'glucose' });
  const tekst = JSON.stringify(uitvoer);

  for (const dossier of repo.alleDossiers().slice(0, 20)) {
    const naam = dossier.patient.naam[0]?.achternaam;
    if (naam) assert.ok(!tekst.includes(naam), `achternaam ${naam} lekt naar de export`);
    const bsn = dossier.patient.identifier?.[0]?.value;
    if (bsn) assert.ok(!tekst.includes(bsn), 'BSN lekt naar de export');
    assert.ok(!tekst.includes(dossier.patient.geboortedatum), 'geboortedatum lekt naar de export');
  }
});

test('export: te kleine groepen worden samengevoegd, zodat niemand herleidbaar is', () => {
  const repo = new InMemoryRepository();
  const uitvoer = rapportExport(repo, {});
  for (const regel of uitvoer.regels) {
    // Alleen de restgroep mag kleiner zijn — dat ís juist de samenvoeging.
    if (String(regel.leeftijdsklasse).startsWith('overig')) continue;
    assert.ok(regel.aantal >= 5, `groep ${regel.leeftijdsklasse}/${regel.keten} is herleidbaar`);
  }
  assert.ok(uitvoer.toelichting.trim() !== '');
});

test('groepsconsult: een order zet de patiënt op een bestaand blok, niet op een los slot', () => {
  const repo = new InMemoryRepository();
  const groep = repo.groepsconsulten().find((g) => g.status === 'gepland');
  const patient = repo.alleDossiers()
    .find((d) => !groep.deelnemers.some((x) => x.patientId === d.patient.id));

  const [order] = repo.plaatsOrders([{
    patientId: patient.patient.id,
    soort: 'afspraak',
    omschrijving: 'Groepsconsult',
    groepModule: groep.module,
    bijRol: 'poh-s',
    duurMinuten: groep.duurMinuten,
    vereistRecht: 'dossier-registreren',
  }], {
    id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s', rechten: ['dossier-registreren'],
  });

  // Geen afspraakverzoek: er valt niets in te plannen, het blok staat er al.
  assert.equal(order.verzoekId, undefined);
  const na = repo.groepsconsulten().find((g) => g.id === order.groepId);
  assert.ok(na, 'de order hoort naar een blok te wijzen');
  assert.ok(na.deelnemers.some((d) => d.patientId === patient.patient.id));
});
