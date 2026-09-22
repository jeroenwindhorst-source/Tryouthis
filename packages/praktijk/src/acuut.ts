import type { Rol } from '@zpe/fhir-model';

/**
 * ACUTE INSTROOM
 *
 * De dag is gepland, en dan belt er iemand. Of er komt een portaalbericht binnen waarin
 * iets staat wat niet tot morgen kan. Of een thuismeter stuurt een waarde door die niet
 * klopt. Overdag gaat dat niet naar de huisartsenpost: het moet hier, nu, door iemand
 * worden opgepakt.
 *
 * Twee dingen gaan daar in de praktijk mis, en allebei zijn ze een systeemprobleem:
 *
 *  1. **Het valt niet op.** Een teller die van 3 naar 4 gaat terwijl je een consult doet,
 *     ziet niemand. Een rood cijfertje in een menu is geen melding.
 *  2. **Iedereen ziet het en niemand pakt het op.** Als een signaal bij drie mensen in
 *     beeld staat zonder dat zichtbaar is wie ermee bezig is, gaan er twee mensen bellen
 *     of geen enkele.
 *
 * Daarom: een melding die zich opdringt naar rato van de urgentie, en een expliciete
 * claim. "Ik pak hem op" is geen beleefdheid maar het antwoord op de vraag die de andere
 * twee anders moeten stellen.
 */

export type Acuutbron = 'telefoon' | 'portaal' | 'thuismeting' | 'uitslag' | 'triage';

export type Acuuturgentie = 'spoed' | 'binnen-een-uur' | 'vandaag';

export const URGENTIE_UITLEG: Record<Acuuturgentie, { label: string; opdringen: 'modaal' | 'melding' }> = {
  spoed: { label: 'Spoed — nu handelen', opdringen: 'modaal' },
  'binnen-een-uur': { label: 'Binnen een uur', opdringen: 'melding' },
  vandaag: { label: 'Vandaag', opdringen: 'melding' },
};

export const BRON_LABEL: Record<Acuutbron, string> = {
  telefoon: 'telefoon', portaal: 'portaalbericht', thuismeting: 'thuismeting',
  uitslag: 'binnengekomen uitslag', triage: 'triage',
};

export type Acuutstatus = 'open' | 'opgepakt' | 'afgehandeld';

export interface AcuutSignaal {
  id: string;
  patientId: string;
  naam: string;
  leeftijd: number;
  bron: Acuutbron;
  binnenOp: string;
  urgentie: Acuuturgentie;
  /** Eén regel die je hardop kunt voorlezen. */
  samenvatting: string;
  /** Waaróm dit acuut is. Zonder deze regel is het een onderbuikgevoel van een systeem. */
  onderbouwing: string;
  /** Wat het systeem zou doen. Een voorstel, geen opdracht. */
  voorgesteldeActie: string;
  /** Wie dit kan oppakken. Meestal meer dan één rol — dat is precies het probleem. */
  voorRollen: Rol[];
  status: Acuutstatus;
  opgepaktDoor?: { id: string; naam: string; rol: Rol };
  opgepaktOp?: string;
  afgehandeldOp?: string;
  uitkomst?: string;
  /**
   * Hoeveel seconden na het openen van de sessie dit signaal binnenkomt.
   *
   * Nodig omdat het punt van deze functie is dat er iets binnenkomt terwijl je met iets
   * anders bezig bent. Een lijst die er bij het inloggen al staat, laat dat niet zien.
   */
  naSeconden: number;
}

/**
 * Waar het dossier aan moet voldoen om dit signaal te kunnen dragen.
 *
 * Zonder deze eis krijg je een melding die zegt "COPD met een exacerbatie in de
 * voorgeschiedenis" bij iemand zonder één episode in het dossier. Wie dan doorklikt, ziet
 * een leeg scherm — en leert dat de onderbouwing van een melding niets betekent. Precies
 * de gewoonte die alarmmoeheid maakt.
 */
export interface Dossiereis {
  /** ICPC-prefixen waarvan er ten minste één actief moet zijn. */
  episodes?: string[];
  /**
   * Middelgroepen. Binnen een groep volstaat één treffer, maar élke groep moet raak zijn:
   * "een RAS-remmer én een diureticum" is twee groepen, niet één lijst van vier codes.
   */
  middelgroepen?: string[][];
  /** Er moet al zorg vastgelegd zijn; een leeg dossier draagt geen voorgeschiedenis. */
  minimaalContacten?: number;
}

