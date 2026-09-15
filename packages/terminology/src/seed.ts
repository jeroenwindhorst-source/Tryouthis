import type { Concept } from './types.js';

/**
 * DEMO-SEED — géén productieterminologie.
 *
 * Deze set bestaat uitsluitend om de terminologielogica te kunnen bouwen en testen
 * zolang de echte distributie er niet is. Bij ingebruikname wordt dit bestand
 * vervangen door een import van:
 *   1. de ICPC-1 NL-tabel van het NHG;
 *   2. de SNOMED CT NL-editie (Nictiz);
 *   3. de ICPC↔SNOMED-mapping van de opdrachtgever (docs/02 §6).
 *
 * De SNOMED-concept-id's en ICPC-codes hieronder zijn echt, maar de selectie is
 * willekeurig klein en de mapping-equivalenties zijn niet door een terminoloog
 * gereviewd. Niet gebruiken voor zorg.
 */
export const DEMO_SEED_WAARSCHUWING =
  'Demoterminologie — niet voor klinisch gebruik. Vervang door de NHG/Nictiz-distributie.';

export const demoConcepten: Concept[] = [
  // ── Registratieset: diagnoses met directe ICPC-koppeling ──────────────────
  { snomed: '44054006', fsn: 'Diabetes mellitus type 2 (disorder)', display: 'Diabetes mellitus type 2',
    synoniemen: ['DM2', 'diabetes type 2', 'suikerziekte type 2', 'ouderdomsdiabetes'],
    icpc1: 'T90.02', icpc1Display: 'Diabetes mellitus type 2',
    niveau: 'registratieset', equivalentie: 'exact', ouders: ['73211009'],
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '46635009', fsn: 'Diabetes mellitus type 1 (disorder)', display: 'Diabetes mellitus type 1',
    synoniemen: ['DM1', 'diabetes type 1', 'jeugddiabetes'],
    icpc1: 'T89', icpc1Display: 'Diabetes mellitus type 1',
    niveau: 'registratieset', equivalentie: 'exact', ouders: ['73211009'],
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '9414007', fsn: 'Impaired glucose tolerance (finding)', display: 'Gestoorde glucosetolerantie',
    synoniemen: ['IGT', 'prediabetes', 'gestoord nuchter glucose'],
    icpc1: 'B85.01', icpc1Display: 'Gestoorde glucosetolerantie',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '38341003', fsn: 'Hypertensive disorder, systemic arterial (disorder)',
    display: 'Hypertensie zonder orgaanbeschadiging',
    synoniemen: ['hoge bloeddruk', 'verhoogde bloeddruk', 'HT'],
    icpc1: 'K86', icpc1Display: 'Hypertensie zonder orgaanbeschadiging',
    niveau: 'registratieset', equivalentie: 'ruimer',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '64715009', fsn: 'Hypertensive heart disease (disorder)',
    display: 'Hypertensie met orgaanbeschadiging',
    synoniemen: ['hypertensieve hartziekte'],
    icpc1: 'K87', icpc1Display: 'Hypertensie met orgaanbeschadiging',
    niveau: 'registratieset', equivalentie: 'gedeeltelijk', ouders: ['38341003'],
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '13645005', fsn: 'Chronic obstructive lung disease (disorder)', display: 'COPD',
    synoniemen: ['chronisch obstructief longlijden', 'emfyseem', 'chronische bronchitis'],
    icpc1: 'R95', icpc1Display: 'Chronische bronchitis/COPD',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '195967001', fsn: 'Asthma (disorder)', display: 'Astma',
    synoniemen: ['astma bronchiale'],
    icpc1: 'R96', icpc1Display: 'Astma',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '194828000', fsn: 'Angina pectoris (disorder)', display: 'Angina pectoris',
    synoniemen: ['AP', 'pijn op de borst bij inspanning'],
    icpc1: 'K74', icpc1Display: 'Ischemische hartziekte met angina pectoris',
    niveau: 'registratieset', equivalentie: 'exact', ouders: ['414545008'],
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '57054005', fsn: 'Acute myocardial infarction (disorder)', display: 'Acuut myocardinfarct',
    synoniemen: ['hartinfarct', 'AMI', 'infarct'],
    icpc1: 'K75', icpc1Display: 'Acuut myocardinfarct',
    niveau: 'registratieset', equivalentie: 'exact', ouders: ['414545008'],
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '414545008', fsn: 'Ischemic heart disease (disorder)', display: 'Ischemische hartziekte',
    synoniemen: ['coronairlijden', 'chronische ischemische hartziekte'],
    icpc1: 'K76', icpc1Display: 'Andere/chronische ischemische hartziekte',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '84114007', fsn: 'Heart failure (disorder)', display: 'Hartfalen',
    synoniemen: ['decompensatio cordis', 'hartzwakte'],
    icpc1: 'K77', icpc1Display: 'Decompensatio cordis',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '230690007', fsn: 'Cerebrovascular accident (disorder)', display: 'Cerebrovasculair accident',
    synoniemen: ['CVA', 'beroerte', 'herseninfarct'],
    icpc1: 'K90.03', icpc1Display: 'Cerebrovasculair accident',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '266257000', fsn: 'Transient ischemic attack (disorder)', display: 'TIA',
    synoniemen: ['passagere cerebrale ischemie', 'transient ischemic attack'],
    icpc1: 'K89', icpc1Display: 'Passagere cerebrale ischemie/TIA',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '55822004', fsn: 'Hyperlipidemia (disorder)', display: 'Vetstofwisselingsstoornis',
    synoniemen: ['hypercholesterolemie', 'verhoogd cholesterol', 'dyslipidemie'],
    icpc1: 'T93', icpc1Display: 'Vetstofwisselingsstoornis',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '709044004', fsn: 'Chronic kidney disease (disorder)', display: 'Chronische nierschade',
    synoniemen: ['CNS', 'chronische nierinsufficiëntie', 'nierfunctiestoornis'],
    icpc1: 'U99.01', icpc1Display: 'Chronische nierschade',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '414916001', fsn: 'Obesity (disorder)', display: 'Obesitas',
    synoniemen: ['vetzucht', 'ernstig overgewicht'],
    icpc1: 'T82', icpc1Display: 'Obesitas',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '35489007', fsn: 'Depressive disorder (disorder)', display: 'Depressieve stoornis',
    synoniemen: ['depressie'],
    icpc1: 'P76', icpc1Display: 'Depressieve stoornis',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '197480006', fsn: 'Anxiety disorder (disorder)', display: 'Angststoornis',
    synoniemen: ['angst'],
    icpc1: 'P74', icpc1Display: 'Angststoornis',
    niveau: 'registratieset', equivalentie: 'exact',
    refsets: ['huisarts-diagnose'], status: 'active' },

  { snomed: '4855003', fsn: 'Retinopathy due to diabetes mellitus (disorder)',
    display: 'Diabetische retinopathie', synoniemen: ['retinopathie bij diabetes'],
    icpc1: 'F83.01', icpc1Display: 'Diabetische retinopathie',
    niveau: 'registratieset', equivalentie: 'exact', ouders: ['44054006'],
    refsets: ['huisarts-diagnose'], status: 'active' },

  // ── Uitbreidingsset: specifieker dan ICPC, met ICPC-paraplu ───────────────
  { snomed: '127013003', fsn: 'Disorder of kidney due to diabetes mellitus (disorder)',
    display: 'Diabetische nefropathie', synoniemen: ['nierschade bij diabetes'],
    icpc1: 'T90.02', icpc1Display: 'Diabetes mellitus type 2',
    niveau: 'uitbreidingsset', equivalentie: 'nauwer', ouders: ['44054006', '709044004'],
    refsets: ['huisarts-diagnose-uitbreiding'], status: 'active' },

  { snomed: '49455004', fsn: 'Polyneuropathy due to diabetes mellitus (disorder)',
    display: 'Diabetische polyneuropathie', synoniemen: ['zenuwschade bij diabetes'],
    icpc1: 'T90.02', icpc1Display: 'Diabetes mellitus type 2',
    niveau: 'uitbreidingsset', equivalentie: 'nauwer', ouders: ['44054006'],
    refsets: ['huisarts-diagnose-uitbreiding'], status: 'active' },

  { snomed: '195951007', fsn: 'Acute exacerbation of chronic obstructive airways disease (disorder)',
    display: 'COPD-exacerbatie', synoniemen: ['longaanval', 'exacerbatie COPD'],
    icpc1: 'R95', icpc1Display: 'Chronische bronchitis/COPD',
    niveau: 'uitbreidingsset', equivalentie: 'nauwer', ouders: ['13645005'],
    refsets: ['huisarts-diagnose-uitbreiding'], status: 'active' },

  { snomed: '446221000', fsn: 'Heart failure with normal ejection fraction (disorder)',
    display: 'Hartfalen met behouden ejectiefractie', synoniemen: ['HFpEF'],
    icpc1: 'K77', icpc1Display: 'Decompensatio cordis',
    niveau: 'uitbreidingsset', equivalentie: 'nauwer', ouders: ['84114007'],
    refsets: ['huisarts-diagnose-uitbreiding'], status: 'active' },

  // ── Extern: ontvangbaar, toonbaar, niet registreerbaar ────────────────────
  { snomed: '73211009', fsn: 'Diabetes mellitus (disorder)', display: 'Diabetes mellitus',
    niveau: 'extern', status: 'active' },

  { snomed: '371087003', fsn: 'Diabetic foot ulcer (disorder)', display: 'Diabetisch voetulcus',
    niveau: 'extern', ouders: ['44054006'], status: 'active' },

  { snomed: '400047006', fsn: 'Peripheral vascular disease (disorder)',
    display: 'Perifeer vaatlijden', niveau: 'extern', status: 'active' },

  { snomed: '254837009', fsn: 'Malignant neoplasm of breast (disorder)',
    display: 'Mammacarcinoom', niveau: 'extern', status: 'active' },
];

