import type { Dossier } from '@zpe/fhir-model';
import type { Intensiteit } from './zorgplan.js';

/**
 * De vragenlijstmotor (docs/06).
 *
 * Het verschil met wat bestaande systemen 'vragenlijstondersteuning' noemen:
 * een antwoord is hier invoer voor regels, niet tekst voor het journaal.
 */

export type VraagType = 'keuze' | 'schaal' | 'getal' | 'ja-nee' | 'tekst';

export interface Keuzeoptie {
  code: string;
  label: string;
  /** Bijdrage aan een score; ontbreekt bij niet-scorende vragen. */
  score?: number;
}

export interface Vraag {
  id: string;
  /** Formulering voor de zorgverlener: compact, vakterm mag. */
  tekst: string;
  /** Formulering voor de patiënt: B1-niveau. Ontbreekt die, dan wordt `tekst` gebruikt. */
  patientTekst?: string;
  type: VraagType;
  opties?: Keuzeoptie[];
  schaal?: { min: number; max: number; minLabel?: string; maxLabel?: string };
  eenheid?: string;
  /** Code waaronder het antwoord als Observation landt — gestructureerd, niet als tekst. */
  observatieCode?: string;
  /** Conditionele weergave (FHIR enableWhen). */
  toonAls?: Voorwaarde;
  verplicht?: boolean;
  toelichting?: string;
}

export interface ScoreDefinitie {
  id: string;
  naam: string;
  bereken: 'gemiddelde' | 'som';
  vragen: string[];
  observatieCode?: string;
  /** Kleinste klinisch relevante verandering — voorkomt ruisalarmen. */
  relevanteVerandering?: number;
}

export type Voorwaarde =
  | { type: 'antwoord'; vraag: string; operator: '=' | '!=' | 'in' | '>' | '>=' | '<' | '<='; waarde: string | number | string[] }
  | { type: 'beantwoord'; vraag: string }
  | { type: 'score'; score: string; operator: '>' | '>=' | '<' | '<='; waarde: number }
  | { type: 'score-toename'; score: string; minimaal: number }
  | { type: 'score-stabiel'; score: string; onder: number; aantalAfnames: number }
  | { type: 'en'; van: Voorwaarde[] }
  | { type: 'of'; van: Voorwaarde[] }
  | { type: 'niet'; van: Voorwaarde };

export type Actie =
  | { type: 'taak'; categorie: string; rol: string; prioriteit: 'routine' | 'urgent' | 'asap'; omschrijving: string }
  | { type: 'notificeer'; rol: string; bericht: string }
  | { type: 'zelfzorgadvies'; adviesId: string; titel: string }
  | { type: 'vervolgvraag'; vraagId: string }
  | { type: 'plan-afspraak'; afspraakType: string; binnenDagen: number }
  | { type: 'wijzig-intensiteit'; naar: Intensiteit; reden: string; terBevestiging: boolean }
  | { type: 'lab-aanvraag'; bepalingen: string[] }
  | { type: 'meting-uitvragen'; codes: string[]; frequentie: string };

export interface Trigger {
  id: string;
  wanneer: Voorwaarde;
  dan: Actie[];
  ernst: 'informatief' | 'aandacht' | 'urgent';
  /** Leesbare uitleg waarom deze regel bestaat — verplicht voor MDR-traceerbaarheid. */
  onderbouwing: string;
  richtlijn?: { naam: string; paragraaf?: string; versie?: string };
}

export interface Vragenlijst {
  id: string;
  naam: string;
  versie: string;
  doel: 'consultvoorbereiding' | 'monitoring' | 'triage' | 'uitkomstmeting';
  vragen: Vraag[];
  scores: ScoreDefinitie[];
  triggers: Trigger[];
  /** Licentiestatus van het instrument — expliciet, omdat veel meetinstrumenten auteursrechtelijk beschermd zijn. */
  licentie?: string;
}

export type Antwoorden = Record<string, string | number | boolean | string[] | undefined>;

export interface EerdereAfname {
  datum: string;
  scores: Record<string, number>;
}

export interface Uitkomst {
  vragenlijstId: string;
  versie: string;
  zichtbareVragen: Vraag[];
  scores: { id: string; naam: string; waarde: number; vorige?: number; delta?: number; relevant?: boolean }[];
  /** Wat er gestructureerd in het dossier landt. */
  observaties: { code: string; naam: string; waarde: number | string; eenheid?: string }[];
  gevuurd: { trigger: Trigger; onderbouwing: string }[];
  acties: Actie[];
  onbeantwoordVerplicht: string[];
}

// ── Evaluatie ───────────────────────────────────────────────────────────────

function scoreVan(vraag: Vraag, antwoord: unknown): number | undefined {
  if (antwoord === undefined || antwoord === null) return undefined;
  if (vraag.type === 'schaal' || vraag.type === 'getal') {
    return typeof antwoord === 'number' ? antwoord : Number(antwoord);
  }
  if (vraag.type === 'ja-nee') return antwoord === true || antwoord === 'ja' ? 1 : 0;
  const optie = vraag.opties?.find((o) => o.code === antwoord);
  return optie?.score;
}

function berekenScores(lijst: Vragenlijst, antwoorden: Antwoorden): Record<string, number> {
  const resultaat: Record<string, number> = {};
  for (const def of lijst.scores) {
    const waarden: number[] = [];
    for (const vraagId of def.vragen) {
      const vraag = lijst.vragen.find((v) => v.id === vraagId);
      if (!vraag) continue;
      const s = scoreVan(vraag, antwoorden[vraagId]);
      if (s !== undefined && !Number.isNaN(s)) waarden.push(s);
    }
    if (waarden.length === 0) continue;
    const som = waarden.reduce((a, b) => a + b, 0);
    resultaat[def.id] = def.bereken === 'som'
      ? som
      : Math.round((som / waarden.length) * 100) / 100;
  }
  return resultaat;
}

