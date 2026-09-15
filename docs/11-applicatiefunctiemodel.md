# 11 — Applicatiefunctiemodel

Bron: *Applicatiefunctiemodel Huisartsenzorg* — Amsterdamse Huisartsenalliantie (AHA),
aangeleverd door de opdrachtgever.

Wij nemen dit model over als **canonieke functiedecompositie** van het systeem. Reden:
het is sectoreigen, het is door huisartsen zelf opgesteld, en het dekt het domein
vollediger dan wat wij van scratch zouden bedenken. Elke module in deze repo verwijst
naar de functies die hij realiseert; een functie zonder module is een gat in de roadmap.

> **Aanname ter bevestiging.** In de plaat zijn functies groen of oranje gekleurd. Wij
> lezen oranje als *"nu niet of onvoldoende ondersteund"*. Als die lezing klopt, is het
> oranje cluster vrijwel één-op-één de scope van dit project. Graag bevestigen.

## 1. Het functiemodel

### F1 — Sturing
| Functie | Status |
| --- | --- |
| F1.1 Overzicht/samenvatting medicatie | bestaand |
| F1.2 Overzicht/samenvatting openstaande zaken | bestaand |
| F1.3 Overzicht/samenvatting medische samenvatting | bestaand |
| F1.4 Overzicht/samenvatting uitwisseling | bestaand |
| F1.5 Protocollaire zorg | bestaand |
| **F1.6 Extracties HIS** | **gat** |
| **F1.7 Dashboards & rapportages** | **gat** |

### F2 — Huisartsenzorg

**F2.1 Samenwerking** — Communicatie · Correspondentie · Overdrachten naar HAP ·
Preventie · Berichten · Verwijzingen · Multidisciplinair behandelplan · Communicatie met
de patiënt

**F2.2 Patiëntenportaal** — Online afspraken · **Herhaalrecepten** · **Inzage zorgpad** ·
**Inzage dossier** · Digitaal consult · Zelfmetingen · **Vragenlijsten**

**F2.3 Educatie & informatie** — **Patiëntvoorlichting** · Ontsluiting bronnen · **Beheer**

**F2.4 Zelfmanagement** — *(in de bron leeg gelaten: functie erkend, invulling ontbreekt)*

**F2.5 Telemonitoring** — Thuismetingen

**F2.6 Triage** (stedelijke triage, buiten de systeemgrens getekend) —
**Toeleiding en medische triage**

**F2.7 Consultvoorbereiding** — Persoonsgegevens · Patiëntenadministratie ·
Contactpersonen · Betrokkenen · **Consultvoorbereidende vragenlijst**

**F2.8 Consultatie** — Episodes · Immuunstatus · SOEP · Sociale gegevens · Deelcontacten ·
Familie-anamnese · Individueel zorgplan · Contra-indicaties en overgevoeligheden ·
Behandelgrenzen · Overige gevoeligheden

**F2.9 Behandeling** — Behandelingen · Medicatie · Taken · Profylaxe en voorzorg

**F2.10 Aanvullend onderzoek** — Diagnostiek · Lab · Vragenlijst t.b.v. verwijzing

**F2.11 Zorgondersteuning** — Agenda · Preventie-organisatie · Persoonlijke aantekeningen ·
Overzicht concept-items · **Selectie casefinding** · **Workflow zorgpaden** ·
Centrale diensten · **Inclusie ketenzorg** · Consultondersteuning · Medicatievoorstellen ·
Taakmanagement · Communicatie met patiënten · **Monitoring uitval** ·
**Inzage protocollen** · **Oproepsystemen**

### F3 — Onderzoek
Queries · Dossiers met leesbare informatie

### F4 — Bedrijfsondersteuning
Relatiebeheer · Facturering · Printen · Toegangslog · Wijzigingslog ·
**Integratie/koppelingen** · Systeeminstellingen · Systeembeheerderadministratie ·
Autorisatie · Medewerkersadministratie · Tabellen en keuzelijsten

## 2. Het oranje cluster is de opdracht

Zet je de als gat gemarkeerde functies op een rij, dan staat daar de projectdefinitie:

