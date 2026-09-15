import type { Dossier } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, metingOuderdomDagen, numeriekeWaarde } from '@zpe/fhir-model';

/**
 * Regel-DSL voor inclusie- en exclusiecriteria (docs/04 §1).
 *
 * Ontwerpeis: elke uitkomst draagt een leesbare onderbouwing. Een kandidatenlijst
 * zonder uitleg is niet beter dan de Excel die we vervangen — de POH moet in één
 * zin kunnen zien waaróm iemand in beeld komt en dat kunnen weerleggen.
 */
export interface CriteriumUitkomst {
  voldaan: boolean;
  onderbouwing: string;
}

export interface Criterium {
  id: string;
  omschrijving: string;
  evalueer(dossier: Dossier, peildatum: Date): CriteriumUitkomst;
}

function criterium(
  id: string,
  omschrijving: string,
  fn: (d: Dossier, p: Date) => CriteriumUitkomst,
): Criterium {
  return { id, omschrijving, evalueer: fn };
}

// ── Combinators ─────────────────────────────────────────────────────────────

export function alle(criteria: Criterium[]): Criterium {
  return criterium('alle', criteria.map((c) => c.omschrijving).join(' EN '), (d, p) => {
    const uitkomsten = criteria.map((c) => c.evalueer(d, p));
    const voldaan = uitkomsten.every((u) => u.voldaan);
    const relevant = voldaan ? uitkomsten : uitkomsten.filter((u) => !u.voldaan);
    return { voldaan, onderbouwing: relevant.map((u) => u.onderbouwing).join('; ') };
  });
}

export function enigeVan(criteria: Criterium[]): Criterium {
  return criterium('enige', criteria.map((c) => c.omschrijving).join(' OF '), (d, p) => {
    const uitkomsten = criteria.map((c) => c.evalueer(d, p));
    const geraakt = uitkomsten.filter((u) => u.voldaan);
    return geraakt.length > 0
      ? { voldaan: true, onderbouwing: geraakt.map((u) => u.onderbouwing).join('; ') }
      : { voldaan: false, onderbouwing: `geen van: ${criteria.map((c) => c.omschrijving).join(', ')}` };
  });
}

export function niet(c: Criterium): Criterium {
  return criterium(`niet-${c.id}`, `NIET ${c.omschrijving}`, (d, p) => {
    const u = c.evalueer(d, p);
    return { voldaan: !u.voldaan, onderbouwing: u.voldaan ? `uitgesloten: ${u.onderbouwing}` : u.onderbouwing };
  });
}

export const nooit: Criterium = criterium('nooit', 'nooit', () => ({ voldaan: false, onderbouwing: '' }));
export const altijd: Criterium = criterium('altijd', 'altijd', () => ({ voldaan: true, onderbouwing: 'geen voorwaarde' }));

// ── Predicaten over het dossier ─────────────────────────────────────────────

/** Actieve episode met een van de opgegeven ICPC-codes (prefixmatch: 'T90' vangt 'T90.02'). */
export function heeftActieveEpisode(icpcCodes: string[]): Criterium {
  return criterium(
    `episode:${icpcCodes.join('|')}`,
    `actieve episode ${icpcCodes.join(' of ')}`,
    (d) => {
      const treffer = d.episodes.find(
        (e) => e.status === 'active' &&
          e.code.coding?.some((c) => icpcCodes.some((code) => c.code.startsWith(code))),
      );
      return treffer
        ? { voldaan: true, onderbouwing: `actieve episode '${treffer.titel}' sinds ${treffer.periode.start?.slice(0, 10)}` }
        : { voldaan: false, onderbouwing: `geen actieve episode ${icpcCodes.join('/')}` };
    },
  );
}

export function minimaleLeeftijd(jaren: number): Criterium {
  return criterium(`leeftijd>=${jaren}`, `leeftijd ≥ ${jaren}`, (d, p) => {
    const l = leeftijd(d, p);
    return { voldaan: l >= jaren, onderbouwing: `leeftijd ${l} jaar` };
  });
}

