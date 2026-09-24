import type { Rol } from '@zpe/fhir-model';

/**
 * WERKTAKEN — wat er gebeurt nadat je op een knop hebt gedrukt
 *
 * Een knop die 'bellen en herinneren' heet en alleen een merkje in het scherm verandert,
 * is een demo van een knop. Bij de volgende keer inloggen staat dezelfde regel er weer,
 * en niemand is gebeld.
 *
 * Wat eraan ontbrak is de tussenstap die in een praktijk vanzelfsprekend is: *wie doet
 * het?* Bellen dat de uitslag ontbreekt kan de assistent prima, de uitslag zelf bespreken
 * niet. Dat besluit hoort bij het uitzetten van de taak en niet ergens in een instelling,
 * want het verschilt per geval en per dag — dezelfde POH pakt het ene zelf op en legt het
 * andere neer.
 *
 * Een werktaak is daarom hetzelfde soort ding als een order (ADR-0009): een verzoek met
 * een bestemming, een reden en een status, dat je kunt volgen tot het af is. Het verschil
 * is dat een order de praktijk verlaat en een werktaak erbinnen blijft.
 */

export type Taaksoort =
  | 'bellen'
  | 'inplannen'
  | 'voorbereiden'
  | 'uitslag-bespreken'
  | 'bericht-sturen'
  | 'administratie';

export type Taakstatus = 'open' | 'gepland' | 'afgerond';

export interface Taaksoortdefinitie {
  id: Taaksoort;
  label: string;
  /** Wat er feitelijk gebeurt — in het paneel, onder de keuze. */
  uitleg: string;
  icoon: string;
  duurMinuten: number;
  /** Bij wie dit standaard terechtkomt. Altijd te overrulen. */
  standaardRol: Rol;
  /** Rollen die dit werk kunnen doen. Een uitslag bespreken hoort niet bij de assistent. */
  rollen: Rol[];
}

/**
 * De soorten werk die een taak kan zijn.
 *
 * Bewust een korte, gesloten lijst. Een vrij tekstveld levert binnen een maand vijftien
 * varianten op van 'patiënt bellen' en dan valt er niets meer over te zeggen — niet in
 * een werklijst, niet in een agenda en niet in een rapportage.
 */
export const TAAKSOORTEN: Taaksoortdefinitie[] = [
  {
    id: 'bellen',
    label: 'Patiënt bellen',
    uitleg: 'Iemand belt de patiënt en legt uit wat er nodig is. Komt als belafspraak op '
      + 'de werklijst; de uitkomst landt als contact in het dossier.',
    icoon: 'gesprek',
    duurMinuten: 10,
    standaardRol: 'assistent',
    rollen: ['assistent', 'poh-s', 'huisarts'],
  },
  {
    id: 'inplannen',
    label: 'Afspraak verzetten of plannen',
    uitleg: 'De bestaande afspraak wordt verzet of er komt een nieuwe. Komt op het '
      + 'planbord te staan bij wie hem oppakt.',
    icoon: 'agenda',
    duurMinuten: 5,
    standaardRol: 'assistent',
    rollen: ['assistent', 'poh-s'],
  },
  {
    id: 'voorbereiden',
    label: 'Zelf uitzoeken',
    uitleg: 'Dossier nalopen, uitslagen naast elkaar leggen, overleg voorbereiden. '
      + 'Werk dat tijd kost en dus een plek in de agenda verdient.',
    icoon: 'klembord',
    duurMinuten: 15,
    standaardRol: 'poh-s',
    rollen: ['poh-s', 'huisarts'],
  },
  {
    id: 'uitslag-bespreken',
    label: 'Uitslag bespreken',
    uitleg: 'Een afwijkende waarde met de patiënt doornemen. Hoort bij wie de uitslag kan '
      + 'duiden, niet bij wie hem kan voorlezen.',
    icoon: 'buisje',
    duurMinuten: 10,
    standaardRol: 'poh-s',
    rollen: ['poh-s', 'huisarts'],
  },
  {
    id: 'bericht-sturen',
    label: 'Bericht sturen via het portaal',
    uitleg: 'Een bericht aan de patiënt, met de aanleiding erbij. Telt als contact en is '
      + 'declarabel (docs/19).',
    icoon: 'gesprek',
    duurMinuten: 5,
    standaardRol: 'poh-s',
    rollen: ['poh-s', 'assistent', 'huisarts'],
  },
  {
    id: 'administratie',
    label: 'Uitzoeken en vastleggen',
    uitleg: 'Administratief werk dat geen klinische beslissing vraagt, maar wel tijd.',
    icoon: 'lijst',
    duurMinuten: 15,
    standaardRol: 'assistent',
    rollen: ['assistent', 'poh-s', 'huisarts'],
  },
];

