# ADR-0008 — Zelfredzaamheid als zelfstandige factor naast de klinische situatie

**Status:** aanvaard · **Datum:** 2026-09-15 · **Vult aan:** ADR-0007

## Context

Het protocol bepaalde de contactfrequentie uit twee dingen: het basisinterval van de
richtlijn en de feitelijke meetwaarden van de patiënt. Daarnaast stond `intensiteit`
als handmatige knop.

In de praktijk werkt de opdrachtgever primair met **zelfredzaamheid** en een daaraan
gegeven score, en die score bepaalt mede hoe vaak iemand gezien wordt. Dat is niet
hetzelfde als klinische intensiteit, en het is ook geen zachte context bij het consult:
het is een sturende variabele.

Het probleem met alleen klinisch sturen is scherp te benoemen. De stabiele, zelfredzame
patiënt komt trouw elk kwartaal omdat het protocol dat zegt. Degene die het eigenlijk
niet redt, verdwijnt uit beeld zodra de waarden meevallen — en komt terug wanneer er veel
meer nodig is. Het systeem roept dus stelselmatig de verkeerde mensen op.

## Besluit

Zelfredzaamheid wordt een eerste-klas factor in het zorgplan, met de domeinen van de
Zelfredzaamheid-Matrix als structuur (elf leefgebieden, score 1–5).

Het ongewogen gemiddelde levert een factor op alle controle-intervallen: ×0,5 bij acute
problematiek tot ×1,6 bij volledige zelfredzaamheid. Die factor vermenigvuldigt met de
situatiefactor uit het protocol en met intensiteit — het zijn drie verschillende vragen.

Daarnaast werkt de score door op drie andere plekken:
- lage leefdomeinen activeren aandachtsgebieden, ook zonder diagnose;
- digitale bereikbaarheid bepaalt het oproepkanaal;
- lage of dalende zelfredzaamheid weegt mee in de volgorde van het monitoringcohort.

## Waarom ongewogen gemiddelde

Een wegingsformule suggereert precisie die er niet is en maakt de uitkomst voor de
zorgverlener oncontroleerbaar. Elk leefdomein telt daarom even zwaar, en de knelpunten
per domein worden altijd getoond naast het getal. Het getal is de ingang, niet het
antwoord.

## Gevolgen

**Positief**
- Twee patiënten met identieke waarden kunnen aantoonbaar verschillende zorg krijgen,
  en het systeem legt uit waarom.
- Kwetsbaarheid en mentaal welbevinden komen in beeld via het leefdomein in plaats van
  via een diagnose — precies het gat dat een diagnosegestuurd systeem laat vallen.
- De trend is een eigen signaal: een dalende score voorspelt uitval beter dan een
  enkele afwijkende meetwaarde.

**Negatief**
- Er is nu een afname nodig. Zonder ZRM verandert er niets aan het protocol, maar dan
  mist het systeem ook zijn belangrijkste sturingsvariabele. Dat maakt de afname zelf
  een werkstap die georganiseerd moet worden.
- Twee knoppen die op elkaar lijken (intensiteit en zelfredzaamheid) vragen uitleg in de
  interface, anders worden ze door elkaar gebruikt.
- De ZRM is een extern instrument met eigen licentievoorwaarden; de scoringsankers
  moeten vóór praktijkgebruik worden geverifieerd.

## Alternatief afgewogen

*Zelfredzaamheid verwerken in `intensiteit`.* Verworpen: dan verdwijnt het onderscheid
tussen "deze patiënt is ontregeld" en "deze patiënt redt het zelf niet", terwijl die
twee verschillende interventies vragen. Bij de eerste pas je behandeling aan, bij de
tweede de vorm en frequentie van contact — en soms het sociaal domein.
