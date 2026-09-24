import type { Dossier, Observation } from '@zpe/fhir-model';
import { CODE, type Zorgplan } from '@zpe/care-engine';
import { rng } from './populatie.js';

/**
 * LAB DAT VÓÓR HET CONSULT BINNEN IS
 *
 * In een werkende chronische zorgstroom is bloed prikken geen onderdeel van het
 * consult. De patiënt krijgt een week of twee van tevoren bericht, gaat langs het
 * prikpunt, en de uitslag staat er als de POH het spreekuur voorbereidt. Zo hóórt het
 * te lopen, en zo moet de demo het ook laten zien: bij wie vanmiddag op het spreekuur
 * komt, hoort niet "nog bloed prikken" te staan.
 *
 * Dat maakt de uitzondering meteen betekenisvol. Wie het níet heeft laten doen, komt
 * niet in het spreekuur terecht maar in de aanloop: daar is nog tijd om te bellen of de
 * afspraak te verzetten, want een controle zonder uitslag is een half consult.
 */

/** Aannemelijke waarden per bepaling, als er nog geen reeks is om op voort te bouwen. */
const STARTWAARDE: Record<string, { waarde: number; spreiding: number; eenheid: string }> = {
  [CODE.hba1c]: { waarde: 54, spreiding: 16, eenheid: 'mmol/mol' },
  [CODE.ldl]: { waarde: 2.4, spreiding: 1.4, eenheid: 'mmol/l' },
  [CODE.egfr]: { waarde: 72, spreiding: 30, eenheid: 'ml/min' },
  [CODE.acr]: { waarde: 2.4, spreiding: 6, eenheid: 'mg/mmol' },
};

function laatste(dossier: Dossier, code: string): Observation | undefined {
  return dossier.observaties
    .filter((o) => o.code.coding?.[0]?.code === code)
    .sort((a, b) => a.effectief.localeCompare(b.effectief))
    .at(-1);
}

/**
 * Zet de uitslagen klaar die vóór een afspraak binnen horen te zijn.
 *
 * Alleen bepalingen die het zorgplan als `labVooraf` markeert: wat in de spreekkamer
 * wordt gemeten (bloeddruk, gewicht, voetonderzoek) hoort daar ook gemeten te worden en
 * is geen achterstand.
 */
export function genereerVoorafLab(
  dossier: Dossier, plan: Zorgplan, prikdatum: Date, zaad: number,
): Observation[] {
  const willekeurig = rng(zaad);
  const op = prikdatum.toISOString();
  const nodig = plan.contacten[0]?.metingen.filter((m) => m.labVooraf) ?? [];
  const uitslagen: Observation[] = [];

  for (const meting of nodig) {
    const vorige = laatste(dossier, meting.code);
    const vorigeWaarde = vorige?.waarde && 'value' in vorige.waarde ? vorige.waarde.value : undefined;
    const basis = STARTWAARDE[meting.code];
    if (vorigeWaarde === undefined && !basis) continue;

    // Voortbouwen op de reeks houdt het beloop geloofwaardig: een HbA1c springt niet
    // van 52 naar 80. Zonder reeks een plausibele startwaarde met spreiding, zodat niet
    // iedereen dezelfde uitslag krijgt en de streefwaardelogica ook werkelijk iets doet.
    const ruw = vorigeWaarde !== undefined
      ? vorigeWaarde * (0.93 + willekeurig() * 0.16)
      : basis.waarde + (willekeurig() - 0.4) * basis.spreiding;

    const eenheid = (vorige?.waarde && 'unit' in vorige.waarde ? vorige.waarde.unit : undefined)
      ?? basis?.eenheid ?? '';
    const decimalen = eenheid === 'mmol/mol' || eenheid === 'ml/min' ? 0 : 1;

    uitslagen.push({
      resourceType: 'Observation',
      id: `${dossier.patient.id}-lab-vooraf-${meting.code}`,
      patientId: dossier.patient.id,
      code: { coding: [{ system: 'http://loinc.org', code: meting.code }] },
      effectief: op,
      waarde: { value: Number(ruw.toFixed(decimalen)), unit: eenheid },
      status: 'final',
      herkomst: {
        bron: 'extern-systeem',
        vastgelegdOp: op,
        auteurId: 'lab-star-shl',
        auteurRol: 'systeem',
        systeem: { naam: 'Star-shl, prikpunt Gezondheidscentrum', identificatie: '01234567' },
        opEigenAanvraag: true,
      },
    });
  }
  return uitslagen;
}
