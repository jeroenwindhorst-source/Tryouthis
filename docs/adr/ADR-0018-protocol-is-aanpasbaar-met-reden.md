# ADR-0018 — Het protocol is aanpasbaar, maar nooit zonder reden

**Status:** aanvaard · **Datum:** 2026-09-24 · **Vult aan:** ADR-0005, ADR-0007, ADR-0017

## Context

Het protocolscherm liet zien wat de richtlijn zegt: welke aandachtsgebieden er zijn,
welke metingen erbij horen, hoe vaak die moeten. Alleen lezen, niet wijzigen.

Dat klopt niet met de praktijk. Elke huisartsenpraktijk wijkt van de richtlijn af, en
meestal met goede redenen:

- het prikpunt verwerkt twee keer per week, dus vijf dagen tussen prikken en consult is
  hier niet genoeg;
- de funduscontrole loopt volledig via de optometrist, dus de praktijk roept er niet
  apart voor op;
- deze populatie heeft veel diabetes met beginnende nierschade, dus de albumine-
  creatinineratio gaat halfjaarlijks in plaats van jaarlijks.

Die afwijkingen bestaan nu ook. Ze zitten alleen niet in het systeem maar in hoofden, in
werkafspraken en in een gedeeld document dat niemand meer bijwerkt. Het gevolg is dat
niemand kan opnoemen waar deze praktijk van de richtlijn afwijkt, laat staan waarom — en
dat het systeem adviezen geeft die de praktijk al jaren niet meer opvolgt.

Een protocol dat je alleen kunt inzien, is een folder.

## Besluit

Het protocol is aanpasbaar op praktijkniveau, onder drie voorwaarden.

**1. De richtlijn blijft er altijd naast staan.** Een gewijzigde waarde vervangt de
richtlijn niet; ze staat ernaast, met het woord *richtlijn* ervoor. De landelijke modules
worden nooit gemuteerd — de praktijkinstelling is een laag eroverheen
(`pasProtocolToe()`), en het zorgplan krijgt het samengestelde protocol mee in plaats van
naar een globale variabele te kijken.

**2. Een afwijking vraagt een reden.** Verplicht, minimaal een zin, samen met wie hem
maakte en wanneer. Dat is geen administratieve last maar het verschil tussen een
onderbouwde keuze en een ongeluk: zonder reden is een afwijking over een half jaar niet te
onderscheiden van een vergissing, en dan wordt hij hersteld door iemand die niet weet
waarom hij bestond — of erger, hij blijft staan terwijl niemand hem nog kan verdedigen.
Het is ook wat een regelset die het handelen beïnvloedt verantwoordbaar houdt (docs/07).

**3. Het recht ligt bij wie ermee werkt.** Niet alleen bij de praktijkmanager: het recht
`protocol-aanpassen` ligt bij de huisarts, de praktijkondersteuner én de praktijkmanager.
Wie het spreekuur draait, weet als eerste dat het prikpunt traag is. Ligt het recht alleen
bij het beheer, dan blijft die kennis buiten het systeem — precies het probleem dat dit
besluit oplost.

Wat aanpasbaar is, per meting: het interval, de doorlooptijd, of er vooraf geprikt wordt,
en of de praktijk dit onderdeel überhaupt doet. Per aandachtsgebied: aan of uit. Wat
**niet** kan: een aandachtsgebied verzinnen dat niet bestaat, of een meting toevoegen
zonder code. Het protocol is een bewerking van de richtlijn, geen vrij tekstveld.

## De doorlooptijd als eigen grootheid

Hieruit volgt een tweede correctie. De aanloop rekende met één grens van vijf dagen voor
alles wat vóór een consult binnen moest zijn. Daardoor stond er bij een afspraak over vier
dagen dat óók de vragenlijst niet meer op tijd zou zijn — terwijl die de avond ervoor nog
ingevuld kan worden. Bloed prikken kan dat niet.

De doorlooptijd hoort dus bij het onderdeel, niet bij het blok:

| Soort | Standaard | Waarom |
|---|---|---|
| Labbepaling | 5 dagen | prikken, verwerken en de uitslag terugkrijgen kost twee tot drie werkdagen |
| Vragenlijst | 1 dag | invullen kan tot de dag ervoor; één dag om hem te lezen |
| Meting in de spreekkamer | 0 dagen | gebeurt tijdens het consult zelf |

En omdat die getallen per regio verschillen, staan ze in het protocol waar de praktijk ze
kan aanpassen. Eén afspraak kan daardoor twee adviezen tegelijk opleveren: *dit lukt niet
meer, dat lukt nog wel.*

## Gevolgen

- `Monitoritem` kent `doorlooptijdDagen`; `doorlooptijdVan()` vult de aanname in als het
  veld ontbreekt.
- `PlanOpties.protocol` geeft het praktijkprotocol mee aan `bouwZorgplan()`. Meegeven in
  plaats van globaal muteren, zodat twee praktijken naast elkaar kunnen bestaan en een
  test een afwijkend protocol kan doorrekenen zonder de rest te raken.
- Het patiëntoverzicht bouwde zijn zorgplan rechtstreeks met `bouwZorgplan()` en zag de
  praktijkinstellingen dus niet. Dat is hersteld — gevonden door de test die controleert
  dat een protocolwijziging doorwerkt in het zorgplan.
- Een afwijking zonder reden of zonder recht wordt geweigerd, met een uitleg in plaats van
  een foutcode.

## Alternatieven

**Alleen de zorggroep laten instellen.** Sluit aan bij hoe ketencontracten werken, maar
laat de praktijk met adviezen zitten die ze niet opvolgt. De zorggroeplaag bestaat al
(docs/14) en blijft; dit is de laag eronder.

**Vrij bewerkbaar protocol.** Aantrekkelijk en fout: zodra een praktijk eigen metingen en
eigen aandachtsgebieden kan verzinnen, is niets meer herleidbaar tot een richtlijn en valt
de verantwoording weg die dit systeem juist mogelijk moet maken.

**Aanpassen zonder reden, met alleen een auditlog.** Technisch gelijkwaardig, praktisch
waardeloos: een logregel vertelt wát er veranderde, niet waarom. Precies dat laatste is wat
je een half jaar later nodig hebt.
