import type { Dossier, EpisodeOfCare, Herkomst, Observation, Patient, Appointment } from '@zpe/fhir-model';
import { METING_CODES } from '@zpe/care-engine';

/**
 * Synthetische praktijkpopulatie.
 *
 * Nooit productiedata in ontwikkel- of testomgevingen (docs/07 §4); daarom is
 * populatiegeneratie onderdeel van de toolchain in plaats van een bijzaak.
 * Deterministisch, zodat demo's en tests reproduceerbaar zijn.
 */

/** Kleine deterministische generator (mulberry32) — geen externe afhankelijkheid nodig. */
function rng(zaad: number): () => number {
  let a = zaad >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VOORNAMEN_V = ['Anneke', 'Marjan', 'Fatima', 'Els', 'Sandra', 'Greetje', 'Ilse', 'Wilma', 'Ayse', 'Corrie', 'Nadia', 'Truus'];
const VOORNAMEN_M = ['Jan', 'Piet', 'Mohammed', 'Henk', 'Kees', 'Ahmed', 'Bert', 'Willem', 'Dirk', 'Youssef', 'Gerrit', 'Ruud'];
const ACHTERNAMEN = ['de Vries', 'Jansen', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'Bos',
  'El Amrani', 'Yilmaz', 'van den Berg', 'Peters', 'Hendriks', 'Dekker', 'Kok', 'Vermeulen'];

interface EpisodeSjabloon { icpc: string; titel: string }

const SJABLONEN: Record<string, EpisodeSjabloon> = {
  dm2: { icpc: 'T90.02', titel: 'Diabetes mellitus type 2' },
  hypertensie: { icpc: 'K86', titel: 'Hypertensie zonder orgaanbeschadiging' },
  copd: { icpc: 'R95', titel: 'Chronische bronchitis/COPD' },
  astma: { icpc: 'R96', titel: 'Astma' },
  hvz: { icpc: 'K76', titel: 'Andere/chronische ischemische hartziekte' },
  lipiden: { icpc: 'T93', titel: 'Vetstofwisselingsstoornis' },
  nierschade: { icpc: 'U99.01', titel: 'Chronische nierschade' },
  artrose: { icpc: 'L91', titel: 'Artrose overig' },
};

function herkomstVan(auteurId: string, rol: Herkomst['auteurRol'], op: string): Herkomst {
  return { bron: 'zorgverlener', vastgelegdOp: op, auteurId, auteurRol: rol };
}

function datumMinDagen(basis: Date, dagen: number): string {
  return new Date(basis.getTime() - dagen * 86_400_000).toISOString();
}

interface GeneratieOpties {
  aantal?: number;
  zaad?: number;
  peildatum?: Date;
}

export interface Praktijk {
  dossiers: Dossier[];
  peildatum: Date;
}

export function genereerPraktijk(opties: GeneratieOpties = {}): Praktijk {
  const aantal = opties.aantal ?? 48;
  const peildatum = opties.peildatum ?? new Date();
  const willekeurig = rng(opties.zaad ?? 20260915);
  const dossiers: Dossier[] = [];

  const kies = <T,>(lijst: T[]): T => lijst[Math.floor(willekeurig() * lijst.length)];
  const tussen = (min: number, max: number): number => min + willekeurig() * (max - min);
  const rond = (x: number, d = 0): number => Math.round(x * 10 ** d) / 10 ** d;

  for (let i = 0; i < aantal; i++) {
    const vrouw = willekeurig() < 0.52;
    const leeftijd = Math.floor(tussen(35, 88));
    const geboortejaar = peildatum.getFullYear() - leeftijd;
    const id = `pat-${String(i + 1).padStart(3, '0')}`;

    const patient: Patient = {
      resourceType: 'Patient',
      id,
      identifier: [{ system: 'http://fhir.nl/fhir/NamingSystem/bsn', value: `99999${String(1000 + i)}`, use: 'official' }],
      naam: {
        voornaam: vrouw ? kies(VOORNAMEN_V) : kies(VOORNAMEN_M),
        achternaam: kies(ACHTERNAMEN),
      },
      geboortedatum: `${geboortejaar}-${String(1 + Math.floor(willekeurig() * 12)).padStart(2, '0')}-${String(1 + Math.floor(willekeurig() * 28)).padStart(2, '0')}`,
      geslacht: vrouw ? 'female' : 'male',
      contact: { telefoon: `06${String(Math.floor(tussen(10_000_000, 99_999_999)))}` },
      portaalActief: willekeurig() < 0.62,
      communicatievoorkeur: willekeurig() < 0.55 ? 'portaal' : willekeurig() < 0.5 ? 'sms' : 'telefoon',
    };

    // Aandoeningen: met de leeftijd stijgt de kans, en aandoeningen clusteren.
    const aandoeningen: string[] = [];
    const kans = Math.min(0.85, (leeftijd - 30) / 70);
    if (willekeurig() < kans * 0.55) aandoeningen.push('dm2');
    if (willekeurig() < kans * 0.7) aandoeningen.push('hypertensie');
    if (willekeurig() < kans * 0.30) aandoeningen.push('copd');
    if (willekeurig() < kans * 0.35) aandoeningen.push('lipiden');
    if (aandoeningen.includes('dm2') && willekeurig() < 0.35) aandoeningen.push('nierschade');
    if (aandoeningen.includes('hypertensie') && willekeurig() < 0.28) aandoeningen.push('hvz');
    if (willekeurig() < 0.25) aandoeningen.push('artrose');

    const episodes: EpisodeOfCare[] = aandoeningen.map((sleutel, n) => {
      const sjabloon = SJABLONEN[sleutel];
      const startDagen = Math.floor(tussen(200, 4000));
      return {
        resourceType: 'EpisodeOfCare',
        id: `${id}-ep-${n + 1}`,
        patientId: id,
        status: 'active',
        titel: sjabloon.titel,
        code: { coding: [{ system: 'http://hl7.org/fhir/sid/icpc-1-nl', code: sjabloon.icpc, display: sjabloon.titel }] },
        periode: { start: datumMinDagen(peildatum, startDagen).slice(0, 10) },
        herkomst: herkomstVan('zv-huisarts-1', 'huisarts', datumMinDagen(peildatum, startDagen)),
      };
    });

    const observaties: Observation[] = [];
    const meting = (code: string, waarde: number, eenheid: string, dagenGeleden: number, rol: Herkomst['auteurRol'] = 'poh-s') => {
      const op = datumMinDagen(peildatum, dagenGeleden);
      observaties.push({
        resourceType: 'Observation',
        id: `${id}-obs-${observaties.length + 1}`,
        patientId: id,
        code: { coding: [{ system: 'http://loinc.org', code }] },
        effectief: op,
        waarde: { value: waarde, unit: eenheid },
        status: 'final',
        herkomst: herkomstVan('zv-poh-1', rol, op),
      });
    };

    // Metingen worden bewust ongelijkmatig 'vers' gemaakt: dat is de realiteit
    // waar de inclusie- en oproepmotor mee moet omgaan.
    if (aandoeningen.includes('dm2')) {
      const achterstand = willekeurig() < 0.3;
      for (const dagen of achterstand ? [400] : [30, 130, 240]) {
        meting(METING_CODES.hba1c, rond(tussen(44, 84)), 'mmol/mol', dagen);
      }
      if (willekeurig() < 0.7) meting(METING_CODES.voet, 1, 'Simms', Math.floor(tussen(60, 500)));
      if (willekeurig() < 0.6) meting(METING_CODES.fundus, 1, '', Math.floor(tussen(100, 900)));
    }
    if (aandoeningen.includes('hypertensie') || aandoeningen.includes('hvz') || aandoeningen.includes('dm2')) {
      for (const dagen of [Math.floor(tussen(10, 120)), Math.floor(tussen(150, 300))]) {
        meting(METING_CODES.rrSys, Math.round(tussen(118, 172)), 'mmHg', dagen);
        meting(METING_CODES.rrDia, Math.round(tussen(68, 104)), 'mmHg', dagen);
      }
      if (willekeurig() < 0.75) meting(METING_CODES.ldl, rond(tussen(1.4, 4.6), 1), 'mmol/l', Math.floor(tussen(40, 420)));
    }
    if (aandoeningen.includes('copd')) {
      const basis = tussen(0.4, 2.6);
      const afnames = Math.floor(tussen(2, 4));
      for (let k = afnames; k >= 1; k--) {
        const drift = willekeurig() < 0.25 ? tussen(0.3, 1.2) : tussen(-0.2, 0.25);
        meting(METING_CODES.ccq, rond(Math.max(0, basis + drift * (afnames - k)), 1), '', k * 90, 'poh-s');
      }
      if (willekeurig() < 0.7) meting(METING_CODES.fev1, rond(tussen(1.1, 3.0), 2), 'l', Math.floor(tussen(80, 500)));
    }
    if (willekeurig() < 0.8) meting(METING_CODES.gewicht, rond(tussen(58, 118), 1), 'kg', Math.floor(tussen(20, 400)));
    if (willekeurig() < 0.7) meting(METING_CODES.egfr, Math.round(tussen(32, 98)), 'ml/min', Math.floor(tussen(40, 500)));

    dossiers.push({
      patient, episodes, condities: [], contacten: [], deelcontacten: [],
      observaties, medicatie: [], markeringen: [], taken: [], afspraken: [],
    });
  }

  return { dossiers, peildatum };
}

/** Vult het spreekuur van vandaag met een realistische mix van chronische controles. */
export function genereerSpreekuur(praktijk: Praktijk, zaad = 42): Appointment[] {
  const willekeurig = rng(zaad);
  const dag = praktijk.peildatum.toISOString().slice(0, 10);
  const kandidaten = praktijk.dossiers.filter((d) => d.episodes.length >= 1);
  const afspraken: Appointment[] = [];
  const tijden = ['08:40', '09:00', '09:20', '09:40', '10:00', '10:40', '11:00', '11:20', '13:30', '13:50', '14:10', '14:30'];

  for (let i = 0; i < tijden.length && i < kandidaten.length; i++) {
    const dossier = kandidaten[Math.floor(willekeurig() * kandidaten.length)];
    if (afspraken.some((a) => a.patientId === dossier.patient.id)) continue;
    afspraken.push({
      resourceType: 'Appointment',
      id: `afs-${dag}-${i + 1}`,
      patientId: dossier.patient.id,
      start: `${dag}T${tijden[i]}:00+02:00`,
      eindeMinuten: 20,
      soort: willekeurig() < 0.15 ? 'e-consult' : 'consult',
      afspraakType: 'chronische-controle',
      uitvoerder: { id: 'zv-poh-1', naam: 'S. Bakker', rol: 'poh-s' },
      status: 'booked',
      reden: 'Chronische controle',
    });
  }
  return afspraken.sort((a, b) => a.start.localeCompare(b.start));
}
