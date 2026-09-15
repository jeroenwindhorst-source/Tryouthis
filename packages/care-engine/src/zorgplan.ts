import type { Dossier, Rol } from '@zpe/fhir-model';
import { laatsteMeting, numeriekeWaarde } from '@zpe/fhir-model';
import type { BenodigdeMetingDefinitie, ProtocolActiviteit, Zorgprogramma } from './zorgprogramma.js';
import { vindZorgprogramma } from './zorgprogramma.js';

/**
 * Intensiteit is de operationalisering van persoonsgerichte zorg (docs/04 §4).
 * Afwijken van het protocol is hier een geregistreerde, verantwoorde keuze —
 * geen ontbrekende registratie.
 */
export type Intensiteit = 'extensief' | 'basis' | 'intensief' | 'eigen-regie' | 'palliatief';

const INTENSITEIT_FACTOR: Record<Intensiteit, number> = {
  extensief: 1.6,     // stabiel: ruimere intervallen
  basis: 1.0,         // protocol volgen
  intensief: 0.6,     // ontregeld: korter interval
  'eigen-regie': 2.0, // patiënt monitort zelf; vangnet op de achtergrond
  palliatief: 0,      // protocol uit; alleen wat de patiënt wil
};

export interface BenodigdeMeting {
  code: string;
  naam: string;
  /** Datum waarop deze meting niet langer 'vers' is. */
  vervaltOp: string;
  /** Welke programma's deze meting nodig hebben — kern van de samenvoeging. */
  programmas: string[];
  duurMinuten: number;
  zelfAanleverbaar?: boolean;
  labVooraf?: boolean;
  laatsteWaarde?: number;
  laatsteOp?: string;
}

export interface GeplandContact {
  id: string;
  datum: string;
  soort: 'controle' | 'jaarcontrole';
  rol: Rol;
  programmas: string[];
  metingen: BenodigdeMeting[];
  duurMinuten: number;
  /** Bepalingen die vóór het consult aangevraagd moeten worden. */
  labVooraf: string[];
  /** Vragenlijsten die vóór dit contact worden uitgezet (docs/12 §2.3). */
  vragenlijsten: string[];
}

export interface Zorgplan {
  patientId: string;
  programmas: string[];
  intensiteit: Intensiteit;
  contacten: GeplandContact[];
  vergelijking: {
    /** Contacten als elk zorgprogramma zijn eigen traject blijft draaien. */
    zonderSamenvoeging: number;
    metSamenvoeging: number;
    bespaardeContacten: number;
    bespaardeMinuten: number;
  };
  toelichting: string[];
}

export interface PlanOpties {
  peildatum?: Date;
  horizonDagen?: number;
  /** Ondergrens voor het bezoekritme; voorkomt onwerkbaar korte intervallen. */
  minimumIntervalDagen?: number;
  /** Vaste overhead per contact (binnenkomst, anamnese, afronding). */
  basisDuurMinuten?: number;
}

interface Voorkomen {
  code: string;
  naam: string;
  datum: number;
  programmaId: string;
  activiteit: ProtocolActiviteit;
  definitie: BenodigdeMetingDefinitie;
  /** Datum van het bezoek waaraan dit meetmoment is toegewezen. */
  slotDatum?: number;
}

const DAG = 86_400_000;
const isoDatum = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Bepaalt wanneer een meting opnieuw nodig is, en herhaalt dat over de horizon.
 * Een meting die al verlopen is, wordt op de peildatum gepland — niet in het verleden.
 */
function voorkomens(
  dossier: Dossier, definitie: BenodigdeMetingDefinitie,
  factor: number, peildatum: number, horizon: number,
): number[] {
  const interval = Math.max(14, Math.round(definitie.maxOuderdomDagen * factor)) * DAG;
  const laatste = laatsteMeting(dossier, definitie.code);
  let volgende = laatste
    ? new Date(laatste.effectief).getTime() + interval
    : peildatum;
  if (volgende < peildatum) volgende = peildatum;

  const data: number[] = [];
  while (volgende <= horizon && data.length < 12) {
    data.push(volgende);
    volgende += interval;
  }
  return data;
}

/**
 * Bepaalt het bezoekritme. Het kortste meetinterval bepaalt hoe vaak iemand langs moet:
 * je kunt niet minder vaak komen dan je vaakst benodigde meting.
 */
