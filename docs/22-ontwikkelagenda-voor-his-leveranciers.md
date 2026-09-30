# 22 — Ontwikkelagenda voor het gesprek met HIS-leveranciers

*Bronmateriaal voor de praatplaat die zorggroepen meenemen naar hun HIS-leverancier.
Geen productdocumentatie: dit is het gedestilleerde verhaal van wat er in Cadans is
gebouwd, geordend in categorieën waarmee je aan tafel kunt.*

---

## Hoe je dit document gebruikt

Dit is de **overdracht** naar het gesprek over de praatplaat. Alles wat hier staat, is
afgeleid van een werkend systeem — niet van een wensenlijst. Elke categorie hieronder is
in de demo-omgeving aan te wijzen, en de verwijzingen (`docs/…`, `ADR-…`) staan erbij
zodat de onderbouwing terug te vinden is.

De opzet per categorie is steeds dezelfde, en die opzet ís het format van de praatplaat:

| Onderdeel | Waarvoor |
|---|---|
| **De vraag aan tafel** | Eén zin waarmee de zorggroep het onderwerp opent |
| **Wat er nu gebeurt** | De huidige werkelijkheid, herkenbaar voor de leverancier |
| **Wat we hebben laten zien** | Het bewijs dat het anders kan — aanwijsbaar in de demo |
| **Wat je concreet vraagt** | Toetsbare eisen, geen richtingen. Hier hangt de ontwikkelagenda aan |
| **De trap** | Nu · binnen een jaar · vergezicht — zodat het geen alles-of-niets wordt |

**De trap is het belangrijkste onderdeel.** Een leverancier die "een compleet nieuw HIS"
hoort, haakt af. Een leverancier die hoort dat stap één een veld en een filter is, en dat
het vergezicht daar logisch uit volgt, kan meedoen. Elke categorie heeft daarom een eerste
stap die klein genoeg is om in een release te passen.

**De rode draad, in één zin:**

> *De POH doet doorlopende zorg in een systeem dat gebouwd is rond losse consulten van de
> huisarts. Alles wat daartussen zit — voorbereiden, opvolgen, uitzetten, terugbellen,
> in een groep zien — valt buiten het systeem en komt in Excel, op briefjes en in hoofden
> terecht.*

---

## De acht categorieën

1. Eén dossier, één plan — geen keteninformatiesysteem ernaast
2. Eén protocol op aandachtsgebieden — geen programma per aandoening
3. De aanloop — het werk vóór het contact
4. Wat de patiënt zelf aanlevert
5. Van signaal naar werk — elke knop levert werk op
6. Elk contact telt, in elke vorm
7. Samenwerken in één dossier
8. Verantwoording valt uit de zorg, niet andersom

---

## 1. Eén dossier, één plan — geen keteninformatiesysteem ernaast

**De vraag aan tafel**
*"Waarom heeft onze POH twee systemen open staan voor één patiënt?"*

**Wat er nu gebeurt**
Het HIS doet het journaal, het KIS doet de ketenzorg. Iemand met diabetes, hart- en
vaatrisico en COPD heeft drie trajecten, drie oproepmomenten en drie sets metingen — en de
POH houdt de samenhang in haar hoofd bij. Wat in het KIS staat, staat niet in het journaal
van de huisarts, en omgekeerd.

**Wat we hebben laten zien**
Eén dossier met één zorgplan per mens. De drie aandoeningen leveren samen drie contacten op
in plaats van acht, omdat overlappende metingen en controlemomenten worden samengevoegd.
Het journaal bevat álles: consulten, telefoontjes, thuismetingen, vragenlijsten,
ziekenhuisberichten — op één tijdlijn, met filters in plaats van aparte schermen.

**Wat je concreet vraagt**

- Eén zorgplan per patiënt, niet per aandoening, met samengevoegde controlemomenten.
- Ketenzorg als **afgeleide** van de geleverde zorg, niet als een eigen registratiestroom.
- Alles wat over deze mens binnenkomt in dezelfde tijdlijn, met filterbare herkomst.

**De trap**

| | |
|---|---|
| **Nu** | Ketenmodule en journaal tonen elkaars registraties, zonder overtypen |
| **Binnen een jaar** | Eén controleschema per patiënt over aandoeningen heen; oproepen samengevoegd |
| **Vergezicht** | Het KIS is opgeheven; ketendeelname is een projectie voor declaratie |

*Onderbouwing: ADR-0003, ADR-0006, docs/03, docs/04.*

---

## 2. Eén protocol op aandachtsgebieden — geen programma per aandoening

