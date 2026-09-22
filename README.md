# Cadans

Een FHIR-native, procesgedreven informatiesysteem voor de Nederlandse eerste lijn —
gebouwd rond het zorgteam en het zorgproces, met **één geïntegreerd protocol** in plaats
van een zorgprogramma per aandoening.

De naam benoemt wat het systeem anders doet: het ritme van de zorg volgt de mens — zijn
klinische toestand én zijn zelfredzaamheid — niet het ziektelabel.

> **Status: fase 0 — fundament.** Architectuur, datamodel, terminologielaag, het
> geïntegreerde protocol, zelfredzaamheid als sturende factor, beslissingsondersteuning,
> configuratie op vier niveaus, en werkplekken voor POH-S, doktersassistent en huisarts
> op synthetische data. Nog geen productiesysteem.

---

## De kern: geen protocol per aandoening

Een mens heeft zelden één probleem. Zodra de aandoening het organiserende principe wordt,
krijg je onvermijdelijk losse trajecten, losse oproepen en losse consulten — en dat is
precies wat elk bestaand systeem doet.

Daarom is de bouwsteen hier geen aandoening maar een **aandachtsgebied**:

> glucoseregulatie · hart- en vaatrisico · nierfunctie · ademhaling · leefstijl ·
> mentaal welbevinden · medicatieveiligheid · kwetsbaarheid

Vier lagen bepalen het plan ([`docs/04`](docs/04-zorgproces.md), [`docs/15`](docs/15-zelfredzaamheid.md)):

1. **het protocol** — welke gebieden zijn relevant, wat is het basisinterval;
2. **de klinische situatie** — HbA1c twee metingen onder 53 → halfjaarlijks; boven 64 →
   zes weken. Niet het ziektelabel maar de toestand bepaalt de frequentie;
3. **de zelfredzaamheid** — elf leefdomeinen, score 1–5. Wie het zelf redt heeft minder
   contact nodig bij exact dezelfde waarden; wie het niet redt juist meer. De score stuurt
   ook het oproepkanaal, activeert aandachtsgebieden zonder diagnose, en weegt mee in de
   volgorde van het monitoringcohort;
4. **de persoonlijke afspraak** — gebieden aan of uit met reden, eigen intervallen, een
   eigen maximum aantal contacten per jaar, thuis meten in plaats van langskomen.

Laag 4 wint altijd van de rest, mits de reden wordt vastgelegd.

Landelijke ketenzorg (DM, CVRM, COPD, ouderenzorg) verdwijnt niet — die is nodig voor
declaratie. Maar het is een **projectie achteraf**: niemand registreert "voor de keten".
Zie [ADR-0007](docs/adr/ADR-0007-een-geintegreerd-protocol.md).

![Consultscherm](docs/afbeeldingen/werkplek-consult.png)

*Het consultscherm: beslissingsondersteuning bovenaan (met de feiten vóór het advies),
daaronder registreren, dan het plan — en rechts de verantwoording die zichzelf vult.*

---

## Wat deze repo aantoont

| Claim | Waar | Bewijs |
| --- | --- | --- |
| Eén plan, geen programma's | `packages/care-engine/src/protocol.ts` | Nergens in de werkplek kies je een zorgprogramma |
| Het interval volgt uit de situatie | `zorgplan.ts` — intervalregels | Dezelfde diagnose, andere frequentie, afhankelijk van de waarden |
| Zelfredzaamheid stuurt de frequentie | `zelfredzaamheid.ts` | Identieke waarden, andere score → aantoonbaar ander aantal contacten |
| Drie rollen op één dossier | `apps/web/src/schermen/` | POH-S, doktersassistent en huisarts, elk met eigen werkproces |
| Een teller wordt een werkvoorraad | `werkvoorraad.ts` | 163 autorisaties → 35 die een arts nodig hebben, de rest veilig in bulk |
| Configuratie is geen code | `packages/configuratie` | Vier niveaus, per instelling zichtbaar waar hij is gezet |
| Partnerapps voelen eigen, blijven herkenbaar | `IntakeKaart` | Wachtkamer-intake landt in het scherm, telt pas mee na bevestiging |
| Elk advies wijst naar zijn bron | `beslisondersteuning.ts` | Klikbare verwijzing naar NHG-standaard met paragraaf en versie |
| Echt op maat | `PersoonlijkPlan` | "Maximaal 2× per jaar" past het hele plan aan, mét benoemde consequenties |
| Minder contacten bij multimorbiditeit | `vergelijking` | 8 losse trajectcontacten → 4 geïntegreerde bij dezelfde dekking |
| Verantwoording vult zichzelf | `ketenkoppeling.ts` | Eén registratie → ketenindicatoren van 29% naar 100%, zonder apart invulwerk |
| Automatiseren wat mag | `beslisondersteuning.ts` | 58% van het gesignaleerde werk is logistiek en draait zonder mens |
| Het systeem stelt óók voor om mínder te doen | regel `afschalen-stabiel` | Drie stabiele metingen → voorstel om af te schalen |
| ICPC en SNOMED naast elkaar | `packages/terminology` | Externe codes landen met context, zonder het origineel te vervangen |

