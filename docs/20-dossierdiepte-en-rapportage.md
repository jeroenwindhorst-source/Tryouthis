# 20 — Dossierdiepte, media, groepsconsulten en rapportage

*Wat er gebeurt zodra je een dossier langer dan één consult gebruikt: het terugzoeken, het
overzicht vooraf, de bestanden die erbij horen, zorg die niet één-op-één is, en de vraag
over de hele praktijk.*

---

## 1. Het overzicht als eerste scherm — of niet

Een dossier openen kan twee dingen betekenen. Je kent deze mens niet en wilt weten wie het
is; of je kent hem wel en wilt meteen registreren. Allebei komen voor, bij dezelfde
zorgverlener op dezelfde dag, en allebei zijn ze legitiem.

Daarom is er een tab **Overzicht** vóór **Consult**, en staat in *Mijn voorkeuren* met welke
van de twee een dossier opent. Dat is een persoonlijke instelling en geen praktijkinstelling:
het raakt de zorg niet, alleen de manier van werken (docs/14).

Het overzicht bevat drie dingen:

- **In het kort** — de samenvatting (§2);
- **Waar staat deze patiënt** — de zorgreis, met de geplande contacten;
- **Kerngetallen en aandachtsgebieden** — leeftijd, actieve episodes, chronische medicatie,
  contacten dit jaar, eigen metingen, wat er van buiten binnenkwam.

## 2. De samenvatting

Zie [ADR-0014](adr/ADR-0014-samenvatting-is-regelgebaseerd.md).

Zeven vaste vragen, elk beantwoord uit gestructureerde gegevens, elk met de bron eronder:
wie is dit · wat speelt er · hoe gaat het · wat kan deze mens zelf · wat gebeurde er het
afgelopen jaar · wat staat er open · waar liggen de grenzen.

**Het is nadrukkelijk geen gegenereerde tekst.** Een samenvatting stuurt waar een
zorgverlener naar kijkt en is daarmee beslissingsondersteuning (ADR-0005). Die moet per
bewering herleidbaar zijn, en dat kan een taalmodel niet garanderen. De alternatieven en de
MDR-redenering staan in de ADR; onder het blok staat in het scherm zelf één alinea die
uitlegt hoe het tot stand komt, want een samenvatting zonder die uitleg wordt vanzelf voor
meer aangezien dan hij is.

## 3. Het hele contact terugzoeken

In het journaal staat per contact de SOEP-tekst. Dat is niet wat er op dat moment is
vastgelegd — dat is een deel ervan. Er zijn ook metingen gedaan, orders uitgezet, een
verrichting verricht, een declaratieregel ontstaan.

**"Het hele consult"** is een knop bij elke journaalregel. Wat erachter zit, staat in de
volgorde waarin het gebeurde:

1. **Wie, en wat er toen bekend was** — naam, de leeftijd van tóén, de episodes die op dat
   moment liepen, de beleidsafspraken die toen al vastlagen;
2. **de hulpvraag**, als die is vastgelegd;
3. **wat er is opgeschreven** — de SOEP per deelcontact, want één contact kan meerdere
   episodes raken (docs/03 §2);
4. **wat er is gemeten** — met per meting of het een eigen registratie is of niet (ADR-0012);
5. **wat er is uitgezet** — de orders met hun status;
6. **verrichtingen** met hun uitkomstvelden en conclusie;
7. **administratie en herkomst** — declaratieregel, herkomst, contact-id.

Het gaat om reconstrueerbaarheid. Wie over een jaar wil weten waarom hij toen iets besloot,
moet kunnen zien wat hij op dát moment voor zich had — en niet wat er sindsdien bij is
gekomen. Daarom hangt elke meting aan zijn contact (`Observation.encounter`) in plaats van
alleen aan een datum.

### Een contact zonder SOEP is nog steeds een contact

Het journaal wordt opgebouwd uit de contacten, niet uit de deelcontacten. Een
bloeddrukcontrole bij de assistent waarbij alleen getallen zijn ingevoerd, heeft geen
SOEP-tekst en zou anders uit het journaal verdwijnen. Er is dan wél zorg geleverd, en een
dossier waarin een deel van de zorg onzichtbaar is, is geen dossier.

### Wat de patiënt zelf bewaarde

Een waarde die de patiënt zelf doorgeeft komt als **eigen meting** in de tijdlijn, per dag
gegroepeerd, met de herkomst erbij en met de regel eronder dat hij geen ketenindicator vult
tot een zorgverlener hem heeft overgenomen (ADR-0012). Los per meting zou het journaal
onleesbaar worden bij iemand die dagelijks meet; helemaal weglaten zou betekenen dat wat
iemand zelf doet alleen in een grafiek bestaat.

### De voorbereiding uit de wachtkamer

Die staat óók in de tijdlijn: als eigen soort, met de leverancier erbij, met de
codesuggesties en hun vertrouwensscore, en met de status of een mens het heeft bevestigd. Het
is geen consult en geen registratie van ons — het is een suggestie van een externe partij, en
zo staat het er (docs/03 §3).

## 4. Media

Een dossier bevat niet alleen tekst en getallen. Er komen pdf's binnen van het ziekenhuis, de
patiënt stuurt een foto van een wond via het portaal, de praktijk produceert zelf een
ECG-strook of een spirometrieverslag.

De tab **Media** toont ze als kaarten, met:

- **filters** op soort (document, foto, scan, meetstrook) en herkomst (ziekenhuis, thuiszorg,
  paramedisch, patiënt, praktijk), plus vrije tekst over titel, categorie en omschrijving;
- **de koppeling**: aan welk extern bericht, welk contact of welke verrichting dit hoort — met
  een knop die naar dat item in de tijdlijn springt;
