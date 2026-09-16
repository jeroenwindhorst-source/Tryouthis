# ADR-0011 — Plannen kent vier routes, en de route hoort bij de afspraak

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0009

## Context

Het systeem kon een vervolgafspraak voorstellen maar niet inplannen. Wat er gebeurde
als je op "controle over drie maanden" klikte, was: niets. De zorgverlener stuurde een
bericht aan de assistent, of onthield het, of typte het in het plan en hoopte dat
iemand het las.

Tegelijk stond er in de agenda alleen wat al gepland wás. De vraag "waar is nog ruimte"
— de vraag die je stelt zodra iemand aan de lijn hangt — was in het systeem niet te
stellen.

## Besluit

**1. Vrije plekken zijn onderdeel van de agenda, niet een aparte zoekfunctie.** Het
planbord toont afspraken en gaten door elkaar, op tijd. Een lijst met losse tijdstippen
zonder hun omgeving laat je de verkeerde plek kiezen: net naast een visiteblok of vlak
voor de lunch.

**2. Er zijn vier routes naar een afspraak, en de route staat bij de afspraak.**

| Route | Wat er gebeurt | Wanneer |
|---|---|---|
| `zelf` | Je kiest nu een plek in de agenda | je hebt de agenda voor je en het kan meteen |
| `assistent` | Verzoek op de werklijst, met de reden erbij | er moet gebeld worden, of het luistert nauw |
| `portaal` | Uitnodiging; de patiënt kiest uit opengestelde plekken | de patiënt kan en wil zelf kiezen |
| `automatisch` | Het systeem plant binnen de marge | logistiek werk zonder beoordeling (docs/13 §2) |

Dat de route bij de afspraak hoort en niet bij de gebruiker is het punt. Dezelfde POH
kiest bij de ene patiënt het portaal en belt bij de andere, en dat is geen
inconsistentie maar zorg. Een systeem dat dat in een instelling vastlegt, dwingt één
van beide patiënten in de verkeerde vorm.

**3. Vensters bepalen wat de patiënt zelf mag boeken.** Niet elke vrije plek staat open
voor zelfplanning: een gat van tien minuten tussen twee consulten is ruimte voor de
assistent, geen aanbod aan de patiënt. Per rol staat een venster open (in de demo het
eind van de middag), en alleen slots dáárbinnen zijn portaalplanbaar. Dat is een
praktijkafspraak en hoort dus in de configuratie (docs/14), niet in de code.

**4. Een afspraak is een order.** Hij heeft een reden, een ontvanger en een route, net
als een verwijzing naar de tweede lijn. Daarom staat hij in dezelfde catalogus en loopt
hij door dezelfde bevoegdheidscheck — inclusief "afspraak bij de huisarts", de route die
de POH nodig heeft en tot nu toe niet had.

## Overwogen en verworpen

**Alleen zelf plannen.** Eenvoudig, en fout: de zorgverlener heeft de agenda van een
collega niet altijd in beeld, en aan het eind van een consult is er geen tijd om een
puzzel op te lossen terwijl de patiënt zit te wachten.

**Alles via de assistent.** Dat is de huidige praktijk en precies het knelpunt: het
maakt één persoon tot doorgeefluik voor werk dat vaak direct gedaan kan worden.

**Alles automatisch.** Verleidelijk en gevaarlijk. Een systeem dat zelf plant, plant ook
de mensen in die net besloten hebben minder vaak te komen, en de mensen die telefonisch
overlegd hadden moeten worden. Automatisch plannen is alleen verantwoord voor het
logistieke deel, en dat onderscheid ligt al vast in ADR-0005.

## Gevolgen

Het planbord is de eerste plek waar de drie agenda's samenkomen. Dat legt een eis op de
rechten: de assistent ziet de agenda's van huisarts en POH, maar niet hun dossiers
zonder aanleiding. Dat verschil is nu impliciet en hoort expliciet te worden voordat dit
buiten een demo draait.

Wat er nog niet is: herhaalafspraken, wachtlijstlogica, en de terugkoppeling vanuit het
portaal wanneer een patiënt een plek kiest. Dat laatste is in de demo een status en geen
mechanisme.
