# 12 — Procesmodel (swimlanes)

Bron: procesplaat van de opdrachtgever. Dit is het **doelproces** dat het systeem moet
ondersteunen — niet als plaatje aan de muur, maar als uitvoerbare definitie
(`PlanDefinition` + `Task`-stromen, zie `docs/04`).

## 1. De vier banen

```
┌─ POH-S ───────────────────── label in de bron: "HIS / KIS / ?" ───────────┐
│  Oproepen → Afspraak inplannen POH → Consult POH | E-consult POH          │
│      → Behandeling | Diagnostiek                                          │
│           → Verwijzing · Zorgpad (inzetten/wijzigen) · Advies · Monitoring │
│      → Herhaalconsult                                            ─────────┼──> EXTERN: Telemonitoring
├─ PATIËNT (portaal) ───────────────────────────────────────────────────────┤
│  Start op website, wordt direct doorgeleid → Logt in op portaal           │
│      → Doorloopt triage → online zelfzorgadvies  |  plant zelf afspraak   │
│                              → Consultvoorbereidende vragenlijst          │
│  Belt voor afspraak → Doorverwijzing naar assistent                       │
│  Doorlopend: Vragenlijsten · Thuismetingen · Herhaalmedicatie aanvragen   │
├─ HUISARTS (HIS) ──────────────────────────────────────────────────────────┤
│  Assistent trieert zorgvraag → Afspraak inplannen HA                      │
│      → Consult HA | E-consult HA → Behandeling | Diagnostiek              │
│           → Expectatief beleid/advies · Medicatie → Apotheek              │
│           · Verwijzing → Externe behandelaar · Kleine verrichting          │
│      → Herhaalconsult                                                     │
└───────────────────────────────────────────────────────────────────────────┘
```

## 2. Wat dit model zegt — en wat het ontmaskert

### 2.1 Het vraagteken bij "HIS / KIS / ?" is de kern van het probleem
De baan van de POH-S is de enige zonder eenduidig systeem. In de praktijk staat de
chronische zorg deels in het HIS (journaal, episodes, medicatie), deels in een KIS
(zorgprogramma, indicatoren, ketenDBC), deels in een telemonitoringportaal en deels in
Excel (inclusie en oproep). Elke overgang tussen die vier is een handmatige actie met
dubbele registratie en verlies van context.

**Ontwerpconsequentie:** er is geen HIS/KIS-scheiding in dit systeem. Zorgprogramma's,
inclusie, indicatoren en oproep zijn functies ván het dossier, niet van een satelliet.
Alleen `Telemonitoring` blijft bewust extern (rode baan) — dat is een markt met veel
leveranciers en apparaten; wij consumeren die via FHIR/`Device` + `Observation`.

### 2.2 Het proces begint buiten het systeem
De patiëntbaan start bij *"Patiënt start bij website, wordt direct doorgeleid"*. Het
eerste contactmoment is dus digitale triage, niet de telefoon. Twee routes lopen samen:

| Route | Ingang | Uitkomst |
| --- | --- | --- |
| Digitaal | website → portaal → triage | zelfzorgadvies **óf** zelf afspraak plannen |
| Telefonisch | patiënt belt | doorverwijzing naar assistent → assistent trieert |

Beide routes monden uit in dezelfde gestructureerde **zorgvraag** met triage-uitkomst,
urgentie en voorgestelde bestemming (zelfzorg / assistent / POH / huisarts / spoed).
Dat betekent: één triage-model, twee invoerkanalen. Niet twee losse systemen.

### 2.3 De consultvoorbereidende vragenlijst zit vóór het consult, niet erna
In de plaat staat `Consultvoorbereidende vragenlijst` tussen het plannen van de afspraak
en het consult zelf — bij zowel de POH- als de huisartsroute. Dat is precies waar
bestaande systemen het laten liggen (zie `docs/10`, §3.4): de lijst wordt achteraf als
losse tekst in het journaal geplakt.

