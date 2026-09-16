# ADR-0010 — Informatie van buiten in dezelfde tijdlijn, maar niet in dezelfde vorm

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0001, ADR-0002

## Context

Het journaal toonde alleen wat de praktijk zelf had vastgelegd: episodes met
deelcontacten in SOEP. Dat is de helft van het verhaal. Dezelfde patiënt is bij de
cardioloog geweest, heeft twaalf keer de fysiotherapeut gezien en krijgt tweemaal
daags thuiszorg. Die informatie komt binnen — als BgZ, als e-Overdracht, als
retourbericht via ZorgDomein, als brief — en verdwijnt in een postbak of in een los
documentenscherm dat niemand opent tijdens een consult.

De vraag is niet óf die informatie zichtbaar moet zijn, maar in welke vorm. Er zijn
twee voor de hand liggende antwoorden en beide zijn fout.

**Alles omzetten naar SOEP.** Dan staat het netjes in één stroom, maar een BgZ ís geen
SOEP: hij heeft vaste secties (behandelaars, diagnoses, verrichtingen, medicatie bij
ontslag, allergieën) die door de standaard zijn voorgeschreven. Die in vier letters
persen betekent kiezen wat je weglaat, en dat maakt de huisarts tot redacteur van een
document waar hij niet verantwoordelijk voor is.

**Een apart tabblad "documenten".** Dan blijft de vorm intact, maar de chronologie
breekt. De vraag "wat is er het afgelopen jaar met deze mens gebeurd" is dan niet meer
in één scherm te beantwoorden, en precies die vraag stel je aan het begin van elk
consult.

## Besluit

**Eén tijdlijn, twee vormen.**

De tijdlijn mengt eigen deelcontacten en externe documenten op datum van de zorg —
niet op datum van binnenkomst. Elk item houdt zijn eigen vorm: een eigen contact is
SOEP, een extern document toont de secties zoals ze binnenkwamen, met de naam van de
standaard erbij (`BgZ`, `e-Overdracht`, `retourbericht`, `brief`).

De bronnenkolom links is navigatie én verantwoording. Bovenaan de eigen episodes
(huisartsenzorg), daaronder de partijen waar deze patiënt ook komt, elk met het aantal
berichten en de standaard waarlangs ze binnenkomen.

**De datum van de zorg en de datum van binnenkomst staan allebei in het document.**
Het verschil ertussen is vaak het werkelijke probleem — een ontslagbrief die drie
weken onderweg was, verklaart waarom de patiënt met een vraag belde die de praktijk
niet kon beantwoorden.

**Externe informatie telt niet automatisch mee in de beslisregels.** Dezelfde regel als
bij AI-suggesties (ADR-0005): wat niet door een eigen zorgverlener is vastgelegd of
bevestigd, is geen registratie van deze praktijk. Een HbA1c uit een BgZ vult de
ketenindicator dus niet vanzelf. Dat is bewust ongemakkelijk: het maakt zichtbaar dat
er een handeling nodig is om iets over te nemen, in plaats van dat er stilzwijgend
gegevens van een ander in je verantwoording terechtkomen.

**De portaallink is geen koppeling.** Bij een bron staat waar je zelf verder kunt
kijken (Epic Care Link, een ZorgPortaal, het thuiszorgdossier). Dat is eerlijk over wat
het is: het HIS haalt die gegevens niet op, maar de ingang staat wél op de plek waar je
hem zoekt in plaats van in een bladwijzerlijst.

## Gevolgen

Het datamodel krijgt een tweede soort journaalitem naast het deelcontact. Dat is een
echte uitbreiding en geen view: een extern document heeft een bron, een standaard, een
ontvangstdatum en een sectiestructuur die het deelcontact niet heeft.

In de FHIR-facade (docs/08) landt dit op `DocumentReference` plus `Composition` voor de
BgZ, en op de zib-gebaseerde bundels voor de e-Overdracht. In deze fase is het een
eigen model met synthetische inhoud; de mapping is nog niet gebouwd.

Wat nog ontbreekt: overnemen van losse gegevens uit een BgZ naar het eigen dossier
(met herkomst), en de LSP/Nuts-adressering waarlangs dit werkelijk binnenkomt.
