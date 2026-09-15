import type { Coding } from '@zpe/fhir-model';
import { SNOMED_EDITIE, SYSTEEM } from './systems.js';
import type {
  Concept, GecodeerdConcept, OntvangstResultaat, RegistratieNiveau,
  ZoekOpties, ZoekTreffer,
} from './types.js';

function normaliseer(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // diakrieten weg
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Terminologieservice. De registratieset staat volledig in het geheugen — dat is de
 * enige manier om de eis van < 100 ms zoeken te halen (docs/02 §8). De volledige
 * SNOMED-set hoort in Postgres en wordt via `externeBron` aangesloten.
 */
export class TerminologieService {
  private perSnomed = new Map<string, Concept>();
  private perIcpc = new Map<string, Concept[]>();
  private tokenIndex = new Map<string, Set<string>>();

  constructor(concepten: Concept[] = []) {
    this.laad(concepten);
  }

  laad(concepten: Concept[]): void {
    for (const c of concepten) {
      this.perSnomed.set(c.snomed, c);
      if (c.icpc1) {
        const lijst = this.perIcpc.get(c.icpc1) ?? [];
        lijst.push(c);
        this.perIcpc.set(c.icpc1, lijst);
      }
      for (const token of this.tokensVan(c)) {
        const set = this.tokenIndex.get(token) ?? new Set();
        set.add(c.snomed);
        this.tokenIndex.set(token, set);
      }
    }
  }

  private tokensVan(c: Concept): string[] {
    const bronnen = [c.display, ...(c.synoniemen ?? []), c.icpc1Display ?? ''];
    const tokens = new Set<string>();
    for (const bron of bronnen) {
      for (const woord of normaliseer(bron).split(' ')) {
        if (woord.length < 2) continue;
        tokens.add(woord);
        // prefixen, zodat 'diab' ook 'diabetes' vindt
        for (let n = 3; n < Math.min(woord.length, 8); n++) tokens.add(woord.slice(0, n));
      }
    }
    return [...tokens];
  }

  aantal(): number { return this.perSnomed.size; }

  lookupSnomed(code: string): Concept | undefined { return this.perSnomed.get(code); }

  lookupIcpc(code: string): Concept[] { return this.perIcpc.get(code.toUpperCase()) ?? []; }

  /**
   * Zoeken. Standaard alléén in wat registreerbaar is — de 385.000 externe concepten
   * verschijnen nooit ongevraagd in een registratiescherm (docs/02 §1).
   */
  zoek(query: string, opties: ZoekOpties = {}): ZoekTreffer[] {
    const niveaus: RegistratieNiveau[] = opties.niveaus ?? ['registratieset', 'uitbreidingsset'];
    const limiet = opties.limiet ?? 20;
    const q = query.trim();
    if (!q) return [];

    const treffers = new Map<string, ZoekTreffer>();
    const voegToe = (c: Concept, score: number, reden: ZoekTreffer['reden']) => {
      if (!niveaus.includes(c.niveau)) return;
      if (c.status !== 'active') return;
      if (opties.refset && !(c.refsets ?? []).includes(opties.refset)) return;
      const bestaand = treffers.get(c.snomed);
      if (!bestaand || bestaand.score < score) treffers.set(c.snomed, { concept: c, score, reden });
    };

    // 1. Exacte codetreffers wegen het zwaarst — zorgverleners typen vaak de code.
    const direct = this.perSnomed.get(q);
    if (direct) voegToe(direct, 1000, 'code');
    for (const c of this.lookupIcpc(q)) voegToe(c, 900, 'icpc');
    if (/^[a-zA-Z]\d{2}/.test(q)) {
      for (const [icpc, lijst] of this.perIcpc) {
        if (icpc.startsWith(q.toUpperCase())) for (const c of lijst) voegToe(c, 850, 'icpc');
      }
    }

    // 2. Tekstuele treffers over voorkeursterm en synoniemen.
    const woorden = normaliseer(q).split(' ').filter((w) => w.length >= 2);
    const perConcept = new Map<string, number>();
    for (const woord of woorden) {
      for (const snomed of this.tokenIndex.get(woord) ?? []) {
        perConcept.set(snomed, (perConcept.get(snomed) ?? 0) + 1);
      }
    }
    for (const [snomed, raak] of perConcept) {
      const c = this.perSnomed.get(snomed);
      if (!c) continue;
      const genormaliseerdDisplay = normaliseer(c.display);
      const volledigeQuery = normaliseer(q);
      let score = (raak / woorden.length) * 100;
      if (genormaliseerdDisplay === volledigeQuery) score += 500;
      else if (genormaliseerdDisplay.startsWith(volledigeQuery)) score += 200;
      else if (genormaliseerdDisplay.includes(volledigeQuery)) score += 100;
      // Registratieset vóór uitbreidingsset bij gelijke relevantie.
      if (c.niveau === 'registratieset') score += 25;
      const reden: ZoekTreffer['reden'] =
        genormaliseerdDisplay.includes(volledigeQuery) ? 'voorkeursterm'
        : (c.synoniemen ?? []).some((s) => normaliseer(s).includes(volledigeQuery)) ? 'synoniem'
        : 'deelwoord';
      voegToe(c, score, reden);
    }

    return [...treffers.values()].sort((a, b) => b.score - a.score).slice(0, limiet);
  }

  /** Maakt van een concept een registreerbare, dual-coded registratie. */
  codeer(concept: Concept): GecodeerdConcept {
    const gecodeerd: GecodeerdConcept = {
      niveau: concept.niveau,
      equivalentie: concept.equivalentie,
      tekst: concept.display,
      snomed: {
        system: SYSTEEM.snomed, code: concept.snomed,
        display: concept.display, version: SNOMED_EDITIE, userSelected: true,
      },
    };
    if (concept.icpc1) {
      gecodeerd.icpc1 = {
        system: SYSTEEM.icpc1nl, code: concept.icpc1,
        display: concept.icpc1Display ?? concept.display,
      };
    }
    return gecodeerd;
  }

  /** ICPC → SNOMED en omgekeerd. */
  vertaal(code: string, naar: 'snomed' | 'icpc1'): Concept[] {
    if (naar === 'snomed') return this.lookupIcpc(code);
    const c = this.perSnomed.get(code);
    return c?.icpc1 ? [c] : [];
  }

  /** Alle IS-A voorouders binnen wat we kennen; gebruikt voor subsumptie. */
  voorouders(snomed: string, gezien = new Set<string>()): string[] {
    const c = this.perSnomed.get(snomed);
    if (!c?.ouders) return [];
    const resultaat: string[] = [];
    for (const ouder of c.ouders) {
      if (gezien.has(ouder)) continue;
      gezien.add(ouder);
      resultaat.push(ouder, ...this.voorouders(ouder, gezien));
    }
    return resultaat;
  }

  /**
   * Verwerkt een inkomende externe code (docs/02 §5).
   *
   * Kernregel: het origineel wordt nooit weggegooid en nooit stilzwijgend vervangen.
   * Onze interpretatie komt ernaast, niet ervoor.
   */
  ontvang(codings: Coding[], bronSysteem?: string): OntvangstResultaat {
    const snomedCoding = codings.find((c) => c.system === SYSTEEM.snomed);
    const basis: GecodeerdConcept = {
      niveau: 'extern',
      origineel: codings,
      tekst: codings.find((c) => c.display)?.display,
    };

    if (!snomedCoding) {
      return {
        gecodeerd: basis,
        advies: 'tonen-als-extern',
        toelichting: `Geen SNOMED-codering aanwezig${bronSysteem ? ` in bericht van ${bronSysteem}` : ''}; ` +
          'inhoud wordt ongewijzigd bewaard en als extern getoond.',
      };
    }

    const concept = this.perSnomed.get(snomedCoding.code);

    if (concept?.niveau === 'registratieset') {
      return {
        gecodeerd: { ...this.codeer(concept), origineel: codings },
        advies: 'overnemen',
        context: concept,
        toelichting: `'${concept.display}' zit in de eigen registratieset (ICPC ${concept.icpc1}). ` +
          'Kan als eigen registratie worden overgenomen.',
      };
    }

    if (concept?.niveau === 'uitbreidingsset') {
      return {
        gecodeerd: { ...this.codeer(concept), origineel: codings },
        advies: 'overnemen-met-paraplu',
        context: concept,
        toelichting: `'${concept.display}' is specifieker dan ICPC. Overnemen gebeurt onder ` +
          `de paraplu ${concept.icpc1} (${concept.icpc1Display}).`,
      };
    }

    // Geen eigen concept: zoek de dichtstbijzijnde eigen code via IS-A.
    const ketens = [snomedCoding.code, ...this.voorouders(snomedCoding.code)];
    for (const kandidaatCode of ketens) {
      const kandidaat = this.perSnomed.get(kandidaatCode);
      if (kandidaat && kandidaat.niveau !== 'extern') {
        return {
          gecodeerd: { ...basis, snomed: snomedCoding },
          advies: 'tonen-als-extern-met-context',
          context: kandidaat,
          toelichting: `'${snomedCoding.display ?? snomedCoding.code}' is niet registreerbaar in de ` +
            `huisartsensector, maar valt onder '${kandidaat.display}' (ICPC ${kandidaat.icpc1}). ` +
            'Wordt getoond als externe informatie met die context.',
        };
      }
    }

    return {
      gecodeerd: { ...basis, snomed: snomedCoding },
      advies: 'tonen-als-extern',
      toelichting: `'${snomedCoding.display ?? snomedCoding.code}' heeft geen relatie met de eigen ` +
        'referentieset. Het origineel wordt volledig bewaard en als externe informatie getoond.',
    };
  }

  /** Mag in dit concept geregistreerd worden? Harde poort vóór opslag. */
  isRegistreerbaar(snomed: string): boolean {
    const c = this.perSnomed.get(snomed);
    return Boolean(c && c.status === 'active' && c.niveau !== 'extern');
  }
}
