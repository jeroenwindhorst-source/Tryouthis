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

/*
 * De inhoud staat hier uitgeschreven en niet als markdown-parser.
 *
 * Reden: het script in docs/21 is er om te lézen, het Word-bestand om vóór je neer te
 * leggen tijdens een demo. Dat vraagt andere keuzes — wat je zegt krijgt een balk, wat je
 * klikt krijgt een pijl — en die vertaling kost meer dan hij oplevert als je hem
 * automatiseert. De prijs is dat beide bestanden bij een wijziging langs moeten.
 */

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
K(p('Eén route door Cadans, vanuit de stoel van de praktijkondersteuner. Tien minuten, zeven stappen, één verhaal. Bedoeld om uit je hoofd te doen — niet om aan je publiek te geven.',
  { italics: true, color: INK_2, na: 220 }));

K(tabel(
  [{ titel: '', breedte: 2100 }, { titel: '', breedte: BREEDTE - 2100 }],
  [
    ['**Duur**', '10 minuten voor de hoofdlijn; 15 als je de uitstapjes meeneemt'],
    ['**Account**', '`sanne` (POH-Somatiek) · wachtwoord `cadans` · code `123456`'],
    ['**Reset**', '**Demo herstellen** rechtsboven zet alles terug naar de beginstand'],
  ],
  { koppen: false },
));
K(leeg(200));

// ── Voor je begint
K(h1('Voor je begint'));
K(p('**De klok staat stil op 10:20.** De demopraktijk staat altijd halverwege de ochtend: drie consulten zijn geweest, één patiënt is niet komen opdagen, één zit in de wachtkamer. Dat hangt niet af van het tijdstip waarop jij demonstreert. De dátum loopt wel mee, dus leeftijden en intervallen kloppen altijd met vandaag.'));
K(p('**Er komen acute meldingen binnen** na 0, 40, 95 en 150 seconden. Dat is geen effect maar het punt van die functie: er komt iets binnen terwijl je met iets anders bezig bent. Log in en begin meteen te praten.'));
K(leeg(60));
K(kader([
  '**Let op.** Alles is synthetisch: 48 verzonnen patiënten, verzonnen waarden, en drempelwaarden die plausibel zijn maar niet tegen de NHG-standaarden gevalideerd.',
  'Zeg dat één keer aan het begin, dan hoef je het niet meer te zeggen.',
]));
K(leeg(200));

// ── De lijn
K(h1('Waar het verhaal over gaat'));
K(p('Eén zin om mee te openen en mee af te sluiten:'));
K(zeg('“Dit is één systeem, geen HIS met een KIS ernaast. Iedereen kijkt in hetzelfde dossier en ziet het stuk dat bij zijn werk hoort. Dit is wat de praktijkondersteuner ziet.”'));
K(p('Alles wat daarna komt, is uitwerking van die zin.'));

// ── 1
K(h1('1 · Inloggen — dit is mijn overzicht'));
K(doe('Log in als `sanne`.'));
K(zeg('“Ik log in en ik kom niet in een zoekscherm. Ik kom in mijn dag.”'));
K(p('Wijs drie dingen aan, meer niet:'));
K(bullet('**Links staat mijn werk.** Dagstart, Aanloop, Spreekuur, Opvolgen, Monitoren, Afronden. Dat is geen menu van het systeem maar mijn werkproces. De huisarts ziet hier andere ingangen — autoriseren, het team — en de assistent weer andere. Eén dossier, verschillende werkplekken.'));
K(bullet('**Rechts staat wat het systeem vandaag al heeft gedaan.** 19 labaanvragen klaargezet vóór het contact, 21 vragenlijsten uitgezet. Daar is niemand aan te pas gekomen.'));
K(bullet('**Daaronder staat wat als eerste aandacht vraagt.** Vier mensen, met de bevinding eronder en niet alleen een naam.'));
K(zeg('“Bijna de helft van wat het systeem signaleerde, is logistiek en draait zonder mij. Wat overblijft zijn klinische beslissingen, en die blijven bij mij.”'));

