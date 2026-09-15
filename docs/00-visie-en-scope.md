# 00 — Visie en scope

## 1. Het probleem

De huidige generatie huisartsinformatiesystemen (HIS'en) is conceptueel gebouwd rond een
praktijkmodel dat niet meer bestaat:

| Aanname in het huidige HIS | Werkelijkheid in 2026 |
| --- | --- |
| De huisarts is de enige registrerende zorgverlener | POH-S, POH-GGZ, POH-Jeugd, doktersassistent, apotheker, diëtist, casemanager registreren allemaal |
| Een consult is een los, episodisch moment | Chronische zorg is een doorlopend proces met monitoring tussen consulten door |
| Eén patiënt heeft één probleem tegelijk | Multimorbiditeit is de norm; 3 zorgprogramma's = 3 losse oproepen |
| Selectie en oproep gebeurt buiten het systeem | Datadump → Excel → handmatig bellen → handmatig terugregistreren |
| Een vragenlijst is een formulier | Een vragenlijst is een beslisboom die zorgprocessen aanstuurt |
| Uitwisseling is een bijzaak (LSP/edifact) | Domeinoverstijgende uitwisseling is een wettelijke plicht (Wegiz, EHDS) |

Het gevolg is meetbaar: meer dan de helft van de werktijd van een POH gaat op aan
administratie en logistiek in plaats van zorg. Terwijl de zorgvraag stijgt en het
aantal handen daalt.

In de tweede lijn zijn dit soort systemen wél procesmatig ingericht: je wordt als
zorgverlener stap voor stap meegenomen. In de eerste lijn ontbreekt dat.

## 2. Wat we bouwen

Een **FHIR-native, procesgedreven informatiesysteem voor de eerste lijn** waarin:

1. **Het team het uitgangspunt is**, niet de solo-huisarts. Elke rol (huisarts,
   doktersassistent, POH-S, POH-GGZ) heeft een eigen werkplek op hetzelfde dossier,
   met eigen taken, eigen autorisaties en zichtbare herkomst van registraties.
2. **Terminologie een eerste-klas laag is.** ICPC-1 NL blijft de registratietaal van
   vandaag; SNOMED CT is de betekenislaag van morgen. Beide staan naast elkaar met
   een expliciete mapping, en er is een hard onderscheid tussen de
   **huisartsen-referentieset** (wat je mag registreren) en de rest van SNOMED CT
   (~385.000 concepten die je van buiten kunt ontvangen en moet kúnnen tonen, maar
   niet in hetzelfde registratieformaat).
3. **Inclusie in zorgprogramma's uit het dossier zelf komt.** Geen datadump, geen
   Excel. De inclusiecriteria zijn machine-leesbare regels over het dossier; het
   systeem levert kandidaten, onderbouwing en een één-klik-inclusie met
   declaratiegevolgen.
4. **Multimorbiditeit leidt tot één plan.** Een patiënt met DM2 + CVRM + COPD krijgt
   niet drie protocollen naast elkaar maar één geïntegreerd, persoonsgericht
   zorgplan waarin overlappende controles worden samengevoegd en de intensiteit op
   de persoon wordt afgestemd.
5. **Vragenlijsten motoren zijn, geen formulieren.** Een antwoord kan een
   vervolgvraag openen, een protocol starten, een taak aanmaken, de zorgverlener
   notificeren, zelfzorgadvies naar de patiënt sturen of de controlefrequentie
   bijstellen — aan zorgverlenerskant én in het patiëntportaal/app.
6. **Beslissingsondersteuning expliciet en traceerbaar is.** We lopen de
   MDR-route niet weg: adviezen zijn versioneerbaar, herleidbaar naar richtlijn en
   invoergegevens, en altijd overrulebaar door een mens met vastlegging van reden.
7. **Alles een API heeft.** Het systeem is zijn eigen integratiepartner. AI-componenten
   (spraak naar SOEP, automatische codering, samenvatting) zijn plugins op dezelfde
   API's die externe partijen gebruiken — geen achterdeur.

## 3. Wat we expliciet níet bouwen (nu)

- Geen eigen terminologieserver-distributie: we consumeren de officiële NHG-tabellen
  en de Nictiz/SNOMED NL-release. We bouwen de *laag* die ermee werkt.
- Geen eigen identity provider: aansluiten op UZI/DigiD/eHerkenning via bestaande brokers.
- Geen tweedelijns-EPD-functionaliteit (OK-planning, klinische opname).
- Geen declaratie-/boekhoudsysteem: wel de declaratie-*gebeurtenissen* correct en
  compleet vastleggen en exporteren (Vektis/ketenzorg).

## 4. Meetbare doelen van v1

| Doel | Nulmeting (huidige praktijk) | Streefwaarde |
| --- | --- | --- |
| Tijd per POH-consult aan administratie | ~50% van de werktijd | < 20% |
| Doorlooptijd inclusie chronische patiënt | dagen (dump → Excel → terugregistratie) | < 2 minuten, in-dossier |
| Consulten per jaar bij DM2+CVRM+COPD | tot 9 losse contacten | 3–4 geïntegreerde contacten |
| Handmatige oproepacties per kwartaal | honderden | 0 (uitzonderingen daargelaten) |
| Herkomst van een gecodeerde diagnose | onnavolgbaar | 100% traceerbaar (wie/wanneer/hoe/AI-suggestie ja-nee) |

## 5. Uitgangspunten (niet onderhandelbaar)

1. **FHIR R4 als intern datamodel**, niet als exportformaat achteraf. Nederlandse
   profielen (nl-core / zibs) zijn de basis; afwijkingen zijn expliciete extensies
   met documentatie.
2. **Geen registratie zonder herkomst.** Elke klinische registratie draagt: auteur,
   rol, tijdstip, bron (mens/AI/extern systeem), en bij AI de confidence en of een
   mens heeft bevestigd.
3. **De patiënt is deelnemer, geen object.** Wat de patiënt invult is een
   eerste-klas bron in het dossier, herkenbaar als patiëntgerapporteerd.
4. **Snelheid is een functionele eis.** Dossier openen < 300 ms, zoeken in
   terminologie < 100 ms, dagoverzicht < 500 ms. Zo niet, dan wordt het systeem
   omzeild.
5. **Uitwisseling volgens de standaard of niet.** Geen eigen berichtformaten waar
   een profiel bestaat.

## 6. Doelgroepen en rollen in scope voor v1

- **Huisarts** — consultvoering, episodebeheer, autoriseren, medicatie, verwijzen.
- **Doktersassistent** — triage, agenda, telefonie, uitslagen, herhaalrecepten.
- **POH-Somatiek** — chronische zorg: inclusie, jaarplanning, consult, monitoring op
  afstand, dagafsluiting. *Dit is de rol waarop de eerste vertical slice is gebouwd,
  omdat hier de pijn het grootst en de winst het duidelijkst is.*
- **Patiënt** — portaal/app: vragenlijsten, metingen, plan inzien, berichten.

POH-GGZ, praktijkmanager en waarneming volgen in v2.
