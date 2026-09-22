/**
 * HET DEMONSTRATIESCRIPT ALS WORD-DOCUMENT
 *
 * docs/21-demonstratie.md is de bron; dit script maakt er de versie van die je meeneemt
 * naar een demo. De inhoud staat hieronder nog een keer uitgeschreven in plaats van uit
 * de markdown gelezen te worden — bewust, want de papieren versie heeft een andere
 * indeling nodig dan de leesversie: wat je hardop zegt krijgt een eigen kader, wat je
 * klikt een eigen regel. Een automatische omzetting maakt daar één grijze massa van.
 *
 * Wijzig je docs/21, loop dan dit bestand na. Draaien:
 *
 *     npm run demoscript
 *
 * ⚠️ De getallen in het script komen uit de demopopulatie. Verandert de seed, dan
 * kloppen ze niet meer — packages/praktijk/test/demodata.test.js bewaakt het deel dat
 * te bewaken valt.
 */

const fs = require('node:fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType, ShadingType, PageOrientation, Footer,
  PageNumber, LevelFormat, convertMillimetersToTwip,
} = require('docx');

// ── Vormtaal ────────────────────────────────────────────────────────────────
const MERK = '0F5F6E';        // petrol, de merkkleur van Cadans
const MERK_ZACHT = 'E3F0F2';
const INK = '241F2E';
const INK_2 = '5C5468';
const LIJN = 'E8E2DD';
const PAPIER = 'F8F5F2';

const BREEDTE = convertMillimetersToTwip(210) - 2 * convertMillimetersToTwip(20); // A4 min marges

/**
 * Minimale markdown-inline-parser: **vet**, *cursief* en `code`.
 * Scheelt handmatig runs bouwen voor elke zin, en houdt de brontekst leesbaar.
 */
function runs(tekst, basis = {}) {
  // Recursief, zodat opmaak ín opmaak ook telt: **een (`account`) in vette tekst** liet
  // anders de backticks gewoon staan.
  const stukken = [];
  const patroon = /(\*\*[\s\S]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  let laatste = 0;
  let m;
  while ((m = patroon.exec(tekst)) !== null) {
    if (m.index > laatste) stukken.push({ t: tekst.slice(laatste, m.index), ...basis });
    const s = m[0];
    if (s.startsWith('**')) stukken.push(...runsDelen(s.slice(2, -2), { ...basis, vet: true }));
    else if (s.startsWith('`')) stukken.push({ t: s.slice(1, -1), ...basis, code: true });
    else stukken.push(...runsDelen(s.slice(1, -1), { ...basis, cursief: true }));
    laatste = m.index + s.length;
  }
  if (laatste < tekst.length) stukken.push({ t: tekst.slice(laatste), ...basis });

  return stukken.map((s) => new TextRun({
    text: s.t,
    bold: s.vet || basis.bold,
    italics: s.cursief || basis.italics,
    color: basis.color ?? INK,
    size: basis.size ?? 21,
    font: s.code ? 'Consolas' : (basis.font ?? 'Calibri'),
    shading: s.code ? { type: ShadingType.CLEAR, fill: 'EFECE8' } : undefined,
  }));
}

/** Zelfde splitsing, maar als losse stukjes in plaats van TextRuns — voor de nesting. */
function runsDelen(tekst, erf) {
  const uit = [];
  const patroon = /(\*\*[\s\S]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  let laatste = 0;
  let m;
  while ((m = patroon.exec(tekst)) !== null) {
    if (m.index > laatste) uit.push({ t: tekst.slice(laatste, m.index), ...erf });
    const s = m[0];
    if (s.startsWith('**')) uit.push(...runsDelen(s.slice(2, -2), { ...erf, vet: true }));
    else if (s.startsWith('`')) uit.push({ t: s.slice(1, -1), ...erf, code: true });
    else uit.push(...runsDelen(s.slice(1, -1), { ...erf, cursief: true }));
    laatste = m.index + s.length;
  }
  if (laatste < tekst.length) uit.push({ t: tekst.slice(laatste), ...erf });
  return uit;
}

const p = (tekst, opties = {}) => new Paragraph({
  children: runs(tekst, opties),
  spacing: { after: opties.na ?? 140, line: 276 },
  ...opties.extra,
});

const h1 = (tekst) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 180 },
  children: [new TextRun({ text: tekst, bold: true, size: 30, color: MERK, font: 'Calibri' })],
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: MERK, space: 6 } },
});

