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
K(p('Eén route door Cadans, vanuit de stoel van de praktijkondersteuner. Twintig minuten, dertien stappen, één verhaal — van het werk dat volgende week misgaat tot het gesprek dat je zojuist hebt gevoerd. Bedoeld om uit je hoofd te doen, niet om aan je publiek te geven.',
  { italics: true, color: INK_2, na: 220 }));

K(tabel(
  [{ titel: '', breedte: 2100 }, { titel: '', breedte: BREEDTE - 2100 }],
  [
    ['**Duur**', '12 minuten voor de korte route (§1–5, 7, 13); 20 voor de hele lijn'],
    ['**Account**', '`sanne` (POH-Somatiek) · wachtwoord `cadans` · code `123456`'],
    ['**Reset**', '**Demo herstellen** rechtsboven zet alles terug naar de beginstand'],
  ],
  { koppen: false },
));
K(leeg(200));

// ── Voor je begint
K(h1('Voor je begint'));
K(p('**De klok staat stil op 10:20.** De demopraktijk staat altijd halverwege de ochtend: drie consulten zijn geweest, één patiënt is niet komen opdagen, één zit in de wachtkamer. Dat hangt niet af van het tijdstip waarop jij demonstreert. De dátum loopt wel mee, dus leeftijden, intervallen en “over vier dagen” kloppen altijd met vandaag.'));
K(p('**Er komen acute meldingen binnen** na 0, 40, 95 en 150 seconden. Dat is geen effect maar het punt van die functie: er komt iets binnen terwijl je met iets anders bezig bent. Log in en begin meteen te praten.'));
K(p('**De namen in dit script komen uit de demopopulatie en kunnen verschuiven.** De pósities niet: bovenaan de aanloop staat altijd de afspraak die verzet moet worden, en om 10:40 staat altijd degene die zo binnenkomt. Staat er een andere naam, lees dan de naam die er staat.'));
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
K(p('En één zin die de hele demo bij elkaar houdt:'));
K(zeg('“Elk scherm dat iets signaleert, levert ook werk op dat je kunt uitzetten, inplannen en afronden. Anders is het een lijstje.”'));

// ── 1
K(h1('1 · Inloggen — dit is mijn overzicht'));
K(doe('Log in als `sanne`.'));
K(zeg('“Ik log in en ik kom niet in een zoekscherm. Ik kom in mijn dag.”'));
K(p('Wijs drie dingen aan, meer niet:'));
K(bullet('**Links staat mijn werk.** Dagstart, Acuut, Aanloop, Spreekuur, Opvolgen, Groepsconsulten, Overleg, Afronden. Dat is geen menu van het systeem maar mijn werkproces. De huisarts ziet hier andere ingangen — autoriseren, het team — en de assistent weer andere. Eén dossier, verschillende werkplekken.'));
K(bullet('**Rechts staat wat het systeem vandaag al heeft gedaan.** 16 labaanvragen klaargezet vóór het contact, 18 vragenlijsten uitgezet. Daar is niemand aan te pas gekomen.'));
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
K(p('Bovenaan staat de afspraak **over vier dagen**, met de melding **Verzetten**.'));
K(zeg('“Zij komt maandag, en het bloed is niet geprikt. Prikken en de uitslag terugkrijgen kost vijf dagen. Dus dat consult gaat over niets: twintig minuten, en daarna moet ze terugkomen. Het systeem zegt niet ‘er ontbreekt iets’ — het zegt: verzet deze afspraak.”'));
K(p('Wijs de merkjes onder het advies aan.'));
K(zeg('“En let op het verschil binnen diezelfde regel. Het lab lukt niet meer, dat kost vijf dagen. De vragenlijst kan nog wel, die kan tot de avond ervoor. Dus de reden om te verzetten is het bloedonderzoek en niet de vragenlijst. Die doorlooptijden zijn geen aanname van ons: ze staan in het protocol, en de praktijk kan ze aanpassen als het prikpunt hier trager is.”'));
K(p('Daaronder staat de afspraak **over zes dagen**, met de melding **Bellen**.'));
K(zeg('“Precies hetzelfde feit — niet geprikt — maar er zijn nog zes dagen. Dan is bellen de juiste actie, niet verzetten. Hetzelfde signaal, een ander advies, omdat de tijd anders ligt.”'));
K(doe('Klik bij die regel op **Bellen en herinneren**.'));
K(zeg('“En hier zit de tussenstap die in de meeste systemen ontbreekt. Er opent een paneel, net als bij het bestellen van een order, en de vraag is: wie doet dit? Bellen dat de uitslag ontbreekt kan de assistent prima. Een uitslag bespreken niet — dus die rol staat er bij dat soort werk ook niet bij.”'));
K(doe('Kies deze keer **de praktijkondersteuner** — jezelf.'));
K(zeg('“Ik pak hem zelf op. Let op: ‘de praktijkondersteuner’ en ‘Sanne Bakker’ staan er allebei, en dat is geen dubbeling. Een taak voor de rol kan door iedereen worden opgepakt die er die dag is; een taak op naam niet. Dat verschil maakt of werk blijft liggen omdat iedereen dacht dat een ander het deed.”'));
K(doe('Klik op **Uitzetten**.'));
K(zeg('“En nu verandert de regel van stand: ‘opgepakt, ligt bij de praktijkondersteuner’. Hij blijft niet schreeuwen terwijl er iemand mee bezig is — dat is precies waarom mensen zulke lijsten gaan negeren.”'));

