/**
 * Icoonset — bewust klein en eenduidig.
 *
 * Iconen dragen hier betekenis (welk aandachtsgebied, welke processtap) en zijn dus
 * nooit het enige signaal: er staat altijd tekst naast. Eén stijl: 16×16, lijnen van
 * 1.6, ronde uiteinden, currentColor. Zo blijft het rustig en zijn ze overal inzetbaar.
 */

const PADEN: Record<string, string[]> = {
  // Aandachtsgebieden
  druppel: ['M8 2.2s4 4.6 4 7.4a4 4 0 1 1-8 0c0-2.8 4-7.4 4-7.4z'],
  hart: ['M8 13.6S2.4 10 2.4 6.4A3 3 0 0 1 8 4.7a3 3 0 0 1 5.6 1.7C13.6 10 8 13.6 8 13.6z'],
  nier: ['M10.4 2.6c2 0 3.6 2.2 3.6 5.6s-1.6 5.4-3.6 5.4c-1.7 0-2.4-1.3-3.3-2.3C6 10.1 3.8 9.7 3.8 8S6 6 7.1 4.8c.9-1.1 1.6-2.2 3.3-2.2z', 'M10.6 6.2 8.9 8l1.7 1.8'],
  long: ['M8 2.4v5.8', 'M5.9 5.6C4.4 5.6 3 7.3 3 9.6c0 2.2 1 3.9 2.6 3.9 1.4 0 2.4-1 2.4-2.6V8.2', 'M10.1 5.6c1.5 0 2.9 1.7 2.9 4 0 2.2-1 3.9-2.6 3.9-1.4 0-2.4-1-2.4-2.6V8.2'],
  blad: ['M13.2 2.8c.4 6.2-3.6 9.6-8.2 9.6-.2-5.2 3-8.6 8.2-9.6z', 'M4.6 13.2c.2-2.4 1.6-4.6 3.6-6.2'],
  hoofd: ['M8 1.9a4.6 4.6 0 0 0-2.9 8.2v2.4c0 .7.6 1.3 1.3 1.3h3.2c.7 0 1.3-.6 1.3-1.3v-2.4A4.6 4.6 0 0 0 8 1.9z', 'M6.4 6.3c.6-.9 2.5-.9 3.1 0'],
  pil: ['M9.4 2.9a3.5 3.5 0 0 1 4.9 4.9l-6.4 6.4a3.5 3.5 0 0 1-4.9-4.9z', 'M6.2 6.1l4.9 4.9'],
  schild: ['M8 1.8l5.2 2v4.1c0 3.5-2.4 5.8-5.2 6.6-2.8-.8-5.2-3.1-5.2-6.6V3.8z'],

  // Processtappen
  zon: ['M8 3.2V1.6', 'M8 14.4v-1.6', 'M3.6 8H2', 'M14 8h-1.6', 'M4.9 4.9 3.8 3.8', 'M12.2 12.2l-1.1-1.1', 'M4.9 11.1l-1.1 1.1', 'M12.2 3.8l-1.1 1.1', 'M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z'],
  klembord: ['M6.2 2.6h3.6a.9.9 0 0 1 .9.9v.7H5.3v-.7a.9.9 0 0 1 .9-.9z', 'M5.3 4.2h-1a1.3 1.3 0 0 0-1.3 1.3v7.2a1.3 1.3 0 0 0 1.3 1.3h7.4a1.3 1.3 0 0 0 1.3-1.3V5.5a1.3 1.3 0 0 0-1.3-1.3h-1', 'M6 8.6h4', 'M6 11h2.6'],
  agenda: ['M3.4 4.2h9.2a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V5.2a1 1 0 0 1 1-1z', 'M5.4 2.4v3', 'M10.6 2.4v3', 'M2.4 7.4h11.2'],
  radar: ['M1.9 8S4.4 3.6 8 3.6 14.1 8 14.1 8 11.6 12.4 8 12.4 1.9 8 1.9 8z', 'M8 6.1a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z'],
  afvinken: ['M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2z', 'M5.4 8.2l1.9 1.9 3.4-3.6'],
  instroom: ['M6.3 7.6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M2.2 13.6c0-2.3 1.8-4 4.1-4 1 0 1.9.3 2.6.8', 'M11.8 9.4v4.2', 'M9.7 11.5h4.2'],
  lijst: ['M3 4.4h.01', 'M3 8h.01', 'M3 11.6h.01', 'M6 4.4h7', 'M6 8h7', 'M6 11.6h4.5'],
  tag: ['M2.6 8.3V3.4a.9.9 0 0 1 .9-.9h4.9c.2 0 .4.1.6.3l5.1 5.1a.9.9 0 0 1 0 1.3l-4.9 4.9a.9.9 0 0 1-1.3 0L2.9 8.9a.9.9 0 0 1-.3-.6z', 'M5.6 5.6h.01'],

  // Overig
  bliksem: ['M9.2 1.6 3.6 9.3h3.9L6.9 14.4l5.6-7.7H8.6z'],
  waarschuwing: ['M7.1 2.9 1.9 11.9a1 1 0 0 0 .9 1.5h10.4a1 1 0 0 0 .9-1.5L8.9 2.9a1 1 0 0 0-1.8 0z', 'M8 6.4v2.8', 'M8 11.4h.01'],
  pijl: ['M2.8 8h10.4', 'M9.4 4.2 13.2 8l-3.8 3.8'],
  klok: ['M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2z', 'M8 4.9V8l2.1 1.5'],
  buisje: ['M5.9 1.8h4.2', 'M6.7 1.8v8.4a1.3 1.3 0 1 0 2.6 0V1.8', 'M6.7 7.6h2.6'],
  huis: ['M2.6 7.4 8 3l5.4 4.4v5.4a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1z', 'M6.4 13.8V9.6h3.2v4.2'],
  gesprek: ['M13.4 9.4a1.5 1.5 0 0 1-1.5 1.5H5.2l-2.6 2.5V4.1a1.5 1.5 0 0 1 1.5-1.5h7.8a1.5 1.5 0 0 1 1.5 1.5z'],
  vink: ['M3.2 8.4 6.5 11.8 12.8 4.8'],
  kruis: ['M4.2 4.2 11.8 11.8', 'M11.8 4.2 4.2 11.8'],
  plus: ['M8 3.2v9.6', 'M3.2 8h9.6'],
  persoon: ['M8 7.8a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z', 'M2.6 13.8c0-2.6 2.4-4.4 5.4-4.4s5.4 1.8 5.4 4.4'],
  doel: ['M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2z', 'M8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z', 'M8 7.4h.01'],
  schakelaar: ['M4.8 4.4h6.4a3.6 3.6 0 0 1 0 7.2H4.8a3.6 3.6 0 0 1 0-7.2z', 'M11.2 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z'],
  boek: ['M2.8 3.2h3.8A1.6 1.6 0 0 1 8 4.6v8.6a1.2 1.2 0 0 0-1.2-1.1H2.8z', 'M13.2 3.2H9.4A1.6 1.6 0 0 0 8 4.6v8.6a1.2 1.2 0 0 1 1.2-1.1h4z'],
  'pijl-links': ['M13.2 8H2.8', 'M6.6 4.2 2.8 8l3.8 3.8'],
  vergrootglas: ['M7.4 2.6a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6z', 'M10.9 10.9l2.6 2.6'],
  gebouw: ['M3.4 13.6V4.2a1 1 0 0 1 1-1h7.2a1 1 0 0 1 1 1v9.4', 'M2.2 13.6h11.6',
    'M8 5.8v3.4', 'M6.3 7.5h3.4'],
  document: ['M4.2 2.4h5L12 5.2v8.4a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1V3.4a1 1 0 0 1 1-1z',
    'M9 2.4v3h3', 'M5.6 8.6h4.2', 'M5.6 11h2.8'],
  uitgaand: ['M12.8 8.8v3.6a1.2 1.2 0 0 1-1.2 1.2H4a1.2 1.2 0 0 1-1.2-1.2V4.8A1.2 1.2 0 0 1 4 3.6h3.6',
    'M10 2.4h3.6V6', 'M7.4 8.6l6.2-6.2'],
  tabel: ['M3 3.6h10a.8.8 0 0 1 .8.8v7.2a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8V4.4A.8.8 0 0 1 3 3.6z',
    'M2.2 6.6h11.6', 'M6.4 6.6v5.8'],
  grafiek: ['M2.6 2.8v10.4h10.8', 'M4.8 10.6 7.2 7.8l2.2 1.8 3.4-4.4'],
  herstel: ['M13.2 8a5.2 5.2 0 1 1-1.6-3.7', 'M13.4 2.6v3.2h-3.2'],
  filter: ['M2.6 3.6h10.8L9.2 8.4v4.2l-2.4-1.3V8.4z'],
  uitloggen: ['M6.4 13.4H4.2a1.2 1.2 0 0 1-1.2-1.2V3.8a1.2 1.2 0 0 1 1.2-1.2h2.2',
    'M10.2 11 13.4 8l-3.2-3', 'M13.4 8H6.2'],
  video: ['M2.6 4.8h6.6a1.2 1.2 0 0 1 1.2 1.2v4a1.2 1.2 0 0 1-1.2 1.2H2.6a1.2 1.2 0 0 1-1.2-1.2V6a1.2 1.2 0 0 1 1.2-1.2z',
    'M10.4 8.2 14.4 5.8v4.4L10.4 7.8z'],
  microfoon: ['M8 2.2a1.8 1.8 0 0 1 1.8 1.8v3.6a1.8 1.8 0 1 1-3.6 0V4A1.8 1.8 0 0 1 8 2.2z',
    'M4.2 7.6a3.8 3.8 0 0 0 7.6 0', 'M8 11.4v2.4'],
  slot: ['M3.4 4.2h9.2a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V5.2a1 1 0 0 1 1-1z',
    'M5.4 2.4v3', 'M10.6 2.4v3', 'M2.4 7.4h11.2', 'M8 9.2v3.2', 'M6.4 10.8h3.2'],
  rapport: ['M4.2 2.4h5L12 5.2v8.4a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1V3.4a1 1 0 0 1 1-1z',
    'M9 2.4v3h3', 'M5.8 11.6V9.4', 'M8 11.6V7.8', 'M10.2 11.6v-1.4'],
  beperking: ['M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2z', 'M4.2 4.2l7.6 7.6'],
  euro: ['M11.4 4.2a4 4 0 1 0 0 7.6', 'M3.4 6.8h5.2', 'M3.4 9.2h5.2'],
  reis: ['M3.4 12.8a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z',
    'M12.6 6.4a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z',
    'M5 11.2h3.2a2.4 2.4 0 0 0 0-4.8H7a2.4 2.4 0 0 1 0-4.8'],
};

export type IcoonNaam = keyof typeof PADEN | string;

export function Icoon({ naam, grootte = 16, streek = 1.6 }: { naam: IcoonNaam; grootte?: number; streek?: number }) {
  const paden = PADEN[naam] ?? PADEN.doel;
  return (
    <svg width={grootte} height={grootte} viewBox="0 0 16 16" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth={streek} strokeLinecap="round" strokeLinejoin="round">
      {paden.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/** Vaste koppeling module → icoon, zodat een aandachtsgebied overal hetzelfde oogt. */
export const MODULE_ICOON: Record<string, string> = {
  glucose: 'druppel', vaatrisico: 'hart', nierfunctie: 'nier', ademhaling: 'long',
  leefstijl: 'blad', mentaal: 'hoofd', medicatieveiligheid: 'pil', kwetsbaarheid: 'schild',
};

/** Icoonnaam uit het protocol ('druppel', 'hart', …) valt terug op de moduletabel. */
export function icoonVanModule(moduleId: string, uitProtocol?: string): string {
  return uitProtocol && PADEN[uitProtocol] ? uitProtocol : (MODULE_ICOON[moduleId] ?? 'doel');
}
