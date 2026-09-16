import type { Deelcontact, Dossier, Encounter, Herkomst, Observation, Rol } from '@zpe/fhir-model';
import { CODE } from '@zpe/care-engine';
import { rng } from './populatie.js';

/**
 * DOSSIERHISTORIE
 *
 * Een patiënt met een chronische aandoening bouwt in tien jaar honderden regels op.
 * Twee eisen die tegen elkaar in werken:
 *
 *  - je wilt dat niet allemaal zien tijdens een consult (informatie-overkill), en
 *  - je wilt het wél kunnen terughalen wanneer je een vraag hebt.
 *
 * Daarom: het consultscherm toont alleen wat voor dít contact telt, en de historie zit
 * één klik verderop — gefilterd, met de meetreeksen visueel zodat een beloop in één blik
 * te zien is in plaats van uit een kolom getallen te moeten reconstrueren.
 */

const SOEP_SJABLONEN: { s: string; o: string; e: string; p: string; modules: string[] }[] = [
  {
    modules: ['glucose'],
    s: 'Gaat redelijk. Soms dorstig aan het eind van de middag. Neemt de tabletten trouw.',
    o: 'Gewicht stabiel. Voeten zonder afwijkingen, sensibiliteit intact.',
    e: 'Diabetes redelijk ingesteld, HbA1c iets boven streefwaarde.',
    p: 'Leefstijl besproken, ongewijzigd beleid. Controle over drie maanden met lab vooraf.',
  },
  {
    modules: ['glucose', 'vaatrisico'],
    s: 'Voelt zich goed, wandelt drie keer per week. Geen klachten van de ogen of voeten.',
    o: 'Bloeddruk op streefwaarde, gewicht licht gedaald.',
    e: 'Stabiel beeld, streefwaarden gehaald.',
    p: 'Complimenten gegeven. Interval verruimd naar halfjaarlijks in overleg.',
  },
  {
    modules: ['vaatrisico'],
    s: 'Heeft thuis gemeten zoals afgesproken, waarden wisselend. Slaapt matig door werkdruk.',
    o: 'Praktijkmeting hoger dan de thuisreeks; gemiddelde thuisreeks op streefwaarde.',
    e: 'Verschil past bij praktijkhypertensie; thuismeting is leidend.',
    p: 'Medicatie ongewijzigd. Aandacht voor slaap en werkdruk, terugkoppeling aan huisarts.',
  },
  {
    modules: ['ademhaling'],
    s: 'Hoest ’s ochtends meer dan anders. Gebruikt de pufjes niet altijd.',
    o: 'Inhalatietechniek gecontroleerd; coördinatie schoot tekort.',
    e: 'Klachten passen deels bij onjuiste inhalatietechniek.',
    p: 'Techniek opnieuw geïnstrueerd, voorzetkamer meegegeven. Controle over zes weken.',
  },
  {
    modules: ['leefstijl'],
    s: 'Wil stoppen met roken, heeft het eerder geprobeerd met een pleister.',
    o: 'Rookt ongeveer tien sigaretten per dag, eerste sigaret na een uur.',
    e: 'Gemotiveerd, matige afhankelijkheid.',
    p: 'Stopdatum afgesproken over twee weken, begeleidingstraject gestart.',
  },
  {
    modules: ['mentaal'],
    s: 'Piekert meer sinds het overlijden van haar zus. Slaapt slecht in.',
    o: 'Somber ogend, wel goed contact. Geen aanwijzingen voor suïcidaliteit.',
    e: 'Rouw met invloed op het zelfmanagement van de diabetes.',
    p: 'Ruimte gegeven, contact over twee weken. POH-GGZ als het aanhoudt.',
  },
  {
    modules: ['nierfunctie'],
    s: 'Geen klachten. Vraagt wat de nierwaarde betekent.',
    o: 'eGFR licht gedaald ten opzichte van vorig jaar, albuminurie niet toegenomen.',
    e: 'Milde nierfunctiedaling, passend bij leeftijd en diabetes.',
    p: 'Uitleg gegeven. Nierfunctie jaarlijks vervolgen, medicatie gecontroleerd op dosering.',
  },
];

const CONTACTSOORTEN = ['consult', 'telefonisch', 'e-consult'] as const;