export function vindTaaksoort(id: Taaksoort): Taaksoortdefinitie {
  return TAAKSOORTEN.find((s) => s.id === id) ?? TAAKSOORTEN[0];
}

export interface Werktaak {
  id: string;
  soort: Taaksoort;
  titel: string;
  /** Waarom dit nodig is. Zonder aanleiding is een taak een opdracht zonder context. */
  aanleiding: string;
  patientId?: string;
  patientNaam?: string;
  /** Waar de taak vandaan komt, zodat het scherm die hem veroorzaakte hem kan terugvinden. */
  bron: { soort: 'aanloop' | 'opvolgen' | 'consult' | 'handmatig'; verwijzing?: string };
  voorRol: Rol;
  voorGebruikerId?: string;
  voorNaam: string;
  duurMinuten: number;
  /**
   * Uiterlijk af.
   *
   * Bij een aanloopactie is dat de dag vóór de afspraak: daarna heeft bellen geen zin
   * meer. Een taak zonder horizon verschuift vanzelf naar volgende week.
   */
  uiterlijkOp?: string;
  aangemaaktDoor: string;
  aangemaaktOp: string;
  status: Taakstatus;
  /** Gezet zodra de taak een plek in de agenda heeft. */
  agendaItemId?: string;
  geplandOp?: string;
  afgerondOp?: string;
  afgerondDoor?: string;
  uitkomst?: string;
}

export interface NieuweTaak {
  soort: Taaksoort;
  titel: string;
  aanleiding: string;
  patientId?: string;
  patientNaam?: string;
  bron: Werktaak['bron'];
  voorRol: Rol;
  voorGebruikerId?: string;
  voorNaam: string;
  duurMinuten?: number;
  uiterlijkOp?: string;
}

export function maakWerktaak(
  nieuw: NieuweTaak, door: string, volgnummer: number, nu: Date,
): Werktaak {
  const soort = vindTaaksoort(nieuw.soort);
  return {
    id: `taak-${volgnummer}`,
    soort: nieuw.soort,
    titel: nieuw.titel,
    aanleiding: nieuw.aanleiding,
    patientId: nieuw.patientId,
    patientNaam: nieuw.patientNaam,
    bron: nieuw.bron,
    voorRol: nieuw.voorRol,
    voorGebruikerId: nieuw.voorGebruikerId,
    voorNaam: nieuw.voorNaam,
    duurMinuten: nieuw.duurMinuten ?? soort.duurMinuten,
    uiterlijkOp: nieuw.uiterlijkOp,
    aangemaaktDoor: door,
    aangemaaktOp: nu.toISOString(),
    status: 'open',
  };
}

/**
 * De taken die bij deze gebruiker horen.
 *
 * Op naam als de taak aan een persoon is gegeven, anders op rol. Dat onderscheid is niet
 * kosmetisch: 'de assistent' betekent wie er vandaag is, en 'Ilse' betekent Ilse. Allebei
 * komen voor, en wie ze door elkaar haalt krijgt werk dat blijft liggen omdat iedereen
 * dacht dat een ander het deed.
 */
export function takenVoor(
  taken: Werktaak[], gebruiker: { id: string; rol: Rol },
): Werktaak[] {
  return taken
    .filter((t) => (t.voorGebruikerId ? t.voorGebruikerId === gebruiker.id : t.voorRol === gebruiker.rol))
    .sort((a, b) => {
      const gewicht = (t: Werktaak) => (t.status === 'afgerond' ? 2 : t.status === 'gepland' ? 1 : 0);
      return gewicht(a) - gewicht(b)
        || (a.uiterlijkOp ?? '9999').localeCompare(b.uiterlijkOp ?? '9999')
        || a.aangemaaktOp.localeCompare(b.aangemaaktOp);
    });
}
