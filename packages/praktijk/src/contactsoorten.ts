import type { ContactSoort, Rol } from '@zpe/fhir-model';

/**
 * CONTACTVORMEN EN WAT ZE OPLEVEREN
 *
 * Een consult op de praktijk, een videoconsult, een e-consult en een telefoontje zijn
 * vier verschillende dingen. Klinisch, omdat je verschillende dingen kunt waarnemen;
 * administratief, omdat er verschillende prestaties tegenover staan; en juridisch, omdat
 * de identificatie van de patiënt per kanaal verschilt.
 *
 * In de meeste systemen is dit één vinkje achteraf, ingevuld door degene die de
 * declaratie doet. Dat is precies verkeerd om: de vorm ís bekend op het moment dat het
 * contact plaatsvindt, en wie hem later moet reconstrueren, gokt.
 *
 * Daarom hoort de vorm bij het deelcontact en niet bij de declaratie. De declaratie volgt
 * eruit, met de voorwaarden erbij zodat zichtbaar is waaróm iets wel of niet meetelt.
 *
 * ⚠️ De prestatiecodes hieronder zijn **niet geverifieerd** tegen de actuele
 * NZa-beleidsregel huisartsenzorg. De structuur klopt — consulten met een duurstaffel,
 * visites apart, digitale contacten die meetellen als ze inhoudelijk zijn — maar codes
 * en voorwaarden moeten vóór gebruik tegen de actuele regelgeving worden gelegd.
 */

export type Contactvorm =
  | 'consult' | 'consult-lang'
  | 'visite' | 'visite-lang'
  | 'telefonisch' | 'e-consult' | 'videoconsult'
  | 'verrichting' | 'intern-overleg' | 'herhaalrecept';

export interface Prestatie {
  code: string;
  omschrijving: string;
  /** Wat er waar moet zijn om dit te mogen declareren. Zichtbaar, niet verstopt. */
  voorwaarden: string[];
}

export interface Contactvormdefinitie {
  id: Contactvorm;
  naam: string;
  /** Eén zin: wanneer gebruik je deze vorm. */
  wanneer: string;
  /** Welke rollen deze vorm kunnen vastleggen. */
  doorRollen: Rol[];
  /** Duurstaffel waar die geldt; leeg als de vorm niet op duur wordt onderscheiden. */
  duurGrensMinuten?: number;
  declarabel: boolean;
  prestatie?: Prestatie;
  /** Waarom dit níet declarabel is, als dat zo is. Net zo belangrijk. */
  nietDeclarabelOmdat?: string;
  /** Hoe de patiënt is geïdentificeerd; verschilt per kanaal en dat telt (docs/07). */
  identificatie: string;
}

const ALLE_ZORG: Rol[] = ['huisarts', 'poh-s', 'assistent'];

