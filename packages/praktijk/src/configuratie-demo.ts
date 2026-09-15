import { losOp, type ConfiguratieLaag, type EffectieveConfiguratie } from '@zpe/configuratie';

/**
 * De vier configuratielagen zoals een echte praktijk ze zou kennen.
 *
 * De inhoud is een demo, de gelaagdheid niet: dit is precies de bestuurlijke
 * werkelijkheid van de Nederlandse eerste lijn. NHG en Nictiz bepalen de terminologie,
 * de zorggroep maakt afspraken over protocol en indicatoren, de praktijk kiest haar
 * werkwijze en apps, en de zorgverlener stelt haar eigen scherm in.
 */
export const configuratieLagen: ConfiguratieLaag[] = [
  {
    niveau: 'landelijk',
    naam: 'NHG · Nictiz',
    beheerder: 'Landelijke distributie',
    gewijzigdOp: '2026-04-01',
    instellingen: {
      actieveRefsets: ['huisarts-diagnose', 'huisarts-diagnose-uitbreiding', 'meting'],
      externZoekenToegestaan: false,
      snomedEditie: 'SNOMED CT NL — release 2026-03-31',
      icpcTabelVersie: 'ICPC-1 NL, NHG-tabel 2026-01',
      klinischeRegelsAan: true,
      intervalFactor: 1,
      eigenSynoniemen: [],
      favorieteCodes: [],
    },
  },
  {
    niveau: 'zorggroep',
    naam: 'Zorggroep Amsterdam',
    beheerder: 'Kaderhuisarts chronische zorg',
    gewijzigdOp: '2026-08-12',
    instellingen: {
      actieveModules: ['glucose', 'vaatrisico', 'nierfunctie', 'ademhaling', 'leefstijl', 'mentaal'],
      // Regionale afspraak: iets ruimer dan de richtlijn, omdat de capaciteit knelt.
      intervalFactor: 1.15,
      samenvoegVensterDagen: 42,
      favorieteCodes: ['T90.02', 'K86', 'R95', 'T93'],
      apps: [
        {
          id: 'juvoly-wachtkamer',
          naam: 'Juvoly',
          leverancier: 'Juvoly B.V.',
          plek: 'wachtkamer',
          doel: 'Gesproken voorbereiding in de wachtkamer omzetten naar een gestructureerde anamnese',
          levert: ['hulpvraag', 'anamnese (SOEP-S)', 'codesuggesties', 'meegebrachte thuismetingen'],
          herkomst: 'ai-suggestie',
          bevestigingVerplicht: true,
          grondslag: 'Verwerkersovereenkomst zorggroep; patiënt geeft per gebruik toestemming.',
          status: 'actief',
        },
      ],
    },
  },
  {
    niveau: 'praktijk',
    naam: 'Huisartsenpraktijk De Linde',
    beheerder: 'Praktijkmanager',
    gewijzigdOp: '2026-09-02',
    instellingen: {
      // Deze praktijk doet ook ouderenzorg en medicatiebeoordelingen zelf.
      actieveModules: [
        'glucose', 'vaatrisico', 'nierfunctie', 'ademhaling', 'leefstijl', 'mentaal',
        'medicatieveiligheid', 'kwetsbaarheid',
      ],
      logistiekeAutomatiseringAan: true,
      eigenSynoniemen: [
        { code: '44054006', termen: ['ouderdomssuiker', 'suiker'] },
        { code: '13645005', termen: ['rokerslong'] },
      ],
      uitgezetteRegels: [
        { regelId: 'thuismeting-aanbieden', reden: 'eerst afronden van de pilot met de bloeddrukmeters' },
      ],
      apps: [
        {
          id: 'thuismeting-hub',
          naam: 'Thuismeting-koppeling',
          leverancier: 'Regionaal telemonitoringplatform',
          plek: 'portaal',
          doel: 'Thuismetingen van bloeddrukmeters en weegschalen ontvangen',
          levert: ['bloeddruk', 'gewicht'],
          herkomst: 'extern-systeem',
          bevestigingVerplicht: false,
          grondslag: 'Toestemming patiënt in het portaal; gegevens komen als apparaatmeting binnen.',
          status: 'actief',
        },
      ],
    },
  },
  {
    niveau: 'gebruiker',
    naam: 'Sanne Bakker · POH-S',
    beheerder: 'Eigen voorkeuren',
    gewijzigdOp: '2026-09-15',
    instellingen: {
      favorieteCodes: ['T90.02', 'K86', 'R95', 'U99.01', 'T93'],
    },
  },
];

let opgelost: EffectieveConfiguratie | undefined;

/** De effectieve configuratie, met per instelling zichtbaar waar hij vandaan komt. */
export function configuratie(): EffectieveConfiguratie {
  opgelost ??= losOp(configuratieLagen);
  return opgelost;
}

/** Apps die op een bepaalde plek in het proces draaien. */
export function appsVoor(plek: string) {
  return (configuratie().apps?.waarde ?? []).filter((a) => a.plek === plek && a.status === 'actief');
}