| Functie | Wat er nu gebeurt | Wat het moet worden |
| --- | --- | --- |
| Selectie casefinding | Datadump → Excel | Regels over het dossier, live kandidatenlijst met onderbouwing |
| Inclusie ketenzorg | Handmatig aan/uitvinken, terugregistreren | Eén klik: episode + zorgplan + declaratie + oproepritme |
| Workflow zorgpaden | Bestaat niet; protocol is een sjabloon | Uitvoerbare `PlanDefinition` die taken en afspraken genereert |
| Oproepsystemen | Excel + bellen | Automatische oproepplanning, kanaalkeuze, opvolging |
| Monitoring uitval | Onzichtbaar tot de indicator rood is | No-show/uitval als eigen werkvoorraad met reden en actie |
| Consultvoorbereidende vragenlijst | Achteraf tekst in journaal | Vóór het consult, gestructureerd, met signalering |
| Toeleiding en medische triage | Buiten het systeem (telefoon/losse tool) | Eén triage-model, digitaal én via assistent |
| Vragenlijsten (portaal) | PDF of losse tool | Motor met logica, triggers en terugkoppeling |
| Inzage zorgpad / dossier (portaal) | Beperkt of afwezig | Patiënt ziet zijn plan, zijn doelen, zijn volgende stap |
| Herhaalrecepten (portaal) | Los proces | `MedicationRequest` (proposal) → autorisatiestroom |
| Extracties / dashboards | Leverancierafhankelijk, traag | Populatie-as van de database (zie `docs/01` §2) |
| Integratie/koppelingen | Maatwerk per partij | FHIR-facade: elke koppeling is dezelfde API |

Dat is geen toeval. Het oranje cluster is precies de laag die ontstaat als je van
*dossiervoering* naar *zorgproces* gaat. De bestaande HIS'en zijn dossiersystemen; de
ontbrekende functies zijn procesfuncties.

## 3. Aanvullingen op het AHA-model

Het model is geschreven vanuit de huisartsenpraktijk als geheel. Voor onze doelstelling
missen er vier dingen, die wij expliciet toevoegen:

| Toevoeging | Waarom |
| --- | --- |
| **F5 Terminologie** — referentieset, mapping ICPC↔SNOMED, validatie, ontvangst van externe codes | Het AHA-model behandelt codering impliciet. Zonder eigen terminologielaag is domeinoverstijgende uitwisseling niet mogelijk (`docs/02`) |
| **F6 Herkomst & bewijsvoering** — `Provenance` op elke registratie, AI-suggestie vs. bevestiging | Voorwaarde voor AI-ondersteuning én voor MDR-verantwoording (`docs/07`) |
| **F7 Beslissingsondersteuning** — regels, versionering, overrule met reden | In het model zit alleen "Consultondersteuning" en "Medicatievoorstellen"; wij maken er een eigen, verantwoorde laag van |
| **F8 Rolgebonden werkplek** — dagstart, werkvoorraad, dagafsluiting per rol | Het model is functiegericht, niet rolgericht. De POH-S komt er niet in voor (`docs/05`) |

## 4. Prioritering voor v1

Wat we eerst bouwen, en waarom:

| Sprintblok | Functies | Motivatie |
| --- | --- | --- |
| **A. Fundament** | F5 terminologie, F2.8 consultatie (episodes, SOEP, deelcontacten), F6 herkomst | Zonder correcte registratie en codering is de rest lucht |
| **B. Het bewijs** | Selectie casefinding, Inclusie ketenzorg, Workflow zorgpaden, Individueel zorgplan | Dit is de grootste pijn en de best aantoonbare winst |
| **C. De lus sluiten** | Vragenlijsten + triggers, Oproepsystemen, Monitoring (uitval + thuismetingen), portaal-inzage | Hiermee wordt het systeem procesdragend in plaats van registrerend |
| **D. Praktijk compleet** | F2.9 behandeling, medicatie + bewaking, F2.1 samenwerking, F4 autorisatie/logging | Nodig om echt een HIS te zijn in plaats van een module |
| **E. Sturing** | F1.6/F1.7 extracties en dashboards, F3 onderzoek | Volgt vanzelf uit de populatie-as als het datamodel klopt |

Blok A en B vormen de vertical slice in deze repo.
