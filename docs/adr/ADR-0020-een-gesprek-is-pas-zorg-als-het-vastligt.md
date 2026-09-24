# ADR-0020 — Een gesprek is pas zorg als het vastligt

**Status:** aanvaard · **Datum:** 2026-09-24 · **Vult aan:** ADR-0009, ADR-0019 · **Raakt:** docs/19

## Context

ADR-0019 regelde dat een knop werk oplevert: een taak met een ontvanger, een aanleiding en
een status. Bij het demonstreren van die keten bleken er twee gaten te zitten — allebei
precies op het punt waar het werk werkelijk gedaan wordt.

**Het eerste gat: het ingeplande blok wist niets.** Je sleept *"bellen over het
bloedonderzoek"* naar twintig minuten vrij, je klikt erop, en dan staat er wat je er zelf
in getypt had toen je hem uitzette. Terwijl de vraag op dát moment een andere is: *wat komt
er bij deze mens eigenlijk nog tekort?* Dat stond allemaal in het systeem — welk onderdeel
ontbreekt (aanloop), wanneer de afspraak is (zorgplan), wat er verder speelt (signalen),
hoe je hem bereikt (dossier) — maar verspreid over vier schermen, en je zat op de vijfde.

**Het tweede gat: 'gesprek vastleggen als contact' legde niets vast.** De knop sloot het
belvenster. Daarna stond er niets in het journaal. Dat is erger dan geen knop: iemand denkt
dat het vastligt terwijl er niets staat, en de volgende collega belt opnieuw. Een notitie
maken bij dat gesprek kon evenmin.

Hetzelfde gat zat bij het groepsconsult. Wie erbij was, stond er; wat er voor ieder van hen
uit kwam, niet — terwijl dat voor acht mensen in acht dossiers moet landen.

## Besluit

**1. Een geplande taak opent een taakdossier, niet de taak.**
Elk ingepland blok en elke regel op de werklijst opent hetzelfde venster, dat de vraag
*"wat komt er bij deze mens tekort"* beantwoordt in plaats van de taak te herhalen. Het
bevat, in deze volgorde: wat er ontbreekt (per onderdeel: binnen / nog niet binnen / te
laat, met de doorlooptijd en de resterende dagen), de afspraak waar het om gaat, wat er
verder speelt, een **gespreksdoel** van een paar zinnen, waarom de taak bestaat, en hoe je
deze mens bereikt.

Het taakdossier rekent niets nieuws uit: het haalt zijn onderdelen uit de aanloop, het
zorgplan, de signalen en de bereikbaarheid. Dat is opzet — twee plekken die hetzelfde
zouden moeten berekenen, gaan uiteenlopen.

**2. Een telefoontje is een contact, met dezelfde structuur als elk ander contact.**
Het belvenster legt vast als `Encounter` met contactvorm *telefonisch*, uitvoerder, duur en
declaratiebeeld, plus een `Deelcontact` met SOEP aan een episode. Twee velden, niet meer:
**wat is er gezegd** (S) en **wat is er afgesproken** (P). De episode wordt voorgesteld
vanuit de lopende episodes en is te wijzigen.

Kwam het gesprek uit een werktaak voort, dan wordt die taak in dezelfde handeling afgerond
met de notitie als uitkomst. Anders moet de gebruiker twee keer hetzelfde vertellen.

**3. Zonder notitie landt het contact wél, maar zonder prestatie.**
De verleiding is om de notitie verplicht te stellen. Dat is verkeerd: er *is* gebeld, en
een dossier waarin een deel van de zorg onzichtbaar is, is geen dossier. Dus het contact
gaat het journaal in, en het declaratiebeeld zegt erbij dat een telefonisch consult pas een
prestatie is als er inhoudelijk iets is vastgelegd (docs/19). Het systeem dwingt niet — het
laat zien wat het gevolg is.

**4. Een groepsconsult registreert per deelnemer, in het eigen dossier.**
Het consult kan gestart worden; daarna staat er per deelnemer een veld. Wat daar wordt
getypt, landt als contact in het dossier van díe mens en nergens anders. De contactvorm is
`groepsconsult` en is **niet declarabel per deelnemer**: een groepsconsult wordt binnen de
ketenzorg of als aparte afspraak met de verzekeraar geregeld. Dat staat er ook bij, in
plaats van een consultprestatie voor te spiegelen die er niet is.

## Gevolgen

- Een blok in de agenda is een ingang geworden en geen tekstje meer. `AgendaRegel` draagt
  daarvoor een `taakId`.
- Het aantal plekken waar een `Encounter` ontstaat groeit van één (het consultscherm) naar
  drie (consult, telefoontje, groepsconsult). Alle drie lopen door `registreerConsult`, dus
  de declaratiebeoordeling, de herkomst en het journaal blijven één implementatie.
- De demopopulatie moet gegarandeerd één afspraak bevatten waarvan de voorbereiding het
  niet meer haalt. Zonder dat contrast is de aanloop een lijst met herinneringen en is er
  niets te laten zien; een test bewaakt het.
- Nog niet geregeld: een belpoging waarbij niemand opneemt. Dat is geen contact en hoort
  dus geen `Encounter` te worden, maar het hoort wél ergens te blijken — anders belt de
  volgende collega opnieuw. Voorlopig los je dat op met een notitie in de taak.
