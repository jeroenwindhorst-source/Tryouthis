# ADR-0002 — Dual coding met drie registratieniveaus

**Status:** aanvaard · **Datum:** 2026-09-15

## Context
De huisartsensector registreert in ICPC-1 NL (~1.400 codes). De rest van de zorg
communiceert in SNOMED CT (~385.000 concepten). Drie opties liggen voor:

1. ICPC houden — dan kan er niets betekenisvols binnenkomen van buiten.
2. Overstappen op SNOMED — dan breekt ketenzorgfinanciering, breken indicatoren,
   en krijgt de huisarts keuzes voorgelegd die hij niet kán maken.
3. Beide, met expliciete mapping.

## Besluit
Optie 3, met een hard onderscheid in drie niveaus:

| Niveau | Registreerbaar | Herkomst |
| --- | --- | --- |
| registratieset | ja | ICPC-1 NL + gekoppelde NHG-referentieset |
| uitbreidingsset | ja, onder ICPC-paraplu | NL-huisartsen-refset, specifieker dan ICPC |
| extern | **nee** | de rest van SNOMED CT |

Het niveau is een eigenschap van het concept in het datamodel, geen UI-vlag. Zoeken
bij registratie doorzoekt standaard alleen de eerste twee niveaus; breder zoeken is
een bewuste handeling.

## Gevolgen
- Een registratiescherm toont nooit ongevraagd 385.000 concepten.
- Externe informatie kan altijd landen, ook zonder dat wij de code kennen; het
  origineel wordt bewaard en nooit stilzwijgend vervangen.
- De mapping wordt een te onderhouden asset met eigen versionering (docs/02 §7).
- Er is permanent dubbele codering in het dossier. Dat is bewust en blijvend —
  vijftig jaar ICPC-historie converteer je niet.
