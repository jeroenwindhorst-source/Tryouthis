import type { Dossier, Rol } from '@zpe/fhir-model';
import { laatsteMeting, numeriekeWaarde } from '@zpe/fhir-model';
import { ketenbijdragen, traditioneleKetens, type Ketenbijdrage } from './ketenkoppeling.js';
import { modules as standaardModules, type Invoer, type Monitoritem, type Zorgmodule } from './protocol.js';
import { doorlooptijdVan } from './protocolaanpassing.js';
import {
  beoordeelZelfredzaamheid, type Zelfredzaamheid, type Zelfredzaamheidsbeeld,
} from './zelfredzaamheid.js';

/**
 * HET PERSOONLIJKE ZORGPLAN
 *
 * Eén plan per mens, opgebouwd uit zorgmodules (`protocol.ts`) in plaats van uit
 * zorgprogramma's per aandoening. Er is geen splitsing naar diagnose — die bestaat
 * alleen nog achter de schermen, voor declaratie (`ketenkoppeling.ts`).
 *
 * Drie lagen bepalen wat er gebeurt:
 *   1. het protocol           — welke modules zijn relevant, wat is het basisinterval
 *   2. de situatie            — intervalregels op basis van de feitelijke waarden
 *   3. de persoon             — modules aan/uit, eigen intervallen, eigen maximum
 *
 * Laag 3 wint altijd van laag 1 en 2, mits met reden vastgelegd.
 */

export type Intensiteit = 'extensief' | 'basis' | 'intensief' | 'eigen-regie' | 'palliatief';

const INTENSITEIT_FACTOR: Record<Intensiteit, number> = {
  extensief: 1.6,
  basis: 1.0,
  intensief: 0.6,
  'eigen-regie': 2.0,
  palliatief: 0,
};

export interface PersoonlijkDoel {
  id: string;
  /** In de woorden van de patiënt, niet in streefwaarden. */
  tekst: string;
  gekoppeldeModules: string[];
  afgesprokenOp: string;
}

export interface ModuleKeuze {
  moduleId: string;
  aan: boolean;
  reden: string;
  door: string;
  op: string;
}

export interface ItemKeuze {
  code: string;
  intervalDagen: number;
  reden: string;
}

export interface PersoonlijkPlan {
  patientId: string;
  intensiteit: Intensiteit;
  /**
   * Hoeveel deze mens zelf kan. Staat los van de klinische toestand en weegt even zwaar:
   * bij dezelfde waarden heeft de een meer contact nodig dan de ander (zelfredzaamheid.ts).
   */
  zelfredzaamheid?: Zelfredzaamheid;
  /** Handmatig aan- of uitgezette modules. Altijd met reden — afwijken is een keuze. */
  moduleKeuzes: ModuleKeuze[];
  itemKeuzes: ItemKeuze[];
  doelen: PersoonlijkDoel[];
  voorkeuren: {
    /** De patiënt geeft zelf aan hoe vaak hij maximaal wil komen. Leidend. */
    maxContactenPerJaar?: number;
    liefstThuismeting?: boolean;
  };
}

export function leegPersoonlijkPlan(patientId: string): PersoonlijkPlan {
  return {
    patientId, intensiteit: 'basis', moduleKeuzes: [], itemKeuzes: [],
    doelen: [], voorkeuren: {},
  };
}

export type ModuleHerkomst = 'automatisch' | 'handmatig-aan' | 'handmatig-uit' | 'niet-relevant';

export interface GepiandItem {
  code: string;
  naam: string;
  /** Hoe dit item wordt vastgelegd: getal, gecodeerde keuze, verrichting of vragenlijst. */
  invoer: Invoer;
  /** Hoeveel dagen vóór het contact dit binnen moet zijn om op tijd te zijn. */
  doorlooptijdDagen: number;
  /** Modules die dit item nodig hebben — één meting kan er meerdere bedienen. */
  modules: string[];
  intervalDagen: number;
  /** Waarom dit interval, in begrijpelijke taal. */
  intervalReden: string;
  duurMinuten: number;
  zelfAanleverbaar?: boolean;
  labVooraf?: boolean;
  vragenlijst?: string;
  laatsteWaarde?: number;
  laatsteOp?: string;
}

export interface ActieveModule {
  id: string;
  naam: string;
  omschrijving: string;
  icoon: string;
  herkomst: ModuleHerkomst;
  onderbouwing: string;
  rol: Rol;
  items: GepiandItem[];
  richtlijnen: { naam: string; versie: string }[];
}