const SJABLONEN: (Omit<AcuutSignaal, 'id' | 'patientId' | 'naam' | 'leeftijd' | 'binnenOp' | 'status'>
  & { eis: Dossiereis })[] = [
  {
    bron: 'telefoon', urgentie: 'spoed', naSeconden: 0,
    samenvatting: 'Belt zelf: drukkende pijn op de borst sinds een half uur, zweterig.',
    onderbouwing:
      'Zelftriage kwam uit op spoed. Bekend met diabetes en hypertensie; bij deze combinatie '
      + 'is een atypisch beeld eerder regel dan uitzondering.',
    voorgesteldeActie: 'Direct terugbellen door de huisarts; ambulance overwegen. Niet in de wachtrij.',
    voorRollen: ['huisarts', 'assistent'],
    // "Bekend met diabetes en hypertensie" moet in het dossier staan, anders is de
    // onderbouwing een verzinsel.
    eis: { episodes: ['T90', 'K86'], minimaalContacten: 3 },
  },
  {
    bron: 'portaal', urgentie: 'binnen-een-uur', naSeconden: 40,
    samenvatting: 'Portaalbericht: sinds gisteravond benauwder, pufjes helpen minder goed.',
    onderbouwing:
      'COPD met een exacerbatie in de voorgeschiedenis. Toename van klachten met verminderde '
      + 'reactie op luchtwegverwijders wijst op een exacerbatie die vandaag beoordeeld moet worden.',
    voorgesteldeActie: 'Vandaag zien, bij voorkeur op de praktijk. Anders videoconsult met beeld van de ademhaling.',
    voorRollen: ['huisarts', 'poh-s', 'assistent'],
    // COPD én een luchtwegverwijder: "de pufjes helpen minder goed" veronderstelt pufjes.
    eis: { episodes: ['R95', 'R96'], middelgroepen: [['R03']], minimaalContacten: 3 },
  },
  {
    bron: 'thuismeting', urgentie: 'binnen-een-uur', naSeconden: 95,
    samenvatting: 'Thuismeter geeft 212/118 door, twee metingen achter elkaar.',
    onderbouwing:
      'Waarden ver boven de streefwaarde en boven de drempel voor beoordeling op dezelfde dag. '
      + 'Bij deze hoogte hoort nagevraagd te worden of er klachten bij zijn.',
    voorgesteldeActie: 'Bellen: klachten uitvragen (hoofdpijn, visus, pijn op de borst). Zonder klachten vandaag herhalen.',
    voorRollen: ['huisarts', 'poh-s'],
    // Een thuismeter hoort bij iemand die voor zijn bloeddruk behandeld wordt.
    eis: { episodes: ['K86', 'K87'], middelgroepen: [['C09', 'C07', 'C08', 'C03']], minimaalContacten: 3 },
  },
  {
    bron: 'uitslag', urgentie: 'vandaag', naSeconden: 150,
    samenvatting: 'Labuitslag binnen: kalium 6,2 mmol/l.',
    onderbouwing:
      'Fors verhoogd kalium bij gebruik van een RAS-remmer en een diureticum. Dit is een '
      + 'uitslag die niet in de autorisatiestapel hoort te wachten.',
    voorgesteldeActie: 'Vandaag bellen, medicatie tijdelijk staken en binnen 48 uur opnieuw prikken.',
    voorRollen: ['huisarts'],
    // De onderbouwing noemt een RAS-remmer én een diureticum; die moeten er dus zijn.
    eis: { middelgroepen: [['C09'], ['C03']], minimaalContacten: 3 },
  },
];

/** Kandidaat voor een acuut signaal, met net genoeg dossier om de eis te kunnen toetsen. */
export interface Acuutkandidaat {
  patientId: string;
  naam: string;
  leeftijd: number;
  /** ICPC-codes van de actieve episodes. */
  icpc: string[];
  /** ATC-codes van de actief gebruikte middelen. */
  atc: string[];
  aantalContacten: number;
}

function voldoet(kandidaat: Acuutkandidaat, eis: Dossiereis): boolean {
  if (eis.minimaalContacten && kandidaat.aantalContacten < eis.minimaalContacten) return false;
  if (eis.episodes && !eis.episodes.some((p) => kandidaat.icpc.some((c) => c.startsWith(p)))) return false;
  for (const groep of eis.middelgroepen ?? []) {
    if (!groep.some((p) => kandidaat.atc.some((c) => c.startsWith(p)))) return false;
  }
  return true;
}

/**
 * Elk signaal krijgt een patiënt wiens dossier het verhaal draagt.
 *
 * Deterministisch: de kandidaten staan in vaste volgorde en per sjabloon wordt de eerste
 * passende gekozen die nog niet gebruikt is. Past er niemand, dan komt het signaal er niet
 * — liever één melding minder dan een melding die bij doorklikken nergens op slaat.
 */
export function genereerAcuteSignalen(
  kandidaten: Acuutkandidaat[], peildatum: Date,
): AcuutSignaal[] {
  const vergeven = new Set<string>();
  return SJABLONEN.flatMap(({ eis, ...sjabloon }, i) => {
    const patient = kandidaten.find((k) => !vergeven.has(k.patientId) && voldoet(k, eis));
    if (!patient) return [];
    vergeven.add(patient.patientId);
    const binnen = new Date(peildatum);
    binnen.setMinutes(binnen.getMinutes() - (SJABLONEN.length - i) * 3);
    return [{
      ...sjabloon,
      id: `acuut-${i + 1}`,
      patientId: patient.patientId,
      naam: patient.naam,
      leeftijd: patient.leeftijd,
      binnenOp: binnen.toISOString(),
      status: 'open' as const,
    }];
  });
}

/** Wat deze gebruiker kan oppakken, urgentste eerst. */
export function acuutVoor(signalen: AcuutSignaal[], rol: Rol): AcuutSignaal[] {
  const rang: Record<Acuuturgentie, number> = { spoed: 0, 'binnen-een-uur': 1, vandaag: 2 };
  return signalen
    .filter((s) => s.voorRollen.includes(rol))
    .sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open')
      || rang[a.urgentie] - rang[b.urgentie]
      || a.binnenOp.localeCompare(b.binnenOp));
}
