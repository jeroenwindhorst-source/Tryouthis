import type {
  Appointment, Dossier, EpisodeOfCare, Herkomst, MedicationStatement, Observation, Patient,
} from '@zpe/fhir-model';
import { CODE, type DomeinScore, type Zelfredzaamheid } from '@zpe/care-engine';

/**
 * Synthetische praktijkpopulatie.
 *
 * Nooit productiedata in ontwikkel- of testomgevingen (docs/07 §4); daarom is
 * populatiegeneratie onderdeel van de toolchain in plaats van een bijzaak.
 * Deterministisch, zodat demo's en tests reproduceerbaar zijn.
 */

/** Kleine deterministische generator (mulberry32) — geen externe afhankelijkheid nodig. */
export function rng(zaad: number): () => number {
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

const MIDDELEN: Record<string, { atc: string; naam: string; dosering: string }[]> = {
  dm2: [
    { atc: 'A10BA02', naam: 'Metformine 500mg', dosering: '2dd1' },
    { atc: 'A10BJ02', naam: 'Liraglutide', dosering: '1dd1' },
  ],
  hypertensie: [
    { atc: 'C09AA05', naam: 'Ramipril 5mg', dosering: '1dd1' },
    { atc: 'C03CA01', naam: 'Furosemide 40mg', dosering: '1dd1' },
    { atc: 'C08CA01', naam: 'Amlodipine 5mg', dosering: '1dd1' },
  ],
  lipiden: [{ atc: 'C10AA01', naam: 'Simvastatine 40mg', dosering: '1dd1' }],
  hvz: [
    { atc: 'B01AC06', naam: 'Acetylsalicylzuur 80mg', dosering: '1dd1' },
    { atc: 'C07AB07', naam: 'Bisoprolol 2,5mg', dosering: '1dd1' },
  ],
  copd: [
    { atc: 'R03BB04', naam: 'Tiotropium', dosering: '1dd1 inhalatie' },
    { atc: 'R03AC02', naam: 'Salbutamol', dosering: 'zo nodig' },
  ],
  astma: [{ atc: 'R03BA02', naam: 'Budesonide', dosering: '2dd1 inhalatie' }],
  artrose: [{ atc: 'N02BE01', naam: 'Paracetamol 500mg', dosering: '3dd2' }],
  nierschade: [{ atc: 'A02BC01', naam: 'Omeprazol 20mg', dosering: '1dd1' }],
};

function herkomstVan(auteurId: string, rol: Herkomst['auteurRol'], op: string): Herkomst {
  return { bron: 'zorgverlener', vastgelegdOp: op, auteurId, auteurRol: rol };
}

/**
 * Een datum in het verleden, op een tijdstip dat bij een praktijk past.
 *
 * Zonder dat laatste erft elk historisch contact de kloktijd van de server, en dan staat
 * er in het journaal een consult om 03:39 — wat in een demonstratie meteen opvalt en de
 * rest van de tijdlijn verdacht maakt. Het tijdstip volgt uit het aantal dagen, dus bij
 * elke opbouw krijgt hetzelfde contact dezelfde tijd.
 */
function datumMinDagen(basis: Date, dagen: number): string {
  const dag = new Date(basis.getTime() - dagen * 86_400_000);
  // Spreekuurtijden: 08:00 tot 16:50, in stappen van tien minuten.
  const stap = Math.abs(Math.round(dagen) * 7 + 3) % 54;
  dag.setUTCHours(8 + Math.floor(stap / 6), (stap % 6) * 10, 0, 0);
  return dag.toISOString();
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

/*
 * Adressen en bereikbaarheid.
 *
 * Een demopraktijk zonder adressen valt pas op als iemand wil bellen — en dan blijkt het
 * dossier precies datgene te missen waar het systeem voor bedoeld is. Straatnamen uit één
 * fictieve wijk, zodat het een praktijk lijkt en geen adressenbestand.
 */
const STRATEN = [
  'Lindenlaan', 'Populierstraat', 'Beukhof', 'Wilgenkade', 'Esdoornplein',
  'Iepenweg', 'Meidoornsingel', 'Kastanjehof', 'Berkenstraat', 'Eikenlaan',
];

const WOONPLAATSEN = ['Waterveen', 'Waterveen', 'Waterveen', 'Zuiderbroek', 'Lindenhoven'];

/** Wat een praktijk in de loop der jaren over iemands bereikbaarheid leert. */
const BEREIKBAARHEID = [
  'Werkt tot 16:00; daarna beter bereikbaar.',
  'Slechthorend aan de telefoon — spreek rustig en herhaal afspraken.',
  'Neemt zelden op bij een onbekend nummer; spreek een bericht in.',
  'Liefst \u2019s ochtends bellen, na tien uur.',
  'Spreekt beperkt Nederlands; dochter tolkt vaak mee.',
  'Mobiel staat overdag uit, probeer het vaste nummer.',
];

/*
 * Naasten, met hun relatie en een bijpassende naam.
 *
 * De naam volgt uit de relatie en niet uit een muntworp: een 'zoon' die Wilma heet valt
 * meteen op, en dat is precies het soort slordigheid waardoor iemand de rest van de
 * demogegevens ook niet meer gelooft. De namen komen uit een eigen lijstje en niet uit
 * de patiëntenpool, zodat ze niet met patiëntnamen kunnen botsen.
 */
const NAASTEN: { relatie: string; namen: string[] }[] = [
  { relatie: 'dochter', namen: ['Marleen', 'Sanne', 'Judith', 'Esther', 'Fatima'] },
  { relatie: 'zoon', namen: ['Bram', 'Martijn', 'Hakan', 'Joost', 'Stefan'] },
  { relatie: 'partner', namen: ['Riet', 'Ger', 'Truus', 'Wim', 'Nel'] },
  { relatie: 'buurvrouw', namen: ['Lidwien', 'Ans', 'Gerda'] },
  { relatie: 'zus', namen: ['Corrie', 'Mieke', 'Bep'] },
  { relatie: 'schoonzoon', namen: ['Peter', 'Ronald', 'Youssef'] },
];

export function genereerPraktijk(opties: GeneratieOpties = {}): Praktijk {
  const aantal = opties.aantal ?? 48;
  const peildatum = opties.peildatum ?? new Date();
  const willekeurig = rng(opties.zaad ?? 20260915);
  const dossiers: Dossier[] = [];

  const kies = <T,>(lijst: T[]): T => lijst[Math.floor(willekeurig() * lijst.length)];
  const tussen = (min: number, max: number): number => min + willekeurig() * (max - min);
  const rond = (x: number, d = 0): number => Math.round(x * 10 ** d) / 10 ** d;

  /*
   * Namen komen maar één keer voor.
   *
   * Twee patiënten die "Marjan Bos" heten, zijn in de werkelijkheid een bekend
   * veiligheidsprobleem en in een demo een struikelblok: je zoekt een naam, krijgt twee
   * regels en opent de verkeerde. Met twaalf voornamen en achttien achternamen op
   * achtenveertig patiënten botst het vanzelf, dus wordt een botsing hier opgelost door
   * door te tellen in plaats van opnieuw te loten — dat blijft deterministisch.
   */
  const gebruikteNamen = new Set<string>();
  const uniekeNaam = (vrouw: boolean): { voornaam: string; achternaam: string } => {
    const voornamen = vrouw ? VOORNAMEN_V : VOORNAMEN_M;
    const startV = Math.floor(willekeurig() * voornamen.length);
    const startA = Math.floor(willekeurig() * ACHTERNAMEN.length);
    for (let stap = 0; stap < voornamen.length * ACHTERNAMEN.length; stap++) {
      const voornaam = voornamen[(startV + stap) % voornamen.length];
      const achternaam = ACHTERNAMEN[(startA + Math.floor(stap / voornamen.length)) % ACHTERNAMEN.length];
      const sleutel = `${voornaam} ${achternaam}`;
      if (!gebruikteNamen.has(sleutel)) {
        gebruikteNamen.add(sleutel);
        return { voornaam, achternaam };
      }
    }
    return { voornaam: voornamen[startV], achternaam: ACHTERNAMEN[startA] };
  };

  for (let i = 0; i < aantal; i++) {
    const vrouw = willekeurig() < 0.52;
    const leeftijd = Math.floor(tussen(35, 88));
    const geboortejaar = peildatum.getFullYear() - leeftijd;
    const id = `pat-${String(i + 1).padStart(3, '0')}`;

    const naam = uniekeNaam(vrouw);
    // example.invalid is bij RFC 2606 gereserveerd en bestaat nooit — een demo mag geen
    // adres bevatten dat per ongeluk van een echt mens blijkt te zijn.
    const email = `${naam.voornaam}.${naam.achternaam}`
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z.]/g, '') + '@example.invalid';

    const patient: Patient = {
      resourceType: 'Patient',
      id,
      identifier: [{ system: 'http://fhir.nl/fhir/NamingSystem/bsn', value: `99999${String(1000 + i)}`, use: 'official' }],
      naam,
      geboortedatum: `${geboortejaar}-${String(1 + Math.floor(willekeurig() * 12)).padStart(2, '0')}-${String(1 + Math.floor(willekeurig() * 28)).padStart(2, '0')}`,
      geslacht: vrouw ? 'female' : 'male',
      adres: {
        straat: STRATEN[Math.floor(willekeurig() * STRATEN.length)],
        huisnummer: String(1 + Math.floor(willekeurig() * 140)),
        postcode: `${1000 + Math.floor(willekeurig() * 8999)} ${
          String.fromCharCode(65 + Math.floor(willekeurig() * 26))
        }${String.fromCharCode(65 + Math.floor(willekeurig() * 26))}`,
        woonplaats: WOONPLAATSEN[Math.floor(willekeurig() * WOONPLAATSEN.length)],
      },
      contact: (() => {
        const mobiel = `06 ${String(Math.floor(tussen(10_000_000, 99_999_999)))
          .replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4')}`;
        // Een vaste lijn hebben vooral ouderen nog; dat verschil is geen detail als je
        // iemand op een dinsdagochtend probeert te bereiken.
        const vast = leeftijd > 62 && willekeurig() < 0.75
          ? `0${String(Math.floor(tussen(10, 99)))} ${String(Math.floor(tussen(100, 999)))} ${String(Math.floor(tussen(1000, 9999)))}`
          : undefined;
        return {
          telefoon: mobiel,
          mobiel,
          vast,
          email: willekeurig() < 0.7 ? email : undefined,
          toelichting: willekeurig() < 0.35
            ? BEREIKBAARHEID[Math.floor(willekeurig() * BEREIKBAARHEID.length)]
            : undefined,
        };
      })(),
      // Bij ouderen staat er vaker een naaste in het dossier; bij jongeren zelden.
      contactpersoon: leeftijd > 70 && willekeurig() < 0.65
        ? (() => {
          const naaste = NAASTEN[Math.floor(willekeurig() * NAASTEN.length)];
          return {
            naam: `${naaste.namen[Math.floor(willekeurig() * naaste.namen.length)]} `
              + `${ACHTERNAMEN[Math.floor(willekeurig() * ACHTERNAMEN.length)]}`,
            relatie: naaste.relatie,
            telefoon: `06 ${String(Math.floor(tussen(10_000_000, 99_999_999)))
              .replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4')}`,
            mag: willekeurig() < 0.6 ? 'informeren' as const
              : willekeurig() < 0.5 ? 'meebeslissen' as const : 'alleen-in-noodgeval' as const,
          };
        })()
        : undefined,
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
        meting(CODE.hba1c, rond(tussen(44, 84)), 'mmol/mol', dagen);
      }
      if (willekeurig() < 0.7) meting(CODE.voet, 1, 'Simms', Math.floor(tussen(60, 500)));
      if (willekeurig() < 0.6) meting(CODE.fundus, 1, '', Math.floor(tussen(100, 900)));
    }
    if (aandoeningen.includes('hypertensie') || aandoeningen.includes('hvz') || aandoeningen.includes('dm2')) {
      for (const dagen of [Math.floor(tussen(10, 120)), Math.floor(tussen(150, 300))]) {
        meting(CODE.rrSys, Math.round(tussen(118, 172)), 'mmHg', dagen);
        meting(CODE.rrDia, Math.round(tussen(68, 104)), 'mmHg', dagen);
      }
      if (willekeurig() < 0.75) meting(CODE.ldl, rond(tussen(1.4, 4.6), 1), 'mmol/l', Math.floor(tussen(40, 420)));
    }
    if (aandoeningen.includes('copd')) {
      const basis = tussen(0.4, 2.6);
      const afnames = Math.floor(tussen(2, 4));
      for (let k = afnames; k >= 1; k--) {
        const drift = willekeurig() < 0.25 ? tussen(0.3, 1.2) : tussen(-0.2, 0.25);
        meting(CODE.ccq, rond(Math.max(0, basis + drift * (afnames - k)), 1), '', k * 90, 'poh-s');
      }
      if (willekeurig() < 0.7) meting(CODE.fev1, rond(tussen(1.1, 3.0), 2), 'l', Math.floor(tussen(80, 500)));
    }
    if (willekeurig() < 0.8) meting(CODE.gewicht, rond(tussen(58, 118), 1), 'kg', Math.floor(tussen(20, 400)));
    if (willekeurig() < 0.7) meting(CODE.egfr, Math.round(tussen(32, 98)), 'ml/min', Math.floor(tussen(40, 500)));

    // Rookstatus is een gecodeerde observatie, geen vrije tekst — voorwaarde om er
    // regels op te kunnen draaien (docs/03 §4).
    if (aandoeningen.length > 0 && willekeurig() < 0.8) {
      const rookt = willekeurig() < (aandoeningen.includes('copd') ? 0.55 : 0.2);
      const op = datumMinDagen(peildatum, Math.floor(tussen(30, 500)));
      observaties.push({
        resourceType: 'Observation',
        id: `${id}-obs-rook`,
        patientId: id,
        code: { coding: [{ system: 'http://loinc.org', code: CODE.roken }] },
        effectief: op,
        waarde: {
          code: rookt
            ? { system: 'http://snomed.info/sct', code: '77176002', display: 'Roker' }
            : { system: 'http://snomed.info/sct', code: '8517006', display: 'Ex-roker' },
        },
        status: 'final',
        herkomst: herkomstVan('zv-poh-1', 'poh-s', op),
      });
    }

    const medicatie: MedicationStatement[] = [];
    for (const sleutel of aandoeningen) {
      for (const middel of MIDDELEN[sleutel] ?? []) {
        if (willekeurig() > 0.62) continue;
        const start = datumMinDagen(peildatum, Math.floor(tussen(100, 2500)));
        medicatie.push({
          resourceType: 'MedicationStatement',
          id: `${id}-med-${medicatie.length + 1}`,
          patientId: id,
          middel: { coding: [{ system: 'http://www.whocc.no/atc', code: middel.atc }], text: middel.naam },
          dosering: middel.dosering,
          chronisch: true,
          status: 'active',
          begin: start.slice(0, 10),
          herkomst: herkomstVan('zv-huisarts-1', 'huisarts', start),
        });
      }
    }

    dossiers.push({
      patient, episodes, condities: [], contacten: [], deelcontacten: [],
      observaties, medicatie, markeringen: [], taken: [], afspraken: [],
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
      uitvoerder: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      status: 'booked',
      reden: 'Chronische controle',
    });
  }
  return afspraken.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Het spreekuur van de komende weken — de aanloop.
 *
 * Deze afspraken staan al gepland, en daar zit precies het werk dat nu onzichtbaar is.
 * Voor elk van deze consulten is drie weken geleden een uitnodiging uitgegaan om bloed
 * te laten prikken. Een deel van de mensen doet dat. Een deel niet, en daar hoort de
 * praktijk vóór de afspraak achter te komen, niet erna: een controle zonder uitslag
 * kost twintig minuten en levert niets op.
 *
 * De dagen zijn met opzet gespreid van vlakbij tot ver weg, zodat zichtbaar wordt dat
 * hetzelfde feit ("nog niet geprikt") een heel ander gevolg heeft bij een afspraak over
 * drie dagen dan bij een afspraak over drie weken.
 */