const h2 = (tekst) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 120 },
  children: [new TextRun({ text: tekst, bold: true, size: 24, color: INK, font: 'Calibri' })],
});

/**
 * Wat je hardop zegt.
 *
 * Krijgt een eigen kleur, een balk links en een lichte ondergrond: tijdens een demo moet
 * je in één oogopslag zien wat tekst is om te lezen en wat instructie is om te doen.
 */
const zeg = (tekst) => new Paragraph({
  children: runs(tekst, { color: '123E47', size: 21 }),
  spacing: { before: 100, after: 140, line: 288 },
  indent: { left: 340, right: 200 },
  shading: { type: ShadingType.CLEAR, fill: MERK_ZACHT },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: MERK, space: 10 } },
});

/** Wat je klikt. Kort, vet, met een pijl ervoor. */
const doe = (tekst) => new Paragraph({
  children: [
    new TextRun({ text: '▸  ', bold: true, color: MERK, size: 21, font: 'Calibri' }),
    ...runs(tekst, { bold: true, size: 21 }),
  ],
  spacing: { before: 100, after: 140 },
  indent: { left: 60 },
});

const bullet = (tekst) => new Paragraph({
  children: runs(tekst),
  numbering: { reference: 'opsomming', level: 0 },
  spacing: { after: 80, line: 276 },
});

const leeg = (hoogte = 120) => new Paragraph({ text: '', spacing: { after: hoogte } });

/** Tabel met dubbele breedtes — kolombreedtes én celbreedtes, allebei in DXA. */
function tabel(kolommen, rijen, opties = {}) {
  const koppen = opties.koppen !== false;
  const cel = (inhoud, breedte, kop) => new TableCell({
    width: { size: breedte, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: kop ? MERK_ZACHT : 'FFFFFF' },
    margins: { top: 90, bottom: 90, left: 130, right: 130 },
    children: [new Paragraph({
      children: runs(inhoud, kop ? { bold: true, size: 19, color: MERK } : { size: 19 }),
      spacing: { after: 0, line: 264 },
    })],
  });

  const alleRijen = [];
  if (koppen) {
    alleRijen.push(new TableRow({
      tableHeader: true,
      children: kolommen.map((k, i) => cel(k.titel, k.breedte, true)),
    }));
  }
  for (const rij of rijen) {
    alleRijen.push(new TableRow({
      children: rij.map((waarde, i) => cel(waarde, kolommen[i].breedte, false)),
    }));
  }

  return new Table({
    columnWidths: kolommen.map((k) => k.breedte),
    width: { size: kolommen.reduce((s, k) => s + k.breedte, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LIJN },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LIJN },
      left: { style: BorderStyle.SINGLE, size: 4, color: LIJN },
      right: { style: BorderStyle.SINGLE, size: 4, color: LIJN },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LIJN },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: LIJN },
    },
    rows: alleRijen,
  });
}

/** Kader voor een waarschuwing of een terzijde. */
const kader = (regels) => new Table({
  columnWidths: [BREEDTE],
  width: { size: BREEDTE, type: WidthType.DXA },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'E7C68A' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E7C68A' },
    left: { style: BorderStyle.SINGLE, size: 18, color: 'A16207' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'E7C68A' },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: BREEDTE, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'FFFAEB' },
      margins: { top: 140, bottom: 140, left: 180, right: 180 },
      children: regels.map((r, i) => new Paragraph({
        children: runs(r, { size: 20, color: '7A4A05' }),
        spacing: { after: i === regels.length - 1 ? 0 : 100, line: 276 },
      })),
    })],
  })],
});

// ── Inhoud ──────────────────────────────────────────────────────────────────

const inhoud = [];
const K = (...args) => inhoud.push(...args);

