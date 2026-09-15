# 04 — Het geïntegreerde protocol

> Dit hoofdstuk is herschreven na ADR-0007. Waar eerder zorgprogramma's per aandoening
> stonden, staat nu één protocol opgebouwd uit aandachtsgebieden.

## 1. Waarom niet één protocol per aandoening

Een mens heeft zelden één probleem. Zodra de aandoening het organiserende principe van
het protocol wordt, volgt de rest onvermijdelijk:

- drie aandoeningen → drie protocollen → drie oproepen → drie consulten;
- een inclusiebesluit per programma, als administratief moment;
- registratie die per keten wordt gedacht ("dit doe ik voor de DM-keten");
- alles wat in geen enkele keten past — mentaal welbevinden, leefstijl,
  medicatieveiligheid, kwetsbaarheid — valt tussen wal en schip.

Achteraf samenvoegen verzacht dat, maar lost het niet op. Daarom is de bouwsteen hier
geen aandoening maar een **zorgmodule**: een aandachtsgebied.

## 2. De acht aandachtsgebieden

| Module | Waar het over gaat | Relevant wanneer |
| --- | --- | --- |
| **Glucoseregulatie** | Bloedsuiker en wat dat betekent | DM-episode, bloedglucoseverlagend middel, of HbA1c ooit ≥ 48 |
| **Hart- en vaatrisico** | Bloeddruk, cholesterol, risicoverlaging | HVZ, hypertensie, dyslipidemie, diabetes, nierschade, statine, of ≥ 50 jaar en rookt |
| **Nierfunctie** | Hoe de nieren het doen; bepaalt medicatieveiligheid | Nierschade, diabetes, hypertensie, of eGFR < 60 |
| **Ademhaling en longen** | Benauwdheid, hoesten, longaanvallen voorkomen | COPD, astma, of inhalatiemedicatie |
| **Leefstijl** | Roken, bewegen, voeding, gewicht | elke chronische zorgvraag |
| **Mentaal welbevinden** | Hoe het van binnen gaat, en wat iemand belangrijk vindt | elke chronische zorgvraag |
| **Medicatieveiligheid** | Kloppen alle middelen samen nog | ≥ 5 chronische middelen, of ≥ 75 jaar met ≥ 3, of eGFR < 45 |
| **Kwetsbaarheid** | Zelfredzaamheid en benodigde steun | ≥ 75 jaar met ≥ 2 chronische aandoeningen |

Let op de laatste vier. Die dekt geen enkele landelijke keten systematisch, en juist
daar zit een groot deel van de winst bij multimorbiditeit.

## 3. Drie lagen bepalen het plan

### Laag 1 — het protocol
Elke module heeft monitoritems met een basisinterval volgens richtlijn. Dat is het
vertrekpunt, niet de uitkomst.

### Laag 2 — de situatie van déze patiënt
Intervalregels passen dat interval aan op basis van de werkelijke waarden:

```
HbA1c        twee metingen onder 53          → ×2,0   halfjaarlijks volstaat
             boven 64                         → ×0,5   korter tot het beter is
Bloeddruk    twee metingen op streefwaarde   → ×2,0
             boven 160                        → ×0,5
eGFR         onder 45                         → ×0,5
             onder 30                         → ×0,25  en overleg met de huisarts
CCQ          drie metingen onder 1,0          → ×2,0
             boven 2,0                        → ×0,5
Rookstatus   patiënt rookt                    → ×0,5   actief bespreken
```

De voorzichtigste regel wint: een korter interval gaat vóór een langer. Niet het
ziektelabel maar de toestand bepaalt hoe vaak iemand gezien wordt.

### Laag 3 — de persoon
Wat de zorgverlener en de patiënt samen afspreken, overrulet laag 1 en 2:

| Keuze | Effect |
| --- | --- |
| Module handmatig uit | Valt uit het plan, met vastgelegde reden en auteur |
| Module handmatig aan | Wordt meegenomen ook zonder automatische grondslag |
| Eigen interval per meting | Absoluut, overrulet protocol én situatie |
| `maxContactenPerJaar` | Alle intervallen worden opgerekt tot het past — mét expliciete vermelding hoeveel later metingen daardoor komen |
| `liefstThuismeting` | Thuis meetbare items bepalen niet langer het bezoekritme |
| Intensiteit | `rustig` ×1,6 · `volgens plan` ×1,0 · `intensief` ×0,6 · `eigen regie` ×2,0 · `palliatief` protocol uit |

