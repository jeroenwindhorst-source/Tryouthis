/**
 * ZELFREDZAAMHEID
 *
 * De vraag "hoe vaak moet ik deze patiënt zien" heeft twee antwoorden die los van elkaar
 * staan en allebei waar zijn:
 *
 *  1. **Hoe staat het er klinisch voor?** Een ontregelde HbA1c vraagt vaker contact.
 *     Dat zit in de intervalregels van het protocol (`protocol.ts`).
 *  2. **Hoeveel kan deze mens zelf?** Iemand die zijn medicatie beheert, thuis meet en
 *     aan de bel trekt bij afwijkingen heeft minder contact nodig dan iemand die dat
 *     niet kan — bij exact dezelfde waarden.
 *
 * Systemen die alleen de eerste vraag stellen, roepen de verkeerde mensen op: de
 * stabiele zelfredzame patiënt komt trouw elk kwartaal, en degene die het eigenlijk
 * niet redt verdwijnt uit beeld zodra de waarden meevallen.
 *
 * Deze module maakt de tweede vraag expliciet, met de domeinen van de
 * Zelfredzaamheid-Matrix (ZRM) als structuur.
 *
 * LET OP — licentie. De ZRM is ontwikkeld door de GGD Amsterdam en kent officiële
 * scoringsankers per domein. De domeinnamen hieronder zijn feitelijk; de ankers en de
 * exacte afkapwaarden moeten vóór gebruik in de praktijk tegen de officiële uitgave
 * worden gelegd, met licentie waar die vereist is. Wat hier staat is de structuur en de
 * doorwerking, niet het instrument.
 */

export type DomeinId =
  | 'financien' | 'dagbesteding' | 'huisvesting' | 'huiselijke-relaties'
  | 'geestelijke-gezondheid' | 'lichamelijke-gezondheid' | 'verslaving'
  | 'adl' | 'sociaal-netwerk' | 'participatie' | 'justitie';

export interface Domein {
  id: DomeinId;
  naam: string;
  /** Wat dit domein betekent voor de zórg — niet de algemene definitie. */
  zorgbetekenis: string;
}

export const domeinen: Domein[] = [
  { id: 'financien', naam: 'Financiën',
    zorgbetekenis: 'Kan iemand zijn eigen risico en hulpmiddelen betalen? Zorgmijding begint hier.' },
  { id: 'dagbesteding', naam: 'Dagbesteding',
    zorgbetekenis: 'Structuur in de dag maakt het verschil voor medicatietrouw en bewegen.' },
  { id: 'huisvesting', naam: 'Huisvesting',
    zorgbetekenis: 'Zonder stabiele woonsituatie is thuismeting of koelkastmedicatie niet realistisch.' },
  { id: 'huiselijke-relaties', naam: 'Huiselijke relaties',
    zorgbetekenis: 'Steun of juist belasting thuis; bepaalt of afspraken thuis standhouden.' },
  { id: 'geestelijke-gezondheid', naam: 'Geestelijke gezondheid',
    zorgbetekenis: 'Weegt zwaar mee: somberheid ondermijnt zelfmanagement bij elke chronische ziekte.' },
  { id: 'lichamelijke-gezondheid', naam: 'Lichamelijke gezondheid',
    zorgbetekenis: 'Hoe iemand zijn eigen gezondheid kan managen, los van de diagnose zelf.' },
  { id: 'verslaving', naam: 'Middelengebruik',
    zorgbetekenis: 'Roken, alcohol en overig gebruik; raakt vrijwel elk aandachtsgebied.' },
  { id: 'adl', naam: 'Dagelijks functioneren',
    zorgbetekenis: 'Lukt zelfzorg, boodschappen, medicatie klaarzetten? Bepalend voor de vorm van zorg.' },
  { id: 'sociaal-netwerk', naam: 'Sociaal netwerk',
    zorgbetekenis: 'Wie kan meekijken of meekomen. Een netwerk vervangt soms een consult.' },
  { id: 'participatie', naam: 'Maatschappelijke participatie',
    zorgbetekenis: 'Meedoen hangt samen met herstel en met volhouden van leefstijlafspraken.' },
  { id: 'justitie', naam: 'Justitie',
    zorgbetekenis: 'Zelden aan de orde, maar bepalend voor bereikbaarheid en continuïteit.' },
];

/** 1 = acute problematiek, 5 = volledig zelfredzaam. */
export type DomeinScore = 1 | 2 | 3 | 4 | 5;

export interface Zelfredzaamheid {
  /** Niet elk domein hoeft gescoord te zijn; ongescoorde domeinen tellen niet mee. */
  scores: Partial<Record<DomeinId, DomeinScore>>;
  afgenomenOp: string;
  afgenomenDoor: string;
  /** Eerdere afname, voor de trend. */
  vorige?: { gemiddelde: number; afgenomenOp: string };
  /** Wat de patiënt zelf zegt nodig te hebben. */
  toelichting?: string;
}

export type Niveau = 'acuut' | 'beperkt' | 'voldoende' | 'goed' | 'volledig';

