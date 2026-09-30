/**
 * DE VORMTAAL VAN DE WORD-DOCUMENTEN
 *
 * Cadans levert twee documenten op papier af — het demonstratiescript en de
 * ontwikkelagenda — en die horen er hetzelfde uit te zien. Een handout in een ander
 * lettertype dan het script waar hij bij hoort, leest als materiaal van twee partijen.
 *
 * Wat hier staat is uitsluitend vorm: kleuren, koppen, kaders, tabellen, de
 * paginaopmaak. De inhoud staat in de scripts die dit bestand gebruiken.
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

/**
 * Het document zelf: A4 staand, marges, voettekst met paginanummer.
 *
 * `onderschrift` staat links in de voet; het paginanummer staat rechts. Zo weet je bij
 * een losgeraakt vel altijd nog waar het bij hoort.
 */
function schrijf({ inhoud, titel, omschrijving, onderschrift, doel }) {
  const doc = new Document({
    creator: 'Cadans',
    title: titel,
    description: omschrijving,
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
              new TextRun({ text: `${onderschrift} · `, size: 16, color: INK_2, font: 'Calibri' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: INK_2, font: 'Calibri' }),
            ],
          })],
        }),
      },
      children: inhoud,
    }],
  });

  return Packer.toBuffer(doc).then((buf) => {
    fs.writeFileSync(doel, buf);
    console.log(`geschreven: ${doel} (${buf.length} bytes)`);
  });
}

module.exports = {
  MERK, MERK_ZACHT, INK, INK_2, LIJN, PAPIER, BREEDTE,
  runs, p, h1, h2, zeg, doe, bullet, leeg, tabel, kader, schrijf,
  Paragraph, TextRun, BorderStyle, ShadingType,
};
