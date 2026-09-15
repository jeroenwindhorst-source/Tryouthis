# ADR-0003 — Eén zorgplan per patiënt, niet één per zorgprogramma

**Status:** aanvaard · **Datum:** 2026-09-15

## Context
Een patiënt met DM2, hypertensie en COPD doorloopt nu drie protocollen naast elkaar,
met drie oproepstromen en tot acht contacten per jaar waarvan de inhoud grotendeels
overlapt. Dat is inefficiënt én slechte zorg: de patiënt ervaart drie ziektes in
plaats van één leven.

De oorzaak is modelmatig: bestaande systemen kennen een zorgplan *per programma*.

## Besluit
Er is één `CarePlan` per patiënt. Zorgprogramma's zijn deelnemingen daarbinnen.
Protocolactiviteiten worden samengevoegd op drie niveaus: metingen (dezelfde meting
telt voor meerdere programma's), contactmomenten (één bezoek dekt meerdere
programma's) en beoordeling (één integrale beoordeling, niet drie protocollen na
elkaar).

Het bezoekritme volgt uit het kortste benodigde meetinterval; elke meting wordt
toegewezen aan het laatste bezoek dat nog vóór zijn vervaldatum valt.

## Alternatief afgewogen
*Greedy clustering van losse meetmomenten binnen een tijdvenster.* Verworpen: dat
levert een zwevend schema met veel kleine contacten op en gedraagt zich niet-monotoon
bij wijzigende intensiteit (intensiever beleid gaf minder contacten). Een vast ritme
met terugwaartse toewijzing sluit bovendien aan bij hoe protocollen in de praktijk
werken: kwartaalcontrole, jaarcontrole.

## Gevolgen
- Aantoonbaar minder contacten bij gelijke protocollaire dekking (zie de tests in
  `packages/care-engine/test/zorgplan.test.js`).
- Indicatorenrapportage moet per programma blijven kunnen rapporteren over een
  contact dat meerdere programma's bedient. De meting draagt daarom de lijst van
  programma's waarvoor zij telt.
- Afwijken van het protocol wordt een expliciete, geregistreerde keuze
  (`intensiteit`), geen ontbrekende registratie.