export interface Zelfredzaamheidsbeeld {
  gemiddelde: number;
  niveau: Niveau;
  /** Factor op alle controle-intervallen. Lager betekent vaker zien. */
  factor: number;
  /** In begrijpelijke taal: wat betekent dit voor de zorg. */
  betekenis: string;
  /** Domeinen die om aandacht vragen, gesorteerd op ernst. */
  knelpunten: { domein: Domein; score: DomeinScore }[];
  /** Domeinen waarop juist gebouwd kan worden. */
  sterk: { domein: Domein; score: DomeinScore }[];
  /** Kan deze patiënt digitaal worden benaderd? */
  digitaalBereikbaar: boolean;
  /** Aandachtsgebieden die hierdoor relevant worden, los van de diagnose. */
  raaktModules: string[];
  trend?: { verschil: number; richting: 'vooruit' | 'achteruit' | 'stabiel' };
}

const NIVEAUS: { tot: number; niveau: Niveau; factor: number; betekenis: string }[] = [
  { tot: 2.0, niveau: 'acuut', factor: 0.5, betekenis:
    'Er is op meerdere leefgebieden acute problematiek. Chronische zorg lukt hier alleen met ' +
    'vaste, korte contacten en een vast gezicht; digitale route is niet passend.' },
  { tot: 3.0, niveau: 'beperkt', factor: 0.7, betekenis:
    'Zelfmanagement lukt beperkt. Vaker contact dan het protocol vraagt is hier geen overbehandeling ' +
    'maar de voorwaarde om iemand niet kwijt te raken.' },
  { tot: 4.0, niveau: 'voldoende', factor: 1.0, betekenis:
    'Redt zich grotendeels zelf met de gebruikelijke begeleiding. Het protocol is passend.' },
  { tot: 4.6, niveau: 'goed', factor: 1.3, betekenis:
    'Beheert de eigen zorg goed. Minder frequente controle is verantwoord, met een lage drempel ' +
    'om zelf aan de bel te trekken.' },
  { tot: 5.01, niveau: 'volledig', factor: 1.6, betekenis:
    'Volledig zelfredzaam. Eigen regie met bewaking op de achtergrond ligt voor de hand; ' +
    'oproepen op vaste momenten voegt weinig toe.' },
];

/** Domeinen die, als ze laag scoren, een aandachtsgebied relevant maken. */
const DOMEIN_MODULE: Partial<Record<DomeinId, string>> = {
  'geestelijke-gezondheid': 'mentaal',
  verslaving: 'leefstijl',
  adl: 'kwetsbaarheid',
  'sociaal-netwerk': 'kwetsbaarheid',
};

/**
 * Vertaalt een ZRM-afname naar wat het voor de zorg betekent.
 *
 * Het gemiddelde is bewust ongewogen: elk leefdomein telt even zwaar. Een wegingsformule
 * suggereert precisie die er niet is, en maakt de uitkomst voor de zorgverlener
 * oncontroleerbaar. De knelpunten per domein zeggen meer dan het getal.
 */
export function beoordeelZelfredzaamheid(z: Zelfredzaamheid): Zelfredzaamheidsbeeld {
  const gescoord = Object.entries(z.scores)
    .filter(([, score]) => typeof score === 'number') as [DomeinId, DomeinScore][];

  if (gescoord.length === 0) {
    return {
      gemiddelde: 0, niveau: 'voldoende', factor: 1,
      betekenis: 'Zelfredzaamheid is nog niet in kaart gebracht; het protocol geldt ongewijzigd.',
      knelpunten: [], sterk: [], digitaalBereikbaar: true, raaktModules: [],
    };
  }

  const gemiddelde = Math.round(
    (gescoord.reduce((s, [, score]) => s + score, 0) / gescoord.length) * 10,
  ) / 10;
  const niveau = NIVEAUS.find((n) => gemiddelde < n.tot) ?? NIVEAUS.at(-1)!;

  const vind = (id: DomeinId): Domein => domeinen.find((d) => d.id === id)!;
  const knelpunten = gescoord
    .filter(([, score]) => score <= 2)
    .sort((a, b) => a[1] - b[1])
    .map(([id, score]) => ({ domein: vind(id), score }));
  const sterk = gescoord
    .filter(([, score]) => score >= 5)
    .map(([id, score]) => ({ domein: vind(id), score }));

  const raaktModules = [...new Set(
    gescoord.filter(([id, score]) => score <= 2 && DOMEIN_MODULE[id])
      .map(([id]) => DOMEIN_MODULE[id]!),
  )];

  // Digitaal bereikbaar hangt niet aan het gemiddelde maar aan de domeinen die ertoe doen.
  const dagelijks = z.scores.adl ?? 3;
  const huisvesting = z.scores.huisvesting ?? 3;
  const digitaalBereikbaar = gemiddelde >= 2.5 && dagelijks >= 3 && huisvesting >= 3;

  const trend = z.vorige
    ? {
        verschil: Math.round((gemiddelde - z.vorige.gemiddelde) * 10) / 10,
        richting: (gemiddelde - z.vorige.gemiddelde > 0.2 ? 'vooruit'
          : gemiddelde - z.vorige.gemiddelde < -0.2 ? 'achteruit' : 'stabiel') as
          'vooruit' | 'achteruit' | 'stabiel',
      }
    : undefined;

  return {
    gemiddelde,
    niveau: niveau.niveau,
    factor: niveau.factor,
    betekenis: niveau.betekenis,
    knelpunten, sterk, digitaalBereikbaar, raaktModules, trend,
  };
}

export const NIVEAU_LABEL: Record<Niveau, string> = {
  acuut: 'acute problematiek',
  beperkt: 'beperkt zelfredzaam',
  voldoende: 'voldoende zelfredzaam',
  goed: 'goed zelfredzaam',
  volledig: 'volledig zelfredzaam',
};