### Eerlijk over de cijfers

Op de demopraktijk van 48 patiënten: **15 contacten per jaar minder**, maar de
consulttijd stijgt met ongeveer **5 uur per jaar**. Dat is geen weeffout — het plan
dóét meer. Mentaal welbevinden (27 patiënten), medicatiebeoordeling (6) en
kwetsbaarheid dekt geen enkele keten systematisch. Beide getallen staan in de API met
teken; één ervan verzwijgen zou het cijfer waardeloos maken.

Nog een bevinding uit dezelfde cijfers: van de 34 patiënten met een chronische zorgvraag
vallen er **7 onder geen enkele landelijke keten**. Die krijgen nu geen gestructureerde
begeleiding — ze bestaan simpelweg niet in de ketenadministratie.

---

## Drie rollen, één dossier

Elke rol begint met de eigen dag als agenda en volgt daarna het eigen werkproces:

| Rol | Werkproces |
| --- | --- |
| **POH-Somatiek** | Dagstart → Voorbereiden → Spreekuur → Monitoren → Afronden |
| **Doktersassistent** | Dagstart → Triage (digitaal en telefonisch door één model) → Dossiers |
| **Huisarts** | Dagstart → Autoriseren → Spreekuur → Het team |

Per stap staat in het scherm letterlijk wát je daar ziet en wát je kunt doen.

![Dagstart](docs/afbeeldingen/werkplek-dagstart.png)

---

## Snel starten

```bash
npm install
npm run build
npm test            # 60 tests: terminologie, protocol, zelfredzaamheid, planning, beslisregels,
                    # contactvormen en declaratie, verrichtingen, acute instroom

npm run web         # werkplek op http://localhost:5173 — draait zónder server
```

Inloggen kan met `sanne` (POH-S), `ilse` (assistent), `daan` (huisarts) of `mirjam`
(praktijkmanager); het wachtwoord is voor alle vier `cadans` en de tweefactorcode is
`123456`. Het codeveld krijgt vanzelf de focus, dus je kunt doortypen. Rechtsboven staat **Demo herstellen**: dat gooit alle mutaties van de sessie
weg en bouwt dezelfde beginstand opnieuw op, zodat je een demonstratie meerdere keren
kunt draaien. De generatoren werken met vaste zaden, dus het resultaat is exact dezelfde
praktijk — niet iets wat erop lijkt.

De werkplek draait standaard **volledig in de browser**: `@zpe/praktijk` bevat geen HTTP
en geen Node-afhankelijkheden, dus dezelfde motor die in de server draait, draait ook in
het tabblad. Handig voor demo's, maar vooral een bewijs dat de domeinlaag echt losstaat
van het transport — voorwaarde voor de FHIR-facade uit [`docs/08`](docs/08-interoperabiliteit.md).

Wil je tegen de echte API aan werken (dezelfde endpoints die externe partijen zien):

```bash
npm run api                              # Fastify op http://localhost:3000
VITE_BACKEND=http npm run web            # werkplek praat nu over HTTP

npm --workspace @zpe/web run build:standalone   # losstaande bundel, zonder server
```

De API genereert bij het starten een deterministische synthetische praktijk van
48 patiënten. **Nooit productiedata in ontwikkel- of testomgevingen** — daarom is
populatiegeneratie onderdeel van de toolchain ([`docs/07` §4](docs/07-compliance.md)).

```bash
curl localhost:3000/api/praktijk/samenvatting
curl localhost:3000/api/protocol            # het volledige protocol, met intervalregels
curl localhost:3000/api/poh/dagstart
curl localhost:3000/api/poh/instroom
curl 'localhost:3000/api/terminologie/zoek?q=suikerziekte'
curl 'localhost:3000/fhir/CarePlan?patient=pat-001'
```

