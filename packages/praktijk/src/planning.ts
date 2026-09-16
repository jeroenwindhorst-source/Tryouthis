import type { Rol } from '@zpe/fhir-model';
import type { AgendaItem } from './werkvoorraad.js';

/**
 * PLANNEN
 *
 * Een agenda die alleen toont wat er al staat, beantwoordt de helft van de vraag. De
 * andere helft is: waar is nog ruimte, en hoe komt iemand daarin terecht?
 *
 * Dat laatste is in een praktijk geen enkele route maar vier, en welke je kiest hangt af
 * van de patiënt en van de urgentie:
 *
 *  - **zelf**  — je pakt een vrije plek en zet hem erin. Kan alleen als je de agenda ziet.
 *  - **assistent** — je legt een verzoek neer; de assistent belt en plant.
 *  - **portaal** — de patiënt krijgt een uitnodiging en kiest zelf uit de vrije plekken
 *    die daarvoor zijn opengesteld. Scheelt twee telefoontjes en geeft de patiënt regie.
 *  - **automatisch** — het systeem plant binnen de afgesproken marge, zonder tussenkomst.
 *    Alleen voor logistiek werk dat geen beoordeling vraagt (docs/13 §2).
 *
 * De route staat bij het verzoek en niet bij de gebruiker: dezelfde POH kiest bij de ene
 * patiënt het portaal en belt bij de andere. Dat is geen inconsistentie maar zorg.
 */

export type Planroute = 'zelf' | 'assistent' | 'portaal' | 'automatisch';

export const PLANROUTE_UITLEG: Record<Planroute, { label: string; uitleg: string }> = {
  zelf: { label: 'ik plan het nu in', uitleg: 'Je kiest zelf een vrije plek in de agenda.' },
  assistent: { label: 'assistent belt en plant', uitleg: 'Komt op de werklijst van de assistent, met de reden erbij.' },
  portaal: { label: 'patiënt plant zelf', uitleg: 'De patiënt krijgt een uitnodiging en kiest uit de opengestelde plekken.' },
  automatisch: { label: 'systeem plant binnen de marge', uitleg: 'Alleen voor routine zonder beoordeling; de patiënt krijgt een bevestiging.' },
};

/** Standaardlengte van een afspraak per rol; de agenda hangt op dit raster. */
export const SLOTLENGTE: Record<string, number> = {
  'poh-s': 20, huisarts: 10, assistent: 10,
};

export interface Slot {
  id: string;
  rol: Rol;
  start: string;
  duurMinuten: number;
  /** Ligt dit slot in een venster dat voor de patiënt is opengesteld? */
  patientPlanbaar: boolean;
  /** Waar het venster voor bedoeld is, als dat vastligt. */
  bestemd?: string;
}

export type Verzoekstatus = 'open' | 'uitgezet' | 'ingepland' | 'geannuleerd';

export interface Afspraakverzoek {
  id: string;
  patientId: string;
  naam: string;
  voorRol: Rol;
  reden: string;
  duurMinuten: number;
  route: Planroute;
  status: Verzoekstatus;
  aangevraagdDoor: { id: string; naam: string; rol: Rol };
  aangevraagdOp: string;
  /** Binnen welke termijn het moet gebeuren; stuurt de urgentie op de werklijst. */
  gewensteTermijn?: string;
  /** Vragenlijst die met de uitnodiging meegaat, zodat de voorbereiding klaarstaat. */
  vragenlijst?: string;
  /** Wat eruit kwam. */
  ingepland?: { start: string; duurMinuten: number; rol: Rol };
  portaalVerstuurdOp?: string;
  toelichting?: string;
}

export interface NieuwAfspraakverzoek {
  patientId: string;
  naam: string;
  voorRol: Rol;
  reden: string;
  duurMinuten?: number;
  route: Planroute;
  gewensteTermijn?: string;
  vragenlijst?: string;
}

const minutenVan = (tijdstempel: string): number =>
  Number(tijdstempel.slice(11, 13)) * 60 + Number(tijdstempel.slice(14, 16));

const stempel = (dag: string, minuten: number): string => {
  const twee = (n: number) => String(n).padStart(2, '0');
  return `${dag}T${twee(Math.floor(minuten / 60))}:${twee(minuten % 60)}:00+02:00`;
};

/** Vensters die per rol voor de patiënt zelf openstaan. Praktijkafspraak, geen natuurwet. */
const PORTAALVENSTERS: Record<string, { van: number; tot: number; bestemd: string }[]> = {
  'poh-s': [{ van: 15 * 60, tot: 16 * 60 + 40, bestemd: 'Controle chronische zorg' }],
  huisarts: [{ van: 15 * 60, tot: 16 * 60, bestemd: 'Regulier consult' }],
  assistent: [{ van: 13 * 60 + 30, tot: 15 * 60, bestemd: 'Verrichting of controle' }],
};

const DAGVENSTER = { van: 8 * 60, tot: 17 * 60 };

/**
 * Vrije plekken in de agenda van één rol.
 *
 * Werkt op de wandklok van de dag en niet op tijdzones: een agenda is een raster van
 * uren, geen reeks momenten. Blokken tellen als bezet — een visiteblok is geen ruimte —
 * behalve het overlegblok, dat wel zichtbaar blijft maar niet ingeplande tijd is.
 */
