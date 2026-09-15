import type { Appointment, Dossier, Task } from '@zpe/fhir-model';
import { laatsteMeting, leeftijd, metingReeks, numeriekeWaarde } from '@zpe/fhir-model';
import {
  METING_CODES, beoordeelInclusie, bouwZorgplan, planOproepen, verwerk,
  vindVragenlijst, zorgprogrammas, type Intensiteit, type Zorgplan,
} from '@zpe/care-engine';
import { metingNaam } from './terminologie.js';
import type { DossierRepository } from './store.js';

/**
 * Taakgerichte samenstellingen per werkplek (docs/05). De FHIR-facade blijft
 * generiek; deze laag maakt er schermen van zonder klinische regels te bevatten.
 */

export function volledigeNaam(dossier: Dossier): string {
  const n = dossier.patient.naam;
  return [n.voornaam ?? n.initialen, n.tussenvoegsel, n.achternaam].filter(Boolean).join(' ');
}

function actieveProgrammas(repo: DossierRepository, dossier: Dossier): string[] {
  const reeds = repo.inclusies(dossier.patient.id);
  if (reeds.length > 0) return reeds;
  // Nog niet geïncludeerd: toon wat er inhoudelijk speelt, zodat de POH het ziet.
  return beoordeelInclusie(dossier, [], zorgprogrammas, repo.peildatum(), repo.afwijzingen(dossier.patient.id))
    .nieuweKandidaten.map((k) => k.programmaId);
}

export interface Signaal {
  soort: 'meetwaarde' | 'achterstand' | 'trend' | 'voorbereiding';
  ernst: 'informatief' | 'aandacht' | 'urgent';
  tekst: string;
}

/** Signalen op dossierniveau — de reden dat een patiënt op een lijst staat. */
export function signalen(dossier: Dossier, peildatum: Date): Signaal[] {
  const lijst: Signaal[] = [];

  const hba1c = numeriekeWaarde(laatsteMeting(dossier, METING_CODES.hba1c));
  if (hba1c !== undefined && hba1c > 64) {
    lijst.push({ soort: 'meetwaarde', ernst: hba1c > 75 ? 'urgent' : 'aandacht',
      tekst: `HbA1c ${hba1c} mmol/mol (streefwaarde afhankelijk van leeftijd en duur)` });
  }

  const rr = numeriekeWaarde(laatsteMeting(dossier, METING_CODES.rrSys));
  if (rr !== undefined && rr >= 160) {
    lijst.push({ soort: 'meetwaarde', ernst: rr >= 180 ? 'urgent' : 'aandacht',
      tekst: `Bloeddruk systolisch ${rr} mmHg` });
  }

  const egfr = numeriekeWaarde(laatsteMeting(dossier, METING_CODES.egfr));
  if (egfr !== undefined && egfr < 45) {
    lijst.push({ soort: 'meetwaarde', ernst: egfr < 30 ? 'urgent' : 'aandacht',
      tekst: `eGFR ${egfr} ml/min` });
  }

  const ccqReeks = metingReeks(dossier, METING_CODES.ccq).map((o) => numeriekeWaarde(o) ?? 0);
  if (ccqReeks.length >= 2) {
    const delta = Math.round((ccqReeks.at(-1)! - ccqReeks.at(-2)!) * 100) / 100;
    if (delta >= 0.4) {
      lijst.push({ soort: 'trend', ernst: ccqReeks.at(-1)! >= 2 ? 'urgent' : 'aandacht',
        tekst: `CCQ opgelopen van ${ccqReeks.at(-2)} naar ${ccqReeks.at(-1)} (+${delta})` });
    } else if (ccqReeks.slice(-3).every((x) => x < 1) && ccqReeks.length >= 3) {
      lijst.push({ soort: 'trend', ernst: 'informatief',
        tekst: 'CCQ drie metingen stabiel onder 1,0 — minder frequente controle is passend' });
    }
  }

  const laatsteHba1c = laatsteMeting(dossier, METING_CODES.hba1c);
  const heeftDm2 = dossier.episodes.some((e) => e.code.coding?.some((c) => c.code.startsWith('T90.02')));
  if (heeftDm2 && laatsteHba1c) {
    const dagen = Math.floor((peildatum.getTime() - new Date(laatsteHba1c.effectief).getTime()) / 86_400_000);
    if (dagen > 365) {
      lijst.push({ soort: 'achterstand', ernst: 'aandacht', tekst: `HbA1c ${dagen} dagen oud` });
    }
  } else if (heeftDm2) {
    lijst.push({ soort: 'achterstand', ernst: 'aandacht', tekst: 'Nog geen HbA1c vastgelegd' });
  }

  return lijst;
}

export interface Dagregel {
  tijd: string;
  patientId: string;
  naam: string;
  leeftijd: number;
  soort: string;
  programmas: string[];
  voorbereidingCompleet: boolean;
  ontbreekt: string[];
  signalen: Signaal[];
}

