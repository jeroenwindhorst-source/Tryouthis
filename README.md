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
npm test            # 51 tests: terminologie, protocol, zelfredzaamheid, planning, beslisregels

npm run web         # werkplek op http://localhost:5173 — draait zónder server
```

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
| [17 — Toegang en samenwerking](docs/17-toegang-rollen-en-samenwerking.md) | Inloggen, vier rollen, rechten, berichten, persoonlijke voorkeuren |
| [ADR's](docs/adr/) | Negen vastgelegde ontwerpbesluiten met alternatieven |

---

## Belangrijke waarschuwingen

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

**Medicatiebewaking.** De contra-indicatiecheck bij ordersets kijkt naar nierfunctie,
leeftijd en polyfarmacie — niet naar middel-middelinteracties. Dat vraagt de G-Standaard
([`docs/16` §5](docs/16-ordermanagement.md)).

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