// ── 4
K(h1('4 · Plannen — en wat er in de gaten hoort'));
K(doe('Klik onder **Praktijk** op **Plannen**.'));
K(zeg('“Links staat mijn eigen werklijst: wat er bij mij is neergelegd, met de aanleiding erbij. Rechts staan alle drie de agenda’s naast elkaar, want ‘past dit bij mij of bij de huisarts’ is de eerste vraag en niet de laatste.”'));
K(doe('Sleep de taak naar een vrije plek van twintig minuten in je eigen kolom. Klikken werkt ook: selecteer links, klik rechts.'));
K(zeg('“En dan staat het in mijn agenda, met de reden zichtbaar. Want terugbellen is geen tussendoortje, het kost tien minuten.”'));
K(doe('Zet daaronder via **Eigen werk inplannen** een blok **Uitslagen nalopen** in een vrije plek.'));
K(zeg('“Dit miste ik het meest. Mijn agenda kende alleen patiënten. Maar uitslagen nalopen en administratie kosten evenveel tijd als een consult, en als die tijd er niet in staat, ziet mijn dag er voor de buitenwereld leeg uit terwijl hij vol zit. En omdat het blok er staat, plant de assistent er geen consult overheen.”'));

// ── 5
K(h1('5 · Het blok openen — wat komt er bij deze mens tekort?'));
K(p('**Dit is het scherm waar de demo om draait.**'));
K(doe('Klik op het blok dat je zojuist hebt ingepland.'));
K(zeg('“En hier zat tot voor kort het gat. Ik had het ingepland, ik klikte erop, en dan stond er precies wat ik er zelf in had getypt. Terwijl de vraag op dát moment een andere is: wat komt er bij deze mens eigenlijk nog tekort?”'));
K(p('Loop van boven naar beneden:'));
K(bullet('**Wat komt er nog tekort.** Per onderdeel: binnen, nog niet binnen, of te laat — met erbij hoeveel dagen het kost en hoeveel er nog zijn.'));
K(bullet('**De afspraak.** Datum, tijd, hoeveel dagen, en het advies van de aanloop.'));
K(bullet('**Wat er verder speelt.** De signalen uit het dossier, zodat je niet belt over lab terwijl er iets anders is.'));
K(bullet('**Wat je wilt bereiken.** Drie zinnen: wat je zegt, in de volgorde waarin je het zegt.'));
K(bullet('**Hoe je hem bereikt.** Het nummer, wat zijn voorkeur is, wat de praktijk over zijn bereikbaarheid heeft geleerd, en wie er gebeld mag worden als hij het zelf niet redt — met daarbij wát die naaste mag horen.'));
K(zeg('“Dit stond allemaal al in het systeem. In de aanloop, in het zorgplan, in de signalen, in het dossier. Alleen op vier plekken, en ik zat op de vijfde. Nu staat het bij elkaar op het moment dat ik de telefoon pak.”'));
K(zeg('“En let op die laatste regel: informeren is iets anders dan meebeslissen. Dat onderscheid staat hier expliciet, want de assistent die belt moet het weten.”'));