- **ongelezen-markering**, zodat wat binnenkomt niet stilletjes in een map verdwijnt.

De demo bevat geen echte bestanden. Wat er staat is de metadata en de koppeling — het deel dat
een dossier moet regelen. De opslag zelf hoort in een documentvoorziening met eigen
versiebeheer en logging; het dossier verwijst ernaar.

## 5. Groepsconsulten

Een POH — en soms de huisarts — doet een deel van de zorg in groepen: leefstijl bij diabetes,
ademhalingsoefeningen bij COPD, stoppen met roken, een bijeenkomst voor kwetsbare ouderen.

Dat is één blok in de agenda met meerdere patiënten erin, en het is geen serie losse
consulten. Het scherm werkt daarom vanuit het blok:

- **een eigen menu-ingang** bij de POH en de huisarts, want het is een eigen werkvorm en geen
  variant op het spreekuur;
- **plannen als blok** — datum, tijd, duur, plaats, aantal plekken, thema met een vast
  programma. Het blok komt in de agenda van de begeleider te staan; zonder dat reserveert het
  niets en plant iemand er een spreekuur overheen;
- **deelnemers** met een status: uitgenodigd, aangemeld, aanwezig, afgezegd, niet gekomen;
- **voorgestelde deelnemers** — patiënten bij wie het aandachtsgebied van dit thema actief is
  en die er nog niet op staan, mét de onderbouwing erbij. Een voorstel zonder reden is een
  willekeurige lijst;
- **toevoegen via ordermanagement**: een deelname aan een groepsconsult is een order als elke
  andere, zodat hij vanuit het consult uitgezet kan worden (docs/16).

**Registratie gebeurt na afloop, per deelnemer.** Het consult is gezamenlijk, het dossier niet:
ieder krijgt zijn eigen deelcontact met wat er voor hém uit kwam. Eén gedeelde notitie zou
betekenen dat in het dossier van de één staat wat de ander heeft gezegd.

## 6. Rapporten

Zie [ADR-0015](adr/ADR-0015-rapportage-op-dezelfde-gegevens.md).

Onder *Praktijk* staat **Rapporten**: zoeken over de hele praktijk met dezelfde gegevens
waarmee het zorgproces draait. Geen aparte querydefinities die na een half jaar uit de pas
lopen met het scherm van de POH.

**De zoekvraag** is een korte lijst: aandachtsgebied, ketenzorg, ontbrekende indicator,
leeftijd van/tot, zelfredzaamheid onder, chronische middelen vanaf, niet gezien sinds,
meetwaarde boven. Een querybuilder over honderd velden wordt door niemand gebruikt.

**Het resultaat** is een aantal, een verdeling over aandachtsgebieden, en een patiëntenlijst
waarin de kolommen volgen uit wat je gevraagd hebt. Wie op een ontbrekende indicator zocht,
ziet wat er ontbreekt; wie op een meetwaarde zocht, ziet die waarde.

**Doorklikken naar het dossier** hoort erbij, want een rapport is een werklijst. De
praktijkmanager ziet dezelfde aantallen zonder die knop: autorisatie hangt aan de rol en niet
aan het scherm (docs/17).

**Export gaat alleen geaggregeerd.** Geen namen, geen BSN, geen geboortedatum; leeftijd als
klasse; groepen kleiner dan vijf samengevoegd. Bij tweeduizend ingeschrevenen is "1 patiënt,
85+, COPD" geen statistiek maar een naam.

## 7. De kleine dingen uit dezelfde ronde

- **De linkerbalk staat vast.** De applicatie is een schil van schermhoogte waarin alleen het
  werkblad scrolt. Een menu dat meescrolt met een lang dossier, is een menu dat je kwijtraakt.
- **De tegels op de dagstart zijn knoppen**, bij alle drie de zorgrollen. Ze stonden er al bij
  de POH; bij de huisarts en de assistent waren het plaatjes.
- **Berichten** splitst patiënten en collega's in twee grote bakken boven de lijst in plaats
  van een schakelaartje in de hoek. Het verschil bepaalt wat je met een bericht mág doen — een
  patiëntvraag kan zorg worden, met een eigen contactvorm en declaratieregel (docs/19).
- **Monitoren** zet elke patiëntregel in vaste kolommen, zodat je de lijst verticaal kunt
  lezen, en kleurt de suggestieknop zodra er iets achter zit. Zijn er geen suggesties, dan
  staat dat er — anders klap je open om te ontdekken dat er niets is.
- **Plannen** zet de eigen agenda vooraan en breder voor de POH en de huisarts; de assistent
  plant voor de hele praktijk en houdt drie even brede kolommen.
- **De blokken in het consultscherm** staan in de volgorde van het gesprek: eerst wat aandacht
  vraagt, dan wie deze mens is, dan wat hij gebruikt, dan wat je kunt uitzetten, dan wat er
  gepland staat.

## 8. Wat hier nog niet zit

- **Echte bestandsopslag.** Media zijn metadata plus koppeling; er is geen documentvoorziening,
  geen virusscan, geen versiebeheer en geen `DocumentReference`-mapping.
- **Registratie ná een groepsconsult** is beschreven maar niet gebouwd: de deelnemerstatus
  gaat wel naar *aanwezig*, het per-deelnemer deelcontact nog niet.
- **Opgeslagen zoekvragen** die je periodiek opnieuw draait, en vergelijking met andere
  praktijken in de zorggroep.
- **Verouderingsnormen in de samenvatting**: er staat wel bij hoe oud een waarde is, maar de
  samenvatting markeert nergens zelf dat iets te oud is om op te varen.
- **Alinea's aan- of uitzetten per praktijk.** De regelset is nu voor iedereen dezelfde.
