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

export const vragenlijsten: Vragenlijst[] = [ccqAchtig, mpg];

export function vindVragenlijst(id: string): Vragenlijst | undefined {
  return vragenlijsten.find((v) => v.id === id);
}
