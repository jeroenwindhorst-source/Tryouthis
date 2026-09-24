import type { Monitoritem, Zorgmodule } from './protocol.js';

/**
 * HET PROTOCOL AANPASSEN
 *
 * Een protocol dat je alleen kunt inzien, is een folder. Elke praktijk wijkt af van de
 * richtlijn — soms omdat de populatie anders is, soms omdat het prikpunt maar twee keer
 * per week open is, soms omdat de zorggroep iets anders heeft afgesproken. Die
 * afwijkingen bestaan nu ook, maar ze zitten in de hoofden van mensen en in losse
 * afspraken, en daardoor is nergens meer te zien waar de praktijk van de richtlijn
 * afwijkt en waarom.
 *
 * Daarom: aanpassen mag, maar nooit anoniem en nooit zonder reden. Elke afwijking draagt
 * wie hem maakte, wanneer, en waarom — en de richtlijnwaarde blijft ernaast staan. Dat is
 * geen administratieve last maar het verschil tussen een onderbouwde keuze en een
 * ongeluk, en het is wat een regelset onder de MDR verantwoordbaar houdt (docs/07).
 *
 * Wat je níét kunt: een aandachtsgebied verzinnen dat niet bestaat, of een meting
 * toevoegen zonder code. Het protocol is een bewerking van de richtlijn, geen vrije tekst.
 */
export interface Protocolaanpassing {
  moduleId: string;
  /** Leeg betekent: de aanpassing gaat over het hele aandachtsgebied. */
  itemCode?: string;
  /** Uitzetten voor deze praktijk. De richtlijn blijft zichtbaar. */
  actief?: boolean;
  /** Afwijkend basisinterval in dagen. */
  intervalDagen?: number;
  /** Afwijkende doorlooptijd: hoeveel dagen vóór het consult dit binnen moet zijn. */
  doorlooptijdDagen?: number;
  /** Wel of niet vooraf laten prikken. */
  labVooraf?: boolean;
  /** Verplicht. Zonder reden is een afwijking niet te verantwoorden. */
  reden: string;
  door: string;
  op: string;
}

/**
 * Hoeveel dagen vóór het consult een onderdeel binnen moet zijn.
 *
 * De aannames zijn expliciet en aanpasbaar, want ze verschillen per regio: bij een
 * prikpunt om de hoek met een sneldienst haal je het in twee dagen, bij een
 * weekenddienst niet in vijf.
 */
export function doorlooptijdVan(item: Pick<Monitoritem, 'labVooraf' | 'vragenlijst' | 'doorlooptijdDagen'>): number {
  if (item.doorlooptijdDagen !== undefined) return item.doorlooptijdDagen;
  // Prikken, verwerken en de uitslag terugkrijgen: twee tot drie werkdagen, plus een
  // weekend dat er tussen kan vallen.
  if (item.labVooraf) return 5;
  // Een vragenlijst kan de avond ervoor nog ingevuld worden; één dag marge om hem te lezen.
  if (item.vragenlijst) return 1;
  return 0;
}

/** Legt uit waarom een onderdeel zoveel dagen nodig heeft — in het scherm, bij het advies. */
export function doorlooptijdReden(item: Pick<Monitoritem, 'labVooraf' | 'vragenlijst' | 'doorlooptijdDagen'>): string {
  if (item.labVooraf) return 'prikken en uitslag: twee tot drie werkdagen';
  if (item.vragenlijst) return 'invullen kan tot de dag ervoor';
  return 'wordt tijdens het consult zelf gedaan';
}

/**
 * Past de afwijkingen van de praktijk toe op de landelijke modules.
 *
 * Nooit in plaats van de richtlijn maar bovenop: de oorspronkelijke waarden blijven
 * beschikbaar via de ongewijzigde `modules`, zodat een scherm allebei kan tonen.
 */
export function pasProtocolToe(
  modules: Zorgmodule[], aanpassingen: Protocolaanpassing[],
): Zorgmodule[] {
  if (aanpassingen.length === 0) return modules;

  const perModule = new Map<string, Protocolaanpassing>();
  const perItem = new Map<string, Protocolaanpassing>();
  for (const a of aanpassingen) {
    if (a.itemCode) perItem.set(`${a.moduleId}|${a.itemCode}`, a);
    else perModule.set(a.moduleId, a);
  }

  return modules
    .filter((m) => perModule.get(m.id)?.actief !== false)
    .map((module): Zorgmodule => ({
      ...module,
      items: module.items
        .filter((i) => perItem.get(`${module.id}|${i.code}`)?.actief !== false)
        .map((item): Monitoritem => {
          const a = perItem.get(`${module.id}|${item.code}`);
          if (!a) return item;
          return {
            ...item,
            basisIntervalDagen: a.intervalDagen ?? item.basisIntervalDagen,
            doorlooptijdDagen: a.doorlooptijdDagen ?? item.doorlooptijdDagen,
            labVooraf: a.labVooraf ?? item.labVooraf,
          };
        }),
    }));
}
