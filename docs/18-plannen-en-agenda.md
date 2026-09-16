# 18 — Plannen en agenda

Zie [ADR-0011](adr/ADR-0011-vier-planroutes.md) voor het besluit.

## 1. Het planbord

Drie agenda's naast elkaar — huisarts, POH-S, assistent — met de vrije plekken tússen de
afspraken en niet in een aparte lijst. De eerste vraag aan de telefoon is namelijk niet
"wanneer is er ruimte" maar "past dit bij de POH of moet het naar de huisarts", en die
vraag beantwoord je alleen als je alle drie ziet.

Vrije plekken zijn gearceerd. Een plek die is opengesteld voor zelfplanning door de
patiënt krijgt een eigen tint en zegt waarvoor het venster bedoeld is.

## 2. Twee manieren om te plannen

**Slepen** voor wie de muis al vast heeft. **Aanklikken** voor wie dat niet heeft: kies
links een verzoek of een patiënt, klik rechts op een plek. Dezelfde uitkomst.

Die tweede route is geen toegankelijkheidsvinkje. Slepen werkt niet met een toetsenbord
en slecht met één hand terwijl je de telefoon vasthoudt — en dat is precies de situatie
waarin dit scherm gebruikt wordt.

## 3. De vier routes

```
zelf         → je kiest nu een plek
assistent    → op de werklijst, met de reden erbij
portaal      → uitnodiging; de patiënt kiest uit de opengestelde plekken
automatisch  → het systeem plant binnen de marge
```

De route staat bij het verzoek, niet bij de gebruiker. Zie ADR-0011 voor waarom dat
verschil ertoe doet.

Bij `portaal` gaat de consultvoorbereidende vragenlijst mee met de uitnodiging. Dat is
het moment waarop de patiënt toch al in het portaal zit; elk ander moment is een tweede
herinnering.

## 4. Afspraken zijn orders

In het consult plan je via **Bestellen → Afspraak**. Dezelfde catalogus als medicatie en
verwijzingen, dezelfde bevoegdheidscheck. Wat erin zit:

| Afspraak | Bij | Duur | Vorm |
|---|---|---|---|
| Afspraak bij de huisarts | huisarts | 10 min | praktijk |
| Dubbel consult huisarts | huisarts | 20 min | praktijk |
| Videoconsult huisarts | huisarts | 10 min | video |
| Visite huisarts | huisarts | 30 min | thuis |
| Controle bij de POH-Somatiek | POH-S | 20 min | praktijk |
| Videoconsult POH-Somatiek | POH-S | 20 min | video |
| Telefonische controle POH | POH-S | 10 min | telefonisch |
| Afspraak bij de assistent | assistent | 10 min | praktijk |

De POH die concludeert dat de huisarts ernaar moet kijken, had tot nu toe geen andere
uitweg dan een bericht sturen of het onthouden. Dat gat is hiermee dicht.

## 5. De dag zelf

Elke afspraak heeft een toestand: gepland → aangemeld → in de wachtkamer → in consult →
afgerond, of niet verschenen. Zie `docs/05` §4b. Vastleggen van een consult zet de
afspraak zelf op afgerond.

## 6. Wat hier nog niet zit

- **Herhaalafspraken** (elke drie maanden, twaalf keer) en wachtlijstlogica.
- **Terugkoppeling uit het portaal**: dat een patiënt een plek kiest is in de demo een
  status, geen mechanisme.
- **Rechten rond het planbord.** De assistent ziet hier de agenda's van huisarts en POH.
  Dat is functioneel juist en nu impliciet; het hoort expliciet in het rechtenmodel
  (`docs/17`) voordat dit buiten een demo draait.
- **Dubbelboekingen en overlap** worden voorkomen doordat het raster op bezette tijden
  kijkt, maar er is geen vergrendeling: twee mensen die tegelijk plannen kunnen dezelfde
  plek pakken.