// Titelblok
K(new Paragraph({
  spacing: { after: 60 },
  children: [new TextRun({ text: 'Cadans', bold: true, size: 26, color: MERK, font: 'Calibri' })],
}));
K(new Paragraph({
  spacing: { after: 100 },
  children: [new TextRun({ text: 'Het demonstratiescript', bold: true, size: 44, color: INK, font: 'Calibri' })],
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: MERK, space: 8 } },
}));
K(p('Een uitgeschreven route door Cadans, langs de drie werkplekken, met het zwaartepunt bij de praktijkondersteuner. Bedoeld om voor te lezen of uit je hoofd te doen — niet om aan je publiek te geven.',
  { italics: true, color: INK_2, na: 220 }));

K(tabel(
  [{ titel: '', breedte: 2100 }, { titel: '', breedte: BREEDTE - 2100 }],
  [
    ['**Duur**', '15 minuten voor het hele verhaal; 8 daarvan bij de POH'],
    ['**Accounts**', '`ilse` (assistent) · `daan` (huisarts) · `sanne` (POH-S) · `mirjam` (praktijkmanager)'],
    ['**Wachtwoord**', '`cadans` voor alle vier · verificatiecode `123456`'],
    ['**Reset**', '**Demo herstellen** rechtsboven zet alles terug naar de beginstand'],
  ],
  { koppen: false },
));
K(leeg(200));

// ── Voor je begint
K(h1('Voor je begint'));
K(p('Drie dingen om te weten voordat je begint.'));
K(p('**De klok staat stil op 10:20.** De demopraktijk staat altijd halverwege de ochtend: drie consulten zijn geweest, één patiënt is niet komen opdagen, één zit in de wachtkamer. Dat is niet afhankelijk van het tijdstip waarop jij demonstreert. Je kunt dus om negen uur ’s ochtends en om vijf uur ’s middags hetzelfde verhaal vertellen.'));
K(p('**De datum loopt wél mee.** De peildatum is vandaag, dus leeftijden, intervallen en “hoe lang geleden” kloppen altijd met de dag waarop je het laat zien.'));
K(p('**De acute meldingen komen binnen op een tijdslot na het inloggen**: na 0, 40, 95 en 150 seconden. Dat is geen effect maar het punt van die functie — er komt iets binnen terwijl je met iets anders bezig bent. Houd daar rekening mee: log in, en begin te praten.'));
K(leeg(60));
K(kader([
  '**Let op.** Alles wat je ziet is synthetisch: 48 verzonnen patiënten, verzonnen waarden, en drempelwaarden die plausibel zijn maar niet tegen de NHG-standaarden gevalideerd.',
  'Zeg dat één keer aan het begin, dan hoef je het niet meer te zeggen.',
]));
K(leeg(200));

// ── Rode draad
K(h1('De rode draad: Piet de Vries'));
K(p('Eén man loopt door het hele verhaal, en je kunt hem er op drie plekken uit halen.'));
K(p('**Piet de Vries, 72 jaar, COPD, gebruikt tiotropium.** Hij is opgenomen geweest met een exacerbatie; het ziekenhuisbericht daarover — *Opname longgeneeskunde, Spaarne Gasthuis, binnengekomen als BgZ* — staat in zijn journaal. De huisarts heeft hem op de bespreeklijst gezet met de vraag *wie de longrevalidatie oppakt en wanneer we hem terugzien*. Vanochtend stuurt hij een portaalbericht dat hij benauwder is en dat de pufjes minder helpen — dat komt als acute melding binnen bij de POH. Hij staat vanmiddag om 14:10 in haar agenda, met een eGFR van 37 als signaal. En in *Berichten* loopt een draadje tussen de assistent en de POH over precies deze benauwdheid.'));
K(p('Dat is de reis: **binnengekomen bij de praktijk → beoordeeld door de huisarts → overgedragen aan de POH → en vandaag weer in beeld.** Je hoeft hem niet te forceren; noem hem gewoon elke keer dat hij langskomt, dan bouwt het verhaal zichzelf op.'));

// ── Deel 1
K(h1('Deel 1 — De doktersassistent (3 minuten)'));
K(doe('Log in als `ilse`.'));

