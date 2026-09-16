import type { Dossier } from '@zpe/fhir-model';
import { rng } from './populatie.js';

/**
 * INFORMATIE VAN BUITEN DE PRAKTIJK
 *
 * Een huisartsdossier dat alleen de eigen episodes toont, laat de helft van het verhaal
 * weg. De patiënt is in het ziekenhuis geweest, de thuiszorg komt dagelijks, de
 * fysiotherapeut ziet hem twaalf keer. Die informatie komt binnen — als BgZ, als
 * e-Overdracht, als brief — en verdwijnt nu in een postbak of in een los documentscherm.
 *
 * Hier hoort het in dezelfde tijdlijn als het eigen journaal, met twee verschillen die
 * je moet zien en niet mag vergeten:
 *  1. het is **niet in SOEP** geschreven en moet dus een eigen vorm hebben;
 *  2. het is **niet van ons**, dus de bron staat erbij en het telt niet automatisch mee
 *     in beslisregels (dezelfde herkomstregel als bij AI-suggesties, docs/03 §3).
 */

export type Bronsoort = 'ziekenhuis' | 'thuiszorg' | 'paramedisch' | 'ggz' | 'apotheek' | 'spoed';

/** De uitwisselstandaard waarlangs het binnenkwam. Bepaalt wat je mag verwachten. */
export type Uitwisseling = 'BgZ' | 'e-Overdracht' | 'MedMij' | 'retourbericht' | 'brief';

export interface Externebron {
  id: string;
  soort: Bronsoort;
  naam: string;
  /** Waar een zorgverlener zelf verder kan kijken. Geen mock-up, gewoon een ingang. */
  portaal?: { naam: string; url: string };
}

export interface ExterneSectie {
  naam: string;
  regels: { label: string; waarde: string }[];
}

export interface ExternDocument {
  id: string;
  patientId: string;
  bron: Externebron;
  uitwisseling: Uitwisseling;
  /** Datum van de zorg zelf — dit bepaalt de plek in de tijdlijn. */
  datum: string;
  /** Wanneer het bij ons binnenkwam. Kan later zijn; dat verschil is vaak het probleem. */
  ontvangenOp: string;
  titel: string;
  samenvatting: string;
  secties: ExterneSectie[];
  /** Aan welke eigen episode dit hangt, als dat bekend is. */
  episodeIcpc?: string;
  gelezen: boolean;
  /** Is dit het gevolg van een verwijzing die wij zelf stuurden? */
  opOnzeVerwijzing?: boolean;
}

const ZIEKENHUIZEN: Externebron[] = [
  { id: 'zh-amc', soort: 'ziekenhuis', naam: 'Amsterdam UMC',
    portaal: { naam: 'Epic Care Link', url: 'https://carelink.example-ziekenhuis.nl' } },
  { id: 'zh-olvg', soort: 'ziekenhuis', naam: 'OLVG',
    portaal: { naam: 'Epic Care Link', url: 'https://carelink.example-ziekenhuis.nl' } },
  { id: 'zh-spaarne', soort: 'ziekenhuis', naam: 'Spaarne Gasthuis',
    portaal: { naam: 'ZorgPortaal', url: 'https://zorgportaal.example-ziekenhuis.nl' } },
];

const THUISZORG: Externebron = {
  id: 'tz-buurtzorg', soort: 'thuiszorg', naam: 'Thuiszorg De Linde',
  portaal: { naam: 'Zorgdossier thuiszorg', url: 'https://dossier.example-thuiszorg.nl' },
};

const PARAMEDISCH: Externebron[] = [
  { id: 'pm-fysio', soort: 'paramedisch', naam: 'Fysiotherapie Centrum West' },
  { id: 'pm-dietist', soort: 'paramedisch', naam: 'Diëtistenpraktijk Voeding & Zorg' },
  { id: 'pm-podo', soort: 'paramedisch', naam: 'Podotherapie Stadshart' },
];

const GGZ: Externebron = { id: 'ggz-basis', soort: 'ggz', naam: 'Basis-GGZ Stadspraktijk' };

