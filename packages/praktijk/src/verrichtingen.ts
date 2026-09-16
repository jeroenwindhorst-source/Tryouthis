import type { Rol } from '@zpe/fhir-model';

/**
 * VERRICHTINGEN EN HUN UITKOMST
 *
 * Een order voor een ECG is niet af als het ECG gemaakt is. Er komt een strook uit, er
 * moet iemand naar kijken, en soms is dat iemand anders dan degene die hem aanvroeg.
 * In veel systemen stopt het spoor bij "aangevraagd": de uitslag belandt als los
 * document ergens in het dossier en de koppeling met de aanvraag is weg.
 *
 * Drie dingen horen daarom bij elke verrichting vast te liggen:
 *  1. **wie hem uitvoerde** — vaak de assistent, en dat is een andere persoon dan de
 *     aanvrager; zonder dat veld is achteraf niet te zien wie wat deed;
 *  2. **wat eruit kwam** — gestructureerd waar dat kan, want een vrijetekstconclusie is
 *     niet terug te vinden en telt nergens in mee;
 *  3. **wie hem beoordeelt** — zelf, de huisarts, of een specialist op afstand. Dat
 *     laatste is teleconsultatie en heeft een eigen prestatie.
 */

export type Verrichtingstatus = 'aangevraagd' | 'uitgevoerd' | 'ter-beoordeling' | 'beoordeeld';

export type Beoordelaar = 'zelf' | 'huisarts' | 'teleconsultatie';

export interface Uitkomstveld {
  code: string;
  naam: string;
  soort: 'getal' | 'keuze' | 'tekst';
  eenheid?: string;
  opties?: { code: string; label: string }[];
  /** Waarden buiten dit bereik vragen om een beoordeling door een arts. */
  normaal?: { onder?: number; boven?: number };
}

export interface Verrichtingsoort {
  code: string;
  naam: string;
  /** Wie hem in de praktijk uitvoert. */
  doorRollen: Rol[];
  duurMinuten: number;
  /** Wat er vastgelegd moet worden als hij klaar is. */
  uitkomstvelden: Uitkomstveld[];
  /** Kan dit naar een specialist op afstand? */
  teleconsultatie?: { specialisme: string; toelichting: string };
  /** Waarom deze verrichting bestaat; ook het zoekwoord. */
  indicaties: string[];
}