**De vraag aan tafel**
*"Wie past ons protocol aan als het prikpunt hier maar twee keer per week draait?"*

**Wat er nu gebeurt**
Protocollen zijn per aandoening ingericht en in het systeem vastgezet. Elke praktijk wijkt
af — van de frequentie, van de doorlooptijd, van wie wat doet — maar die afwijking zit in
werkafspraken en hoofden, niet in het systeem. Over een half jaar is niet meer te zien of
een afwijking een besluit was of een vergissing.

**Wat we hebben laten zien**
De bouwsteen is het **aandachtsgebied** (glucose, vaatrisico, nierfunctie, ademhaling,
leefstijl, mentaal welbevinden, medicatieveiligheid, kwetsbaarheid), niet de diagnose. Welk
gebied speelt, volgt uit het dossier. Het protocol is in het systeem **aanpasbaar door de
praktijk** — met de landelijke richtlijn ernaast, een verplichte reden, een naam en een
datum. Wat je aanpast werkt direct door in ieders zorgplan; geen nachtelijke batch.

**Wat je concreet vraagt**

- Het protocol is inzichtelijk én aanpasbaar binnen het systeem, niet alleen door de
  leverancier.
- Elke afwijking van de richtlijn draagt een reden, een auteur en een datum.
- De richtlijnwaarde blijft zichtbaar naast de praktijkwaarde.
- Een wijziging werkt onmiddellijk door in de zorgplannen die eruit volgen.

**De trap**

| | |
|---|---|
| **Nu** | Doorlooptijden en intervallen per praktijk instelbaar, met reden en logging |
| **Binnen een jaar** | Protocol op aandachtsgebieden naast de bestaande zorgprogramma's |
| **Vergezicht** | Eén protocol; zorgprogramma's bestaan alleen nog als verantwoordingslabel |

*Onderbouwing: ADR-0007, ADR-0018, docs/04, docs/14.*

---

## 3. De aanloop — het werk vóór het contact

**De vraag aan tafel**
*"Hoe vaak zit hier iemand voor een controle terwijl het bloed niet geprikt is?"*

**Wat er nu gebeurt**
Drie weken voor een controle gaat er een uitnodiging uit om te prikken. Bij de meeste
mensen werkt dat. Bij de rest merkt de praktijk het op het moment dat de patiënt in de
stoel zit — en dan gaat het consult over niets en moet er een nieuwe afspraak komen. Het
systeem wist alles wat nodig was om dat vooraf te zien, maar er was geen scherm dat het bij
elkaar zette.

**Wat we hebben laten zien**
Een blok **Aanloop**: alle controles van de komende weken, met per afspraak wat er vooraf
binnen moet zijn, wat er binnen is, en hoeveel dagen er nog over zijn. De kern is dat
hetzelfde feit een ander gevolg heeft naarmate de afspraak dichterbij komt — *niet geprikt*
is over drie weken een herinnering, over acht dagen een telefoontje, en over drie dagen een
reden om te verzetten. De doorlooptijd hangt aan het onderdeel: een labuitslag kost vijf
dagen, een vragenlijst kan tot de avond ervoor. Eén afspraak kan dus twee adviezen tegelijk
opleveren: *dit lukt niet meer, dat kan nog wel.*

**Wat je concreet vraagt**

- Een werklijst van aanstaande contacten met de stand van de voorbereiding per onderdeel.
- Een doorlooptijd **per onderdeel**, instelbaar per praktijk — niet één drempel voor alles.
- Een advies dat meebeweegt met de resterende tijd, in plaats van een vinkje ja/nee.
- Vanuit dat advies direct een actie kunnen uitzetten (zie categorie 5).

**De trap**

| | |
|---|---|
| **Nu** | Overzicht "voorbereiding niet compleet" over de komende vier weken |
| **Binnen een jaar** | Doorlooptijd per onderdeel, met een advies dat met de tijd meebeweegt |
| **Vergezicht** | De aanloop stuurt zichzelf: herinneren, bellen of verzetten wordt voorgesteld en met één klik uitgezet |

*Onderbouwing: ADR-0017, docs/04, docs/05.*

---

## 4. Wat de patiënt zelf aanlevert

**De vraag aan tafel**
*"Waar blijft de thuisbloeddruk die onze patiënten elke dag doorgeven?"*

**Wat er nu gebeurt**
Een ingevulde vragenlijst komt binnen als bericht in een postbus, of als PDF bij de
documenten. Een thuisgemeten bloeddruk blijft tekst. Wie het wil gebruiken, typt het over
in het journaal — en daarmee wordt het stilzwijgend een registratie van de praktijk,
terwijl niemand het heeft beoordeeld.

