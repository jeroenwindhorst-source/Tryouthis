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
    s: 'Piekert meer sinds het overlijden van een zus. Slaapt slecht in.',
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

    // Bij een contact hoort wat er op dat moment gemeten is, gekoppeld aan dat contact.
    // De losse meetreeksen hieronder lopen daar dwars doorheen (thuismetingen, lab dat
    // los binnenkwam); die horen juist bij géén contact. Het verschil is zichtbaar in
    // het journaal en dat is de bedoeling.
    const bijContact: { code: string; waarde: number; eenheid: string }[] = [
      { code: CODE.gewicht, waarde: Math.round((72 + willekeurig() * 28) * 10) / 10, eenheid: 'kg' },
      { code: CODE.rrSys, waarde: Math.round(124 + willekeurig() * 30), eenheid: 'mmHg' },
    ];
    if (heeft('T90')) {
      bijContact.push({ code: CODE.hba1c, waarde: Math.round(48 + willekeurig() * 18), eenheid: 'mmol/mol' });
    }
    for (const meting of bijContact) {
      observaties.push({
        resourceType: 'Observation',
        id: `${dossier.patient.id}-obs-c${i}-${meting.code}`,
        patientId: dossier.patient.id,
        encounterId,
        episodeId: episode.id,
        code: { coding: [{ system: 'http://loinc.org', code: meting.code }] },
        effectief: op,
        waarde: { value: meting.waarde, unit: meting.eenheid },
        status: 'final',
        herkomst: herkomstVan(op, rol, auteur),
      });
    }
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
  /** Tijdstip van het contact, als het bekend is. Historie kent alleen de dag. */
  tijd?: string;
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
  /** Is er tekst vastgelegd, of bestaat dit contact alleen uit metingen? */
  heeftSoep: boolean;
  /** Hoeveel metingen aan dit contact hangen — de aanleiding om het open te klappen. */
  aantalMetingen: number;
  /** Hoeveel orders er tijdens dit contact zijn uitgezet. */
  aantalOrders?: number;
}

/**
 * Het journaal als omgekeerd-chronologische stroom, zoals elke zorgverlener het kent.
 *
 * Opgebouwd uit de contacten en niet uit de deelcontacten. Dat verschil is wezenlijk: een
 * contact waarbij alleen metingen zijn vastgelegd — een bloeddrukcontrole bij de assistent,
 * een uitslag die is ingevoerd — heeft geen SOEP-tekst en zou anders uit het journaal
 * verdwijnen. Er ís dan wel degelijk zorg geleverd, en een dossier waarin een deel van de
 * zorg onzichtbaar is, is geen dossier.
 */
export function journaal(dossier: Dossier, filterEpisodeId?: string): JournaalRegel[] {
  const metingenBij = (encounterId: string) =>
    dossier.observaties.filter((o) => o.encounterId === encounterId).length;

  const regels = dossier.contacten.map((contact): JournaalRegel => {
    const deelcontacten = dossier.deelcontacten.filter((dc) => dc.encounterId === contact.id);
    // Eén contact kan meerdere episodes raken (docs/03 §2). In het journaal tonen we de
    // episode van het eerste deelcontact; de rest staat in het contactdossier.
    const episodeId = deelcontacten[0]?.episodeId ?? contact.episodeId ?? '';
    const episode = dossier.episodes.find((e) => e.id === episodeId);
    const soep = deelcontacten.flatMap((dc) => dc.regels);
    const herkomst = deelcontacten[0]?.herkomst ?? contact.herkomst;

    return {
      datum: herkomst.vastgelegdOp.slice(0, 10),
      tijd: herkomst.vastgelegdOp.slice(11, 16) || undefined,
      encounterId: contact.id,
      episodeId,
      episodeTitel: episode?.titel ?? 'Geen episode',
      episodeIcpc: episode?.code.coding?.find((c) => c.system.includes('icpc'))?.code,
      soort: contact.soort,
      auteur: contact.uitvoerder.naam,
      auteurRol: herkomst.auteurRol,
      bron: herkomst.bron,
      regels: soep.map((r) => ({ letter: r.letter, tekst: r.tekst })),
      heeftSoep: soep.length > 0,
      aantalMetingen: metingenBij(contact.id),
    };
  });

  return regels
    .filter((r) => !filterEpisodeId || r.episodeId === filterEpisodeId)
    .sort((a, b) => `${b.datum}${b.tijd ?? ''}`.localeCompare(`${a.datum}${a.tijd ?? ''}`));
}

/**
 * Thuismetingen: wat de patiënt zelf doorgeeft.
 *
 * Bij bloeddruk is de thuismeting inhoudelijk beter dan de spreekkamermeting — geen
 * wittejasseneffect, en een reeks in plaats van één moment. Toch komt hij in de meeste
 * systemen niet verder dan een bericht in de postbus, waar hij als tekst blijft liggen.
 *
 * Hier landt hij als Observation, met de patiënt als bron. Dat is het verschil: de
 * waarde telt mee in het beeld en kan een signaal laten afgaan, maar vult geen
 * ketenindicator tot een zorgverlener hem heeft overgenomen (ADR-0012).
 */
export function genereerThuismetingen(
  dossier: Dossier, peildatum: Date, zaad: number,
): Observation[] {
  const willekeurig = rng(zaad);
  const heeft = (icpc: string) => dossier.episodes.some(
    (e) => e.status === 'active' && (e.code.coding ?? []).some((c) => c.code.startsWith(icpc)),
  );
  if (!heeft('K86') && !heeft('K87')) return [];

  // Eén op de drie meet thuis structureel te hoog; dat is de reeks die om een besluit vraagt.
  const teHoog = willekeurig() < 0.45;
  const basis = teHoog ? 152 + willekeurig() * 12 : 128 + willekeurig() * 8;

  const metingen: Observation[] = [];
  for (let dagen = 9; dagen >= 0; dagen -= 1) {
    if (willekeurig() < 0.25) continue; // niet elke dag gemeten — zo gaat dat thuis
    const op = new Date(peildatum.getTime() - dagen * 86_400_000);
    op.setHours(7, 40, 0, 0);
    const systolisch = Math.round(basis + (willekeurig() - 0.5) * 11);
    for (const [code, waarde] of [
      [CODE.rrSys, systolisch],
      [CODE.rrDia, Math.round(systolisch * 0.58 + (willekeurig() - 0.5) * 6)],
    ] as const) {
      metingen.push({
        resourceType: 'Observation',
        id: `${dossier.patient.id}-thuis-${code}-${dagen}`,
        patientId: dossier.patient.id,
        code: { coding: [{ system: 'http://loinc.org', code }] },
        effectief: op.toISOString(),
        waarde: { value: waarde, unit: 'mmHg' },
        status: 'final',
        herkomst: {
          bron: 'patient',
          vastgelegdOp: op.toISOString(),
          auteurId: dossier.patient.id,
          auteurRol: 'patient',
          systeem: { naam: 'Cadans patiëntportaal' },
        },
      });
    }
  }
  return metingen;
}
