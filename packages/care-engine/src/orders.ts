import type { Dossier } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, metingReeks, numeriekeWaarde } from '@zpe/fhir-model';
import type { Criterium } from './criteria.js';
import {
  alle, enigeVan, heeftActieveEpisode, heeftMedicatie, metingBoven, metingOnder,
  minimaalChronischeMiddelen, minimaleLeeftijd, niet, rookt,
} from './criteria.js';
import { CODE, type Richtlijn } from './protocol.js';
import type { Zorgplan } from './zorgplan.js';

/**
 * ORDERMANAGEMENT
 *
 * Een consult eindigt zelden bij registreren. Er moet meestal iets gebeuren: medicatie,
 * lab, een verwijzing, een vervolgafspraak. In bestaande systemen zijn dat vier losse
 * schermen met elk hun eigen zoekveld, en de samenhang zit in het hoofd van de
 * zorgverlener.
 *
 * Hier is de bouwsteen de **orderset**: een samenhangend pakket dat hoort bij één
 * klinische beslissing. "Start metformine" is niet één recept maar een recept plus een
 * ophoogschema plus controle van de nierfunctie plus een HbA1c over drie maanden. Wie
 * dat met de hand bij elkaar moet zoeken, vergeet het derde item.
 *
 * Twee harde regels:
 *  1. Een orderset is altijd een **voorstel**. Elke regel is los aan of uit te zetten en
 *     aan te passen; niets wordt stilzwijgend meebesteld.
 *  2. Bevoegdheid zit in de order, niet in het scherm. Wat de POH niet zelfstandig mag,
 *     wordt automatisch een autorisatieverzoek aan de huisarts in plaats van een
 *     blokkade — met de context erbij, zodat tekenen seconden kost.
 */

export type OrderSoort = 'medicatie' | 'lab' | 'verwijzing' | 'onderzoek' | 'afspraak' | 'begeleiding';

export type VereistRecht =
  | 'medicatie-voorschrijven' | 'verwijzen' | 'lab-aanvragen' | 'dossier-registreren';

export interface OrderRegel {
  id: string;
  soort: OrderSoort;
  omschrijving: string;
  /** Dosering, bepalingen of vraagstelling — wat de ontvanger nodig heeft. */
  detail?: string;
  atc?: string;
  /** Meetcodes die deze order oplevert; gebruikt om het plan bij te werken. */
  levert?: string[];
  vereistRecht: VereistRecht;
  standaardAan: boolean;
  toelichting?: string;
}

export interface OrderSet {
  id: string;
  naam: string;
  /** Eén zin: waarvoor is dit pakket bedoeld. */
  waarvoor: string;
  module?: string;
  richtlijn?: Richtlijn;
  /** Wanneer stelt het systeem dit voor? */
  wanneer: Criterium;
  regels: OrderRegel[];
}

export interface Waarschuwing {
  ernst: 'blokkerend' | 'let-op' | 'informatief';
  tekst: string;
  bron?: string;
}

const NHG = (naam: string, versie: string, slug: string, paragraaf?: string): Richtlijn => ({
  naam, versie, uitgever: 'NHG', paragraaf,
  url: `https://richtlijnen.nhg.org/standaarden/${slug}`,
});

