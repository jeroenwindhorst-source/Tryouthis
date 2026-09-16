# 05 — Rolgebonden werkplekken

Eén dossier, vier ingangen. De werkplek bepaalt wat je als eerste ziet en welke
volgende stap voor de hand ligt — niet wat er bestaat.

## 1. POH-Somatiek — de dag als werkeenheid

Dit is de rol waarop de eerste vertical slice is gebouwd.

De werkplek is ingedeeld naar het **werkproces**, niet naar het dossier:
dagstart → voorbereiden → spreekuur → monitoren → afronden. Per stap staat in het scherm
letterlijk wát je daar ziet, want dat is wat in bestaande systemen ontbreekt: je moet er
maar achter komen waar je werk staat.

### 1.1 Dagstart (het startscherm — niet "zoek een patiënt")

```
┌─ Vandaag, dinsdag 15 september ────────────────────────────────────────┐
│  8 afspraken · 3 vragen aandacht · 2 voorbereiding niet compleet       │
├────────────────────────────────────────────────────────────────────────┤
│ 09:00  A. de Vries (68)   DM2 + CVRM   ✓ voorbereid   HbA1c ↑ 71        │
│ 09:20  M. Jansen (54)     COPD         ⚠ CCQ ontbreekt                  │
│ 09:40  [monitoringblok]   6 patiënten in beeld                          │
│ ...                                                                     │
├─ Werkvoorraad ─────────────────────────────────────────────────────────┤
│  4 signalen uit monitoring    2 uitslagen te beoordelen                 │
│  3 oproepen zonder respons    1 autorisatie ingediend                   │
└────────────────────────────────────────────────────────────────────────┘
```

Per afspraak direct zichtbaar: welke aandachtsgebieden spelen, of de voorbereiding
compleet is (vragenlijst ingevuld, lab binnen), en wat er afwijkt. Geen dossier openen
om te ontdekken dat het lab nog niet binnen is.

### 1.2 Monitoringblok
De groep patiënten die op afstand wordt gevolgd, gesorteerd op afwijking, niet op
alfabet. Per patiënt: het signaal, de trend, en drie tot vijf voorgestelde
vervolgacties (bericht sturen, lab aanvragen, afspraak inplannen, intensiteit
verhogen, niets doen met reden). Eén klik per patiënt, batchgewijs af te handelen.

### 1.3 Consult
Het dossier in de bekende driedeling (context / tijdlijn / structuur, zie `docs/10` §4),
maar met een vierde element: **de protocolkolom**. Die toont wat er voor déze patiënt
in dit contact gedaan moet worden, samengevoegd over alle aandachtsgebieden, met wat al
binnen is afgevinkt. Registreren gebeurt in de protocolkolom; het journaal wordt
gevuld, niet andersom.

### 1.4 Dagafsluiting
Wat is er open: onvolledige registraties, niet-verstuurde berichten, ontbrekende
declaratiegegevens, openstaande autorisatieverzoeken. Met per item de reden en, waar
mogelijk, een afhandeling in bulk. Doel: de dag is aantoonbaar af, in minuten.

## 2. Doktersassistent

> Geïmplementeerd in de werkplek: dagstart met eigen agenda, een triagescherm waarin
> digitale en telefonische instroom door hetzelfde model lopen, en een dossierzoeker.
> De triage volgt nog niet de Nederlandse Triage Standaard — zie `docs/09` §risico's.

Startscherm is de **stroom**, niet de agenda: binnenkomende triages (digitaal én
telefonisch), terugbelverzoeken, herhaalrecepten, post en uitslagen die gerouteerd
moeten worden. Meerdere dossiers tegelijk open (overgenomen uit HealthConnected,
`docs/10` §4). Triage volgens één model, ongeacht kanaal (`docs/12` §2.2).

## 3. Huisarts

> Geïmplementeerd in de werkplek: dagstart met spreekuur, een autorisatiescherm dat de
> stapel splitst in "vraagt jouw oordeel" en "routine, veilig in bulk", en een
> teamoverzicht met herkomst per registratie.

Startscherm is de **autorisatiestroom en het spreekuur**. Het autorisatiescherm is
bewust anders dan nu: geen lijst van 163 regels, maar gegroepeerd op type en risico,
met per groep de onderbouwing en veilige bulkafhandeling van het routinematige deel.
Wat een mens moet zien, staat bovenaan en is klein in aantal.

Verder: consultvoering, episodebeheer, medicatie, verwijzen, en het overzicht van wat
het team heeft gedaan — met herkomst zichtbaar.

## 3b. Praktijkmanager

Geen dossiertoegang (`docs/17` §2), wel het praktijkbeeld. Het scherm **Praktijk in
cijfers** beantwoordt de vraag die nu met een kwartaallijkse datadump naar Excel wordt
beantwoord: lopen we ergens zorg of geld mis doordat de registratie niet compleet is, en
waar zit dat dan?

Per keten: hoeveel patiënten, bij hoeveel de registratie compleet is, en waar het op
vastloopt — "23× funduscontrole ontbreekt". Dat laatste is de winst: een percentage zegt
dat er iets mis is, een knelpunt zegt wát.

