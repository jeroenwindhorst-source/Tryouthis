import type { Praktijk } from './populatie.js';
import { gebruikers } from './gebruikers.js';

/**
 * INTERNE COMMUNICATIE
 *
 * In de praktijk is dit een van de meest gebruikte functies van een HIS, en tegelijk de
 * slechtst uitgevoerde: losse berichtenbakjes zonder patiëntcontext, waardoor je bij elk
 * bericht het dossier erbij moet zoeken.
 *
 * Hier hangt een gesprek optioneel aan een patiënt én aan een aanleiding (een uitslag,
 * een autorisatieverzoek, een monitoringsignaal). Eén klik brengt je naar de plek waar
 * het over gaat.
 */

export interface Bericht {
  id: string;
  vanId: string;
  tekst: string;
  op: string;
  gelezen: boolean;
}

/**
 * Met wie het gesprek gaat.
 *
 * Een bericht van een collega en een bericht van een patiënt zijn allebei berichten, maar
 * ze vragen iets anders. Bij een collega overleg je; bij een patiënt geef je antwoord op
 * een vraag die klinisch kan zijn, en dan hoort het antwoord in het dossier te landen.
 * Twee bakjes dus, niet één lange lijst waarin je bij elk bericht opnieuw moet kijken wie
 * er aan de andere kant zit.
 */
export type Gesprekssoort = 'collega' | 'patient';

export type Patientkanaal = 'e-consult' | 'herhaalrecept' | 'uitslagvraag' | 'portaalvraag';

export interface Gesprek {
  id: string;
  soort: Gesprekssoort;
  onderwerp: string;
  deelnemers: string[];
  /** Bij een patiëntgesprek: langs welk kanaal het binnenkwam. */
  kanaal?: Patientkanaal;
  /** Of het antwoord als deelcontact in het dossier terecht moet komen. */
  dossierwaardig?: boolean;
  /** Waar het over gaat, als dat een patiënt is. */
  patientId?: string;
  patientNaam?: string;
  /** Waar het gesprek uit voortkomt, zodat je terug kunt naar de aanleiding. */
  aanleiding?: { soort: 'uitslag' | 'autorisatie' | 'monitoring' | 'consult' | 'overleg'; tekst: string };
  urgent: boolean;
  berichten: Bericht[];
}

const SJABLONEN: {
  onderwerp: string; deelnemers: string[]; urgent: boolean;
  aanleiding?: Gesprek['aanleiding']; regels: { van: string; tekst: string; minutenGeleden: number }[];
}[] = [
  {
    onderwerp: 'Nierfunctie gedaald — metformine aanpassen?',
    deelnemers: ['zv-poh-1', 'zv-huisarts-1'],
    urgent: true,
    aanleiding: { soort: 'uitslag', tekst: 'eGFR 38 ml/min, was 62' },
    regels: [
      { van: 'zv-poh-1', minutenGeleden: 95,
        tekst: 'De eGFR is fors gezakt sinds vorig jaar. Ze gebruikt metformine 2dd500. Wil jij naar de dosering kijken voordat ik haar donderdag zie?' },
      { van: 'zv-huisarts-1', minutenGeleden: 62,
        tekst: 'Goed gezien. Halveren naar 1dd500 en over zes weken opnieuw prikken. Ik zet het voorstel klaar, jij bespreekt het donderdag?' },
    ],
  },
  {
    onderwerp: 'Mevrouw belt over benauwdheid — hoort dit bij jou?',
    deelnemers: ['zv-assistent-1', 'zv-poh-1'],
    urgent: false,
    aanleiding: { soort: 'monitoring', tekst: 'CCQ opgelopen van 1,8 naar 2,9' },
    regels: [
      { van: 'zv-assistent-1', minutenGeleden: 180,
        tekst: 'Ze belde net, meer benauwd bij traplopen sinds een week. Geen koorts. Ik zie dat jij haar volgt — zal ik bij jou inplannen of moet de huisarts ernaar kijken?' },
      { van: 'zv-poh-1', minutenGeleden: 150,
        tekst: 'Zet haar maar bij mij, donderdagochtend. Als er koorts bij komt of het slijm verkleurt, dan direct naar Daan.' },
    ],
  },
  {
    onderwerp: 'Overleg woensdag — drie casussen',
    deelnemers: ['zv-huisarts-1', 'zv-poh-1', 'zv-assistent-1'],
    urgent: false,
    aanleiding: { soort: 'overleg', tekst: 'Wekelijks teamoverleg' },
    regels: [
      { van: 'zv-huisarts-1', minutenGeleden: 1400,
        tekst: 'Ik heb drie casussen voor woensdag: twee rondom afschalen van controles en één over iemand die we structureel kwijtraken. Wie heeft er nog iets?' },
      { van: 'zv-poh-1', minutenGeleden: 1320,
        tekst: 'Ik heb er één over de nieuwe thuismeters — de instructie kost meer tijd dan ingeschat.' },
    ],
  },
  {
    onderwerp: 'Uitslagen van gisteren staan klaar',
    deelnemers: ['zv-assistent-1', 'zv-huisarts-1'],
    urgent: false,
    aanleiding: { soort: 'autorisatie', tekst: '46 labuitslagen ter beoordeling' },
    regels: [
      { van: 'zv-assistent-1', minutenGeleden: 240,
        tekst: 'De uitslagen van gisteren staan in je autorisatielijst. Tien vallen buiten de referentie, die heb ik apart gezet.' },
    ],
  },
];

