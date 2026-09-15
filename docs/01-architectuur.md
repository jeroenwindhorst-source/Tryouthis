# 01 — Architectuur

## 1. Lagen

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Werkplekken (web)                                                       │
│  huisarts · doktersassistent · POH-S · patiëntportaal                    │
│  React + TypeScript, rolgebaseerde composities over dezelfde componenten │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ REST/JSON (eigen BFF) + SMART on FHIR (extern)
┌───────────────┴──────────────────────────────────────────────────────────┐
│  API-laag                                                                │
│  /fhir/*      — conforme FHIR R4 REST-facade (extern + intern gelijk)    │
│  /api/*       — BFF: taakgerichte endpoints per werkplek (samenstelling) │
│  /api/terminology/* — zoeken, vertalen, valideren                        │
└───────────────┬──────────────────────────────────────────────────────────┘
┌───────────────┴──────────────────────────────────────────────────────────┐
│  Domeinlaag                                                              │
│  ┌────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────────────┐  │
│  │ Dossier    │ │ Terminologie │ │ Zorgproces  │ │ Beslissings-       │  │
│  │ (episodes, │ │ (ICPC/SNOMED,│ │ (protocol-, │ │ ondersteuning      │  │
│  │  journaal, │ │  referentie- │ │  inclusie-, │ │ (regels, MDR-      │  │
│  │  metingen) │ │  set, mapping│ │  vragenlijst│ │  traceerbaar)      │  │
│  └────────────┘ └──────────────┘ └─────────────┘ └────────────────────┘  │
└───────────────┬──────────────────────────────────────────────────────────┘
┌───────────────┴──────────────────────────────────────────────────────────┐
│  Persistentie                                                            │
│  PostgreSQL: FHIR-resources als JSONB + uitgeklapte zoekindexen          │
│  Event log (append-only) · Audit (NEN 7513) · Objectstore (documenten)   │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. "Driedimensionaal benaderbaar" — wat dat concreet betekent

De eis is: hetzelfde dossier moet langs meerdere assen even snel doorzoekbaar zijn,
zonder dat je per as een aparte kopie bouwt. De drie assen:

| As | Vraag | Index |
| --- | --- | --- |
| **Patiënt** | "Geef mij het volledige dossier van deze persoon" | `(patient_id, resource_type, recorded_at DESC)` |
| **Episode / probleem** | "Geef mij alles onder de episode DM2, ongeacht type" | `(episode_id, recorded_at DESC)` — episode-koppeling is verplicht op elke klinische resource |
| **Populatie / concept** | "Geef mij alle patiënten met HbA1c > 64 én geen controle in 6 mnd" | uitgeklapte kolommen + GIN op JSONB + materialized views per aandachtsgebied |

Concreet in PostgreSQL:

```sql
create table resource (
  id            uuid primary key,
  resource_type text not null,
  version_id    bigint not null,
  patient_id    uuid,                       -- as 1
  episode_id    uuid,                       -- as 2
  subject_code  text,                       -- as 3: primaire code (snomed of icpc)
  effective_at  timestamptz,
  recorded_at   timestamptz not null,
  author_id     uuid not null,
  author_role   text not null,
  provenance    jsonb not null,             -- bron: mens / ai / extern
  content       jsonb not null,             -- de FHIR-resource
  deleted       boolean not null default false
);
create index on resource (patient_id, resource_type, recorded_at desc) where not deleted;
create index on resource (episode_id, recorded_at desc)                 where not deleted;
create index on resource (subject_code, effective_at desc)              where not deleted;
create index on resource using gin (content jsonb_path_ops)             where not deleted;
```

Numerieke populatievragen (HbA1c, RR, eGFR) lopen niet over JSONB maar over een
smalle, sterk getypeerde `observation_numeric`-tabel die als projectie wordt
bijgehouden — dat is het verschil tussen 4 seconden en 40 milliseconden op een
praktijkpopulatie van 10.000 patiënten.

Versionering is append-only: een update schrijft een nieuwe rij met hogere
`version_id`; `resource_current` is een view op de hoogste versie. Dat geeft
FHIR `_history` gratis en maakt NEN 7513-logging sluitend.

## 3. Waarom FHIR intern, niet alleen als export

Elke HIS-leverancier die FHIR "ondersteunt" heeft een intern model uit 1998 met een
vertaallaag erop. Dat breekt altijd op dezelfde plek: wat intern niet bestaat, kun je
niet exporteren. Door FHIR R4 als intern model te nemen:

- is elke uitwisseling een projectie, geen conversie;
- zijn Nederlandse profielen (nl-core/zib) valideerbaar op schrijfmoment;
- is een externe SMART-app functioneel gelijkwaardig aan onze eigen UI.

De prijs: FHIR is verbose en niet altijd ergonomisch. Die prijs betalen we in de
domeinlaag met getypeerde "views" over de resources (zie `packages/fhir-model`),
niet door het model te verlaten.

## 4. Kernresources en hun rol

| FHIR-resource | Gebruik in dit systeem |
| --- | --- |
| `Patient` | Persoonsgegevens, BSN-identifier |
| `EpisodeOfCare` | **De episode** — de ruggengraat van het NL-huisartsendossier |
| `Condition` | Probleem/diagnose binnen een episode (ICPC + SNOMED) |
| `Encounter` | Contact (consult, visite, telefonisch, e-consult) |
| `Observation` | Meetwaarden, SOEP-regels als gecodeerde observaties, PROMs |
| `Composition` | Het journaal-deelcontact (S/O/E/P) als samenhangend geheel |
| `CarePlan` | **Het persoonlijke zorgplan** — één per mens, met een categorie per aandachtsgebied |
| `PlanDefinition` / `ActivityDefinition` | Het geïntegreerde protocol: zorgmodules en monitoritems |
| `Task` | Werkvoorraad: oproep, controle, uitslag beoordelen, terugbelverzoek |
| `Questionnaire` / `QuestionnaireResponse` | Vragenlijsten met logica en triggers |
| `Appointment` / `Schedule` / `Slot` | Agenda |
| `MedicationRequest` / `MedicationStatement` | Medicatie |
| `Goal` | Persoonlijke doelen (positieve gezondheid / eigen regie) |
| `Group` | Populatie/cohort van een aandachtsgebied of keten |
| `Provenance` / `AuditEvent` | Herkomst en logging |
| `Flag` | Ruiters/attenties |

## 5. Technologiekeuzes en motivatie

| Keuze | Motivatie | Alternatief afgewogen |
| --- | --- | --- |
| TypeScript end-to-end | Één taal en één typemodel van DB-projectie tot UI; FHIR-typen deelbaar | Java/HAPI-FHIR: rijper voor FHIR, zwaarder en trager iteratief |
| PostgreSQL + JSONB | Document-flexibiliteit van FHIR mét relationele indexen en transacties | MongoDB (geen transacties over episodes), triplestore (te traag) |
| Fastify | Lage overhead, schema-validatie ingebouwd | Express (trager, minder validatie) |
| React + Vite | Grootste talentpool in NL-zorg-IT, snelle dev-loop | Svelte/Solid: technisch fijner, kleiner ecosysteem |
| Geen ORM op de FHIR-laag | De resource ís het document; een ORM vecht daar tegen | Prisma (wel voor de smalle projectietabellen) |

Deze repo start met een in-memory repository achter dezelfde interface als de
Postgres-implementatie, zodat de vertical slice draait zonder infrastructuur en de
domeinlogica los van de opslag getest kan worden.

## 6. Modulegrenzen

```
packages/fhir-model   — FHIR R4-typen (subset), NL-profielextensies, dossier-views
packages/terminology  — CodeSystems, referentieset, ICPC↔SNOMED mapping, zoeken
packages/care-engine  — het protocol, instroom, zorgplan, beslisondersteuning, vragenlijsten
apps/api              — FHIR-facade + BFF + seed
apps/web              — werkplekken
```

Regels:
- `terminology` kent `fhir-model`, niet andersom.
- `care-engine` kent beide, maar bevat géén HTTP en géén opslag.
- `apps/*` bevatten geen klinische regels.