// ── 6
K(h1('6 · Bellen — en het gesprek vastleggen als contact'));
K(doe('Klik op **Bellen en vastleggen** en kies het 06-nummer.'));
K(zeg('“In de demo belt er niets; in productie belt mijn toestel en loopt de teller mee. Maar het gaat me om wat daarna gebeurt.”'));
K(p('Er verschijnen twee velden.'));
K(bullet('**Wat is er gezegd?** — *“Patiënt gesproken; hij gaat vrijdag prikken.”*'));
K(bullet('**Wat is er afgesproken?** — *“Afspraak van maandag blijft staan.”*'));
K(zeg('“Een telefoontje zonder notitie is een belpoging. Dit is het verschil: wat er gezegd is komt onder de S, wat er is afgesproken onder de P. Twee velden, want bij een telefoontje is dat precies wat ertoe doet en meer niet.”'));
K(doe('Kies de episode en klik op **Gesprek vastleggen als contact**.'));
K(zeg('“En nu gebeuren er drie dingen tegelijk.”'));
K(bullet('**Er staat een journaalregel klaar** — zichtbaar in het venster, met de SOEP eronder.'));
K(bullet('**Er staat wat het administratief oplevert.** Een telefonisch consult is een eigen prestatie, met eigen voorwaarden.'));
K(bullet('**De taak is afgerond** en verdwijnt van de werklijst.'));
K(zeg('“En dat laatste is waar het om begon: dit systeem heeft me niet alleen verteld dat er iets misging. Het heeft me het werk gegeven, het heeft me geholpen het gesprek voor te bereiden, en het heeft het resultaat vastgelegd. Dat is de hele cirkel, in één scherm.”'));
K(doe('Open het dossier van deze patiënt en klik op **Journaal**.'));
K(zeg('“Een telefoontje is zorg. Als het niet in het dossier staat, heb je wel gewerkt maar niets geleverd — en belt je collega morgen opnieuw.”'));

// ── 7
K(h1('7 · Spreekuur — wat de patiënt zelf heeft opgeschreven'));
K(doe('Klik op **Spreekuur**. Bovenaan staat de afspraak van **10:40** — zij is aangemeld en komt zo binnen.'));
K(zeg('“Dit is wat ik zie vlak voordat ik iemand binnenroep. Niet de avond ervoor in één ruk, maar op het moment dat het nodig is.”'));
K(p('**Wijs eerst aan wat er níét staat.** Er staat nergens ‘nog bloed prikken’.'));
K(zeg('“Bij wie vandaag komt, is dat allang geregeld. Dat is de aanloop geweest. Wat hier nog openstaat, zijn de dingen die ik zo meteen zelf doe.”'));
K(p('**Dan de vragenlijst.** Die staat bovenaan de kaart, vóór de meetwaarden.'));
K(zeg('“Dit is de consultvoorbereidende vragenlijst uit de stedelijke werkwijze. Die heeft ze een paar dagen geleden via het portaal ingevuld. En dit is wat ik nu al weet, voordat ze binnen is.”'));
K(p('Lees hardop voor wat er staat:'));
K(bullet('**Ze geeft haar gezondheid en haar leven een laag cijfer.**'));
K(bullet('**“Ik red het niet meer met de eigen bijdrage van de medicijnen. Ik haal ze soms niet op.”** — dat schreef ze zelf op bij *is er iets waar je over wil praten*.'));
K(bullet('Ze heeft stress, slaapt slecht, en heeft niemand in haar omgeving die kan helpen.'));
K(zeg('“Een consult over haar bloeddruk zou hier volledig langsheen gaan. Ze haalt haar medicijnen niet op. Dat is geen sociale bijzaak — dat is de reden dat de behandeling niet werkt.”'));
K(doe('Klik op **Hele vragenlijst bekijken**.'));
K(zeg('“En ik kan de hele lijst gewoon teruglezen zoals zij hem gekregen heeft. Vraag voor vraag, in haar woorden. Geen samenvatting waarvan ik moet geloven dat hij klopt.”'));

