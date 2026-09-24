# 19 — Contactvormen, verrichtingen en declaratie

## 1. De vorm hoort bij het contact, niet bij de declaratie

Een consult op de praktijk, een videoconsult, een e-consult en een telefoontje zijn vier
verschillende dingen. Klinisch, omdat je verschillende dingen kunt waarnemen.
Administratief, omdat er verschillende prestaties tegenover staan. En juridisch, omdat de
zekerheid over met wie je spreekt per kanaal verschilt.

In de meeste systemen is dit één vinkje achteraf, ingevuld door degene die de declaratie
doet. Dat is precies verkeerd om: **de vorm is bekend op het moment van het contact**, en
wie hem later moet reconstrueren, gokt.

Daarom staat de contactvorm in het registratieblok, naast de SOEP, en volgt de declaratie
eruit.

| Vorm | Prestatie | Identificatie |
|---|---|---|
| Consult op de praktijk | duurstaffel < 20 / ≥ 20 min | persoonlijk |
| Visite | duurstaffel < 20 / ≥ 20 min | persoonlijk, thuis |
| Telefonisch consult | telefonisch consult | stemherkenning of controlevraag — zwakker |
| E-consult (bericht) | consult via portaal | portaal met DigiD |
| Videoconsult | duurstaffel als op de praktijk | beeld plus portaal — sterker dan telefonisch |
| Verrichting | verrichtingenlijst | persoonlijk |
| Herhaalrecept | **niet declarabel** — zit in het inschrijftarief | portaal of apotheek |
| Intern overleg | **niet declarabel** — geen contact met de patiënt | n.v.t. |

De duurstaffel wordt **afgeleid en niet gevraagd**. Een lang consult dat als kort wordt
vastgelegd is een fout, geen keuze.

## 2. Het declaratiebeeld vóór het afronden

Onder het registratieblok staat wat deze registratie oplevert, en wat er eventueel nog
ontbreekt:

```
€ Consult van 20 minuten en langer   CONSULT-LANG
Voldoet aan de voorwaarden voor consult van 20 minuten en langer.
Voorwaarden: Duur vastgelegd in het dossier · Inhoudelijke zorgvraag
```

of, als er iets mist:

```
€ E-consult (bericht)   CONSULT-EMAIL
Nog niet declarabel; vul aan wat hierboven ontbreekt.
· niet aan een episode gekoppeld
```

Dat staat er niet om tot declareren aan te zetten. Het omgekeerde gebeurt vaker: werk dat
gedaan is en niet vergoed wordt omdat één veld leeg bleef. Wie dat aan het eind van het
kwartaal ontdekt, kan er niets meer aan doen.

> ⚠️ De prestatiecodes zijn **niet geverifieerd** tegen de actuele NZa-beleidsregel
> huisartsenzorg. De structuur klopt — consulten met een duurstaffel, visites apart,
> digitale contacten die meetellen als ze inhoudelijk zijn — maar codes en voorwaarden
> moeten vóór gebruik tegen de actuele regelgeving worden gelegd.

## 3. Een patiëntbericht wordt een contact

In het berichtenscherm kies je bij het antwoorden wat dit wordt: e-consult, telefonisch,
videoconsult of herhaalrecept. Je kiest ook de episode — of je maakt er een aan, zonder
eerst het dossier te hoeven openen.

Het antwoord gaat dan in één handeling twee kanten op: naar de patiënt, en als deelcontact
het journaal in (de vraag onder S, jouw antwoord onder P, met de contactvorm erbij).

Zonder dat blijft een e-consult een briefje in een postbak. Het is in een gemiddelde
praktijk het snelst groeiende contactkanaal en het slechtst vastgelegde.

## 4. Verrichtingen: aanvraag, uitvoering, beoordeling

Een order voor een ECG is niet af als het ECG gemaakt is. Drie handelingen door mogelijk
drie verschillende mensen:

```
aanvragen (huisarts)  →  uitvoeren (assistent)  →  beoordelen (huisarts of specialist)
```

Het tabblad **Verrichtingen** in het dossier houdt dat spoor vast. Bij het vastleggen van
de uitkomst horen drie dingen:

1. **Wie hem uitvoerde** — vaak de assistent, en dat is een andere persoon dan de
   aanvrager. Zonder dat veld is achteraf niet te zien wie wat deed.
2. **Wat eruit kwam** — gestructureerd waar dat kan. Een vrijetekstconclusie is niet terug
   te vinden en telt nergens in mee.
3. **Wie hem beoordeelt** — zelf, de huisarts, of een specialist op afstand.

