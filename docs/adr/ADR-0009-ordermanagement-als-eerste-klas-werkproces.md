# ADR-0009 — Ordermanagement als eerste-klas werkproces, gevoed door beslissingsondersteuning

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0005, ADR-0007

## Context

Het systeem kon een patiënt beoordelen, een plan maken en een consult vastleggen,
maar er was geen plek om iets te **bestellen**. Geen medicatie, geen lab, geen
verwijzing, geen verrichting. De vraag van de opdrachtgever was terecht en kort:
"waar kan ik in vredesnaam medicatie orderen?"

Dat is geen ontbrekend scherm maar een ontbrekend werkproces. In een consult is de
order het moment waarop een besluit de praktijk verlaat: het gaat naar de apotheek,
het lab, de tweede lijn of een collega. Alles wat daarvoor gebeurt is voorbereiding.

Tegelijk is dit het moment met het grootste schadepotentieel. Metformine bij een
eGFR van 26 is geen registratiefout maar een klinische. En de POH mag het middel
wél voorstellen en níet voorschrijven — het onderscheid moet in het systeem zitten,
niet in de afspraak tussen mensen.

## Besluit

**1. De order is een set, geen regel.** Een besluit valt zelden in één regel uiteen.
"Start metformine" is: het recept, een controleafspraak, een nierfunctiebepaling over
drie maanden en een leefstijlnotitie. Het systeem kent negen ordersets, elk met
regels van vier soorten: `medicatie`, `lab`, `verwijzing`, `verrichting`.

**2. Beslissingsondersteuning stelt de set voor, met bron.** De ordersets worden
niet uit een menu gezocht maar aangeboden vanuit de aandachtsgebieden die op dat
moment aan staan, met dezelfde herkomstregel als de rest van de beslissings-
ondersteuning: welke richtlijn, welke paragraaf, welke link. Zonder bron geen voorstel.

**3. Contra-indicaties blokkeren vóór plaatsing, niet erna.** `controleer()` draait op
het dossier en levert waarschuwingen met een niveau. Een `blokkerend` niveau haalt de
regel uit de set; de gebruiker ziet wat er weggehaald is en waarom. De regels die er nu
in zitten zijn bewust conservatief en expliciet herleidbaar:

| Regel | Bron |
|---|---|
| Geen metformine bij eGFR < 30 | NHG-Standaard Diabetes mellitus type 2 |
| Maximaal 1000 mg metformine bij eGFR 30–45 | idem |
| RAS-remmer heroverwegen bij eGFR < 45 | NHG-Standaard CVRM |
| Medicatiebeoordeling bij ≥ 75 jaar en ≥ 5 middelen | Multidisciplinaire richtlijn Polyfarmacie |

**4. Rechten splitsen de set, ze verbergen hem niet.** `plaatsOrder()` verdeelt de
regels over `regels` (mag deze gebruiker uitvoeren) en `terAutorisatie` (mag hij
voorstellen). De POH-S heeft `medicatie-voorstellen` en niet `medicatie-voorschrijven`;
het recept komt daardoor in de autorisatiestroom van de huisarts terecht, met de
onderbouwing en de contra-indicatiecheck eraan vast. De POH ziet dus de hele set en
weet precies welk deel van haar handen gaat.

## Overwogen en verworpen

**Losse orderregels zonder set.** Technisch eenvoudiger en dichter bij wat bestaande
systemen doen. Verworpen omdat het de samenhang bij de gebruiker legt: die moet zelf
onthouden dat er na een nieuw middel een controle hoort. Precies dat vergeten is wat
ketenzorg met Excel-lijsten probeert te repareren.

**Contra-indicatiecheck bij het versturen.** Verworpen omdat de waarschuwing dan komt
nadat het besluit genomen en uitgelegd is aan de patiënt. De check hoort bij het
samenstellen van het voorstel, zodat het voorstel klopt.

**Autorisatie als aparte module.** Verworpen: de autorisatie ís de order, gezien vanaf
de andere kant. Dezelfde onderbouwing, dezelfde bron, dezelfde contra-indicaties — anders
beoordeelt de huisarts iets anders dan wat de POH voorstelde.

## Gevolgen

Ordermanagement erft de MDR-lijn uit ADR-0005: een voorstel voor een medicamenteuze
interventie is klinische beslissingsondersteuning en staat daarmee onder klasse IIa.
Het voorstel is nooit uitgevoerd tot een bevoegde gebruiker het bevestigt, en de
bevestiging is een `Provenance` met naam, rol en tijd — niet een vinkje.