---

## Indeling

```
docs/           architectuur, ontwerpbesluiten en de analyse van bestaande systemen
packages/
  fhir-model/   FHIR R4-typen, herkomst, dossier-views
  terminology/  ICPC-1 NL ↔ SNOMED CT, referentieset, zoeken, ontvangst
  configuratie/ niveaus, instellingen, app-registratie — geen afhankelijkheden
  care-engine/  protocol · zelfredzaamheid · ketenkoppeling · instroom · zorgplan
                · beslisondersteuning · vragenlijsten · oproep
  praktijk/     samenstelling tot schermen, werkvoorraad + synthetische praktijk — géén HTTP
apps/
  api/          FHIR-facade en werkproces-endpoints over `praktijk`
  web/          werkplek POH-Somatiek (browser of HTTP, zelfde interface)
```

Modulegrenzen: `terminology` kent `fhir-model`; `care-engine` kent beide maar bevat geen
HTTP en geen opslag; `apps/*` bevatten geen klinische regels.

## Documentatie

| | |
| --- | --- |
| [00 — Visie en scope](docs/00-visie-en-scope.md) | Het probleem, wat we bouwen, meetbare doelen |
| [01 — Architectuur](docs/01-architectuur.md) | Lagen, de drie database-assen, technologiekeuzes |
| [02 — Terminologie](docs/02-terminologie.md) | ICPC/SNOMED, referentieset vs. extern, mapping-import |
| [03 — Datamodel](docs/03-datamodel.md) | Episode, deelcontact, herkomst, zorgplan, werkvoorraad |
| [04 — Het geïntegreerde protocol](docs/04-zorgproces.md) | Aandachtsgebieden, de drie lagen, instroom, ketenprojectie |
| [05 — Werkplekken](docs/05-werkplekken.md) | POH-S, assistent, huisarts, patiënt |
| [06 — Vragenlijsten](docs/06-vragenlijsten.md) | Triggermodel, twee presentaties, MDR-aanpak |
| [07 — Compliance](docs/07-compliance.md) | AVG, NEN 7510/12/13, Wegiz, EHDS, MDR, AI Act |
| [08 — Interoperabiliteit](docs/08-interoperabiliteit.md) | Profielen, adressering, de API als product |
| [09 — Roadmap](docs/09-roadmap.md) | Fasering, risico's, wat er nodig is |
| [10 — Analyse bestaande HIS'en](docs/10-analyse-bestaande-hissen.md) | mediKIT, HealthConnected, Bricks |
| [11 — Applicatiefunctiemodel](docs/11-applicatiefunctiemodel.md) | AHA-model als functiedecompositie |
| [12 — Procesmodel](docs/12-procesmodel.md) | De swimlanes, uitgewerkt naar uitvoerbare definities |
| [13 — Beslissingsondersteuning](docs/13-beslissingsondersteuning.md) | Klinisch vs. logistiek, automatisering, bronverwijzing, MDR |
| [14 — Configuratie en apps](docs/14-configuratie.md) | Vier niveaus, terminologie als instelling, ingebedde partnerapps |
| [15 — Zelfredzaamheid](docs/15-zelfredzaamheid.md) | Leefdomeinen, score, doorwerking op frequentie en kanaal |
| [16 — Ordermanagement](docs/16-ordermanagement.md) | Ordersets, contra-indicatiecheck, rechten en autorisatie |
| [17 — Toegang en samenwerking](docs/17-toegang-rollen-en-samenwerking.md) | Inloggen, vier rollen, rechten, berichten van collega's én patiënten |
| [18 — Plannen en agenda](docs/18-plannen-en-agenda.md) | Planbord, vrije plekken, vier planroutes, afspraken als order |
| [19 — Contactvormen en declaratie](docs/19-contactvormen-en-declaratie.md) | Contactvorm bij het contact, verrichtingen met uitslag, acute instroom |
| [20 — Dossierdiepte en rapportage](docs/20-dossierdiepte-en-rapportage.md) | Overzichtstab, samenvatting, het hele contact, media, groepsconsulten, rapporten |
| [21 — Het demonstratiescript](docs/21-demonstratie.md) | Uitgeschreven route langs assistent, huisarts en POH, met de cijfers die kloppen (`npm run demoscript` → Word) |
| [ADR's](docs/adr/) | Zestien vastgelegde ontwerpbesluiten met alternatieven |

---

## Belangrijke waarschuwingen

**Demopopulatie.** De 48 patiënten zijn synthetisch en deterministisch opgebouwd, en de
seed is bewust zo gemaakt dat elke melding bij een dossier terechtkomt dat de onderbouwing
waarmaakt: een COPD-exacerbatie bij iemand met COPD, een kaliummelding bij iemand die een
RAS-remmer én een diureticum gebruikt. Dat is testdata-ontwerp en geen klinische validatie
— de waarden zelf zijn plausibel maar niet getoetst. De demoklok staat vast op 10:20, zodat
een demonstratie op elk tijdstip hetzelfde beeld geeft
([`docs/21`](docs/21-demonstratie.md)).

**Demoterminologie.** `packages/terminology/src/seed.ts` bevat een kleine set met échte
SNOMED-concept-id's en ICPC-codes, maar de selectie is willekeurig en de
mapping-equivalenties zijn niet door een terminoloog gereviewd. **Niet voor klinisch
gebruik.** Vervangen door de NHG/Nictiz-distributie plus de mapping van de opdrachtgever;
het inleesformaat staat in [`docs/02` §6](docs/02-terminologie.md).

**Meetinstrumenten.** De vragenlijsten in `vragenlijsten-demo.ts` bootsen de structuur en
scoringslogica van bestaande instrumenten na met eigen formuleringen. CCQ, PHQ-9, GAD-7
en EQ-5D zijn auteursrechtelijk beschermd en vragen een licentie voor digitaal gebruik.
Hetzelfde geldt voor de Zelfredzaamheid-Matrix: de domeinnamen zijn feitelijk, maar de
officiële scoringsankers moeten vóór gebruik worden geverifieerd ([`docs/15`](docs/15-zelfredzaamheid.md)).

**Authenticatie.** Het aanmeldscherm is een demonstratie: vier accounts met een
wachtwoord in platte tekst en een vaste tweefactorcode
([`docs/17` §1](docs/17-toegang-rollen-en-samenwerking.md)). Er is geen hashing, geen
sessiebeheer en geen koppeling met UZI. **Niet op een netwerk zetten met echte gegevens.**

**Medicatiebewaking.** De contra-indicatiecheck kijkt naar nierfunctie, leeftijd,
polyfarmacie en dubbelmedicatie — niet naar middel-middelinteracties en niet naar
overgevoeligheden. Dat vraagt de G-Standaard ([`docs/16` §5](docs/16-ordermanagement.md)).

**Medicatiewijziging en apotheken.** Een middel aanpassen stopt het oude, start het nieuwe,
trekt de lopende order in en plaatst een recept — in één handeling
([ADR-0016](docs/adr/ADR-0016-medicatiewijziging-is-een-handeling.md)). Wat er níet achter
zit: echt receptverkeer. "Elektronisch naar de apotheek" zet een bestemming op de order;
er is geen NHG-Tabel 25, geen EDIFACT en geen LSP-adressering. De zes apotheken in
`packages/praktijk/src/medicatie.ts` zijn verzonnen, net als de vaste apotheek per patiënt.

**Ordercatalogus.** De ~30 middelen, 20 bepalingen en 22 verwijsbestemmingen in
`packages/care-engine/src/catalogus.ts` zijn plausibel en gangbaar, maar niet tegen de
G-Standaard of de NHG-Tabellen gecontroleerd. Bewust klein en expliciet onvolledig:
genoeg om het werkproces te bouwen, niet om zorg mee te leveren.

**Declaratie.** De prestatiecodes in `packages/praktijk/src/contactsoorten.ts` zijn
**niet geverifieerd** tegen de actuele NZa-beleidsregel huisartsenzorg. De structuur klopt
— duurstaffels, visites apart, digitale contacten die meetellen als ze inhoudelijk zijn —
maar codes en voorwaarden moeten vóór gebruik tegen de actuele regelgeving worden gelegd.
Er is geen declaratie-export, geen VECOZO-koppeling en geen controle op dubbeldeclaratie
([`docs/19`](docs/19-contactvormen-en-declaratie.md)).

**Verrichtingen.** De uitkomstvelden en bandbreedtes per verrichting zijn plausibel maar
niet tegen de NHG-standaarden gelegd. Ze dienen om het werkproces te bouwen — aanvragen,
uitvoeren, laten beoordelen — niet om uitslagen mee te interpreteren.

**Spraakherkenning.** De dicteerknop in de SOEP-velden gebruikt de spraakherkenning van
de browser. Dat is genoeg om het werkproces te laten zien en niet genoeg voor de
spreekkamer: geen vaktermen, geen medicatienamen, en de spraak verlaat de eigen omgeving.
Een medische dicteeroplossing verwerkt binnen de eigen omgeving, en dat is een AVG-eis en
geen detail. In browsers zonder ondersteuning is de knop uitgeschakeld.

**Videoconsult.** De knop opent een venster dat het werkproces toont en géén
videoverbinding opzet. Dat is expres: een nagebouwd beeld zou suggereren dat er iets
werkt wat er niet is ([`docs/05` §4e](docs/05-werkplekken.md)).

**Behandelgrenzen.** De beleidsafspraken zijn synthetisch gegenereerd voor ongeveer een
kwart van de populatie. Ze tonen de vorm — wie, wanneer, met wie besproken — en zijn
nadrukkelijk geen echte wilsverklaringen.

**Dossiersamenvatting.** De samenvatting op het overzichtstabblad is regelgebaseerd en
nadrukkelijk niet gegenereerd: elke alinea komt uit gestructureerde gegevens en draagt zijn
eigen bron. De regels zijn plausibel maar niet met zorgverleners getoetst — welke zeven
vragen een waarnemer werkelijk als eerste stelt, is een vraag voor de praktijk
([ADR-0014](docs/adr/ADR-0014-samenvatting-is-regelgebaseerd.md)).

**Media.** De documenten en foto's zijn metadata zonder bestanden: er is geen
documentvoorziening, geen virusscan, geen versiebeheer en geen mapping naar
`DocumentReference`. De koppeling naar het contact of het externe bericht is echt; de inhoud
van een pdf openen kan niet ([`docs/20` §4](docs/20-dossierdiepte-en-rapportage.md)).

**Rapportage-export.** De BI-export levert alleen geaggregeerde regels met leeftijdsklassen
en groepen van minimaal vijf. Dat is een ontwerpkeuze en geen volledige
anonimiseringsgarantie: bij een kleine praktijk of een zeldzame combinatie hoort vóór gebruik
een herleidbaarheidstoets te worden gedaan
([ADR-0015](docs/adr/ADR-0015-rapportage-op-dezelfde-gegevens.md)).

**Externe bronnen.** De BgZ- en e-Overdracht-documenten in het journaal zijn synthetisch
en volgen de sectiestructuur van die standaarden op hoofdlijnen. Er is geen LSP- of
Nuts-adressering en geen echte mapping naar `DocumentReference`/`Composition`
([ADR-0010](docs/adr/ADR-0010-externe-informatie-in-dezelfde-tijdlijn.md)).

**Richtlijnverwijzingen.** De links naar `richtlijnen.nhg.org` volgen het bekende
patroon maar zijn niet stuk voor stuk tegen de live index gecontroleerd. Doe dat vóór
release: standaarden worden hernoemd en samengevoegd.

**Klinische inhoud.** Drempelwaarden, intervallen en beslisregels in `protocol.ts` en
`beslisondersteuning.ts` zijn plausibel maar niet geverifieerd tegen de actuele
NHG-standaarden. Ze dienen om de motor te bouwen, niet om zorg mee te leveren.

---

## Wat er nu nodig is

1. De **ICPC-1 NL ↔ SNOMED-mapping** in het formaat uit [`docs/02` §6](docs/02-terminologie.md).
2. **Bevestiging** van de lezing van het AHA-functiemodel: oranje = "nu niet of
   onvoldoende ondersteund" ([`docs/11`](docs/11-applicatiefunctiemodel.md)).
3. **Toetsing van de acht aandachtsgebieden** met een POH en een kaderhuisarts: zijn dit
   de juiste gebieden, en kloppen de relevantieregels?
   Idem voor de vertaling van de zelfredzaamheidsscore naar contactfrequentie — de
   afkapwaarden in [`docs/15`](docs/15-zelfredzaamheid.md) §3 zijn beredeneerd, niet
   gevalideerd.
4. **Een echt protocol** van een zorggroep of de AHA, om de intervalregels tegen de
   praktijk te toetsen — te beginnen bij hart- en vaatrisico.
5. **Eén of twee praktijken** als klankbord, nu al.
