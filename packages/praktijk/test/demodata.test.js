import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository } from '../dist/store.js';
import {
  aanloop, consultvoorbereiding, dagstart, dossierHistorie, herstelProtocol, opvolgen, overleg,
  patientOverzicht, protocoloverzicht, wijzigProtocol, PATIENTBRON, PATIENTSOORTEN,
} from '../dist/bff.js';

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

// ── Vragenlijsten, lab en de tijdshorizon ───────────────────────────────────

test('vragenlijsten: niets is ingevuld voordat het is uitgezet, en niets in de toekomst', () => {
  const vandaag = repo.peildatum().toISOString().slice(0, 10);
  const afnames = repo.afnames();
  assert.ok(afnames.length > 10, 'te weinig afnames om iets te bewaken');
  for (const afname of afnames) {
    assert.ok(afname.uitgezetOp.slice(0, 10) <= vandaag,
      `${afname.id} is uitgezet in de toekomst`);
    if (!afname.ingevuldOp) continue;
    assert.ok(afname.ingevuldOp.slice(0, 10) <= vandaag,
      `${afname.id} is ingevuld in de toekomst`);
    assert.ok(afname.ingevuldOp >= afname.uitgezetOp,
      `${afname.id} is ingevuld vóór hij werd uitgezet`);
  }
});

test('vragenlijsten: een ingevulde lijst levert antwoorden op, een openstaande niet', () => {
  for (const afname of repo.afnames()) {
    const aantal = Object.keys(afname.antwoorden).length;
    if (afname.ingevuldOp) assert.ok(aantal > 0, `${afname.id} is ingevuld maar leeg`);
    else assert.equal(aantal, 0, `${afname.id} staat open maar heeft antwoorden`);
  }
});

test('spreekuur: bij wie vandaag komt, is het bloedonderzoek al binnen', () => {
  /*
   * De kern van de aanloop: prikken hoort weken vóór het consult te gebeuren. Staat er
   * bij een patiënt van vandaag toch nog een labbepaling open, dan klopt de volgorde van
   * het proces niet — en dat is precies wat er in bestaande systemen misgaat.
   */
  for (const v of consultvoorbereiding(repo)) {
    const labOpen = v.ontbreekt.filter((o) => !o.includes('vragenlijst'));
    assert.deepEqual(labOpen, [],
      `${v.naam} komt vandaag maar mist nog ${labOpen.join(', ')}`);
  }
});

test('spreekuur: wat in de spreekkamer gemeten wordt, telt niet als achterstand', () => {
  const tijdens = consultvoorbereiding(repo).flatMap((v) => v.tijdensConsult);
  assert.ok(tijdens.length > 0, 'geen enkele meting wordt tijdens het consult gedaan');
  for (const v of consultvoorbereiding(repo)) {
    for (const naam of v.tijdensConsult) {
      assert.ok(!v.ontbreekt.includes(naam), `${naam} staat twee keer bij ${v.naam}`);
    }
  }
});

test('aanloop: het advies past bij het aantal dagen dat er nog over is', () => {
  for (const regel of aanloop(repo)) {
    const ietsOpen = regel.vooraf.some((v) => !v.binnen)
      || regel.vragenlijst?.status === 'open';
    if (!ietsOpen) {
      assert.equal(regel.status, 'op-schema', `${regel.naam} is rond maar heet ${regel.status}`);
      continue;
    }
    const verwacht = regel.dagenTot <= 5 ? 'verzetten'
      : regel.dagenTot <= 10 ? 'bellen'
      : 'herinnering-loopt';
    assert.equal(regel.status, verwacht,
      `${regel.naam} over ${regel.dagenTot} dagen heet ${regel.status}`);
  }
});

test('aanloop: niemand staat zowel in de aanloop als op het spreekuur van vandaag', () => {
  const vandaag = new Set(
    repo.spreekuur(repo.peildatum().toISOString().slice(0, 10)).map((a) => a.patientId),
  );
  for (const regel of aanloop(repo)) {
    assert.ok(!vandaag.has(regel.patientId),
      `${regel.naam} komt vandaag én staat in de aanloop`);
  }
});

test('opvolgen: alleen mensen zonder afspraak vandaag, met een echte datum', () => {
  const vandaag = repo.peildatum().toISOString().slice(0, 10);
  const opSpreekuur = new Set(repo.spreekuur(vandaag).map((a) => a.patientId));
  const regels = opvolgen(repo);
  assert.ok(regels.length > 0, 'opvolgen is leeg');
  for (const regel of regels) {
    assert.ok(!opSpreekuur.has(regel.patientId),
      `${regel.naam} staat in opvolgen maar komt vandaag op het spreekuur`);
    assert.ok(regel.binnenOp <= vandaag, `${regel.naam}: binnengekomen in de toekomst`);
    assert.ok(regel.titel.trim().length > 0, `${regel.naam}: lege titel`);
    assert.ok(regel.voorstel.trim().length > 0, `${regel.naam}: geen voorstel`);
  }
});