export const ordersets: OrderSet[] = [
  {
    id: 'start-metformine',
    naam: 'Starten met metformine',
    waarvoor: 'Eerste stap bloedglucoseverlaging bij diabetes type 2 boven de streefwaarde.',
    module: 'glucose',
    richtlijn: NHG('NHG-Standaard Diabetes mellitus type 2', 'M01', 'diabetes-mellitus-type-2',
      'Stappenplan bloedglucoseverlagende middelen'),
    wanneer: alle([
      heeftActieveEpisode(['T90.02']),
      metingBoven(CODE.hba1c, 'HbA1c', 53, 365),
      niet(heeftMedicatie('A10', 'bloedglucoseverlagend middel')),
    ]),
    regels: [
      { id: 'metformine', soort: 'medicatie', omschrijving: 'Metformine 500 mg',
        detail: '1dd1 bij de maaltijd, na 2 weken ophogen naar 2dd1 bij goede verdraagbaarheid',
        atc: 'A10BA02', vereistRecht: 'medicatie-voorschrijven', standaardAan: true,
        toelichting: 'Insluipen beperkt maagdarmklachten, de belangrijkste reden om te stoppen.' },
      { id: 'lab-controle', soort: 'lab', omschrijving: 'Controle na 3 maanden',
        detail: 'HbA1c, kreatinine/eGFR', levert: [CODE.hba1c, CODE.egfr],
        vereistRecht: 'lab-aanvragen', standaardAan: true },
      { id: 'afspraak-controle', soort: 'afspraak', omschrijving: 'Controle bij de POH over 3 maanden',
        detail: '20 minuten, effect en verdraagbaarheid bespreken',
        vereistRecht: 'dossier-registreren', standaardAan: true },
      { id: 'uitleg', soort: 'begeleiding', omschrijving: 'Uitleg en zelfzorgadvies via het portaal',
        detail: 'Wat het middel doet, wat te doen bij maagdarmklachten, wanneer contact opnemen',
        vereistRecht: 'dossier-registreren', standaardAan: true },
    ],
  },

  {
    id: 'bloeddruk-intensiveren',
    naam: 'Bloeddruk verder verlagen',
    waarvoor: 'Herhaald verhoogde bloeddruk ondanks huidige behandeling.',
    module: 'vaatrisico',
    richtlijn: NHG('NHG-Standaard Cardiovasculair risicomanagement', 'M84',
      'cardiovasculair-risicomanagement', 'Medicamenteuze behandeling van hypertensie'),
    wanneer: metingBoven(CODE.rrSys, 'Bloeddruk systolisch', 155, 365),
    regels: [
      { id: 'thuismeetreeks', soort: 'onderzoek', omschrijving: 'Thuismeetreeks 7 dagen',
        detail: 'Tweemaal daags, ochtend en avond, gemiddelde van dag 2 t/m 7',
        levert: [CODE.rrSys, CODE.rrDia], vereistRecht: 'dossier-registreren', standaardAan: true,
        toelichting: 'Onderscheidt praktijkhypertensie van werkelijke hypertensie; voorkomt onnodig ophogen.' },
      { id: 'ras-remmer', soort: 'medicatie', omschrijving: 'Ophogen of toevoegen antihypertensivum',
        detail: 'Keuze afhankelijk van huidige medicatie, nierfunctie en bijwerkingen',
        atc: 'C09', vereistRecht: 'medicatie-voorschrijven', standaardAan: false,
        toelichting: 'Bewust uit: pas na de thuismeetreeks beslissen.' },
      { id: 'lab-nier-kalium', soort: 'lab', omschrijving: 'Controle na wijziging',
        detail: 'Kreatinine/eGFR en kalium, 2 weken na aanpassing', levert: [CODE.egfr],
        vereistRecht: 'lab-aanvragen', standaardAan: true },
    ],
  },

  {
    id: 'jaarlab-diabetes',
    naam: 'Jaarlab diabetes',
    waarvoor: 'Volledige jaarcontrole in één aanvraag, zodat de patiënt één keer prikt.',
    module: 'glucose',
    richtlijn: NHG('NHG-Standaard Diabetes mellitus type 2', 'M01', 'diabetes-mellitus-type-2',
      'Jaarlijkse controle'),
    wanneer: heeftActieveEpisode(['T90.02']),
    regels: [
      { id: 'hba1c', soort: 'lab', omschrijving: 'HbA1c', levert: [CODE.hba1c],
        vereistRecht: 'lab-aanvragen', standaardAan: true },
      { id: 'nier', soort: 'lab', omschrijving: 'Kreatinine/eGFR', levert: [CODE.egfr],
        vereistRecht: 'lab-aanvragen', standaardAan: true },
      { id: 'acr', soort: 'lab', omschrijving: 'Albumine/creatinine-ratio in urine', levert: [CODE.acr],
        vereistRecht: 'lab-aanvragen', standaardAan: true },
      { id: 'lipiden', soort: 'lab', omschrijving: 'Lipidenprofiel', levert: [CODE.ldl],
        vereistRecht: 'lab-aanvragen', standaardAan: true },
    ],
  },

  {
    id: 'funduscontrole',
    naam: 'Funduscontrole aanvragen',
    waarvoor: 'Netvliesonderzoek bij diabetes, volgens het afgesproken interval.',
    module: 'glucose',
    richtlijn: NHG('NHG-Standaard Diabetes mellitus type 2', 'M01', 'diabetes-mellitus-type-2',
      'Controle op retinopathie'),
    wanneer: heeftActieveEpisode(['T90.02']),
    regels: [
      { id: 'fundus', soort: 'verwijzing', omschrijving: 'Funduscontrole (optometrist of oogarts)',
        detail: 'Vraagstelling: screening op diabetische retinopathie. Laatste controle en HbA1c meesturen.',
        levert: [CODE.fundus], vereistRecht: 'verwijzen', standaardAan: true },
    ],
  },

  {
    id: 'voetzorg',
    naam: 'Voetzorg inschakelen',
    waarvoor: 'Verhoogd risico op voetproblemen bij diabetes.',
    module: 'glucose',
    richtlijn: NHG('NHG-Standaard Diabetes mellitus type 2', 'M01', 'diabetes-mellitus-type-2',
      'Voetonderzoek en voetzorg'),
    wanneer: alle([heeftActieveEpisode(['T90.02']), metingBoven(CODE.voet, 'Simms-classificatie', 0, 2 * 365)]),
    regels: [
      { id: 'podotherapeut', soort: 'verwijzing', omschrijving: 'Verwijzing podotherapeut',
        detail: 'Vraagstelling: beoordeling en behandelplan bij verhoogd voetrisico. Simms-classificatie meesturen.',
        vereistRecht: 'verwijzen', standaardAan: true },
      { id: 'voetuitleg', soort: 'begeleiding', omschrijving: 'Voorlichting voetverzorging',
        detail: 'Dagelijkse controle, schoeisel, wanneer contact opnemen',
        vereistRecht: 'dossier-registreren', standaardAan: true },
    ],
  },

  {
    id: 'stoppen-met-roken',
    naam: 'Stoppen-met-rokenbegeleiding',
    waarvoor: 'De interventie met verreweg de grootste gezondheidswinst bij hart-, vaat- en longziekten.',
    module: 'leefstijl',
    richtlijn: { naam: 'NHG-Behandelrichtlijn Stoppen met roken', versie: '2024', uitgever: 'NHG',
      url: 'https://richtlijnen.nhg.org/behandelrichtlijnen/stoppen-met-roken' },
    wanneer: rookt(),
    regels: [
      { id: 'traject', soort: 'begeleiding', omschrijving: 'Begeleidingstraject stoppen met roken',
        detail: 'Intake, stopdatum, vier vervolgcontacten', vereistRecht: 'dossier-registreren',
        standaardAan: true },
      { id: 'farmaco', soort: 'medicatie', omschrijving: 'Farmacotherapie volgens richtlijn',
        detail: 'Keuze in overleg; verdubbelt de slaagkans ten opzichte van alleen advies',
        vereistRecht: 'medicatie-voorschrijven', standaardAan: false },
      { id: 'vergoeding', soort: 'begeleiding', omschrijving: 'Uitleg vergoeding',
        detail: 'Begeleiding wordt vergoed zonder eigen risico', vereistRecht: 'dossier-registreren',
        standaardAan: true, toelichting: 'Wordt vaak vergeten en is voor veel mensen de doorslag.' },
    ],
  },

  {
    id: 'copd-jaarcontrole',
    naam: 'Jaarcontrole COPD',
    waarvoor: 'Longfunctie en klachtenbeloop in één keer.',
    module: 'ademhaling',
    richtlijn: NHG('NHG-Standaard COPD', 'M26', 'copd', 'Monitoring'),
    wanneer: heeftActieveEpisode(['R95']),
    regels: [
      { id: 'spiro', soort: 'onderzoek', omschrijving: 'Spirometrie', detail: 'Met reversibiliteitstest',
        levert: [CODE.fev1, CODE.fevRatio], vereistRecht: 'dossier-registreren', standaardAan: true },
      { id: 'ccq', soort: 'onderzoek', omschrijving: 'CCQ uitzetten via portaal',
        detail: 'Invullen vóór het consult', levert: [CODE.ccq],
        vereistRecht: 'dossier-registreren', standaardAan: true },
      { id: 'inhalatie', soort: 'begeleiding', omschrijving: 'Inhalatie-instructie',
        detail: 'Techniek controleren; onjuist gebruik is de meest voorkomende oorzaak van klachten',
        vereistRecht: 'dossier-registreren', standaardAan: true },
    ],
  },

  {
    id: 'medicatiebeoordeling',
    naam: 'Medicatiebeoordeling aanvragen',
    waarvoor: 'Polyfarmacie of verminderde nierfunctie; kijken of alles samen nog klopt.',
    module: 'medicatieveiligheid',
    richtlijn: { naam: 'Multidisciplinaire richtlijn Polyfarmacie bij ouderen', versie: '2020',
      uitgever: 'NHG/NVKG',
      url: 'https://richtlijnen.nhg.org/multidisciplinaire-richtlijnen/polyfarmacie-bij-ouderen' },
    wanneer: enigeVan([
      minimaalChronischeMiddelen(5),
      alle([minimaleLeeftijd(75), minimaalChronischeMiddelen(3)]),
      metingOnder(CODE.egfr, 'eGFR', 45, 2 * 365),
    ]),
    regels: [
      { id: 'beoordeling', soort: 'onderzoek', omschrijving: 'Medicatiebeoordeling met de apotheker',
        detail: 'Inclusief gesprek met de patiënt over gebruik en ervaren bijwerkingen',
        levert: [CODE.medicatiebeoordeling], vereistRecht: 'dossier-registreren', standaardAan: true },
      { id: 'lab-beoordeling', soort: 'lab', omschrijving: 'Lab vooraf',
        detail: 'Kreatinine/eGFR, kalium, natrium', levert: [CODE.egfr],
        vereistRecht: 'lab-aanvragen', standaardAan: true },
    ],
  },

  {
    id: 'sociaal-domein',
    naam: 'Steun in het sociaal domein',
    waarvoor: 'Lage of dalende zelfredzaamheid; zorg alleen lost dit niet op.',
    module: 'kwetsbaarheid',
    wanneer: minimaleLeeftijd(0),
    regels: [
      { id: 'wijkteam', soort: 'verwijzing', omschrijving: 'Consultatie wijkteam of ouderenadviseur',
        detail: 'Met toestemming van de patiënt; knelpunten uit de zelfredzaamheidsinventarisatie meesturen',
        vereistRecht: 'verwijzen', standaardAan: true },
      { id: 'vervolg', soort: 'afspraak', omschrijving: 'Kort vervolgcontact over zes weken',
        detail: 'Nagaan of de steun op gang is gekomen', vereistRecht: 'dossier-registreren',
        standaardAan: true },
    ],
  },
];

