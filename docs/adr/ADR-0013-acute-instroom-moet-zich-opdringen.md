# ADR-0013 — Acute instroom dringt zich op, en oppakken is een claim

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0005

## Context

De dag is gepland: spreekuur, monitoring, overleg. En dan belt er iemand met pijn op de
borst, of komt er een portaalbericht binnen waarin iets staat wat niet tot morgen kan, of
stuurt een thuismeter een bloeddruk van 212/118 door.

Overdag gaat dat niet naar de huisartsenpost. Het moet hier, nu, door iemand worden
opgepakt. Twee dingen gaan daar in de praktijk mis, en allebei zijn ze een systeemprobleem
en geen gebrek aan oplettendheid.

**Het valt niet op.** Een teller die van 3 naar 4 gaat terwijl je een consult doet, ziet
niemand. Een rood cijfertje in een menu is geen melding; het is een cijfertje dat je pas
leest als je toch al kijkt.

**Het valt bij iedereen op en bij niemand genoeg.** Als hetzelfde signaal bij de huisarts,
de POH en de assistent in beeld staat zonder dat zichtbaar is wie ermee bezig is, gaan er
twee bellen of geen enkele. Beide zijn fout, en de tweede is gevaarlijk.

## Besluit

**1. De melding dringt zich op naar rato van de urgentie.**

| Urgentie | Vorm |
|---|---|
| Spoed | modaal venster dat je moet wegklikken |
| Binnen een uur | kaart rechtsonder, blijft staan |
| Vandaag | kaart rechtsonder, blijft staan |

Alles even hard laten schreeuwen is hetzelfde als niets laten schreeuwen. Daarom maar één
niveau dat het scherm blokkeert, en daarom is dat niveau schaars.

**2. Elk signaal draagt zijn onderbouwing.** Samenvatting, *waarom dit acuut is*, en een
voorstel voor wat er moet gebeuren. Die middelste is niet optioneel: zonder onderbouwing
is een urgentiestempel een onderbuikgevoel van een systeem, en dan leert de gebruiker om
het weg te klikken. Dat is precies hoe alarmmoeheid ontstaat.

**3. Oppakken is een expliciete claim.** "Ik pak hem op" zet je naam erbij, en de andere
rollen zien dat direct. Een tweede klik op een al opgepakt signaal doet niets — wie het
eerst klikt, heeft hem.

Dit is geen beleefdheid maar het antwoord op de vraag die de andere twee anders moeten
stellen. Het is ook het enige moment in het systeem waar een race tussen twee gebruikers
klinische gevolgen heeft, en daarom is het de enige plek waar de eerste klik expliciet
wint.

**4. Wegklikken is toegestaan, ook bij spoed.** De knop heet *"Niet nu — laat staan voor
een collega"* en niet *"Negeren"*. Wie in een gesprek zit met een andere patiënt, moet
kunnen doorgaan; het signaal blijft open staan voor wie het wél kan oppakken. Een melding
die je niet weg mag klikken, wordt een melding die je leert wegklikken.

## Overwogen en verworpen

**Automatisch toewijzen aan de minst bezette zorgverlener.** Klinkt slim en is het niet:
het systeem weet niet wie er net een slecht gesprek heeft gehad, wie deze patiënt kent, of
wie over vijf minuten weg moet. Toewijzen is een menselijke beslissing met menselijke
informatie.

**Alleen de huisarts laten zien.** Veiliger op papier, trager in de praktijk. Een
assistent die terugbelt en uitvraagt, lost een deel op en maakt het andere deel scherper.
Wie het mag oppakken staat per signaal, en dat is meestal meer dan één rol.

**Een aparte alarmmodule.** Verworpen: dan wordt het iets waar je heen moet, en het punt
is dat het naar jou toe komt.

## Gevolgen

De acute instroom loopt buiten de schermen om en is dus onderdeel van de applicatieschil,
niet van een scherm. In de demo wordt hij elke tien seconden opgehaald; in productie is
dat een pushverbinding.

De signalen komen in de demo met een vertraging binnen (0, 40, 95 en 150 seconden na het
inloggen). Dat is geen effect maar het punt: een lijst die er bij het inloggen al compleet
staat, laat niet zien wat deze functie doet.

Wat hier nog niet zit: escalatie als niemand oppakt, en een koppeling met de
telefooncentrale — nu is "telefoon" een bron zonder mechanisme erachter.