// ── 8
K(h1('8 · Het consult — overnemen, en terugvinden in het journaal'));
K(doe('Klik op **Open consultscherm** en dan op de tab **Consult**.'));
K(p('De vragenlijst staat er weer, nu met een knop.'));
K(zeg('“En dan het stuk waar het mij om gaat. Ik wil dit niet overtypen.”'));
K(doe('Klik op **Overnemen in mijn dossier** en wijs het **S**-veld aan.'));
K(zeg('“Het staat onder de S van de SOEP. Dat is geen technische keuze: de S is wat de patiënt aangeeft, en dit ís wat de patiënt aangeeft. In haar eigen woorden, met de datum en het kanaal erbij.”'));
K(zeg('“Let op het verschil. De antwoorden stonden er al — daar was geen handeling voor nodig. Wat er nu gebeurt is dat ik ze aanvaard. Vanaf dit moment staat de praktijk ervoor in, en er staat bij wie dat gedaan heeft. Wat de patiënt zelf doorgeeft is echt en bruikbaar, maar het is geen registratie van de praktijk tot iemand dat zegt.”'));
K(zeg('“Anders declareer je werk dat een ander gedaan heeft.”'));
K(doe('Klik op de tab **Journaal**.'));
K(zeg('“En hier staat hij terug. Niet als tekst die in een consult is geplakt, maar als eigen regel op de dag dat zíj hem invulde. Met erbij dat ik hem zojuist heb overgenomen, met mijn naam en de datum.”'));
K(doe('Wijs de filterrij boven de tijdlijn aan, en links het blok **Van de patiënt zelf**.'));
K(zeg('“Het journaal laat alles zien — dat is het punt van één tijdlijn. Maar bij iemand die elke dag zijn bloeddruk doorgeeft wil je ook even zonder die metingen kunnen kijken. Dus ik kan soorten uitzetten, en wat ik heb weggeklikt blijft zichtbaar als doorgestreept merkje: ik moet kunnen zien waarom de lijst korter is.”'));
K(doe('Klik op **Alleen wat de patiënt aanleverde**.'));
K(zeg('“En dit is de vraag die ik nu nooit kan stellen: laat me eens alles zien wat deze mens zélf heeft doorgegeven. Thuismetingen, vragenlijsten, de voorbereiding uit de wachtkamer — over alle episodes heen.”'));