// ── 2
K(h1('2 · De vier tegels — mijn werk op volgorde van tijd'));
K(zeg('“Deze vier blokken zijn niet vier lijsten. Ze staan op volgorde van hoe ver het moment ligt waarop er iets gebeurt.”'));
K(leeg(60));
K(tabel(
  [
    { titel: 'Tegel', breedte: 1900 },
    { titel: 'Horizon', breedte: 2100 },
    { titel: 'De vraag die hij beantwoordt', breedte: BREEDTE - 4000 },
  ],
  [
    ['**Aanloop**', 'de komende weken', 'wie komt er straks terwijl de voorbereiding niet rond is?'],
    ['**Spreekuur**', 'vandaag', 'wie komt er, en wat weet ik van deze mens?'],
    ['**Opvolgen**', 'nu', 'wat vraagt aandacht bij iemand die géén afspraak heeft?'],
    ['**Afronden**', 'straks', 'wat blijft er liggen als ik naar huis ga?'],
  ],
));
K(leeg(140));
K(zeg('“En het zijn knoppen. Ik klik erop en ik zit in het werk.”'));
K(p('Als iemand vraagt waar het monitoren gebleven is:'));
K(zeg('“Dat zat hier eerst als vijfde blok naast Opvolgen, en dat werkte niet. Dezelfde eGFR van 40 stond in het ene blok als binnengekomen uitslag en in het andere als afwijkende waarde. Wat aandacht vraagt staat nu op één plek. Wie ik volg en wie het goed doet — dat overzicht staat er nog, onder Praktijk, maar dat is geen werklijst.”'));

// ── 3
K(h1('3 · Aanloop — voorkomen dat een consult over niets gaat'));
K(doe('Klik op **Aanloop**.'));
K(zeg('“Dit blok gaat over afspraken die nog moeten komen. Voor elk van deze mensen heeft het systeem drie weken geleden automatisch een uitnodiging gestuurd om bloed te laten prikken. Bij de meesten werkt dat. Bij sommigen niet.”'));
K(p('Bovenaan staat **Fatima Bos, over vier dagen**, met de melding **Verzetten**.'));
K(zeg('“Zij komt maandag, en het bloed is niet geprikt. Prikken en de uitslag terugkrijgen kost twee tot drie werkdagen. Dus dat consult gaat over niets: twintig minuten, en daarna moet ze terugkomen. Het systeem zegt niet ‘er ontbreekt iets’ — het zegt: verzet deze afspraak.”'));
K(p('Daaronder **Greetje de Vries, over zes dagen**, met de melding **Bellen**.'));
K(zeg('“Precies hetzelfde feit — niet geprikt — maar er zijn nog zes dagen. Dan is bellen de juiste actie, niet verzetten. Hetzelfde signaal, een ander advies, omdat de tijd anders ligt.”'));
K(doe('Klik bij Greetje de Vries op **Bellen en herinneren**.'));
K(zeg('“En hier zit de tussenstap die in de meeste systemen ontbreekt. Er opent een paneel, net als bij het bestellen van een order, en de vraag is: wie doet dit? Bellen dat de uitslag ontbreekt kan de assistent prima. Dus ik leg het bij haar neer — met de reden erbij, want zij moet weten waarover ze belt.”'));
K(doe('Klik op **Uitzetten bij De assistent**.'));
K(zeg('“En nu verandert de regel van stand: ‘opgepakt, ligt bij de assistent’. Hij blijft niet schreeuwen terwijl er iemand mee bezig is — dat is precies waarom mensen zulke lijsten gaan negeren.”'));
K(doe('Wijs bij Fatima Bos de merkjes onder het advies aan.'));
K(zeg('“En let op het verschil tussen die twee regels. Het lab lukt niet meer — dat kost vijf dagen. De vragenlijst kan nog wel, die kan tot de dag ervoor. Dus de reden om te verzetten is het bloedonderzoek, niet de vragenlijst. Die doorlooptijden zijn geen aanname van ons: ze staan in het protocol, en de praktijk kan ze aanpassen als het prikpunt hier trager is.”'));
K(zeg('“Dit is nu onzichtbaar. Iedere praktijk ontdekt dit op het moment dat de patiënt al in de stoel zit.”'));