De cijfers worden afgeleid uit dezelfde ketenindicatoren die het zorgproces toch al
gebruikt. Geen tweede registratie en geen tweede telling, zodat het cijfer van de manager
en het scherm van de POH niet uiteen kunnen lopen.

Wat er bewust níet staat: de namen achter een knelpunt. Die lijst is zorginhoudelijk en
hoort naar de POH te gaan, niet naar een beheerscherm.

## 4. Patiënt

Portaal/app conform MedMij. Ingang is niet het dossier maar **de volgende stap**:
wat moet ik doen, wanneer zie ik wie, wat waren mijn waarden, wat zijn mijn doelen.
Vragenlijsten, thuismetingen, herhaalmedicatie, berichten, zelfzorgadvies.

## 4b. De dag zelf: waar zit de patiënt

Een agenda die alleen tijden toont, dwingt je de hele ochtend te vragen "is hij er al?".
Elke afspraak heeft daarom een toestand, zichtbaar bij alle drie de rollen:

```
gepland → aangemeld (zuil of balie) → in de wachtkamer → in consult → afgerond
                                                              ↘ niet verschenen
```

De statussen komen in de praktijk van de aanmeldzuil en van de assistent aan de balie;
in de demo zijn ze afgeleid van één vast moment op de dag, zodat er iets te zien is.
Elke rol kan een status corrigeren — de zuil weet niet dat iemand aan de balie stond.

Twee dingen volgen er vanzelf uit. Boven de agenda staat de stand van de wachtkamer in
één regel ("1 aangemeld · 3 afgerond · 1 niet verschenen"), en het vastleggen van een
consult zet de afspraak zelf op afgerond. Dat laatste is het antwoord op "ik heb het
opgeslagen, maar waar is het gebleven": na het afronden verschijnt een bevestiging met
wat er is vastgelegd, welke orders eraan hangen en een knop naar het journaal.

## 4c. Het overleg

In de agenda van huisarts, POH en assistent staat op hetzelfde moment een overlegblok.
Dat blok had tot nu toe geen inhoud — je liep er met een papiertje naartoe.

De **bespreeklijst** is die inhoud: één gedeelde lijst, niet één per persoon. Vanuit
elk dossier zet je iemand erop met een vraag en de context uit het dossier erbij. Een
bespreekpunt is bewust geen bericht: een bericht heeft één ontvanger en is klaar als hij
gelezen is, een bespreekpunt hoort bij een moment en is pas klaar als er een antwoord
staat. De uitkomst blijft bij het punt, zodat na het overleg terug te vinden is wat er
besloten is en door wie.

De POH heeft daarnaast een blok **voorbereidingstijd** aan het begin van de dag. Dat is
werk, en werk hoort tijd in de agenda te krijgen — anders gebeurt het tussendoor en dus
niet.

## 4d. Behandelgrenzen

"Niet reanimeren" is geen dossierregel tussen de andere dossierregels. Het is een
afspraak die je moet zien vóórdat je iets doet, en als hij niet zichtbaar is wordt hij
niet nageleefd. Daarom staat hij als band boven het dossier, niet in het journaal:

```
⊘ BEHANDELGRENS
Reanimatie: Niet reanimeren. Patiënt wil geen reanimatie, onder alle omstandigheden.
· vastgelegd 2025-05-23 door Daan Verhoeven, besproken met patiënt en dochter
```

Drie dingen zijn verplicht bij zo'n afspraak: **met wie** hij besproken is (een
behandelgrens zonder gesprek is een aanname), **wanneer** (een afspraak van acht jaar
geleden vraagt om herbevestiging, en dat staat erbij), en **door wie**. Wat er verder
kan staan: IC-opname, ziekenhuisopname, antibioticabeleid, wilsverklaring, wettelijk
vertegenwoordiger.

Wie géén beperking heeft afgesproken maar wél een gesprek heeft gehad, krijgt een
neutrale band. Dat verschil — "niets afgesproken" versus "besproken en alles mag" — is
klinisch relevant en gaat in de meeste systemen verloren.

## 4e. Videoconsult

Vanuit de patiëntbalk, bij huisarts en POH. Het is een manier om dit consult te voeren
en geen andere soort zorg, dus het staat bij de patiënt en niet in een apart scherm.

De demo bouwt geen videoverbinding na — dat zou suggereren dat er iets werkt wat er niet
is. Wat er wél staat is het werkproces eromheen: hoe de patiënt de uitnodiging krijgt
(portaal als dat er is, anders sms, en dan staat erbij dat dat zwakker geauthenticeerd
is), dat het dossier ernaast open blijft, en dat je achteraf gewoon een deelcontact
registreert. Het beeld zelf komt van een ingebedde partij (`docs/14` §4).

## 4f. Acute instroom

Overdag komt wat niet kan wachten hier terecht en niet bij de huisartsenpost. Een spoedmelding
onderbreekt het scherm; minder urgente signalen komen als kaart rechtsonder. Elk signaal
draagt zijn onderbouwing en een voorstel, en **oppakken is een claim** die de andere rollen
direct zien. Zie [ADR-0013](adr/ADR-0013-acute-instroom-moet-zich-opdringen.md) en
`docs/19` §5.

