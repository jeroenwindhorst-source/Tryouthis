import type { Dossier } from '@zpe/fhir-model';
import { rng } from './populatie.js';
import type { ExternDocument } from './externe-bronnen.js';

/**
 * MEDIA EN DOCUMENTEN
 *
 * De gestructureerde gegevens uit een BgZ zijn altijd beperkter dan de brief zelf. De
 * ontslagbrief bevat een alinea over het beloop die in geen enkel veld past; de foto die
 * de patiënt insturen van een wond zegt in één blik meer dan drie regels tekst.
 *
 * In de meeste systemen bestaat daar een aparte documentenmap voor, buiten het journaal
 * om, zonder koppeling met het contact waar het bij hoort. Dan staat de uitslag in de
 * tijdlijn en de bijbehorende PDF ergens anders, en moet je bij elk stuk opnieuw
 * uitzoeken waar het bij hoorde.
 *
 * Hier hangt elk mediabestand aan zijn aanleiding — een contact, een binnengekomen
 * bericht, een verrichting, of de patiënt zelf — zodat het van twee kanten te vinden is.
 *
 * ⚠️ De demo bevat geen echte bestanden. Wat er staat is de metadata en de koppeling;
 * dat is het deel dat een dossier moet regelen. De opslag zelf hoort in een
 * documentvoorziening met eigen versiebeheer en logging (docs/07).
 */

export type Mediasoort = 'pdf' | 'foto' | 'strook' | 'scan' | 'geluid';

export type Mediabron = 'ziekenhuis' | 'patient' | 'praktijk' | 'paramedisch' | 'lab' | 'thuiszorg';

export const MEDIASOORT_LABEL: Record<Mediasoort, string> = {
  pdf: 'document', foto: 'foto', strook: 'meetstrook', scan: 'scan', geluid: 'geluidsopname',
};

export const MEDIABRON_LABEL: Record<Mediabron, string> = {
  ziekenhuis: 'ziekenhuis', patient: 'patiënt', praktijk: 'praktijk',
  paramedisch: 'paramedisch', lab: 'laboratorium', thuiszorg: 'thuiszorg',
};

export interface Mediabestand {
  id: string;
  patientId: string;
  soort: Mediasoort;
  bron: Mediabron;
  titel: string;
  /** Waar het over gaat; ook het zoekwoord. */
  categorie: string;
  datum: string;
  ontvangenOp: string;
  bestandsnaam: string;
  groottekB: number;
  /**
   * Waar dit bij hoort. Van twee kanten vindbaar: hier én in de tijdlijn.
   *
   * `bronId` is de bron in de tijdlijn (het ziekenhuis, de thuiszorg), `id` het item zelf.
   * Allebei nodig: je wilt kunnen springen naar "alles van dit ziekenhuis" én naar dit
   * ene bericht.
   */
  gekoppeldAan?: {
    soort: 'extern' | 'contact' | 'verrichting';
    id: string; bronId?: string; omschrijving: string;
  };
  /** Eén regel over wat erop staat, zodat je niet elk bestand hoeft te openen. */
  omschrijving: string;
  gelezen: boolean;
}

const PATIENTFOTOS = [
  { titel: 'Foto wond onderbeen', categorie: 'wondzorg',
    omschrijving: 'Ingestuurd via het portaal ter beoordeling; roodheid rond de wondrand.' },
  { titel: 'Foto huidafwijking rug', categorie: 'dermatologie',
    omschrijving: 'Moedervlek met vraag over verandering in kleur.' },
  { titel: 'Foto uitslag onderarm', categorie: 'dermatologie',
    omschrijving: 'Jeukende plekjes sinds drie dagen, na tuinieren.' },
  { titel: 'Foto bloeddrukmeter', categorie: 'thuismeting',
    omschrijving: 'Display van de thuismeter, meegestuurd omdat de app niet koppelde.' },
  { titel: 'Foto medicatiedoos', categorie: 'medicatie',
    omschrijving: 'Vraag welk doosje bij welk moment hoort.' },
];