interface Context {
  antwoorden: Antwoorden;
  scores: Record<string, number>;
  historie: EerdereAfname[];
  dossier?: Dossier;
}

export function evalueerVoorwaarde(v: Voorwaarde, ctx: Context): boolean {
  switch (v.type) {
    case 'beantwoord':
      return ctx.antwoorden[v.vraag] !== undefined && ctx.antwoorden[v.vraag] !== '';
    case 'antwoord': {
      const a = ctx.antwoorden[v.vraag];
      if (a === undefined) return false;
      switch (v.operator) {
        case '=': return a === v.waarde;
        case '!=': return a !== v.waarde;
        case 'in': return Array.isArray(v.waarde) && v.waarde.includes(String(a));
        case '>': return Number(a) > Number(v.waarde);
        case '>=': return Number(a) >= Number(v.waarde);
        case '<': return Number(a) < Number(v.waarde);
        case '<=': return Number(a) <= Number(v.waarde);
      }
      return false;
    }
    case 'score': {
      const s = ctx.scores[v.score];
      if (s === undefined) return false;
      switch (v.operator) {
        case '>': return s > v.waarde;
        case '>=': return s >= v.waarde;
        case '<': return s < v.waarde;
        case '<=': return s <= v.waarde;
      }
      return false;
    }
    case 'score-toename': {
      const huidig = ctx.scores[v.score];
      const vorige = ctx.historie.at(-1)?.scores[v.score];
      if (huidig === undefined || vorige === undefined) return false;
      return huidig - vorige >= v.minimaal;
    }
    case 'score-stabiel': {
      const reeks = [...ctx.historie.map((h) => h.scores[v.score]), ctx.scores[v.score]]
        .filter((x): x is number => typeof x === 'number');
      if (reeks.length < v.aantalAfnames) return false;
      return reeks.slice(-v.aantalAfnames).every((x) => x < v.onder);
    }
    case 'en': return v.van.every((x) => evalueerVoorwaarde(x, ctx));
    case 'of': return v.van.some((x) => evalueerVoorwaarde(x, ctx));
    case 'niet': return !evalueerVoorwaarde(v.van, ctx);
  }
}

/** Welke vragen zijn zichtbaar gegeven de huidige antwoorden (FHIR enableWhen). */
export function zichtbareVragen(lijst: Vragenlijst, antwoorden: Antwoorden): Vraag[] {
  const scores = berekenScores(lijst, antwoorden);
  const ctx: Context = { antwoorden, scores, historie: [] };
  return lijst.vragen.filter((v) => !v.toonAls || evalueerVoorwaarde(v.toonAls, ctx));
}

/** De volgende onbeantwoorde zichtbare vraag — de patiëntkant toont één vraag per scherm. */
export function volgendeVraag(lijst: Vragenlijst, antwoorden: Antwoorden): Vraag | undefined {
  return zichtbareVragen(lijst, antwoorden).find((v) => antwoorden[v.id] === undefined);
}

/**
 * Verwerkt een ingevulde vragenlijst: scores, gestructureerde observaties, triggers
 * en de daaruit volgende acties.
 */
export function verwerk(
  lijst: Vragenlijst,
  antwoorden: Antwoorden,
  historie: EerdereAfname[] = [],
  dossier?: Dossier,
): Uitkomst {
  const scores = berekenScores(lijst, antwoorden);
  const ctx: Context = { antwoorden, scores, historie, dossier };
  const zichtbaar = lijst.vragen.filter((v) => !v.toonAls || evalueerVoorwaarde(v.toonAls, ctx));

  const scoreRegels = lijst.scores
    .filter((def) => scores[def.id] !== undefined)
    .map((def) => {
      const waarde = scores[def.id];
      const vorige = historie.at(-1)?.scores[def.id];
      const delta = vorige !== undefined ? Math.round((waarde - vorige) * 100) / 100 : undefined;
      return {
        id: def.id, naam: def.naam, waarde, vorige, delta,
        relevant: delta !== undefined && def.relevanteVerandering !== undefined
          ? Math.abs(delta) >= def.relevanteVerandering
          : undefined,
      };
    });

  const observaties: Uitkomst['observaties'] = [];
  for (const vraag of zichtbaar) {
    const a = antwoorden[vraag.id];
    if (a === undefined || !vraag.observatieCode) continue;
    const waarde = typeof a === 'number' ? a : String(a);
    observaties.push({ code: vraag.observatieCode, naam: vraag.tekst, waarde, eenheid: vraag.eenheid });
  }
  for (const def of lijst.scores) {
    if (def.observatieCode && scores[def.id] !== undefined) {
      observaties.push({ code: def.observatieCode, naam: def.naam, waarde: scores[def.id] });
    }
  }

  const gevuurd: Uitkomst['gevuurd'] = [];
  const acties: Actie[] = [];
  for (const trigger of lijst.triggers) {
    if (!evalueerVoorwaarde(trigger.wanneer, ctx)) continue;
    gevuurd.push({ trigger, onderbouwing: trigger.onderbouwing });
    acties.push(...trigger.dan);
  }

  const onbeantwoordVerplicht = zichtbaar
    .filter((v) => v.verplicht && antwoorden[v.id] === undefined)
    .map((v) => v.id);

  return {
    vragenlijstId: lijst.id,
    versie: lijst.versie,
    zichtbareVragen: zichtbaar,
    scores: scoreRegels,
    observaties,
    gevuurd,
    acties,
    onbeantwoordVerplicht,
  };
}