// ── 4
K(h1('4 · Spreekuur — en wat de patiënt zelf heeft opgeschreven'));
K(doe('Klik op **Spreekuur**. Bovenaan staat **Anneke Bos, 10:40**.'));
K(zeg('“Dit is wat ik zie vlak voordat ik iemand binnenroep. Niet de avond ervoor in één ruk, maar op het moment dat het nodig is.”'));
K(p('**Wijs eerst aan wat er níét staat.** Er staat nergens ‘nog bloed prikken’.'));
K(zeg('“Bij wie vandaag komt, is dat allang geregeld. Dat is de aanloop geweest. Wat hier nog openstaat, zijn de dingen die ik zo meteen zelf doe: rookstatus, Positieve Gezondheid.”'));
K(p('**Dan de vragenlijst.** Die staat bovenaan de kaart, vóór de meetwaarden.'));
K(zeg('“Dit is de consultvoorbereidende vragenlijst uit de stedelijke werkwijze. Die heeft ze drie dagen geleden via het portaal ingevuld. En dit is wat ik nu al weet, voordat ze binnen is.”'));
K(p('Lees hardop voor wat er staat:'));
K(bullet('**Ze geeft haar gezondheid en haar leven een 4.**'));
K(bullet('**“Ik red het niet meer met de eigen bijdrage van de medicijnen. Ik haal ze soms niet op.”** — dat schreef ze zelf op bij *is er iets waar je over wil praten*.'));
K(bullet('Ze heeft stress, slaapt slecht, heeft niemand in haar omgeving die kan helpen.'));
K(zeg('“Een consult over haar bloeddruk zou hier volledig langsheen gaan. Ze haalt haar medicijnen niet op. Dat is geen sociale bijzaak — dat is de reden dat de behandeling niet werkt.”'));
K(doe('Klik op **Hele vragenlijst bekijken**.'));
K(zeg('“En ik kan de hele lijst gewoon teruglezen zoals zij hem gekregen heeft. Vraag voor vraag, in haar woorden. Geen samenvatting waarvan ik moet geloven dat hij klopt.”'));

// ── 5
K(h1('5 · Het consult — overnemen, en terugvinden in het journaal'));
K(doe('Klik op **Open consultscherm**. Wijs rechtsboven de knop **Bellen** aan, naast Videobellen.'));
K(zeg('“Twee manieren om deze mens te bereiken, op dezelfde plek. Bellen laat zien welke nummers er zijn, wat haar voorkeur is, en wie er gebeld mag worden als zij het zelf niet redt — met daarbij wat die naaste mag horen. Informeren is iets anders dan meebeslissen.”'));
K(doe('Klik dan op de tab **Consult**.'));
K(p('De vragenlijst staat er weer, nu met een knop.'));
K(zeg('“En dan het stuk waar het mij om gaat. Ik wil dit niet overtypen.”'));
K(doe('Klik op **Overnemen in mijn dossier**. Scroll naar het registratieblok en wijs het **S**-veld aan.'));
K(zeg('“Het staat onder de S van de SOEP. Dat is geen technische keuze: de S is wat de patiënt aangeeft, en dit ís wat de patiënt aangeeft. Het staat er in haar eigen woorden, met de datum en het kanaal erbij.”'));
K(p('En dan de regel die eronder staat:'));
K(zeg('“Let op het verschil. De antwoorden stonden er al — daar was geen handeling voor nodig. Wat er nu gebeurt is dat ik ze aanvaard. Vanaf dit moment staat de praktijk ervoor in, en er staat bij wie dat gedaan heeft. Wat de patiënt zelf doorgeeft is echt en bruikbaar, maar het is geen registratie van de praktijk tot iemand dat zegt.”'));
K(zeg('“Anders declareer je werk dat een ander gedaan heeft.”'));
K(doe('Klik op de tab **Journaal**.'));
K(zeg('“En hier staat hij terug. Niet als tekst die in een consult is geplakt, maar als eigen regel op de dag dat zíj hem invulde — drie dagen voor dit gesprek. Met erbij dat ik hem zojuist heb overgenomen, met mijn naam en de datum.”'));
K(doe('Klik op **Alle antwoorden tonen**.'));
K(zeg('“En de hele lijst is er nog, ook de vragen die niet in de samenvatting pasten.”'));
K(doe('Wijs de filterrij boven de tijdlijn aan, en links het blok **Van de patiënt zelf**.'));
K(zeg('“Het journaal laat alles zien — dat is het punt van één tijdlijn. Maar bij iemand die elke dag zijn bloeddruk doorgeeft wil je ook even zonder die metingen kunnen kijken. Dus ik kan soorten uitzetten, en wat ik heb weggeklikt blijft zichtbaar als doorgestreept merkje: ik moet kunnen zien waarom de lijst korter is.”'));
K(doe('Klik op **Alleen wat de patiënt aanleverde**.'));
K(zeg('“En dit is de vraag die ik nu nooit kan stellen: laat me eens alles zien wat deze mens zélf heeft doorgegeven. Thuismetingen, vragenlijsten, de voorbereiding uit de wachtkamer — over alle episodes heen.”'));