**Wat we hebben laten zien**
Vragenlijsten, thuismetingen en de wachtkamerintake landen als **gegevens met een eigen
herkomst**. Ze tellen mee in het beeld en kunnen een signaal laten afgaan, maar ze vullen
geen ketenindicator tot een zorgverlener ze heeft **overgenomen** — met naam en datum. In
het consult staat de vragenlijst met één knop *overnemen in mijn dossier*; het antwoord
landt onder de **S** van de SOEP, in de woorden van de patiënt. In het journaal is het
daarna terug te vinden als eigen regel op de dag dat zíj hem invulde, en er is een
dwarsdoorsnede *alles wat deze mens zelf heeft doorgegeven*, over alle episodes heen.

**Wat je concreet vraagt**

- Patiëntgerapporteerde gegevens als gestructureerde waarden met eigen herkomst, niet als
  bericht of bijlage.
- Een expliciete handeling *overnemen*, met wie en wanneer — geen automatische promotie tot
  eigen registratie.
- Een filter op de tijdlijn: laat zien wat van de patiënt zelf komt.
- Een vragenlijst die iets kán aansturen: een vervolgvraag, een taak, een aangepaste
  controlefrequentie.

**De trap**

| | |
|---|---|
| **Nu** | Vragenlijstantwoorden als losse meetwaarden in het dossier, met bron "patiënt" |
| **Binnen een jaar** | Overnemen als handeling met vastlegging; filter op herkomst in het journaal |
| **Vergezicht** | De vragenlijst als motor: antwoorden sturen het protocol, de oproep en het zelfzorgadvies aan |

*Onderbouwing: ADR-0012, docs/06, docs/13.*

---

## 5. Van signaal naar werk — elke knop levert werk op

**De vraag aan tafel**
*"Als het systeem ziet dat er iets misgaat, wie doet er dan wat?"*

**Wat er nu gebeurt**
Systemen zijn goed in lijstjes en slecht in wat erna komt. Je ziet dat de uitslag ontbreekt,
maar er komt geen werk uit voort: geen taak, geen ontvanger, geen agendapunt. Het gevolg is
dat mensen de lijstjes gaan negeren, omdat dezelfde regel er morgen weer staat.

**Wat we hebben laten zien**
Elke actieknop opent hetzelfde paneel als een order, en levert een **werktaak** op: wat er
moet gebeuren, bij wie het terechtkomt, en waarom. Bellen dat de uitslag ontbreekt kan de
assistent; die uitslag bespreken niet — dus dat onderscheid zit in de taaksoort en niet in
een rechtenmatrix. De taak komt op een werklijst, is in de agenda te plannen als blok, en de
regel die hem veroorzaakte verandert van stand naar *opgepakt*.

En dan het stuk dat het verschil maakt: een ingepland blok is **een ingang**. Je klikt erop
en ziet wat er bij deze mens nog tekortkomt, wat er verder speelt, wat je in dit gesprek
wilt bereiken, en hoe je hem bereikt — bij elkaar, op het moment dat je de telefoon pakt.

**Wat je concreet vraagt**

- Elke signaleringsregel heeft een actie die een taak oplevert, met ontvanger en aanleiding.
- Taken zijn te richten op een **rol** (wie er die dag is) én op een **persoon**, en dat
  verschil is zichtbaar.
- Taken zijn in de agenda te plannen, en eigen werk (terugbellen, uitslagen nalopen,
  administratie) krijgt tijd in diezelfde agenda.
- Een geplande taak opent de context die je nodig hebt, niet de tekst die je zelf typte.

**De trap**

| | |
|---|---|
| **Nu** | Een takenlijst met ontvanger, aanleiding en status — niet alleen een notitie |
| **Binnen een jaar** | Taken in de agenda, en niet-patiëntgebonden werk zichtbaar in diezelfde agenda |
| **Vergezicht** | Elk signaal draagt zijn eigen vervolg; de werkvoorraad van de praktijk is één geheel |

*Onderbouwing: ADR-0009, ADR-0019, ADR-0020, docs/16, docs/18.*

---

## 6. Elk contact telt, in elke vorm

**De vraag aan tafel**
*"Waar staat het telefoontje van vanochtend, en wat levert het op?"*

**Wat er nu gebeurt**
Een consult op de praktijk wordt netjes vastgelegd. Een telefoontje vaak niet, of als losse
aantekening bij een ander contact. Een groepsconsult past helemaal niet: een agenda die is
gebouwd rond *één tijdslot, één patiënt* kan een blok met acht mensen niet weergeven, dus
houdt de POH een Excel bij en registreert achteraf één voor één — of niet. De contactvorm
wordt achteraf ingevuld door degene die de declaratie doet, en die gokt.