export interface Dagstart {
  datum: string;
  zorgverlener: { naam: string; rol: string };
  spreekuur: Dagregel[];
  samenvatting: { afspraken: number; vragenAandacht: number; voorbereidingIncompleet: number };
  werkvoorraad: { categorie: string; aantal: number; toelichting: string }[];
}

export function dagstart(repo: DossierRepository): Dagstart {
  const peildatum = repo.peildatum();
  const datum = peildatum.toISOString().slice(0, 10);
  const afspraken: Appointment[] = repo.spreekuur(datum);

  const spreekuur: Dagregel[] = afspraken.flatMap((afspraak) => {
    const dossier = repo.dossier(afspraak.patientId);
    if (!dossier) return [];
    const programmas = actieveProgrammas(repo, dossier);
    const plan = zorgplanVoor(repo, dossier);
    const eerstvolgend = plan.contacten[0];
    const ontbreekt = (eerstvolgend?.metingen ?? [])
      .filter((m) => m.labVooraf && (!m.laatsteOp || m.vervaltOp <= datum))
      .map((m) => m.naam);
    const vragenlijsten = eerstvolgend?.vragenlijsten ?? [];
    if (vragenlijsten.length > 0 && dossier.patient.id.charCodeAt(6) % 3 === 0) {
      ontbreekt.push('voorbereidingsvragenlijst');
    }
    return [{
      tijd: afspraak.start.slice(11, 16),
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      soort: afspraak.soort,
      programmas,
      voorbereidingCompleet: ontbreekt.length === 0,
      ontbreekt,
      signalen: signalen(dossier, peildatum),
    }];
  });

  const monitoring = monitoringCohort(repo);
  const kandidaten = inclusieKandidaten(repo);

  return {
    datum,
    zorgverlener: { naam: 'S. Bakker', rol: 'POH-Somatiek' },
    spreekuur,
    samenvatting: {
      afspraken: spreekuur.length,
      vragenAandacht: spreekuur.filter((r) => r.signalen.some((s) => s.ernst !== 'informatief')).length,
      voorbereidingIncompleet: spreekuur.filter((r) => !r.voorbereidingCompleet).length,
    },
    werkvoorraad: [
      { categorie: 'Signalen uit monitoring', aantal: monitoring.filter((m) => m.signalen.length > 0).length,
        toelichting: 'Patiënten op afstand gevolgd met een afwijking sinds de vorige beoordeling' },
      { categorie: 'Inclusievoorstellen', aantal: kandidaten.length,
        toelichting: 'Patiënten die aan de criteria van een zorgprogramma voldoen en nog niet zijn ingesloten' },
      { categorie: 'Oproepen zonder respons', aantal: repo.taken().filter((t) => t.categorie === 'oproep' && t.status === 'requested').length,
        toelichting: 'Uitnodigingen waarop nog niet is gereageerd' },
    ],
  };
}

export interface MonitoringRegel {
  patientId: string;
  naam: string;
  leeftijd: number;
  programmas: string[];
  signalen: Signaal[];
  laatsteContact?: string;
  voorstellen: { actie: string; omschrijving: string }[];
}

/** Het monitoringcohort: gesorteerd op afwijking, niet op alfabet (docs/05 §1.2). */
export function monitoringCohort(repo: DossierRepository): MonitoringRegel[] {
  const peildatum = repo.peildatum();
  const regels = repo.alleDossiers().flatMap((dossier): MonitoringRegel[] => {
    const programmas = repo.inclusies(dossier.patient.id);
    if (programmas.length === 0) return [];
    const sig = signalen(dossier, peildatum);
    return [{
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      programmas,
      signalen: sig,
      voorstellen: voorstellenBij(sig),
    }];
  });

  const gewicht = (r: MonitoringRegel): number =>
    r.signalen.reduce((s, x) => s + (x.ernst === 'urgent' ? 100 : x.ernst === 'aandacht' ? 10 : 1), 0);
  return regels.sort((a, b) => gewicht(b) - gewicht(a));
}

function voorstellenBij(sig: Signaal[]): { actie: string; omschrijving: string }[] {
  const voorstellen: { actie: string; omschrijving: string }[] = [];
  if (sig.some((s) => s.ernst === 'urgent')) {
    voorstellen.push({ actie: 'plan-afspraak', omschrijving: 'Afspraak inplannen binnen 2 weken' });
  }
  if (sig.some((s) => s.soort === 'achterstand')) {
    voorstellen.push({ actie: 'lab-aanvraag', omschrijving: 'Lab aanvragen vóór het volgende contact' });
  }
  if (sig.some((s) => s.soort === 'trend' && s.ernst === 'informatief')) {
    voorstellen.push({ actie: 'wijzig-intensiteit', omschrijving: 'Voorstel: intensiteit naar extensief' });
  }
  voorstellen.push({ actie: 'bericht', omschrijving: 'Bericht via portaal sturen' });
  voorstellen.push({ actie: 'geen-actie', omschrijving: 'Geen actie, met reden vastleggen' });
  return voorstellen;
}