// ── 6
K(h1('6 · Opvolgen — wat vandaag al af kan'));
K(doe('Klik op **Opvolgen**.'));
K(zeg('“Dit blok zat er eerst niet in, en dat was de grootste blinde vlek. Hier staat wat er is binnengekomen bij mensen die vandaag géén afspraak hebben.”'));
K(p('Loop de eerste drie langs.'));
K(p('**Willem Hendriks — thuisbloeddruk gemiddeld 160 over 6 metingen.**'));
K(zeg('“Hij meet thuis. Dat is inhoudelijk beter dan mijn meting hier: geen wittejasseneffect en een reeks in plaats van één moment. In de meeste systemen blijft dat een berichtje in de postbus. Hier is het een reeks waarden met een gemiddelde en een voorstel.”'));
K(p('**Ruud Mulder — eGFR 40.**'));
K(zeg('“Die uitslag kwam een week geleden binnen op mijn eigen aanvraag. Hij raakt de dosering van meerdere middelen. Zijn volgende controle is over drie maanden.”'));
K(p('**Ilse van Dijk — “Ik ben de hele dag moe, ook als ik goed geslapen heb.”**'));
K(zeg('“Uit de jaarlijkse screening. Geen meetwaarde, gewoon wat ze opschreef.”'));
K(zeg('“Voor geen van deze drie is een consult nodig. Een bericht, een aangepast recept, een telefoontje. Zonder dit blok wachten ze tot de afspraak die toevallig in de agenda staat.”'));

// ── 7
K(h1('6b · Waar dat werk terechtkomt'));
K(doe('Klik op **Plannen**.'));
K(zeg('“Links staat mijn eigen werklijst: wat er bij mij is neergelegd, met de aanleiding erbij. Ik kies er een en klik op een vrije plek — en dan staat het in mijn agenda, met de reden zichtbaar. Want terugbellen is geen tussendoortje, het kost tien minuten.”'));
K(doe('Klap bij de taak **Contactgegevens** uit.'));
K(zeg('“En dit miste ik ook. Een taak die ‘bel deze patiënt’ heet en me vervolgens het dossier in stuurt om het nummer te zoeken, laat het belangrijkste werk aan mij over. Hier staat het nummer, staat erbij dat zij eigenlijk het portaal prefereert, en bij sommige mensen staat er wat we in de loop der jaren geleerd hebben — ‘werkt tot vier uur’ of ‘slechthorend, spreek rustig’. Dat staat nu op briefjes.”'));
K(doe('Wijs daaronder **Eigen werk inplannen** aan en zet een blok in een vrije plek.'));
K(zeg('“En dit miste ik het meest. Mijn agenda kende alleen patiënten. Maar uitslagen nalopen en administratie kosten evenveel tijd als een consult, en als die tijd er niet in staat, ziet mijn dag er voor de buitenwereld leeg uit terwijl hij vol zit.”'));
K(p('Als je de tijd hebt: log uit en weer in als `ilse` (assistent).'));
K(zeg('“En daar staat hij. Op háár dagstart, met wie hem heeft uitgezet en waarom. Dat is het verschil tussen een knop en een werkproces.”'));