export const contactvormen: Contactvormdefinitie[] = [
  {
    id: 'consult', naam: 'Consult op de praktijk', wanneer: 'Face-to-face, korter dan 20 minuten.',
    doorRollen: ALLE_ZORG, duurGrensMinuten: 20, declarabel: true,
    identificatie: 'persoonlijk, met legitimatie bij een eerste contact',
    prestatie: {
      code: 'CONSULT-KORT', omschrijving: 'Consult korter dan 20 minuten',
      voorwaarden: ['Contact met de patiënt of diens vertegenwoordiger', 'Inhoudelijke zorgvraag'],
    },
  },
  {
    id: 'consult-lang', naam: 'Lang consult', wanneer: 'Face-to-face, 20 minuten of langer.',
    doorRollen: ALLE_ZORG, duurGrensMinuten: 20, declarabel: true,
    identificatie: 'persoonlijk',
    prestatie: {
      code: 'CONSULT-LANG', omschrijving: 'Consult van 20 minuten en langer',
      voorwaarden: ['Duur vastgelegd in het dossier', 'Inhoudelijke zorgvraag'],
    },
  },
  {
    id: 'visite', naam: 'Visite', wanneer: 'Bij de patiënt thuis, korter dan 20 minuten.',
    doorRollen: ['huisarts', 'poh-s'], duurGrensMinuten: 20, declarabel: true,
    identificatie: 'persoonlijk, in de thuissituatie',
    prestatie: {
      code: 'VISITE-KORT', omschrijving: 'Visite korter dan 20 minuten',
      voorwaarden: ['Contact in de woonomgeving van de patiënt'],
    },
  },
  {
    id: 'visite-lang', naam: 'Lange visite', wanneer: 'Bij de patiënt thuis, 20 minuten of langer.',
    doorRollen: ['huisarts', 'poh-s'], duurGrensMinuten: 20, declarabel: true,
    identificatie: 'persoonlijk, in de thuissituatie',
    prestatie: {
      code: 'VISITE-LANG', omschrijving: 'Visite van 20 minuten en langer',
      voorwaarden: ['Contact in de woonomgeving', 'Duur vastgelegd in het dossier'],
    },
  },
  {
    id: 'telefonisch', naam: 'Telefonisch consult',
    wanneer: 'Inhoudelijk telefonisch contact met de patiënt.',
    doorRollen: ALLE_ZORG, declarabel: true,
    identificatie: 'stemherkenning of controlevraag; zwakker dan persoonlijk',
    prestatie: {
      code: 'CONSULT-TEL', omschrijving: 'Telefonisch consult',
      voorwaarden: [
        'Inhoudelijke beoordeling, geen afspraak maken of uitslag doorgeven',
        'Vastgelegd in het dossier met SOEP',
      ],
    },
  },
  {
    id: 'e-consult', naam: 'E-consult (bericht)',
    wanneer: 'Schriftelijke vraag via het portaal met een inhoudelijk antwoord.',
    doorRollen: ALLE_ZORG, declarabel: true,
    identificatie: 'via het portaal, met DigiD-authenticatie',
    prestatie: {
      code: 'CONSULT-EMAIL', omschrijving: 'Consult via e-mail of patiëntportaal',
      voorwaarden: [
        'De vraag zou anders een consult zijn geweest',
        'Inhoudelijk antwoord van een zorgverlener, geen automatische reactie',
        'Vastgelegd in het dossier',
      ],
    },
  },
  {
    id: 'videoconsult', naam: 'Videoconsult',
    wanneer: 'Beeldbellen met de patiënt.',
    doorRollen: ALLE_ZORG, duurGrensMinuten: 20, declarabel: true,
    identificatie: 'beeld plus portaalauthenticatie; sterker dan telefonisch',
    prestatie: {
      code: 'CONSULT-VIDEO', omschrijving: 'Consult via beeldverbinding',
      voorwaarden: [
        'Beeld én geluid, met de patiënt zelf',
        'Dezelfde duurstaffel als een consult op de praktijk',
      ],
    },
  },
  {
    id: 'verrichting', naam: 'Verrichting',
    wanneer: 'Een uitgevoerde handeling: ECG, spirometrie, wratten aanstippen.',
    doorRollen: ALLE_ZORG, declarabel: true,
    identificatie: 'persoonlijk',
    prestatie: {
      code: 'VERRICHTING', omschrijving: 'Verrichting volgens de verrichtingenlijst',
      voorwaarden: ['Uitkomst vastgelegd in het dossier', 'Uitvoerder vastgelegd'],
    },
  },
  {
    id: 'herhaalrecept', naam: 'Herhaalrecept',
    wanneer: 'Aanvraag en afgifte van een herhaalrecept zonder beoordeling.',
    doorRollen: ALLE_ZORG, declarabel: false,
    identificatie: 'via het portaal of de apotheek',
    nietDeclarabelOmdat:
      'Zit in het inschrijftarief. Een herhaalrecept is pas een consult als er een '
      + 'inhoudelijke beoordeling aan te pas komt — en dan leg je dat ook zo vast.',
  },
  {
    id: 'intern-overleg', naam: 'Intern overleg',
    wanneer: 'Overleg over een patiënt zonder dat de patiënt erbij is.',
    doorRollen: ALLE_ZORG, declarabel: false,
    identificatie: 'niet van toepassing',
    nietDeclarabelOmdat:
      'Er is geen contact met de patiënt geweest. Het besluit hoort wél in het dossier '
      + '(docs/05 §4c), maar het is geen prestatie.',
  },
];

