# 03 — Datamodel

## 1. De episode is de ruggengraat

Het Nederlandse huisartsendossier is episodegeoriënteerd. Dat is geen implementatiedetail
maar de kern van hoe huisartsen denken: een episode is de rode draad door de tijd van één
gezondheidsprobleem, met daaraan gekoppeld contacten, medicatie, uitslagen en brieven.

```
Patient
 └── EpisodeOfCare            "Diabetes mellitus type 2, gestart 2019-03-11, actief"
      ├── Condition           gecodeerd probleem (ICPC + SNOMED), status, zekerheid
      ├── Encounter[]         contacten die aan deze episode raken
      │    └── Composition    het deelcontact: S / O / E / P
      ├── Observation[]       metingen binnen deze episode (HbA1c, RR, eGFR)
      ├── MedicationRequest[] medicatie gekoppeld aan deze episode
      ├── CarePlan-activity   de monitoritems die op deze episode slaan
      └── DocumentReference[] brieven, uitslagen
```

**Harde regel:** elke klinische registratie draagt een `episode_id`, of een expliciete
markering `geen-episode` met reden. Dit is wat de tweede as van de database mogelijk
maakt (zie `docs/01` §2) en wat het verschil maakt tussen een dossier dat je kunt lezen
en een tijdlijn waar je doorheen moet scrollen.

## 2. Deelcontact en SOEP

Eén `Encounter` (contact) kan meerdere **deelcontacten** hebben — de huisarts ziet in
één consult twee problemen. Elk deelcontact hangt aan één episode en bevat de
SOEP-regels.

```ts
interface Deelcontact {
  encounterId: string
  episodeId: string
  subjectief: SoepRegel[]     // klacht in de woorden van de patiënt
  objectief:  SoepRegel[]     // bevindingen, metingen (gecodeerd waar mogelijk)
  evaluatie:  SoepRegel[]     // werkhypothese / diagnose (gecodeerd)
  plan:       SoepRegel[]     // beleid, acties
  auteur:     ZorgverlenerRef
  rol:        'huisarts' | 'poh-s' | 'poh-ggz' | 'assistent' | 'waarnemer'
  herkomst:   Provenance
}
```

Dit realiseert twee eisen tegelijk: de POH registreert in dezelfde episode als de
huisarts (geen parallelle administratie), én het blijft zichtbaar wie wat heeft
vastgelegd. In de UI: de POH ziet het hele dossier, maar haar eigen regels zijn
herkenbaar gemarkeerd, en de huisarts ziet in één oogopslag wat de POH heeft gedaan.

## 3. Herkomst is verplicht

```ts
interface Provenance {
  bron: 'zorgverlener' | 'patient' | 'ai-suggestie' | 'extern-systeem' | 'apparaat'
  vastgelegdOp: string          // ISO 8601
  auteurId: string
  auteurRol: string
  systeem?: string              // bij extern: welk systeem, welke AGB/URA
  ai?: {
    model: string               // naam + versie
    vertrouwen: number          // 0..1
    bevestigdDoor?: string      // verplicht vóór klinisch gebruik
    bevestigdOp?: string
    origineleSuggestie?: unknown // wat het model voorstelde vóór correctie
  }
}
```

Een AI-suggestie die niet door een mens is bevestigd, is **niet** klinisch geldig:
hij telt niet mee in populatiequeries, niet in indicatoren en niet in uitwisseling.
Hij is zichtbaar als voorstel. Dit is tegelijk goede zorg en de basis van de
MDR-verantwoording (`docs/07`).

## 4. Meetwaarden

Meetwaarden volgen de NHG-tabel 45 (diagnostische bepalingen) met LOINC- en/of
SNOMED-codering. Ze worden dubbel opgeslagen:

1. als volledige `Observation` (FHIR, alles erin);
2. als rij in `observation_numeric` — smal, getypeerd, geïndexeerd — voor populatievragen.