test('patiëntgegevens: de wachtkamerintake en de vragenlijst spreken elkaar niet tegen', () => {
  /*
   * Twee bronnen die allebei van de patiënt komen en tegengestelde dingen zeggen, maken
   * het dossier ongeloofwaardig — en dat viel in een eerdere ronde meteen op tijdens het
   * doorklikken. Wie in de wachtkamer een verhaal vertelt, geeft zijn leven geen 9.
   */
  for (const v of consultvoorbereiding(repo)) {
    if (!v.intake || !v.vragenlijst) continue;
    const cijfer = v.vragenlijst.scores.find((s) => s.naam.includes('cijfer'))?.waarde;
    if (cijfer === undefined) continue;
    assert.ok(cijfer <= 6,
      `${v.naam} vertelt in de wachtkamer een verhaal maar geeft zichzelf een ${cijfer}`);
  }
});

test('dagstart: de vier blokken staan op volgorde van tijdshorizon en zijn geen van alle leeg', () => {
  const stappen = dagstart(repo).stappen;
  assert.deepEqual(stappen.map((s) => s.id), ['aanloop', 'spreekuur', 'opvolgen', 'afronden']);
  for (const stap of stappen) {
    assert.ok(stap.aantal > 0, `tegel ${stap.id} is leeg`);
    assert.ok(stap.watZieIk.length > 30, `tegel ${stap.id} legt niet uit wat je er ziet`);
  }
});

test('opvolgen: nooit twee regels over dezelfde patiënt uit het beloop én uit een aanlevering', () => {
  /*
   * De reden dat 'monitoren' en 'opvolgen' zijn samengevoegd: ze gingen over dezelfde
   * mensen. Deze test bewaakt dat het samenvoegen ook echt de dubbeling opheft — een
   * signaal verschijnt alleen bij wie verder niets heeft aangeleverd.
   */
  const regels = opvolgen(repo);
  const metAanlevering = new Set(regels.filter((r) => r.bron !== 'signaal').map((r) => r.patientId));
  for (const regel of regels.filter((r) => r.bron === 'signaal')) {
    assert.ok(!metAanlevering.has(regel.patientId),
      `${regel.naam} staat zowel als signaal als met een concrete aanleiding in opvolgen`);
  }
});

test('journaal: een ingevulde vragenlijst staat in de tijdlijn, op de dag dat hij is ingevuld', () => {
  const metLijst = repo.afnames().filter((a) => a.ingevuldOp);
  assert.ok(metLijst.length > 5, 'te weinig ingevulde vragenlijsten om iets te bewaken');
  for (const afname of metLijst.slice(0, 6)) {
    const historie = dossierHistorie(repo, afname.patientId);
    const item = historie.tijdlijn.find(
      (i) => i.soort === 'vragenlijst' && i.inzage.afnameId === afname.id,
    );
    assert.ok(item, `${afname.id} ontbreekt in de tijdlijn`);
    assert.equal(item.datum, afname.ingevuldOp.slice(0, 10));
  }
});

test('journaal: de patiëntbron toont alleen wat de patiënt zelf aanleverde', () => {
  const metBron = repo.alleDossiers()
    .map((d) => d.patient.id)
    .filter((id) => dossierHistorie(repo, id).bronnen.some((b) => b.aard === 'patient'));
  assert.ok(metBron.length > 5, 'bijna niemand levert zelf iets aan');

  for (const patientId of metBron.slice(0, 8)) {
    const gefilterd = dossierHistorie(repo, patientId, PATIENTBRON);
    assert.ok(gefilterd.tijdlijn.length > 0, `${patientId}: patiëntbron is leeg`);
    for (const item of gefilterd.tijdlijn) {
      assert.ok(PATIENTSOORTEN.includes(item.soort),
        `${patientId}: ${item.soort} hoort niet bij de patiëntbron`);
    }
  }
});

// ── Doorlooptijd en het protocol ────────────────────────────────────────────

test('aanloop: de vragenlijst laat een afspraak nooit sneuvelen zolang er nog een dag is', () => {
  /*
   * De doorlooptijd hoort bij het onderdeel, niet bij het blok. Eerder gold één grens
   * van vijf dagen voor alles, en dan stond er bij een afspraak over vier dagen dat ook
   * de vragenlijst niet meer op tijd zou zijn — terwijl die de avond ervoor nog ingevuld
   * kan worden.
   */
  for (const regel of aanloop(repo)) {
    if (regel.dagenTot < 1) continue;
    const lijstOpen = regel.vragenlijst?.status === 'open';
    const labTeLaat = regel.vooraf.some((v) => !v.binnen && !v.haalbaar);
    if (lijstOpen && !labTeLaat) {
      assert.notEqual(regel.status, 'verzetten',
        `${regel.naam} wordt verzet terwijl alleen de vragenlijst nog open staat`);
    }
  }
});

