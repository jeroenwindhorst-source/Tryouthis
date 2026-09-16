# ADR-0014 — De dossiersamenvatting is regelgebaseerd, niet gegenereerd

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0005, ADR-0012

## Context

Een zorgverlener die een dossier opent dat hij niet kent — een waarneming, een overname,
een patiënt die drie jaar niet is geweest — heeft één vraag: *wie is dit, wat speelt er,
en wat is er het afgelopen jaar gebeurd?* Het antwoord staat in het dossier, verspreid
over episodes, contacten, meetreeksen, medicatie en binnengekomen post. Het bij elkaar
zoeken kost vijf tot tien minuten, en die tijd is er in een spreekuur van tien minuten
niet.

De voor de hand liggende oplossing is een taalmodel over het dossier laten lopen en een
alinea laten schrijven. Dat leest prettig en het is precies daarom een probleem.

## Besluit

**De samenvatting wordt opgebouwd uit regels over de gestructureerde gegevens, niet
gegenereerd uit tekst.**

Elke alinea heeft een vaste vraag, een vaste bron en een vaste opbouw:

| Alinea | De vraag | Waaruit |
|---|---|---|
| wie | Wie is dit? | patiëntgegevens, episodelijst |
| speelt | Wat speelt er? | zorgplan, actieve aandachtsgebieden |
| hoe | Hoe gaat het? | laatste eigen registraties per meetcode |
| zelfredzaamheid | Wat kan deze mens zelf? | zelfredzaamheidsinventarisatie |
| jaar | Wat gebeurde er het afgelopen jaar? | journaal, binnengekomen berichten |
| open | Wat staat er open? | orders, autorisatieverzoeken, geplande contacten |
| grenzen | Waar liggen de grenzen? | beleidsafspraken |

**Elke alinea draagt zichtbaar zijn eigen bron.** Niet als voetnoot maar als regel eronder:
*"Op basis van laatste eigen registraties uit het dossier."* Wie een zin niet vertrouwt,
moet kunnen zien waar hij vandaan komt zonder het hele dossier na te lopen.

**De samenvatting vertelt alleen wat er in het dossier staat.** Geen duiding, geen
conclusie, geen advies. "HbA1c 54 mmol/mol — buiten de streefwaarde" mag; "de diabetes is
ontregeld" niet. Het eerste is een feit met een norm ernaast, het tweede is een diagnose.

## Waarom niet gegenereerd

**Een samenvatting stuurt waar iemand naar kijkt.** Daarmee is het
beslissingsondersteuning in de zin van ADR-0005, en die moet per bewering herleidbaar zijn
naar zijn bron en naar de regel die hem produceerde. Een taalmodel kan dat niet garanderen:
het kan een zin schrijven die klopt met de gegevens, of een zin die klopt met hoe zulke
dossiers er meestal uitzien. Het verschil is van buitenaf niet te zien, en juist het tweede
geval is het gevaarlijke.

**De MDR maakt het een hulpmiddel.** Software die informatie levert die gebruikt wordt voor
beslissingen over diagnose of behandeling is een medisch hulpmiddel. Bij regelgebaseerde
logica is de conformiteitsbeoordeling te doen: de regels zijn opschrijfbaar, testbaar en
versiebaar. Bij een generatief model verandert het gedrag met het model, en dan beoordeel je
iets wat volgende maand anders is.

**Weglaten is erger dan verzinnen.** Het risico van een gegenereerde samenvatting zit niet
alleen in wat er verkeerd in staat, maar in wat er stilletjes níet in staat. Een regelset
die zeven vaste vragen beantwoordt, laat zien dát een vraag onbeantwoord is. Een alinea die
lekker leest, laat dat niet zien.

## Wat een taalmodel hier wél mag

Niets in deze beslissing zegt dat een taalmodel nergens mag. Waar het wél kan:

- **de anamnese van een gesproken voorbereiding structureren**, zoals de wachtkamer-app doet
  — maar dan als suggestie met leverancier erbij, die pas telt na bevestiging door een mens;
- **een concept-SOEP voorstellen** tijdens het consult, dat de zorgverlener aanpast en
  bevestigt voordat het het dossier in gaat;
- **zoeken in vrije tekst**, waar het resultaat een verwijzing is en geen bewering.

Het onderscheid is steeds hetzelfde: een taalmodel mag iets *voorstellen* dat een mens
vervolgens vaststelt. Het mag niet zelf het samenvattende oordeel zijn waarop iemand vaart.

## Gevolgen

De samenvatting is saaier dan een gegenereerde tekst en dat is de bedoeling. Hij is
deterministisch, dus twee zorgverleners die hetzelfde dossier openen zien hetzelfde, en een
regel die fout is, is te vinden en te repareren.

De regelset heeft een versienummer dat bij de samenvatting staat. Verandert de regelset,
dan verandert de samenvatting — en dan is na te gaan welke versie iemand voor zich had.

Wat hier nog niet zit: een norm voor hoe oud een gegeven mag zijn voordat de samenvatting
het als verouderd markeert, en een manier om per praktijk alinea's aan of uit te zetten.
