import type { Vragenlijst } from './vragenlijst.js';

/**
 * Demovragenlijsten.
 *
 * LET OP — licenties. Veel meetinstrumenten in de eerste lijn (CCQ, PHQ-9, GAD-7,
 * EQ-5D) zijn auteursrechtelijk beschermd en vragen een licentie voor digitaal gebruik.
 * De items hieronder zijn *representatieve eigen formuleringen* die de structuur en de
 * scoringslogica nabootsen, zodat de motor gebouwd en getest kan worden. Vóór gebruik
 * in de praktijk moeten ze worden vervangen door de officiële, gelicentieerde items.
 */

export const ccqAchtig: Vragenlijst = {
  id: 'vl-ccq',
  naam: 'Klachtenvragenlijst COPD (CCQ-structuur)',
  versie: '0.1-demo',
  doel: 'monitoring',
  licentie: 'DEMO — niet-gelicentieerde herformulering; officiële CCQ vereist licentie',
  vragen: [
    { id: 'ccq-1', tekst: 'Kortademig in rust (afgelopen week)',
      patientTekst: 'Hoe vaak was u de afgelopen week kortademig terwijl u rustig zat of lag?',
      type: 'schaal', schaal: { min: 0, max: 6, minLabel: 'nooit', maxLabel: 'voortdurend' },
      observatieCode: 'ccq-1', verplicht: true },
    { id: 'ccq-2', tekst: 'Kortademig bij inspanning',
      patientTekst: 'Hoe vaak was u kortademig bij lichamelijke inspanning?',
      type: 'schaal', schaal: { min: 0, max: 6, minLabel: 'nooit', maxLabel: 'voortdurend' },
      observatieCode: 'ccq-2', verplicht: true },
    { id: 'ccq-3', tekst: 'Hoesten',
      patientTekst: 'Hoe vaak moest u hoesten?',
      type: 'schaal', schaal: { min: 0, max: 6, minLabel: 'nooit', maxLabel: 'voortdurend' },
      observatieCode: 'ccq-3', verplicht: true },
    { id: 'ccq-4', tekst: 'Slijm opgeven',
      patientTekst: 'Hoe vaak gaf u slijm op?',
      type: 'schaal', schaal: { min: 0, max: 6, minLabel: 'nooit', maxLabel: 'voortdurend' },
      observatieCode: 'ccq-4', verplicht: true },
    { id: 'ccq-5', tekst: 'Beperkt in zware activiteiten',
      patientTekst: 'Hoe beperkt was u bij zware activiteiten, zoals traplopen of tillen?',
      type: 'schaal', schaal: { min: 0, max: 6, minLabel: 'niet beperkt', maxLabel: 'volledig beperkt' },
      observatieCode: 'ccq-5', verplicht: true },
    { id: 'ccq-6', tekst: 'Bezorgd over de longen',
      patientTekst: 'Hoe vaak maakte u zich zorgen over uw longen?',
      type: 'schaal', schaal: { min: 0, max: 6, minLabel: 'nooit', maxLabel: 'voortdurend' },
      observatieCode: 'ccq-6', verplicht: true },
    // Vervolgvragen: verschijnen alleen wanneer ze relevant zijn.
    { id: 'ccq-koorts', tekst: 'Koorts in de afgelopen dagen?',
      patientTekst: 'Had u de afgelopen dagen koorts (boven 38 °C)?',
      type: 'ja-nee', observatieCode: 'koorts',
      toonAls: { type: 'antwoord', vraag: 'ccq-1', operator: '>=', waarde: 4 } },
    { id: 'ccq-sputum-kleur', tekst: 'Kleurverandering slijm?',
      patientTekst: 'Is uw slijm van kleur veranderd (geel of groen)?',
      type: 'ja-nee', observatieCode: 'sputum-verandering',
      toonAls: { type: 'antwoord', vraag: 'ccq-4', operator: '>=', waarde: 3 } },
    { id: 'ccq-inhalatie', tekst: 'Inhalatiemedicatie zoals afgesproken gebruikt?',
      patientTekst: 'Heeft u uw pufjes de afgelopen week gebruikt zoals afgesproken?',
      type: 'keuze', observatieCode: 'therapietrouw-inhalatie',
      opties: [
        { code: 'altijd', label: 'Altijd' },
        { code: 'meestal', label: 'Meestal' },
        { code: 'soms', label: 'Soms' },
        { code: 'niet', label: 'Niet gebruikt' },
      ] },
  ],
  scores: [
    { id: 'ccq-totaal', naam: 'CCQ totaalscore', bereken: 'gemiddelde',
      vragen: ['ccq-1', 'ccq-2', 'ccq-3', 'ccq-4', 'ccq-5', 'ccq-6'],
      observatieCode: 'ccq-totaal', relevanteVerandering: 0.4 },
  ],
  triggers: [
    {
      id: 'ccq-verslechtering',
      wanneer: { type: 'en', van: [
        { type: 'score', score: 'ccq-totaal', operator: '>=', waarde: 2 },
        { type: 'score-toename', score: 'ccq-totaal', minimaal: 0.4 },
      ] },
      ernst: 'aandacht',
      onderbouwing:
        'De CCQ-totaalscore is ≥ 2,0 én met minimaal 0,4 punt gestegen. 0,4 geldt als het ' +
        'kleinste klinisch relevante verschil; deze combinatie wijst op een verslechtering ' +
        'die beoordeling behoeft.',
      richtlijn: { naam: 'NHG-Standaard COPD', paragraaf: 'Monitoring en controlebeleid' },
      dan: [
        { type: 'taak', categorie: 'signaal-monitoring', rol: 'poh-s', prioriteit: 'urgent',
          omschrijving: 'CCQ verslechterd — beoordelen en contact opnemen' },
        { type: 'notificeer', rol: 'poh-s', bericht: 'CCQ-score verslechterd ten opzichte van de vorige meting' },
        { type: 'plan-afspraak', afspraakType: 'copd-controle', binnenDagen: 14 },
        { type: 'zelfzorgadvies', adviesId: 'copd-longaanval-herkennen', titel: 'Een longaanval herkennen' },
      ],
    },
    {
      id: 'ccq-mogelijke-exacerbatie',
      wanneer: { type: 'en', van: [
        { type: 'antwoord', vraag: 'ccq-koorts', operator: '=', waarde: 'ja' },
        { type: 'antwoord', vraag: 'ccq-sputum-kleur', operator: '=', waarde: 'ja' },
      ] },
      ernst: 'urgent',
      onderbouwing:
        'Koorts in combinatie met kleurverandering van het sputum bij toegenomen ' +
        'kortademigheid past bij een mogelijke exacerbatie; dit hoort dezelfde dag beoordeeld te worden.',
      richtlijn: { naam: 'NHG-Standaard COPD', paragraaf: 'Exacerbatie' },
      dan: [
        { type: 'notificeer', rol: 'huisarts', bericht: 'Mogelijke COPD-exacerbatie — beoordeling vandaag gewenst' },
        { type: 'taak', categorie: 'signaal-monitoring', rol: 'huisarts', prioriteit: 'asap',
          omschrijving: 'Mogelijke exacerbatie COPD — vandaag beoordelen' },
      ],
    },
    {
      id: 'ccq-stabiel-afschalen',
      wanneer: { type: 'score-stabiel', score: 'ccq-totaal', onder: 1.0, aantalAfnames: 3 },
      ernst: 'informatief',
      onderbouwing:
        'Drie achtereenvolgende metingen onder 1,0 wijzen op een stabiele situatie. Minder ' +
        'frequente controle is dan passend — het systeem stelt óók voor om minder te doen.',
      richtlijn: { naam: 'NHG-Standaard COPD', paragraaf: 'Controlefrequentie bij stabiele COPD' },
      dan: [
        { type: 'wijzig-intensiteit', naar: 'extensief',
          reden: 'CCQ drie metingen stabiel onder 1,0', terBevestiging: true },
      ],
    },
    {
      id: 'ccq-therapietrouw',
      wanneer: { type: 'antwoord', vraag: 'ccq-inhalatie', operator: 'in', waarde: ['soms', 'niet'] },
      ernst: 'aandacht',
      onderbouwing:
        'Onvoldoende gebruik van inhalatiemedicatie is een van de meest voorkomende — en best ' +
        'behandelbare — oorzaken van klachten bij COPD. Inhalatie-instructie gaat vóór ophogen van medicatie.',
      dan: [
        { type: 'taak', categorie: 'signaal-monitoring', rol: 'poh-s', prioriteit: 'routine',
          omschrijving: 'Inhalatie-instructie plannen: medicatie wordt niet volgens afspraak gebruikt' },
      ],
    },
  ],
};