test('aanloop: haalbaarheid volgt de doorlooptijd van het onderdeel zelf', () => {
  for (const regel of aanloop(repo)) {
    for (const onderdeel of regel.vooraf) {
      if (onderdeel.binnen) continue;
      assert.equal(onderdeel.haalbaar, regel.dagenTot >= onderdeel.doorlooptijdDagen,
        `${regel.naam} / ${onderdeel.naam}: haalbaarheid klopt niet met ${onderdeel.doorlooptijdDagen} dagen`);
    }
  }
});

test('protocol: de richtlijn blijft zichtbaar naast wat de praktijk ervan maakt', () => {
  const overzicht = protocoloverzicht(repo, 'zv-poh-1');
  assert.ok(overzicht.aantalAfwijkingen > 0, 'geen enkele afwijking om te tonen');

  const afwijkend = overzicht.modules
    .flatMap((m) => m.items)
    .filter((i) => i.afwijking);
  assert.ok(afwijkend.length > 0);

  for (const item of afwijkend) {
    assert.ok(item.afwijking.reden.length > 10, `${item.naam}: afwijking zonder reden`);
    assert.ok(item.afwijking.door.length > 0, `${item.naam}: afwijking zonder naam`);
    assert.ok(item.afwijking.op.length === 10, `${item.naam}: afwijking zonder datum`);
    const anders = item.praktijk.intervalDagen !== item.richtlijn.intervalDagen
      || item.praktijk.doorlooptijdDagen !== item.richtlijn.doorlooptijdDagen
      || item.praktijk.labVooraf !== item.richtlijn.labVooraf
      || !item.praktijk.actief;
    assert.ok(anders, `${item.naam}: draagt een afwijking maar is gelijk aan de richtlijn`);
  }
});

test('protocol: aanpassen vraagt een recht én een reden', () => {
  const eigen = new InMemoryRepository();

  const zonderRecht = wijzigProtocol(
    eigen, { moduleId: 'leefstijl', itemCode: '29463-7', intervalDagen: 92, reden: 'Vaker wegen bij ons.' },
    'zv-as-1',
  );
  assert.equal(zonderRecht.uitgevoerd, false);

  const zonderReden = wijzigProtocol(
    eigen, { moduleId: 'leefstijl', itemCode: '29463-7', intervalDagen: 92, reden: 'ok' },
    'zv-poh-1',
  );
  assert.equal(zonderReden.uitgevoerd, false);

  const goed = wijzigProtocol(
    eigen, { moduleId: 'leefstijl', itemCode: '29463-7', intervalDagen: 92, reden: 'Vaker wegen bij ons.' },
    'zv-poh-1',
  );
  assert.equal(goed.uitgevoerd, true);
  const item = goed.overzicht.modules
    .find((m) => m.id === 'leefstijl').items
    .find((i) => i.code === '29463-7');
  assert.equal(item.praktijk.intervalDagen, 92);
  assert.equal(item.richtlijn.intervalDagen, 183, 'de richtlijnwaarde mag niet meeveranderen');
  assert.equal(item.afwijking.door, 'Sanne Bakker');
});

test('protocol: een aanpassing werkt door in het zorgplan van de patiënt', () => {
  const eigen = new InMemoryRepository();
  const intervalVan = (repository, patientId) => {
    const plan = patientOverzicht(repository, patientId).zorgplan;
    return plan.modules
      .flatMap((m) => m.items)
      // Een item dat maar in één module voorkomt: de rookstatus zit in drie modules,
      // en dan zegt een gewijzigd interval in één ervan niets over de uitkomst.
      .find((i) => i.code === 'medicatiebeoordeling')?.intervalDagen;
  };
  // De eerste de beste met leefstijl in het plan; niet elk dossier heeft elke module.
  const patientId = eigen.alleDossiers()
    .map((d) => d.patient.id)
    .find((id) => intervalVan(eigen, id) !== undefined);
  assert.ok(patientId, 'geen enkele patiënt met een medicatiebeoordeling in het zorgplan');

  const voor = intervalVan(eigen, patientId);

  wijzigProtocol(
    eigen,
    {
      moduleId: 'medicatieveiligheid', itemCode: 'medicatiebeoordeling',
      intervalDagen: 183, reden: 'Bij polyfarmacie halfjaarlijks in plaats van jaarlijks.',
    },
    'zv-poh-1',
  );
  assert.notEqual(intervalVan(eigen, patientId), voor,
    'de protocolwijziging werkt niet door in het zorgplan');

  herstelProtocol(eigen, 'medicatieveiligheid', 'medicatiebeoordeling', 'zv-poh-1');
  assert.equal(intervalVan(eigen, patientId), voor,
    'terugzetten herstelt het oorspronkelijke interval niet');
});