**Wat we hebben laten zien**
De contactvorm hoort bij het contact en wordt gevraagd op het moment dat het plaatsvindt.
Uit die vorm volgt de prestatie, mét de voorwaarden zichtbaar erbij — niet om tot declareren
aan te zetten, maar omdat het omgekeerde vaker gebeurt: werk dat gedaan is en niet wordt
vergoed omdat één veld leeg bleef.

Een telefoontje wordt met twee velden vastgelegd — *wat is er gezegd* en *wat is er
afgesproken* — en landt als volwaardig contact in het journaal. Zonder notitie landt het
contact ook (er ís gebeld), maar dan staat erbij dat het zo geen prestatie is. En een
groepsconsult is één blok met deelnemers, waarbij je tijdens de bijeenkomst per deelnemer
een notitie maakt die in **diens** dossier landt en nergens anders: het consult is
gezamenlijk, het dossier niet.

**Wat je concreet vraagt**

- Contactvorm als veld bij het contact, niet als declaratiekeuze achteraf.
- Telefonisch, e-consult en videoconsult als volwaardige contacten met eigen SOEP.
- De declaratieregel zichtbaar op het moment van vastleggen, inclusief wat er nog ontbreekt.
- Een groepsconsult als agenda-item met deelnemers, met registratie **per deelnemer** in het
  eigen dossier.

**De trap**

| | |
|---|---|
| **Nu** | Telefonisch contact met één klik vastleggen, met SOEP en episode |
| **Binnen een jaar** | Declaratiebeeld zichtbaar tijdens het vastleggen; e-consult en video gelijkwaardig |
| **Vergezicht** | Groepsconsulten als eersteklas werkvorm, inclusief deelnemervoorstellen uit het dossier |

*Onderbouwing: ADR-0020, docs/19.*

---

## 7. Samenwerken in één dossier

**De vraag aan tafel**
*"Wie heeft dit geregistreerd, en wie mag het autoriseren?"*

**Wat er nu gebeurt**
Het dossier is gebouwd rond de huisarts als enige registrerende zorgverlener. De POH, de
assistent en de POH-GGZ werken in hetzelfde scherm of in een eigen systeem, en wie wat heeft
vastgelegd is niet altijd terug te zien. Overleg tussen POH en huisarts gebeurt in de gang.

**Wat we hebben laten zien**
Elke rol heeft een **eigen werkplek op hetzelfde dossier** — met eigen ingangen, eigen
werklijst en eigen bevoegdheden. Wat niet bij jouw werk hoort, staat er niet (geen grijze
knoppen). Elke registratie draagt herkomst: bron, auteur en rol. Er is een bespreeklijst
voor het overleg, een autorisatiestroom voor wat de huisarts moet accorderen, en een taak
die je uitzet, is bij de ander zichtbaar mét wie hem uitzette en waarom.

**Wat je concreet vraagt**

- Rolgebaseerde werkplekken op één dossier, met een eigen werkvoorraad per rol.
- Herkomst (bron, auteur, rol, moment) bij elke registratie, zichtbaar in het journaal.
- Een bespreeklijst en een autorisatiestroom als onderdeel van het systeem, niet ernaast.
- Een taak die bij een collega landt, komt daar ook echt aan — met context.

**De trap**

| | |
|---|---|
| **Nu** | Herkomst zichtbaar bij elke registratie; eigen werklijst per rol |
| **Binnen een jaar** | Een POH-werkplek met eigen ingangen in plaats van het huisartsscherm |
| **Vergezicht** | Het team is het uitgangspunt van het systeem, niet de solo-huisarts |

*Onderbouwing: ADR-0006, docs/05, docs/17.*

---

## 8. Verantwoording valt uit de zorg, niet andersom

**De vraag aan tafel**
*"Hoeveel van onze registratie gebeurt 'voor de keten'?"*

**Wat er nu gebeurt**
Een deel van de registratie bestaat omdat de indicator erom vraagt, niet omdat de zorg erom
vraagt. Selectie en oproep gaan via een datadump naar Excel en handmatig terug. Aan het eind
van het kwartaal blijkt wat er ontbreekt, en dan is het te laat om er nog iets aan te doen.