// ── 9
K(h1('9 · Opvolgen — wat vandaag al af kan'));
K(doe('Klik op **Opvolgen**.'));
K(zeg('“Dit blok zat er eerst niet in, en dat was de grootste blinde vlek. Hier staat wat er is binnengekomen bij mensen die vandaag géén afspraak hebben. Veertien dingen, uit vier bronnen: labuitslagen, vragenlijsten, thuismetingen en het beloop zelf.”'));
K(p('Loop de eerste drie langs:'));
K(bullet('**Een thuisbloeddruk van gemiddeld 160 over zes metingen.** *“Hij meet thuis. Dat is inhoudelijk beter dan mijn meting hier: geen wittejasseneffect en een reeks in plaats van één moment. In de meeste systemen blijft dat een berichtje in de postbus. Hier is het een reeks met een gemiddelde en een voorstel.”*'));
K(bullet('**Een HbA1c die buiten de streefwaarde ligt.** *“Die uitslag kwam binnen op mijn eigen aanvraag — dat staat erbij, want een uitslag die je zelf hebt aangevraagd is iets anders dan informatie die je krijgt toegestuurd.”*'));
K(bullet('**Een zin uit de jaarlijkse screening.** *“Geen meetwaarde, gewoon wat iemand opschreef. En die zin verandert soms meer aan mijn dag dan een getal.”*'));
K(zeg('“Voor geen van deze drie is een consult nodig. Een bericht, een aangepast recept, een telefoontje. Zonder dit blok wachten ze tot de afspraak die toevallig in de agenda staat.”'));
K(doe('Zet bij één regel een taak uit.'));
K(zeg('“En ook hier geldt: elk besluit levert werk op dat ergens landt. Dezelfde route als in de aanloop, hetzelfde paneel.”'));

// ── 10
K(h1('10 · Groepsconsult — één bijeenkomst, acht dossiers'));
K(doe('Klik op **Groepsconsulten** en open **Leven met diabetes**, over twee weken.'));
K(zeg('“Een deel van de chronische zorg is beter in een groep dan in een spreekkamer. Acht mensen die samen leren koolhydraten herkennen, halen meer uit dat uur dan acht keer tien minuten — en ze halen er iets uit wat een individueel consult niet kan geven: elkaar.”'));
K(zeg('“Systemen ondersteunen dit vrijwel nooit, en dat is niet toevallig. Een agenda die is gebouwd rond ‘één tijdslot, één patiënt’ kan een blok met acht mensen niet weergeven. Het gevolg is een Excel naast het systeem.”'));
K(doe('Wijs **Wie past hierbij** aan.'));
K(zeg('“En het systeem stelt voor wie erbij hoort, met de onderbouwing erbij. Wie een groepsconsult plant, wil niet zelf 48 dossiers doorzoeken — en een voorstel zonder reden is een willekeurige lijst.”'));
K(doe('Klik op **Groepsconsult starten**.'));
K(zeg('“En nu begint het echte werk, want na afloop moet er voor acht mensen iets in acht dossiers. In de praktijk gebeurt dat achteraf uit het hoofd, of helemaal niet.”'));
K(doe('Typ bij één deelnemer een korte notitie en klik op **In het dossier**.'));
K(zeg('“Per deelnemer een paar regels, tijdens de bijeenkomst. Die landen als contact in het dossier van díe mens — en nergens anders. Het consult is gezamenlijk, het dossier niet.”'));
K(doe('Open het dossier van die deelnemer en laat het journaal zien.'));
K(zeg('“Daar staat het, met het thema als aanleiding. En let op wat er níét staat: dit is geen los consult dat per deelnemer wordt gedeclareerd. Een groepsconsult wordt binnen de keten afgesproken. Het systeem zegt dat er ook bij, in plaats van net te doen alsof.”'));

// ── 11
K(h1('11 · Mijn cohort — en wie juist niet hoeft te komen'));
K(doe('Klik onder **Praktijk** op **Mijn cohort**. 24 mensen, 10 met een signaal, de rest stabiel.'));
K(zeg('“Dit is geen werklijst maar een overzicht. Veertien mensen hoeven niets. Dat is ook een uitkomst, en het scheelt veertien oproepen.”'));
K(p('Wijs bij een paar mensen de regel in cursief aan, onder het signaal.'));
K(zeg('“En ook hier staat wat ze zelf hebben opgeschreven. ‘De plek op mijn buik waar ik prik voelt hard en bobbelig aan.’ Die zin verandert meer aan mijn dag dan een HbA1c van 67.”'));

