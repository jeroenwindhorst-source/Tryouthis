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


## Eigen werk in de agenda

Het planbord kende alleen patiënten. Een agenda die alleen patiënten kent, liegt:
uitslagen nalopen, terugbellen en administratie kosten evenveel tijd als een consult en
zijn onzichtbaar. Het gevolg is bekend — de dag zit vol en er is niets gepland voor wat er
ook nog moet.

Naast de patiënten en de afspraakverzoeken staan daarom twee dingen in de linkerkolom:

- **Mijn werklijst** — de taken die bij jou zijn neergelegd, met de aanleiding erbij. Kies
  er een en klik op een vrije plek; hij komt als blok in jouw agenda te staan, met de
  reden zichtbaar.
- **Eigen werk inplannen** — voorgedefinieerde blokken: patiënten terugbellen,
  voorbereiding spreekuur, uitslagen nalopen, administratie, overleg, pauze. Een korte
  gesloten lijst en geen vrij tekstveld, want vijftien varianten van 'patiënt bellen'
  maken elke rapportage erover zinloos.

Zie [ADR-0019](adr/ADR-0019-een-knop-levert-werk-op.md).


## Een ingepland blok is een ingang

Een taak inplannen bleek niet hetzelfde als weten wat je gaat zeggen. Het blok stond om
11:20 in de agenda, je klikte erop, en dan stond er precies wat je er zelf in had getypt
toen je hem uitzette.

Elk blok dat uit een werktaak komt, opent daarom het **taakdossier**: één venster dat de
vraag beantwoordt *wat komt er bij deze mens nog tekort?*

| Blok | Wat erin staat |
|---|---|
| Wat komt er nog tekort | Per onderdeel: binnen, nog niet binnen of te laat — met de doorlooptijd en de resterende dagen |
| De afspraak | Datum, tijd, dagen, en het advies uit de aanloop |
| Wat er verder speelt | De signalen uit het dossier, zodat je niet belt over lab terwijl er iets anders is |
| Wat je wilt bereiken | Een paar zinnen: wat je zegt, in de volgorde waarin je het zegt |
| Waarom deze taak er is | De aanleiding, wie hem uitzette, en wanneer hij uiterlijk af moet |
| Hoe je hem bereikt | De bereikbaarheid, met de belknop ernaast |

Het taakdossier rekent niets zelf uit: het haalt zijn onderdelen uit de aanloop, het
zorgplan, de signalen en de bereikbaarheid. Twee plekken die hetzelfde zouden moeten
berekenen, gaan uiteenlopen — en dan weet niemand meer welke klopt.

Vanuit datzelfde venster bel je, en het gesprek wordt daar vastgelegd als contact
(docs/19). Zie [ADR-0020](adr/ADR-0020-een-gesprek-is-pas-zorg-als-het-vastligt.md).
