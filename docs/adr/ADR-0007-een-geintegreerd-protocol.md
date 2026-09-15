# ADR-0007 — Eén geïntegreerd protocol, geen zorgprogramma's per aandoening

**Status:** aanvaard · **Datum:** 2026-09-15 · **Vervangt gedeeltelijk:** ADR-0003

## Context

ADR-0003 loste het samenvoegprobleem op: één zorgplan per patiënt in plaats van één per
zorgprogramma. Maar de *bouwsteen* bleef het zorgprogramma — DM2, CVRM, COPD — en het
plan was een slimme samenvoeging van die programma's.

Dat is niet genoeg, en het is bij nader inzien de verkeerde afslag. Zolang de aandoening
het organiserende principe is, krijg je per definitie:

- losse protocollen die elkaar niet kennen;
- een patiënt die "in drie programma's zit" in plaats van één mens met één plan;
- een inclusiebesluit per programma als administratief moment;
- registratie die per keten wordt gedacht ("dit doe ik voor de DM-keten").

Samenvoegen achteraf verzacht de symptomen. Het lost de oorzaak niet op. En het is
precies wat elke bestaande leverancier doet: losse modules met een koppelvlak ertussen.

## Besluit

**Er is één protocol voor chronische zorg.** De bouwsteen is de **zorgmodule**: een
aandachtsgebied, niet een aandoening.

| Was (ADR-0003) | Is (ADR-0007) |
| --- | --- |
| `Zorgprogramma` DM2 / CVRM / COPD | `Zorgmodule` glucoseregulatie, vaatrisico, nierfunctie, ademhaling, leefstijl, mentaal welbevinden, medicatieveiligheid, kwetsbaarheid |
| Inclusiecriteria per programma | Relevantieregel per module |
| Protocolactiviteit met vast interval | Monitoritem met basisinterval **plus intervalregels over de feitelijke situatie** |
| Inclusiebesluit | Zorginhoudelijke vraag: is dit gebied voor deze mens relevant |
| Ketenzorg stuurt het proces | Ketenzorg is een **projectie achteraf**, alleen voor declaratie en verantwoording |

Drie lagen bepalen wat er gebeurt, in deze volgorde:

1. **Het protocol** — welke modules zijn relevant, wat is het basisinterval.
2. **De situatie** — intervalregels op basis van de werkelijke waarden. HbA1c twee
   metingen onder 53 → halfjaarlijks. Boven 64 → zes weken. Niet het ziektelabel maar
   de toestand bepaalt de frequentie.
3. **De persoon** — modules handmatig aan of uit (met reden), eigen intervallen, een
   eigen maximum aantal contacten per jaar, en de keuze om thuis te meten.

Laag 3 wint altijd van 1 en 2, mits de reden wordt vastgelegd.

## Gevolgen

**Positief**

- Er is geen scherm in het systeem waar een zorgverlener een zorgprogramma kiest.
- Multimorbiditeit is de normale situatie, niet een uitzondering die samengevoegd moet
  worden. Een meting die drie gebieden bedient, bestaat één keer.
- Aandachtsgebieden die geen enkele keten dekt — mentaal welbevinden, leefstijl,
  medicatieveiligheid, kwetsbaarheid — horen er gewoon bij. In de huidige inrichting
  vallen die tussen wal en schip.
- Patiënten die onder géén landelijke keten vallen maar wél een chronische zorgvraag
  hebben, worden zichtbaar. In de demopopulatie is dat ruim 20% van de mensen met een
  chronische zorgvraag.
- Personalisatie is echt: "ik wil je maximaal twee keer per jaar zien" is een instelbare
  voorkeur waar het plan zich naar voegt, met de consequenties er expliciet bij.

**Negatief, en eerlijk benoemd**

- **De vergelijking met de huidige inrichting wordt lastiger.** Het plan doet méér dan
  de losse ketens. Bij de demopopulatie levert het 15 contacten per jaar minder op, maar
  de contacten die overblijven zijn langer, waardoor de totale consulttijd licht stijgt.
  Wij rapporteren beide getallen met teken; één van de twee verzwijgen zou het cijfer
  waardeloos maken.
- **Ketenzorgorganisaties denken in programma's.** De projectie moet daarom
  onberispelijk zijn, anders ontstaat het KIS opnieuw (ADR-0006).
- **Modules die elkaars metingen nodig hebben, moeten dat declareren.** CVRM heeft eGFR
  en rookstatus nodig; die staan ook in nierfunctie en leefstijl. De planner voegt samen,
  maar de afhankelijkheid moet expliciet in het protocol staan.

## Alternatief afgewogen

*Zorgprogramma's behouden en er een "geïntegreerd programma" naast zetten.* Verworpen:
dan heb je vier protocollen in plaats van drie, en de vraag welk protocol geldt voor een
patiënt met DM2 én COPD blijft onbeantwoord. Het is de standaardoplossing van de markt en
precies de reden dat het probleem blijft bestaan.
