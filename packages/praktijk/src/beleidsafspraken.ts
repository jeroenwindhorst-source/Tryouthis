import type { Dossier } from '@zpe/fhir-model';
import { leeftijd } from '@zpe/fhir-model';
import { rng } from './populatie.js';

/**
 * BELEIDSAFSPRAKEN EN BEHANDELGRENZEN
 *
 * "Niet reanimeren" is geen dossierregel tussen de andere dossierregels. Het is een
 * afspraak die je moet zien vóórdat je iets doet, niet nadat je hebt gezocht — en als
 * hij niet zichtbaar is, wordt hij niet nageleefd. In bestaande systemen staat dit
 * doorgaans als een markering of een vrije notitie tussen honderd andere, en dan is de
 * vraag "is dit besproken?" alleen te beantwoorden door het dossier door te lezen.
 *
 * Daarom drie dingen die hier verplicht zijn:
 *  1. **wie het besloot en met wie het besproken is** — een behandelgrens zonder gesprek
 *     is geen afspraak maar een aanname;
 *  2. **wanneer**, want een afspraak van acht jaar geleden vraagt om herbevestiging;
 *  3. **waar het is vastgelegd**, zodat het bij een overdracht meegaat.
 */

export type Beleidssoort =
  | 'reanimatie' | 'ziekenhuisopname' | 'ic-opname' | 'antibiotica'
  | 'wilsverklaring' | 'vertegenwoordiger' | 'donorregistratie';

export type Besluit = 'wel' | 'niet' | 'in-overleg' | 'vastgelegd' | 'onbekend';

export interface Beleidsafspraak {
  id: string;
  patientId: string;
  soort: Beleidssoort;
  besluit: Besluit;
  /** Wat er is afgesproken, in één zin die je hardop kunt voorlezen. */
  samenvatting: string;
  besprokenMet: string;
  vastgelegdOp: string;
  vastgelegdDoor: { naam: string; rol: string };
  /** Wanneer dit opnieuw besproken hoort te worden. */
  evaluatieOp?: string;
  toelichting?: string;
}

export const BELEIDSLABEL: Record<Beleidssoort, string> = {
  reanimatie: 'Reanimatie',
  ziekenhuisopname: 'Ziekenhuisopname',
  'ic-opname': 'IC-opname',
  antibiotica: 'Antibiotica bij infectie',
  wilsverklaring: 'Wilsverklaring',
  vertegenwoordiger: 'Wettelijk vertegenwoordiger',
  donorregistratie: 'Donorregistratie',
};

/** Alleen wat een ander moet weten vóórdat hij handelt, staat bovenaan het dossier. */
export function isWaarschuwend(afspraak: Beleidsafspraak): boolean {
  return afspraak.besluit === 'niet'
    || (afspraak.soort === 'reanimatie' && afspraak.besluit !== 'wel');
}

const SJABLONEN: Record<string, Omit<Beleidsafspraak, 'id' | 'patientId' | 'vastgelegdOp' | 'evaluatieOp'>> = {
  'niet-reanimeren': {
    soort: 'reanimatie', besluit: 'niet',
    samenvatting: 'Niet reanimeren. Patiënt wil geen reanimatie, onder alle omstandigheden.',
    besprokenMet: 'patiënt en dochter',
    vastgelegdDoor: { naam: 'Daan Verhoeven', rol: 'huisarts' },
    toelichting: 'Schriftelijke wilsverklaring aanwezig, kopie in het dossier. Penning gedragen.',
  },
  'niet-naar-ic': {
    soort: 'ic-opname', besluit: 'niet',
    samenvatting: 'Geen IC-opname. Ziekenhuisopname op een gewone afdeling is wel gewenst.',
    besprokenMet: 'patiënt en echtgenoot',
    vastgelegdDoor: { naam: 'Daan Verhoeven', rol: 'huisarts' },
    toelichting: 'Besproken tijdens het gesprek over behandelwensen bij achteruitgang.',
  },
  'thuis-blijven': {
    soort: 'ziekenhuisopname', besluit: 'niet',
    samenvatting: 'Bij voorkeur geen ziekenhuisopname; behandeling thuis waar dat kan.',
    besprokenMet: 'patiënt, dochter en specialist ouderengeneeskunde',
    vastgelegdDoor: { naam: 'Daan Verhoeven', rol: 'huisarts' },
    toelichting: 'Thuiszorg is op de hoogte; bij verslechtering eerst overleg met de huisarts.',
  },
  'alles-doen': {
    soort: 'reanimatie', besluit: 'wel',
    samenvatting: 'Wel reanimeren, geen beperkingen afgesproken.',
    besprokenMet: 'patiënt',
    vastgelegdDoor: { naam: 'Sanne Bakker', rol: 'poh-s' },
    toelichting: 'Besproken tijdens het ouderenzorgconsult.',
  },
  vertegenwoordiger: {
    soort: 'vertegenwoordiger', besluit: 'vastgelegd',
    samenvatting: 'Dochter is gemachtigd om namens de patiënt te beslissen.',
    besprokenMet: 'patiënt en dochter',
    vastgelegdDoor: { naam: 'Daan Verhoeven', rol: 'huisarts' },
    toelichting: 'Schriftelijke machtiging, kopie in het dossier.',
  },
};

/**
 * Beleidsafspraken voor één patiënt.
 *
 * Alleen bij mensen bij wie dit gesprek in de praktijk werkelijk gevoerd wordt: ouderen
 * en mensen met veel ziektelast. Een dossier waarin iedereen een behandelgrens heeft, is
 * net zo onbruikbaar als een dossier waarin niemand er een heeft.
 */
export function genereerBeleidsafspraken(
  dossier: Dossier, peildatum: Date, zaad: number,
): Beleidsafspraak[] {
  const willekeurig = rng(zaad);
  const jaar = leeftijd(dossier, peildatum);
  const chronisch = dossier.episodes.filter((e) => e.status === 'active').length;

  const kansOpGesprek = jaar >= 80 ? 0.85 : jaar >= 72 ? 0.5 : chronisch >= 4 ? 0.2 : 0.04;
  if (willekeurig() > kansOpGesprek) return [];

  const keuze = willekeurig();
  const sleutels =
    keuze < 0.42 ? ['niet-reanimeren', 'vertegenwoordiger']
    : keuze < 0.62 ? ['niet-naar-ic']
    : keuze < 0.78 ? ['thuis-blijven', 'niet-reanimeren']
    : ['alles-doen'];

  return sleutels.map((sleutel, i) => {
    const dagen = 60 + Math.floor(willekeurig() * 1100);
    const op = new Date(peildatum);
    op.setDate(op.getDate() - dagen);
    const evaluatie = new Date(op);
    evaluatie.setFullYear(evaluatie.getFullYear() + 2);
    return {
      ...SJABLONEN[sleutel],
      id: `beleid-${dossier.patient.id}-${i + 1}`,
      patientId: dossier.patient.id,
      vastgelegdOp: op.toISOString().slice(0, 10),
      evaluatieOp: evaluatie.toISOString().slice(0, 10),
    };
  });
}