function cadans(voorkomensLijst: Voorkomen[], factor: number, minimumDagen: number): number {
  const intervallen = voorkomensLijst.map(
    (v) => Math.max(minimumDagen, Math.round(v.definitie.maxOuderdomDagen * factor)),
  );
  return intervallen.length > 0 ? Math.min(...intervallen) : 0;
}

/**
 * Plaatst elk meetmoment in het laatste bezoek dat nog vóór de vervaldatum valt.
 *
 * Dit is bewust géén greedy clustering van losse meetmomenten: dat levert een zwevend
 * schema met veel kleine contacten op, en gedraagt zich niet-monotoon bij wijzigende
 * intensiteit. Een vast ritme met terugwaartse toewijzing sluit aan bij hoe protocollen
 * in de praktijk werken (kwartaalcontrole, jaarcontrole) en garandeert dat niets verloopt.
 */
function verdeelOverBezoeken(
  voorkomensLijst: Voorkomen[], factor: number, minimumDagen: number,
): Voorkomen[][] {
  if (voorkomensLijst.length === 0) return [];
  const ritme = cadans(voorkomensLijst, factor, minimumDagen);
  if (ritme <= 0) return [];

  const eerste = Math.min(...voorkomensLijst.map((v) => v.datum));
  const perSlot = new Map<number, Voorkomen[]>();

  for (const v of voorkomensLijst) {
    const index = Math.floor((v.datum - eerste) / (ritme * DAG));
    const lijst = perSlot.get(index) ?? [];
    lijst.push(v);
    perSlot.set(index, lijst);
  }

  return [...perSlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, groep]) => {
      // Het bezoek valt op het slotmoment, nooit later dan de vroegste vervaldatum erin.
      const slotDatum = eerste + index * ritme * DAG;
      const vroegste = Math.min(...groep.map((v) => v.datum));
      const datum = Math.min(slotDatum, vroegste);
      return groep.map((v) => ({ ...v, slotDatum: datum }));
    });
}

function bouwContact(
  groep: Voorkomen[], index: number, basisDuur: number, patientId: string,
  dossier: Dossier,
): GeplandContact {
  const datum = groep[0].slotDatum ?? Math.min(...groep.map((v) => v.datum));
  const perCode = new Map<string, BenodigdeMeting>();

  for (const v of groep) {
    const bestaand = perCode.get(v.code);
    if (bestaand) {
      // Dezelfde meting uit twee programma's = één meting. Dit is de besparing.
      if (!bestaand.programmas.includes(v.programmaId)) bestaand.programmas.push(v.programmaId);
      bestaand.vervaltOp = isoDatum(Math.min(new Date(bestaand.vervaltOp).getTime(), v.datum));
      continue;
    }
    const laatste = laatsteMeting(dossier, v.code);
    perCode.set(v.code, {
      code: v.code,
      naam: v.naam,
      vervaltOp: isoDatum(v.datum),
      programmas: [v.programmaId],
      duurMinuten: v.definitie.duurMinuten,
      zelfAanleverbaar: v.definitie.zelfAanleverbaar,
      labVooraf: v.definitie.labVooraf,
      laatsteWaarde: numeriekeWaarde(laatste),
      laatsteOp: laatste?.effectief.slice(0, 10),
    });
  }

  const metingen = [...perCode.values()];
  const programmas = [...new Set(groep.map((v) => v.programmaId))];
  const soort: GeplandContact['soort'] =
    groep.some((v) => v.activiteit.soort === 'jaarcontrole') ? 'jaarcontrole' : 'controle';
  const vragenlijsten = [...new Set(
    groep.map((v) => v.activiteit.voorbereidingsVragenlijst).filter((x): x is string => Boolean(x)),
  )];

  return {
    id: `${patientId}-contact-${index + 1}`,
    datum: isoDatum(datum),
    soort,
    rol: groep[0].activiteit.rol,
    programmas,
    metingen,
    duurMinuten: basisDuur + metingen.reduce((s, m) => s + m.duurMinuten, 0),
    labVooraf: metingen.filter((m) => m.labVooraf).map((m) => m.naam),
    vragenlijsten,
  };
}

/**
 * Bouwt één integraal zorgplan over alle actieve zorgprogramma's heen (docs/04 §3).
 *
 * Dit is de belangrijkste modelkeuze van het project: niet één plan per programma,
 * maar één plan per mens. Een patiënt met DM2 + CVRM + COPD krijgt hier drie tot vier
 * geïntegreerde contacten in plaats van acht losse — en die zijn inhoudelijk vollediger.
 */
