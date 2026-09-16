import type { Dossier, MedicationStatement } from '@zpe/fhir-model';
import { rng } from './populatie.js';

/**
 * MEDICATIE WIJZIGEN
 *
 * Een middel aanpassen is in de praktijk één handeling en in een dossier vier:
 *
 *  1. het lopende middel stopt,
 *  2. het nieuwe middel start,
 *  3. de openstaande order voor het oude middel wordt ingetrokken,
 *  4. er gaat een nieuw recept de deur uit.
 *
 * Bestaande systemen laten die vier los van elkaar doen, en dat is precies waar het
 * misgaat: iemand verhoogt de dosering in het medicatieoverzicht maar vergeet het recept,
 * of stuurt een recept zonder het oude te stoppen en dan staat er twee keer metformine in
 * het dossier. De apotheek ziet dat, de patiënt niet.
 *
 * Daarom is dit één transactie met één bevestiging, en staat er vóór het bevestigen
 * letterlijk wat er gaat gebeuren. Niet als waarschuwing maar als samenvatting: dit stopt,
 * dat start, dit recept gaat hierheen.
 *
 * ⚠️ Demomateriaal. Er is geen G-Standaard, geen interactiebewaking en geen
 * receptverkeer (NHG-Tabel 25 / EDIFACT / het LSP). Wat hier staat is het werkproces en
 * de velden die het nodig heeft.
 */

export type Afleverroute = 'digitaal' | 'print' | 'meegeven';

export interface Apotheek {
  id: string;
  naam: string;
  plaats: string;
  /** Kan deze apotheek recepten elektronisch ontvangen? Zo niet, dan is printen de route. */
  digitaal: boolean;
  /** Vrije tekst die de zorgverlener helpt kiezen: openingstijden, bezorging, dienstapotheek. */
  bijzonderheid?: string;
}

/**
 * De apotheken waar deze praktijk mee werkt.
 *
 * Bewust een lijst en geen instelling met één vaste apotheek. De patiënt heeft een
 * voorkeur, maar die geldt niet elke dag: wie morgen bij zijn dochter logeert wil het
 * recept daar ophalen, en wie vanmiddag nog wil starten kiest de apotheek om de hoek.
 * Een systeem dat de voorkeursapotheek vastzet, dwingt de zorgverlener tot bellen.
 */
export const APOTHEKEN: Apotheek[] = [
  { id: 'apo-linde', naam: 'Apotheek De Linde', plaats: 'Zutphen', digitaal: true,
    bijzonderheid: 'In het pand naast de praktijk; bezorgt op dinsdag en vrijdag.' },
  { id: 'apo-markt', naam: 'Marktapotheek', plaats: 'Zutphen', digitaal: true,
    bijzonderheid: 'Open tot 18:00, zaterdag tot 13:00.' },
  { id: 'apo-berkel', naam: 'Apotheek Berkelpoort', plaats: 'Zutphen', digitaal: true,
    bijzonderheid: 'Verzorgt de weekdozen voor de thuiszorg.' },
  { id: 'apo-warnsveld', naam: 'Dorpsapotheek Warnsveld', plaats: 'Warnsveld', digitaal: true },
  { id: 'apo-service', naam: 'Service Apotheek Eefde', plaats: 'Eefde', digitaal: false,
    bijzonderheid: 'Geen elektronische ontvangst; recept meegeven of faxen.' },
  { id: 'apo-dienst', naam: 'Dienstapotheek Gelre', plaats: 'Zutphen', digitaal: true,
    bijzonderheid: 'Buiten kantooruren en in het weekend.' },
];

export function vindApotheek(id: string): Apotheek | undefined {
  return APOTHEKEN.find((a) => a.id === id);
}

/** Waar dit recept heen gaat. Eén keuze per recept, niet één instelling per patiënt. */
export interface Aflevering {
  route: Afleverroute;
  /** Bij route 'digitaal': naar welke apotheek. */
  apotheekId?: string;
  /** Vrije aanvulling voor de apotheek: met spoed, in weekdoos, kleine verpakking. */
  opmerking?: string;
}

export type Wijzigingsoort = 'dosering' | 'vervangen' | 'stoppen' | 'starten';

export const WIJZIGING_LABEL: Record<Wijzigingsoort, string> = {
  dosering: 'Dosering aanpassen',
  vervangen: 'Vervangen door een ander middel',
  stoppen: 'Stoppen',
  starten: 'Nieuw middel starten',
};

export interface Medicatiewijziging {
  patientId: string;
  soort: Wijzigingsoort;
  /** Welk lopend middel dit raakt. Leeg bij 'starten'. */
  statementId?: string;
  /** Bij 'dosering', 'vervangen' en 'starten': wat het wordt. */
  nieuw?: { atc: string; naam: string; dosering: string; chronisch?: boolean };
  /** Waarom. Verplicht: een wijziging zonder reden is over een jaar niet te lezen. */
  reden: string;
  aflevering: Aflevering;
  /** Aan welke episode deze wijziging hangt, als die bekend is. */
  episodeId?: string;
}

/**
 * Veelgebruikte redenen, als knop.
 *
 * Niet om typen te besparen maar om te zorgen dát er een reden staat. Een verplicht vrij
 * tekstveld levert "ivm" op; een lijst met wat er werkelijk speelt levert iets op wat een
 * collega over een jaar kan lezen.
 */