export const mpg: Vragenlijst = {
  id: 'vl-mpg',
  naam: 'Mijn Positieve Gezondheid',
  versie: '0.1-demo',
  doel: 'consultvoorbereiding',
  licentie: 'DEMO — dimensies naar het model van Positieve Gezondheid; eigen formulering',
  vragen: [
    { id: 'mpg-lich', tekst: 'Lichaamsfuncties', patientTekst: 'Hoe gaat het met uw lichaam?',
      type: 'schaal', schaal: { min: 0, max: 10 }, observatieCode: 'mpg-lichaamsfuncties', verplicht: true },
    { id: 'mpg-ment', tekst: 'Mentaal welbevinden', patientTekst: 'Hoe gaat het met u van binnen?',
      type: 'schaal', schaal: { min: 0, max: 10 }, observatieCode: 'mpg-mentaal', verplicht: true },
    { id: 'mpg-zing', tekst: 'Zingeving', patientTekst: 'Heeft u het gevoel dat uw leven zin heeft?',
      type: 'schaal', schaal: { min: 0, max: 10 }, observatieCode: 'mpg-zingeving', verplicht: true },
    { id: 'mpg-kwal', tekst: 'Kwaliteit van leven', patientTekst: 'Hoe tevreden bent u met uw leven?',
      type: 'schaal', schaal: { min: 0, max: 10 }, observatieCode: 'mpg-kwaliteit', verplicht: true },
    { id: 'mpg-mee', tekst: 'Meedoen', patientTekst: 'Doet u mee met de mensen om u heen?',
      type: 'schaal', schaal: { min: 0, max: 10 }, observatieCode: 'mpg-meedoen', verplicht: true },
    { id: 'mpg-dag', tekst: 'Dagelijks functioneren', patientTekst: 'Lukt het u om uw dag zelf in te vullen?',
      type: 'schaal', schaal: { min: 0, max: 10 }, observatieCode: 'mpg-dagelijks', verplicht: true },
    { id: 'mpg-bespreken', tekst: 'Waar wil de patiënt het over hebben?',
      patientTekst: 'Waar zou u het tijdens de afspraak graag over willen hebben?',
      type: 'tekst', observatieCode: 'mpg-gespreksonderwerp' },
  ],
  scores: [
    { id: 'mpg-totaal', naam: 'Gezondheidsoppervlakte', bereken: 'gemiddelde',
      vragen: ['mpg-lich', 'mpg-ment', 'mpg-zing', 'mpg-kwal', 'mpg-mee', 'mpg-dag'],
      observatieCode: 'mpg-totaal', relevanteVerandering: 1 },
  ],
  triggers: [
    {
      id: 'mpg-laag-mentaal',
      wanneer: { type: 'antwoord', vraag: 'mpg-ment', operator: '<=', waarde: 4 },
      ernst: 'aandacht',
      onderbouwing:
        'Een lage score op mentaal welbevinden bij een somatische controle is een signaal dat in ' +
        'de huidige werkwijze structureel wordt gemist: de POH-S vraagt er niet naar en de lijst ' +
        'wordt niet gelezen. Hier leidt het tot een concreet gespreksonderwerp.',
      dan: [
        { type: 'taak', categorie: 'signaal-monitoring', rol: 'poh-s', prioriteit: 'routine',
          omschrijving: 'Mentaal welbevinden laag — bespreken tijdens het consult, overweeg POH-GGZ' },
      ],
    },
    {
      id: 'mpg-gespreksonderwerp',
      wanneer: { type: 'beantwoord', vraag: 'mpg-bespreken' },
      ernst: 'informatief',
      onderbouwing:
        'De patiënt heeft zelf een gespreksonderwerp aangedragen. Dat hoort bovenaan de ' +
        'consultvoorbereiding te staan, niet onderaan het journaal.',
      dan: [],
    },
  ],
};