const PRAKTIJKMEDIA = [
  { soort: 'strook' as Mediasoort, titel: 'ECG-strook', categorie: 'hartonderzoek',
    omschrijving: 'Twaalfafleidingen-ECG, gemaakt op de praktijk.' },
  { soort: 'pdf' as Mediasoort, titel: 'Spirometriecurve', categorie: 'longfunctie',
    omschrijving: 'Flow-volumecurve met reversibiliteitstest.' },
  { soort: 'pdf' as Mediasoort, titel: 'Rapport 24-uurs bloeddrukmeting', categorie: 'bloeddruk',
    omschrijving: 'Dag- en nachtgemiddelden met dipping-patroon.' },
];

/**
 * Media voor één patiënt.
 *
 * Elk extern bericht levert de brief zelf op — dat is de belangrijkste koppeling: de
 * gestructureerde secties in de tijdlijn zijn een samenvatting, de PDF is het origineel.
 */
export function genereerMedia(
  dossier: Dossier, extern: ExternDocument[], peildatum: Date, zaad: number,
): Mediabestand[] {
  const willekeurig = rng(zaad);
  const media: Mediabestand[] = [];
  const patientId = dossier.patient.id;

  // Bij elk binnengekomen bericht hoort het originele document.
  extern.forEach((document, i) => {
    const bron: Mediabron =
      document.bron.soort === 'ziekenhuis' ? 'ziekenhuis'
      : document.bron.soort === 'thuiszorg' ? 'thuiszorg'
      : document.bron.soort === 'paramedisch' ? 'paramedisch' : 'ziekenhuis';
    media.push({
      id: `media-${patientId}-ext-${i + 1}`,
      patientId,
      soort: 'pdf',
      bron,
      titel: document.titel,
      categorie: document.uitwisseling === 'BgZ' ? 'specialistenbrief' : 'correspondentie',
      datum: document.datum,
      ontvangenOp: document.ontvangenOp,
      bestandsnaam: `${document.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      groottekB: 90 + Math.floor(willekeurig() * 700),
      gekoppeldAan: {
        soort: 'extern', id: document.id, bronId: document.bron.id,
        omschrijving: `${document.bron.naam} · ${document.uitwisseling}`,
      },
      omschrijving:
        'Het originele document. De gestructureerde secties in de tijdlijn zijn een '
        + 'samenvatting; hier staat het hele verhaal.',
      gelezen: document.gelezen,
    });

    // Bij een ziekenhuisbericht hoort vaak beeldvorming.
    if (document.bron.soort === 'ziekenhuis' && willekeurig() < 0.45) {
      media.push({
        id: `media-${patientId}-beeld-${i + 1}`,
        patientId,
        soort: 'scan',
        bron: 'ziekenhuis',
        titel: willekeurig() < 0.5 ? 'X-thorax' : 'Echo abdomen',
        categorie: 'beeldvorming',
        datum: document.datum,
        ontvangenOp: document.ontvangenOp,
        bestandsnaam: `beeldverslag-${document.datum}.pdf`,
        groottekB: 140 + Math.floor(willekeurig() * 400),
        gekoppeldAan: {
          soort: 'extern', id: document.id, bronId: document.bron.id,
          omschrijving: document.bron.naam,
        },
        omschrijving: 'Verslag van de radioloog. Het beeld zelf staat in het PACS van de instelling.',
        gelezen: document.gelezen,
      });
    }
  });

  // Wat de patiënt zelf instuurde.
  const aantalFotos = willekeurig() < 0.35 ? 0 : 1 + Math.floor(willekeurig() * 2.4);
  for (let i = 0; i < aantalFotos; i++) {
    const sjabloon = PATIENTFOTOS[Math.floor(willekeurig() * PATIENTFOTOS.length)];
    const dagen = Math.floor(willekeurig() * 500);
    const datum = new Date(peildatum);
    datum.setDate(datum.getDate() - dagen);
    media.push({
      id: `media-${patientId}-foto-${i + 1}`,
      patientId,
      soort: 'foto',
      bron: 'patient',
      titel: sjabloon.titel,
      categorie: sjabloon.categorie,
      datum: datum.toISOString().slice(0, 10),
      ontvangenOp: datum.toISOString().slice(0, 10),
      bestandsnaam: `portaal-${datum.toISOString().slice(0, 10)}.jpg`,
      groottekB: 800 + Math.floor(willekeurig() * 2600),
      omschrijving: sjabloon.omschrijving,
      gelezen: dagen > 14,
    });
  }

  // Wat de praktijk zelf produceerde.
  if (dossier.medicatie.length > 0 && willekeurig() < 0.75) {
    const sjabloon = PRAKTIJKMEDIA[Math.floor(willekeurig() * PRAKTIJKMEDIA.length)];
    const dagen = 30 + Math.floor(willekeurig() * 600);
    const datum = new Date(peildatum);
    datum.setDate(datum.getDate() - dagen);
    media.push({
      id: `media-${patientId}-praktijk-1`,
      patientId,
      soort: sjabloon.soort,
      bron: 'praktijk',
      titel: sjabloon.titel,
      categorie: sjabloon.categorie,
      datum: datum.toISOString().slice(0, 10),
      ontvangenOp: datum.toISOString().slice(0, 10),
      bestandsnaam: `${sjabloon.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      groottekB: 60 + Math.floor(willekeurig() * 200),
      omschrijving: sjabloon.omschrijving,
      gelezen: true,
    });
  }

  // Een dossier zonder één enkel document bestaat in de praktijk niet: er is altijd wel
  // een toestemmingsformulier of een uitgereikte folder gescand. Een lege mediatab zou
  // suggereren dat het tabblad niet werkt in plaats van dat er niets is.
  if (media.length === 0) {
    const datum = new Date(peildatum);
    datum.setDate(datum.getDate() - (60 + Math.floor(willekeurig() * 700)));
    media.push({
      id: `media-${patientId}-praktijk-0`,
      patientId,
      soort: 'pdf',
      bron: 'praktijk',
      titel: 'Toestemming gegevensuitwisseling',
      categorie: 'formulier',
      datum: datum.toISOString().slice(0, 10),
      ontvangenOp: datum.toISOString().slice(0, 10),
      bestandsnaam: 'toestemming-gegevensuitwisseling.pdf',
      groottekB: 40 + Math.floor(willekeurig() * 60),
      omschrijving:
        'Ondertekend formulier waarmee deze patiënt toestemming geeft voor uitwisseling via '
        + 'het LSP. Gescand bij de balie en aan het dossier gehangen.',
      gelezen: true,
    });
  }

  return media.sort((a, b) => b.datum.localeCompare(a.datum));
}

export interface Mediafilter {
  soorten?: Mediasoort[];
  bronnen?: Mediabron[];
  categorie?: string;
  vraag?: string;
  jaar?: string;
}

/**
 * Filteren over de media van één patiënt.
 *
 * Bewust met vrije tekst én facetten: je zoekt soms op "wond" en soms op "alles wat de
 * patiënt instuurde". Een van de twee alleen dwingt je tot doorbladeren.
 */
export function filterMedia(bestanden: Mediabestand[], filter: Mediafilter): Mediabestand[] {
  const q = (filter.vraag ?? '').trim().toLowerCase();
  return bestanden.filter((m) => {
    if (filter.soorten?.length && !filter.soorten.includes(m.soort)) return false;
    if (filter.bronnen?.length && !filter.bronnen.includes(m.bron)) return false;
    if (filter.categorie && m.categorie !== filter.categorie) return false;
    if (filter.jaar && !m.datum.startsWith(filter.jaar)) return false;
    if (q.length >= 2) {
      const tekst = `${m.titel} ${m.categorie} ${m.omschrijving} ${m.bestandsnaam}`.toLowerCase();
      if (!tekst.includes(q)) return false;
    }
    return true;
  });
}