K(h2('Dagstart'));
K(zeg('“Dit is de assistent. Vier tegels, en dat zijn geen tellers maar haar werkproces.”'));
K(p('Wijs de tegels aan: **14 zorgvragen te beoordelen**, **1 met zelfzorgadvies afgevangen**, **8 verrichtingen** in haar eigen agenda, en de stapel die naar de huisarts gaat.'));
K(doe('Klik op de tegel “Binnengekomen”. De tegels zijn knoppen — bij alle drie de zorgrollen.'));

K(h2('Triage'));
K(zeg('“Veertien zorgvragen vanochtend. Zeven via het portaal, zeven aan de telefoon of aan de balie. En hier zit de kern: het is één triagemodel voor twee kanalen.”'));
K(p('Loop de eerste vier regels langs — die zijn bewust de vier mogelijke uitkomsten:'));
K(tabel(
  [
    { titel: 'Tijd', breedte: 900 },
    { titel: 'Patiënt', breedte: 2100 },
    { titel: 'Vraag', breedte: 4100 },
    { titel: 'Uitkomst', breedte: BREEDTE - 900 - 2100 - 4100 },
  ],
  [
    ['08:05', 'Corrie Jansen', '“Mijn suikers thuis zijn hoger dan normaal”', 'deze week, **naar de POH**'],
    ['08:12', 'Gerrit Smit', '“Steeds duizelig bij opstaan sinds de nieuwe tablet”', 'vandaag, **naar de huisarts**'],
    ['08:19', 'Anneke Smit', '“Jeukende plekjes op de rug”', 'deze week, **naar de assistent**'],
    ['08:26', 'Marjan van den Berg', '“Al een week keelpijn”', '**zelfzorg**, geen afspraak'],
  ],
));
K(leeg(140));
K(zeg('“Wie via het portaal binnenkomt, heeft de triagevragen al doorlopen. De uitkomst staat er, inclusief het advies dat de patiënt al gekregen heeft. Bij Corrie Jansen hoeft Ilse niets te bedenken: het systeem zegt dat dit bij de POH hoort en waarom. Wie belt, krijgt dezelfde vragen — dan is Ilse degene die ze stelt. Zelfde model, zelfde uitkomst, zelfde registratie in het dossier.”'));
K(p('Wijs op de regel die naar de huisarts gaat:'));
K(zeg('“En deze gaat vandaag naar de huisarts, want de klachten begonnen na een nieuwe tablet. Dat is geen protocol dat iemand uit zijn hoofd kent — dat is de triage die het zegt.”'));
K(doe('De overgang: klik op **Doorzetten naar POH** bij Corrie Jansen, of laat het zitten en zeg: “die vraag komt straks bij de POH terug.”'));

// ── Deel 2
K(h1('Deel 2 — De huisarts (3 minuten)'));
K(doe('Uitloggen, inloggen als `daan`.'));

K(h2('De spoedmelding'));
K(p('Binnen een paar seconden schuift er een **modaal venster** over het scherm: **Dirk Mulder, 83 jaar, belt zelf — drukkende pijn op de borst sinds een half uur, zweterig.**'));
K(zeg('“Dit is waar het misgaat in bestaande systemen. Een teller die van 3 naar 4 gaat terwijl je een consult doet, ziet niemand. Alleen spoed krijgt een venster dat je moet wegklikken — en daarom is dat niveau schaars.”'));
K(p('Wijs de drie blokken aan: de samenvatting, **waarom dit acuut is**, en het voorstel.'));
K(zeg('“Waarom nu: bekend met diabetes en hypertensie, en bij die combinatie is een atypisch beeld eerder regel dan uitzondering. Dat staat er niet voor de sier. Een urgentiestempel zonder onderbouwing leert een gebruiker om hem weg te klikken, en dan heb je alarmmoeheid gebouwd.”'));
K(p('Wijs onderaan: *“Staat ook bij: huisarts, assistent. Zodra jij hem oppakt, zien zij dat.”*'));
K(zeg('“Wie klikt, claimt hem. Zonder die claim gaan er twee mensen bellen, of geen enkele.”'));
K(doe('Klik **Niet nu — laat staan voor een collega** en leg uit dat dat expres kan: wie in een gesprek zit met een andere patiënt moet door kunnen.'));