export const REDENEN: Record<Wijzigingsoort, string[]> = {
  dosering: [
    'Streefwaarde niet gehaald bij de huidige dosering',
    'Bijwerkingen bij de huidige dosering',
    'Nierfunctie gedaald — dosering aangepast',
    'Afbouwen volgens afspraak',
  ],
  vervangen: [
    'Onvoldoende effect van het huidige middel',
    'Bijwerkingen die de patiënt niet volhoudt',
    'Interactie met nieuw gestart middel',
    'Op advies van de specialist',
    'Voorkeursmiddel van de zorgverzekeraar niet leverbaar',
  ],
  stoppen: [
    'Niet langer geïndiceerd',
    'Bijwerkingen',
    'Op verzoek van de patiënt',
    'Afgesproken in de medicatiebeoordeling',
    'Behandelgrens: minderen van medicatie',
  ],
  starten: [
    'Nieuwe indicatie',
    'Streefwaarde niet gehaald met leefstijl alleen',
    'Op advies van de specialist',
  ],
};

/**
 * Wat er gaat gebeuren, in zinnen die je hardop kunt voorlezen.
 *
 * Dit is geen bevestigingsdialoog die je wegklikt maar het overzicht waarop je tekent.
 * Het staat er vóór de knop en niet erna, want daarna is het een mededeling.
 */
export function beschrijfWijziging(
  wijziging: Medicatiewijziging, huidig?: MedicationStatement,
): { regels: string[]; waarschuwing?: string } {
  const regels: string[] = [];
  const huidigeNaam = huidig?.middel.text ?? huidig?.middel.coding?.[0]?.display ?? 'het huidige middel';

  if (wijziging.soort === 'dosering' && huidig) {
    regels.push(`${huidigeNaam} ${huidig.dosering} stopt vandaag.`);
    regels.push(`${huidigeNaam} ${wijziging.nieuw?.dosering ?? ''} start vandaag.`);
  }
  if (wijziging.soort === 'vervangen' && huidig) {
    regels.push(`${huidigeNaam} ${huidig.dosering} stopt vandaag.`);
    regels.push(`${wijziging.nieuw?.naam ?? 'Het nieuwe middel'} ${wijziging.nieuw?.dosering ?? ''} start vandaag.`);
  }
  if (wijziging.soort === 'stoppen' && huidig) {
    regels.push(`${huidigeNaam} ${huidig.dosering} stopt vandaag.`);
    regels.push('Er gaat geen nieuw recept uit.');
  }
  if (wijziging.soort === 'starten') {
    regels.push(`${wijziging.nieuw?.naam ?? 'Het nieuwe middel'} ${wijziging.nieuw?.dosering ?? ''} start vandaag.`);
  }

  if (huidig && wijziging.soort !== 'starten') {
    regels.push(`Een openstaande order voor ${huidigeNaam} wordt ingetrokken.`);
  }

  if (wijziging.soort !== 'stoppen') {
    const apotheek = wijziging.aflevering.apotheekId
      ? vindApotheek(wijziging.aflevering.apotheekId) : undefined;
    if (wijziging.aflevering.route === 'digitaal' && apotheek) {
      regels.push(`Het recept gaat elektronisch naar ${apotheek.naam} in ${apotheek.plaats}.`);
    }
    if (wijziging.aflevering.route === 'print') {
      regels.push('Het recept wordt geprint en meegegeven of opgehaald aan de balie.');
    }
    if (wijziging.aflevering.route === 'meegeven') {
      regels.push('De patiënt neemt het recept zelf mee naar een apotheek naar keuze.');
    }
  }

  // Een apotheek die niet elektronisch ontvangt, is geen foutmelding maar een feit dat je
  // moet weten vóór je op versturen drukt — anders staat de patiënt er morgen voor niets.
  const apotheek = wijziging.aflevering.apotheekId
    ? vindApotheek(wijziging.aflevering.apotheekId) : undefined;
  const waarschuwing = wijziging.aflevering.route === 'digitaal' && apotheek && !apotheek.digitaal
    ? `${apotheek.naam} ontvangt geen elektronische recepten. Kies printen of een andere apotheek.`
    : undefined;

  return { regels, waarschuwing };
}

/**
 * Welke apotheek deze patiënt gewoonlijk gebruikt.
 *
 * Deterministisch afgeleid uit het patiënt-id, zodat de demo reproduceerbaar is. In
 * productie is dit een gegeven bij de patiënt, dat de patiënt zelf via het portaal
 * bijwerkt — en dat een zorgverlener per recept mag overrulen.
 */
export function voorkeursapotheek(dossier: Dossier): Apotheek {
  const willekeurig = rng(dossier.patient.id.length * 97 + dossier.patient.id.charCodeAt(dossier.patient.id.length - 1));
  // De dienstapotheek is nooit iemands vaste apotheek; die is er voor buiten kantooruren.
  const vaste = APOTHEKEN.filter((a) => a.id !== 'apo-dienst');
  return vaste[Math.floor(willekeurig() * vaste.length)];
}

/** Hoort deze order bij dit middel? Op ATC, niet op naam: een naam verandert, een code niet. */
export function isOrderVoor(orderAtc: string | undefined, atc: string | undefined): boolean {
  return Boolean(orderAtc && atc && orderAtc === atc);
}
