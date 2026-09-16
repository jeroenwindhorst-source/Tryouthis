import type { Dossier, Rol } from '@zpe/fhir-model';
import type { OrderSoort, Richtlijn, Waarschuwing } from '@zpe/care-engine';
import { rng } from './populatie.js';

/**
 * GEPLAATSTE ORDERS
 *
 * Een order die alleen in het scherm bestaat waar hij geplaatst is, is geen order maar
 * een handeling zonder spoor. Hier leeft hij: met wie hem plaatste, waarop hij berust,
 * welke waarschuwingen er stonden en wat ermee gebeurd is.
 *
 * De statuslijn is de reden dat dit bestaat. "Geplaatst" is niet hetzelfde als
 * "uitgevoerd", en tussen die twee zit bij medicatie de autorisatie van de huisarts.
 * Wie dat verschil wegpoetst, weet na een week niet meer wat er werkelijk besteld is.
 */

export type Orderstatus = 'ter-autorisatie' | 'geplaatst' | 'uitgevoerd' | 'afgewezen' | 'ingetrokken';

export interface Order {
  id: string;
  patientId: string;
  soort: OrderSoort;
  omschrijving: string;
  /** Dosering, vraagstelling of materiaal — wat de ontvanger nodig heeft. */
  detail?: string;
  atc?: string;
  /** Hoe dit de praktijk verlaat: recept, ZorgDomein, laboratoriumaanvraag. */
  route?: string;
  bestemming?: string;
  /** Uit welke orderset dit kwam, als het uit een set kwam. */
  uitSet?: { id: string; naam: string };
  richtlijn?: Richtlijn;
  /** Waarschuwingen zoals ze golden op het moment van plaatsen. Niet achteraf herrekend. */
  waarschuwingen: Waarschuwing[];
  /** Meetcodes die deze order gaat opleveren; het zorgplan rekent daarmee. */
  levert?: string[];
  /** Bij onderzoek: welke verrichting, zodat de uitkomstvelden erbij te vinden zijn. */
  verrichtingCode?: string;
  /** Bij een afspraak: bij welke rol, hoe lang, en langs welke route hij ingepland wordt. */
  bijRol?: string;
  duurMinuten?: number;
  planroute?: string;
  /** Verwijzing naar het afspraakverzoek dat hieruit voortkwam. */
  verzoekId?: string;
  geplaatstOp: string;
  geplaatstDoor: { id: string; naam: string; rol: Rol };
  status: Orderstatus;
  afgehandeldOp?: string;
  afgehandeldDoor?: string;
  reden?: string;
  /** Aan welk deelcontact deze order hangt — zo komt hij onder P in het journaal. */
  deelcontactId?: string;
}

export interface NieuweOrder {
  patientId: string;
  soort: OrderSoort;
  omschrijving: string;
  detail?: string;
  atc?: string;
  route?: string;
  bestemming?: string;
  uitSet?: { id: string; naam: string };
  richtlijn?: Richtlijn;
  waarschuwingen?: Waarschuwing[];
  levert?: string[];
  verrichtingCode?: string;
  bijRol?: string;
  duurMinuten?: number;
  planroute?: string;
  vereistRecht: string;
}

/**
 * Wat een order wordt als een bepaalde gebruiker hem plaatst.
 *
 * Bevoegdheid is geen filter op het scherm maar een eigenschap van de order: dezelfde
 * handeling levert bij de POH een autorisatieverzoek op en bij de huisarts een
 * geplaatste order. De POH ziet daardoor het hele voorstel en weet welk deel
 * nog langs de arts moet.
 */
export function maakOrder(
  nieuw: NieuweOrder, door: { id: string; naam: string; rol: Rol; rechten: string[] },
  volgnummer: number, op = new Date(),
): Order {
  const mag = door.rechten.includes(nieuw.vereistRecht);
  return {
    id: `order-${nieuw.patientId}-${volgnummer}`,
    patientId: nieuw.patientId,
    soort: nieuw.soort,
    omschrijving: nieuw.omschrijving,
    detail: nieuw.detail,
    atc: nieuw.atc,
    route: nieuw.route,
    bestemming: nieuw.bestemming,
    uitSet: nieuw.uitSet,
    richtlijn: nieuw.richtlijn,
    waarschuwingen: nieuw.waarschuwingen ?? [],
    levert: nieuw.levert,
    verrichtingCode: nieuw.verrichtingCode,
    bijRol: nieuw.bijRol,
    duurMinuten: nieuw.duurMinuten,
    planroute: nieuw.planroute,
    geplaatstOp: op.toISOString(),
    geplaatstDoor: { id: door.id, naam: door.naam, rol: door.rol },
    status: mag ? 'geplaatst' : 'ter-autorisatie',
  };
}

const LAATSTE_AANVRAGEN = [
  { soort: 'lab' as OrderSoort, omschrijving: 'Kreatinine en eGFR', detail: 'controle bij chronische medicatie',
    route: 'aanvraag naar het laboratorium' },
  { soort: 'lab' as OrderSoort, omschrijving: 'Lipidenprofiel', detail: 'jaarcontrole vaatrisico',
    route: 'aanvraag naar het laboratorium' },
  { soort: 'onderzoek' as OrderSoort, omschrijving: 'Enkel-armindex', detail: 'uit te voeren in de praktijk',
    route: 'inplannen bij de assistent' },
];

/**
 * Wat er al liep voordat vandaag begon.
 *
 * Chronische medicatie is ooit besteld en die geschiedenis hoort erbij: zonder
 * openingsstand lijkt elk dossier vers en is het orderoverzicht leeg op het moment dat
 * je het het hardst nodig hebt.
 */
export function genereerOrderhistorie(dossier: Dossier, peildatum: Date, zaad: number): Order[] {
  const willekeurig = rng(zaad);
  const orders: Order[] = [];
  const huisarts = { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' as Rol };
  let n = 0;

  for (const middel of dossier.medicatie.filter((m) => m.status === 'active')) {
    const dagen = 40 + Math.floor(willekeurig() * 700);
    const op = new Date(peildatum);
    op.setDate(op.getDate() - dagen);
    orders.push({
      id: `order-${dossier.patient.id}-h${++n}`,
      patientId: dossier.patient.id,
      soort: 'medicatie',
      omschrijving: middel.middel.text ?? middel.middel.coding?.[0]?.display ?? 'Middel',
      detail: middel.dosering,
      atc: middel.middel.coding?.[0]?.code,
      route: 'recept naar de apotheek',
      bestemming: 'Apotheek De Linde',
      waarschuwingen: [],
      geplaatstOp: op.toISOString(),
      geplaatstDoor: huisarts,
      status: 'uitgevoerd',
      afgehandeldOp: op.toISOString(),
    });
  }

  if (dossier.medicatie.length > 0 && willekeurig() < 0.5) {
    const sjabloon = LAATSTE_AANVRAGEN[Math.floor(willekeurig() * LAATSTE_AANVRAGEN.length)];
    const op = new Date(peildatum);
    op.setDate(op.getDate() - Math.floor(willekeurig() * 20));
    orders.push({
      id: `order-${dossier.patient.id}-h${++n}`,
      patientId: dossier.patient.id,
      ...sjabloon,
      waarschuwingen: [],
      geplaatstOp: op.toISOString(),
      geplaatstDoor: huisarts,
      status: 'geplaatst',
    });
  }

  return orders.sort((a, b) => b.geplaatstOp.localeCompare(a.geplaatstOp));
}