K(h2('Autoriseren'));
K(doe('Klik op “Autoriseren”.'));
K(zeg('“163 openstaande verzoeken. Dat getal is niet verzonnen — dat is wat er in een doorsneepraktijk op een huisarts wacht. Maar kijk naar de kop: **29 vragen jouw oordeel.**”'));
K(zeg('“De rest — 134 — is binnen protocol, binnen de referentiewaarde, geen interactie. Dat kan in één handeling. Het verschil tussen 163 regels uitzoeken en 29 besluiten nemen zit niet in het aantal, maar in de vraag die het systeem voor je beantwoordt.”'));
K(p('Wijs één regel aan onder *Vraagt jouw oordeel*, bijvoorbeeld een lab met *“Buiten referentiewaarde en gestegen ten opzichte van de vorige bepaling”*.'));
K(zeg('“En er staat bij waaróm het geen routine is.”'));

K(h2('Het overleg'));
K(doe('Klik op “Overleg”.'));
K(zeg('“Elf uur, half uur, huisarts en POH samen. Vier punten. Eén lijst voor het hele team — wie een patiënt inbrengt, ziet hem hier terug en de ander ook.”'));
K(p('Wijs op het vierde punt:'));
K(zeg('“En dit is Piet de Vries. Ingebracht door de huisarts, vóór de POH: *na de ziekenhuisopname COPD, wie pakt de longrevalidatie op en wanneer zien we hem terug?* Met de context eronder, uit het dossier. Onthoud die naam — over twee minuten komt hij terug.”'));

// ── Deel 3
K(h1('Deel 3 — De praktijkondersteuner (8 minuten)'));
K(doe('Uitloggen, inloggen als `sanne`. **Dit is het hoofdstuk.** Neem er de tijd voor.'));

K(h2('1. De dagstart — wat is mijn dag?'));
K(zeg('“Goedemorgen Sanne. Geen zoekveld, geen postvak. Vier kaarten, en dat is haar werkproces in volgorde: **voorbereiden, spreekuur, monitoren, afronden.** Je begint links en je eindigt rechts.”'));
K(p('Lees de vier tegels hardop:'));
K(bullet('**Voorbereiden — 9**, waarvan 8 vragen aandacht'));
K(bullet('**Spreekuur — 9**, waarvan 3 vragen aandacht'));
K(bullet('**Monitoren — 23**, waarvan 7 vragen aandacht'));
K(bullet('**Afronden — 3**, alles bij'));
K(leeg(60));
K(zeg('“Elke kaart zegt ook wát je er vindt. Dat lijkt een detail, maar het is precies wat ontbreekt in bestaande systemen: je moet er maar achter komen waar je werk staat.”'));
K(p('Wijs rechtsonder op **Vraagt als eerste aandacht**:'));
K(zeg('“Eén patiënt springt eruit vandaag: **Fatima Vermeulen, CCQ van 1 naar 2.** Dat is geen losse uitschieter maar een beloop dat de verkeerde kant op gaat. Zij staat vanmiddag om 11:20 in de agenda — dus Sanne weet dit vóórdat ze de spreekkamer in loopt.”'));
K(p('Wijs op het groene blok:'));
K(zeg('“En dit heeft het systeem vannacht al gedaan: 23 labaanvragen klaargezet vóór het contact, 21 vragenlijsten uitgezet. 53% van wat het systeem signaleerde is logistiek en draait zonder tussenkomst. De overige 39 punten zijn klinische beslissingen — die blijven bij haar. Dat onderscheid is het hele ontwerp.”'));
K(doe('Klik op de tegel “Voorbereiden”.'));

