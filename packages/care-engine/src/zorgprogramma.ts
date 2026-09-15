import type { Rol } from '@zpe/fhir-model';
import type { Criterium } from './criteria.js';
import {
  alle, enigeVan, heeftActieveEpisode, heeftMarkering, heeftMedicatie,
  metingBoven, minimaleLeeftijd, rookt,
} from './criteria.js';

/** Een meting die een protocolactiviteit nodig heeft, met houdbaarheid. */
export interface BenodigdeMetingDefinitie {
  code: string;
  naam: string;
  /** Hoe 'vers' de meting moet zijn. Bepaalt wanneer hij opnieuw nodig is. */
  maxOuderdomDagen: number;
  /** Tijd die de meting kost binnen een consult; gebruikt voor duurberekening. */
  duurMinuten: number;
  /** Kan de patiënt dit zelf aanleveren (thuismeting/vragenlijst)? */
  zelfAanleverbaar?: boolean;
  /** Moet dit in een lab-aanvraag vóór het consult? */
  labVooraf?: boolean;
}

export interface ProtocolActiviteit {
  id: string;
  naam: string;
  soort: 'controle' | 'jaarcontrole' | 'onderzoek' | 'educatie' | 'lab';
  metingen: BenodigdeMetingDefinitie[];
  rol: Rol;
  /** Vragenlijst die vóór dit contact wordt uitgezet (docs/12 §2.3). */
  voorbereidingsVragenlijst?: string;
}

export interface Indicator {
  id: string;
  naam: string;
  /** Noemer: wie telt mee. Teller: wie voldoet. */
  noemer: Criterium;
  teller: Criterium;
  streefpercentage?: number;
}

export interface Zorgprogramma {
  id: string;
  naam: string;
  versie: string;
  richtlijn: { naam: string; versie: string; url?: string };
  inclusie: Criterium;
  exclusie: Criterium;
  activiteiten: ProtocolActiviteit[];
  indicatoren: Indicator[];
  declaratie?: { keten: string; prestatiecode?: string };
}

// Codes uit de demoterminologie (packages/terminology/src/seed.ts).
const C = {
  hba1c: '59261-8', rrSys: '8480-6', rrDia: '8462-4', gewicht: '29463-7', bmi: '39156-5',
  ldl: '13457-7', egfr: '62238-1', acr: '14959-1', roken: '72166-2',
  fev1: '20150-9', fevRatio: '19926-5', ccq: 'ccq-totaal', mpg: 'mpg-totaal',
  voet: 'voetonderzoek-simms', fundus: 'funduscopie',
} as const;

const KWARTAAL = 92;
const HALFJAAR = 183;
const JAAR = 365;

export const dm2: Zorgprogramma = {
  id: 'dm2',
  naam: 'Diabetes mellitus type 2',
  versie: '2026.1',
  richtlijn: { naam: 'NHG-Standaard Diabetes mellitus type 2', versie: 'M01' },
  inclusie: alle([
    heeftActieveEpisode(['T90.02']),
    minimaleLeeftijd(18),
  ]),
  exclusie: enigeVan([
    heeftActieveEpisode(['T89']),          // DM1 hoort niet in deze keten
    heeftMarkering('behandeld-elders'),
    heeftMarkering('palliatief'),
  ]),
  activiteiten: [
    {
      id: 'dm2-kwartaalcontrole', naam: 'Kwartaalcontrole diabetes', soort: 'controle', rol: 'poh-s',
      voorbereidingsVragenlijst: 'vl-dm2-voorbereiding',
      metingen: [
        { code: C.hba1c, naam: 'HbA1c', maxOuderdomDagen: KWARTAAL, duurMinuten: 2, labVooraf: true },
        { code: C.rrSys, naam: 'Bloeddruk systolisch', maxOuderdomDagen: KWARTAAL, duurMinuten: 3, zelfAanleverbaar: true },
        { code: C.gewicht, naam: 'Gewicht', maxOuderdomDagen: KWARTAAL, duurMinuten: 1, zelfAanleverbaar: true },
      ],
    },
    {
      id: 'dm2-jaarcontrole', naam: 'Jaarcontrole diabetes', soort: 'jaarcontrole', rol: 'poh-s',
      voorbereidingsVragenlijst: 'vl-dm2-jaarcontrole',
      metingen: [
        { code: C.egfr, naam: 'eGFR', maxOuderdomDagen: JAAR, duurMinuten: 1, labVooraf: true },
        { code: C.acr, naam: 'Albumine/creatinine-ratio', maxOuderdomDagen: JAAR, duurMinuten: 1, labVooraf: true },
        { code: C.ldl, naam: 'LDL-cholesterol', maxOuderdomDagen: JAAR, duurMinuten: 1, labVooraf: true },
        { code: C.voet, naam: 'Voetonderzoek', maxOuderdomDagen: JAAR, duurMinuten: 8 },
        { code: C.roken, naam: 'Rookstatus', maxOuderdomDagen: JAAR, duurMinuten: 2, zelfAanleverbaar: true },
      ],
    },
    {
      id: 'dm2-funduscopie', naam: 'Funduscontrole', soort: 'onderzoek', rol: 'poh-s',
      metingen: [{ code: C.fundus, naam: 'Funduscopie', maxOuderdomDagen: 2 * JAAR, duurMinuten: 0 }],
    },
  ],
  indicatoren: [
    {
      id: 'dm2-hba1c-gemeten', naam: 'HbA1c bepaald in afgelopen 12 maanden',
      noemer: heeftActieveEpisode(['T90.02']),
      teller: metingBoven(C.hba1c, 'HbA1c', 0, JAAR),
      streefpercentage: 90,
    },
  ],
  declaratie: { keten: 'ketenzorg-dm', prestatiecode: 'DM-KETEN' },
};

