# ADR-0004 — PostgreSQL met JSONB plus uitgeklapte projecties

**Status:** aanvaard · **Datum:** 2026-09-15

## Context
Het datamodel moet drie soorten vragen even snel beantwoorden (docs/01 §2):
per patiënt, per episode, en per populatie/concept. FHIR-resources zijn documenten
met een variabele vorm; populatievragen zijn numeriek en relationeel.

## Besluit
PostgreSQL. Resources als JSONB in een append-only `resource`-tabel met uitgeklapte
kolommen voor de drie assen (`patient_id`, `episode_id`, `subject_code`) en een
GIN-index op de inhoud. Numerieke metingen daarnaast in een smalle, sterk getypeerde
`observation_numeric`-projectie.

## Alternatieven afgewogen
- **Documentdatabase (MongoDB):** geen transacties over episodegrenzen, en
  populatievragen worden traag of vragen alsnog een tweede datastore.
- **Puur relationeel model:** vecht tegen de variabiliteit van FHIR; elke
  profielwijziging wordt een migratie.
- **Triplestore/RDF:** semantisch elegant, in de praktijk te traag voor een
  dagstart die elke ochtend door tientallen zorgverleners wordt geopend.

## Gevolgen
- De projectie moet consistent worden bijgehouden; dat is expliciet werk.
- Versionering is append-only: `_history` en NEN 7513-logging volgen vanzelf.
- Prestatie-eis: dossier < 300 ms, terminologie < 100 ms, dagstart < 500 ms.
  Wordt dit niet gehaald, dan wordt het systeem omzeild — snelheid is functioneel.