export const verrichtingsoorten: Verrichtingsoort[] = [
  {
    code: 'ecg', naam: 'ECG (rust)', doorRollen: ['assistent', 'poh-s', 'huisarts'], duurMinuten: 15,
    indicaties: ['hart', 'palpitaties', 'pijn op de borst', 'ritmestoornis', 'boezemfibrilleren'],
    teleconsultatie: {
      specialisme: 'Cardiologie',
      toelichting: 'ECG met vraagstelling naar de cardioloog; antwoord doorgaans binnen 1 werkdag. '
        + 'Voorkomt een verwijzing als het beeld goedaardig blijkt.',
    },
    uitkomstvelden: [
      { code: 'ecg-ritme', naam: 'Ritme', soort: 'keuze', opties: [
        { code: 'sinus', label: 'Sinusritme' },
        { code: 'af', label: 'Boezemfibrilleren' },
        { code: 'flutter', label: 'Boezemflutter' },
        { code: 'anders', label: 'Anders / onduidelijk' },
      ] },
      { code: 'ecg-frequentie', naam: 'Frequentie', soort: 'getal', eenheid: '/min',
        normaal: { onder: 50, boven: 100 } },
      { code: 'ecg-afwijking', naam: 'Afwijkingen', soort: 'keuze', opties: [
        { code: 'geen', label: 'Geen afwijkingen' },
        { code: 'geleiding', label: 'Geleidingsstoornis' },
        { code: 'repolarisatie', label: 'Repolarisatiestoornis' },
        { code: 'hypertrofie', label: 'Tekenen van hypertrofie' },
      ] },
      { code: 'ecg-conclusie', naam: 'Conclusie', soort: 'tekst' },
    ],
  },
  {
    code: 'spirometrie', naam: 'Spirometrie', doorRollen: ['poh-s', 'assistent'], duurMinuten: 30,
    indicaties: ['copd', 'astma', 'longfunctie', 'benauwd'],
    teleconsultatie: {
      specialisme: 'Longgeneeskunde',
      toelichting: 'Curve en waarden naar de longarts bij twijfel over de interpretatie.',
    },
    uitkomstvelden: [
      { code: '20150-9', naam: 'FEV1', soort: 'getal', eenheid: 'L' },
      { code: '19926-5', naam: 'FEV1/FVC', soort: 'getal', eenheid: 'ratio', normaal: { onder: 0.7 } },
      { code: 'spiro-reversibel', naam: 'Reversibiliteit', soort: 'keuze', opties: [
        { code: 'ja', label: 'Reversibel (≥ 12% en ≥ 200 ml)' },
        { code: 'nee', label: 'Niet reversibel' },
        { code: 'ngd', label: 'Niet gedaan' },
      ] },
      { code: 'spiro-kwaliteit', naam: 'Kwaliteit van de blaastest', soort: 'keuze', opties: [
        { code: 'goed', label: 'Goed reproduceerbaar' },
        { code: 'matig', label: 'Matig — herhalen overwegen' },
      ] },
      { code: 'spiro-conclusie', naam: 'Conclusie', soort: 'tekst' },
    ],
  },
  {
    code: 'abpm', naam: '24-uurs bloeddrukmeting', doorRollen: ['assistent', 'poh-s'], duurMinuten: 20,
    indicaties: ['bloeddruk', 'hypertensie', 'praktijkhypertensie'],
    uitkomstvelden: [
      { code: '8480-6', naam: 'Gemiddelde systolisch (dag)', soort: 'getal', eenheid: 'mmHg',
        normaal: { boven: 135 } },
      { code: '8462-4', naam: 'Gemiddelde diastolisch (dag)', soort: 'getal', eenheid: 'mmHg',
        normaal: { boven: 85 } },
      { code: 'abpm-dip', naam: 'Nachtelijke daling', soort: 'keuze', opties: [
        { code: 'dipper', label: 'Normale daling' },
        { code: 'non-dipper', label: 'Onvoldoende daling' },
      ] },
      { code: 'abpm-conclusie', naam: 'Conclusie', soort: 'tekst' },
    ],
  },
  {
    code: 'eai', naam: 'Enkel-armindex', doorRollen: ['assistent', 'poh-s'], duurMinuten: 20,
    indicaties: ['vaatrisico', 'claudicatio', 'etalagebenen', 'wond'],
    uitkomstvelden: [
      { code: 'eai-rechts', naam: 'Index rechts', soort: 'getal', normaal: { onder: 0.9, boven: 1.4 } },
      { code: 'eai-links', naam: 'Index links', soort: 'getal', normaal: { onder: 0.9, boven: 1.4 } },
      { code: 'eai-conclusie', naam: 'Conclusie', soort: 'tekst' },
    ],
  },
  {
    code: 'wratten', naam: 'Wratten aanstippen', doorRollen: ['assistent'], duurMinuten: 10,
    indicaties: ['wratten', 'huid', 'stikstof'],
    uitkomstvelden: [
      { code: 'wrat-aantal', naam: 'Aantal behandeld', soort: 'getal' },
      { code: 'wrat-locatie', naam: 'Locatie', soort: 'tekst' },
      { code: 'wrat-vervolg', naam: 'Vervolg', soort: 'keuze', opties: [
        { code: 'herhalen', label: 'Herhalen over 2-3 weken' },
        { code: 'klaar', label: 'Afgerond' },
        { code: 'arts', label: 'Beoordeling door de huisarts' },
      ] },
    ],
  },
  {
    code: 'audiometrie', naam: 'Audiometrie', doorRollen: ['assistent'], duurMinuten: 20,
    indicaties: ['gehoor', 'oor', 'slechthorend'],
    uitkomstvelden: [
      { code: 'audio-rechts', naam: 'Gemiddeld verlies rechts', soort: 'getal', eenheid: 'dB',
        normaal: { boven: 25 } },
      { code: 'audio-links', naam: 'Gemiddeld verlies links', soort: 'getal', eenheid: 'dB',
        normaal: { boven: 25 } },
      { code: 'audio-conclusie', naam: 'Conclusie', soort: 'tekst' },
    ],
  },
  {
    code: 'uitstrijkje', naam: 'Uitstrijkje (BVO)', doorRollen: ['assistent'], duurMinuten: 15,
    indicaties: ['baarmoederhals', 'bevolkingsonderzoek', 'uitstrijk'],
    uitkomstvelden: [
      { code: 'uitstrijk-afname', naam: 'Afname', soort: 'keuze', opties: [
        { code: 'goed', label: 'Representatief materiaal' },
        { code: 'onvoldoende', label: 'Onvoldoende materiaal — herhalen' },
      ] },
      { code: 'uitstrijk-opmerking', naam: 'Bijzonderheden', soort: 'tekst' },
    ],
  },
  {
    code: 'voetonderzoek', naam: 'Voetonderzoek (Simms)', doorRollen: ['poh-s'], duurMinuten: 15,
    indicaties: ['diabetes', 'voet', 'neuropathie'],
    uitkomstvelden: [
      { code: 'voetonderzoek-simms', naam: 'Simms-classificatie', soort: 'keuze', opties: [
        { code: '0', label: '0 — geen verlies van sensibiliteit of vaatlijden' },
        { code: '1', label: '1 — verlies van sensibiliteit of vaatlijden' },
        { code: '2', label: '2 — plus standsafwijking of eelt' },
        { code: '3', label: '3 — ulcus of amputatie in de voorgeschiedenis' },
      ] },
      { code: 'voet-sensibiliteit', naam: 'Sensibiliteit (monofilament)', soort: 'keuze', opties: [
        { code: 'intact', label: 'Intact' }, { code: 'gestoord', label: 'Gestoord' },
      ] },
      { code: 'voet-conclusie', naam: 'Conclusie', soort: 'tekst' },
    ],
  },
];

