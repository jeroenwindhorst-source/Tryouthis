import type { Dossier } from '@zpe/fhir-model';
import { isEigenRegistratie, laatsteMeting, leeftijd, metingReeks, numeriekeWaarde } from '@zpe/fhir-model';
import { CODE, type Zorgplan } from '@zpe/care-engine';
import { metingNaam } from './terminologie.js';
import type { ExternDocument } from './externe-bronnen.js';
import type { Beleidsafspraak } from './beleidsafspraken.js';
import type { Order } from './orderopslag.js';

/**
 * DE SAMENVATTING
 *
 * De eerste vraag bij een dossier dat je niet kent is niet "wat is de laatste HbA1c" maar
 * "wie is dit en wat speelt er". Dat antwoord staat nu verspreid over acht kaarten, en
 * een zorgverlener stelt het zelf samen door te lezen — elke keer opnieuw, en bij elke
 * waarnemer opnieuw.
 *
 * Deze module stelt het verhaal samen uit wat er in het dossier staat. Vijf alinea's, in
 * de volgorde waarin de vragen komen: wie, wat speelt er, hoe gaat het, wat is er het
 * afgelopen jaar gebeurd, en wat staat er open.
 *
 * ⚠️ **Dit is regelgebaseerd, geen taalmodel.** Dat is een bewuste keuze voor deze fase,
 * en niet omdat een taalmodel het slechter zou doen — integendeel, een goed model schrijft
 * dit soepeler en vangt nuance die deze regels missen. Maar een gegenereerde samenvatting
 * van een dossier is klinische beslissingsondersteuning: hij stuurt waar de zorgverlener
 * naar kijkt. Dat vraagt herkomst per zin, een manier om terug te klikken naar de bron,
 * en een MDR-beoordeling (ADR-0005). Zolang dat er niet is, is regelgebaseerd het eerlijke
 * antwoord: saaier, maar navolgbaar en reproduceerbaar.
 *
 * Wat hier wél al staat is de vorm waarin een gegenereerde samenvatting moet landen:
 * losse alinea's met elk hun eigen bron, zodat elke zin terug te voeren is op wat er in
 * het dossier staat.
 */

export interface Alinea {
  id: string;
  titel: string;
  tekst: string;
  /** Waar dit op berust; per alinea, zodat het navolgbaar blijft. */
  bron: string;
  /** Vraagt deze alinea aandacht? Bepaalt de nadruk, niet de inhoud. */
  nadruk?: 'aandacht' | 'urgent';
}

export interface Kerngetal {
  label: string;
  waarde: string;
  onder?: string;
  toon?: 'ok' | 'aandacht' | 'urgent';
}

export interface Samenvatting {
  kop: string;
  alineas: Alinea[];
  kerngetallen: Kerngetal[];
  herkomst: { soort: 'regelgebaseerd'; versie: string; toelichting: string };
}

export const SAMENVATTING_VERSIE = '2026.09.1';

const jaren = (datum: string | undefined, peildatum: Date): number | undefined => {
  if (!datum) return undefined;
  return Math.floor((peildatum.getTime() - new Date(datum).getTime()) / (365.25 * 86_400_000));
};