export interface BenodigdeMeting extends GepiandItem {
  vervaltOp: string;
}

export interface GeplandContact {
  id: string;
  datum: string;
  soort: 'controle' | 'uitgebreide-controle';
  rol: Rol;
  modules: string[];
  metingen: BenodigdeMeting[];
  duurMinuten: number;
  labVooraf: string[];
  vragenlijsten: string[];
}

export interface Zorgplan {
  patientId: string;
  intensiteit: Intensiteit;
  /** Het zelfredzaamheidsbeeld en wat het met dit plan doet. */
  zelfredzaamheid?: Zelfredzaamheidsbeeld;
  modules: ActieveModule[];
  /** Modules die zijn beoordeeld maar niet actief zijn — transparant, niet verborgen. */
  nietActief: { id: string; naam: string; herkomst: ModuleHerkomst; onderbouwing: string }[];
  contacten: GeplandContact[];
  doelen: PersoonlijkDoel[];
  vergelijking: {
    traditioneleTrajecten: string[];
    traditioneleContacten: number;
    geintegreerdeContacten: number;
    bespaardeContacten: number;
    bespaardeMinuten: number;
    /**
     * Deze patiënt heeft wél aandachtsgebieden maar valt onder géén enkele landelijke
     * keten. In de huidige inrichting krijgt hij dus geen gestructureerde chronische
     * zorg. Vergelijken met "traditioneel" is dan zinloos — er ís geen traditioneel.
     */
    valtBuitenKeten: boolean;
    /** Onderwerpen die de losse ketens niet systematisch dekken. */
    extraOnderwerpen: string[];
  };
  /** Achtergrond: waar dit plan bewijs voor levert. Stuurt het proces niet aan. */
  ketens: Ketenbijdrage[];
  toelichting: string[];
  /** Gevolgen van persoonlijke keuzes, expliciet benoemd. */
  consequenties: string[];
}

export interface PlanOpties {
  peildatum?: Date;
  horizonDagen?: number;
  minimumIntervalDagen?: number;
  basisDuurMinuten?: number;
  /**
   * Het protocol zoals deze praktijk het heeft ingesteld.
   *
   * Ontbreekt het, dan geldt de landelijke richtlijn. Meegeven in plaats van globaal
   * muteren, zodat twee praktijken in hetzelfde proces naast elkaar kunnen bestaan en
   * een test een afwijkend protocol kan doorrekenen zonder de rest te raken.
   */
  protocol?: Zorgmodule[];
}

const DAG = 86_400_000;
const isoDatum = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Bepaalt het interval van één item: protocol → situatie → persoon. */
function bepaalInterval(
  item: Monitoritem, dossier: Dossier, peildatum: Date,
  intensiteitFactor: number, itemKeuzes: ItemKeuze[], zelfredzaamheidFactor: number,
): { dagen: number; reden: string } {
  const keuze = itemKeuzes.find((k) => k.code === item.code);
  if (keuze) {
    return { dagen: keuze.intervalDagen, reden: `persoonlijke afspraak: ${keuze.reden}` };
  }

  let factor = 1;
  let reden = 'volgens richtlijn';
  for (const regel of item.intervalRegels ?? []) {
    if (!regel.wanneer.evalueer(dossier, peildatum).voldaan) continue;
    // De voorzichtigste regel wint: korter interval gaat vóór langer.
    if (regel.factor < factor || factor === 1) {
      if (regel.factor < factor) { factor = regel.factor; reden = regel.reden; }
      else if (factor === 1) { factor = regel.factor; reden = regel.reden; }
    }
  }

  const dagen = Math.max(
    14, Math.round(item.basisIntervalDagen * factor * intensiteitFactor * zelfredzaamheidFactor),
  );
  return { dagen, reden };
}