/**
 * DE STEDELIJKE VRAGENLIJST INTEGRALE CHRONISCHE ZORG — versie 4.0, 29 mei 2026
 *
 * Twee lijsten uit één werkwijze, en ze doen verschillend werk:
 *
 *  - de **jaarlijkse screening** gaat vooruit: "dit helpt ons om te bepalen of we je
 *    uitnodigen voor een afspraak op de praktijk". Hij bepaalt dus óf er een consult
 *    nodig is, en wanneer.
 *  - de **consultvoorbereiding** gaat over een afspraak die al staat: "je hebt binnenkort
 *    een afspraak op de praktijk". Hij bepaalt waar dat gesprek over gaat.
 *
 * De vragen, de antwoordopties en de volgorde zijn overgenomen van het formulier. Wat
 * hier is toegevoegd, is wat een papieren lijst niet kan: elk antwoord draagt een code,
 * zodat het gestructureerd in het dossier landt in plaats van als tekst in het journaal.
 *
 * ⚠️ De codes zijn voor de demo gekozen en niet tegen een terminologiedistributie
 * gelegd. De vraagteksten zijn wél letterlijk die van het formulier.
 */

const JA_NEE_WEET = [
  { code: 'ja', label: 'Ja' },
  { code: 'nee', label: 'Nee' },
  { code: 'weet-niet', label: 'Weet ik niet' },
];