**Ontwerpconsequentie:** het plannen van een afspraak triggert automatisch de bij dat
afspraaktype horende `Questionnaire`; het antwoord landt gestructureerd in het dossier
en verschijnt vóór het consult in de voorbereiding van de zorgverlener, mét signalering
van afwijkingen ten opzichte van de vorige meting.

### 2.4 Monitoring is een eigen processtap met eigen invoer
`Monitoring` in de POH-baan wordt gevoed door `Vragenlijsten` en `Thuismetingen` uit de
patiëntbaan en door `Telemonitoring` van buiten. Het is geen afgeleide van een consult;
het is een doorlopende toestand tussen consulten in. Dit is de stap die in geen enkel
bestaand HIS bestaat.

**Ontwerpconsequentie:** monitoring is een eigen werkplekonderdeel (het monitoringcohort
van de POH) met een eigen werkvoorraad, eigen signaleringsregels en eigen
vervolgacties — niet een lijstje metingen onder een patiënt.

### 2.5 "Zorgpad (inzetten / wijzigen)" is een behandeluitkomst
Naast verwijzing, advies en monitoring staat het aanpassen van het zorgpad als
gelijkwaardige uitkomst van de behandelstap. Dat is de operationalisering van
persoonsgerichte zorg: de POH mag ter plekke besluiten *ik zie je vaker*, *ik zie je
minder vaak*, *we gaan monitoren in plaats van oproepen*, en dat moet één handeling
zijn met gevolgen voor planning, oproep en indicatoren.

**Ontwerpconsequentie:** intensiteit is een expliciet, wijzigbaar veld op het zorgplan,
met vastlegging van reden en effect op de jaarplanning. Niet een protocol dat je moet
omzeilen.

### 2.6 De uitkomsten van POH en huisarts overlappen grotendeels
Beide banen eindigen in dezelfde set: behandeling, diagnostiek, verwijzing, advies,
medicatie, herhaalconsult. Het verschil zit in **bevoegdheid** en **context**, niet in
het proces.

**Ontwerpconsequentie:** één set uitvoerbare vervolgacties, met autorisatieregels per
rol. Waar de POH niet zelfstandig mag beslissen (bijv. medicatiewijziging) genereert de
actie een autorisatieverzoek aan de huisarts in plaats van een blokkade — met context,
zodat de huisarts in seconden kan tekenen in plaats van 163 regels te moeten uitzoeken.

## 3. Van plaat naar uitvoerbaar model

Elke doos in de plaat krijgt een technische representatie:

| Processtap | Representatie |
| --- | --- |
| Oproepen | `Task` (categorie `oproep`), gegenereerd door de jaarplanning van het zorgplan |
| Afspraak inplannen | `Appointment` + `Slot`, afspraaktype bepaalt duur, rol en vragenlijst |
| Consult / E-consult | `Encounter` (class: AMB / VR) + `Composition` (SOEP-deelcontact) |
| Behandeling / Diagnostiek | `Procedure`, `ServiceRequest`, `Observation` |
| Verwijzing | `ServiceRequest` + `Task` naar externe behandelaar |
| Zorgpad inzetten/wijzigen | mutatie op `CarePlan` (intensiteit, programma's) + `Provenance` |
| Advies / Expectatief beleid | `CommunicationRequest` naar portaal + `CarePlan.activity` |
| Monitoring | `CarePlan.activity` met `Questionnaire`- en `Device`-koppeling |
| Thuismetingen / Telemonitoring | `Observation` met `Device`-bron, patiëntgerapporteerd |
| Vragenlijsten | `Questionnaire` / `QuestionnaireResponse` + regels (`docs/06`) |
| Herhaalmedicatie via portaal | `MedicationRequest` (intent: `proposal`) → autorisatie |
| Triage (digitaal én assistent) | `Questionnaire` + triage-uitkomst → `Task` / `Appointment` |
| Herhaalconsult | `Appointment` gegenereerd vanuit consultafsluiting |

Deze tabel is de brug tussen `docs/12` (proces), `docs/11` (functies) en `docs/03`
(datamodel). Een processtap die hier niet in staat, bestaat niet in het systeem.
