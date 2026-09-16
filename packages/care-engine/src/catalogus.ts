import type { Dossier } from '@zpe/fhir-model';
import { actieveEpisodes, laatsteMeting, leeftijd, numeriekeWaarde } from '@zpe/fhir-model';
import { CODE } from './protocol.js';

/**
 * DE ORDERCATALOGUS
 *
 * Ordersets dekken het voorspelbare deel van het werk: wat volgt uit een protocol en
 * waarvoor de aanleiding in het dossier staat. Maar het grootste deel van een
 * huisartsendag is niet voorspelbaar. Iemand heeft rugpijn en heeft paracetamol nodig,
 * iemand anders moet naar de chirurg voor een liesbreuk. Daar bestaat geen pakket voor,
 * en er hoort er ook geen te bestaan.
 *
 * Deze catalogus is dus het tegenovergestelde van de orderset: één regel, zelf gezocht,
 * zelf gedoseerd. Hij is bewust klein en expliciet onvolledig — een echt formularium
 * komt uit de G-Standaard en de NHG-Tabellen, onder licentie. Wat hier staat is genoeg
 * om het werkproces te bouwen en te laten zien welke velden een order nodig heeft.
 */

export type CatalogusSoort = 'medicatie' | 'lab' | 'verwijzing' | 'onderzoek' | 'afspraak';

export interface Middel {
  atc: string;
  naam: string;
  vorm: string;
  /** Wat er standaard in het doseerveld komt te staan. */
  dosering: string;
  /** Alternatieven die één klik verderop staan, zodat typen meestal niet nodig is. */
  varianten: string[];
  /** Waar dit middel doorgaans voor is; puur om op te kunnen zoeken. */
  indicaties: string[];
  chronisch?: boolean;
}

/**
 * Een klein formularium van veelgebruikte middelen in de huisartsenpraktijk.
 *
 * ⚠️ Niet gecontroleerd tegen de G-Standaard. Doseringen zijn plausibel en gangbaar,
 * maar dit is demomateriaal: geen medicatiebewaking, geen interactiebestand, geen
 * contra-indicatiebestand. Zie docs/16 §5.
 */