export function genereerAanloop(
  praktijk: Praktijk, uitgesloten: Set<string>, zaad = 77,
): Appointment[] {
  const willekeurig = rng(zaad);
  const kandidaten = praktijk.dossiers.filter(
    (d) => d.episodes.length >= 1 && !uitgesloten.has(d.patient.id),
  );
  const dagenVooruit = [3, 4, 5, 6, 8, 9, 11, 12, 14, 16, 18, 21, 23, 26];
  const tijden = ['09:00', '09:40', '10:20', '11:00', '13:30', '14:10', '14:50'];

  const afspraken: Appointment[] = [];
  for (let i = 0; i < dagenVooruit.length; i++) {
    const dossier = kandidaten[Math.floor(willekeurig() * kandidaten.length)];
    if (!dossier || afspraken.some((a) => a.patientId === dossier.patient.id)) continue;
    const dag = new Date(praktijk.peildatum);
    dag.setDate(dag.getDate() + dagenVooruit[i]);
    // Geen controles in het weekend: dat valt in een demo meteen op.
    if (dag.getDay() === 6) dag.setDate(dag.getDate() + 2);
    if (dag.getDay() === 0) dag.setDate(dag.getDate() + 1);

    afspraken.push({
      resourceType: 'Appointment',
      id: `afs-aanloop-${i + 1}`,
      patientId: dossier.patient.id,
      start: `${dag.toISOString().slice(0, 10)}T${tijden[i % tijden.length]}:00+02:00`,
      eindeMinuten: 20,
      soort: 'consult',
      afspraakType: 'chronische-controle',
      uitvoerder: { id: 'zv-poh-1', naam: 'Sanne Bakker', rol: 'poh-s' },
      status: 'booked',
      reden: 'Chronische controle',
    });
  }
  return afspraken.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Zelfredzaamheid per patiënt, deterministisch afgeleid.
 *
 * Bewust gecorreleerd met leeftijd, aantal aandoeningen en polyfarmacie: wie meer
 * ziektelast draagt scoort gemiddeld lager, maar de spreiding is groot. Juist die
 * spreiding is het punt — twee patiënten met identieke waarden kunnen heel
 * verschillende zorg nodig hebben.
 */
export function genereerZelfredzaamheid(
  dossier: Dossier, peildatum: Date, zaad: number,
): Zelfredzaamheid {
  const willekeurig = rng(zaad);
  const geboren = new Date(dossier.patient.geboortedatum);
  const leeftijd = peildatum.getFullYear() - geboren.getFullYear();
  const aandoeningen = dossier.episodes.filter((e) => e.status === 'active').length;
  const middelen = dossier.medicatie.filter((m) => m.status === 'active').length;

  // Basis rond 4; ouderdom, multimorbiditeit en polyfarmacie drukken die omlaag.
  const basis = 4.3
    - Math.max(0, (leeftijd - 65) / 25)
    - aandoeningen * 0.18
    - Math.max(0, (middelen - 3) * 0.12);

  const scoreVoor = (afwijking: number): DomeinScore => {
    const ruw = basis + afwijking + (willekeurig() - 0.5) * 1.4;
    return Math.min(5, Math.max(1, Math.round(ruw))) as DomeinScore;
  };

  // Niet elk domein wordt altijd uitgevraagd; justitie zelden.
  const scores: Zelfredzaamheid['scores'] = {
    financien: scoreVoor(0.2),
    dagbesteding: scoreVoor(0.1),
    huisvesting: scoreVoor(0.6),
    'huiselijke-relaties': scoreVoor(0.4),
    'geestelijke-gezondheid': scoreVoor(-0.1),
    'lichamelijke-gezondheid': scoreVoor(-0.4),
    verslaving: scoreVoor(0.5),
    adl: scoreVoor(-0.2),
    'sociaal-netwerk': scoreVoor(0.1),
    participatie: scoreVoor(-0.1),
  };
  if (willekeurig() < 0.12) scores.justitie = 5;

  const gescoord = Object.values(scores).filter((s): s is DomeinScore => typeof s === 'number');
  const gemiddelde = gescoord.reduce((s, x) => s + x, 0) / gescoord.length;

  // Een deel heeft een eerdere afname, zodat de trend zichtbaar is.
  const heeftVorige = willekeurig() < 0.55;
  const verloop = (willekeurig() - 0.6) * 0.9;

  return {
    scores,
    afgenomenOp: new Date(peildatum.getTime() - Math.floor(willekeurig() * 200 + 20) * 86_400_000)
      .toISOString().slice(0, 10),
    afgenomenDoor: 'Sanne Bakker, POH-S',
    vorige: heeftVorige
      ? {
          gemiddelde: Math.round((gemiddelde - verloop) * 10) / 10,
          afgenomenOp: new Date(peildatum.getTime() - 400 * 86_400_000).toISOString().slice(0, 10),
        }
      : undefined,
  };
}