/**
 * Kleine variatie op het subjectieve deel.
 *
 * Een journaal waarin drie contacten woord voor woord hetzelfde zeggen, leest als een
 * kopieerfout en niet als een dossier. Een echte S-regel heeft altijd iets van die dag
 * erin, ook als de rest van het consult routine is.
 */
const AANVULLINGEN = [
  'Verder geen bijzonderheden.',
  'Vraagt of de controle wat verder uit elkaar kan.',
  'Kwam samen met de dochter.',
  'Had de uitslag al via het portaal gezien.',
  'Is net terug van vakantie, ritme was even anders.',
  'Geeft aan het de laatste weken drukker te hebben.',
  'Zegt de afspraken goed vol te houden.',
];

function herkomstVan(op: string, rol: Rol, auteurId: string): Herkomst {
  return { bron: 'zorgverlener', vastgelegdOp: op, auteurId, auteurRol: rol };
}

interface Uitbreiding {
  contacten: Encounter[];
  deelcontacten: Deelcontact[];
  observaties: Observation[];
}

/**
 * Bouwt drie jaar dossierhistorie op: contacten met SOEP-regels en de bijbehorende
 * meetreeksen. Deterministisch, zodat een demo reproduceerbaar is.
 */
export function bouwHistorie(dossier: Dossier, peildatum: Date, zaad: number): Uitbreiding {
  const willekeurig = rng(zaad);
  const contacten: Encounter[] = [];
  const deelcontacten: Deelcontact[] = [];
  const observaties: Observation[] = [];

  const actieveEpisodes = dossier.episodes.filter((e) => e.status === 'active');
  if (actieveEpisodes.length === 0) return { contacten, deelcontacten, observaties };

  const heeft = (prefix: string) =>
    actieveEpisodes.some((e) => e.code.coding?.some((c) => c.code.startsWith(prefix)));

  const relevante = SOEP_SJABLONEN.filter((sj) =>
    (sj.modules.includes('glucose') && heeft('T90')) ||
    (sj.modules.includes('vaatrisico') && (heeft('K86') || heeft('K87') || heeft('K7'))) ||
    (sj.modules.includes('ademhaling') && heeft('R95')) ||
    sj.modules.includes('leefstijl') || sj.modules.includes('mentaal') ||
    (sj.modules.includes('nierfunctie') && heeft('U99')));
  const sjablonen = relevante.length > 0 ? relevante : SOEP_SJABLONEN;

  const aantal = 5 + Math.floor(willekeurig() * 6);
  let vorigeSjabloon = -1;
  for (let i = 0; i < aantal; i++) {
    // Verdeeld over ongeveer drie jaar, met wat spreiding.
    const dagenGeleden = Math.floor(120 + i * (900 / aantal) + willekeurig() * 45);
    const op = new Date(peildatum.getTime() - dagenGeleden * 86_400_000).toISOString();
    const episode = actieveEpisodes[Math.floor(willekeurig() * actieveEpisodes.length)];
    // Nooit twee keer achter elkaar hetzelfde sjabloon: dat leest als een kopieerfout.
    let keuze = Math.floor(willekeurig() * sjablonen.length);
    if (keuze === vorigeSjabloon && sjablonen.length > 1) {
      keuze = (keuze + 1 + Math.floor(willekeurig() * (sjablonen.length - 1))) % sjablonen.length;
    }
    vorigeSjabloon = keuze;
    const sjabloon = sjablonen[keuze];
    const aanvulling = AANVULLINGEN[Math.floor(willekeurig() * AANVULLINGEN.length)];
    const rol: Rol = willekeurig() < 0.7 ? 'poh-s' : 'huisarts';
    const auteur = rol === 'poh-s' ? 'zv-poh-1' : 'zv-huisarts-1';
    const soort = CONTACTSOORTEN[Math.floor(willekeurig() * CONTACTSOORTEN.length)];

    const encounterId = `${dossier.patient.id}-enc-h${i}`;
    contacten.push({
      resourceType: 'Encounter',
      id: encounterId,
      patientId: dossier.patient.id,
      episodeId: episode.id,
      soort,
      status: 'finished',
      periode: { start: op, end: op },
      uitvoerder: { id: auteur, naam: rol === 'poh-s' ? 'Sanne Bakker' : 'Daan Verhoeven', rol },
      herkomst: herkomstVan(op, rol, auteur),
    });

    deelcontacten.push({
      resourceType: 'Deelcontact',
      id: `${dossier.patient.id}-dc-h${i}`,
      patientId: dossier.patient.id,
      encounterId,
      episodeId: episode.id,
      regels: [
        { letter: 'S', tekst: `${sjabloon.s} ${aanvulling}` },
        { letter: 'O', tekst: sjabloon.o },
        { letter: 'E', tekst: sjabloon.e, code: episode.code },
        { letter: 'P', tekst: sjabloon.p },
      ],
      afgerond: true,
      herkomst: herkomstVan(op, rol, auteur),
    });
  }

  // Meetreeksen over dezelfde periode, zodat een beloop zichtbaar wordt.
  const reeks = (code: string, start: number, drift: number, ruis: number, intervalDagen: number, eenheid: string) => {
    let waarde = start;
    for (let dagen = 1000; dagen > 60; dagen -= intervalDagen) {
      waarde += drift * (intervalDagen / 90) + (willekeurig() - 0.5) * ruis;
      const op = new Date(peildatum.getTime() - dagen * 86_400_000).toISOString();
      observaties.push({
        resourceType: 'Observation',
        id: `${dossier.patient.id}-obs-h-${code}-${dagen}`,
        patientId: dossier.patient.id,
        code: { coding: [{ system: 'http://loinc.org', code }] },
        effectief: op,
        waarde: { value: Math.round(waarde * 10) / 10, unit: eenheid },
        status: 'final',
        herkomst: herkomstVan(op, 'poh-s', 'zv-poh-1'),
      });
    }
  };

  if (heeft('T90')) reeks(CODE.hba1c, 52 + willekeurig() * 14, willekeurig() < 0.4 ? 1.4 : -0.6, 4, 120, 'mmol/mol');
  if (heeft('K86') || heeft('K87') || heeft('T90')) {
    reeks(CODE.rrSys, 132 + willekeurig() * 22, willekeurig() < 0.4 ? 2.5 : -1.5, 8, 120, 'mmHg');
  }
  if (heeft('R95')) reeks(CODE.ccq, 1.0 + willekeurig() * 1.2, willekeurig() < 0.35 ? 0.15 : -0.05, 0.3, 180, '');
  reeks(CODE.gewicht, 72 + willekeurig() * 28, willekeurig() < 0.5 ? 0.6 : -0.4, 1.2, 180, 'kg');
  if (willekeurig() < 0.8) reeks(CODE.egfr, 62 + willekeurig() * 32, -1.2, 5, 365, 'ml/min');

  return { contacten, deelcontacten, observaties };
}