K(h2('2. Voorbereiden — is alles binnen?'));
K(zeg('“Negen afspraken vandaag, acht nog niet compleet. Per patiënt: wat is binnen, wat ontbreekt, en waar zou dit gesprek over moeten gaan.”'));
K(p('Neem de eerste regel, **Ilse Meijer, 08:40**:'));
K(bullet('links **Klaar voor het gesprek**: voetonderzoek, gewicht, bloeddruk'));
K(bullet('links **Ontbreekt nog**: HbA1c, funduscontrole, albumine/creatinine-ratio'));
K(bullet('rechts **Waar dit gesprek over zou moeten gaan**: *zelfredzaamheid is achteruitgegaan*'));
K(leeg(60));
K(p('Wijs op het blok **Voorbereiding uit de wachtkamer**:'));
K(zeg('“Dit is een ingebedde partnerapp. De patiënt heeft in de wachtkamer twee minuten ingesproken, en dat komt terug als gestructureerde anamnese met codesuggesties en een meegebrachte meting. Let op het label: **nog niet bevestigd.** Het telt nergens in mee zolang een mens het niet heeft overgenomen. Naadloze integratie zonder dat onderscheid is hetzelfde als ongecontroleerd vertrouwen.”'));
K(p('Wijs rechtsboven op **Alles wat ontbreekt klaarzetten**:'));
K(zeg('“En dit is logistiek werk zonder klinische beslissing — dus dat kan in één handeling voor iedereen.”'));
K(doe('Klik op “Spreekuur” in het linkermenu.'));

K(h2('3. Het spreekuur — wie is er nu?'));
K(zeg('“De dag als werklijst. Drie zijn geweest, één is niet verschenen, één zit binnen.”'));
K(p('Bovenaan staat: **Nu aan de beurt: Anneke Bos — 10:40, chronische controle.**'));
K(zeg('“Die vraag stelt een POH de hele ochtend: zit hij er al? In een gewone agenda moet je dat aan de assistent vragen. Hier staat het er, want de aanmeldzuil weet het.”'));
K(doe('Klik op “Open het consultscherm”.'));

K(h2('4. Het dossier — wie is deze mens?'));
K(p('Het dossier opent op het tabblad **Overzicht**.'));
K(zeg('“Zeven vaste vragen: wie is dit, wat speelt er, hoe gaat het, wat kan deze mens zelf, wat gebeurde er het afgelopen jaar, wat staat er open, waar liggen de grenzen. Elke alinea met de bron eronder.”'));
K(zeg('“**Anneke Bos, 61 jaar, drie actieve episodes.** Bloeddruk 142, gedaald maar nog buiten de streefwaarde. Zelfredzaamheid 4 van 5 — goed, dus de contactintervallen mogen ruimer.”'));
K(p('Zeg er expliciet bij:'));
K(zeg('“Dit is nadrukkelijk **geen** AI-gegenereerd stukje. Het is opgebouwd uit vaste regels over gestructureerde gegevens. Een samenvatting stuurt waar een zorgverlener naar kijkt, en dat is beslissingsondersteuning: die moet per zin herleidbaar zijn. Een taalmodel kan dat niet garanderen.”'));
K(p('Wijs rechts op de **aandachtsgebieden**:'));
K(zeg('“Geen zorgprogramma’s. Vier aandachtsgebieden bij déze mens, elk met de reden waarom hij aanstaat. De koppeling naar ketenzorg en declaratie gebeurt automatisch op de achtergrond.”'));
K(doe('Klik op het tabblad “Consult”.'));
K(zeg('“Links: wie is dit, in de volgorde waarin je het wilt weten — eerst wat aandacht vraagt, dan wie deze mens is, dan wat hij gebruikt, dan wat je kunt uitzetten. Midden: de loop van het consult. Rechts: de dossierstructuur.”'));
K(p('Twee dingen om te laten zien, kies er één:'));
K(bullet('**Medicatie.** Klik op een middel. Er schuift een paneel open: dosering aanpassen, vervangen, stoppen. Vóór je bevestigt staat er in zinnen wat er gaat gebeuren — het oude stopt, het nieuwe start, de lopende order wordt ingetrokken, het recept gaat naar díe apotheek. *“Vier mutaties, één handeling, één bevestiging.”*'));
K(bullet('**Vastleggen.** Scroll naar het registratieblok: de metingen die bij dit contact horen, de contactvorm, de duur, de episode. *“Je registreert één keer; de ketenverantwoording en de declaratie volgen eruit.”*'));

