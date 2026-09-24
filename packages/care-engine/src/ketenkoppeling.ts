import type { Dossier } from '@zpe/fhir-model';
import { isEigenRegistratie } from '@zpe/fhir-model';
import type { Criterium } from './criteria.js';
import { alle, enigeVan, heeftActieveEpisode, minimaalChronischeEpisodes, minimaleLeeftijd } from './criteria.js';
import { CHRONISCHE_ICPC, CODE, type ModuleId } from './protocol.js';

/**
 * KETENKOPPELING — landelijke zorgprogramma's als projectie, niet als sturing.
 *
 * De zorg wordt geleverd volgens één geïntegreerd protocol (`protocol.ts`). Maar
 * declaratie, ketenzorgcontracten en indicatorenrapportage draaien in Nederland nu
 * eenmaal op programma's per aandoening. Die werkelijkheid negeren betekent dat een
 * praktijk haar financiering breekt.
 *
 * De oplossing: de koppeling gebeurt hier, achteraf en automatisch. Niemand registreert
 * "voor de DM-keten"; er wordt gewoon zorg geleverd, en dit bestand leidt af waar dat
 * bewijs voor levert. De zorgverlener ziet dit als achtergrondinformatie, niet als
 * werkinstructie.
 */

export type KetenId = 'dm' | 'cvrm' | 'copd' | 'ouderenzorg';

export interface Keten {
  id: KetenId;
  naam: string;
  /** Wanneer valt deze patiënt onder deze keten? */
  grondslag: Criterium;
  /** Modules waarvan de uitvoering bewijs levert voor deze keten. */
  modules: ModuleId[];
  /** Metingen die de keten als indicator uitvraagt. */
  indicatorItems: { code: string; naam: string; maxOuderdomDagen: number }[];
  declaratie: { prestatiecode: string; omschrijving: string };
}

const JAAR = 365;

export const ketens: Keten[] = [
  {
    id: 'dm',
    naam: 'Ketenzorg Diabetes',
    grondslag: heeftActieveEpisode(['T90.02']),
    modules: ['glucose', 'vaatrisico', 'nierfunctie', 'leefstijl'],
    indicatorItems: [
      { code: CODE.hba1c, naam: 'HbA1c', maxOuderdomDagen: JAAR },
      { code: CODE.rrSys, naam: 'Bloeddruk', maxOuderdomDagen: JAAR },
      { code: CODE.ldl, naam: 'LDL-cholesterol', maxOuderdomDagen: JAAR },
      { code: CODE.egfr, naam: 'eGFR', maxOuderdomDagen: JAAR },
      { code: CODE.roken, naam: 'Rookstatus', maxOuderdomDagen: JAAR },
      { code: CODE.voet, naam: 'Voetonderzoek', maxOuderdomDagen: JAAR },
      { code: CODE.fundus, naam: 'Funduscontrole', maxOuderdomDagen: 2 * JAAR },
    ],
    declaratie: { prestatiecode: 'DM-KETEN', omschrijving: 'Ketenzorg diabetes mellitus type 2' },
  },
  {
    id: 'cvrm',
    naam: 'Ketenzorg CVRM',
    grondslag: enigeVan([
      heeftActieveEpisode(['K74', 'K75', 'K76', 'K77', 'K89', 'K90']),
      heeftActieveEpisode(['K86', 'K87']),
      heeftActieveEpisode(['T93']),
      heeftActieveEpisode(['U99']),
    ]),
    modules: ['vaatrisico', 'nierfunctie', 'leefstijl'],
    indicatorItems: [
      { code: CODE.rrSys, naam: 'Bloeddruk', maxOuderdomDagen: JAAR },
      { code: CODE.ldl, naam: 'LDL-cholesterol', maxOuderdomDagen: JAAR },
      { code: CODE.egfr, naam: 'eGFR', maxOuderdomDagen: JAAR },
      { code: CODE.roken, naam: 'Rookstatus', maxOuderdomDagen: JAAR },
    ],
    declaratie: { prestatiecode: 'CVRM-KETEN', omschrijving: 'Ketenzorg cardiovasculair risicomanagement' },
  },
  {
    id: 'copd',
    naam: 'Ketenzorg COPD',
    grondslag: heeftActieveEpisode(['R95']),
    modules: ['ademhaling', 'leefstijl'],
    indicatorItems: [
      { code: CODE.ccq, naam: 'Klachtenscore (CCQ)', maxOuderdomDagen: JAAR },
      { code: CODE.fev1, naam: 'Spirometrie (FEV1)', maxOuderdomDagen: JAAR },
      { code: CODE.roken, naam: 'Rookstatus', maxOuderdomDagen: JAAR },
    ],
    declaratie: { prestatiecode: 'COPD-KETEN', omschrijving: 'Ketenzorg COPD' },
  },
  {
    id: 'ouderenzorg',
    naam: 'Programma kwetsbare ouderen',
    grondslag: alle([minimaleLeeftijd(75), minimaalChronischeEpisodes(2, CHRONISCHE_ICPC)]),
    modules: ['kwetsbaarheid', 'medicatieveiligheid'],
    indicatorItems: [
      { code: CODE.kwetsbaarheid, naam: 'Kwetsbaarheidsinventarisatie', maxOuderdomDagen: JAAR },
      { code: CODE.medicatiebeoordeling, naam: 'Medicatiebeoordeling', maxOuderdomDagen: JAAR },
    ],
    declaratie: { prestatiecode: 'OZ-MODULE', omschrijving: 'Module ouderenzorg' },
  },
];

