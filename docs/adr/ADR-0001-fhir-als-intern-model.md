# ADR-0001 — FHIR R4 als intern datamodel, niet als exportformaat

**Status:** aanvaard · **Datum:** 2026-09-15

## Context
Elke Nederlandse HIS-leverancier "ondersteunt FHIR". In de praktijk betekent dat een
intern model uit de jaren negentig met een vertaallaag erop. Die constructie breekt
altijd op dezelfde plek: wat intern niet bestaat, kun je niet exporteren. En omdat
uitwisseling een randvoorwaarde is (Wegiz, EHDS, MedMij), is dat een structureel
probleem, geen implementatiedetail.

## Besluit
FHIR R4 is het interne model. Elke klinische registratie ís een FHIR-resource;
uitwisseling is een projectie, geen conversie. Nederlandse profielen (nl-core/zib)
worden gevalideerd op het schrijfmoment, niet op het exportmoment.

## Gevolgen
**Positief**
- Wat wij kunnen vastleggen, kunnen wij per definitie uitwisselen.
- Een externe SMART-app is functioneel gelijkwaardig aan onze eigen werkplek.
- Profielafwijkingen worden zichtbaar op het moment dat ze ontstaan.

**Negatief**
- FHIR is verbose en niet ergonomisch om direct op te programmeren.
- Sommige Nederlandse concepten (episode, deelcontact, ruiter) vragen extensies.

**Mitigatie**
Getypeerde domeinviews over de resources (`packages/fhir-model/src/dossier.ts`).
De view is ergonomisch, het model blijft FHIR. We verlaten het model niet.