export function vrijeSlots(
  items: AgendaItem[], rol: Rol, peildatum: Date, duurMinuten?: number,
): Slot[] {
  const dag = peildatum.toISOString().slice(0, 10);
  const lengte = duurMinuten ?? SLOTLENGTE[rol] ?? 15;
  const bezet = items
    .filter((i) => i.rol === rol && i.status !== 'noshow')
    .map((i) => ({ van: minutenVan(i.start), tot: minutenVan(i.start) + i.duurMinuten }))
    .sort((a, b) => a.van - b.van);

  const vrij: Slot[] = [];
  for (let m = DAGVENSTER.van; m + lengte <= DAGVENSTER.tot; m += lengte) {
    const botst = bezet.some((b) => m < b.tot && m + lengte > b.van);
    if (botst) continue;
    const venster = (PORTAALVENSTERS[rol] ?? []).find((v) => m >= v.van && m + lengte <= v.tot);
    vrij.push({
      id: `slot-${rol}-${m}`,
      rol,
      start: stempel(dag, m),
      duurMinuten: lengte,
      patientPlanbaar: Boolean(venster),
      bestemd: venster?.bestemd,
    });
  }
  return vrij;
}

/**
 * Wat een verzoek wordt op het moment dat het geplaatst wordt.
 *
 * Een verzoek met route `zelf` bestaat maar kort: het wordt direct ingepland. De andere
 * drie blijven staan tot iemand — of de patiënt — er iets mee doet, en dat is precies de
 * reden dat ze bestaan: anders verdwijnt "ik moet haar nog inplannen" in iemands hoofd.
 */
export function maakVerzoek(
  nieuw: NieuwAfspraakverzoek,
  door: { id: string; naam: string; rol: Rol },
  volgnummer: number,
  op = new Date(),
): Afspraakverzoek {
  return {
    id: `plan-${volgnummer}-${op.getTime()}`,
    patientId: nieuw.patientId,
    naam: nieuw.naam,
    voorRol: nieuw.voorRol,
    reden: nieuw.reden,
    duurMinuten: nieuw.duurMinuten ?? SLOTLENGTE[nieuw.voorRol] ?? 15,
    route: nieuw.route,
    status: nieuw.route === 'portaal' ? 'uitgezet' : 'open',
    aangevraagdDoor: door,
    aangevraagdOp: op.toISOString(),
    gewensteTermijn: nieuw.gewensteTermijn,
    vragenlijst: nieuw.vragenlijst,
    portaalVerstuurdOp: nieuw.route === 'portaal' ? op.toISOString() : undefined,
    toelichting: PLANROUTE_UITLEG[nieuw.route].uitleg,
  };
}

/**
 * Wat er aan het begin van de dag al klaarligt.
 *
 * Een leeg planbord laat niet zien waar het voor is. Deze vier verzoeken zijn de vier
 * routes, zodat het verschil tussen "de assistent belt" en "de patiënt plant zelf" in het
 * scherm te zien is en niet alleen in de uitleg.
 */
export function genereerVerzoeken(
  patienten: { patientId: string; naam: string }[], peildatum: Date,
): Afspraakverzoek[] {
  const sjablonen: (NieuwAfspraakverzoek & {
    door: { id: string; naam: string; rol: Rol }; dagenTerug: number;
  })[] = [
    {
      patientId: '', naam: '', voorRol: 'huisarts', duurMinuten: 10, route: 'assistent',
      reden: 'Beoordeling door de huisarts: klachten passen niet bij het bekende beeld',
      gewensteTermijn: 'deze week',
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' }, dagenTerug: 1,
    },
    {
      patientId: '', naam: '', voorRol: 'poh-s', duurMinuten: 20, route: 'portaal',
      reden: 'Controle na wijziging bloeddrukmedicatie',
      vragenlijst: 'Thuismeetreeks 7 dagen',
      door: { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' }, dagenTerug: 2,
    },
    {
      patientId: '', naam: '', voorRol: 'assistent', duurMinuten: 10, route: 'assistent',
      reden: 'Bloedafname vóór de jaarcontrole',
      door: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' }, dagenTerug: 1,
    },
    {
      patientId: '', naam: '', voorRol: 'poh-s', duurMinuten: 20, route: 'assistent',
      reden: 'Controle na ziekenhuisopname COPD, binnen twee weken',
      gewensteTermijn: 'binnen 2 weken',
      door: { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' }, dagenTerug: 3,
    },
    {
      patientId: '', naam: '', voorRol: 'huisarts', duurMinuten: 20, route: 'portaal',
      reden: 'Gesprek over behandelwensen, dubbel consult',
      door: { id: 'zv-huisarts-1', naam: 'Daan Verhoeven', rol: 'huisarts' }, dagenTerug: 4,
    },
  ];

  return sjablonen.flatMap((sjabloon, i) => {
    const patient = patienten[i * 7 + 2];
    if (!patient) return [];
    const op = new Date(peildatum);
    op.setDate(op.getDate() - sjabloon.dagenTerug);
    const { door, dagenTerug: _weg, ...rest } = sjabloon;
    return [maakVerzoek(
      { ...rest, patientId: patient.patientId, naam: patient.naam },
      door, i + 1, op,
    )];
  });
}

/** De werklijst van de assistent: wat er nog ingepland moet worden, urgentste eerst. */
export function teplannen(verzoeken: Afspraakverzoek[]): Afspraakverzoek[] {
  const rang = (v: Afspraakverzoek) => (v.route === 'assistent' ? 0 : v.route === 'automatisch' ? 1 : 2);
  return verzoeken
    .filter((v) => v.status === 'open' || v.status === 'uitgezet')
    .sort((a, b) => rang(a) - rang(b) || a.aangevraagdOp.localeCompare(b.aangevraagdOp));
}
