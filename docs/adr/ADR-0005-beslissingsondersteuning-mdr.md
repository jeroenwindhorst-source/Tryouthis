# ADR-0005 — Beslissingsondersteuning als afgebakende, versioneerbare module

**Status:** aanvaard · **Datum:** 2026-09-15

## Context
Zodra het systeem een klinisch advies geeft dat het handelen beïnvloedt, is die
functie vermoedelijk een medisch hulpmiddel (MDR, waarschijnlijk klasse IIa).
Veel leveranciers omzeilen dit door adviezen te vermommen als "informatie". Dat is
juridisch wankel en inhoudelijk laf: het beperkt precies de functionaliteit die
de zorg nodig heeft.

## Besluit
We lopen de MDR-route niet weg, maar houden de scope zo klein mogelijk:

1. **Scheiding van risicoklassen.** Logistieke regels (oproepen, plannen, herinneren)
   staan in een andere motor dan klinische regels. Alleen de laatste valt onder de MDR.
2. **Afbakening.** De klinische regelmotor is een apart onderdeel met een eigen
   versienummer, niet verweven met de rest.
3. **Traceerbaarheid.** Elke vuurende regel legt vast: regel-id, versie, invoerwaarden,
   uitkomst, aan wie getoond, en wat de zorgverlener deed.
4. **Richtlijnherkomst.** Elke regel verwijst naar NHG-standaard of richtlijn met
   paragraaf en versie. Het veld `onderbouwing` is verplicht.
5. **Mens in de lus.** Geen enkele regel voert zelfstandig een klinische handeling uit.
   Afwijzen vraagt een reden — dat is tegelijk het beste verbetersignaal dat er is.

## Gevolgen
- Certificeringslast vóór de eerste omzet. Bewust geaccepteerd: het is ook een
  toetredingsdrempel voor concurrenten en een kwaliteitskeurmerk richting praktijken.
- De architectuur moet vanaf dag één traceerbaar zijn; achteraf inbouwen kan niet.
- De AI Act stelt vergelijkbare eisen aan AI-componenten; één mechanisme
  (`Herkomst`, `docs/03` §3) bedient beide.