/** Bepaalt welke modules actief zijn en waarom. */
function bepaalModules(
  dossier: Dossier, persoonlijk: PersoonlijkPlan, peildatum: Date, intensiteitFactor: number,
  beeld?: Zelfredzaamheidsbeeld, protocol: Zorgmodule[] = standaardModules,
): { actief: ActieveModule[]; nietActief: Zorgplan['nietActief'] } {
  const actief: ActieveModule[] = [];
  const nietActief: Zorgplan['nietActief'] = [];

  for (const module of protocol) {
    const keuze = persoonlijk.moduleKeuzes.find((k) => k.moduleId === module.id);
    const relevantie = module.relevantie.evalueer(dossier, peildatum);
    const uitsluiting = module.uitsluiting?.evalueer(dossier, peildatum);

    let herkomst: ModuleHerkomst;
    let onderbouwing: string;

    if (keuze && !keuze.aan) {
      herkomst = 'handmatig-uit';
      onderbouwing = `uitgezet door ${keuze.door}: ${keuze.reden}`;
    } else if (keuze && keuze.aan) {
      herkomst = 'handmatig-aan';
      onderbouwing = `aangezet door ${keuze.door}: ${keuze.reden}`;
    } else if (uitsluiting?.voldaan) {
      herkomst = 'niet-relevant';
      onderbouwing = uitsluiting.onderbouwing;
    } else if (relevantie.voldaan) {
      herkomst = 'automatisch';
      onderbouwing = relevantie.onderbouwing;
    } else if (beeld?.raaktModules.includes(module.id)) {
      // Een laag scorend leefdomein maakt een aandachtsgebied relevant, ook zonder
      // diagnose. Dat is precies het geval dat een diagnosegestuurd systeem mist.
      herkomst = 'automatisch';
      const knelpunt = beeld.knelpunten.find((k) => k.domein.id === 'geestelijke-gezondheid'
        || k.domein.id === 'adl' || k.domein.id === 'sociaal-netwerk' || k.domein.id === 'verslaving');
      onderbouwing = `zelfredzaamheid: ${knelpunt?.domein.naam.toLowerCase() ?? 'leefdomein'} scoort laag`;
    } else {
      herkomst = 'niet-relevant';
      onderbouwing = relevantie.onderbouwing;
    }

    if (herkomst === 'handmatig-uit' || herkomst === 'niet-relevant') {
      nietActief.push({ id: module.id, naam: module.naam, herkomst, onderbouwing });
      continue;
    }

    const items = module.items
      .filter((item) => !item.relevantie || item.relevantie.evalueer(dossier, peildatum).voldaan)
      .map((item): GepiandItem => {
        const interval = bepaalInterval(
          item, dossier, peildatum, intensiteitFactor, persoonlijk.itemKeuzes, beeld?.factor ?? 1,
        );
        const laatste = laatsteMeting(dossier, item.code);
        return {
          code: item.code, naam: item.naam, modules: [module.id],
          invoer: item.invoer ?? { soort: 'getal' },
          doorlooptijdDagen: doorlooptijdVan(item),
          intervalDagen: interval.dagen, intervalReden: interval.reden,
          duurMinuten: item.duurMinuten, zelfAanleverbaar: item.zelfAanleverbaar,
          labVooraf: item.labVooraf, vragenlijst: item.vragenlijst,
          laatsteWaarde: numeriekeWaarde(laatste),
          laatsteOp: laatste?.effectief.slice(0, 10),
        };
      });

    actief.push({
      id: module.id, naam: module.naam, omschrijving: module.omschrijving,
      icoon: module.icoon, herkomst, onderbouwing, rol: module.rol,
      items, richtlijnen: module.richtlijnen,
    });
  }

  return { actief, nietActief };
}

/** Voegt items samen die meerdere modules bedienen: één meting, meerdere doelen. */
function voegItemsSamen(actief: ActieveModule[]): GepiandItem[] {
  const perCode = new Map<string, GepiandItem>();
  for (const module of actief) {
    for (const item of module.items) {
      const bestaand = perCode.get(item.code);
      if (!bestaand) { perCode.set(item.code, { ...item, modules: [...item.modules] }); continue; }
      for (const m of item.modules) if (!bestaand.modules.includes(m)) bestaand.modules.push(m);
      // Het kortste interval wint: één meting moet aan de strengste eis voldoen.
      if (item.intervalDagen < bestaand.intervalDagen) {
        bestaand.intervalDagen = item.intervalDagen;
        bestaand.intervalReden = item.intervalReden;
      }
    }
  }
  return [...perCode.values()];
}

interface Voorkomen { item: GepiandItem; datum: number }

function voorkomens(items: GepiandItem[], dossier: Dossier, peildatum: number, horizon: number): Voorkomen[] {
  const lijst: Voorkomen[] = [];
  for (const item of items) {
    const laatste = laatsteMeting(dossier, item.code);
    let volgende = laatste
      ? new Date(laatste.effectief).getTime() + item.intervalDagen * DAG
      : peildatum;
    if (volgende < peildatum) volgende = peildatum;
    let n = 0;
    while (volgende <= horizon && n < 12) {
      lijst.push({ item, datum: volgende });
      volgende += item.intervalDagen * DAG;
      n++;
    }
  }
  return lijst;
}

