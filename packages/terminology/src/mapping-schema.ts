import type { Concept, MappingKwaliteit, RegistratieNiveau } from './types.js';

/**
 * Inleesformaat voor de ICPC-1 NL ↔ SNOMED CT-mapping van de opdrachtgever.
 * Zie docs/02 §6. CSV of Excel; kolomnamen worden hoofdletterongevoelig herkend
 * en de meest voorkomende Nederlandse varianten worden geaccepteerd.
 */
export interface MappingRij {
  icpc1Code: string;
  icpc1Display: string;
  snomedCode: string;
  snomedFsn?: string;
  snomedDisplayNl: string;
  equivalentie?: string;
  refset?: string;
  synoniemen?: string;
  ouders?: string;
  geldigVanaf?: string;
  geldigTot?: string;
  status?: string;
}

const KOLOM_ALIASSEN: Record<keyof MappingRij, string[]> = {
  icpc1Code: ['icpc1code', 'icpc', 'icpccode', 'icpc-1', 'icpc_code'],
  icpc1Display: ['icpc1display', 'icpcomschrijving', 'icpc_omschrijving', 'icpcterm'],
  snomedCode: ['snomedcode', 'snomed', 'conceptid', 'concept_id', 'sctid'],
  snomedFsn: ['snomedfsn', 'fsn', 'fullyspecifiedname'],
  snomedDisplayNl: ['snomeddisplaynl', 'snomedterm', 'voorkeursterm', 'nlterm', 'omschrijving'],
  equivalentie: ['equivalentie', 'equivalence', 'mapkwaliteit', 'relatie'],
  refset: ['refset', 'referentieset', 'reference_set'],
  synoniemen: ['synoniemen', 'synonyms', 'zoektermen'],
  ouders: ['ouders', 'parents', 'isa', 'is_a'],
  geldigVanaf: ['geldigvanaf', 'validfrom', 'startdatum'],
  geldigTot: ['geldigtot', 'validto', 'einddatum'],
  status: ['status', 'actief', 'active'],
};

const EQUIVALENTIE_ALIASSEN: Record<string, MappingKwaliteit> = {
  exact: 'exact', equivalent: 'exact', equal: 'exact', gelijk: 'exact',
  ruimer: 'ruimer', wider: 'ruimer', broader: 'ruimer', 'source-is-narrower-than-target': 'ruimer',
  nauwer: 'nauwer', narrower: 'nauwer', 'source-is-broader-than-target': 'nauwer',
  gedeeltelijk: 'gedeeltelijk', partial: 'gedeeltelijk', inexact: 'gedeeltelijk',
  geen: 'geen', unmatched: 'geen', none: 'geen',
};

function normaliseerKop(kop: string): string {
  return kop.toLowerCase().replace(/[\s._-]/g, '');
}

/** Bouwt een kolomindex op basis van de kopregel, zodat kolomvolgorde niet uitmaakt. */
export function bepaalKolommen(kopregel: string[]): Partial<Record<keyof MappingRij, number>> {
  const index: Partial<Record<keyof MappingRij, number>> = {};
  kopregel.forEach((kop, i) => {
    const genormaliseerd = normaliseerKop(kop);
    for (const [veld, aliassen] of Object.entries(KOLOM_ALIASSEN) as [keyof MappingRij, string[]][]) {
      if (aliassen.includes(genormaliseerd)) index[veld] = i;
    }
  });
  return index;
}

export interface ImportRapport {
  concepten: Concept[];
  overgeslagen: { regel: number; reden: string }[];
  /** Codes die meerdere keren voorkomen met verschillende mapping — vraagt om review. */
  conflicten: { icpc1Code: string; snomedCodes: string[] }[];
}

/**
 * Zet mappingrijen om naar concepten. Bewust tolerant in wat binnenkomt en strikt
 * in wat eruit komt: een rij die niet compleet is, wordt overgeslagen mét reden,
 * niet stilzwijgend half ingeladen.
 */