const SPOED: Externebron = {
  id: 'hap', soort: 'spoed', naam: 'Huisartsenpost regio',
  portaal: { naam: 'HAP-dossier', url: 'https://hap.example-regio.nl' },
};

type Sjabloon = Omit<ExternDocument, 'id' | 'patientId' | 'datum' | 'ontvangenOp' | 'gelezen' | 'bron'>
  & { bronKeuze: 'ziekenhuis' | 'thuiszorg' | 'paramedisch' | 'ggz' | 'spoed'; voorIcpc?: string[] };

/**
 * Sjablonen per soort zorg. De inhoud volgt de opbouw van de standaard waarlangs het
 * binnenkomt: een BgZ heeft vaste secties (behandelaars, diagnoses, medicatie,
 * verrichtingen, allergieën), een e-Overdracht heeft een verpleegkundige structuur.
 * Dat is precies waarom je het niet in SOEP kunt persen.
 */
const SJABLONEN: Sjabloon[] = [
  {
    bronKeuze: 'ziekenhuis', uitwisseling: 'BgZ', voorIcpc: ['K86', 'K74', 'K77'],
    titel: 'Polikliniekbezoek cardiologie',
    samenvatting:
      'Gezien op de poli cardiologie na verwijzing. Inspanningstest zonder aanwijzingen voor ischemie. ' +
      'Beleid: medicamenteus, controle over zes maanden. Geen verdere diagnostiek nodig.',
    opOnzeVerwijzing: true,
    episodeIcpc: 'K86',
    secties: [
      { naam: 'Behandelaar', regels: [
        { label: 'Specialisme', waarde: 'Cardiologie' },
        { label: 'Hoofdbehandelaar', waarde: 'dr. A. Meijer, cardioloog' },
      ] },
      { naam: 'Diagnoses', regels: [
        { label: 'Hoofddiagnose', waarde: 'Essentiële hypertensie (I10)' },
        { label: 'Nevendiagnose', waarde: 'Geen aanwijzingen voor coronairlijden' },
      ] },
      { naam: 'Verrichtingen', regels: [
        { label: 'Inspanningselektrocardiografie', waarde: 'negatief, goede inspanningstolerantie' },
        { label: 'Echocardiografie', waarde: 'goede linkerventrikelfunctie, LVEF 58%' },
      ] },
      { naam: 'Medicatie bij ontslag', regels: [
        { label: 'Gewijzigd', waarde: 'Amlodipine 5 mg opgehoogd naar 10 mg 1dd' },
        { label: 'Ongewijzigd', waarde: 'Overige medicatie voortgezet' },
      ] },
      { naam: 'Vervolgafspraken', regels: [
        { label: 'Controle', waarde: 'Poli cardiologie over 6 maanden' },
        { label: 'Actie huisarts', waarde: 'Bloeddrukcontrole over 6 weken in de praktijk' },
      ] },
    ],
  },
  {
    bronKeuze: 'ziekenhuis', uitwisseling: 'BgZ', voorIcpc: ['T90', 'T90.02'],
    titel: 'Jaarcontrole internist — diabetes',
    samenvatting:
      'Jaarlijkse controle bij de internist wegens complexe diabetes. HbA1c 64 mmol/mol. ' +
      'Insuline-schema aangepast. Retinopathie-screening elders verricht, geen afwijkingen.',
    episodeIcpc: 'T90.02',
    secties: [
      { naam: 'Behandelaar', regels: [
        { label: 'Specialisme', waarde: 'Interne geneeskunde' },
        { label: 'Hoofdbehandelaar', waarde: 'dr. S. Oosterhuis, internist' },
      ] },
      { naam: 'Uitslagen', regels: [
        { label: 'HbA1c', waarde: '64 mmol/mol' },
        { label: 'eGFR', waarde: '58 ml/min/1,73m²' },
        { label: 'Albumine/creatinine-ratio', waarde: '4,2 mg/mmol' },
      ] },
      { naam: 'Medicatie bij ontslag', regels: [
        { label: 'Gewijzigd', waarde: 'Insuline glargine opgehoogd naar 28 E voor de nacht' },
      ] },
      { naam: 'Afspraken', regels: [
        { label: 'Taakverdeling', waarde: 'Voetcontrole en leefstijl blijven bij de huisartsenpraktijk' },
        { label: 'Controle', waarde: 'Internist over 12 maanden' },
      ] },
    ],
  },
  {
    bronKeuze: 'ziekenhuis', uitwisseling: 'BgZ', voorIcpc: ['R95', 'R96'],
    titel: 'Opname longgeneeskunde — exacerbatie COPD',
    samenvatting:
      'Opgenomen geweest met een exacerbatie COPD. Behandeld met prednison en antibiotica. ' +
      'Ontslagen in goede conditie. Longrevalidatie geadviseerd.',
    episodeIcpc: 'R95',
    secties: [
      { naam: 'Opname', regels: [
        { label: 'Afdeling', waarde: 'Longgeneeskunde' },
        { label: 'Opnameduur', waarde: '4 dagen' },
        { label: 'Reden', waarde: 'Exacerbatie COPD met respiratoire insufficiëntie' },
      ] },
      { naam: 'Behandeling', regels: [
        { label: 'Medicatie', waarde: 'Prednisolon 30 mg 5 dagen, amoxicilline/clavulaanzuur 7 dagen' },
        { label: 'Zuurstof', waarde: 'Tijdelijk, bij ontslag niet meer nodig' },
      ] },
      { naam: 'Ontslagadvies', regels: [
        { label: 'Longrevalidatie', waarde: 'Aangemeld bij eerstelijns longrevalidatie' },
        { label: 'Actie huisarts', waarde: 'Controle binnen 2 weken, inhalatietechniek nakijken' },
        { label: 'Stoppen met roken', waarde: 'Patiënt gemotiveerd, begeleiding via de praktijk' },
      ] },
    ],
  },
  {
    bronKeuze: 'ziekenhuis', uitwisseling: 'retourbericht',
    titel: 'Retourbericht chirurgie — liesbreuk',
    samenvatting:
      'Gezien op de poli chirurgie na uw verwijzing. Rechtszijdige liesbreuk bevestigd. ' +
      'Patiënt op de wachtlijst geplaatst voor laparoscopische correctie.',
    opOnzeVerwijzing: true,
    secties: [
      { naam: 'Vraagstelling', regels: [
        { label: 'Uw vraag', waarde: 'Liesbreuk, beoordeling operatie-indicatie' },
      ] },
      { naam: 'Bevindingen', regels: [
        { label: 'Onderzoek', waarde: 'Reponibele indirecte liesbreuk rechts, niet beklemd' },
        { label: 'Beleid', waarde: 'Laparoscopische correctie, wachttijd ongeveer 8 weken' },
      ] },
      { naam: 'Terugkoppeling', regels: [
        { label: 'Actie huisarts', waarde: 'Geen. Patiënt meldt zich bij toename klachten of beklemming.' },
      ] },
    ],
  },
  {
    bronKeuze: 'thuiszorg', uitwisseling: 'e-Overdracht',
    titel: 'Verpleegkundige overdracht thuiszorg',
    samenvatting:
      'Start thuiszorg tweemaal daags voor persoonlijke verzorging en medicatiebegeleiding. ' +
      'Verpleegkundige signaleert toenemende vergeetachtigheid en een verhoogd valrisico.',
    secties: [
      { naam: 'Zorgvraag', regels: [
        { label: 'Indicatie', waarde: 'Persoonlijke verzorging 2×/dag, verpleging 1×/week' },
        { label: 'Startdatum', waarde: 'lopend' },
      ] },
      { naam: 'Verpleegkundige observaties', regels: [
        { label: 'Mobiliteit', waarde: 'Loopt met rollator binnenshuis, buitenshuis niet meer alleen' },
        { label: 'Valrisico', waarde: 'Verhoogd — tweemaal gevallen in de afgelopen drie maanden' },
        { label: 'Cognitie', waarde: 'Vergeet afspraken, medicatiedoos regelmatig niet geleegd' },
        { label: 'Voeding', waarde: 'Eet matig, gewichtsverlies opgemerkt' },
      ] },
      { naam: 'Mantelzorg', regels: [
        { label: 'Netwerk', waarde: 'Dochter woont op afstand, komt wekelijks' },
        { label: 'Belasting', waarde: 'Dochter geeft aan het zwaar te vinden' },
      ] },
      { naam: 'Verzoek aan de huisarts', regels: [
        { label: 'Vraag', waarde: 'Graag beoordeling medicatie en overweging casemanagement dementie' },
      ] },
    ],
  },
  {
    bronKeuze: 'paramedisch', uitwisseling: 'brief',
    titel: 'Eindverslag fysiotherapie',
    samenvatting:
      'Twaalf behandelingen afgerond voor lage rugklachten. Pijnscore van 7 naar 3. ' +
      'Patiënt kan het oefenprogramma zelfstandig voortzetten.',
    opOnzeVerwijzing: true,
    secties: [
      { naam: 'Behandeling', regels: [
        { label: 'Aantal zittingen', waarde: '12' },
        { label: 'Verwijsreden', waarde: 'Aspecifieke lage rugklachten' },
      ] },
      { naam: 'Resultaat', regels: [
        { label: 'Pijn (NRS)', waarde: 'van 7 naar 3' },
        { label: 'Functioneren', waarde: 'Werkhervatting volledig' },
      ] },
      { naam: 'Advies', regels: [
        { label: 'Vervolg', waarde: 'Zelfstandig oefenprogramma, geen controle nodig' },
      ] },
    ],
  },
  {
    bronKeuze: 'paramedisch', uitwisseling: 'brief', voorIcpc: ['T90', 'T90.02'],
    titel: 'Rapportage diëtist',
    samenvatting:
      'Drie consulten voedingsadvies bij diabetes. Koolhydraatverdeling aangepast, ' +
      'gewicht 3,5 kg gedaald. Patiënt houdt een eetdagboek bij.',
    opOnzeVerwijzing: true,
    episodeIcpc: 'T90.02',
    secties: [
      { naam: 'Traject', regels: [
        { label: 'Consulten', waarde: '3 (intake plus twee vervolg)' },
        { label: 'Doel', waarde: 'Gewichtsreductie en stabielere glucosewaarden' },
      ] },
      { naam: 'Resultaat', regels: [
        { label: 'Gewicht', waarde: '−3,5 kg in 4 maanden' },
        { label: 'Zelfmanagement', waarde: 'Houdt eetdagboek bij, herkent koolhydraatbronnen' },
      ] },
      { naam: 'Advies', regels: [
        { label: 'Vervolg', waarde: 'Controle over 6 maanden, tussentijds op verzoek' },
      ] },
    ],
  },
  {
    bronKeuze: 'ggz', uitwisseling: 'brief',
    titel: 'Afsluitbrief basis-GGZ',
    samenvatting:
      'Acht gesprekken cognitieve gedragstherapie bij een depressieve episode. ' +
      'Klachten fors afgenomen. Terugvalpreventieplan opgesteld en meegegeven.',
    opOnzeVerwijzing: true,
    secties: [
      { naam: 'Traject', regels: [
        { label: 'Behandelvorm', waarde: 'Cognitieve gedragstherapie, 8 sessies' },
        { label: 'Diagnose', waarde: 'Depressieve episode, matig ernstig' },
      ] },
      { naam: 'Beloop', regels: [
        { label: 'Meting begin', waarde: 'PHQ-9: 17' },
        { label: 'Meting eind', waarde: 'PHQ-9: 6' },
      ] },
      { naam: 'Afspraken', regels: [
        { label: 'Terugvalpreventie', waarde: 'Plan opgesteld, kopie bij patiënt' },
        { label: 'Actie huisarts', waarde: 'Medicatie voortzetten tot minimaal 6 maanden na herstel' },
      ] },
    ],
  },
  {
    bronKeuze: 'spoed', uitwisseling: 'retourbericht',
    titel: 'Contact huisartsenpost',
    samenvatting:
      'Patiënt heeft de huisartsenpost bezocht in het weekend wegens pijn op de borst. ' +
      'Beoordeeld als musculoskeletaal. Geen vervolgactie, wel advies contact met eigen huisarts.',
    secties: [
      { naam: 'Contact', regels: [
        { label: 'Wanneer', waarde: 'Zaterdagavond, consult ter plaatse' },
        { label: 'Klacht', waarde: 'Pijn links op de borst, vastzittend aan de ademhaling' },
      ] },
      { naam: 'Beoordeling', regels: [
        { label: 'Onderzoek', waarde: 'ECG zonder afwijkingen, drukpijn intercostaal' },
        { label: 'Conclusie', waarde: 'Musculoskeletale thoracale pijn' },
      ] },
      { naam: 'Beleid', regels: [
        { label: 'Advies', waarde: 'Paracetamol, contact eigen huisarts bij aanhouden' },
      ] },
    ],
  },
];

