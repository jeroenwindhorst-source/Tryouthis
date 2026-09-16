import type { Dossier } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, numeriekeWaarde } from '@zpe/fhir-model';
import { CODE, type Zorgplan } from '@zpe/care-engine';
import { metingNaam } from './terminologie.js';

/**
 * RAPPORTAGES
 *
 * De vraag "welke patiënten met diabetes hebben dit jaar geen funduscontrole gehad" wordt
 * in praktijken beantwoord met een datadump naar Excel. Dat werkt, één keer per kwartaal,
 * door één iemand die de export kent — en het antwoord is bij aankomst al verouderd.
 *
 * Wat hier staat is een zoekvraag over de hele praktijk, samengesteld uit dezelfde
 * gegevens waarmee het zorgproces draait. Drie eisen die het onderscheiden van een
 * rapportagetool die ernaast hangt:
 *
 *  1. **Doorklikken naar de patiënt.** Een getal zonder namen is geen werklijst. Het punt
 *     van "23× funduscontrole ontbreekt" is dat je weet wie dat zijn.
 *  2. **Dezelfde bron als het zorgproces.** Geen aparte datawarehouse-definitie die na een
 *     half jaar uit de pas loopt met het scherm van de POH.
 *  3. **Export is geaggregeerd en gepseudonimiseerd.** Wat naar een BI-omgeving gaat, gaat
 *     zonder namen en zonder BSN. Wie namen nodig heeft, hoort in het dossier te kijken,
 *     met de logging die daarbij hoort (docs/07 §4).
 */

export type Veldsoort = 'keuze' | 'getal' | 'jaartal';

export interface Filterveld {
  id: string;
  naam: string;
  /** Waarom je hierop zou filteren. */
  uitleg: string;
  soort: Veldsoort;
  opties?: { code: string; label: string }[];
  eenheid?: string;
}

/**
 * Waarop je kunt zoeken.
 *
 * Bewust een korte lijst met vragen die werkelijk gesteld worden, niet elk veld dat
 * toevallig in het model zit. Een querybuilder over honderd velden gebruikt niemand.
 */
export const filtervelden: Filterveld[] = [
  {
    id: 'module', naam: 'Aandachtsgebied', soort: 'keuze',
    uitleg: 'Patiënten bij wie dit gebied in het zorgplan actief is.',
    opties: [
      { code: 'glucose', label: 'Glucoseregulatie' },
      { code: 'vaatrisico', label: 'Hart- en vaatrisico' },
      { code: 'ademhaling', label: 'Ademhaling' },
      { code: 'nierfunctie', label: 'Nierfunctie' },
      { code: 'leefstijl', label: 'Leefstijl' },
      { code: 'mentaal', label: 'Mentaal welbevinden' },
      { code: 'medicatieveiligheid', label: 'Medicatieveiligheid' },
      { code: 'kwetsbaarheid', label: 'Kwetsbaarheid en zelfredzaamheid' },
    ],
  },
  {
    id: 'keten', naam: 'Ketenzorg', soort: 'keuze',
    uitleg: 'Onder welk landelijk programma deze patiënt valt.',
    opties: [
      { code: 'dm', label: 'Ketenzorg Diabetes' },
      { code: 'cvrm', label: 'Ketenzorg CVRM' },
      { code: 'copd', label: 'Ketenzorg COPD' },
      { code: 'ouderen', label: 'Programma kwetsbare ouderen' },
      { code: 'geen', label: 'Valt onder geen enkele keten' },
    ],
  },
  {
    id: 'indicator-ontbreekt', naam: 'Indicator ontbreekt', soort: 'keuze',
    uitleg: 'Waar de registratie niet compleet is. Dit is de werklijst, niet het cijfer.',
    opties: [
      { code: CODE.hba1c, label: 'HbA1c' },
      { code: CODE.ldl, label: 'LDL-cholesterol' },
      { code: CODE.egfr, label: 'eGFR' },
      { code: CODE.rrSys, label: 'Bloeddruk' },
      { code: CODE.roken, label: 'Rookstatus' },
      { code: CODE.fundus, label: 'Funduscontrole' },
      { code: CODE.voet, label: 'Voetonderzoek' },
      { code: CODE.fev1, label: 'Spirometrie' },
    ],
  },
  {
    id: 'leeftijd-vanaf', naam: 'Leeftijd vanaf', soort: 'getal',
    uitleg: 'Ondergrens in jaren.', eenheid: 'jaar',
  },
  {
    id: 'leeftijd-tot', naam: 'Leeftijd tot', soort: 'getal',
    uitleg: 'Bovengrens in jaren.', eenheid: 'jaar',
  },
  {
    id: 'zelfredzaamheid-onder', naam: 'Zelfredzaamheid onder', soort: 'getal',
    uitleg: 'Wie het zelf minder redt; vaak dezelfde mensen die uit beeld raken.',
  },
  {
    id: 'chronische-middelen-vanaf', naam: 'Chronische middelen vanaf', soort: 'getal',
    uitleg: 'Polyfarmacie begint in de richtlijn bij vijf middelen.',
  },
  {
    id: 'niet-gezien-maanden', naam: 'Niet gezien sinds', soort: 'getal',
    uitleg: 'Maanden sinds het laatste vastgelegde contact. De belangrijkste vraag die niemand stelt.',
    eenheid: 'maanden',
  },
  {
    id: 'meting-boven', naam: 'HbA1c boven', soort: 'getal',
    uitleg: 'Ontregelde glucosewaarden.', eenheid: 'mmol/mol',
  },
];