// ── 12
K(h1('12 · Het protocol — en dat ik het zelf mag aanpassen'));
K(doe('Klik onder **Praktijk** op **Het protocol**. Acht aandachtsgebieden, drie afwijkingen van de richtlijn.'));
K(p('Bij HbA1c staat *7 dagen vooraf* met eronder *richtlijn: 5 dagen vooraf*, en daaronder de reden: *“Het prikpunt verwerkt maar twee keer per week.”*'));
K(doe('Klik op **Aanpassen** bij een willekeurige meting en verander een doorlooptijd.'));
K(zeg('“Elke praktijk wijkt af van de richtlijn, en meestal met goede redenen. Nu zit dat in hoofden en in werkafspraken. Hier staat het in het systeem — met de richtlijn ernaast, met een naam en een datum, en met een reden die verplicht is. Zonder die reden is een afwijking over een half jaar niet te onderscheiden van een vergissing.”'));
K(zeg('“En het is niet alleen de manager die dit mag. Ik draai het spreekuur, dus ik weet als eerste dat het prikpunt traag is.”'));
K(doe('Ga terug naar **Aanloop**.'));
K(zeg('“En kijk: de adviezen zijn veranderd. Wat ik zojuist in het protocol aanpaste, werkt meteen door in ieders zorgplan en in dit blok. Geen nachtelijke batch, geen tweede systeem.”'));

// ── 13
K(h1('13 · Afronden — en de zin waarmee je eindigt'));
K(doe('Klik op **Afronden**.'));
K(zeg('“Wat blijft er liggen, wat is er automatisch gedaan, en waar sta ik voor in.”'));
K(p('En dan terug naar waar je begon:'));
K(zeg('“Eén systeem. Ik zag mijn werk op volgorde van tijd: wat over een week misgaat, wat vandaag binnenkomt, wie ik nu spreek. Elk van die schermen gaf me niet alleen een signaal maar ook werk — dat ik kon uitzetten, inplannen, voorbereiden en afronden. Ik zag wat de patiënt zelf heeft opgeschreven en kon het met één klik overnemen, als patiëntgegeven en niet stiekem als mijn eigen registratie. En bijna de helft van het logistieke werk was al gedaan voordat ik inlogde.”'));

// ── Uitstapjes
K(h1('Als er tijd over is'));
K(p('Vijf uitstapjes van een minuut, in volgorde van indruk:'));
K(h2('Acuut'));
K(p('Er is inmiddels een melding binnengekomen. Klik op **Acuut** in de linkerbalk. Je ziet wie hem oppakt, of dat niemand hem heeft opgepakt.'));
K(zeg('“Acute zaken moeten zich opdringen, niet in een lijstje wachten tot iemand kijkt.”'));
K(h2('De andere kant van de taak'));
K(p('Log uit en weer in als `ilse` (assistent). Op haar dagstart staat de taak die jij bij haar neerlegde, met wie hem uitzette en waarom. Doe dat in hetzelfde tabblad — anders kijk je in een tweede demo-omgeving.'));
K(zeg('“Dat is het verschil tussen een knop en een werkproces.”'));
K(h2('Medicatie aanpassen'));
K(p('In een dossier: **Medicatie aanpassen**. Er schuift rechts een paneel open. Stoppen van het oude middel, starten van het nieuwe, recept naar de gekozen apotheek — één handeling, niet vier losse.'));
K(zeg('“En je kiest waar het recept heen gaat.”'));
K(h2('Berichten'));
K(p('Onderscheid tussen collega’s onderling en het contact met de patiënt.'));
K(zeg('“Contact met een patiënt is zorg, geen mailtje. Het staat in het dossier en het is declarabel.”'));
K(h2('Rapporten'));
K(p('Onder **Praktijk**. Een zoekvraag over de hele praktijk, met de criteria zichtbaar.'));
K(zeg('“En wat eruit komt is geaggregeerd en geanonimiseerd. Een dossier is geen exportbestand.”'));