export interface JournaalRegel {
  datum: string;
  encounterId: string;
  episodeId: string;
  episodeTitel: string;
  episodeIcpc?: string;
  soort: string;
  auteur: string;
  auteurRol: string;
  /** Herkomst van de registratie — mens, extern systeem of AI-suggestie. */
  bron: string;
  regels: { letter: string; tekst: string }[];
}

/** Het journaal als omgekeerd-chronologische stroom, zoals elke zorgverlener het kent. */
export function journaal(dossier: Dossier, filterEpisodeId?: string): JournaalRegel[] {
  return dossier.deelcontacten
    .filter((dc) => !filterEpisodeId || dc.episodeId === filterEpisodeId)
    .map((dc): JournaalRegel => {
      const episode = dossier.episodes.find((e) => e.id === dc.episodeId);
      const contact = dossier.contacten.find((c) => c.id === dc.encounterId);
      return {
        datum: dc.herkomst.vastgelegdOp.slice(0, 10),
        encounterId: dc.encounterId,
        episodeId: dc.episodeId,
        episodeTitel: episode?.titel ?? 'Onbekende episode',
        episodeIcpc: episode?.code.coding?.find((c) => c.system.includes('icpc'))?.code,
        soort: contact?.soort ?? 'consult',
        auteur: contact?.uitvoerder.naam ?? dc.herkomst.auteurId,
        auteurRol: dc.herkomst.auteurRol,
        bron: dc.herkomst.bron,
        regels: dc.regels.map((r) => ({ letter: r.letter, tekst: r.tekst })),
      };
    })
    .sort((a, b) => b.datum.localeCompare(a.datum));
}