/**
 * Plaatst elk meetmoment in het laatste bezoek dat nog vóór de vervaldatum valt.
 * Het bezoekritme volgt uit het kortste benodigde interval — je kunt niet minder
 * vaak komen dan je vaakst benodigde meting.
 */
function verdeelOverBezoeken(
  lijst: Voorkomen[], minimumDagen: number, thuismetingTeltNietMee = false,
): { groep: Voorkomen[]; datum: number }[] {
  if (lijst.length === 0) return [];
  // Wie thuis meet, hoeft daarvoor niet naar de praktijk. Die items worden nog steeds
  // gepland, maar bepalen niet langer hoe vaak iemand moet komen.
  const ritmebepalend = thuismetingTeltNietMee
    ? lijst.filter((v) => !v.item.zelfAanleverbaar)
    : lijst;
  const bron = ritmebepalend.length > 0 ? ritmebepalend : lijst;
  const ritme = Math.max(minimumDagen, Math.min(...bron.map((v) => v.item.intervalDagen)));
  const eerste = Math.min(...lijst.map((v) => v.datum));
  const perSlot = new Map<number, Voorkomen[]>();

  for (const v of lijst) {
    const index = Math.floor((v.datum - eerste) / (ritme * DAG));
    const groep = perSlot.get(index) ?? [];
    groep.push(v);
    perSlot.set(index, groep);
  }

  return [...perSlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, groep]) => ({
      groep,
      datum: Math.min(eerste + index * ritme * DAG, ...groep.map((v) => v.datum)),
    }));
}

function bouwContacten(
  slots: { groep: Voorkomen[]; datum: number }[], patientId: string,
  basisDuur: number, moduleRol: Map<string, Rol>,
): GeplandContact[] {
  return slots.map((slot, i) => {
    const perCode = new Map<string, BenodigdeMeting>();
    for (const v of slot.groep) {
      if (perCode.has(v.item.code)) continue;
      perCode.set(v.item.code, { ...v.item, vervaltOp: isoDatum(v.datum) });
    }
    const metingen = [...perCode.values()];
    const modules = [...new Set(metingen.flatMap((m) => m.modules))];
    const duur = basisDuur + metingen.reduce((s, m) => s + m.duurMinuten, 0);
    return {
      id: `${patientId}-contact-${i + 1}`,
      datum: isoDatum(slot.datum),
      soort: duur >= basisDuur + 20 ? 'uitgebreide-controle' : 'controle',
      rol: moduleRol.get(modules[0] ?? '') ?? 'poh-s',
      modules,
      metingen,
      duurMinuten: duur,
      labVooraf: metingen.filter((m) => m.labVooraf).map((m) => m.naam),
      vragenlijsten: [...new Set(metingen.map((m) => m.vragenlijst).filter((x): x is string => Boolean(x)))],
    };
  });
}

/** Referentiemeting: wat dezelfde zorg zou kosten als losse trajecten per aandoening. */
function traditioneleTelling(
  dossier: Dossier, items: GepiandItem[], peildatum: Date, horizon: number, minimumDagen: number, basisDuur: number,
): { trajecten: string[]; contacten: number; minuten: number; extraOnderwerpen: string[] } {
  const ketens = traditioneleKetens(dossier, peildatum);
  let contacten = 0;
  let minuten = 0;
  const gedekteModules = new Set(ketens.flatMap((k) => k.modules as string[]));
  const extraOnderwerpen = [...new Set(
    items.filter((i) => !i.modules.some((m) => gedekteModules.has(m))).map((i) => i.naam),
  )];

  for (const keten of ketens) {
    const eigenItems = items.filter((i) => i.modules.some((m) => keten.modules.includes(m as never)));
    if (eigenItems.length === 0) continue;
    const slots = verdeelOverBezoeken(
      voorkomens(eigenItems, dossier, peildatum.getTime(), horizon), minimumDagen,
    );
    contacten += slots.length;
    for (const slot of slots) {
      const codes = new Set(slot.groep.map((v) => v.item.code));
      minuten += basisDuur + [...codes].reduce(
        (s, code) => s + (slot.groep.find((v) => v.item.code === code)!.item.duurMinuten), 0,
      );
    }
  }
  return { trajecten: ketens.map((k) => k.naam), contacten, minuten, extraOnderwerpen };
}