const JA_NEE_WEET_LIEVER_NIET = [
  ...JA_NEE_WEET,
  { code: 'liever-niet', label: 'Wil ik niet zeggen' },
];

export const jaarlijkseScreening: Vragenlijst = {
  id: 'vl-jaarscreening',
  naam: 'Jaarlijkse screening — controle',
  versie: '4.0',
  doel: 'monitoring',
  licentie: 'Stedelijke werkwijze integrale chronische zorg, versie 4.0 (29 mei 2026)',
  vragen: [
    { id: 'js-lengte', rubriek: 'Metingen', tekst: 'Lengte',
      patientTekst: 'Wat is je lengte?', type: 'getal', eenheid: 'cm', observatieCode: '8302-2' },
    { id: 'js-gewicht', rubriek: 'Metingen', tekst: 'Gewicht',
      patientTekst: 'Wat is je gewicht?', type: 'getal', eenheid: 'kg', observatieCode: '29463-7' },
    { id: 'js-rr', rubriek: 'Metingen', tekst: 'Bloeddruk (systolisch, zelfgemeten)',
      patientTekst: 'Wat is je bloeddruk?', type: 'getal', eenheid: 'mmHg', observatieCode: '8480-6' },
    { id: 'js-pols', rubriek: 'Metingen', tekst: 'Polsfrequentie',
      patientTekst: 'Wat is je polsfrequentie?', type: 'getal', eenheid: '/min', observatieCode: '8867-4' },
    { id: 'js-buik', rubriek: 'Metingen', tekst: 'Buikomvang',
      patientTekst: 'Wat is je buikomvang?', type: 'getal', eenheid: 'cm', observatieCode: '56086-2',
      kantlijn: 'Persoonsafhankelijk' },

    { id: 'js-roken', rubriek: 'Leefstijl', tekst: 'Rookstatus',
      patientTekst: 'Rook je (sigaretten, wiet, e-sigaret/vape)?', type: 'keuze',
      observatieCode: '72166-2',
      opties: [
        { code: '77176002', label: 'Ja', score: 2 },
        { code: '266919005', label: 'Nee', score: 0 },
        { code: '8517006', label: 'Ik heb vroeger gerookt', score: 1 },
      ] },
    { id: 'js-stoppen', rubriek: 'Leefstijl', tekst: 'Stopwens',
      patientTekst: 'Wil je stoppen met roken?', type: 'keuze',
      toonAls: { type: 'antwoord', vraag: 'js-roken', operator: '=', waarde: '77176002' },
      opties: [
        { code: 'ja', label: 'Ja' }, { code: 'nee', label: 'Nee' },
        { code: 'misschien', label: 'Misschien' }, { code: 'weet-niet', label: 'Weet ik niet' },
      ] },

    { id: 'js-bijwerkingen', rubriek: 'Medicatie',
      tekst: 'Bijwerkingen van de medicatie',
      patientTekst: 'Heb je last van bijwerkingen van je medicatie? Denk aan duizeligheid, of buikpijn?',
      type: 'keuze', opties: JA_NEE_WEET },
    { id: 'js-medproblemen', rubriek: 'Medicatie',
      tekst: 'Problemen met de medicijnen',
      patientTekst: 'Zijn er problemen met je medicijnen? Denk aan niet leverbaar, of het is '
        + 'niet duidelijk hoe je de medicijnen moet gebruiken, of je wilt ze liever niet gebruiken.',
      type: 'keuze', opties: JA_NEE_WEET },
    { id: 'js-medproblemen-welke', rubriek: 'Medicatie', tekst: 'Welke problemen',
      patientTekst: 'Welke problemen zijn er?', type: 'tekst',
      toonAls: { type: 'antwoord', vraag: 'js-medproblemen', operator: '=', waarde: 'ja' } },

    { id: 'js-klachten', rubriek: 'Gezondheid',
      tekst: 'Nieuwe of veranderde klachten',
      patientTekst: 'Heb je nieuwe klachten, of zijn je klachten veranderd, die passen bij je chronische ziekte?',
      type: 'keuze', opties: JA_NEE_WEET },
    { id: 'js-klachten-welke', rubriek: 'Gezondheid', tekst: 'Welke klachten',
      patientTekst: 'Welke klachten heb je?', type: 'tekst',
      toonAls: { type: 'antwoord', vraag: 'js-klachten', operator: '=', waarde: 'ja' } },
    { id: 'js-prikplekken', rubriek: 'Gezondheid', tekst: 'Prikplekken bij insuline',
      patientTekst: 'Als je insuline spuit, heb je last van prikplekken?', type: 'keuze',
      opties: JA_NEE_WEET, alleenBijModules: ['glucose'], kantlijn: 'Alleen bij DM' },
    { id: 'js-oedeem', rubriek: 'Gezondheid', tekst: 'Oedeem enkels of voeten',
      patientTekst: 'Zijn je enkels of voeten dik geworden?', type: 'keuze',
      opties: JA_NEE_WEET, alleenBijModules: ['vaatrisico'], kantlijn: 'Alleen bij CVRM / AF' },
    { id: 'js-longaanvallen', rubriek: 'Gezondheid', tekst: 'Longaanvallen afgelopen jaar',
      patientTekst: 'Hoeveel longaanvallen heb je het afgelopen jaar gehad?', type: 'getal',
      eenheid: 'per jaar', alleenBijModules: ['ademhaling'], kantlijn: 'Alleen bij COPD / Astma' },
  ],
  scores: [],
  triggers: [
    {
      id: 'js-klachten-veranderd',
      wanneer: { type: 'antwoord', vraag: 'js-klachten', operator: '=', waarde: 'ja' },
      dan: [{ type: 'plan-afspraak', afspraakType: 'chronische-controle', binnenDagen: 14 }],
      ernst: 'aandacht',
      onderbouwing: 'Nieuwe of veranderde klachten die bij de chronische aandoening passen, horen '
        + 'beoordeeld te worden vóór de volgende reguliere controle.',
    },
    {
      id: 'js-medicatieprobleem',
      wanneer: { type: 'of', van: [
        { type: 'antwoord', vraag: 'js-bijwerkingen', operator: '=', waarde: 'ja' },
        { type: 'antwoord', vraag: 'js-medproblemen', operator: '=', waarde: 'ja' },
      ] },
      dan: [{ type: 'taak', categorie: 'administratief', rol: 'poh-s', prioriteit: 'routine',
        omschrijving: 'Medicatie bespreken: bijwerking of probleem met gebruik gemeld' }],
      ernst: 'aandacht',
      onderbouwing: 'Een gemelde bijwerking of een probleem met het gebruik is de meest voorkomende '
        + 'reden dat chronische medicatie niet wordt ingenomen. Dat hoort op tafel vóór de waarden.',
    },
    {
      id: 'js-stopwens',
      wanneer: { type: 'antwoord', vraag: 'js-stoppen', operator: 'in', waarde: ['ja', 'misschien'] },
      dan: [{ type: 'taak', categorie: 'administratief', rol: 'poh-s', prioriteit: 'routine',
        omschrijving: 'Stoppen-met-rokenbegeleiding aanbieden — patiënt geeft een stopwens aan' }],
      ernst: 'aandacht',
      onderbouwing: 'Een stopwens is het moment waarop begeleiding het meeste effect heeft. '
        + 'Daar tot de volgende jaarcontrole mee wachten, laat dat moment voorbijgaan.',
      richtlijn: { naam: 'NHG-Behandelrichtlijn Stoppen met roken' },
    },
    {
      id: 'js-longaanvallen-veel',
      wanneer: { type: 'antwoord', vraag: 'js-longaanvallen', operator: '>=', waarde: 2 },
      dan: [{ type: 'plan-afspraak', afspraakType: 'chronische-controle', binnenDagen: 21 }],
      ernst: 'aandacht',
      onderbouwing: 'Twee of meer longaanvallen per jaar wijst op onvoldoende controle en is reden '
        + 'om het beleid te heroverwegen in plaats van de jaarcontrole af te wachten.',
      richtlijn: { naam: 'NHG-Standaard COPD' },
    },
  ],
};