export function zorgplanVoor(repo: DossierRepository, dossier: Dossier): Zorgplan {
  const programmas = actieveProgrammas(repo, dossier);
  const intensiteit = (repo.intensiteit(dossier.patient.id) ?? 'basis') as Intensiteit;
  return bouwZorgplan(dossier, programmas, intensiteit, { peildatum: repo.peildatum() });
}

export interface KandidaatRegel {
  patientId: string;
  naam: string;
  leeftijd: number;
  programmaId: string;
  programmaNaam: string;
  onderbouwing: string;
  gevolgen: string[];
}

/** Casefinding over de hele praktijk — vervangt de datadump-naar-Excel (docs/04 §1). */
export function inclusieKandidaten(repo: DossierRepository): KandidaatRegel[] {
  const peildatum = repo.peildatum();
  return repo.alleDossiers().flatMap((dossier) => {
    const resultaat = beoordeelInclusie(
      dossier, repo.inclusies(dossier.patient.id), zorgprogrammas, peildatum,
      repo.afwijzingen(dossier.patient.id),
    );
    return resultaat.nieuweKandidaten.map((k) => ({
      patientId: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      programmaId: k.programmaId,
      programmaNaam: k.programmaNaam,
      onderbouwing: k.onderbouwing,
      gevolgen: k.gevolgen ?? [],
    }));
  });
}

export function patientOverzicht(repo: DossierRepository, patientId: string) {
  const dossier = repo.dossier(patientId);
  if (!dossier) return undefined;
  const peildatum = repo.peildatum();
  const plan = zorgplanVoor(repo, dossier);
  const oproepen = planOproepen(plan, dossier.patient, { peildatum });

  return {
    patient: {
      id: dossier.patient.id,
      naam: volledigeNaam(dossier),
      leeftijd: leeftijd(dossier, peildatum),
      geboortedatum: dossier.patient.geboortedatum,
      geslacht: dossier.patient.geslacht,
      bsn: dossier.patient.identifier[0]?.value,
      portaalActief: dossier.patient.portaalActief,
    },
    episodes: dossier.episodes.map((e) => ({
      id: e.id, titel: e.titel, status: e.status,
      icpc: e.code.coding?.find((c) => c.system.includes('icpc'))?.code,
      snomed: e.code.coding?.find((c) => c.system.includes('snomed'))?.code,
      start: e.periode.start,
    })),
    metingen: [...new Set(dossier.observaties.map((o) => o.code.coding?.[0]?.code))]
      .filter((c): c is string => Boolean(c))
      .map((code) => {
        const reeks = metingReeks(dossier, code);
        const laatste = reeks.at(-1);
        return {
          code,
          naam: metingNaam(code),
          laatste: numeriekeWaarde(laatste),
          eenheid: (laatste?.waarde as { unit?: string })?.unit,
          op: laatste?.effectief.slice(0, 10),
          reeks: reeks.map((o) => ({ op: o.effectief.slice(0, 10), waarde: numeriekeWaarde(o) })),
        };
      }),
    signalen: signalen(dossier, peildatum),
    zorgplan: plan,
    oproepen,
    inclusie: beoordeelInclusie(dossier, repo.inclusies(patientId), zorgprogrammas, peildatum, repo.afwijzingen(patientId)),
    intensiteit: repo.intensiteit(patientId) ?? 'basis',
  };
}

export function verwerkVragenlijst(vragenlijstId: string, antwoorden: Record<string, unknown>, historie: unknown) {
  const lijst = vindVragenlijst(vragenlijstId);
  if (!lijst) return undefined;
  return verwerk(
    lijst,
    antwoorden as Parameters<typeof verwerk>[1],
    (historie as Parameters<typeof verwerk>[2]) ?? [],
  );
}

export function praktijkSamenvatting(repo: DossierRepository) {
  const dossiers = repo.alleDossiers();
  const plannen = dossiers.map((d) => zorgplanVoor(repo, d));
  const metProgramma = plannen.filter((p) => p.programmas.length > 0);
  const multimorbide = plannen.filter((p) => p.programmas.length > 1);

  const zonder = metProgramma.reduce((s, p) => s + p.vergelijking.zonderSamenvoeging, 0);
  const met = metProgramma.reduce((s, p) => s + p.vergelijking.metSamenvoeging, 0);
  const minuten = metProgramma.reduce((s, p) => s + p.vergelijking.bespaardeMinuten, 0);

  return {
    patienten: dossiers.length,
    metZorgprogramma: metProgramma.length,
    multimorbide: multimorbide.length,
    contactenZonderSamenvoeging: zonder,
    contactenMetSamenvoeging: met,
    bespaardeContactenPerJaar: zonder - met,
    bespaardeUrenPerJaar: Math.round((minuten / 60) * 10) / 10,
  };
}

export type { Task };