K(h1('7 · Mijn cohort — en wie juist niet hoeft te komen'));
K(doe('Klik onder **Praktijk** op **Mijn cohort**. 23 mensen, 7 met een signaal, 16 stabiel.'));
K(zeg('“Dit is geen werklijst maar een overzicht. Zestien mensen hoeven niets. Dat is ook een uitkomst, en het scheelt zestien oproepen.”'));
K(p('Wijs bij **Fatima Vermeulen** en **Dirk Mulder** de regel in cursief aan, onder het signaal.'));
K(zeg('“En ook hier staat wat ze zelf hebben opgeschreven. Dirk Mulder: ‘de plek op mijn buik waar ik prik voelt hard en bobbelig aan.’ Die zin verandert meer aan mijn dag dan zijn HbA1c van 67.”'));
K(doe('Klap één regel uit.'));
K(zeg('“En dan staat de hele vragenlijst er weer, op dezelfde manier. Overal hetzelfde beeld — anders ga ik zoeken welk scherm de echte antwoorden laat zien.”'));
K(zeg('“Wat van deze mensen vandaag om een besluit vraagt, stond net in Opvolgen. Hier staan ze allemaal — ook degenen bij wie niets aan de hand is.”'));

// ── 8
K(h1('8 · Afronden — en de zin waarmee je eindigt'));
K(doe('Klik op **Afronden**.'));
K(zeg('“Wat blijft er liggen, wat is er automatisch gedaan, en waar sta ik voor in.”'));
K(p('En dan terug naar waar je begon:'));
K(zeg('“Eén systeem. Ik zag mijn werk op volgorde van tijd: wat over een week misgaat, wat vandaag binnenkomt, wie ik nu spreek. Ik zag wat de patiënt zelf heeft opgeschreven, ik kon het met één klik in mijn dossier zetten — als patiëntgegeven, niet stiekem als mijn eigen registratie — en ik kon het daarna in het journaal terugvinden als precies dat. En bijna de helft van het logistieke werk was al gedaan voordat ik inlogde.”'));

// ── Uitstapjes
K(h1('Als er tijd over is'));
K(p('Drie uitstapjes van een minuut, in volgorde van indruk.'));
K(p('**Acuut.** Er is inmiddels een melding binnengekomen. Klik op **Acuut** in de linkerbalk. Je ziet wie hem oppakt, of dat niemand hem heeft opgepakt. *“Acute zaken moeten zich opdringen, niet in een lijstje wachten tot iemand kijkt.”*'));
K(p('**Medicatie aanpassen.** In een dossier: **Medicatie aanpassen**. Er schuift rechts een paneel open. Stoppen van het oude middel, starten van het nieuwe, recept naar de gekozen apotheek — één handeling, niet vier losse. *“En je kiest waar het recept heen gaat.”*'));
K(p('**Berichten.** Onderscheid tussen collega’s onderling en het contact met de patiënt. *“Contact met een patiënt is zorg, geen mailtje. Het staat in het dossier en het is declarabel.”*'));
K(p('**Het protocol aanpassen.** Klik onder **Praktijk** op **Het protocol**. Bij HbA1c staat *7 dagen vooraf* met eronder *richtlijn: 5 dagen vooraf*, en daaronder de reden. Klik op **Aanpassen** bij een willekeurige meting.'));
K(zeg('“Elke praktijk wijkt af van de richtlijn, en meestal met goede redenen. Nu zit dat in hoofden en in werkafspraken. Hier staat het in het systeem — met de richtlijn ernaast, met een naam en een datum, en met een reden die verplicht is. Zonder die reden is een afwijking over een half jaar niet te onderscheiden van een vergissing.”'));
K(zeg('“En het is niet alleen de manager die dit mag. Ik draai het spreekuur, dus ik weet als eerste dat het prikpunt traag is. Wat ik hier verander, werkt meteen door in ieders zorgplan en in de aanloop.”'));