export const consultvoorbereiding: Vragenlijst = {
  id: 'vl-consultvoorbereiding',
  naam: 'Consultvoorbereidende vragenlijst',
  versie: '4.0',
  doel: 'consultvoorbereiding',
  licentie: 'Stedelijke werkwijze integrale chronische zorg, versie 4.0 (29 mei 2026)',
  vragen: [
    { id: 'cv-bewegen', rubriek: 'Leefstijl', tekst: 'Beweegnorm',
      patientTekst: 'Beweeg je elke dag 30 minuten? Zoals met fietsen, wandelen of sporten?',
      type: 'keuze', observatieCode: 'beweegnorm',
      toelichting: 'Op het formulier staat hier een link naar de beweegrichtlijnen.',
      opties: [
        { code: 'lukt', label: 'Ja, dat lukt', score: 0 },
        { code: 'lukt-niet', label: 'Nee, dat lukt niet', score: 2 },
        { code: 'weinig', label: 'Ik beweeg weinig', score: 3 },
        { code: 'weet-niet', label: 'Weet ik niet' },
      ] },
    { id: 'cv-alcohol', rubriek: 'Leefstijl', tekst: 'Alcoholgebruik per week',
      patientTekst: 'Hoe vaak drink je alcohol per week?', type: 'keuze', observatieCode: 'alcohol-frequentie',
      opties: [
        { code: 'nooit', label: 'Nooit', score: 0 },
        { code: '1-of-minder', label: '1 keer per week of minder', score: 1 },
        { code: '2-3', label: '2-3 keer per week', score: 2 },
        { code: '4-of-meer', label: '4 keer of vaker per week', score: 3 },
      ] },
    { id: 'cv-drugs', rubriek: 'Leefstijl', tekst: 'Drugsgebruik',
      patientTekst: 'Gebruik je drugs?', type: 'keuze', opties: JA_NEE_WEET_LIEVER_NIET },

    { id: 'cv-stress', rubriek: 'Mentaal welbevinden', tekst: 'Zorgen of stress',
      patientTekst: 'Heb je veel zorgen of stress?', type: 'keuze', opties: JA_NEE_WEET },
    { id: 'cv-slaap', rubriek: 'Mentaal welbevinden', tekst: 'Slaapkwaliteit',
      patientTekst: 'Slaap je goed?', type: 'keuze', opties: JA_NEE_WEET },

    { id: 'cv-steun', rubriek: 'Sociale anamnese', tekst: 'Steun in de omgeving',
      patientTekst: 'Heb je mensen om je heen die je kunnen helpen?',
      type: 'keuze', opties: JA_NEE_WEET_LIEVER_NIET },
    { id: 'cv-dagbesteding', rubriek: 'Sociale anamnese', tekst: 'Werk of dagbesteding',
      patientTekst: 'Ga je met plezier naar je werk of zijn er andere activiteiten waar je je goed bij voelt?',
      type: 'keuze', opties: JA_NEE_WEET_LIEVER_NIET },
    { id: 'cv-geld', rubriek: 'Sociale anamnese', tekst: 'Zorgen over geld',
      patientTekst: 'Heb je zorgen over geld?', type: 'keuze', opties: JA_NEE_WEET_LIEVER_NIET },
    { id: 'cv-seksualiteit', rubriek: 'Sociale anamnese', tekst: 'Invloed op seksualiteit',
      patientTekst: 'Heeft je ziekte of medicatie invloed op je seksleven?',
      type: 'keuze', opties: JA_NEE_WEET_LIEVER_NIET },

    { id: 'cv-cijfer', rubriek: 'Je gezondheid in één cijfer',
      tekst: 'Eigen cijfer voor gezondheid en leven',
      patientTekst: 'Ik geef mijn gezondheid en leven het cijfer:',
      type: 'schaal', schaal: { min: 0, max: 10, minLabel: 'heel slecht', maxLabel: 'heel goed' },
      observatieCode: 'eigen-cijfer-gezondheid' },

    { id: 'cv-noodkaart', rubriek: 'Tenslotte', tekst: 'Gebruik van de noodkaart',
      patientTekst: 'Van je praktijk heb je een ‘noodkaart’ ontvangen. Hoe vaak heb je deze '
        + 'noodkaart gebruikt, en waarvoor?', type: 'tekst' },
    { id: 'cv-gespreksonderwerp', rubriek: 'Tenslotte', tekst: 'Eigen gespreksonderwerp',
      patientTekst: 'Is er iets waar je over wil praten met de praktijkondersteuner?', type: 'tekst' },
  ],
  scores: [
    { id: 'cv-eigen-cijfer', naam: 'Eigen cijfer gezondheid', bereken: 'gemiddelde',
      vragen: ['cv-cijfer'], observatieCode: 'eigen-cijfer-gezondheid', relevanteVerandering: 2 },
  ],
  triggers: [
    {
      id: 'cv-eigen-cijfer-laag',
      wanneer: { type: 'score', score: 'cv-eigen-cijfer', operator: '<=', waarde: 5 },
      dan: [{ type: 'notificeer', rol: 'poh-s',
        bericht: 'De eigen gezondheid en het eigen leven krijgen een 5 of lager — begin daar het gesprek.' }],
      ernst: 'aandacht',
      onderbouwing: 'Het eigen cijfer voorspelt uitval uit de zorg beter dan de meeste meetwaarden. '
        + 'Een laag cijfer naast goede waarden is het gesprek dat anders niet gevoerd wordt.',
    },
    {
      id: 'cv-geldzorgen',
      wanneer: { type: 'antwoord', vraag: 'cv-geld', operator: '=', waarde: 'ja' },
      dan: [{ type: 'taak', categorie: 'administratief', rol: 'poh-s', prioriteit: 'routine',
        omschrijving: 'Geldzorgen gemeld — verwijzing naar het sociaal domein overwegen' }],
      ernst: 'aandacht',
      onderbouwing: 'Geldzorgen zijn een van de sterkste voorspellers van het niet ophalen van '
        + 'medicatie. Dat is geen sociale bijzaak maar een behandelbelemmering.',
    },
    {
      id: 'cv-geen-steun',
      wanneer: { type: 'antwoord', vraag: 'cv-steun', operator: '=', waarde: 'nee' },
      dan: [{ type: 'notificeer', rol: 'poh-s',
        bericht: 'Geen steun in de omgeving — weegt mee in de zelfredzaamheid en in het contactinterval.' }],
      ernst: 'aandacht',
      onderbouwing: 'Wie het alleen moet doen, houdt afspraken minder vaak vol. Dat hoort in de '
        + 'inschatting van de zelfredzaamheid mee te wegen (ADR-0008).',
    },
    {
      id: 'cv-stress-en-slecht-slapen',
      wanneer: { type: 'en', van: [
        { type: 'antwoord', vraag: 'cv-stress', operator: '=', waarde: 'ja' },
        { type: 'antwoord', vraag: 'cv-slaap', operator: '=', waarde: 'nee' },
      ] },
      dan: [{ type: 'notificeer', rol: 'poh-s',
        bericht: 'Stress én slecht slapen — bespreek dit vóór de leefstijladviezen.' }],
      ernst: 'aandacht',
      onderbouwing: 'Leefstijladvies bij iemand die niet slaapt en stress heeft, landt niet. '
        + 'De volgorde van het gesprek bepaalt of er iets mee gebeurt.',
    },
    {
      id: 'cv-eigen-onderwerp',
      wanneer: { type: 'beantwoord', vraag: 'cv-gespreksonderwerp' },
      dan: [{ type: 'notificeer', rol: 'poh-s',
        bericht: 'De patiënt heeft zelf een onderwerp ingebracht — begin daarmee.' }],
      ernst: 'informatief',
      onderbouwing: 'Wat de patiënt zelf inbrengt, komt in een consult dat door het protocol wordt '
        + 'geleid zelden aan bod. Het staat daarom bovenaan in plaats van onderaan.',
    },
  ],
};

export const vragenlijsten: Vragenlijst[] = [
  consultvoorbereiding, jaarlijkseScreening, ccqAchtig, mpg,
];

export function vindVragenlijst(id: string): Vragenlijst | undefined {
  return vragenlijsten.find((v) => v.id === id);
}