export function bouwZorgplan(
  dossier: Dossier,
  programmaIds: string[],
  intensiteit: Intensiteit = 'basis',
  opties: PlanOpties = {},
): Zorgplan {
  const peildatum = (opties.peildatum ?? new Date()).getTime();
  const horizon = peildatum + (opties.horizonDagen ?? 365) * DAG;
  const minimumInterval = opties.minimumIntervalDagen ?? 28;
  const basisDuur = opties.basisDuurMinuten ?? 10;
  const factor = INTENSITEIT_FACTOR[intensiteit];
  const toelichting: string[] = [];

  const programmas = programmaIds
    .map(vindZorgprogramma)
    .filter((z): z is Zorgprogramma => Boolean(z));

  if (intensiteit === 'palliatief') {
    return {
      patientId: dossier.patient.id, programmas: programmaIds, intensiteit, contacten: [],
      vergelijking: { zonderSamenvoeging: 0, metSamenvoeging: 0, bespaardeContacten: 0, bespaardeMinuten: 0 },
      toelichting: [
        'Intensiteit is palliatief: protocollaire controles en streefwaarden zijn uitgezet.',
        'Contact vindt plaats op indicatie en op wens van de patiënt.',
      ],
    };
  }

  // 1. Alle protocolvoorkomens over de horizon verzamelen.
  const alle: Voorkomen[] = [];
  for (const programma of programmas) {
    for (const activiteit of programma.activiteiten) {
      for (const definitie of activiteit.metingen) {
        for (const datum of voorkomens(dossier, definitie, factor, peildatum, horizon)) {
          alle.push({ code: definitie.code, naam: definitie.naam, datum, programmaId: programma.id, activiteit, definitie });
        }
      }
    }
  }

  // 2. Samenvoegen over programma's heen.
  const clusters = verdeelOverBezoeken(alle, factor, minimumInterval);
  const contacten = clusters.map((groep, i) => bouwContact(groep, i, basisDuur, dossier.patient.id, dossier));

  // 3. Referentiemeting: wat zou het kosten als elk programma apart bleef draaien?
  let zonderSamenvoeging = 0;
  let zonderDuur = 0;
  for (const programma of programmas) {
    const eigen = alle.filter((v) => v.programmaId === programma.id);
    const eigenClusters = verdeelOverBezoeken(eigen, factor, minimumInterval);
    zonderSamenvoeging += eigenClusters.length;
    for (const groep of eigenClusters) {
      const codes = new Set(groep.map((v) => v.code));
      const duur = [...codes].reduce((s, code) => {
        const v = groep.find((x) => x.code === code)!;
        return s + v.definitie.duurMinuten;
      }, basisDuur);
      zonderDuur += duur;
    }
  }
  const metDuur = contacten.reduce((s, c) => s + c.duurMinuten, 0);

  // 4. Toelichting: waaróm zijn er contacten samengevoegd. Zichtbaar in de UI.
  for (const contact of contacten) {
    const gedeeld = contact.metingen.filter((m) => m.programmas.length > 1);
    if (gedeeld.length > 0) {
      toelichting.push(
        `${contact.datum}: ${gedeeld.map((m) => m.naam).join(', ')} ` +
        `${gedeeld.length === 1 ? 'telt' : 'tellen'} voor ${[...new Set(gedeeld.flatMap((m) => m.programmas))].join(' + ')} tegelijk.`,
      );
    }
  }
  if (contacten.length > 0 && programmas.length > 1) {
    toelichting.unshift(
      `${programmas.length} zorgprogramma's samengevoegd tot ${contacten.length} contact(en) ` +
      `in plaats van ${zonderSamenvoeging}.`,
    );
  }
  if (intensiteit !== 'basis') {
    toelichting.push(
      `Intensiteit '${intensiteit}': controle-intervallen zijn met factor ${factor} aangepast ` +
      'ten opzichte van het protocol.',
    );
  }
  if (intensiteit === 'eigen-regie') {
    toelichting.push(
      'Patiënt houdt eigen regie: er worden geen oproepen verstuurd, wel wordt bewaakt ' +
      'of metingen uitblijven (signaal bij overschrijding).',
    );
  }

  return {
    patientId: dossier.patient.id,
    programmas: programmas.map((p) => p.id),
    intensiteit,
    contacten,
    vergelijking: {
      zonderSamenvoeging,
      metSamenvoeging: contacten.length,
      bespaardeContacten: zonderSamenvoeging - contacten.length,
      bespaardeMinuten: zonderDuur - metDuur,
    },
    toelichting,
  };
}