const lijst = (items: string[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} en ${items.at(-1)}`;
};

/** Meetwaarden die een verhaal vertellen, in de volgorde waarin je ze zou noemen. */
const KERNMETINGEN: { code: string; streef?: number; richting: 'onder' | 'boven'; eenheid: string }[] = [
  { code: CODE.hba1c, streef: 53, richting: 'onder', eenheid: 'mmol/mol' },
  { code: CODE.rrSys, streef: 140, richting: 'onder', eenheid: 'mmHg' },
  { code: CODE.ldl, streef: 2.6, richting: 'onder', eenheid: 'mmol/l' },
  { code: CODE.egfr, streef: 60, richting: 'boven', eenheid: 'ml/min' },
];

export function bouwSamenvatting(gegevens: {
  dossier: Dossier;
  plan: Zorgplan;
  peildatum: Date;
  extern: ExternDocument[];
  beleid: Beleidsafspraak[];
  orders: Order[];
  openAutorisaties: number;
  openBespreekpunten: number;
}): Samenvatting {
  const { dossier, plan, peildatum, extern, beleid, orders } = gegevens;
  const jaar = leeftijd(dossier, peildatum);
  const naam = [dossier.patient.naam.voornaam, dossier.patient.naam.tussenvoegsel,
    dossier.patient.naam.achternaam].filter(Boolean).join(' ');
  const alineas: Alinea[] = [];

  // ── Wie is dit ────────────────────────────────────────────────────────────
  const actief = dossier.episodes.filter((e) => e.status === 'active');
  const langst = actief
    .map((e) => ({ titel: e.titel, sinds: jaren(e.periode.start, peildatum) }))
    .filter((e) => e.sinds !== undefined)
    .sort((a, b) => (b.sinds ?? 0) - (a.sinds ?? 0))[0];

  alineas.push({
    id: 'wie',
    titel: 'Wie is dit',
    tekst: `${naam}, ${jaar} jaar. `
      + (actief.length === 0
        ? 'Geen actieve episodes in het dossier; dit is een patiënt zonder lopende chronische zorgvraag.'
        : `${actief.length} actieve ${actief.length === 1 ? 'episode' : 'episodes'}`
          + (langst?.sinds ? `, waarvan ${langst.titel.toLowerCase()} het langst loopt (${langst.sinds} jaar)` : '')
          + '.')
      + (dossier.patient.portaalActief
        ? ' Gebruikt het patiëntportaal.'
        : ' Heeft geen portaalaccount — digitale oproepen komen niet aan.'),
    bron: 'patiëntgegevens en episodelijst',
  });

  // ── Wat speelt er ─────────────────────────────────────────────────────────
  if (plan.modules.length > 0) {
    const gebieden = plan.modules.map((m) => m.naam.toLowerCase());
    const ketens = plan.ketens.map((k) => k.naam);
    alineas.push({
      id: 'speelt',
      titel: 'Wat speelt er',
      tekst: `Het protocol volgt ${plan.modules.length} aandachtsgebied`
        + `${plan.modules.length === 1 ? '' : 'en'}: ${lijst(gebieden)}. `
        + (ketens.length > 0
          ? `Valt onder ${lijst(ketens)}.`
          : 'Valt onder geen enkele landelijke keten — wel chronische zorg, geen programma.'),
      bron: `zorgplan, regelset ${plan.modules[0]?.richtlijnen[0]?.versie ?? ''}`.trim(),
      nadruk: ketens.length === 0 ? 'aandacht' : undefined,
    });
  }

  // ── Hoe gaat het ──────────────────────────────────────────────────────────
  const bevindingen: string[] = [];
  let ietsBuitenStreef = false;
  for (const kern of KERNMETINGEN) {
    const laatste = laatsteMeting(dossier, kern.code);
    const waarde = numeriekeWaarde(laatste);
    if (waarde === undefined || !laatste) continue;
    const reeks = metingReeks(dossier, kern.code)
      .map((o) => numeriekeWaarde(o))
      .filter((w): w is number => typeof w === 'number');
    const vorige = reeks.at(-2);
    const richting = vorige === undefined ? ''
      : waarde > vorige ? ' (gestegen)' : waarde < vorige ? ' (gedaald)' : ' (stabiel)';
    const buiten = kern.streef !== undefined
      && (kern.richting === 'onder' ? waarde > kern.streef : waarde < kern.streef);
    if (buiten) ietsBuitenStreef = true;
    bevindingen.push(
      `${metingNaam(kern.code)} ${waarde} ${kern.eenheid}${richting}`
      + (buiten ? ` — buiten de streefwaarde` : ''),
    );
  }

  if (bevindingen.length > 0) {
    alineas.push({
      id: 'hoe',
      titel: 'Hoe gaat het',
      tekst: `${lijst(bevindingen)}.`
        + (ietsBuitenStreef ? '' : ' Alle kernwaarden binnen de streefwaarde.'),
      bron: 'laatste eigen registraties uit het dossier',
      nadruk: ietsBuitenStreef ? 'aandacht' : undefined,
    });
  }

  if (plan.zelfredzaamheid && plan.zelfredzaamheid.gemiddelde > 0) {
    const z = plan.zelfredzaamheid;
    alineas.push({
      id: 'zelfredzaamheid',
      titel: 'Wat deze mens zelf kan',
      tekst: `Zelfredzaamheid ${z.gemiddelde} van 5 (${z.niveau})`
        + (z.trend?.richting === 'achteruit' ? `, gedaald met ${Math.abs(z.trend.verschil)} punt` : '')
        + '. '
        + (z.knelpunten.length > 0
          ? `Knelpunten: ${lijst(z.knelpunten.map((k) => k.domein.naam.toLowerCase()))}. `
          : '')
        + `Contact-intervallen staan hierdoor op factor ${z.factor}.`
        + (z.digitaalBereikbaar ? '' : ' Digitale oproep is niet passend.'),
      bron: z.bijgesteld
        ? `zelfredzaamheidsinventarisatie, handmatig bijgesteld door ${z.bijgesteld.door}`
        : 'zelfredzaamheidsinventarisatie',
      nadruk: z.gemiddelde < 3 || z.trend?.richting === 'achteruit' ? 'aandacht' : undefined,
    });
  }

  // ── Het afgelopen jaar ────────────────────────────────────────────────────
  const eenJaarTerug = new Date(peildatum);
  eenJaarTerug.setFullYear(eenJaarTerug.getFullYear() - 1);
  const grens = eenJaarTerug.toISOString().slice(0, 10);

  const contactenJaar = dossier.deelcontacten
    .filter((dc) => dc.herkomst.vastgelegdOp.slice(0, 10) >= grens).length;
  const externJaar = extern.filter((d) => d.datum >= grens);
  const ziekenhuis = externJaar.filter((d) => d.bron.soort === 'ziekenhuis');

  const stukken: string[] = [];
  stukken.push(contactenJaar === 0
    ? 'geen contacten vastgelegd in de praktijk'
    : `${contactenJaar} ${contactenJaar === 1 ? 'contact' : 'contacten'} in de praktijk`);
  if (ziekenhuis.length > 0) {
    stukken.push(`${ziekenhuis.length} bericht${ziekenhuis.length === 1 ? '' : 'en'} uit het ziekenhuis `
      + `(${lijst([...new Set(ziekenhuis.map((d) => d.titel.toLowerCase()))])})`);
  }
  const overigExtern = externJaar.length - ziekenhuis.length;
  if (overigExtern > 0) {
    stukken.push(`${overigExtern} bericht${overigExtern === 1 ? '' : 'en'} van andere zorgverleners`);
  }

  alineas.push({
    id: 'jaar',
    titel: 'Het afgelopen jaar',
    tekst: `${lijst(stukken).replace(/^./, (c) => c.toUpperCase())}.`
      + (contactenJaar === 0 && plan.modules.length > 0
        ? ' Dat is opvallend bij iemand met een lopende chronische zorgvraag.'
        : ''),
    bron: 'journaal en binnengekomen berichten',
    nadruk: contactenJaar === 0 && plan.modules.length > 0 ? 'aandacht' : undefined,
  });

  // ── Wat staat er open ─────────────────────────────────────────────────────
  const openOrders = orders.filter((o) => o.status === 'geplaatst' || o.status === 'ter-autorisatie');
  const openPunten: string[] = [];
  if (openOrders.length > 0) {
    openPunten.push(`${openOrders.length} lopende order${openOrders.length === 1 ? '' : 's'}`);
  }
  if (gegevens.openAutorisaties > 0) {
    openPunten.push(`${gegevens.openAutorisaties} verzoek(en) ter accordering`);
  }
  if (gegevens.openBespreekpunten > 0) {
    openPunten.push(`${gegevens.openBespreekpunten} punt(en) op de bespreeklijst`);
  }
  if (plan.contacten[0]) {
    openPunten.push(`volgend contact gepland op ${plan.contacten[0].datum}`);
  }

  alineas.push({
    id: 'open',
    titel: 'Wat staat er open',
    tekst: openPunten.length === 0
      ? 'Niets openstaand.'
      : `${lijst(openPunten).replace(/^./, (c) => c.toUpperCase())}.`,
    bron: 'orders, autorisaties, bespreeklijst en zorgplan',
  });

  // ── Behandelgrenzen ───────────────────────────────────────────────────────
  const grenzen = beleid.filter((b) => b.besluit === 'niet');
  if (grenzen.length > 0) {
    alineas.push({
      id: 'grenzen',
      titel: 'Behandelgrenzen',
      tekst: `${lijst(grenzen.map((b) => b.samenvatting))} Besproken met `
        + `${lijst([...new Set(grenzen.map((b) => b.besprokenMet))])}.`,
      bron: `vastgelegd door ${lijst([...new Set(grenzen.map((b) => b.vastgelegdDoor.naam))])}`,
      nadruk: 'urgent',
    });
  }

  // ── Kerngetallen ──────────────────────────────────────────────────────────
  const chronisch = dossier.medicatie.filter((m) => m.status === 'active' && m.chronisch).length;
  const eigenMetingen = dossier.observaties.filter((o) => isEigenRegistratie(o.herkomst)).length;
  const vanPatient = dossier.observaties.filter((o) => o.herkomst.bron === 'patient').length;

  const kerngetallen: Kerngetal[] = [
    { label: 'Leeftijd', waarde: `${jaar}` },
    { label: 'Actieve episodes', waarde: `${actief.length}` },
    { label: 'Chronische medicatie', waarde: `${chronisch}`,
      toon: chronisch >= 5 ? 'aandacht' : undefined,
      onder: chronisch >= 5 ? 'polyfarmacie' : undefined },
    { label: 'Contacten dit jaar', waarde: `${contactenJaar}` },
    { label: 'Eigen metingen', waarde: `${eigenMetingen}`,
      onder: vanPatient > 0 ? `plus ${vanPatient} van de patiënt` : undefined },
    { label: 'Van buiten ontvangen', waarde: `${extern.length}`,
      onder: extern.filter((d) => !d.gelezen).length > 0
        ? `${extern.filter((d) => !d.gelezen).length} ongelezen` : undefined,
      toon: extern.filter((d) => !d.gelezen).length > 0 ? 'aandacht' : undefined },
  ];

  return {
    kop: `${naam} · ${jaar} jaar`,
    alineas,
    kerngetallen,
    herkomst: {
      soort: 'regelgebaseerd',
      versie: SAMENVATTING_VERSIE,
      toelichting:
        'Samengesteld uit het dossier met vaste regels, niet met een taalmodel. Elke alinea '
        + 'noemt waarop hij berust. Een gegenereerde samenvatting is klinische '
        + 'beslissingsondersteuning en vraagt herkomst per zin plus een MDR-beoordeling '
        + '(ADR-0005); zolang dat er niet is, is dit het eerlijke antwoord.',
    },
  };
}
