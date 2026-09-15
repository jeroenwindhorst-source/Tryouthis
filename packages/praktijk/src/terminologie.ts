import { maakDemoTerminologie } from '@zpe/terminology';

/**
 * Eén terminologie-instantie voor de hele applicatie. De registratieset staat in het
 * geheugen (docs/02 §8); hem per verzoek opbouwen zou de prestatie-eis breken.
 */
export const terminologie = maakDemoTerminologie();

/** Toont een meetwaardecode als leesbare term; valt terug op de code zelf. */
export function metingNaam(code: string): string {
  return terminologie.lookupSnomed(code)?.display ?? code;
}