export interface Ketenbijdrage {
  ketenId: KetenId;
  naam: string;
  /** Waarom valt deze patiënt onder deze keten — automatisch afgeleid. */
  grondslag: string;
  declaratie: { prestatiecode: string; omschrijving: string };
  /** Welke actieve modules bewijs leveren voor deze keten. */
  gedektDoorModules: string[];
  indicatoren: { code: string; naam: string; voldaan: boolean; toelichting: string }[];
  /** Aandeel indicatoren dat op orde is. */
  volledigheid: number;
}

/**
 * Leidt af onder welke landelijke ketens deze patiënt valt en hoe de indicatoren
 * ervoor staan — puur op basis van wat er feitelijk in het dossier staat.
 *
 * Belangrijk: dit verandert niets aan het zorgplan. Het maakt alleen zichtbaar dat de
 * geleverde zorg ook de verantwoording dekt.
 */
export function ketenbijdragen(
  dossier: Dossier,
  actieveModules: string[],
  peildatum: Date = new Date(),
): Ketenbijdrage[] {
  const bijdragen: Ketenbijdrage[] = [];

  for (const keten of ketens) {
    const grondslag = keten.grondslag.evalueer(dossier, peildatum);
    if (!grondslag.voldaan) continue;

    const indicatoren = keten.indicatorItems.map((item) => {
      const alle = dossier.observaties
        .filter((o) => o.status !== 'entered-in-error')
        .filter((o) => o.code.coding?.some((c) => c.code === item.code))
        .sort((a, b) => b.effectief.localeCompare(a.effectief));
      // Alleen eigen registraties vullen een ketenindicator. Een waarde die de patiënt
      // zelf doorgaf is echt en bruikbaar, maar hij is niet door de praktijk vastgelegd
      // en mag dus niet stilzwijgend een declaratiegrondslag worden (docs/03 §3).
      const meting = alle.find((o) => isEigenRegistratie(o.herkomst));
      const alleenVanElders = !meting && alle.length > 0;

      if (alleenVanElders) {
        // De reden benoemen, niet raden: 'door de patiënt aangeleverd' onder een
        // ziekenhuisuitslag zetten is onjuist en kost het vertrouwen in de verantwoording.
        const bron = alle[0].herkomst.bron === 'patient'
          ? 'door de patiënt aangeleverd'
          : alle[0].herkomst.bron === 'extern-systeem'
            ? `van elders ontvangen (${alle[0].herkomst.systeem?.naam ?? 'extern systeem'})`
            : 'een nog onbevestigde suggestie';
        return {
          code: item.code, naam: item.naam, voldaan: false,
          toelichting: `wel een waarde van ${alle[0].effectief.slice(0, 10)}, maar `
            + `${bron} en nog niet overgenomen`,
        };
      }
      if (!meting) {
        return { code: item.code, naam: item.naam, voldaan: false, toelichting: 'nooit vastgelegd' };
      }
      const dagen = Math.floor((peildatum.getTime() - new Date(meting.effectief).getTime()) / 86_400_000);
      return {
        code: item.code, naam: item.naam,
        voldaan: dagen <= item.maxOuderdomDagen,
        toelichting: dagen <= item.maxOuderdomDagen
          ? `vastgelegd ${dagen} dagen geleden`
          : `${dagen} dagen oud — buiten de termijn van ${item.maxOuderdomDagen} dagen`,
      };
    });

    const gedekt = keten.modules.filter((m) => actieveModules.includes(m));
    bijdragen.push({
      ketenId: keten.id,
      naam: keten.naam,
      grondslag: grondslag.onderbouwing,
      declaratie: keten.declaratie,
      gedektDoorModules: gedekt,
      indicatoren,
      volledigheid: indicatoren.length === 0
        ? 1
        : Math.round((indicatoren.filter((i) => i.voldaan).length / indicatoren.length) * 100) / 100,
    });
  }

  return bijdragen;
}

/**
 * Wat zou dezelfde patiënt in de traditionele inrichting krijgen: één traject per
 * keten, elk met eigen controlemomenten. Uitsluitend als referentiemeting — om te
 * kunnen laten zien wat het geïntegreerde plan scheelt.
 */
export function traditioneleKetens(dossier: Dossier, peildatum: Date = new Date()): Keten[] {
  return ketens.filter((k) => k.grondslag.evalueer(dossier, peildatum).voldaan);
}

export { minimaleLeeftijd };