export function vindContactvorm(id: Contactvorm): Contactvormdefinitie | undefined {
  return contactvormen.find((v) => v.id === id);
}

/**
 * Van contactvorm naar de FHIR-contactsoort op de Encounter.
 *
 * De vormen hier zijn fijnmaziger dan het FHIR-veld, omdat de declaratie dat vraagt:
 * een kort en een lang consult zijn administratief twee dingen en klinisch één.
 */
export function naarContactSoort(vorm: Contactvorm): ContactSoort {
  const kaart: Record<Contactvorm, ContactSoort> = {
    consult: 'consult', 'consult-lang': 'dubbel-consult',
    visite: 'visite', 'visite-lang': 'visite',
    telefonisch: 'telefonisch', 'e-consult': 'e-consult', videoconsult: 'videoconsult',
    verrichting: 'balie', herhaalrecept: 'balie', 'intern-overleg': 'monitoring',
  };
  return kaart[vorm] ?? 'consult';
}

export interface Declaratiebeeld {
  vorm: Contactvorm;
  naam: string;
  declarabel: boolean;
  prestatie?: Prestatie;
  /** Wat er nog ontbreekt voordat dit declarabel is. Leeg betekent: in orde. */
  ontbreekt: string[];
  toelichting: string;
}

/**
 * Wat deze registratie administratief oplevert — vóór het afronden, niet erna.
 *
 * Bewust op het moment van vastleggen zichtbaar. Niet om de zorgverlener tot declareren
 * aan te zetten, maar omdat het omgekeerde vaker gebeurt: werk dat gedaan is en niet
 * wordt vergoed omdat één veld leeg bleef. Wie dat pas aan het eind van het kwartaal
 * ontdekt, kan er niets meer aan doen.
 */
export function beoordeelDeclaratie(gegevens: {
  vorm: Contactvorm;
  duurMinuten?: number;
  heeftSoep: boolean;
  heeftEpisode: boolean;
  heeftUitkomst?: boolean;
}): Declaratiebeeld {
  const definitie = vindContactvorm(gegevens.vorm);
  if (!definitie) {
    return {
      vorm: gegevens.vorm, naam: gegevens.vorm, declarabel: false, ontbreekt: [],
      toelichting: 'Onbekende contactvorm.',
    };
  }

  if (!definitie.declarabel) {
    return {
      vorm: definitie.id, naam: definitie.naam, declarabel: false, ontbreekt: [],
      toelichting: definitie.nietDeclarabelOmdat ?? '',
    };
  }

  // De duurstaffel wordt niet aan de zorgverlener gevraagd maar afgeleid: een lang
  // consult dat als kort wordt vastgelegd is een fout, geen keuze.
  let vorm = definitie;
  if (definitie.duurGrensMinuten && gegevens.duurMinuten !== undefined) {
    const lang = gegevens.duurMinuten >= definitie.duurGrensMinuten;
    const paar: Partial<Record<Contactvorm, Contactvorm>> = {
      consult: 'consult-lang', 'consult-lang': 'consult',
      visite: 'visite-lang', 'visite-lang': 'visite',
    };
    const wissel = paar[definitie.id];
    const hoortLang = definitie.id.endsWith('-lang');
    if (wissel && lang !== hoortLang) vorm = vindContactvorm(wissel) ?? definitie;
  }

  const ontbreekt: string[] = [];
  if (!gegevens.heeftSoep) ontbreekt.push('geen SOEP-registratie');
  if (!gegevens.heeftEpisode) ontbreekt.push('niet aan een episode gekoppeld');
  if (vorm.id === 'verrichting' && !gegevens.heeftUitkomst) ontbreekt.push('geen uitkomst vastgelegd');

  return {
    vorm: vorm.id,
    naam: vorm.naam,
    declarabel: ontbreekt.length === 0,
    prestatie: vorm.prestatie,
    ontbreekt,
    toelichting: ontbreekt.length === 0
      ? `Voldoet aan de voorwaarden voor ${vorm.prestatie?.omschrijving.toLowerCase()}.`
      : 'Nog niet declarabel; vul aan wat hierboven ontbreekt.',
  };
}
