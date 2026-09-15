# 04 — Zorgprogramma's, inclusie en het integrale zorgplan

## 1. Casefinding en inclusie zonder Excel

**Nu:** datadump uit het HIS → Excel → POH loopt regels langs → includeert → registreert
terug → declaratie. Doorlooptijd: dagen. Foutgevoelig. Niet reproduceerbaar.

**Straks:** de inclusiecriteria zijn machine-leesbare regels over het dossier zelf.

```ts
const dm2: Zorgprogramma = {
  id: 'dm2',
  naam: 'Diabetes mellitus type 2',
  inclusie: alle([
    heeftActieveEpisode(['T90.02']),
    ofwel([ minimaleLeeftijd(18) ]),
  ]),
  exclusie: enigeVan([
    heeftActieveEpisode(['T89']),              // DM type 1 → andere keten
    heeftMarkering('behandeld-elders'),
    heeftMarkering('palliatief'),
  ]),
  // ...
}
```

De motor levert per kandidaat:

- **status**: `kandidaat` / `geïncludeerd` / `uitgesloten` / `afgewezen`
- **onderbouwing**: welke criteria raakten, met de concrete dossiergegevens erbij
- **actie**: één klik → episode aangemaakt/gekoppeld, zorgplan bijgewerkt,
  declaratiegebeurtenis vastgelegd, oproepritme gestart

En, minstens zo belangrijk: **de motor draait continu**. Een patiënt die vandaag aan de
criteria gaat voldoen, staat morgen op de lijst. Niemand hoeft een dump te vragen.

## 2. Waarom drie zorgpaden nu drie keer werk zijn

Een patiënt met DM2, hypertensie en COPD komt in de huidige inrichting drie keer per
jaar langs voor DM2, drie keer voor CVRM en twee keer voor COPD. Acht contacten. Elk
met een eigen protocol, een eigen oproep, een eigen registratieset — en grotendeels
dezelfde metingen.

Dat is niet alleen inefficiënt; het is slechte zorg. De patiënt ervaart drie ziektes in
plaats van één leven, en niemand kijkt naar het geheel.

## 3. De samenvoeglogica

Het integrale zorgplan voegt samen op drie niveaus:

### 3.1 Metingen
Elke protocolactiviteit declareert welke `Observation`-codes hij nodig heeft en hoe
"vers" die moeten zijn. Overlappende eisen worden één meting.

```
DM2  : HbA1c (≤3 mnd), RR (≤3 mnd), gewicht (≤3 mnd), eGFR (≤12 mnd), voet (≤12 mnd), funduscopie (≤24 mnd)
CVRM : RR (≤3 mnd), LDL (≤12 mnd), eGFR (≤12 mnd), roken (≤12 mnd), gewicht (≤12 mnd)
COPD : spirometrie (≤12 mnd), CCQ (≤6 mnd), roken (≤12 mnd), gewicht (≤12 mnd)
                                   ↓ samenvoegen
Contact Q1 : HbA1c, RR, gewicht, CCQ, roken         (dekt DM2 + CVRM + COPD)
Contact Q2 : HbA1c, RR
Jaarcontrole: + eGFR, LDL, spirometrie, voetonderzoek
```

### 3.2 Contactmomenten
Activiteiten die binnen een instelbaar venster (standaard 6 weken) vallen, worden
samengevoegd tot één afspraak met een berekende duur. Acht contacten worden er drie tot
vier — en die zijn inhoudelijk vollediger dan de acht losse.

### 3.3 Beoordeling
Er is één integrale beoordeling per contact, geen drie protocollen achter elkaar. De
zorgverlener ziet per programma de stand van zaken, maar registreert één keer.

## 4. Persoonsgericht: intensiteit als expliciete knop

Protocol is een startpunt, geen dwangbuis. Het zorgplan kent een `intensiteit` die de
POH tijdens het consult mag wijzigen — dit is de processtap *Zorgpad (inzetten/wijzigen)*
uit `docs/12`.

| Intensiteit | Betekenis | Effect op planning |
| --- | --- | --- |
| `extensief` | stabiel, weinig risico, patiënt wil rust | 1× per jaar, rest via monitoring |
| `basis` | protocol volgen | volgens richtlijn |
| `intensief` | ontregeld, recente wijziging, hoog risico | frequenter, korter interval |
| `eigen-regie` | patiënt monitort zelf, meldt zich bij afwijking | geen oproep, wel bewaking op uitblijven |
| `palliatief` | streefwaarden vervallen, comfort leidend | protocol uit, alleen wat de patiënt wil |

Elke wijziging legt reden en auteur vast. Elke wijziging heeft direct gevolg voor
oproep, jaarplanning en indicatoren — geen parallelle administratie.

Belangrijk: afwijken van het protocol is een **geregistreerde, verantwoorde keuze**, geen
ontbrekende registratie. Dat is precies het verschil dat indicatorensystemen nu niet
kunnen maken, waardoor persoonsgerichte zorg als "niet-compliant" wordt gescoord.

## 5. Oproepproces

De jaarplanning van het zorgplan genereert `Task`s van categorie `oproep`. Per patiënt
kiest het systeem het kanaal op basis van voorkeur en eerdere respons:

```
oproep gepland
  ├─ portaal-bericht + zelf inplannen      (voorkeur, hoogste respons)
  ├─ sms met plan-link
  ├─ e-mail
  └─ terugbelverzoek voor de assistent      (alleen als digitaal niet kan/werkt)
```

Geen respons na *n* dagen → automatische herinnering → daarna pas een mens. Uitblijvende
respons is geen stilte maar een werkitem met reden: dat is de functie *Monitoring
uitval* uit `docs/11`.

## 6. Protocoldefinitie als data, niet als code

Zorgprogramma's zijn `PlanDefinition`-achtige documenten die door een functioneel
beheerder (niet door een programmeur) worden onderhouden en versioneerbaar zijn:

```ts
interface Zorgprogramma {
  id: string
  naam: string
  versie: string
  richtlijn: { naam: string; url?: string; versie: string }   // NHG-standaard
  inclusie: Criterium
  exclusie: Criterium
  activiteiten: ProtocolActiviteit[]
  indicatoren: Indicator[]
  declaratie?: { keten: string; prestatiecode?: string }
}
```

Versionering is niet-onderhandelbaar: als de NHG-standaard wijzigt, moet je kunnen
terugzien onder welke versie een patiënt destijds is behandeld. Dat is
verantwoordingsplicht én, zodra er beslissingsondersteuning in zit, MDR-plicht.

## 7. Wat hiervan in de repo zit

`packages/care-engine` implementeert:

- `criteria.ts` — de regel-DSL voor inclusie/exclusie
- `zorgprogramma.ts` — het protocoltype + drie echte programma's (DM2, CVRM, COPD)
- `inclusie.ts` — casefinding over een dossier, met onderbouwing
- `zorgplan.ts` — de samenvoegmotor (het hart)
- `oproep.ts` — planning en kanaalkeuze
- `vragenlijst.ts` — de motor uit `docs/06`