export const FORMULARIUM: Middel[] = [
  { atc: 'N02BE01', naam: 'Paracetamol 500 mg', vorm: 'tablet', dosering: '3dd 2 tabletten',
    varianten: ['zo nodig 1-2 tabletten, max 4dd2', '3dd 2 tabletten', '4dd 2 tabletten (max 3 dagen)'],
    indicaties: ['pijn', 'koorts', 'artrose'] },
  { atc: 'M01AE01', naam: 'Ibuprofen 400 mg', vorm: 'tablet', dosering: '3dd 1 tablet bij de maaltijd',
    varianten: ['3dd 1 tablet, maximaal 5 dagen', '3dd 1 tablet bij de maaltijd'],
    indicaties: ['pijn', 'ontsteking', 'nsaid'] },
  { atc: 'M01AE02', naam: 'Naproxen 500 mg', vorm: 'tablet', dosering: '2dd 1 tablet bij de maaltijd',
    varianten: ['2dd 1 tablet bij de maaltijd', '2dd 1 tablet, maximaal 7 dagen'],
    indicaties: ['pijn', 'jicht', 'nsaid'] },
  { atc: 'M01AB05', naam: 'Diclofenac 50 mg', vorm: 'tablet', dosering: '3dd 1 tablet bij de maaltijd',
    varianten: ['3dd 1 tablet bij de maaltijd'], indicaties: ['pijn', 'nsaid'] },
  { atc: 'N02AX02', naam: 'Tramadol 50 mg', vorm: 'capsule', dosering: '3dd 1 capsule zo nodig',
    varianten: ['zo nodig 1 capsule, max 4dd', '3dd 1 capsule zo nodig', '2dd 1 capsule (start bij ouderen)'],
    indicaties: ['pijn', 'opioïd'] },
  { atc: 'N02AA05', naam: 'Oxycodon mga 5 mg', vorm: 'tablet met gereguleerde afgifte',
    dosering: '2dd 1 tablet', varianten: ['2dd 1 tablet'], indicaties: ['pijn', 'opioïd', 'palliatief'] },
  { atc: 'J01CA04', naam: 'Amoxicilline 500 mg', vorm: 'capsule', dosering: '3dd 1 capsule, 7 dagen',
    varianten: ['3dd 1 capsule, 7 dagen', '3dd 1 capsule, 5 dagen'], indicaties: ['infectie', 'antibioticum', 'luchtweg'] },
  { atc: 'J01AA02', naam: 'Doxycycline 100 mg', vorm: 'tablet', dosering: 'dag 1: 2 tabletten, daarna 1dd1, 7 dagen',
    varianten: ['dag 1: 2 tabletten, daarna 1dd1, 7 dagen'], indicaties: ['infectie', 'antibioticum', 'luchtweg'] },
  { atc: 'J01XE01', naam: 'Nitrofurantoïne mga 100 mg', vorm: 'capsule', dosering: '2dd 1 capsule, 5 dagen',
    varianten: ['2dd 1 capsule, 5 dagen'], indicaties: ['blaasontsteking', 'urineweginfectie', 'antibioticum'] },
  { atc: 'A02BC01', naam: 'Omeprazol 20 mg', vorm: 'capsule', dosering: '1dd 1 capsule',
    varianten: ['1dd 1 capsule', '2dd 1 capsule'], indicaties: ['maagbescherming', 'reflux'], chronisch: true },
  { atc: 'A10BA02', naam: 'Metformine 500 mg', vorm: 'tablet', dosering: '1dd 1 tablet bij de maaltijd, na 2 weken 2dd1',
    varianten: ['1dd 1 tablet (insluipen)', '2dd 1 tablet', '2dd 2 tabletten'],
    indicaties: ['diabetes', 'glucose'], chronisch: true },
  { atc: 'A10BB09', naam: 'Gliclazide mga 30 mg', vorm: 'tablet', dosering: '1dd 1 tablet bij het ontbijt',
    varianten: ['1dd 1 tablet', '1dd 2 tabletten'], indicaties: ['diabetes', 'glucose'], chronisch: true },
  { atc: 'C10AA01', naam: 'Simvastatine 40 mg', vorm: 'tablet', dosering: '1dd 1 tablet voor de nacht',
    varianten: ['1dd 1 tablet voor de nacht'], indicaties: ['cholesterol', 'statine', 'vaatrisico'], chronisch: true },
  { atc: 'C10AA05', naam: 'Atorvastatine 20 mg', vorm: 'tablet', dosering: '1dd 1 tablet',
    varianten: ['1dd 1 tablet', '1dd 2 tabletten'], indicaties: ['cholesterol', 'statine', 'vaatrisico'], chronisch: true },
  { atc: 'C09AA03', naam: 'Lisinopril 10 mg', vorm: 'tablet', dosering: '1dd 1 tablet',
    varianten: ['1dd 1/2 tablet (start)', '1dd 1 tablet', '1dd 2 tabletten'],
    indicaties: ['bloeddruk', 'hypertensie', 'ras-remmer'], chronisch: true },
  { atc: 'C09CA01', naam: 'Losartan 50 mg', vorm: 'tablet', dosering: '1dd 1 tablet',
    varianten: ['1dd 1 tablet', '1dd 2 tabletten'], indicaties: ['bloeddruk', 'hypertensie', 'ras-remmer'], chronisch: true },
  { atc: 'C08CA01', naam: 'Amlodipine 5 mg', vorm: 'tablet', dosering: '1dd 1 tablet',
    varianten: ['1dd 1 tablet', '1dd 2 tabletten'], indicaties: ['bloeddruk', 'hypertensie'], chronisch: true },
  { atc: 'C03AA03', naam: 'Hydrochloorthiazide 12,5 mg', vorm: 'tablet', dosering: '1dd 1 tablet',
    varianten: ['1dd 1 tablet', '1dd 2 tabletten'], indicaties: ['bloeddruk', 'diureticum'], chronisch: true },
  { atc: 'C07AB02', naam: 'Metoprolol mga 50 mg', vorm: 'tablet', dosering: '1dd 1 tablet',
    varianten: ['1dd 1 tablet', '1dd 2 tabletten'], indicaties: ['bloeddruk', 'hartritme', 'bètablokker'], chronisch: true },
  { atc: 'C03CA01', naam: 'Furosemide 40 mg', vorm: 'tablet', dosering: '1dd 1 tablet in de ochtend',
    varianten: ['1dd 1 tablet in de ochtend', '1dd 2 tabletten'], indicaties: ['hartfalen', 'oedeem', 'diureticum'], chronisch: true },
  { atc: 'R03AC02', naam: 'Salbutamol dosisaerosol 100 mcg', vorm: 'inhalatie',
    dosering: 'zo nodig 1-2 inhalaties, max 4dd', varianten: ['zo nodig 1-2 inhalaties, max 4dd'],
    indicaties: ['benauwd', 'astma', 'copd', 'luchtweg'], chronisch: true },
  { atc: 'R03BB04', naam: 'Tiotropium inhalatie 18 mcg', vorm: 'inhalatiepoeder', dosering: '1dd 1 inhalatie',
    varianten: ['1dd 1 inhalatie'], indicaties: ['copd', 'luchtweg'], chronisch: true },
  { atc: 'R03AK07', naam: 'Budesonide/formoterol 160/4,5', vorm: 'inhalatiepoeder', dosering: '2dd 1 inhalatie',
    varianten: ['2dd 1 inhalatie', '2dd 2 inhalaties'], indicaties: ['astma', 'copd', 'luchtweg'], chronisch: true },
  { atc: 'H03AA01', naam: 'Levothyroxine 75 mcg', vorm: 'tablet', dosering: '1dd 1 tablet nuchter',
    varianten: ['1dd 1 tablet nuchter'], indicaties: ['schildklier'], chronisch: true },
  { atc: 'A06AD65', naam: 'Macrogol/elektrolyten', vorm: 'sachet', dosering: '1dd 1 sachet',
    varianten: ['1dd 1 sachet', '2dd 1 sachet'], indicaties: ['obstipatie'] },
  { atc: 'D07AC13', naam: 'Mometasoncrème 0,1%', vorm: 'crème', dosering: '1dd dun aanbrengen, max 2 weken',
    varianten: ['1dd dun aanbrengen, max 2 weken'], indicaties: ['eczeem', 'huid'] },
  { atc: 'D01AC02', naam: 'Miconazolcrème 2%', vorm: 'crème', dosering: '2dd aanbrengen, 2 weken doorgaan na genezing',
    varianten: ['2dd aanbrengen'], indicaties: ['schimmel', 'huid'] },
  { atc: 'N06AB06', naam: 'Sertraline 50 mg', vorm: 'tablet', dosering: '1dd 1 tablet',
    varianten: ['1dd 1/2 tablet (start)', '1dd 1 tablet'], indicaties: ['depressie', 'angst', 'mentaal'], chronisch: true },
  { atc: 'N05BA04', naam: 'Oxazepam 10 mg', vorm: 'tablet', dosering: 'zo nodig 1 tablet, max 3dd, maximaal 2 weken',
    varianten: ['zo nodig 1 tablet voor de nacht', 'zo nodig 1 tablet, max 3dd'], indicaties: ['slaap', 'angst', 'benzodiazepine'] },
];

