/**
 * DE ONTWIKKELAGENDA ALS WORD-DOCUMENT
 *
 * docs/22-ontwikkelagenda-voor-his-leveranciers.md is de bron; dit script maakt er de
 * versie van die een zorggroep meeneemt naar de HIS-leverancier.
 *
 * Anders dan bij het demonstratiescript wordt de inhoud hier wél uit de markdown gelezen.
 * Dat verschil is opzettelijk. Het demoscript heeft op papier een andere indeling nodig
 * dan op het scherm — wat je zegt krijgt een kader, wat je klikt een pijl — en die
 * vertaling kost meer dan hij oplevert als je hem automatiseert. Dit document is gewoon
 * een document: koppen, alinea's, tabellen. Eén bron, dus geen twee versies die uit
 * elkaar lopen.
 *
 * Draaien:
 *
 *     npm run agenda
 */

const fs = require('node:fs');
const {
  MERK, INK, INK_2, BREEDTE,
  p, h1, h2, zeg, bullet, leeg, tabel, schrijf, runs,
  Paragraph, TextRun, BorderStyle,
} = require('./docx-vormtaal.cjs');

const BRON = process.argv[3] ?? 'docs/22-ontwikkelagenda-voor-his-leveranciers.md';
const regels = fs.readFileSync(BRON, 'utf8').split('\n');

const inhoud = [];
const K = (...args) => inhoud.push(...args);

/** Een label op een eigen regel: **De vraag aan tafel**. Kort, petrol, boven het blok. */
const label = (tekst) => new Paragraph({
  children: [new TextRun({ text: tekst, bold: true, size: 20, color: MERK, font: 'Calibri' })],
  spacing: { before: 220, after: 70 },
});

/**
 * Kolombreedtes naar rato van de langste cel.
 *
 * Een tabel met vaste kolommen laat 'Nu' evenveel ruimte innemen als een hele zin, en
 * dan valt de leesbare kolom weg tegen de smalle. Een minimum voorkomt dat een kolom met
 * één woord onleesbaar smal wordt.
 */
function breedtes(rijen) {
  const kolommen = rijen[0].length;
  const gewicht = Array.from({ length: kolommen }, (_, i) =>
    Math.max(6, ...rijen.map((r) => (r[i] ?? '').length)));
  const totaal = gewicht.reduce((s, g) => s + g, 0);
  const uit = gewicht.map((g) => Math.round((g / totaal) * BREEDTE));
  // Afrondingsverschil op de laatste kolom, anders loopt de tabel een haar over de marge.
  uit[kolommen - 1] += BREEDTE - uit.reduce((s, b) => s + b, 0);
  return uit;
}

const cellen = (regel) => regel.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

