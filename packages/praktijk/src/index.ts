/**
 * De praktijklaag: samenstelling van dossier, protocol en beslisregels tot de
 * schermen van een werkplek — plus een synthetische praktijk om op te draaien.
 *
 * Bewust géén HTTP. Daardoor draait deze laag zowel in de Fastify-server (apps/api)
 * als volledig in de browser (apps/web), zonder dat er een regel logica verandert.
 * Dat is niet alleen handig voor een demo: het bewijst dat de domeinlaag echt los
 * staat van het transport, wat een voorwaarde is voor de FHIR-facade uit docs/08.
 */
export * from './populatie.js';
export * from './werkvoorraad.js';
export * from './configuratie-demo.js';
export * from './gebruikers.js';
export * from './berichten.js';
export * from './historie.js';
export * from './externe-bronnen.js';
export * from './orderopslag.js';
export * from './bespreeklijst.js';
export * from './planning.js';
export * from './beleidsafspraken.js';
export * from './contactsoorten.js';
export * from './verrichtingen.js';
export * from './acuut.js';
export * from './samenvatting.js';
export * from './media.js';
export * from './groepsconsult.js';
export * from './rapportage.js';
export * from './terminologie.js';
export * from './store.js';
export * from './bff.js';
