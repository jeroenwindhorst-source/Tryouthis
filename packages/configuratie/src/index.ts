/**
 * CONFIGURATIEMODULE
 *
 * Terminologie, protocol, beslisregels en integraties zijn geen ingebakken code maar
 * instellingen. Ze worden op vier niveaus gezet, en het laagste niveau dat iets zegt
 * wint:
 *
 *     landelijk  →  zorggroep  →  praktijk  →  gebruiker
 *
 * Dat is niet alleen flexibiliteit. Het is een organisatorische werkelijkheid: het NHG
 * en Nictiz bepalen de terminologie, een zorggroep maakt afspraken over protocollen en
 * indicatoren, een praktijk kiest haar eigen werkwijze en apps, en een individuele
 * zorgverlener stelt haar eigen scherm in. Zolang die vier door elkaar lopen, is elke
 * wijziging een leverancierswijziging — precies waarom het nu maanden duurt.
 *
 * Even belangrijk als de waarde is de **herkomst**: bij elke instelling is zichtbaar op
 * welk niveau hij is gezet en door wie. Een beheerder die niet kan zien waar iets vandaan
 * komt, durft niets te veranderen.
 */

export type Niveau = 'landelijk' | 'zorggroep' | 'praktijk' | 'gebruiker';

export const NIVEAU_VOLGORDE: Niveau[] = ['landelijk', 'zorggroep', 'praktijk', 'gebruiker'];

export const NIVEAU_UITLEG: Record<Niveau, string> = {
  landelijk: 'Vastgesteld door NHG en Nictiz. Niet lokaal te wijzigen — alleen aan te vullen.',
  zorggroep: 'Afspraken van de zorggroep over protocollen, indicatoren en declaratie.',
  praktijk: 'Werkwijze, apps en voorkeuren van deze praktijk.',
  gebruiker: 'Persoonlijke schermvoorkeuren van één zorgverlener.',
};

/** Een app die in het systeem is ingebed en aanvoelt als eigen functionaliteit. */
export interface AppRegistratie {
  id: string;
  naam: string;
  leverancier: string;
  /** Waar in het proces de app draait. */
  plek: 'wachtkamer' | 'consult' | 'triage' | 'portaal';
  doel: string;
  /** Welke gegevens de app terugschrijft in het dossier. */
  levert: string[];
  /** Hoe die gegevens worden gemerkt (docs/03 §3). Nooit als eigen registratie. */
  herkomst: 'extern-systeem' | 'ai-suggestie';
  /** Moet een mens bevestigen voordat het klinisch meetelt? Bij AI altijd. */
  bevestigingVerplicht: boolean;
  /** Toestemmingsgrondslag en verwerkersovereenkomst — geen bijzaak. */
  grondslag: string;
  status: 'actief' | 'uit';
}

export interface Instellingen {
  // ── Terminologie ─────────────────────────────────────────────────────────
  /** Welke referentiesets mogen worden geregistreerd. */
  actieveRefsets: string[];
  /** Mogen externe SNOMED-concepten breed doorzoekbaar zijn, of alleen bij ontvangst? */
  externZoekenToegestaan: boolean;
  /** Eigen zoektermen bovenop de landelijke voorkeurstermen. */
  eigenSynoniemen: { code: string; termen: string[] }[];
  /** Codes die bovenaan verschijnen bij registreren. */
  favorieteCodes: string[];
  snomedEditie: string;
  icpcTabelVersie: string;

  // ── Protocol ─────────────────────────────────────────────────────────────
  actieveModules: string[];
  /** Zorggroep mag het protocol strakker of ruimer zetten dan de richtlijn. */
  intervalFactor: number;
  samenvoegVensterDagen: number;

  // ── Beslissingsondersteuning ─────────────────────────────────────────────
  klinischeRegelsAan: boolean;
  logistiekeAutomatiseringAan: boolean;
  /** Regels die deze praktijk bewust heeft uitgezet, met reden. */
  uitgezetteRegels: { regelId: string; reden: string }[];

  // ── Integraties ──────────────────────────────────────────────────────────
  apps: AppRegistratie[];
}

export interface ConfiguratieLaag {
  niveau: Niveau;
  naam: string;
  beheerder: string;
  gewijzigdOp: string;
  instellingen: Partial<Instellingen>;
}

/** Eén instelling met de vraag beantwoord: waar komt deze waarde vandaan? */
export interface Herleidbaar<T> {
  waarde: T;
  niveau: Niveau;
  bron: string;
  /** Niveaus die deze instelling óók zetten maar zijn overschreven. */
  overschreven: { niveau: Niveau; bron: string }[];
}

export type EffectieveConfiguratie = {
  [K in keyof Instellingen]: Herleidbaar<Instellingen[K]>;
};

/**
 * Lost de lagen op tot één set waarden, met per waarde de herkomst.
 *
 * Bewust géén diepe samenvoeging van lijsten: dan weet niemand meer wat waar vandaan
 * komt. Een niveau vervangt een instelling volledig of laat hem met rust. De enige
 * uitzondering is `apps`, waar lagen optellen — een praktijk zet apps áán bovenop wat
 * de zorggroep al levert, zonder die te verliezen.
 */
export function losOp(lagen: ConfiguratieLaag[]): EffectieveConfiguratie {
  const gesorteerd = [...lagen].sort(
    (a, b) => NIVEAU_VOLGORDE.indexOf(a.niveau) - NIVEAU_VOLGORDE.indexOf(b.niveau),
  );

  const resultaat = {} as Record<string, Herleidbaar<unknown>>;
  const apps = new Map<string, { app: AppRegistratie; niveau: Niveau; bron: string }>();

  for (const laag of gesorteerd) {
    for (const [sleutel, waarde] of Object.entries(laag.instellingen)) {
      if (waarde === undefined) continue;

      if (sleutel === 'apps') {
        for (const app of waarde as AppRegistratie[]) {
          apps.set(app.id, { app, niveau: laag.niveau, bron: laag.naam });
        }
        continue;
      }

      const bestaand = resultaat[sleutel];
      resultaat[sleutel] = {
        waarde,
        niveau: laag.niveau,
        bron: laag.naam,
        overschreven: bestaand
          ? [...bestaand.overschreven, { niveau: bestaand.niveau, bron: bestaand.bron }]
          : [],
      };
    }
  }

  if (apps.size > 0) {
    const laatste = [...apps.values()].at(-1)!;
    resultaat.apps = {
      waarde: [...apps.values()].map((x) => x.app),
      niveau: laatste.niveau,
      bron: 'opgeteld over de lagen',
      overschreven: [],
    };
  }

  return resultaat as EffectieveConfiguratie;
}

/** Op welk niveau is deze instelling gezet — voor de beheerweergave. */
export function herkomstVan<K extends keyof Instellingen>(
  configuratie: EffectieveConfiguratie, sleutel: K,
): { niveau: Niveau; bron: string } | undefined {
  const item = configuratie[sleutel];
  return item ? { niveau: item.niveau, bron: item.bron } : undefined;
}
