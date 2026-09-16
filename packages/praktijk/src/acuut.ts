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

const SJABLONEN: (Omit<AcuutSignaal, 'id' | 'patientId' | 'naam' | 'leeftijd' | 'binnenOp' | 'status'>)[] = [
  {
    bron: 'telefoon', urgentie: 'spoed', naSeconden: 0,
    samenvatting: 'Belt zelf: drukkende pijn op de borst sinds een half uur, zweterig.',
    onderbouwing:
      'Zelftriage kwam uit op spoed. Bekend met diabetes en hypertensie; bij deze combinatie '
      + 'is een atypisch beeld eerder regel dan uitzondering.',
    voorgesteldeActie: 'Direct terugbellen door de huisarts; ambulance overwegen. Niet in de wachtrij.',
    voorRollen: ['huisarts', 'assistent'],
  },
  {
    bron: 'portaal', urgentie: 'binnen-een-uur', naSeconden: 40,
    samenvatting: 'Portaalbericht: sinds gisteravond benauwder, pufjes helpen minder goed.',
    onderbouwing:
      'COPD met een exacerbatie in de voorgeschiedenis. Toename van klachten met verminderde '
      + 'reactie op luchtwegverwijders wijst op een exacerbatie die vandaag beoordeeld moet worden.',
    voorgesteldeActie: 'Vandaag zien, bij voorkeur op de praktijk. Anders videoconsult met beeld van de ademhaling.',
    voorRollen: ['huisarts', 'poh-s', 'assistent'],
  },
  {
    bron: 'thuismeting', urgentie: 'binnen-een-uur', naSeconden: 95,
    samenvatting: 'Thuismeter geeft 212/118 door, twee metingen achter elkaar.',
    onderbouwing:
      'Waarden ver boven de streefwaarde en boven de drempel voor beoordeling op dezelfde dag. '
      + 'Bij deze hoogte hoort nagevraagd te worden of er klachten bij zijn.',
    voorgesteldeActie: 'Bellen: klachten uitvragen (hoofdpijn, visus, pijn op de borst). Zonder klachten vandaag herhalen.',
    voorRollen: ['huisarts', 'poh-s'],
  },
  {
    bron: 'uitslag', urgentie: 'vandaag', naSeconden: 150,
    samenvatting: 'Labuitslag binnen: kalium 6,2 mmol/l.',
    onderbouwing:
      'Fors verhoogd kalium bij gebruik van een RAS-remmer en een diureticum. Dit is een '
      + 'uitslag die niet in de autorisatiestapel hoort te wachten.',
    voorgesteldeActie: 'Vandaag bellen, medicatie tijdelijk staken en binnen 48 uur opnieuw prikken.',
    voorRollen: ['huisarts'],
  },
];

export function genereerAcuteSignalen(
  patienten: { patientId: string; naam: string; leeftijd: number }[], peildatum: Date,
): AcuutSignaal[] {
  return SJABLONEN.flatMap((sjabloon, i) => {
    const patient = patienten[i * 9 + 4];
    if (!patient) return [];
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