export function importeerMapping(rijen: MappingRij[]): ImportRapport {
  const concepten: Concept[] = [];
  const overgeslagen: ImportRapport['overgeslagen'] = [];
  const perIcpc = new Map<string, Set<string>>();

  rijen.forEach((rij, i) => {
    const regel = i + 2; // +1 voor 0-index, +1 voor de kopregel
    if (!rij.snomedCode?.trim()) { overgeslagen.push({ regel, reden: 'snomedCode ontbreekt' }); return; }
    if (!rij.snomedDisplayNl?.trim()) { overgeslagen.push({ regel, reden: 'Nederlandse term ontbreekt' }); return; }
    if (!rij.icpc1Code?.trim()) { overgeslagen.push({ regel, reden: 'icpc1Code ontbreekt' }); return; }

    const equivalentie = EQUIVALENTIE_ALIASSEN[(rij.equivalentie ?? 'exact').toLowerCase().trim()];
    if (!equivalentie) {
      overgeslagen.push({ regel, reden: `onbekende equivalentie '${rij.equivalentie}'` });
      return;
    }

    // Een 'nauwer' mapping betekent: SNOMED is specifieker dan ICPC → uitbreidingsset.
    const niveau: RegistratieNiveau = equivalentie === 'nauwer' ? 'uitbreidingsset' : 'registratieset';

    const icpc = rij.icpc1Code.trim().toUpperCase();
    if (!perIcpc.has(icpc)) perIcpc.set(icpc, new Set());
    perIcpc.get(icpc)!.add(rij.snomedCode.trim());

    concepten.push({
      snomed: rij.snomedCode.trim(),
      fsn: rij.snomedFsn?.trim(),
      display: rij.snomedDisplayNl.trim(),
      synoniemen: rij.synoniemen ? rij.synoniemen.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : undefined,
      icpc1: icpc,
      icpc1Display: rij.icpc1Display?.trim(),
      niveau,
      equivalentie,
      ouders: rij.ouders ? rij.ouders.split(/[;|,]/).map((s) => s.trim()).filter(Boolean) : undefined,
      refsets: rij.refset ? [rij.refset.trim()] : ['huisarts-diagnose'],
      status: (rij.status ?? 'active').toLowerCase().startsWith('a') ? 'active' : 'inactive',
      geldigVanaf: rij.geldigVanaf?.trim(),
      geldigTot: rij.geldigTot?.trim(),
    });
  });

  const conflicten = [...perIcpc.entries()]
    .filter(([, codes]) => codes.size > 1)
    .map(([icpc1Code, codes]) => ({ icpc1Code, snomedCodes: [...codes] }));

  return { concepten, overgeslagen, conflicten };
}

/** Minimalistische CSV-lezer: quotes, komma's en puntkomma's als scheidingsteken. */
export function leesCsv(inhoud: string): MappingRij[] {
  const regels = inhoud.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (regels.length < 2) return [];
  const scheiding = (regels[0].match(/;/g)?.length ?? 0) > (regels[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const splits = (regel: string): string[] => {
    const velden: string[] = [];
    let huidig = '';
    let inQuote = false;
    for (let i = 0; i < regel.length; i++) {
      const ch = regel[i];
      if (ch === '"') {
        if (inQuote && regel[i + 1] === '"') { huidig += '"'; i++; } else inQuote = !inQuote;
      } else if (ch === scheiding && !inQuote) { velden.push(huidig); huidig = ''; }
      else huidig += ch;
    }
    velden.push(huidig);
    return velden.map((v) => v.trim());
  };

  const kolommen = bepaalKolommen(splits(regels[0]));
  return regels.slice(1).map((regel) => {
    const velden = splits(regel);
    const rij = {} as MappingRij;
    for (const [veld, index] of Object.entries(kolommen) as [keyof MappingRij, number][]) {
      (rij as unknown as Record<string, string>)[veld] = velden[index] ?? '';
    }
    return rij;
  });
}
