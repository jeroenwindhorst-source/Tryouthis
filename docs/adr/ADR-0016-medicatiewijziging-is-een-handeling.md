# ADR-0016 — Een medicatiewijziging is één handeling, geen vier

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0009

## Context

Een middel aanpassen is voor de zorgverlener één besluit: *deze dosering werkt niet, we gaan
naar 2dd 2*. In het dossier zijn het vier dingen:

1. het lopende middel stopt,
2. het nieuwe middel start,
3. de openstaande order voor het oude middel wordt ingetrokken,
4. er gaat een nieuw recept naar de apotheek.

Bestaande systemen laten die vier los van elkaar doen, op verschillende plekken. Het
medicatieoverzicht is een lijst waar je een regel bewerkt; het recept maak je in een ander
scherm; de lopende herhaalaanvraag staat in een derde. Het gevolg is voorspelbaar en het
gebeurt dagelijks:

- een verhoogde dosering in het overzicht zonder dat er een recept uitgaat — de patiënt
  haalt de oude sterkte op;
- een nieuw recept zonder dat het oude gestopt is — er staat twee keer metformine in het
  dossier, en de apotheek ziet dat wel en de patiënt niet;
- een gestopt middel waarvan de herhaalservice gewoon doorloopt.

Dit zijn geen slordigheidsfouten. Het zijn de fouten die een systeem uitlokt door één
besluit over vier schermen te verdelen.

## Besluit

**1. Eén paneel, één bevestiging, vier mutaties.** Vanuit het medicatieblok in het dossier
schuift een paneel open — hetzelfde patroon als het orderpaneel (ADR-0009), want het is
hetzelfde soort werk: je blijft waar je was en je handelt iets af. Wat je kiest is *wat je
met dit middel doet*: dosering aanpassen, vervangen, stoppen. Wat daaruit volgt, doet het
systeem in één transactie.

**2. Er staat vóór het bevestigen in zinnen wat er gaat gebeuren.**

> Metformine 500mg 2dd1 stopt vandaag.
> Metformine 500mg 2dd 2 tabletten start vandaag.
> Een openstaande order voor Metformine 500mg wordt ingetrokken.
> Het recept gaat elektronisch naar Marktapotheek in Zutphen.

Die zinnen komen uit dezelfde functie in de domeinlaag die de wijziging daarna uitvoert.
Een samenvatting die door het scherm wordt opgesteld, kan uit de pas lopen met wat er
werkelijk gebeurt; dan is hij erger dan geen samenvatting. Hij staat vóór de knop en niet
erna, want daarna is het een mededeling.

**3. Een reden is verplicht, met knoppen erbij.** Een gestopt middel zonder reden is over
een jaar een raadsel dat niemand meer durft terug te draaien. Een verplicht vrij tekstveld
levert "ivm" op; een lijst met wat er werkelijk speelt — *streefwaarde niet gehaald*,
*bijwerkingen die de patiënt niet volhoudt*, *nierfunctie gedaald* — levert iets op wat een
collega kan lezen.

**4. De aflevering is een keuze per recept, geen instelling per patiënt.** Elektronisch naar
een apotheek, printen aan de balie, of meegeven zonder apotheek. De vaste apotheek van de
patiënt staat voorgeselecteerd, maar wie morgen bij zijn dochter logeert wil het daar
ophalen. Een systeem dat de voorkeursapotheek vastzet, dwingt de zorgverlener tot bellen.

**5. Een apotheek die niet elektronisch ontvangt, krijgt geen elektronisch recept.** De
keuze wordt geweigerd met de reden erbij, en niet stilletjes omgezet naar printen. Anders
denkt de zorgverlener dat het verstuurd is terwijl er een vel papier in een la ligt.

**6. Het rechtenmodel verandert niet.** De POH wijzigt het dossier en het recept gaat met de
onderbouwing naar de autorisatiestroom van de huisarts (docs/16 §4). Dat verschil staat op
de knop — *"Wijzigen en voorleggen aan de huisarts"* — en niet in een foutmelding achteraf.

## Overwogen en verworpen

**Bewerken in de lijst zelf (inline).** Snel voor een dosering, maar het maakt de andere
drie mutaties onzichtbaar. Juist het feit dat er een recept uitgaat en dat er iets stopt, is
wat je wilt zien.

**Een bevestigingsdialoog na het opslaan.** Dan bevestig je iets wat al besloten is. De
samenvatting hoort vóór de handeling, op het moment dat je nog iets kunt veranderen.

**Automatisch de goedkoopste of leverbare variant kiezen.** Substitutie is het werk van de
apotheek en een beslissing met klinische kanten. Het systeem stelt niet voor wat het niet
kan overzien.

**Het oude middel laten doorlopen tot de nieuwe verpakking op is.** Klinisch soms terecht,
maar dan is het een expliciete afspraak die in het dossier hoort en niet een gevolg van hoe
het systeem toevallig werkt. Voor nu: stoppen en starten op dezelfde dag, zodat er geen gat
ontstaat waarin de patiënt formeel niets gebruikt.

## Gevolgen

De dubbelmedicatiebewaking moest worden bijgesteld. Die waarschuwt bij het plaatsen van een
order dat het middel al in het dossier staat — terecht — maar bij het *aanpassen* van dat
middel is dat precies het advies dat je op dat moment opvolgt. De melding wordt daarom
onderdrukt als het om hetzelfde middel gaat, en blijft staan als je vervangt door iets wat de
patiënt al gebruikt.

Wat hier nog niet zit: geen echt receptverkeer (NHG-Tabel 25, EDIFACT, het LSP), geen
G-Standaard en dus geen interactiebewaking, geen herhaalservice die meeloopt met een
wijziging, en geen afbouwschema's — een taper is nu een reeks losse wijzigingen.