export function maximaleLeeftijd(jaren: number): Criterium {
  return criterium(`leeftijd<=${jaren}`, `leeftijd ≤ ${jaren}`, (d, p) => {
    const l = leeftijd(d, p);
    return { voldaan: l <= jaren, onderbouwing: `leeftijd ${l} jaar` };
  });
}

/** Meetwaarde boven een drempel, met een maximale ouderdom van de meting. */
export function metingBoven(code: string, naam: string, drempel: number, maxOuderdomDagen = 365): Criterium {
  return criterium(`meting:${code}>${drempel}`, `${naam} > ${drempel}`, (d, p) => {
    const o = laatsteMeting(d, code);
    const waarde = numeriekeWaarde(o);
    const ouderdom = metingOuderdomDagen(d, code, p);
    if (waarde === undefined) return { voldaan: false, onderbouwing: `${naam} ontbreekt` };
    if (ouderdom > maxOuderdomDagen) {
      return { voldaan: false, onderbouwing: `${naam} te oud (${ouderdom} dagen)` };
    }
    return { voldaan: waarde > drempel, onderbouwing: `${naam} ${waarde} (${ouderdom} dagen oud)` };
  });
}

export function metingOnder(code: string, naam: string, drempel: number, maxOuderdomDagen = 365): Criterium {
  return criterium(`meting:${code}<${drempel}`, `${naam} < ${drempel}`, (d, p) => {
    const o = laatsteMeting(d, code);
    const waarde = numeriekeWaarde(o);
    const ouderdom = metingOuderdomDagen(d, code, p);
    if (waarde === undefined) return { voldaan: false, onderbouwing: `${naam} ontbreekt` };
    if (ouderdom > maxOuderdomDagen) return { voldaan: false, onderbouwing: `${naam} te oud (${ouderdom} dagen)` };
    return { voldaan: waarde < drempel, onderbouwing: `${naam} ${waarde} (${ouderdom} dagen oud)` };
  });
}

/** Markering/ruiter, bijv. 'behandeld-elders' of 'palliatief'. */
export function heeftMarkering(tekst: string): Criterium {
  return criterium(`markering:${tekst}`, `markering '${tekst}'`, (d) => {
    const treffer = d.markeringen.find(
      (m) => m.actief && (m.tekst.toLowerCase().includes(tekst.toLowerCase()) ||
        m.code?.coding?.some((c) => c.code === tekst)),
    );
    return treffer
      ? { voldaan: true, onderbouwing: `markering '${treffer.tekst}'` }
      : { voldaan: false, onderbouwing: `geen markering '${tekst}'` };
  });
}

/** Actieve medicatie op ATC-prefix, bijv. 'A10' voor bloedglucoseverlagende middelen. */
export function heeftMedicatie(atcPrefix: string, naam: string): Criterium {
  return criterium(`medicatie:${atcPrefix}`, `medicatie ${naam}`, (d) => {
    const treffer = d.medicatie.find(
      (m) => m.status === 'active' && m.middel.coding?.some((c) => c.code.startsWith(atcPrefix)),
    );
    return treffer
      ? { voldaan: true, onderbouwing: `gebruikt ${treffer.middel.text ?? naam}` }
      : { voldaan: false, onderbouwing: `geen ${naam}` };
  });
}

/** Rookstatus als gecodeerde observatie (LOINC 72166-2). */
export function rookt(): Criterium {
  return criterium('rookt', 'rookt', (d) => {
    const o = laatsteMeting(d, '72166-2');
    const code = (o?.waarde as { code?: { code: string; display?: string } })?.code;
    if (!code) return { voldaan: false, onderbouwing: 'rookstatus onbekend' };
    const rokend = code.code === '77176002';
    return { voldaan: rokend, onderbouwing: `rookstatus: ${code.display ?? code.code}` };
  });
}