```sql
create table observation_numeric (
  patient_id  uuid not null,
  code        text not null,       -- '4548-4' (HbA1c), '271649006' (RR systolisch)
  value       numeric not null,
  unit        text not null,
  effective_at timestamptz not null,
  episode_id  uuid,
  resource_id uuid not null,
  primary key (patient_id, code, effective_at)
);
create index on observation_numeric (code, effective_at desc, value);
```

Zonder deze projectie duurt "alle patiënten met HbA1c > 64 mmol/mol en geen controle in
6 maanden" seconden in plaats van milliseconden. Met acht aandachtsgebieden en een
dagstart die elke ochtend door 40 zorgverleners wordt geopend, is dat het verschil
tussen een werkend systeem en een omzeild systeem.

## 5. Het zorgplan

Er is **één** `CarePlan` per patiënt, opgebouwd uit aandachtsgebieden — niet uit
zorgprogramma's per aandoening. Dat is de belangrijkste modelkeuze van dit project
(ADR-0007).

```ts
interface IntegraalZorgplan {
  patientId: string
  programmas: ZorgprogrammaDeelname[]   // DM2, CVRM, COPD — elk met eigen status
  doelen: Doel[]                        // persoonlijke doelen, niet alleen streefwaarden
  activiteiten: GeplandeActiviteit[]    // SAMENGEVOEGD over programma's heen
  intensiteit: 'basis' | 'intensief' | 'extensief' | 'palliatief' | 'eigen-regie'
  hoofdbehandelaar: ZorgverlenerRef
  laatsteHerziening: string
  volgendeHerziening: string
}
```

`activiteiten` is samengevoegd: als DM2 een driemaandelijkse controle vraagt met RR en
CVRM ook een controle met RR, dan is dat één afspraak met één RR-meting die aan beide
programma's voldoet. De dedupliceerlogica staat in `packages/care-engine` en is het
inhoudelijke hart van dit project (`docs/04` §3).

## 6. Werkvoorraad: `Task`

Alles wat iemand moet doen is een `Task`, met een uniform model:

```ts
interface Werkitem {
  id: string
  categorie: 'oproep' | 'uitslag-beoordelen' | 'autorisatie' | 'terugbelverzoek'
           | 'vragenlijst-uitzetten' | 'signaal-monitoring' | 'administratief'
  prioriteit: 'routine' | 'urgent' | 'asap'
  patientId?: string
  episodeId?: string
  toegewezenAan: { rol: string; persoonId?: string }
  aanleiding: string             // waarom bestaat dit item — altijd invulbaar
  voorstel?: VoorgesteldeActie   // wat het systeem denkt dat je gaat doen
  vervaltOp?: string
  bron: 'protocol' | 'regel' | 'mens' | 'extern'
}
```

`aanleiding` en `voorstel` zijn het verschil met de bestaande systemen. Een teller van
163 openstaande autorisaties is geen werkvoorraad; 163 items met reden, context en een
voorgestelde actie waarvan er 140 veilig in bulk af te handelen zijn, wél.

## 7. Autorisatie op data-niveau

Rollen bepalen niet alleen wat je *ziet*, maar wat je *mag vastleggen en afronden*.

| Rol | Lezen | Registreren | Afronden zonder tweede paar ogen |
| --- | --- | --- | --- |
| Huisarts | volledig dossier | alles | alles |
| POH-S | volledig dossier | SOEP in eigen episodes, metingen, zorgplan, vragenlijsten | alles binnen protocol; medicatiewijziging → autorisatieverzoek |
| POH-GGZ | volledig dossier, GGZ-episodes volledig | idem binnen GGZ-domein | idem |
| Assistent | dossier m.u.v. afgeschermde episodes | triage, metingen, administratie | administratief; klinisch → autorisatie |
| Waarnemer | dossier, tijdgebonden | consultregistratie | beperkt |
| Patiënt | eigen dossier volgens MedMij + eigen plan | vragenlijsten, metingen, berichten | n.v.t. |

Afscherming van episodes (bijv. GGZ, seksuele gezondheid) volgt het NHG-model van
'afgeschermde episode', met doorbreking-met-vastlegging in noodsituaties.