/**
 * Berichten van patiënten.
 *
 * Dit is in een gemiddelde praktijk het snelst groeiende kanaal en het slechtst
 * ondersteunde: een e-consult komt binnen in een aparte postbak, het antwoord gaat
 * daar de deur uit, en in het dossier staat er niets. Twee weken later weet niemand
 * meer wat er is afgesproken.
 *
 * Daarom staat bij elk patiëntbericht of het dossierwaardig is. Zo niet — "kan ik een
 * afspraak krijgen" — dan is het een berichtje. Zo wel, dan hoort het antwoord als
 * deelcontact in het journaal, want dan is het zorg.
 */
const PATIENTSJABLONEN: {
  onderwerp: string; kanaal: Patientkanaal; naarId: string; urgent: boolean;
  dossierwaardig: boolean;
  regels: { vanPatient: boolean; tekst: string; minutenGeleden: number }[];
}[] = [
  {
    onderwerp: 'Mijn suikers zijn hoger sinds de vakantie',
    kanaal: 'e-consult', naarId: 'zv-poh-1', urgent: false, dossierwaardig: true,
    regels: [
      { vanPatient: true, minutenGeleden: 320,
        tekst: 'Sinds we terug zijn meet ik ’s ochtends rond de 9,5 en dat was altijd rond de 7. '
          + 'Ik eet hetzelfde als anders. Moet ik iets doen of wachten we tot de controle?' },
    ],
  },
  {
    onderwerp: 'Herhaalrecept metformine en simvastatine',
    kanaal: 'herhaalrecept', naarId: 'zv-assistent-1', urgent: false, dossierwaardig: false,
    regels: [
      { vanPatient: true, minutenGeleden: 145,
        tekst: 'Mijn doosjes zijn bijna op. Kunnen jullie ze weer naar de apotheek op de hoek sturen?' },
      { vanPatient: false, minutenGeleden: 120,
        tekst: 'Doen we. Het recept staat klaar ter accordering; vanmiddag ligt het bij de apotheek.' },
    ],
  },
  {
    onderwerp: 'Vraag over mijn bloeduitslag',
    kanaal: 'uitslagvraag', naarId: 'zv-huisarts-1', urgent: false, dossierwaardig: true,
    regels: [
      { vanPatient: true, minutenGeleden: 60,
        tekst: 'Ik zie in het portaal dat mijn nierwaarde 52 is en er staat een rood driehoekje bij. '
          + 'Moet ik me zorgen maken? Ik schrik er wel van.' },
    ],
  },
  {
    onderwerp: 'Ik kan donderdag niet komen',
    kanaal: 'portaalvraag', naarId: 'zv-assistent-1', urgent: false, dossierwaardig: false,
    regels: [
      { vanPatient: true, minutenGeleden: 25,
        tekst: 'Er is iets tussengekomen op mijn werk. Kan de afspraak van donderdag verzet worden '
          + 'naar de week erna? Liefst later op de dag.' },
    ],
  },
  {
    onderwerp: 'Benauwd sinds gisteravond',
    kanaal: 'e-consult', naarId: 'zv-huisarts-1', urgent: true, dossierwaardig: true,
    regels: [
      { vanPatient: true, minutenGeleden: 15,
        tekst: 'Ik ben sinds gisteravond kortademiger dan normaal en de pufjes helpen minder goed. '
          + 'Geen koorts. Ik loop nog wel rond maar traplopen gaat moeizaam.' },
    ],
  },
];