let i = 0;
let eersteKop = true;
while (i < regels.length) {
  const regel = regels[i];
  const kaal = regel.trim();

  if (kaal === '') { i += 1; continue; }

  // Scheidingslijn tussen categorieën: witruimte, geen streep. Een streep over de volle
  // breedte hakt een handout in stukken die je juist achter elkaar wilt lezen.
  if (/^---+$/.test(kaal)) { K(leeg(220)); i += 1; continue; }

  if (kaal.startsWith('#')) {
    const niveau = kaal.match(/^#+/)[0].length;
    const tekst = kaal.replace(/^#+\s*/, '');
    if (eersteKop && niveau === 1) {
      // Titelblok: merknaam klein erboven, titel groot, streep eronder.
      K(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: 'Cadans', bold: true, size: 26, color: MERK, font: 'Calibri' })],
      }));
      K(new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({
          text: tekst.replace(/^\d+\s*—\s*/, ''),
          bold: true, size: 40, color: INK, font: 'Calibri',
        })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: MERK, space: 8 } },
      }));
      eersteKop = false;
    } else if (niveau <= 2) {
      K(h1(tekst));
    } else {
      K(h2(tekst));
    }
    i += 1;
    continue;
  }

  // Tabel: een regel met pijpen, gevolgd door een scheidingsregel.
  if (kaal.startsWith('|') && (regels[i + 1] ?? '').trim().startsWith('|--')) {
    const kop = cellen(kaal);
    i += 2;
    const rijen = [];
    while (i < regels.length && regels[i].trim().startsWith('|')) {
      rijen.push(cellen(regels[i].trim()));
      i += 1;
    }
    const koppen = kop.some((k) => k !== '');
    const maten = breedtes(koppen ? [kop, ...rijen] : rijen);
    K(leeg(60));
    K(tabel(kop.map((titel, k) => ({ titel, breedte: maten[k] })), rijen, { koppen }));
    K(leeg(160));
    continue;
  }

  if (kaal.startsWith('> ')) {
    // Alle aaneengesloten citaatregels vormen één kader.
    const stukken = [];
    while (i < regels.length && regels[i].trim().startsWith('>')) {
      stukken.push(regels[i].trim().replace(/^>\s?/, ''));
      i += 1;
    }
    K(zeg(stukken.join(' ').trim()));
    continue;
  }

  if (/^[-*]\s/.test(kaal)) {
    // Een opsommingspunt loopt door tot de volgende lege regel of het volgende punt.
    const stukken = [kaal.replace(/^[-*]\s+/, '')];
    i += 1;
    while (i < regels.length && regels[i].startsWith('  ') && regels[i].trim() !== '') {
      stukken.push(regels[i].trim());
      i += 1;
    }
    K(bullet(stukken.join(' ')));
    continue;
  }

  if (/^\d+\.\s/.test(kaal)) {
    // Genummerd, met het cijfer in de merkkleur. Geen bolletje ervoor: een opsommingsteken
    // naast een nummer laat de lezer twee keer hetzelfde zien.
    const [, cijfer, rest] = kaal.match(/^(\d+)\.\s+(.*)$/);
    K(new Paragraph({
      children: [
        new TextRun({ text: `${cijfer}.  `, bold: true, size: 21, color: MERK, font: 'Calibri' }),
        ...runs(rest),
      ],
      spacing: { after: 80, line: 276 },
      indent: { left: 420, hanging: 220 },
    }));
    i += 1;
    continue;
  }

  // Een regel die helemaal vet is, is een label boven een blok en geen alinea.
  if (/^\*\*[^*]+\*\*$/.test(kaal)) {
    K(label(kaal.slice(2, -2)));
    i += 1;
    continue;
  }

  // Gewone alinea: doorlopen tot de volgende lege regel, en de regelafbrekingen uit de
  // markdown weggooien — die zijn er voor de broncode, niet voor de lezer.
  const stukken = [];
  while (i < regels.length) {
    const r = regels[i].trim();
    if (r === '' || r.startsWith('#') || r.startsWith('|') || r.startsWith('>')
      || /^[-*]\s/.test(r) || /^---+$/.test(r) || /^\d+\.\s/.test(r)) break;
    stukken.push(r);
    i += 1;
  }
  const alinea = stukken.join(' ');
  // Een cursieve regel die met een aanhalingsteken begint, is een zin om uit te spreken —
  // de openingsvraag van een categorie. Die krijgt het kader, net als in het demoscript.
  if (/^\*[“"']/.test(alinea) && /^\*[^*].*[^*]\*$/.test(alinea)) {
    K(zeg(alinea.slice(1, -1)));
    continue;
  }
  const helemaalCursief = /^\*[^*].*[^*]\*$/.test(alinea);
  K(p(alinea, helemaalCursief ? { color: INK_2 } : {}));
}

schrijf({
  inhoud,
  titel: 'Cadans — ontwikkelagenda voor het gesprek met HIS-leveranciers',
  omschrijving: 'Bronmateriaal voor de praatplaat waarmee zorggroepen het gesprek aangaan '
    + 'met hun HIS-leverancier over geïntegreerde chronische zorg.',
  onderschrift: 'Cadans · ontwikkelagenda',
  doel: process.argv[2] ?? 'Cadans-ontwikkelagenda.docx',
});