Die derde optie is de interessantste. **Teleconsultatie**: het ECG gaat met een
vraagstelling naar de cardioloog, antwoord doorgaans binnen een werkdag. Dat is een eigen
prestatie en telt niet als verwijzing — het voorkomt er juist een als het beeld goedaardig
blijkt.

Wat er in de demo zit: ECG, spirometrie, 24-uurs bloeddrukmeting, enkel-armindex, wratten
aanstippen, audiometrie, uitstrijkje en voetonderzoek. Elk met eigen uitkomstvelden en, waar
van toepassing, een bandbreedte.

**Een uitkomst buiten de bandbreedte gaat naar de autorisatiestroom**, niet naar een la. De
assistent die een ECG met een frequentie van 112 en boezemfibrilleren vastlegt, krijgt dat
te zien én het komt bij de huisarts terecht. Getalwaarden gaan in dezelfde meetreeks als
dezelfde waarde uit het lab: een FEV1 uit een spirometrie is geen andere FEV1.

## 5. Acute instroom

Zie [ADR-0013](adr/ADR-0013-acute-instroom-moet-zich-opdringen.md).

De dag is gepland en dan belt er iemand. Overdag gaat dat niet naar de huisartsenpost: het
moet hier, nu, door iemand worden opgepakt.

- **Spoed** krijgt een modaal venster dat je moet wegklikken.
- **Binnen een uur** en **vandaag** krijgen een kaart rechtsonder die je kunt laten staan.

Alles even hard laten schreeuwen is hetzelfde als niets laten schreeuwen.

Elk signaal draagt drie dingen: de samenvatting, **waarom dit acuut is**, en een voorstel.
Dat tweede is niet optioneel — zonder onderbouwing is het een onderbuikgevoel van een
systeem.

**Oppakken is een expliciete handeling.** Een signaal staat bij meerdere rollen tegelijk;
wie klikt, claimt het en de rest ziet dat. Zonder die claim gaan er twee mensen bellen of
geen enkele. Een tweede klik op een al opgepakt signaal doet niets.

## 6. Wat hier nog niet zit

- **Declaratie-export.** Er is geen bestand, geen VECOZO-koppeling en geen controle op
  dubbeldeclaratie binnen dezelfde dag.
- **Verrichtingentarieven** (M&I) zijn niet gemodelleerd; alle verrichtingen delen één
  prestatie.
- **De terugkoppeling van een teleconsult** is een status, geen mechanisme. Het antwoord
  van de specialist hoort als extern document in de tijdlijn te landen (ADR-0010).
- **Push in plaats van pollen.** De acute instroom wordt elke tien seconden opgehaald. In
  productie is dat een pushverbinding.


## Hoe bereik je deze mens?

Zodra het systeem *bel deze patiënt* als taak kan uitzetten (ADR-0019), moet het ook
kunnen beantwoorden **hoe**. Dat ontbrak: het dossier kende wel een telefoonnummer, maar
geen enkel scherm liet het zien — dus werd het in een ander systeem opgezocht, of aan de
assistent gevraagd.

De bereikbaarheid staat nu op drie plekken, en overal hetzelfde:

- als knop **Bellen** in de patiëntbalk, naast Videobellen — dezelfde vraag op hetzelfde
  moment;
- als kaart **Bereikbaarheid** op het overzichtstabblad;
- **uitklapbaar bij de taak zelf** in de werklijst, zodat je niet het dossier in hoeft om
  een nummer te zoeken dat je nu nodig hebt.

Wat erin staat is bewust meer dan een nummer:

| Onderdeel | Waarom het erbij staat |
|---|---|
| Mobiel en vast, apart | Een mobiel dat overdag uitstaat en een vaste lijn waar wel wordt opgenomen zijn niet hetzelfde nummer |
| Het voorkeurskanaal | Wie heeft aangegeven het portaal te willen, bel je niet als eerste |
| Een notitie over bereikbaarheid | *'Werkt tot 16:00'*, *'slechthorend, spreek rustig'* — dat staat nu op briefjes en in hoofden, en je hebt het nodig vóórdat je belt, niet erna |
| De naaste, met wat die mag horen | Informeren is iets anders dan meebeslissen; die grens hoort vast te liggen vóórdat iemand hem nodig heeft |

Het belvenster is geen kiezer en geen telefooncentrale — die zit in de telefonie, niet in
het dossier. Wat het wél doet, is het gesprek als **contact** klaarzetten zodra je
ophangt: een telefonisch consult is een contactvorm met een eigen declaratieregel, geen
aantekening bij een ander consult.