export function genereerGesprekken(praktijk: Praktijk): Gesprek[] {
  const nu = praktijk.peildatum.getTime();
  const kandidaten = praktijk.dossiers;

  return SJABLONEN.map((sjabloon, i) => {
    const dossier = sjabloon.aanleiding?.soort === 'overleg' ? undefined : kandidaten[i * 5 + 2];
    const naam = dossier
      ? [dossier.patient.naam.voornaam, dossier.patient.naam.tussenvoegsel, dossier.patient.naam.achternaam]
          .filter(Boolean).join(' ')
      : undefined;

    return {
      id: `gesprek-${i + 1}`,
      soort: 'collega' as const,
      onderwerp: sjabloon.onderwerp,
      deelnemers: sjabloon.deelnemers,
      patientId: dossier?.patient.id,
      patientNaam: naam,
      aanleiding: sjabloon.aanleiding,
      urgent: sjabloon.urgent,
      berichten: sjabloon.regels.map((regel, n) => ({
        id: `bericht-${i + 1}-${n + 1}`,
        vanId: regel.van,
        tekst: regel.tekst,
        op: new Date(nu - regel.minutenGeleden * 60_000).toISOString(),
        // Het laatste bericht van iemand anders is nog ongelezen — anders oogt een
        // postvak altijd leeg en lijkt de functie overbodig.
        gelezen: n < sjabloon.regels.length - 1,
      })),
    };
  });
}

/** Patiëntberichten, gekoppeld aan echte patiënten uit de praktijk. */
export function genereerPatientgesprekken(praktijk: Praktijk): Gesprek[] {
  const nu = praktijk.peildatum.getTime();
  return PATIENTSJABLONEN.flatMap((sjabloon, i) => {
    const dossier = praktijk.dossiers[i * 6 + 3];
    if (!dossier) return [];
    const naam = [dossier.patient.naam.voornaam, dossier.patient.naam.tussenvoegsel,
      dossier.patient.naam.achternaam].filter(Boolean).join(' ');
    return [{
      id: `pgesprek-${i + 1}`,
      soort: 'patient' as const,
      onderwerp: sjabloon.onderwerp,
      deelnemers: [sjabloon.naarId, dossier.patient.id],
      kanaal: sjabloon.kanaal,
      dossierwaardig: sjabloon.dossierwaardig,
      patientId: dossier.patient.id,
      patientNaam: naam,
      urgent: sjabloon.urgent,
      berichten: sjabloon.regels.map((regel, n) => ({
        id: `pbericht-${i + 1}-${n + 1}`,
        vanId: regel.vanPatient ? dossier.patient.id : sjabloon.naarId,
        tekst: regel.tekst,
        op: new Date(nu - regel.minutenGeleden * 60_000).toISOString(),
        gelezen: n < sjabloon.regels.length - 1,
      })),
    }];
  });
}

export function naamVanGebruiker(id: string): string {
  return gebruikers.find((g) => g.id === id)?.naam ?? id;
}

/** Gesprekken waar deze gebruiker aan deelneemt, nieuwste bovenaan. */
export function gesprekkenVoor(gesprekken: Gesprek[], gebruikerId: string): Gesprek[] {
  return gesprekken
    .filter((g) => g.deelnemers.includes(gebruikerId))
    .sort((a, b) => (b.berichten.at(-1)?.op ?? '').localeCompare(a.berichten.at(-1)?.op ?? ''));
}

export function ongelezenVoor(gesprekken: Gesprek[], gebruikerId: string): number {
  return gesprekkenVoor(gesprekken, gebruikerId)
    .filter((g) => g.berichten.some((b) => !b.gelezen && b.vanId !== gebruikerId))
    .length;
}