export interface Verrichtinguitslag {
  /** Welke order dit afrondt. */
  orderId: string;
  soortCode: string;
  uitgevoerdDoor: { id: string; naam: string; rol: Rol };
  uitgevoerdOp: string;
  waarden: Record<string, string>;
  beoordelaar: Beoordelaar;
  /** Bij teleconsultatie: naar welk specialisme en met welke vraag. */
  teleconsult?: { specialisme: string; vraagstelling: string; verstuurdOp: string };
  conclusie?: string;
}

export function vindVerrichting(code: string): Verrichtingsoort | undefined {
  return verrichtingsoorten.find((v) => v.code === code);
}

/**
 * Valt een uitkomst buiten de bandbreedte?
 *
 * Geen diagnose — een signaal dat dit niet zonder arts afgehandeld moet worden. De
 * assistent die een ECG maakt, hoort te weten dat een frequentie van 38 niet in de
 * la kan tot de huisarts tijd heeft.
 */
export function buitenBandbreedte(
  soort: Verrichtingsoort, waarden: Record<string, string>,
): { veld: string; waarde: string; reden: string }[] {
  const uit: { veld: string; waarde: string; reden: string }[] = [];
  for (const veld of soort.uitkomstvelden) {
    const ruw = waarden[veld.code];
    if (!ruw) continue;
    if (veld.soort === 'getal' && veld.normaal) {
      const getal = Number(ruw.replace(',', '.'));
      if (Number.isNaN(getal)) continue;
      if (veld.normaal.onder !== undefined && getal < veld.normaal.onder) {
        uit.push({ veld: veld.naam, waarde: ruw,
          reden: `onder de grens van ${veld.normaal.onder}${veld.eenheid ? ` ${veld.eenheid}` : ''}` });
      }
      if (veld.normaal.boven !== undefined && getal > veld.normaal.boven) {
        uit.push({ veld: veld.naam, waarde: ruw,
          reden: `boven de grens van ${veld.normaal.boven}${veld.eenheid ? ` ${veld.eenheid}` : ''}` });
      }
    }
    if (veld.soort === 'keuze') {
      const optie = veld.opties?.find((o) => o.code === ruw);
      const verdacht = ['af', 'flutter', 'anders', 'geleiding', 'repolarisatie', 'hypertrofie',
        'gestoord', 'onvoldoende', 'arts', 'non-dipper', '2', '3'];
      if (optie && verdacht.includes(ruw)) {
        uit.push({ veld: veld.naam, waarde: optie.label, reden: 'vraagt beoordeling door een arts' });
      }
    }
  }
  return uit;
}
