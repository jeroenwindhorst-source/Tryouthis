import type { Rol } from '@zpe/fhir-model';

/**
 * GEBRUIKERS EN TOEGANG — demo-implementatie
 *
 * ⚠️ Dit is nadrukkelijk géén echte authenticatie. Wachtwoorden staan in platte tekst
 * in de broncode en de tweefactorcode is vast. Het bestaat om de inrichting te tonen:
 * welke rollen er zijn, wat elke rol mag zien, en hoe de werkplek zich daarnaar voegt.
 *
 * In productie loopt dit via UZI-pas of een gecertificeerde identity provider met MFA,
 * met korte sessies en snelle herauthenticatie (docs/07 §2). Alles hieronder wordt dan
 * vervangen; wat blijft is het rechtenmodel.
 */

export type RolId = 'poh-s' | 'assistent' | 'huisarts' | 'administrator';

/** Wat iemand mag. Bewust fijnmazig genoeg om de werkplek op te bouwen. */
export type Recht =
  | 'dossier-lezen' | 'dossier-registreren'
  | 'medicatie-voorschrijven' | 'medicatie-voorstellen'
  | 'verwijzen' | 'lab-aanvragen'
  | 'autoriseren'
  | 'triage'
  | 'monitoring'
  | 'instroom-beheren'
  | 'protocol-inzien'
  /**
   * Het protocol van de praktijk aanpassen.
   *
   * Bewust breder dan alleen de praktijkmanager. Wie ermee werkt weet waaróm een interval
   * niet klopt of waarom het prikpunt trager is dan aangenomen — en als alleen de manager
   * het kan wijzigen, blijft de afwijking in de hoofden van mensen zitten in plaats van
   * in het systeem. Elke wijziging draagt een naam, een datum en een reden, dus de
   * verantwoording blijft intact.
   */
  | 'protocol-aanpassen'
  | 'configuratie-praktijk' | 'configuratie-persoonlijk'
  | 'gebruikers-beheren'
  | 'berichten';

export interface Gebruiker {
  id: string;
  gebruikersnaam: string;
  /** Demo-wachtwoord. In productie bestaat dit veld niet. */
  wachtwoord: string;
  naam: string;
  initialen: string;
  rol: RolId;
  functie: string;
  /** AGB- of UZI-nummer, in de demo fictief. */
  identificatie: string;
  tweefactorActief: boolean;
  laatsteAanmelding?: string;
  actief: boolean;
  rechten: Recht[];
}

const BASIS_ZORG: Recht[] = [
  'dossier-lezen', 'dossier-registreren', 'lab-aanvragen',
  'protocol-inzien', 'configuratie-persoonlijk', 'berichten',
];

export const gebruikers: Gebruiker[] = [
  {
    id: 'zv-poh-1',
    gebruikersnaam: 'sanne',
    wachtwoord: 'cadans',
    naam: 'Sanne Bakker',
    initialen: 'SB',
    rol: 'poh-s',
    functie: 'POH-Somatiek',
    identificatie: 'UZI 900012345',
    tweefactorActief: true,
    laatsteAanmelding: '2026-09-15T07:42:00+02:00',
    actief: true,
    // De POH mag medicatie vóórstellen, niet voorschrijven — dat is het verschil dat
    // het autorisatieproces bij de huisarts nodig maakt (docs/03 §7).
    rechten: [
      ...BASIS_ZORG, 'monitoring', 'instroom-beheren', 'medicatie-voorstellen', 'verwijzen',
      'protocol-aanpassen',
    ],
  },
  {
    id: 'zv-assistent-1',
    gebruikersnaam: 'ilse',
    wachtwoord: 'cadans',
    naam: 'Ilse Hendriks',
    initialen: 'IH',
    rol: 'assistent',
    functie: 'Doktersassistent',
    identificatie: 'AGB 04123456',
    tweefactorActief: true,
    laatsteAanmelding: '2026-09-15T07:55:00+02:00',
    actief: true,
    rechten: [...BASIS_ZORG, 'triage', 'medicatie-voorstellen'],
  },
  {
    id: 'zv-huisarts-1',
    gebruikersnaam: 'daan',
    wachtwoord: 'cadans',
    naam: 'Daan Verhoeven',
    initialen: 'DV',
    rol: 'huisarts',
    functie: 'Huisarts',
    identificatie: 'UZI 900098765',
    tweefactorActief: true,
    laatsteAanmelding: '2026-09-15T07:30:00+02:00',
    actief: true,
    rechten: [
      ...BASIS_ZORG, 'monitoring', 'autoriseren', 'medicatie-voorschrijven', 'verwijzen',
      'instroom-beheren', 'protocol-aanpassen',
    ],
  },
  {
    id: 'beheer-1',
    gebruikersnaam: 'mirjam',
    wachtwoord: 'cadans',
    naam: 'Mirjam de Groot',
    initialen: 'MG',
    rol: 'administrator',
    functie: 'Praktijkmanager',
    identificatie: 'beheeraccount',
    tweefactorActief: true,
    laatsteAanmelding: '2026-09-14T16:10:00+02:00',
    actief: true,
    // Een beheerder komt bewust niet in dossiers: beheer en zorginhoud zijn gescheiden.
    rechten: [
      'configuratie-praktijk', 'configuratie-persoonlijk', 'gebruikers-beheren', 'berichten',
      'protocol-inzien', 'protocol-aanpassen',
    ],
  },
];

/** Vaste demo-code. In productie komt deze uit een authenticator of sms. */
export const DEMO_TWEEFACTORCODE = '123456';

export interface AanmeldPoging {
  gebruikersnaam: string;
  wachtwoord: string;
}

export type AanmeldResultaat =
  | { stap: 'tweefactor'; gebruiker: Gebruiker }
  | { stap: 'mislukt'; reden: string };

/**
 * Eerste stap: gebruikersnaam en wachtwoord.
 *
 * De foutmelding zegt bewust niet of de gebruikersnaam bestaat — dat zou een
 * gebruikersnaam-orakel zijn. Ook in een demo is het zinloos om dat verkeerd voor te doen.
 */
export function meldAan({ gebruikersnaam, wachtwoord }: AanmeldPoging): AanmeldResultaat {
  const gebruiker = gebruikers.find(
    (g) => g.gebruikersnaam.toLowerCase() === gebruikersnaam.trim().toLowerCase(),
  );
  if (!gebruiker || gebruiker.wachtwoord !== wachtwoord || !gebruiker.actief) {
    return { stap: 'mislukt', reden: 'Gebruikersnaam of wachtwoord klopt niet.' };
  }
  return { stap: 'tweefactor', gebruiker };
}

export function controleerTweefactor(code: string): boolean {
  return code.replace(/\s/g, '') === DEMO_TWEEFACTORCODE;
}

export function heeftRecht(gebruiker: Gebruiker | undefined, recht: Recht): boolean {
  return Boolean(gebruiker?.rechten.includes(recht));
}

export function vindGebruiker(id: string): Gebruiker | undefined {
  return gebruikers.find((g) => g.id === id);
}

/** Wat een rol mag, zonder wachtwoorden — voor het beheerscherm. */
export function gebruikersoverzicht() {
  return gebruikers.map(({ wachtwoord, ...rest }) => rest);
}