// ── Spiekbriefje
K(h1('Spiekbriefje'));
K(p('Getallen die kloppen bij een verse demo, op het moment dat je inlogt.'));
K(tabel(
  [{ titel: 'Waar', breedte: 2600 }, { titel: 'Wat', breedte: BREEDTE - 2600 }],
  [
    ['Tegels', 'Aanloop 12 (2) · Spreekuur 9 (4) · Opvolgen 14 (2) · Afronden 3 (0)'],
    ['Agenda', '12 items · 3 afgerond · 1 niet verschenen · 1 aangemeld'],
    ['Automatisering', '49% · 19× labaanvraag · 21× vragenlijst · 42 punten blijven bij jou'],
    ['Eerste aandacht', 'Willem Hendriks (thuisbloeddruk 160) · Ruud Mulder (eGFR 40)'],
    ['Opvolgen · aanleidingen', '5 labuitslagen · 5 vragenlijsten · 3 thuismetingen · 1 uit het beloop'],
    ['Mijn cohort', '23 gevolgd · 7 met een signaal · 16 stabiel'],
    ['Protocol', '8 aandachtsgebieden · 3 afwijkingen van de richtlijn'],
    ['Werkblokken', 'terugbellen · voorbereiding · uitslagen · administratie · overleg · pauze'],
    ['Aanloop · verzetten', 'Fatima Bos, over 4 dagen'],
    ['Aanloop · bellen', 'Greetje de Vries, over 6 dagen'],
    ['Nu aan de beurt', 'Anneke Bos, 10:40 — cijfer 4, geldzorgen, haalt medicijnen niet op'],
    ['Praktijk', '48 patiënten'],
  ],
));
K(leeg(180));
K(p('**De acute meldingen, op volgorde van binnenkomst:**'));
K(tabel(
  [
    { titel: 'Na', breedte: 900 },
    { titel: 'Patiënt', breedte: 2600 },
    { titel: 'Wat', breedte: 3600 },
    { titel: 'Voor wie', breedte: BREEDTE - 7100 },
  ],
  [
    ['0 s', 'Dirk Mulder (83)', 'pijn op de borst — **spoed, modaal**', 'huisarts, assistent'],
    ['40 s', 'Piet de Vries (72)', 'benauwder, pufjes helpen minder', 'huisarts, **POH**, assistent'],
    ['95 s', 'Greetje de Boer (76)', 'thuismeter 212/118', 'huisarts, **POH**'],
    ['150 s', 'Youssef de Boer', 'kalium 6,2', 'huisarts'],
  ],
));

// ── Reservepatiënten
K(h1('Twee patiënten om achter de hand te houden'));
K(p('Als iemand vraagt om een rijker dossier, gebruik deze twee. De rest van de 48 is niet overal even diep gevuld.'));
K(p('**Piet de Vries, 72, om 14:10.** COPD en nierfunctie. Zijn eGFR van 39 staat binnen vóór het consult, zijn CCQ loopt op van 0,8 naar 1,2, en in zijn vragenlijst vraagt hij zelf: *“Ik slik nu zes verschillende pillen. Kan daar iets af?”* In zijn journaal staat een ziekenhuisbericht over een opname, binnengekomen als BgZ. Goed voor het verhaal over medicatiebeoordeling en over externe informatie in dezelfde tijdlijn.'));
K(p('**Gerrit Smit, 62, om 09:40.** HbA1c 78 — het enige urgente signaal van de ochtend — met een eGFR van 36 ernaast. Goed voor het verhaal dat twee aandoeningen elkaars behandeling in de weg zitten en dat het protocol dat ziet.'));

// ── Valkuilen
K(h1('Wat je beter niet doet'));
K(p('**Open geen willekeurig dossier via het zoekveld.** Neem iemand uit de agenda, uit Monitoren of uit de twee hierboven.'));
K(p('**Beloof geen koppelingen.** Er is geen LSP, geen ZorgDomein, geen G-Standaard en geen receptverkeer. De velden en het werkproces zijn er; de transportlaag niet. Het eerlijkste antwoord is: *“de order heeft een bestemming en een route — wat eronder zit is een koppeling die we nog moeten bouwen.”*'));
K(p('**Ga niet alle vier de tegels uitputtend af.** Aanloop, Spreekuur en Opvolgen dragen het verhaal. Afronden is de afsluiting, niet het middenstuk.'));
K(p('**Klik de videobelknop niet aan alsof er beeld komt.** Hij opent een venster dat het werkproces toont en zet geen verbinding op. Dat is expres, en dat is ook het antwoord.'));
K(p('**Reset tussen twee demo’s door.** Als je in de vorige ronde medicatie hebt gewijzigd of een consult hebt vastgelegd, staat dat er nog. **Demo herstellen** zet alles terug.'));

// ── Document ────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Cadans',
  title: 'Cadans — het demonstratiescript',
  description: 'Uitgeschreven demonstratieroute door Cadans vanuit de werkplek van de praktijkondersteuner.',
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