export interface Specialisme {
  id: string;
  naam: string;
  /** Eerste of tweede lijn — bepaalt de route. */
  lijn: 'eerste' | 'tweede';
  /** Hoe de verwijzing eruit gaat. */
  via: 'ZorgDomein' | 'directe verwijsbrief';
  vraagstellingen: string[];
  /** Waar een verwijzing naartoe kan; puur demo. */
  instellingen?: string[];
  portaal?: { naam: string; url: string };
}

/**
 * Verwijsbestemmingen.
 *
 * De route staat erbij omdat die het werk bepaalt: wat via ZorgDomein gaat, krijgt een
 * gestructureerd formulier met een verplichte vraagstelling en een terugkoppeling;
 * de rest is een brief. Dat verschil hoort zichtbaar te zijn op het moment van
 * verwijzen, niet pas als de brief terugkomt.
 */
export const VERWIJZINGEN: Specialisme[] = [
  { id: 'chirurgie', naam: 'Chirurgie', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Liesbreuk, beoordeling operatie-indicatie', 'Galsteenlijden', 'Varices',
      'Excisie huidafwijking', 'Proctologie'],
    instellingen: ['Amsterdam UMC', 'OLVG', 'Spaarne Gasthuis'],
    portaal: { naam: 'Epic Care Link', url: 'https://carelink.example-ziekenhuis.nl' } },
  { id: 'interne', naam: 'Interne geneeskunde', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Onbegrepen anemie', 'Ontregelde diabetes', 'Elektrolytstoornis', 'Onbegrepen gewichtsverlies'],
    instellingen: ['Amsterdam UMC', 'OLVG'],
    portaal: { naam: 'Epic Care Link', url: 'https://carelink.example-ziekenhuis.nl' } },
  { id: 'cardiologie', naam: 'Cardiologie', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Pijn op de borst, verdenking angina pectoris', 'Ritmestoornis / palpitaties',
      'Verdenking hartfalen', 'Souffle'],
    instellingen: ['Amsterdam UMC', 'OLVG'],
    portaal: { naam: 'Epic Care Link', url: 'https://carelink.example-ziekenhuis.nl' } },
  { id: 'longgeneeskunde', naam: 'Longgeneeskunde', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['COPD met frequente exacerbaties', 'Onbegrepen dyspneu', 'Afwijkende spirometrie'],
    instellingen: ['Amsterdam UMC'] },
  { id: 'dermatologie', naam: 'Dermatologie', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Verdenking maligniteit huid', 'Therapieresistent eczeem', 'Chronische wond'],
    instellingen: ['Dermatologisch Centrum', 'OLVG'] },
  { id: 'orthopedie', naam: 'Orthopedie', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Coxartrose, beoordeling prothese', 'Gonartrose', 'Schouderklachten therapieresistent'] },
  { id: 'neurologie', naam: 'Neurologie', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Verdenking TIA', 'Onbegrepen neuropathie', 'Hoofdpijn met alarmsymptomen'] },
  { id: 'urologie', naam: 'Urologie', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Verhoogd PSA', 'Mictieklachten therapieresistent', 'Hematurie'] },
  { id: 'kno', naam: 'KNO', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Gehoorverlies', 'Chronische rhinosinusitis', 'Heesheid > 6 weken'] },
  { id: 'oogheelkunde', naam: 'Oogheelkunde', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Diabetische retinopathie', 'Visusdaling', 'Verdenking glaucoom'] },
  { id: 'mdl', naam: 'Maag-darm-leverziekten', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Alarmsymptomen bovenbuik', 'Rectaal bloedverlies', 'Chronische diarree'] },
  { id: 'geriatrie', naam: 'Klinische geriatrie', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Cognitieve stoornis, diagnostiek', 'Vallen bij polyfarmacie', 'Comprehensive geriatric assessment'] },
  { id: 'sog', naam: 'Specialist ouderengeneeskunde', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Advies bij complexe ouderenzorg thuis', 'Probleemgedrag bij dementie',
      'Medebehandeling kwetsbare oudere', 'Advies rond behandelgrenzen'] },
  { id: 'ggz-basis', naam: 'Basis-GGZ', lijn: 'eerste', via: 'ZorgDomein',
    vraagstellingen: ['Depressieve klachten', 'Angstklachten', 'Overspanning/burn-out'] },
  { id: 'ggz-spec', naam: 'Specialistische GGZ', lijn: 'tweede', via: 'ZorgDomein',
    vraagstellingen: ['Ernstige depressie', 'Persoonlijkheidsproblematiek', 'Verslavingszorg'] },
  { id: 'fysiotherapie', naam: 'Fysiotherapie', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Lage rugklachten', 'Schouderklachten', 'Revalidatie na fractuur', 'Beweegprogramma COPD'] },
  { id: 'dietetiek', naam: 'Diëtetiek', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Voedingsadvies bij diabetes', 'Ongewenst gewichtsverlies', 'Nierfunctiestoornis'] },
  { id: 'podotherapie', naam: 'Podotherapie', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Verhoogd voetrisico bij diabetes', 'Drukplekken', 'Standsafwijking'] },
  { id: 'ergotherapie', naam: 'Ergotherapie', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Dagelijks functioneren thuis', 'Valpreventie', 'Hulpmiddelenadvies'] },
  { id: 'logopedie', naam: 'Logopedie', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Slikklachten', 'Afasie na CVA', 'Stemklachten'] },
  { id: 'wijkverpleging', naam: 'Wijkverpleging', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Indicatiestelling thuiszorg', 'Wondzorg thuis', 'Medicatiebegeleiding thuis'] },
  { id: 'wijkteam', naam: 'Wijkteam / ouderenadviseur', lijn: 'eerste', via: 'directe verwijsbrief',
    vraagstellingen: ['Ondersteuning bij financiën en administratie', 'Eenzaamheid', 'Mantelzorgondersteuning'] },
];

export interface Bepaling {
  code: string;
  naam: string;
  materiaal: 'bloed' | 'urine' | 'ontlasting' | 'uitstrijk';
  /** Meetcodes die deze bepaling oplevert; gebruikt om het zorgplan bij te werken. */
  levert?: string[];
  indicaties: string[];
}

export const LABBEPALINGEN: Bepaling[] = [
  { code: 'hb', naam: 'Hemoglobine', materiaal: 'bloed', indicaties: ['moeheid', 'anemie', 'bloedbeeld'] },
  { code: 'bloedbeeld', naam: 'Volledig bloedbeeld', materiaal: 'bloed', indicaties: ['moeheid', 'anemie', 'infectie'] },
  { code: 'crp', naam: 'CRP', materiaal: 'bloed', indicaties: ['infectie', 'ontsteking'] },
  { code: 'bse', naam: 'BSE', materiaal: 'bloed', indicaties: ['ontsteking', 'reuma'] },
  { code: CODE.hba1c, naam: 'HbA1c', materiaal: 'bloed', levert: [CODE.hba1c], indicaties: ['diabetes', 'glucose'] },
  { code: 'glucose-nuchter', naam: 'Glucose nuchter', materiaal: 'bloed', indicaties: ['diabetes', 'glucose'] },
  { code: CODE.egfr, naam: 'Kreatinine en eGFR', materiaal: 'bloed', levert: [CODE.egfr], indicaties: ['nier', 'medicatiecontrole'] },
  { code: 'kalium', naam: 'Kalium en natrium', materiaal: 'bloed', indicaties: ['nier', 'medicatiecontrole', 'diureticum'] },
  { code: CODE.ldl, naam: 'Lipidenprofiel', materiaal: 'bloed', levert: [CODE.ldl], indicaties: ['cholesterol', 'vaatrisico'] },
  { code: 'leverenzymen', naam: 'Leverenzymen (ALAT, ASAT, gGT)', materiaal: 'bloed', indicaties: ['lever', 'statine', 'alcohol'] },
  { code: 'tsh', naam: 'TSH', materiaal: 'bloed', indicaties: ['schildklier', 'moeheid'] },
  { code: 'ferritine', naam: 'Ferritine', materiaal: 'bloed', indicaties: ['anemie', 'moeheid', 'ijzer'] },
  { code: 'b12', naam: 'Vitamine B12 en foliumzuur', materiaal: 'bloed', indicaties: ['moeheid', 'anemie', 'neuropathie'] },
  { code: 'vitd', naam: 'Vitamine D', materiaal: 'bloed', indicaties: ['botten', 'vallen', 'moeheid'] },
  { code: CODE.acr, naam: 'Albumine/creatinine-ratio', materiaal: 'urine', levert: [CODE.acr], indicaties: ['nier', 'diabetes'] },
  { code: 'urine-kweek', naam: 'Urinekweek met resistentiebepaling', materiaal: 'urine', indicaties: ['blaasontsteking', 'urineweginfectie'] },
  { code: 'psa', naam: 'PSA', materiaal: 'bloed', indicaties: ['prostaat', 'mictieklachten'] },
  { code: 'coeliakie', naam: 'Coeliakieserologie', materiaal: 'bloed', indicaties: ['buikklachten', 'diarree'] },
  { code: 'reuma', naam: 'Reumafactor en anti-CCP', materiaal: 'bloed', indicaties: ['gewrichten', 'reuma'] },
  { code: 'fob', naam: 'Fecaal occult bloed', materiaal: 'ontlasting', indicaties: ['darm', 'anemie'] },
];

export interface Verrichting {
  code: string;
  naam: string;
  waar: 'praktijk' | 'diagnostisch centrum';
  levert?: string[];
  indicaties: string[];
}

export const ONDERZOEKEN: Verrichting[] = [
  { code: 'ecg', naam: 'ECG (rust)', waar: 'praktijk',
    indicaties: ['hart', 'palpitaties', 'pijn op de borst', 'ritme'] },
  { code: 'spirometrie', naam: 'Spirometrie', waar: 'praktijk', levert: [CODE.fev1, CODE.fevRatio],
    indicaties: ['copd', 'astma', 'luchtweg'] },
  { code: 'abpm', naam: '24-uurs bloeddrukmeting', waar: 'praktijk', levert: [CODE.rrSys, CODE.rrDia],
    indicaties: ['bloeddruk', 'hypertensie'] },
  { code: 'eai', naam: 'Enkel-armindex', waar: 'praktijk', indicaties: ['vaatrisico', 'claudicatio'] },
  { code: 'x-thorax', naam: 'X-thorax', waar: 'diagnostisch centrum', indicaties: ['luchtweg', 'hoesten'] },
  { code: 'echo-abdomen', naam: 'Echo abdomen', waar: 'diagnostisch centrum', indicaties: ['buikklachten', 'galsteen'] },
  { code: 'audiometrie', naam: 'Audiometrie', waar: 'praktijk', indicaties: ['gehoor', 'oor'] },
  { code: 'wratten', naam: 'Wratten aanstippen', waar: 'praktijk',
    indicaties: ['wratten', 'huid', 'stikstof'] },
  { code: 'uitstrijkje', naam: 'Uitstrijkje (BVO)', waar: 'praktijk',
    indicaties: ['baarmoederhals', 'bevolkingsonderzoek', 'uitstrijk'] },
  { code: 'voetonderzoek', naam: 'Voetonderzoek (Simms)', waar: 'praktijk',
    indicaties: ['diabetes', 'voet', 'neuropathie'] },
];

export interface Afspraaksoort {
  code: string;
  naam: string;
  /** Bij wie in de praktijk. */
  bijRol: 'huisarts' | 'poh-s' | 'assistent';
  duurMinuten: number;
  /** Waarvoor je dit gebruikt; ook het zoekwoord. */
  redenen: string[];
  vorm: 'op de praktijk' | 'telefonisch' | 'videoconsult' | 'visite' | 'groepsconsult';
  /**
   * Bij een groepsconsult: welk aandachtsgebied het thema is.
   *
   * Zo'n order plant geen los tijdslot maar zet deze mens op het eerstvolgende blok met
   * dat thema. Zonder deze verwijzing zou een groepsconsult een afspraak van tachtig
   * minuten in een lege agenda worden, en dat is precies het misverstand dat bestaande
   * systemen maken.
   */
  groepModule?: string;
}

/**
 * Afspraken binnen de eigen praktijk.
 *
 * Dit stond er nog niet in, en dat was een gat: de POH die tijdens een consult
 * concludeert dat de huisarts ernaar moet kijken, had geen andere uitweg dan een bericht
 * sturen of het onthouden. Een afspraak bij een collega is gewoon een order — hij heeft
 * een reden, een ontvanger en een route, net als een verwijzing naar de tweede lijn.
 */
export const AFSPRAKEN: Afspraaksoort[] = [
  { code: 'afs-ha', naam: 'Afspraak bij de huisarts', bijRol: 'huisarts', duurMinuten: 10,
    vorm: 'op de praktijk',
    redenen: ['Beoordeling door de huisarts gevraagd', 'Medicatie bespreken', 'Klacht die buiten mijn kader valt',
      'Uitslag bespreken', 'Verdenking nieuwe diagnose'] },
  { code: 'afs-ha-dubbel', naam: 'Dubbel consult huisarts', bijRol: 'huisarts', duurMinuten: 20,
    vorm: 'op de praktijk',
    redenen: ['Meerdere klachten', 'Complexe problematiek', 'Gesprek over behandelwensen'] },
  { code: 'afs-ha-video', naam: 'Videoconsult huisarts', bijRol: 'huisarts', duurMinuten: 10,
    vorm: 'videoconsult',
    redenen: ['Beoordeling op afstand volstaat', 'Patiënt kan niet naar de praktijk komen',
      'Nabespreken uitslag'] },
  { code: 'afs-ha-visite', naam: 'Visite huisarts', bijRol: 'huisarts', duurMinuten: 30,
    vorm: 'visite',
    redenen: ['Patiënt is niet mobiel', 'Beoordeling in de thuissituatie'] },
  { code: 'afs-poh', naam: 'Controle bij de POH-Somatiek', bijRol: 'poh-s', duurMinuten: 20,
    vorm: 'op de praktijk',
    redenen: ['Reguliere controle chronische zorg', 'Controle na medicatiewijziging',
      'Leefstijlbegeleiding', 'Controle na ziekenhuisopname'] },
  { code: 'afs-poh-video', naam: 'Videoconsult POH-Somatiek', bijRol: 'poh-s', duurMinuten: 20,
    vorm: 'videoconsult',
    redenen: ['Controle op afstand', 'Bespreken thuismeetreeks', 'Coaching tussendoor'] },
  { code: 'afs-poh-tel', naam: 'Telefonische controle POH', bijRol: 'poh-s', duurMinuten: 10,
    vorm: 'telefonisch',
    redenen: ['Korte controle', 'Navragen hoe het gaat na een wijziging'] },
  { code: 'afs-as', naam: 'Afspraak bij de assistent', bijRol: 'assistent', duurMinuten: 10,
    vorm: 'op de praktijk',
    redenen: ['Bloeddrukmeting', 'Bloedafname', 'Injectie', 'Wondcontrole', 'Uitstrijkje',
      'Oren uitspuiten'] },

  // Groepsconsulten. Ze staan in dezelfde catalogus als de rest, want vanuit het consult
  // is "ik zet je op de leefstijlgroep" dezelfde handeling als "ik plan een controle".
  { code: 'afs-groep-leefstijl', naam: 'Groepsconsult leefstijl bij diabetes',
    bijRol: 'poh-s', duurMinuten: 90, vorm: 'groepsconsult', groepModule: 'glucose',
    redenen: ['Leren omgaan met koolhydraten', 'Leefstijl als aangrijpingspunt',
      'Meer halen uit een uur dan uit tien minuten'] },
  { code: 'afs-groep-ademhaling', naam: 'Groepsconsult ademhaling bij COPD',
    bijRol: 'poh-s', duurMinuten: 75, vorm: 'groepsconsult', groepModule: 'ademhaling',
    redenen: ['Ademhalingsoefeningen', 'Inhalatietechniek in groepsvorm',
      'Omgaan met benauwdheid'] },
  { code: 'afs-groep-roken', naam: 'Groepsconsult stoppen met roken',
    bijRol: 'poh-s', duurMinuten: 60, vorm: 'groepsconsult', groepModule: 'leefstijl',
    redenen: ['Stoppen met roken in groepsvorm', 'Gezamenlijke stopdatum'] },
  { code: 'afs-groep-hartvaat', naam: 'Groepsconsult hart en vaten',
    bijRol: 'poh-s', duurMinuten: 75, vorm: 'groepsconsult', groepModule: 'vaatrisico',
    redenen: ['Uitleg over risico en medicatie', 'Bewegen bij verhoogd vaatrisico'] },
  { code: 'afs-groep-ouderen', naam: 'Groepsbijeenkomst kwetsbare ouderen',
    bijRol: 'huisarts', duurMinuten: 90, vorm: 'groepsconsult', groepModule: 'kwetsbaarheid',
    redenen: ['Valpreventie', 'Gesprek over wat belangrijk is', 'Zelfstandig blijven'] },
];

// ── Zoeken ───────────────────────────────────────────────────────────────────

export interface Catalogustreffer {
  id: string;
  soort: CatalogusSoort;
  naam: string;
  /** Wat er standaard in het detailveld komt: dosering, vraagstelling of materiaal. */
  detail: string;
  /** Keuzes die één klik verderop staan. */
  varianten: string[];
  atc?: string;
  levert?: string[];
  /** Hoe dit de praktijk verlaat. */
  route?: string;
  /** Voor verwijzingen: naar welke instelling het kan. */
  instellingen?: string[];
  portaal?: { naam: string; url: string };
  /** Voor onderzoek: de code van de verrichting, zodat de uitkomstvelden erbij te vinden zijn. */
  verrichtingCode?: string;
  /** Voor afspraken: bij welke rol en hoe lang. */
  bijRol?: string;
  duurMinuten?: number;
  vorm?: string;
  /** Bij een groepsconsult: het aandachtsgebied waarvan het blok het thema is. */
  groepModule?: string;
  vereistRecht: 'medicatie-voorschrijven' | 'verwijzen' | 'lab-aanvragen' | 'dossier-registreren';
}

const past = (vraag: string, ...velden: (string | string[] | undefined)[]): boolean => {
  const q = vraag.trim().toLowerCase();
  if (q.length < 2) return false;
  return velden.some((v) =>
    (Array.isArray(v) ? v : [v ?? '']).some((t) => t.toLowerCase().includes(q)));
};

/**
 * Losse orders zoeken over de hele catalogus.
 *
 * Eén zoekveld voor middelen, bepalingen, onderzoek en verwijzingen. De zorgverlener
 * denkt in "wat moet er gebeuren", niet in "welk van de vier ordersoorten is dit" —
 * die indeling is een systeemindeling en hoort niet in het zoekpad te staan.
 */
export function zoekCatalogus(vraag: string, soorten?: CatalogusSoort[]): Catalogustreffer[] {
  const wil = (s: CatalogusSoort) => !soorten || soorten.length === 0 || soorten.includes(s);
  const treffers: Catalogustreffer[] = [];

  if (wil('medicatie')) {
    for (const m of FORMULARIUM) {
      if (!past(vraag, m.naam, m.atc, m.indicaties, m.vorm)) continue;
      treffers.push({
        id: `med-${m.atc}`, soort: 'medicatie', naam: m.naam, detail: m.dosering,
        varianten: m.varianten, atc: m.atc, route: 'recept naar de apotheek',
        vereistRecht: 'medicatie-voorschrijven',
      });
    }
  }

  if (wil('lab')) {
    for (const b of LABBEPALINGEN) {
      if (!past(vraag, b.naam, b.indicaties, b.materiaal)) continue;
      treffers.push({
        id: `lab-${b.code}`, soort: 'lab', naam: b.naam, detail: `materiaal: ${b.materiaal}`,
        varianten: ['met spoed', 'nuchter afnemen', 'over 3 maanden'], levert: b.levert,
        route: 'aanvraag naar het laboratorium', vereistRecht: 'lab-aanvragen',
      });
    }
  }

  if (wil('onderzoek')) {
    for (const o of ONDERZOEKEN) {
      if (!past(vraag, o.naam, o.indicaties)) continue;
      treffers.push({
        id: `ond-${o.code}`, soort: 'onderzoek', naam: o.naam, detail: `uit te voeren in de ${o.waar}`,
        varianten: ['deze week', 'binnen een maand'], levert: o.levert, verrichtingCode: o.code,
        route: o.waar === 'praktijk' ? 'inplannen bij de assistent' : 'aanvraag diagnostisch centrum',
        vereistRecht: o.waar === 'praktijk' ? 'dossier-registreren' : 'lab-aanvragen',
      });
    }
  }

  if (wil('afspraak')) {
    for (const a of AFSPRAKEN) {
      if (!past(vraag, a.naam, a.redenen, a.bijRol, a.vorm, 'afspraak')) continue;
      treffers.push({
        id: `afs-${a.code}`, soort: 'afspraak', naam: a.naam, detail: a.redenen[0],
        varianten: a.redenen, bijRol: a.bijRol, duurMinuten: a.duurMinuten, vorm: a.vorm,
        groepModule: a.groepModule,
        route: a.groepModule
          ? `${a.duurMinuten} minuten · groepsblok bij de ${a.bijRol}`
          : `${a.duurMinuten} minuten · ${a.vorm}`,
        vereistRecht: 'dossier-registreren',
      });
    }
  }

  if (wil('verwijzing')) {
    for (const s of VERWIJZINGEN) {
      if (!past(vraag, s.naam, s.vraagstellingen, s.id, s.instellingen)) continue;
      treffers.push({
        id: `verw-${s.id}`, soort: 'verwijzing', naam: `Verwijzing ${s.naam}`,
        detail: s.vraagstellingen[0], varianten: s.vraagstellingen,
        route: s.via === 'ZorgDomein' ? 'via ZorgDomein' : 'directe verwijsbrief',
        instellingen: s.instellingen, portaal: s.portaal, vereistRecht: 'verwijzen',
      });
    }
  }

  return treffers.slice(0, 24);
}

// ── Bewaking op losse orders ────────────────────────────────────────────────

export interface CatalogusWaarschuwing {
  ernst: 'blokkerend' | 'let-op' | 'informatief';
  tekst: string;
  bron?: string;
}

const heeftAtc = (dossier: Dossier, prefix: string): boolean =>
  dossier.medicatie.some((m) => m.status === 'active'
    && (m.middel.coding ?? []).some((c) => c.code.startsWith(prefix)));

/**
 * Bewaking op een los middel.
 *
 * Vier regels die in de huisartsenpraktijk werkelijk tot schade leiden, en waarvan de
 * gegevens in het dossier staan. Bewust niet meer: een lange lijst waarschuwingen die
 * meestal onterecht is, leert mensen af om te lezen — en dan werkt ook de terechte
 * waarschuwing niet meer. Interactiebewaking middel-op-middel hoort in de G-Standaard
 * en staat hier dus niet (docs/16 §5).
 */
export function bewaakMiddel(
  atc: string, dossier: Dossier, peildatum = new Date(),
): CatalogusWaarschuwing[] {
  const uit: CatalogusWaarschuwing[] = [];
  const egfr = numeriekeWaarde(laatsteMeting(dossier, CODE.egfr));
  const jaar = leeftijd(dossier, peildatum);
  const icpcs = actieveEpisodes(dossier)
    .flatMap((e) => e.code.coding ?? [])
    .filter((c) => c.system.includes('icpc'))
    .map((c) => c.code);

  if (atc.startsWith('M01A')) {
    if (egfr !== undefined && egfr < 30) {
      uit.push({ ernst: 'blokkerend',
        tekst: `NSAID bij een eGFR van ${egfr} ml/min: gecontraïndiceerd wegens kans op acute nierschade.`,
        bron: 'NHG-Standaard Chronische nierschade' });
    } else if (egfr !== undefined && egfr < 60) {
      uit.push({ ernst: 'let-op',
        tekst: `NSAID bij een eGFR van ${egfr} ml/min: alleen kort en met controle van de nierfunctie.`,
        bron: 'NHG-Standaard Chronische nierschade' });
    }
    if (heeftAtc(dossier, 'C09') && (heeftAtc(dossier, 'C03'))) {
      uit.push({ ernst: 'let-op',
        tekst: 'RAS-remmer plus diureticum plus NSAID — de "triple whammy". Sterk verhoogde kans op acute nierschade.',
        bron: 'NHG-Standaard Pijn / Chronische nierschade' });
    }
    if (icpcs.some((c) => c.startsWith('K77'))) {
      uit.push({ ernst: 'let-op',
        tekst: 'Bekend met hartfalen: NSAID kan decompensatie uitlokken en de werking van diuretica verminderen.',
        bron: 'NHG-Standaard Hartfalen' });
    }
  }

  if (atc.startsWith('J01XE') && egfr !== undefined && egfr < 30) {
    uit.push({ ernst: 'blokkerend',
      tekst: `Nitrofurantoïne werkt onvoldoende bij een eGFR van ${egfr} ml/min en geeft meer bijwerkingen.`,
      bron: 'NHG-Standaard Urineweginfecties' });
  }

  if ((atc.startsWith('N02A') || atc.startsWith('N05BA') || atc.startsWith('N05CD')) && jaar >= 75) {
    uit.push({ ernst: 'let-op',
      tekst: `${jaar} jaar: opioïden en benzodiazepinen verhogen het valrisico en de kans op een delier. Start laag.`,
      bron: 'Richtlijn Polyfarmacie bij ouderen' });
  }

  if (atc.startsWith('A10BA') && egfr !== undefined) {
    if (egfr < 30) {
      uit.push({ ernst: 'blokkerend',
        tekst: `Metformine is gecontraïndiceerd bij een eGFR onder 30 ml/min. Actuele waarde: ${egfr} ml/min.`,
        bron: 'NHG-Standaard Diabetes mellitus type 2' });
    } else if (egfr < 45) {
      uit.push({ ernst: 'let-op',
        tekst: `Bij een eGFR van ${egfr} ml/min geldt een maximale dosering van 1000 mg per dag.`,
        bron: 'NHG-Standaard Diabetes mellitus type 2' });
    }
  }

  if (atc.startsWith('C09') && egfr !== undefined && egfr < 45) {
    uit.push({ ernst: 'let-op',
      tekst: `RAS-remmer bij eGFR ${egfr} ml/min: controleer nierfunctie en kalium 1 tot 2 weken na wijziging.`,
      bron: 'NHG-Standaard Chronische nierschade' });
  }

  // Dubbelmedicatie: hetzelfde middel staat al op de lijst. Dit is de fout die in de
  // praktijk het vaakst gemaakt wordt — een herhaalrecept naast een nieuw recept — en
  // het enige wat je ervoor nodig hebt, staat gewoon in het dossier.
  const zelfde = dossier.medicatie.find((m) => m.status === 'active'
    && (m.middel.coding ?? []).some((c) => c.code === atc));
  if (zelfde) {
    uit.push({ ernst: 'let-op',
      tekst: `Dit middel staat al actief in het dossier: ${zelfde.middel.text ?? atc}, `
        + `${zelfde.dosering}. Wijzig de bestaande regel in plaats van een tweede toe te voegen.`,
      bron: 'medicatiebewaking — dubbelmedicatie' });
  }

  const chronisch = dossier.medicatie.filter((m) => m.status === 'active' && m.chronisch).length;
  if (jaar >= 75 && chronisch >= 5) {
    uit.push({ ernst: 'let-op',
      tekst: `${jaar} jaar met ${chronisch} chronische middelen. Weeg toevoegen af tegen een medicatiebeoordeling.`,
      bron: 'Richtlijn Polyfarmacie bij ouderen' });
  }

  return uit;
}
