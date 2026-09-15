# 05 — Rolgebonden werkplekken

Eén dossier, vier ingangen. De werkplek bepaalt wat je als eerste ziet en welke
volgende stap voor de hand ligt — niet wat er bestaat.

## 1. POH-Somatiek — de dag als werkeenheid

Dit is de rol waarop de eerste vertical slice is gebouwd.

### 1.1 Dagstart (het startscherm — niet "zoek een patiënt")

```
┌─ Vandaag, dinsdag 15 september ────────────────────────────────────────┐
│  8 afspraken · 3 vragen aandacht · 2 voorbereiding niet compleet       │
├────────────────────────────────────────────────────────────────────────┤
│ 09:00  A. de Vries (68)   DM2 + CVRM   ✓ voorbereid   HbA1c ↑ 71        │
│ 09:20  M. Jansen (54)     COPD         ⚠ CCQ ontbreekt                  │
│ 09:40  [monitoringblok]   6 patiënten in beeld                          │
│ ...                                                                     │
├─ Werkvoorraad ─────────────────────────────────────────────────────────┤
│  4 signalen uit monitoring    2 uitslagen te beoordelen                 │
│  3 oproepen zonder respons    1 autorisatie ingediend                   │
└────────────────────────────────────────────────────────────────────────┘
```

Per afspraak direct zichtbaar: welke zorgprogramma's spelen, of de voorbereiding
compleet is (vragenlijst ingevuld, lab binnen), en wat er afwijkt. Geen dossier openen
om te ontdekken dat het lab nog niet binnen is.

### 1.2 Monitoringblok
De groep patiënten die op afstand wordt gevolgd, gesorteerd op afwijking, niet op
alfabet. Per patiënt: het signaal, de trend, en drie tot vijf voorgestelde
vervolgacties (bericht sturen, lab aanvragen, afspraak inplannen, intensiteit
verhogen, niets doen met reden). Eén klik per patiënt, batchgewijs af te handelen.

### 1.3 Consult
Het dossier in de bekende driedeling (context / tijdlijn / structuur, zie `docs/10` §4),
maar met een vierde element: **de protocolkolom**. Die toont wat er voor déze patiënt
in dit contact gedaan moet worden, samengevoegd over alle zorgprogramma's, met wat al
binnen is afgevinkt. Registreren gebeurt in de protocolkolom; het journaal wordt
gevuld, niet andersom.

### 1.4 Dagafsluiting
Wat is er open: onvolledige registraties, niet-verstuurde berichten, ontbrekende
declaratiegegevens, openstaande autorisatieverzoeken. Met per item de reden en, waar
mogelijk, een afhandeling in bulk. Doel: de dag is aantoonbaar af, in minuten.

## 2. Doktersassistent

Startscherm is de **stroom**, niet de agenda: binnenkomende triages (digitaal én
telefonisch), terugbelverzoeken, herhaalrecepten, post en uitslagen die gerouteerd
moeten worden. Meerdere dossiers tegelijk open (overgenomen uit HealthConnected,
`docs/10` §4). Triage volgens één model, ongeacht kanaal (`docs/12` §2.2).

## 3. Huisarts

Startscherm is de **autorisatiestroom en het spreekuur**. Het autorisatiescherm is
bewust anders dan nu: geen lijst van 163 regels, maar gegroepeerd op type en risico,
met per groep de onderbouwing en veilige bulkafhandeling van het routinematige deel.
Wat een mens moet zien, staat bovenaan en is klein in aantal.

Verder: consultvoering, episodebeheer, medicatie, verwijzen, en het overzicht van wat
het team heeft gedaan — met herkomst zichtbaar.

## 4. Patiënt

Portaal/app conform MedMij. Ingang is niet het dossier maar **de volgende stap**:
wat moet ik doen, wanneer zie ik wie, wat waren mijn waarden, wat zijn mijn doelen.
Vragenlijsten, thuismetingen, herhaalmedicatie, berichten, zelfzorgadvies.

## 5. Gedeelde ontwerpprincipes

1. **Het systeem opent met werk, niet met een zoekveld.**
2. **Elke lijst heeft een reden per regel.** Nooit een teller zonder context.
3. **Elke regel heeft een voorgestelde volgende stap.** Afwijken mag, met reden.
4. **Registreren gebeurt in de flow van het werk**, niet in een apart formulier achteraf.
5. **Hoge informatiedichtheid.** Zorgverleners willen overzicht in één blik, geen
   consumenten-UI met veel witruimte (bevestigd door alle drie de bestaande systemen).
6. **Herkomst is altijd zichtbaar** — wie, wanneer, mens of AI, bevestigd of niet.
7. **Toetsenbord eerst.** Elke veelgebruikte actie heeft een sneltoets; muis is optioneel.