## 5. Dossierdiepte

Een startscherm dat met werk opent, mag niet betekenen dat je er niet doorheen kunt.
Het dossier heeft daarom drie ingangen naast het consult zelf:

- **Journaal** — alle deelcontacten omgekeerd chronologisch, filterbaar op episode.
  De demo bouwt per patiënt vijf tot tien contacten over ongeveer drie jaar op, met
  SOEP-tekst, zodat er iets ís om op terug te kijken.
- **Metingen** — drie weergaven, want er zijn drie vragen. "Hoe loopt dit?" is een
  grafiek met de streefwaarde als stippellijn. "Wat stond er in die uitslag van maart?"
  is een tabel. "Hoe zag het labblad eruit?" is alle bepalingen naast elkaar per
  afnamemoment, met waarden buiten de referentie gemarkeerd. Plus een filter op soort
  (lab, lichamelijk, vragenlijst, verrichting), want een dossier van tien jaar heeft
  al snel dertig reeksen. Dit lost "was 84 — wanneer dan?" op: de waarde in het
  consultscherm is een ingang, niet een eindpunt.
- **Episodes** — de vier losse trajecten in de kop zijn aanklikbaar en filteren het
  journaal. Tijdens het consult kan een nieuwe episode worden aangemaakt (met
  terminologiezoeker) en kan het deelcontact daaraan worden gehangen.
- **Zorg buiten de praktijk** — wat via BgZ, e-Overdracht of als retourbericht
  binnenkwam, staat in dezelfde tijdlijn als de eigen contacten, maar in zijn eigen
  vorm. Zie ADR-0010. Per bron staat er een ingang naar het portaal van die instelling.

Het orderpad zit níet in de tabbalk maar in de linkerkolom van het consult, onder de
medicatie: **Medicatie · Verwijzing · Lab · Onderzoek · Afspraak**. Bestellen hoort bij
het moment waarop het besluit valt, niet bij een overzichtsscherm. Het ordertabblad is
wat daaruit gekomen is (docs/16).

**Het plan als tijdlijn.** "Het plan van deze patiënt" was volledig maar je moest het
lézen om te zien waar iemand in zijn jaar staat. Nu staat het als zorgreis: laatste
contact, vandaag, en de geplande contacten als haltes met datum, duur en de
aandachtsgebieden die bij die halte horen. De tekstuele uitwerking staat er nog steeds
onder — een plaatje zonder onderbouwing is een aanname, en dit plan is te
consequentieel om op een vormpje te vertrouwen. Bewust geen voortgangsbalk: een
chronische aandoening heeft geen eindpunt en een balk die voor 60% vol staat, suggereert
dat er ergens een 100% is.

**Wat de patiënt zelf aanleverde** blijft als zodanig zichtbaar. Per meting kies je bij
het vastleggen tussen *hier gemeten* en *door patiënt* — zie
[ADR-0012](adr/ADR-0012-patientgegevens-zijn-geen-eigen-registratie.md). Een waarde van
de patiënt telt mee in het beloop maar vult geen ketenindicator, en de indicator zegt dat
dan ook letterlijk in plaats van een gat te laten.

**Verrichtingen** hebben een eigen tabblad: aanvragen, uitvoeren, laten beoordelen. Met de
uitvoerder erbij — vaak de assistent — en een expliciete keuze wie de uitslag beoordeelt:
jij, de huisarts, of een specialist op afstand (`docs/19` §4).

**Wat er in het overleg besloten is**, staat als eigen soort in de tijdlijn: vraag,
context en uitkomst, met wie erbij waren. Geen SOEP, want er is geen patiënt gezien —
maar wel vindbaar, want er is wel iets besloten.

En, ondanks principe 1: **een patiëntzoekveld staat in de kopbalk, altijd.** Het
systeem opent met werk, maar iemand die belt terwijl je iets anders doet, moet in twee
toetsaanslagen gevonden worden.

## 6. Gedeelde ontwerpprincipes

1. **Het systeem opent met werk, niet met een zoekveld.**
2. **Elke lijst heeft een reden per regel.** Nooit een teller zonder context.
3. **Elke regel heeft een voorgestelde volgende stap.** Afwijken mag, met reden.
4. **Registreren gebeurt in de flow van het werk**, niet in een apart formulier achteraf.
5. **Hoge informatiedichtheid.** Zorgverleners willen overzicht in één blik, geen
   consumenten-UI met veel witruimte (bevestigd door alle drie de bestaande systemen).
6. **Herkomst is altijd zichtbaar** — wie, wanneer, mens of AI, bevestigd of niet.
7. **Toetsenbord eerst.** Elke veelgebruikte actie heeft een sneltoets; muis is optioneel.
8. **De agenda staat op het startscherm.** Elke rol begint met de eigen dag als tijdlijn,
   inclusief blokken (telefonisch spreekuur, visites, overleg) — niet alleen patiëntafspraken.