export const cvrm: Zorgprogramma = {
  id: 'cvrm',
  naam: 'Cardiovasculair risicomanagement',
  versie: '2026.1',
  richtlijn: { naam: 'NHG-Standaard Cardiovasculair risicomanagement', versie: 'M84' },
  inclusie: alle([
    minimaleLeeftijd(18),
    enigeVan([
      heeftActieveEpisode(['K74', 'K75', 'K76', 'K89', 'K90.03']),  // hart- en vaatziekte
      heeftActieveEpisode(['K86', 'K87']),                          // hypertensie
      heeftActieveEpisode(['T93']),                                 // dyslipidemie
      heeftActieveEpisode(['U99.01']),                              // chronische nierschade
      alle([heeftMedicatie('C10', 'statine'), minimaleLeeftijd(40)]),
    ]),
  ]),
  exclusie: enigeVan([
    heeftMarkering('behandeld-elders'),
    heeftMarkering('palliatief'),
  ]),
  activiteiten: [
    {
      id: 'cvrm-controle', naam: 'CVRM-controle', soort: 'controle', rol: 'poh-s',
      voorbereidingsVragenlijst: 'vl-cvrm-voorbereiding',
      metingen: [
        { code: C.rrSys, naam: 'Bloeddruk systolisch', maxOuderdomDagen: KWARTAAL, duurMinuten: 3, zelfAanleverbaar: true },
        { code: C.rrDia, naam: 'Bloeddruk diastolisch', maxOuderdomDagen: KWARTAAL, duurMinuten: 0, zelfAanleverbaar: true },
      ],
    },
    {
      id: 'cvrm-jaarcontrole', naam: 'CVRM-jaarcontrole', soort: 'jaarcontrole', rol: 'poh-s',
      metingen: [
        { code: C.ldl, naam: 'LDL-cholesterol', maxOuderdomDagen: JAAR, duurMinuten: 1, labVooraf: true },
        { code: C.egfr, naam: 'eGFR', maxOuderdomDagen: JAAR, duurMinuten: 1, labVooraf: true },
        { code: C.roken, naam: 'Rookstatus', maxOuderdomDagen: JAAR, duurMinuten: 2, zelfAanleverbaar: true },
        { code: C.gewicht, naam: 'Gewicht', maxOuderdomDagen: JAAR, duurMinuten: 1, zelfAanleverbaar: true },
      ],
    },
  ],
  indicatoren: [
    {
      id: 'cvrm-rr-gemeten', naam: 'Bloeddruk bepaald in afgelopen 12 maanden',
      noemer: heeftActieveEpisode(['K86', 'K87', 'K74', 'K75', 'K76']),
      teller: metingBoven(C.rrSys, 'Bloeddruk systolisch', 0, JAAR),
      streefpercentage: 90,
    },
  ],
  declaratie: { keten: 'ketenzorg-cvrm', prestatiecode: 'CVRM-KETEN' },
};

export const copd: Zorgprogramma = {
  id: 'copd',
  naam: 'COPD',
  versie: '2026.1',
  richtlijn: { naam: 'NHG-Standaard COPD', versie: 'M26' },
  inclusie: alle([
    heeftActieveEpisode(['R95']),
    minimaleLeeftijd(40),
  ]),
  exclusie: enigeVan([
    heeftMarkering('behandeld-elders'),
    heeftMarkering('palliatief'),
  ]),
  activiteiten: [
    {
      id: 'copd-controle', naam: 'COPD-controle', soort: 'controle', rol: 'poh-s',
      voorbereidingsVragenlijst: 'vl-ccq',
      metingen: [
        { code: C.ccq, naam: 'CCQ-score', maxOuderdomDagen: HALFJAAR, duurMinuten: 4, zelfAanleverbaar: true },
        { code: C.gewicht, naam: 'Gewicht', maxOuderdomDagen: HALFJAAR, duurMinuten: 1, zelfAanleverbaar: true },
      ],
    },
    {
      id: 'copd-jaarcontrole', naam: 'COPD-jaarcontrole', soort: 'jaarcontrole', rol: 'poh-s',
      metingen: [
        { code: C.fev1, naam: 'FEV1 (spirometrie)', maxOuderdomDagen: JAAR, duurMinuten: 15 },
        { code: C.fevRatio, naam: 'FEV1/FVC-ratio', maxOuderdomDagen: JAAR, duurMinuten: 0 },
        { code: C.roken, naam: 'Rookstatus', maxOuderdomDagen: JAAR, duurMinuten: 2, zelfAanleverbaar: true },
      ],
    },
  ],
  indicatoren: [
    {
      id: 'copd-ccq-gemeten', naam: 'CCQ afgenomen in afgelopen 12 maanden',
      noemer: heeftActieveEpisode(['R95']),
      teller: metingBoven(C.ccq, 'CCQ-score', -1, JAAR),
      streefpercentage: 80,
    },
    {
      id: 'copd-rookstatus', naam: 'Rookstatus vastgelegd',
      noemer: heeftActieveEpisode(['R95']),
      teller: rookt(),
    },
  ],
  declaratie: { keten: 'ketenzorg-copd', prestatiecode: 'COPD-KETEN' },
};

export const zorgprogrammas: Zorgprogramma[] = [dm2, cvrm, copd];

export function vindZorgprogramma(id: string): Zorgprogramma | undefined {
  return zorgprogrammas.find((z) => z.id === id);
}

export const METING_CODES = C;