/** Meetwaarden — NHG-tabel 45 / LOINC. Codes zijn echt; selectie is demo. */
export const demoMetingen: Concept[] = [
  { snomed: '59261-8', display: 'HbA1c (IFCC)', synoniemen: ['hba1c', 'glyco', 'langetermijnsuiker'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '8480-6', display: 'Bloeddruk systolisch', synoniemen: ['RR systolisch', 'bovendruk'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '8462-4', display: 'Bloeddruk diastolisch', synoniemen: ['RR diastolisch', 'onderdruk'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '29463-7', display: 'Gewicht', synoniemen: ['lichaamsgewicht'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '39156-5', display: 'BMI', synoniemen: ['body mass index', 'quetelet'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '13457-7', display: 'LDL-cholesterol', synoniemen: ['ldl'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '62238-1', display: 'eGFR (CKD-EPI)', synoniemen: ['egfr', 'nierfunctie', 'klaring'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '14959-1', display: 'Albumine/creatinine-ratio urine', synoniemen: ['ACR', 'microalbuminurie'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '72166-2', display: 'Rookstatus', synoniemen: ['roken', 'tabaksgebruik'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '20150-9', display: 'FEV1', synoniemen: ['spirometrie', 'longfunctie'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  { snomed: '19926-5', display: 'FEV1/FVC-ratio', synoniemen: ['tiffeneau'],
    niveau: 'registratieset', refsets: ['meting'], status: 'active' },
  // Lokale scores zonder landelijke code — bewust als lokaal gemarkeerd.
  { snomed: 'ccq-totaal', display: 'CCQ totaalscore', synoniemen: ['clinical copd questionnaire'],
    niveau: 'registratieset', refsets: ['meting', 'lokaal'], status: 'active' },
  { snomed: 'mpg-totaal', display: 'Mijn Positieve Gezondheid — totaal',
    synoniemen: ['MPG', 'positieve gezondheid', 'spinnenweb'],
    niveau: 'registratieset', refsets: ['meting', 'lokaal'], status: 'active' },
  { snomed: 'voetonderzoek-simms', display: 'Voetonderzoek (Simms-classificatie)',
    synoniemen: ['voetcontrole', 'simms'],
    niveau: 'registratieset', refsets: ['meting', 'lokaal'], status: 'active' },
  { snomed: 'funduscopie', display: 'Funduscopie', synoniemen: ['oogcontrole', 'netvliesonderzoek'],
    niveau: 'registratieset', refsets: ['meting', 'lokaal'], status: 'active' },
];