**Wat we hebben laten zien**
De ketenindicatoren worden **afgeleid** uit wat er is vastgelegd. Registreer je één keer bij
het consult, dan volgt de verantwoording daaruit — en het systeem laat direct zien welke
indicatoren daarmee op orde zijn. Casefinding komt uit het dossier zelf, met onderbouwing
per kandidaat. Rapportages draaien op dezelfde gegevens als de zorg, en wat eruit gaat is
geaggregeerd en geanonimiseerd.

**Wat je concreet vraagt**

- Geen apart registratiescherm "voor de keten"; indicatoren volgen uit de zorgregistratie.
- Zichtbaar tijdens het werk wat er nog ontbreekt, niet achteraf per kwartaal.
- Selectie en oproep in het systeem, met onderbouwing per kandidaat — geen Excel.
- Rapportage op dezelfde gegevens, geaggregeerd en geanonimiseerd naar buiten.

**De trap**

| | |
|---|---|
| **Nu** | Ontbrekende indicatoren zichtbaar op patiëntniveau tijdens het consult |
| **Binnen een jaar** | Casefinding en oproep in het systeem, met onderbouwing |
| **Vergezicht** | Verantwoording is een bijproduct; niemand registreert nog "voor de keten" |

*Onderbouwing: ADR-0015, docs/04, docs/20.*

---

## Wat er in de demo aanwijsbaar is

Voor wie de praatplaat wil koppelen aan een scherm. De volledige doorloop staat in
`docs/21-demonstratie.md`.

| Categorie | Waar je het laat zien |
|---|---|
| 1. Eén dossier, één plan | Dossier → Overzicht · het zorgplan met samengevoegde contacten |
| 2. Eén protocol | Praktijk → Het protocol · aanpassen met reden, direct effect in de aanloop |
| 3. De aanloop | Aanloop · *verzetten* versus *bellen* bij hetzelfde feit |
| 4. Patiëntgerapporteerd | Spreekuur → vragenlijst · Consult → overnemen · Journaal → filter |
| 5. Van signaal naar werk | Aanloop → taak uitzetten · Plannen → inplannen · het blok openen |
| 6. Elk contact telt | Bellen → gesprek vastleggen · Groepsconsulten → per deelnemer |
| 7. Samenwerken | Uitloggen en inloggen als assistent · dezelfde taak, andere werkplek |
| 8. Verantwoording | Consult → wat deze registratie aan indicatoren vult · Afronden |

---

## Wat je níét moet beloven

Een handout die te veel belooft, kost de zorggroep geloofwaardigheid bij de leverancier.
Cadans is een **werkend prototype op synthetische data**, en dat is precies genoeg voor dit
gesprek — het bewijst dat het kán, niet dat het er is.

- Er is **geen transportlaag**: geen LSP, geen ZorgDomein, geen G-Standaard, geen
  receptverkeer. De velden en het werkproces zijn er; de koppelingen niet.
- De **prestatiecodes zijn niet geverifieerd** tegen de actuele NZa-beleidsregel. De
  structuur klopt; de codes moeten nog langs de regelgeving.
- De **drempelwaarden zijn plausibel maar niet gevalideerd** tegen de NHG-standaarden.
- Alle patiënten, waarden en teksten zijn **verzonnen**. 48 synthetische dossiers.
- Certificering (NEN 7510, MDR voor de beslissingsondersteuning) is ingericht als
  uitgangspunt, niet behaald.

De eerlijkste formulering aan tafel: *"Dit is geen product dat we verkopen. Dit is hoe het
eruit zou kunnen zien, gebouwd zodat we er iets concreets over kunnen zeggen in plaats van
een wensenlijst voor te lezen."*

---

## Waar de onderbouwing staat

| Onderwerp | Document |
|---|---|
| Waarom dit probleem bestaat | `docs/00-visie-en-scope.md` §1 |
| Het zorgproces en het protocol | `docs/04-zorgproces.md` |
| De werkplekken per rol | `docs/05-werkplekken.md` |
| Vragenlijsten als motor | `docs/06-vragenlijsten.md` |
| Fasering en bewijsvoering | `docs/09-roadmap.md` |
| Analyse van bestaande HIS'en | `docs/10-analyse-bestaande-hissen.md` |
| Het applicatiefunctiemodel (waar de gaten zitten) | `docs/11-applicatiefunctiemodel.md` |
| Ordermanagement | `docs/16-ordermanagement.md` |
| Plannen en agenda | `docs/18-plannen-en-agenda.md` |
| Contactvormen en declaratie | `docs/19-contactvormen-en-declaratie.md` |
| Alle architectuurbesluiten | `docs/adr/` (ADR-0001 t/m ADR-0020) |
| De demonstratieroute | `docs/21-demonstratie.md` |
