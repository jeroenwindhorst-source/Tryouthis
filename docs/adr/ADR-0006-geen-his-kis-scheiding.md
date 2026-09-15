# ADR-0006 — Geen HIS/KIS-scheiding

**Status:** aanvaard · **Datum:** 2026-09-15

## Context
In de procesplaat van de opdrachtgever draagt de baan van de POH-S het label
**"HIS / KIS / ?"**. Dat vraagteken is het probleem: chronische zorg staat deels in
het HIS (journaal, episodes, medicatie), deels in een KIS (zorgprogramma, indicatoren,
ketenDBC), deels in een telemonitoringportaal en deels in Excel (inclusie en oproep).
Elke overgang is een handmatige actie met dubbele registratie en verlies van context.

Het KIS bestaat historisch omdat HIS'en geen zorgprogramma's konden. Het is een
pleister, geen ontwerp.

## Besluit
Zorgprogramma's, inclusie, indicatoren, oproep en monitoring zijn functies ván het
dossier, niet van een satellietsysteem. Er is geen KIS.

Eén uitzondering blijft bewust extern: **telemonitoring**. Dat is een markt met veel
leveranciers en fysieke apparaten; wij consumeren die via FHIR `Observation` +
`Device` in plaats van hem na te bouwen.

## Gevolgen
- Ketenzorgorganisaties en zorggroepen zijn belanghebbende partijen: hun
  indicatorenrapportage moet uit ons systeem kunnen komen, anders ontstaat het KIS
  opnieuw. Rapportage is daarom geen sluitpost (docs/09, fase 2).
- Declaratie van ketenzorg moet in het systeem zelf correct en compleet ontstaan.
- Commercieel is dit de opening: een KIS-vervanger is een duidelijker verhaal dan
  "nóg een HIS", en de praktijk hoeft haar HIS niet te vervangen om te beginnen.