Elke afwijking is een **geregistreerde, verantwoorde keuze** — geen ontbrekende
registratie. Dat is precies het onderscheid dat indicatorensystemen nu niet maken,
waardoor persoonsgerichte zorg als non-compliant wordt gescoord.

## 4. Van items naar contacten

1. Alle relevante modules leveren hun monitoritems.
2. Items die in meerdere modules voorkomen worden samengevoegd tot één meting; het
   kortste interval wint. Een bloeddruk telt dan voor vaatrisico én glucoseregulatie.
3. Het bezoekritme volgt uit het kortste benodigde interval — je kunt niet minder vaak
   komen dan je vaakst benodigde meting.
4. Elk meetmoment wordt toegewezen aan het láátste bezoek dat nog vóór de vervaldatum
   valt. Zo verloopt er nooit iets, en ontstaan er geen halfvolle extra afspraken.

## 5. Instroom in plaats van inclusie

De vraag is niet langer "voldoet deze patiënt aan de inclusiecriteria van programma X",
maar: **welk aandachtsgebied is voor deze mens relevant geworden?** Dat is een
zorginhoudelijke vraag die in één zin te beantwoorden is, met de onderbouwing erbij.

De relevantieregels draaien continu over het dossier. Wie vandaag aan de criteria gaat
voldoen, staat morgen in beeld. Geen dump, geen Excel, geen inclusiebesluit als apart
administratief moment.

## 6. Ketenzorg blijft bestaan — als projectie

Declaratie, ketencontracten en indicatorenrapportage draaien in Nederland op programma's
per aandoening. Die werkelijkheid negeren betekent dat een praktijk haar financiering
breekt.

De koppeling gebeurt daarom automatisch en achteraf (`packages/care-engine/src/ketenkoppeling.ts`):

```
patiëntdossier ──► relevante modules ──► één plan ──► geleverde zorg
                                                          │
                                                          ▼
                                       ketenbijdragen: DM · CVRM · COPD · ouderenzorg
                                       grondslag · indicatoren · prestatiecode
```

Niemand registreert "voor de keten". Er wordt zorg geleverd, en het systeem leidt af
waar dat bewijs voor oplevert. In de werkplek staat dat onder **Verantwoording**,
bewust als achtergrondinformatie en niet als werkinstructie.

## 7. Oproepproces

De jaarplanning genereert `Task`s van categorie `oproep`. Kanaalkeuze volgt de voorkeur
van de patiënt en de eerdere respons:

```
oproep gepland
  ├─ portaalbericht + zelf inplannen      (voorkeur, hoogste respons)
  ├─ sms met plan-link
  ├─ e-mail
  └─ terugbelverzoek voor de assistent     (alleen als digitaal niet kan of werkt)
```

Geen respons na *n* dagen → automatische herinnering → daarna pas een mens. Uitblijvende
respons is geen stilte maar een werkitem met reden: de functie *Monitoring uitval* uit
het AHA-functiemodel (`docs/11`).

Bij `eigen regie` worden geen oproepen verstuurd, maar wordt wél bewaakt of metingen
uitblijven — eigen regie mag geen stilte worden.

## 8. Wat hiervan in de repo zit

```
packages/care-engine/src/
  criteria.ts            regel-DSL met leesbare onderbouwing
  protocol.ts            het geïntegreerde protocol: 8 modules, monitoritems, intervalregels
  ketenkoppeling.ts      projectie naar DM / CVRM / COPD / ouderenzorg
  zorgplan.ts            drie lagen → items → contacten (het hart)
  instroom.ts            casefinding op moduleniveau
  beslisondersteuning.ts klinische en logistieke regels (docs/13)
  oproep.ts              planning en kanaalkeuze
  vragenlijst.ts         de motor uit docs/06
```