K(h2('5. De melding — er komt iets tussendoor'));
K(p('Ergens hier schuift rechtsonder een kaart in beeld: **Piet de Vries, 72 jaar, portaalbericht — sinds gisteravond benauwder, pufjes helpen minder goed.**'));
K(p('Laat een stilte vallen en zeg:'));
K(zeg('“En dit is wat er in het echt gebeurt. Je bent met een consult bezig en er komt iets binnen. Geen venster dat je werk blokkeert — dit is *binnen een uur*, geen spoed. Een kaart die blijft staan.”'));
K(zeg('“Waarom nu: COPD met een exacerbatie in de voorgeschiedenis, en toename van klachten met verminderde reactie op de luchtwegverwijders. Dat staat niet in de melding omdat het mooi staat, maar omdat Sanne moet kunnen beoordelen of ze hem nú oppakt of niet.”'));
K(zeg('“En dit is dezelfde Piet de Vries die de huisarts een half uur geleden op de bespreeklijst zette. Hij staat vanmiddag om 14:10 al in haar agenda.”'));
K(doe('Klik **Dossier bekijken**: één actieve episode COPD, tiotropium, eGFR 37, en in het journaal het ziekenhuisbericht over de opname longgeneeskunde.'));
K(zeg('“En dat is niet toeval. Elke melding in dit systeem is gekoppeld aan een dossier dat de onderbouwing waarmaakt. Een waarschuwing die bij doorklikken nergens op slaat, leert een gebruiker om waarschuwingen te negeren.”'));

K(h2('6. Monitoren — wie hoeft er níet te komen'));
K(doe('Klik op “Monitoren”.'));
K(zeg('“23 patiënten op afstand gevolgd, 7 met een signaal, 16 stabiel. En dát is de kern: wie stabiel is, hoeft niet langs. Dat is óók een uitkomst, en het scheelt een oproep.”'));
K(p('Wijs een regel aan, bijvoorbeeld **Fatima Vermeulen**:'));
K(zeg('“Per patiënt: wie het is, wat het signaal is, en een suggestieknop die kleurt zodra er iets achter zit. Staat er niets achter, dan staat dat er — je hoeft niet open te klappen om te ontdekken dat er niets is.”'));
K(p('Klap er één uit en laat de **onderbouwing en de bronverwijzing** zien.'));
K(zeg('“Elke klinische suggestie wijst naar de richtlijn waarop hij berust. Zonder die verwijzing is het een advies zonder verantwoording, en bij een MDR-audit niet houdbaar.”'));

K(h2('7. Afronden — wat blijft er liggen'));
K(doe('Klik op “Afronden”.'));
K(zeg('“Twee categorieën. Acht patiënten met een ontbrekende ketenindicator — dat is een werklijst, geen cijfer. En acht vragenlijsten die klaargezet kunnen worden voor de volgende keer. Allebei veilig in bulk.”'));
K(zeg('“Nul openstaande taken. Dat is waar het naartoe moet: aan het eind van de dag is de administratie klaar omdat hij onderweg is ontstaan, niet omdat iemand een uur is blijven zitten.”'));

// ── Afsluiten
K(h1('Afsluiten'));
K(p('Kies één zin, afhankelijk van je publiek:'));
K(bullet('**Voor zorgverleners:** *“Het verschil is niet dat er meer in staat. Het verschil is dat het systeem de vraag beantwoordt die jij op dat moment stelt.”*'));
K(bullet('**Voor bestuurders:** *“53% van het gesignaleerde werk is logistiek en draait vanzelf. De rest zijn klinische beslissingen, en die horen bij een mens te blijven.”*'));
K(bullet('**Voor IT en inkoop:** *“FHIR als intern model, niet als exportformaat. Alles wat je ziet is één datamodel met herkomst per regel.”*'));