const icpcVan = (dossier: Dossier): string[] =>
  dossier.episodes
    .filter((e) => e.status === 'active')
    .flatMap((e) => e.code.coding ?? [])
    .filter((c) => c.system.includes('icpc'))
    .map((c) => c.code);

/**
 * Externe documenten voor één patiënt.
 *
 * Gekozen op grond van wat er werkelijk in het dossier staat: wie geen COPD heeft,
 * krijgt geen ontslagbrief longgeneeskunde. Zonder die koppeling is het decor.
 */
export function genereerExterneDocumenten(
  dossier: Dossier, peildatum: Date, zaad: number,
): ExternDocument[] {
  const willekeurig = rng(zaad);
  const eigenIcpc = icpcVan(dossier);
  const passend = SJABLONEN.filter((s) =>
    !s.voorIcpc || s.voorIcpc.some((c) => eigenIcpc.some((e) => e.startsWith(c))));

  // Niet iedereen heeft iets van buiten; ongeveer twee derde wel.
  const aantal = willekeurig() < 0.34 ? 0 : 1 + Math.floor(willekeurig() * 2.4);
  const gekozen: Sjabloon[] = [];
  for (let i = 0; i < aantal && passend.length > 0; i++) {
    const kandidaat = passend[Math.floor(willekeurig() * passend.length)];
    if (!gekozen.includes(kandidaat)) gekozen.push(kandidaat);
  }

  return gekozen.map((sjabloon, i) => {
    const dagenTerug = 30 + Math.floor(willekeurig() * 900);
    const datum = new Date(peildatum);
    datum.setDate(datum.getDate() - dagenTerug);
    // De vertraging tussen zorg en overdracht is echt en vaak het probleem.
    const ontvangen = new Date(datum);
    ontvangen.setDate(ontvangen.getDate() + 1 + Math.floor(willekeurig() * 21));

    const bron: Externebron =
      sjabloon.bronKeuze === 'ziekenhuis' ? ZIEKENHUIZEN[Math.floor(willekeurig() * ZIEKENHUIZEN.length)]
      : sjabloon.bronKeuze === 'thuiszorg' ? THUISZORG
      : sjabloon.bronKeuze === 'paramedisch' ? PARAMEDISCH[Math.floor(willekeurig() * PARAMEDISCH.length)]
      : sjabloon.bronKeuze === 'ggz' ? GGZ
      : SPOED;

    const { bronKeuze: _weg, voorIcpc: _ook, ...rest } = sjabloon;
    return {
      ...rest,
      id: `ext-${dossier.patient.id}-${i + 1}`,
      patientId: dossier.patient.id,
      bron,
      datum: datum.toISOString().slice(0, 10),
      ontvangenOp: ontvangen.toISOString().slice(0, 10),
      gelezen: dagenTerug > 60,
    };
  }).sort((a, b) => b.datum.localeCompare(a.datum));
}