/**
 * Bouwt het persoonlijke zorgplan.
 *
 * Er komt nergens een zorgprogramma aan te pas: de modules volgen uit het dossier,
 * de intervallen uit de situatie, en de persoonlijke keuzes overrulen beide.
 */
export function bouwZorgplan(
  dossier: Dossier,
  persoonlijk: PersoonlijkPlan = leegPersoonlijkPlan(dossier.patient.id),
  opties: PlanOpties = {},
): Zorgplan {
  const peildatumDate = opties.peildatum ?? new Date();
  const peildatum = peildatumDate.getTime();
  const horizon = peildatum + (opties.horizonDagen ?? 365) * DAG;
  const minimumInterval = opties.minimumIntervalDagen ?? 28;
  const basisDuur = opties.basisDuurMinuten ?? 10;
  const intensiteitFactor = INTENSITEIT_FACTOR[persoonlijk.intensiteit];
  const beeld = persoonlijk.zelfredzaamheid
    ? beoordeelZelfredzaamheid(persoonlijk.zelfredzaamheid)
    : undefined;

  const toelichting: string[] = [];
  const consequenties: string[] = [];
  const protocol = opties.protocol ?? standaardModules;
  const moduleRol = new Map<string, Rol>(protocol.map((m: Zorgmodule) => [m.id, m.rol]));

  if (persoonlijk.intensiteit === 'palliatief') {
    const { actief, nietActief } = bepaalModules(dossier, persoonlijk, peildatumDate, 1, beeld, protocol);
    return {
      patientId: dossier.patient.id, intensiteit: persoonlijk.intensiteit, zelfredzaamheid: beeld,
      modules: [], nietActief: [...nietActief, ...actief.map((m) => ({
        id: m.id, naam: m.naam, herkomst: 'handmatig-uit' as ModuleHerkomst,
        onderbouwing: 'protocol uitgezet vanwege palliatief beleid',
      }))],
      contacten: [], doelen: persoonlijk.doelen,
      vergelijking: {
        traditioneleTrajecten: [], traditioneleContacten: 0, geintegreerdeContacten: 0,
        bespaardeContacten: 0, bespaardeMinuten: 0, valtBuitenKeten: false, extraOnderwerpen: [],
      },
      ketens: [],
      toelichting: [
        'Beleid is palliatief: protocollaire controles en streefwaarden zijn uitgezet.',
        'Contact vindt plaats op indicatie en op wens van de patiënt.',
      ],
      consequenties: ['Indicatoren voor ketenzorg worden voor deze patiënt niet meer geteld — dat is een bewuste keuze, geen omissie.'],
    };
  }

  const { actief, nietActief } = bepaalModules(
    dossier, persoonlijk, peildatumDate, intensiteitFactor, beeld, protocol,
  );
  let items = voegItemsSamen(actief);

  // Persoonlijke voorkeur: maximaal aantal contacten per jaar. De patiënt bepaalt.
  const max = persoonlijk.voorkeuren.maxContactenPerJaar;
  const thuis = persoonlijk.voorkeuren.liefstThuismeting === true;
  let slots = verdeelOverBezoeken(voorkomens(items, dossier, peildatum, horizon), minimumInterval, thuis);
  if (max && slots.length > max) {
    const rek = slots.length / max;
    items = items.map((item) => ({
      ...item,
      intervalDagen: Math.round(item.intervalDagen * rek),
      intervalReden: `${item.intervalReden} — opgerekt omdat de patiënt maximaal ${max} contacten per jaar wil`,
    }));
    slots = verdeelOverBezoeken(voorkomens(items, dossier, peildatum, horizon), minimumInterval, thuis);
    consequenties.push(
      `De patiënt wil maximaal ${max} contacten per jaar. De controle-intervallen zijn daarop ` +
      `aangepast; metingen worden daardoor gemiddeld ${Math.round((rek - 1) * 100)}% later herhaald ` +
      'dan de richtlijn adviseert. Dit is vastgelegd als gezamenlijke keuze.',
    );
  }

  const contacten = bouwContacten(slots, dossier.patient.id, basisDuur, moduleRol);
  const traditioneel = traditioneleTelling(dossier, items, peildatumDate, horizon, minimumInterval, basisDuur);
  const eigenMinuten = contacten.reduce((s, c) => s + c.duurMinuten, 0);

  // Toelichting: waarom ziet het plan eruit zoals het eruitziet.
  if (actief.length > 0) {
    toelichting.push(
      `${actief.length} aandachtsgebied(en) actief: ${actief.map((m) => m.naam.toLowerCase()).join(', ')}.`,
    );
  }
  const gedeeld = items.filter((i) => i.modules.length > 1);
  for (const item of gedeeld) {
    toelichting.push(
      `${item.naam} wordt één keer gemeten en telt voor ${item.modules.length} aandachtsgebieden.`,
    );
  }
  const opMaat = items.filter((i) => i.intervalReden !== 'volgens richtlijn');
  for (const item of opMaat) {
    toelichting.push(`${item.naam}: elke ${item.intervalDagen} dagen — ${item.intervalReden}.`);
  }
  if (traditioneel.trajecten.length === 0 && actief.length > 0) {
    toelichting.push(
      'Deze patiënt valt onder geen enkele landelijke ketenzorg, maar heeft wel een chronische ' +
      'zorgvraag. In de huidige inrichting krijgt hij daarvoor geen gestructureerde begeleiding.',
    );
  }
  if (traditioneel.extraOnderwerpen.length > 0 && traditioneel.trajecten.length > 0) {
    toelichting.push(
      `De losse ketens dekken ${traditioneel.extraOnderwerpen.join(', ')} niet ` +
      'systematisch; in dit plan horen ze er gewoon bij.',
    );
  }
  if (beeld && beeld.factor !== 1) {
    toelichting.push(
      `Zelfredzaamheid ${beeld.gemiddelde} van 5 (${beeld.niveau}): alle intervallen zijn met ` +
      `factor ${beeld.factor} aangepast — ${beeld.factor < 1 ? 'vaker' : 'minder vaak'} contact bij ` +
      'dezelfde klinische waarden.',
    );
  }
  if (beeld?.knelpunten.length) {
    consequenties.push(
      `Knelpunten in zelfredzaamheid: ${beeld.knelpunten.map((k) => k.domein.naam.toLowerCase()).join(', ')}. ` +
      beeld.betekenis,
    );
  }
  if (beeld && !beeld.digitaalBereikbaar) {
    consequenties.push(
      'Digitale oproep is voor deze patiënt niet passend; uitnodigingen gaan telefonisch of per brief.',
    );
  }
  if (beeld?.trend?.richting === 'achteruit') {
    consequenties.push(
      `Zelfredzaamheid is ${Math.abs(beeld.trend.verschil)} punt gedaald sinds de vorige afname. ` +
      'Dat weegt zwaarder dan een enkele afwijkende meetwaarde.',
    );
  }
  if (persoonlijk.intensiteit !== 'basis') {
    toelichting.push(
      `Intensiteit '${persoonlijk.intensiteit}': alle intervallen zijn met factor ${intensiteitFactor} aangepast.`,
    );
  }
  if (persoonlijk.intensiteit === 'eigen-regie') {
    consequenties.push(
      'Er worden geen oproepen verstuurd. Het systeem bewaakt wel of metingen uitblijven en ' +
      'meldt dat, zodat eigen regie geen stilte wordt.',
    );
  }
  for (const keuze of persoonlijk.moduleKeuzes) {
    const module = protocol.find((m) => m.id === keuze.moduleId);
    if (!module) continue;
    consequenties.push(
      `${module.naam} is handmatig ${keuze.aan ? 'aangezet' : 'uitgezet'} door ${keuze.door}: ${keuze.reden}.`,
    );
  }

  return {
    patientId: dossier.patient.id,
    intensiteit: persoonlijk.intensiteit,
    zelfredzaamheid: beeld,
    modules: actief,
    nietActief,
    contacten,
    doelen: persoonlijk.doelen,
    vergelijking: {
      traditioneleTrajecten: traditioneel.trajecten,
      traditioneleContacten: traditioneel.contacten,
      geintegreerdeContacten: contacten.length,
      bespaardeContacten: traditioneel.contacten - contacten.length,
      bespaardeMinuten: traditioneel.minuten - eigenMinuten,
      valtBuitenKeten: traditioneel.trajecten.length === 0 && actief.length > 0,
      extraOnderwerpen: traditioneel.extraOnderwerpen,
    },
    ketens: ketenbijdragen(dossier, actief.map((m) => m.id), peildatumDate),
    toelichting,
    consequenties,
  };
}