export type Criteria = Record<string, string>;

export interface Rapportregel {
  patientId: string;
  naam: string;
  leeftijd: number;
  modules: string[];
  ketens: string[];
  /** Kolommen die bij de gekozen criteria horen; per zoekvraag anders. */
  kolommen: { naam: string; waarde: string; toon?: 'aandacht' | 'urgent' }[];
}

export interface Rapport {
  criteria: Criteria;
  omschrijving: string;
  totaal: number;
  vanTotaal: number;
  regels: Rapportregel[];
  /** Wat dit oplevert als je het samenvat; voor de grafiek en de export. */
  verdeling: { label: string; aantal: number }[];
  kolomnamen: string[];
}

const KETEN_LABEL: Record<string, string> = {
  dm: 'Ketenzorg Diabetes', cvrm: 'Ketenzorg CVRM',
  copd: 'Ketenzorg COPD', ouderen: 'Programma kwetsbare ouderen',
};

const getal = (criteria: Criteria, id: string): number | undefined => {
  const ruw = criteria[id];
  if (!ruw || ruw.trim() === '') return undefined;
  const n = Number(ruw.replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
};

/**
 * Eén zoekvraag over de hele praktijk.
 *
 * De kolommen in het resultaat volgen uit de criteria: wie op "indicator ontbreekt"
 * zoekt, wil zien wanneer die indicator voor het laatst wél is vastgelegd. Een vaste
 * kolommenset dwingt je om daarna alsnog elk dossier te openen.
 */
export function draaiRapport(
  dossiers: { dossier: Dossier; plan: Zorgplan }[],
  criteria: Criteria,
  peildatum: Date,
): Rapport {
  const kolomnamen: string[] = [];
  const beschrijving: string[] = [];

  const module = criteria.module;
  const keten = criteria.keten;
  const indicator = criteria['indicator-ontbreekt'];
  const leeftijdVanaf = getal(criteria, 'leeftijd-vanaf');
  const leeftijdTot = getal(criteria, 'leeftijd-tot');
  const zrmOnder = getal(criteria, 'zelfredzaamheid-onder');
  const middelenVanaf = getal(criteria, 'chronische-middelen-vanaf');
  const nietGezien = getal(criteria, 'niet-gezien-maanden');
  const hba1cBoven = getal(criteria, 'meting-boven');

  if (module) beschrijving.push(`aandachtsgebied ${module}`);
  if (keten) beschrijving.push(keten === 'geen' ? 'buiten elke keten' : KETEN_LABEL[keten] ?? keten);
  if (indicator) { beschrijving.push(`${metingNaam(indicator)} ontbreekt`); kolomnamen.push('Laatst vastgelegd'); }
  if (leeftijdVanaf !== undefined) beschrijving.push(`vanaf ${leeftijdVanaf} jaar`);
  if (leeftijdTot !== undefined) beschrijving.push(`tot ${leeftijdTot} jaar`);
  if (zrmOnder !== undefined) { beschrijving.push(`zelfredzaamheid onder ${zrmOnder}`); kolomnamen.push('Zelfredzaamheid'); }
  if (middelenVanaf !== undefined) { beschrijving.push(`${middelenVanaf}+ chronische middelen`); kolomnamen.push('Middelen'); }
  if (nietGezien !== undefined) { beschrijving.push(`niet gezien in ${nietGezien} maanden`); kolomnamen.push('Laatste contact'); }
  if (hba1cBoven !== undefined) { beschrijving.push(`HbA1c boven ${hba1cBoven}`); kolomnamen.push('HbA1c'); }

  const regels: Rapportregel[] = [];

  for (const { dossier, plan } of dossiers) {
    const jaar = leeftijd(dossier, peildatum);
    const moduleIds = plan.modules.map((m) => m.id);
    const ketenIds = plan.ketens.map((k) => k.ketenId);

    if (module && !moduleIds.includes(module)) continue;
    if (keten === 'geen' && ketenIds.length > 0) continue;
    if (keten && keten !== 'geen' && !ketenIds.some((k) => k.includes(keten))) continue;
    if (leeftijdVanaf !== undefined && jaar < leeftijdVanaf) continue;
    if (leeftijdTot !== undefined && jaar > leeftijdTot) continue;

    const kolommen: Rapportregel['kolommen'] = [];

    if (indicator) {
      const meting = laatsteMeting(dossier, indicator);
      const dagen = meting
        ? Math.floor((peildatum.getTime() - new Date(meting.effectief).getTime()) / 86_400_000)
        : Infinity;
      // "Ontbreekt" betekent: nooit vastgelegd, of ouder dan een jaar. Dat is de grens
      // die de ketenindicatoren zelf ook hanteren.
      if (dagen <= 365) continue;
      kolommen.push({
        naam: 'Laatst vastgelegd',
        waarde: meting ? meting.effectief.slice(0, 10) : 'nooit',
        toon: meting ? 'aandacht' : 'urgent',
      });
    }

    if (zrmOnder !== undefined) {
      const score = plan.zelfredzaamheid?.gemiddelde;
      if (score === undefined || score === 0 || score >= zrmOnder) continue;
      kolommen.push({
        naam: 'Zelfredzaamheid',
        waarde: `${score} (${plan.zelfredzaamheid?.niveau})`,
        toon: score < 2.5 ? 'urgent' : 'aandacht',
      });
    }

    if (middelenVanaf !== undefined) {
      const aantal = dossier.medicatie.filter((m) => m.status === 'active' && m.chronisch).length;
      if (aantal < middelenVanaf) continue;
      kolommen.push({ naam: 'Middelen', waarde: `${aantal}`, toon: aantal >= 7 ? 'urgent' : 'aandacht' });
    }

    if (nietGezien !== undefined) {
      const laatsteContact = dossier.deelcontacten
        .map((dc) => dc.herkomst.vastgelegdOp)
        .sort()
        .at(-1);
      const maanden = laatsteContact
        ? Math.floor((peildatum.getTime() - new Date(laatsteContact).getTime()) / (30.4 * 86_400_000))
        : Infinity;
      if (maanden < nietGezien) continue;
      kolommen.push({
        naam: 'Laatste contact',
        waarde: laatsteContact ? `${laatsteContact.slice(0, 10)} (${maanden} mnd)` : 'nooit',
        toon: maanden >= 24 ? 'urgent' : 'aandacht',
      });
    }

    if (hba1cBoven !== undefined) {
      const waarde = numeriekeWaarde(laatsteMeting(dossier, CODE.hba1c));
      if (waarde === undefined || waarde <= hba1cBoven) continue;
      kolommen.push({ naam: 'HbA1c', waarde: `${waarde}`, toon: waarde > 70 ? 'urgent' : 'aandacht' });
    }

    const n = dossier.patient.naam;
    regels.push({
      patientId: dossier.patient.id,
      naam: [n.voornaam, n.tussenvoegsel, n.achternaam].filter(Boolean).join(' '),
      leeftijd: jaar,
      modules: plan.modules.map((m) => m.naam),
      ketens: plan.ketens.map((k) => k.naam),
      kolommen,
    });
  }

  // Verdeling over aandachtsgebieden: geeft een zoekresultaat een vorm zonder dat je
  // honderd regels hoeft te lezen.
  const telling = new Map<string, number>();
  for (const regel of regels) {
    for (const m of regel.modules) telling.set(m, (telling.get(m) ?? 0) + 1);
  }

  return {
    criteria,
    omschrijving: beschrijving.length === 0
      ? 'Alle ingeschreven patiënten'
      : beschrijving.join(' · '),
    totaal: regels.length,
    vanTotaal: dossiers.length,
    regels: regels.sort((a, b) => a.naam.localeCompare(b.naam)),
    verdeling: [...telling.entries()]
      .map(([label, aantal]) => ({ label, aantal }))
      .sort((a, b) => b.aantal - a.aantal),
    kolomnamen,
  };
}

/**
 * Wat er naar een BI-omgeving mag.
 *
 * Geen namen, geen BSN, geen geboortedatum — alleen geaggregeerde regels met een
 * leeftijdsklasse. Een export met namen is geen rapportage maar een dossierkopie, en die
 * hoort niet buiten het systeem te komen zonder de logging die erbij hoort (docs/07 §4).
 */
export function exporteerGeaggregeerd(rapport: Rapport): {
  regels: Record<string, string | number>[];
  toelichting: string;
} {
  const klasse = (jaar: number) =>
    jaar < 40 ? '< 40' : jaar < 55 ? '40-54' : jaar < 70 ? '55-69' : jaar < 85 ? '70-84' : '85+';

  const groepen = new Map<string, { leeftijdsklasse: string; keten: string; aantal: number }>();
  for (const regel of rapport.regels) {
    const keten = regel.ketens[0] ?? 'geen keten';
    const sleutel = `${klasse(regel.leeftijd)}|${keten}`;
    const bestaand = groepen.get(sleutel);
    if (bestaand) bestaand.aantal++;
    else groepen.set(sleutel, { leeftijdsklasse: klasse(regel.leeftijd), keten, aantal: 1 });
  }

  // Groepen kleiner dan vijf worden samengevoegd: bij een praktijk van tweeduizend
  // mensen is "1 patiënt, 85+, COPD" in de praktijk een naam.
  const groot = [...groepen.values()].filter((g) => g.aantal >= 5);
  const kleinTotaal = [...groepen.values()]
    .filter((g) => g.aantal < 5)
    .reduce((som, g) => som + g.aantal, 0);

  const regels: Record<string, string | number>[] = groot.map((g) => ({
    zoekvraag: rapport.omschrijving,
    leeftijdsklasse: g.leeftijdsklasse,
    keten: g.keten,
    aantal: g.aantal,
  }));
  if (kleinTotaal > 0) {
    regels.push({
      zoekvraag: rapport.omschrijving,
      leeftijdsklasse: 'overig (groepen < 5)',
      keten: 'samengevoegd',
      aantal: kleinTotaal,
    });
  }

  return {
    regels,
    toelichting:
      'Geaggregeerd en gepseudonimiseerd: geen namen, geen BSN, geen geboortedatum. '
      + 'Groepen kleiner dan vijf zijn samengevoegd, omdat een kleine groep in een praktijk '
      + 'herleidbaar is tot een persoon. Wie namen nodig heeft, kijkt in het dossier — met '
      + 'de logging die daarbij hoort.',
  };
}