/**
 * Medicatiebewaking op de ordersets.
 *
 * Bewust een kleine set met échte, controleerbare regels in plaats van een lange lijst
 * die niemand leest. Een waarschuwing die te vaak onterecht verschijnt, wordt genegeerd —
 * en dan werkt ook de terechte waarschuwing niet meer.
 */
export function controleer(regel: OrderRegel, dossier: Dossier, peildatum = new Date()): Waarschuwing[] {
  const waarschuwingen: Waarschuwing[] = [];
  const egfr = numeriekeWaarde(laatsteMeting(dossier, CODE.egfr));
  const jaar = leeftijd(dossier, peildatum);

  if (regel.atc?.startsWith('A10BA') && egfr !== undefined) {
    if (egfr < 30) {
      waarschuwingen.push({
        ernst: 'blokkerend',
        tekst: `Metformine is gecontraïndiceerd bij een eGFR onder 30 ml/min. Actuele waarde: ${egfr} ml/min.`,
        bron: 'NHG-Standaard Diabetes mellitus type 2',
      });
    } else if (egfr < 45) {
      waarschuwingen.push({
        ernst: 'let-op',
        tekst: `Bij een eGFR van ${egfr} ml/min geldt een maximale dosering van 1000 mg per dag.`,
        bron: 'NHG-Standaard Diabetes mellitus type 2',
      });
    }
  }

  if (regel.atc?.startsWith('C09') && egfr !== undefined && egfr < 45) {
    waarschuwingen.push({
      ernst: 'let-op',
      tekst: `RAS-remmer bij eGFR ${egfr} ml/min: controleer nierfunctie en kalium 1 tot 2 weken na wijziging.`,
      bron: 'NHG-Standaard Chronische nierschade',
    });
  }

  if (regel.soort === 'medicatie' && jaar >= 75) {
    const chronisch = dossier.medicatie.filter((m) => m.status === 'active' && m.chronisch).length;
    if (chronisch >= 5) {
      waarschuwingen.push({
        ernst: 'let-op',
        tekst: `${jaar} jaar met ${chronisch} chronische middelen. Weeg toevoegen af tegen een medicatiebeoordeling.`,
        bron: 'Richtlijn Polyfarmacie bij ouderen',
      });
    }
  }

  return waarschuwingen;
}

