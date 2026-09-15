# 15 — Zelfredzaamheid als tweede factor

## 1. Twee vragen, allebei waar

"Hoe vaak moet ik deze patiënt zien" heeft twee antwoorden die los van elkaar staan:

1. **Hoe staat het er klinisch voor?** Een ontregelde HbA1c vraagt vaker contact. Dat zit
   in de intervalregels van het protocol (`docs/04` §3, laag 2).
2. **Hoeveel kan deze mens zelf?** Iemand die zijn medicatie beheert, thuis meet en aan
   de bel trekt bij afwijkingen heeft minder contact nodig dan iemand die dat niet kan —
   bij exact dezelfde waarden.

Systemen die alleen de eerste vraag stellen, roepen stelselmatig de verkeerde mensen op.
De stabiele, zelfredzame patiënt komt trouw elk kwartaal omdat het protocol dat zegt. En
degene die het eigenlijk niet redt, verdwijnt uit beeld zodra de waarden meevallen — en
komt terug op een moment dat er veel meer nodig is.

## 2. Het model

Structuur volgens de **Zelfredzaamheid-Matrix**: elf leefdomeinen, elk gescoord van
1 (acute problematiek) tot 5 (volledig zelfredzaam).

| Domein | Wat het betekent voor de zórg |
| --- | --- |
| Financiën | Kan iemand eigen risico en hulpmiddelen betalen? Zorgmijding begint hier |
| Dagbesteding | Structuur in de dag bepaalt medicatietrouw en bewegen |
| Huisvesting | Zonder stabiele woonsituatie is thuismeting niet realistisch |
| Huiselijke relaties | Steun of juist belasting thuis; bepaalt of afspraken standhouden |
| Geestelijke gezondheid | Weegt zwaar: somberheid ondermijnt zelfmanagement bij elke chronische ziekte |
| Lichamelijke gezondheid | Hoe iemand zijn gezondheid kan managen, los van de diagnose |
| Middelengebruik | Raakt vrijwel elk aandachtsgebied |
| Dagelijks functioneren | Lukt zelfzorg, boodschappen, medicatie klaarzetten? |
| Sociaal netwerk | Wie kan meekijken of meekomen — een netwerk vervangt soms een consult |
| Maatschappelijke participatie | Hangt samen met herstel en met volhouden |
| Justitie | Zelden aan de orde, bepalend voor bereikbaarheid |

> **Licentie.** De ZRM is ontwikkeld door de GGD Amsterdam en kent officiële
> scoringsankers per domein. De domeinnamen zijn feitelijk; de ankers en afkapwaarden
> moeten vóór praktijkgebruik tegen de officiële uitgave worden gelegd, met licentie
> waar vereist. Wat in de code staat is de structuur en de doorwerking, niet het
> instrument.

## 3. Wat de score doet

Het ongewogen gemiddelde over de gescoorde domeinen bepaalt een factor op **alle**
controle-intervallen:

| Gemiddelde | Niveau | Factor | Betekenis |
| --- | --- | --- | --- |
| < 2,0 | acute problematiek | ×0,5 | Vaste, korte contacten en een vast gezicht; digitale route niet passend |
| 2,0 – 3,0 | beperkt zelfredzaam | ×0,7 | Vaker dan het protocol vraagt is hier geen overbehandeling maar voorwaarde |
| 3,0 – 4,0 | voldoende | ×1,0 | Het protocol is passend |
| 4,0 – 4,6 | goed | ×1,3 | Minder frequent is verantwoord, met lage drempel om zelf te melden |
| > 4,6 | volledig | ×1,6 | Eigen regie met bewaking op de achtergrond |

Het gemiddelde is bewust **ongewogen**. Een wegingsformule suggereert precisie die er
niet is en maakt de uitkomst voor de zorgverlener oncontroleerbaar. De knelpunten per
domein zeggen meer dan het getal, en die staan er altijd bij.

## 4. Drie andere dingen die de score beïnvloedt

**Aandachtsgebieden.** Een laag scorend leefdomein maakt een aandachtsgebied relevant,
ook zonder diagnose: lage geestelijke gezondheid activeert *mentaal welbevinden*, lage
ADL of een klein sociaal netwerk activeert *kwetsbaarheid*. Dat is precies het geval dat
een diagnosegestuurd systeem mist.

**Kanaalkeuze.** Digitale bereikbaarheid hangt niet aan het gemiddelde maar aan de
domeinen die ertoe doen (dagelijks functioneren, huisvesting). Een portaalbericht aan
iemand die het niet opent is geen oproep maar een gemiste patiënt.

**Volgorde in het monitoringcohort.** Lage of dalende zelfredzaamheid weegt mee in de
sortering. Wie het zelf niet redt hoort niet onderaan te belanden omdat de waarden
toevallig meevallen.

## 5. De trend telt zwaarder dan het getal

Een gedaalde score levert een eigen suggestie op (`zelfredzaamheid-gedaald`), met de
onderbouwing: afnemende zelfredzaamheid voorspelt uitval uit de zorg beter dan een
enkele afwijkende meetwaarde.

## 6. Verhouding tot intensiteit

Er zijn nu twee knoppen die op elkaar lijken maar verschillende dingen zeggen:

- **Intensiteit** — de klinische situatie: ontregeld, stabiel, palliatief, eigen regie.
- **Zelfredzaamheid** — wat deze mens zelf kan, los van de ziekte.

Ze vermenigvuldigen. Een ontregelde patiënt die alles zelf regelt komt op een ander
ritme uit dan een stabiele patiënt die het niet redt — en dat is precies de bedoeling.
