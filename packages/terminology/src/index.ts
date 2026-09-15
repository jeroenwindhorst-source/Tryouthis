export * from './systems.js';
export * from './types.js';
export * from './service.js';
export * from './mapping-schema.js';
export { demoConcepten, demoMetingen, DEMO_SEED_WAARSCHUWING } from './seed.js';

import { TerminologieService } from './service.js';
import { demoConcepten, demoMetingen } from './seed.js';

/** Service met de demoseed geladen. Vervangen zodra de echte mapping er is. */
export function maakDemoTerminologie(): TerminologieService {
  return new TerminologieService([...demoConcepten, ...demoMetingen]);
}