export interface VoorgesteldeOrderSet {
  set: OrderSet;
  /** Waarom stelt het systeem dit nu voor. */
  onderbouwing: string;
  waarschuwingen: Waarschuwing[];
}

/**
 * Welke ordersets passen bij deze patiënt op dit moment.
 *
 * Alleen voorstellen waarvan de aanleiding in het dossier staat. Een lijst met alles wat
 * theoretisch kan, is een catalogus — en een catalogus helpt niemand tijdens een consult.
 */
export function voorgesteldeOrdersets(
  dossier: Dossier, plan: Zorgplan, peildatum = new Date(),
): VoorgesteldeOrderSet[] {
  const actieveModules = new Set(plan.modules.map((m) => m.id));

  return ordersets
    .filter((set) => !set.module || actieveModules.has(set.module))
    .flatMap((set) => {
      // Zelfredzaamheid is geen dossiercriterium maar een planeigenschap; die toets
      // hoort hier, niet in de regel-DSL.
      if (set.id === 'sociaal-domein') {
        const beeld = plan.zelfredzaamheid;
        if (!beeld || (beeld.gemiddelde >= 3 && beeld.trend?.richting !== 'achteruit')) return [];
        return [{
          set,
          onderbouwing: `Zelfredzaamheid ${beeld.gemiddelde} van 5 (${beeld.niveau})` +
            (beeld.trend?.richting === 'achteruit' ? `, gedaald met ${Math.abs(beeld.trend.verschil)} punt` : '') + '.',
          waarschuwingen: [],
        }];
      }

      const uitkomst = set.wanneer.evalueer(dossier, peildatum);
      if (!uitkomst.voldaan) return [];
      return [{
        set,
        onderbouwing: uitkomst.onderbouwing,
        waarschuwingen: set.regels.flatMap((r) => controleer(r, dossier, peildatum)),
      }];
    });
}

export interface GeplaatsteOrder {
  setId: string;
  setNaam: string;
  regels: OrderRegel[];
  /** Regels die de plaatsende rol niet zelfstandig mag: gaan als voorstel naar de huisarts. */
  terAutorisatie: OrderRegel[];
  geplaatstOp: string;
  geplaatstDoor: string;
}

/**
 * Splitst een order in wat direct uitgevoerd wordt en wat eerst een arts nodig heeft.
 *
 * Geen blokkade maar een route: de POH kan gewoon doorwerken en de huisarts krijgt een
 * verzoek met context in plaats van een lege regel in een autorisatielijst.
 */
export function plaatsOrder(
  set: OrderSet, gekozenRegelIds: string[], rechten: string[],
  door: string, op = new Date(),
): GeplaatsteOrder {
  const gekozen = set.regels.filter((r) => gekozenRegelIds.includes(r.id));
  return {
    setId: set.id,
    setNaam: set.naam,
    regels: gekozen.filter((r) => rechten.includes(r.vereistRecht)),
    terAutorisatie: gekozen.filter((r) => !rechten.includes(r.vereistRecht)),
    geplaatstOp: op.toISOString(),
    geplaatstDoor: door,
  };
}

export { metingReeks };
