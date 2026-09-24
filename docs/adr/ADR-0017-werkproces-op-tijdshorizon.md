# ADR-0017 — Het werkproces is ingedeeld op tijdshorizon, niet op dagindeling

**Status:** aanvaard · **Datum:** 2026-09-24 · **Vervangt deels:** de eerste indeling uit ADR-0007

## Context

De werkplek van de POH was ingedeeld in vier stappen: *voorbereiden → spreekuur →
monitoren → afronden*. Dat leek de dag te volgen, maar het eerste wat opviel zodra iemand
ermee werkte, is dat de eerste twee over precies dezelfde mensen gingen.

Voorbereiden toonde de patiënten van vandaag met wat er binnen was en wat ontbrak.
Spreekuur toonde de patiënten van vandaag als tijdlijn. Twee ingangen, één handeling — en
een POH bereidt haar spreekuur niet de avond tevoren in één ruk voor, maar kijkt vlak
voordat ze iemand binnenroept wat er over déze mens te weten valt.

Tegelijk ontbraken er twee dingen die wél om een eigen plek vroegen, en die allebei
buiten de dag van vandaag vallen.

**Vóór vandaag.** Het systeem stuurt weken van tevoren automatisch een uitnodiging om
bloed te laten prikken. Bij de meeste mensen werkt dat. Bij een deel niet, en dan zit er
over een week iemand in de spreekkamer terwijl er geen uitslag is om over te praten. Het
systeem weet dat ruim van tevoren — het kent de afspraakdatum, de benodigde bepalingen en
wat er binnen is — maar er was geen plek waar dat bij elkaar stond. Iedere praktijk
ontdekt dit op het moment dat het te laat is.

**Naast vandaag.** Er komt van alles binnen bij mensen die vandaag geen afspraak hebben:
een labuitslag buiten de streefwaarde, een ingevulde vragenlijst waarin iemand schrijft
dat hij zijn medicijnen niet meer ophaalt, tien dagen thuisgemeten bloeddrukken die te
hoog zijn. Voor geen daarvan is een consult nodig; een bericht, een aangepast recept of
een telefoontje volstaat. Zonder eigen plek wachten ze tot de volgende controle in de
agenda staat — soms drie maanden.

Dat laatste valt niet onder monitoren. Monitoren beantwoordt de vraag *hoe gaat het met de
groep die ik volg*; dat is een overzicht en je kijkt ernaar als het uitkomt. *Waar kan ik
vandaag iets doen* is een andere vraag, op een ander moment, met een andere urgentie.

## Besluit

De werkplek van de POH kent vijf blokken, op volgorde van **hoe ver het moment ligt
waarop er iets gebeurt**:

| Blok | Horizon | Vraag |
|---|---|---|
| **Aanloop** | de komende weken | wie komt er straks terwijl de voorbereiding niet rond is? |
| **Spreekuur** | vandaag | wie komt er, en wat weet ik van deze mens? |
| **Opvolgen** | nu | wat is er binnengekomen waar ik vandaag iets mee kan? |
| **Monitoren** | doorlopend | hoe gaat het met de groep die ik op afstand volg? |
| **Afronden** | straks | wat blijft er liggen als ik naar huis ga? |

Daaruit volgen drie regels.

**De voorbereiding zit in het spreekuur.** Per patiënt, op de plek waar je hem nodig hebt.
Geen eigen ingang meer.

**Hetzelfde feit krijgt een ander gevolg naarmate de tijd verstrijkt.** 'Niet geprikt' is
over drie weken een herinnering, binnen tien dagen een telefoontje en binnen vijf dagen
een reden om de afspraak te verzetten — omdat prikken en de uitslag terugkrijgen twee tot
drie werkdagen kost. De grens zit in de logica, niet in het oordeel van de gebruiker.

**Wat vandaag komt, heeft zijn uitslagen.** Bij een patiënt op het spreekuur van vandaag
mag 'nog bloed prikken' niet in beeld staan. Staat het er toch, dan hoort die patiënt niet
in het spreekuur maar in de aanloop. Wat in de spreekkamer gemeten wordt — bloeddruk,
voetonderzoek, rookstatus — is daarom géén achterstand maar de agenda van het consult, en
wordt apart getoond.

## Gevolgen

- `Processtap['id']` is `aanloop | spreekuur | opvolgen | monitoren | afronden`.
- `Voorbereiding` splitst wat ontbreekt in **ontbreekt** (had vooraf binnen moeten zijn)
  en **tijdensConsult** (wordt zo meteen gemeten). Alleen het eerste is een tekort.
- De demopopulatie zet labuitslagen klaar vóór de afspraken van vandaag; zonder dat laat
  de demo precies het probleem zien dat dit besluit oplost.
- `packages/praktijk/test/demodata.test.js` bewaakt dat niemand tegelijk in de aanloop en
  op het spreekuur van vandaag staat, dat het aanloopadvies bij het aantal resterende
  dagen past, en dat er bij een patiënt van vandaag geen labbepaling meer openstaat.

## Alternatieven

**Alles in één werkvoorraad.** Eén lijst met alles wat aandacht vraagt, gesorteerd op
urgentie. Kort en aantrekkelijk, maar het verliest waar het hier om gaat: een telefoontje
over volgende week en een uitslag van vanochtend vragen een ander soort aandacht, en door
elkaar gezet worden ze allebei minder goed behandeld.

**Opvolgen onder Monitoren hangen.** Scheelt een blok, maar dan verdwijnt de ene
thuismeting die om een besluit vraagt onder drieëntwintig regels die dat niet doen.