// ── Spiekbriefje
K(h1('Spiekbriefje'));
K(p('Getallen die kloppen op het moment dat je inlogt, bij een verse demo.'));
K(tabel(
  [{ titel: 'Waar', breedte: 3000 }, { titel: 'Wat', breedte: BREEDTE - 3000 }],
  [
    ['Assistent · triage', '14 zorgvragen · 7 portaal · 7 telefoon/balie · 1 zelfzorg afgevangen'],
    ['Huisarts · autoriseren', '163 openstaand · **29 vragen jouw oordeel** · 134 routine'],
    ['Huisarts · overleg', '11:00, 30 minuten, 4 punten'],
    ['POH · tegels', 'Voorbereiden 9 (8) · Spreekuur 9 (3) · Monitoren 23 (7) · Afronden 3 (0)'],
    ['POH · agenda', '12 items · 3 afgerond · 1 niet verschenen · 1 aangemeld'],
    ['POH · eerste aandacht', 'Fatima Vermeulen — CCQ van 1 naar 2'],
    ['POH · nu aan de beurt', 'Anneke Bos, 10:40'],
    ['Automatisering', '53% · 23× labaanvraag · 21× vragenlijst · 39 punten voor jou'],
    ['Praktijk', '48 patiënten'],
  ],
));
K(leeg(180));
K(p('**De acute meldingen, op volgorde van binnenkomst:**'));
K(tabel(
  [
    { titel: 'Na', breedte: 900 },
    { titel: 'Patiënt', breedte: 2400 },
    { titel: 'Wat', breedte: 3600 },
    { titel: 'Voor wie', breedte: BREEDTE - 900 - 2400 - 3600 },
  ],
  [
    ['0 s', 'Dirk Mulder (83)', 'pijn op de borst — **spoed, modaal**', 'huisarts, assistent'],
    ['40 s', 'Piet de Vries (72)', 'benauwder, pufjes helpen minder', 'huisarts, **POH**, assistent'],
    ['95 s', 'Greetje de Boer (76)', 'thuismeter 212/118', 'huisarts, **POH**'],
    ['150 s', 'Youssef de Boer', 'kalium 6,2', 'huisarts'],
  ],
));

// ── Valkuilen
K(h1('Wat je beter niet doet'));
K(p('**Open geen willekeurig dossier via het zoekveld.** De 48 patiënten zijn niet allemaal even rijk gevuld; een deel heeft geen episodes en weinig historie. De patiënten in dit script zijn dat wel. Wil je toch vrij rondklikken, neem dan iemand uit de agenda van de POH of uit het monitoringcohort.'));
K(p('**Beloof geen koppelingen.** Er is geen LSP, geen ZorgDomein, geen G-Standaard en geen receptverkeer. De velden en het werkproces zijn er; de transportlaag niet. Als iemand ernaar vraagt is het eerlijkste antwoord: *“de order heeft een bestemming en een route — wat eronder zit is een koppeling die we nog moeten bouwen.”*'));
K(p('**Klik de videobelknop niet aan alsof er beeld komt.** Hij opent een venster dat het werkproces toont en zet geen verbinding op. Dat is expres, en dat is ook het antwoord.'));
K(p('**Laat de praktijkmanager (`mirjam`) weg** tenzij je publiek erom vraagt. Zij heeft geen dossiertoegang — dat is een goed verhaal over autorisatie, maar het leidt af van de reis.'));
K(p('**Reset tussen twee demo’s door.** Als je in de vorige ronde medicatie hebt gewijzigd of een consult hebt vastgelegd, staat dat er nog. **Demo herstellen** zet alles terug.'));

// ── Document ────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Cadans',
  title: 'Cadans — het demonstratiescript',
  description: 'Uitgeschreven demonstratieroute langs assistent, huisarts en praktijkondersteuner.',
  numbering: {
    config: [{
      reference: 'opsomming',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 220 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT },
        margin: {
          top: convertMillimetersToTwip(20),
          bottom: convertMillimetersToTwip(18),
          left: convertMillimetersToTwip(20),
          right: convertMillimetersToTwip(20),
        },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'Cadans · demonstratiescript · ', size: 16, color: INK_2, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: INK_2, font: 'Calibri' }),
          ],
        })],
      }),
    },
    children: inhoud,
  }],
});

const doel = process.argv[2] ?? 'Cadans-demonstratiescript.docx';
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(doel, buf);
  console.log(`geschreven: ${doel} (${buf.length} bytes)`);
});