// ── Spiekbriefje
K(h1('Spiekbriefje'));
K(p('Getallen die kloppen bij een verse demo, op het moment dat je inlogt.'));
K(leeg(60));
K(tabel(
  [{ titel: 'Waar', breedte: 3100 }, { titel: 'Wat', breedte: BREEDTE - 3100 }],
  [
    ['Tegels', 'Aanloop 12 (2) · Spreekuur 10 (6) · Opvolgen 14 (2) · Afronden 3 (0)'],
    ['Agenda', '13 items · 3 afgerond · 1 niet verschenen · 1 aangemeld'],
    ['Automatisering', '44% · 18× vragenlijst · 16× labaanvraag'],
    ['Aanloop · verzetten', 'de bovenste regel, over 4 dagen — lab haalt het niet, de vragenlijst wel'],
    ['Aanloop · bellen', 'de tweede regel, over 6 dagen'],
    ['Nu aan de beurt', '10:40 — laag cijfer, geldzorgen, haalt medicijnen niet op'],
    ['Opvolgen · bronnen', '4 labuitslagen · 5 vragenlijsten · 2 thuismetingen · 3 uit het beloop'],
    ['Groepsconsulten', 'Leven met diabetes (5 van 10, over 2 weken) · Hart en vaten (leeg, over 4 weken)'],
    ['Mijn cohort', '24 gevolgd · 10 met een signaal'],
    ['Protocol', '8 aandachtsgebieden · 3 afwijkingen van de richtlijn'],
    ['Werkblokken', 'terugbellen · voorbereiding · uitslagen · administratie · overleg · pauze'],
    ['Taaksoorten', 'bellen · inplannen · voorbereiden · uitslag bespreken · bericht sturen · administratie'],
    ['Praktijk', '48 patiënten'],
  ],
));
K(leeg(160));
K(p('**De acute meldingen, op volgorde van binnenkomst:**'));
K(leeg(60));
K(tabel(
  [
    { titel: 'Na', breedte: 1000 },
    { titel: 'Wat', breedte: 5200 },
    { titel: 'Voor wie', breedte: BREEDTE - 6200 },
  ],
  [
    ['0 s', 'pijn op de borst — **spoed, modaal**', 'huisarts, assistent'],
    ['40 s', 'benauwder, pufjes helpen minder', 'huisarts, **POH**, assistent'],
    ['95 s', 'thuismeter 212/118', 'huisarts, **POH**'],
    ['150 s', 'kalium 6,2', 'huisarts'],
  ],
));
K(leeg(200));

// ── Wat je beter niet doet
K(h1('Wat je beter niet doet'));
K(p('**Open geen willekeurig dossier via het zoekveld.** Neem iemand uit de agenda, uit de aanloop of uit Opvolgen — die dossiers zijn het diepst gevuld.'));
K(p('**Beloof geen koppelingen.** Er is geen LSP, geen ZorgDomein, geen G-Standaard en geen receptverkeer. De velden en het werkproces zijn er; de transportlaag niet. Het eerlijkste antwoord is: *“de order heeft een bestemming en een route — wat eronder zit is een koppeling die we nog moeten bouwen.”*'));
K(p('**Ga niet alle tegels uitputtend af.** Aanloop, het taakblok en Spreekuur dragen het verhaal. Afronden is de afsluiting, niet het middenstuk.'));
K(p('**Klik de videobelknop niet aan alsof er beeld komt.** Hij opent een venster dat het werkproces toont en zet geen verbinding op. Dat is expres, en dat is ook het antwoord.'));
K(p('**Reset tussen twee demo’s door.** Als je in de vorige ronde een contact hebt vastgelegd of medicatie hebt gewijzigd, staat dat er nog. **Demo herstellen** zet alles terug.'));


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
