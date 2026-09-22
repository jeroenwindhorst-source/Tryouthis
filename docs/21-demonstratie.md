# 21 — Het demonstratiescript

*Een uitgeschreven route door Cadans, langs de drie werkplekken, met het zwaartepunt bij
de praktijkondersteuner. Bedoeld om voor te lezen of uit je hoofd te doen — niet om aan
je publiek te geven.*

---

## Voor je begint

| | |
|---|---|
| **Duur** | 15 minuten voor het hele verhaal; 8 daarvan bij de POH |
| **Accounts** | `ilse` (assistent) · `daan` (huisarts) · `sanne` (POH-S) · `mirjam` (praktijkmanager) |
| **Wachtwoord** | `cadans` voor alle vier · verificatiecode `123456` |
| **Reset** | **Demo herstellen** rechtsboven zet alles terug naar de beginstand |
| **Op papier** | `npm run demoscript` maakt hiervan `Cadans-demonstratiescript.docx` |

Drie dingen om te weten voordat je begint.

**De klok staat stil op 10:20.** De demopraktijk staat altijd halverwege de ochtend: drie
consulten zijn geweest, één patiënt is niet komen opdagen, één zit in de wachtkamer. Dat
is niet afhankelijk van het tijdstip waarop jij demonstreert. Je kunt dus om negen uur 's
ochtends en om vijf uur 's middags hetzelfde verhaal vertellen.

**De datum loopt wél mee.** De peildatum is vandaag, dus leeftijden, intervallen en
"hoe lang geleden" kloppen altijd met de dag waarop je het laat zien.

**De acute meldingen komen binnen op een tijdslot na het inloggen**: na 0, 40, 95 en 150
seconden. Dat is geen effect maar het punt van die functie — er komt iets binnen terwijl
je met iets anders bezig bent. Houd daar rekening mee: log in, en begin te praten.

> ⚠️ Alles wat je ziet is synthetisch. 48 verzonnen patiënten, verzonnen waarden, en
> drempelwaarden die plausibel maar niet tegen de NHG-standaarden gevalideerd zijn. Zeg
> dat één keer aan het begin, dan hoef je het niet meer te zeggen.

---

## De rode draad: Piet de Vries

Eén man loopt door het hele verhaal, en je kunt hem er op drie plekken uit halen.

**Piet de Vries, 72 jaar, COPD, gebruikt tiotropium.** Hij is opgenomen geweest met een
exacerbatie; het ziekenhuisbericht daarover — *Opname longgeneeskunde, Spaarne Gasthuis,
binnengekomen als BgZ* — staat in zijn journaal. De huisarts heeft hem op de bespreeklijst
gezet met de vraag *wie de longrevalidatie oppakt en wanneer we hem terugzien*. Vanochtend
stuurt hij een portaalbericht dat hij benauwder is en dat de pufjes minder helpen — dat
komt als acute melding binnen bij de POH. Hij staat vanmiddag om 14:10 in haar agenda, met
een eGFR van 37 als signaal. En in *Berichten* loopt een draadje tussen de assistent en de
POH over precies deze benauwdheid.

Dat is de reis: **binnengekomen bij de praktijk → beoordeeld door de huisarts →
overgedragen aan de POH → en vandaag weer in beeld.** Je hoeft hem niet te forceren; noem
hem gewoon elke keer dat hij langskomt, dan bouwt het verhaal zichzelf op.

---

## Deel 1 — De doktersassistent (3 minuten)

Log in als **`ilse`**.

### Dagstart

> "Dit is de assistent. Vier tegels, en dat zijn geen tellers maar haar werkproces."

Wijs de tegels aan: **14 zorgvragen te beoordelen**, **1 met zelfzorgadvies afgevangen**,
**8 verrichtingen** in haar eigen agenda, en de stapel die naar de huisarts gaat.

**Klik op de tegel "Binnengekomen".** De tegels zijn knoppen — bij alle drie de zorgrollen.

### Triage

> "Veertien zorgvragen vanochtend. Zeven via het portaal, zeven aan de telefoon of aan de
> balie. En hier zit de kern: het is één triagemodel voor twee kanalen."

Loop de eerste vier regels langs — die zijn bewust de vier mogelijke uitkomsten:

| Tijd | Patiënt | Vraag | Uitkomst |
|---|---|---|---|
| 08:05 | Corrie Jansen | "Mijn suikers thuis zijn hoger dan normaal" | deze week, **naar de POH** |
| 08:12 | Gerrit Smit | "Steeds duizelig bij opstaan sinds de nieuwe tablet" | vandaag, **naar de huisarts** |
| 08:19 | Anneke Smit | "Jeukende plekjes op de rug" | deze week, **naar de assistent** |
| 08:26 | Marjan van den Berg | "Al een week keelpijn" | **zelfzorg**, geen afspraak |

> "Wie via het portaal binnenkomt, heeft de triagevragen al doorlopen. De uitkomst staat
> er, inclusief het advies dat de patiënt al gekregen heeft. Bij Corrie Jansen hoeft Ilse
> niets te bedenken: het systeem zegt dat dit bij de POH hoort en waarom. Wie belt, krijgt
> dezelfde vragen — dan is Ilse degene die ze stelt. Zelfde model, zelfde uitkomst, zelfde
> registratie in het dossier."

Wijs op de regel die naar de huisarts gaat:

> "En deze gaat vandaag naar de huisarts, want de klachten begonnen na een nieuwe tablet.
> Dat is geen protocol dat iemand uit zijn hoofd kent — dat is de triage die het zegt."

**De overgang:** klik op **Doorzetten naar POH** bij Corrie Jansen, of laat het zitten en
zeg: "die vraag komt straks bij de POH terug."

---

## Deel 2 — De huisarts (3 minuten)

Uitloggen, inloggen als **`daan`**.

### De spoedmelding

Binnen een paar seconden schuift er een **modaal venster** over het scherm: **Dirk Mulder,
83 jaar, belt zelf — drukkende pijn op de borst sinds een half uur, zweterig.**

> "Dit is waar het misgaat in bestaande systemen. Een teller die van 3 naar 4 gaat terwijl
> je een consult doet, ziet niemand. Alleen spoed krijgt een venster dat je moet
> wegklikken — en daarom is dat niveau schaars."

Wijs de drie blokken aan: de samenvatting, **waarom dit acuut is**, en het voorstel.

> "Waarom nu: bekend met diabetes en hypertensie, en bij die combinatie is een atypisch
> beeld eerder regel dan uitzondering. Dat staat er niet voor de sier. Een urgentiestempel
> zonder onderbouwing leert een gebruiker om hem weg te klikken, en dan heb je
> alarmmoeheid gebouwd."

Wijs onderaan: *"Staat ook bij: huisarts, assistent. Zodra jij hem oppakt, zien zij dat."*

> "Wie klikt, claimt hem. Zonder die claim gaan er twee mensen bellen, of geen enkele."

Klik **Niet nu — laat staan voor een collega** en leg uit dat dat expres kan: wie in een
gesprek zit met een andere patiënt moet door kunnen.

### Autoriseren

**Klik op "Autoriseren".**

> "163 openstaande verzoeken. Dat getal is niet verzonnen — dat is wat er in een
> doorsneepraktijk op een huisarts wacht. Maar kijk naar de kop: **29 vragen jouw
> oordeel.**"

> "De rest — 134 — is binnen protocol, binnen de referentiewaarde, geen interactie. Dat
> kan in één handeling. Het verschil tussen 163 regels uitzoeken en 29 besluiten nemen zit
> niet in het aantal, maar in de vraag die het systeem voor je beantwoordt."

Wijs één regel aan onder *Vraagt jouw oordeel*, bijvoorbeeld een lab met
*"Buiten referentiewaarde en gestegen ten opzichte van de vorige bepaling"*.

> "En er staat bij waaróm het geen routine is."

### Het overleg

**Klik op "Overleg".**

> "Elf uur, half uur, huisarts en POH samen. Vier punten. Eén lijst voor het hele team —
> wie een patiënt inbrengt, ziet hem hier terug en de ander ook."

Wijs op het vierde punt:

> "En dit is Piet de Vries. Ingebracht door de huisarts, vóór de POH: *na de
> ziekenhuisopname COPD, wie pakt de longrevalidatie op en wanneer zien we hem terug?* Met
> de context eronder, uit het dossier. Onthoud die naam — over twee minuten komt hij
> terug."

---

## Deel 3 — De praktijkondersteuner (8 minuten)

Uitloggen, inloggen als **`sanne`**. **Dit is het hoofdstuk.** Neem er de tijd voor.

### 1. De dagstart — wat is mijn dag?

> "Goedemorgen Sanne. Geen zoekveld, geen postvak. Vier kaarten, en dat is haar werkproces
> in volgorde: **voorbereiden, spreekuur, monitoren, afronden.** Je begint links en je
> eindigt rechts."

Lees de vier tegels hardop:

- **Voorbereiden — 9**, waarvan 8 vragen aandacht
- **Spreekuur — 9**, waarvan 3 vragen aandacht
- **Monitoren — 23**, waarvan 7 vragen aandacht
- **Afronden — 3**, alles bij

> "Elke kaart zegt ook wát je er vindt. Dat lijkt een detail, maar het is precies wat
> ontbreekt in bestaande systemen: je moet er maar achter komen waar je werk staat."

Wijs rechtsonder op **Vraagt als eerste aandacht**:

> "Eén patiënt springt eruit vandaag: **Fatima Vermeulen, CCQ van 1 naar 2.** Dat is geen
> losse uitschieter maar een beloop dat de verkeerde kant op gaat. Zij staat vanmiddag om
> 11:20 in de agenda — dus Sanne weet dit vóórdat ze de spreekkamer in loopt."

Wijs op het groene blok:

> "En dit heeft het systeem vannacht al gedaan: 23 labaanvragen klaargezet vóór het
> contact, 21 vragenlijsten uitgezet. 53% van wat het systeem signaleerde is logistiek en
> draait zonder tussenkomst. De overige 39 punten zijn klinische beslissingen — die
> blijven bij haar. Dat onderscheid is het hele ontwerp."

**Klik op de tegel "Voorbereiden".**

### 2. Voorbereiden — is alles binnen?

> "Negen afspraken vandaag, acht nog niet compleet. Per patiënt: wat is binnen, wat
> ontbreekt, en waar zou dit gesprek over moeten gaan."

Neem de eerste regel, **Ilse Meijer, 08:40**:

- links **Klaar voor het gesprek**: voetonderzoek, gewicht, bloeddruk
- links **Ontbreekt nog**: HbA1c, funduscontrole, albumine/creatinine-ratio
- rechts **Waar dit gesprek over zou moeten gaan**: *zelfredzaamheid is achteruitgegaan*

Wijs op het blok **Voorbereiding uit de wachtkamer**:

> "Dit is een ingebedde partnerapp. De patiënt heeft in de wachtkamer twee minuten
> ingesproken, en dat komt terug als gestructureerde anamnese met codesuggesties en een
> meegebrachte meting. Let op het label: **nog niet bevestigd.** Het telt nergens in mee
> zolang een mens het niet heeft overgenomen. Naadloze integratie zonder dat onderscheid
> is hetzelfde als ongecontroleerd vertrouwen."

Wijs rechtsboven op **Alles wat ontbreekt klaarzetten**:

> "En dit is logistiek werk zonder klinische beslissing — dus dat kan in één handeling
> voor iedereen."

**Klik op "Spreekuur" in het linkermenu.**

### 3. Het spreekuur — wie is er nu?

> "De dag als werklijst. Drie zijn geweest, één is niet verschenen, één zit binnen."

Bovenaan staat: **Nu aan de beurt: Anneke Bos — 10:40, chronische controle.**

> "Die vraag stelt een POH de hele ochtend: zit hij er al? In een gewone agenda moet je
> dat aan de assistent vragen. Hier staat het er, want de aanmeldzuil weet het."

**Klik op "Open het consultscherm".**

### 4. Het dossier — wie is deze mens?

Het dossier opent op het tabblad **Overzicht**.

> "Zeven vaste vragen: wie is dit, wat speelt er, hoe gaat het, wat kan deze mens zelf,
> wat gebeurde er het afgelopen jaar, wat staat er open, waar liggen de grenzen. Elke
> alinea met de bron eronder."

> "**Anneke Bos, 61 jaar, drie actieve episodes.** Bloeddruk 142, gedaald maar nog buiten
> de streefwaarde. Zelfredzaamheid 4 van 5 — goed, dus de contactintervallen mogen ruimer."

Zeg er expliciet bij:

> "Dit is nadrukkelijk **geen** AI-gegenereerd stukje. Het is opgebouwd uit vaste regels
> over gestructureerde gegevens. Een samenvatting stuurt waar een zorgverlener naar kijkt,
> en dat is beslissingsondersteuning: die moet per zin herleidbaar zijn. Een taalmodel kan
> dat niet garanderen."

Wijs rechts op de **aandachtsgebieden**:

> "Geen zorgprogramma's. Vier aandachtsgebieden bij déze mens, elk met de reden waarom hij
> aanstaat. De koppeling naar ketenzorg en declaratie gebeurt automatisch op de
> achtergrond."

**Klik op het tabblad "Consult".**

> "Links: wie is dit, in de volgorde waarin je het wilt weten — eerst wat aandacht vraagt,
> dan wie deze mens is, dan wat hij gebruikt, dan wat je kunt uitzetten. Midden: de loop
> van het consult. Rechts: de dossierstructuur."

Twee dingen om te laten zien, kies er één:

- **Medicatie.** Klik op een middel. Er schuift een paneel open: dosering aanpassen,
  vervangen, stoppen. Vóór je bevestigt staat er in zinnen wat er gaat gebeuren — het oude
  stopt, het nieuwe start, de lopende order wordt ingetrokken, het recept gaat naar díe
  apotheek. *"Vier mutaties, één handeling, één bevestiging."*
- **Vastleggen.** Scroll naar het registratieblok: de metingen die bij dit contact horen,
  de contactvorm, de duur, de episode. *"Je registreert één keer; de ketenverantwoording
  en de declaratie volgen eruit."*

### 5. De melding — er komt iets tussendoor

Ergens hier schuift rechtsonder een kaart in beeld: **Piet de Vries, 72 jaar,
portaalbericht — sinds gisteravond benauwder, pufjes helpen minder goed.**

Laat een stilte vallen en zeg:

> "En dit is wat er in het echt gebeurt. Je bent met een consult bezig en er komt iets
> binnen. Geen venster dat je werk blokkeert — dit is *binnen een uur*, geen spoed. Een
> kaart die blijft staan."

> "Waarom nu: COPD met een exacerbatie in de voorgeschiedenis, en toename van klachten met
> verminderde reactie op de luchtwegverwijders. Dat staat niet in de melding omdat het mooi
> staat, maar omdat Sanne moet kunnen beoordelen of ze hem nú oppakt of niet."

> "En dit is dezelfde Piet de Vries die de huisarts een half uur geleden op de bespreeklijst
> zette. Hij staat vanmiddag om 14:10 al in haar agenda."

Klik **Dossier bekijken** en laat zien dat het dossier het verhaal ook waarmaakt: één
actieve episode COPD, tiotropium, eGFR 37, en in het journaal het ziekenhuisbericht over de
opname longgeneeskunde.

> "En dat is niet toeval. Elke melding in dit systeem is gekoppeld aan een dossier dat de
> onderbouwing waarmaakt. Een waarschuwing die bij doorklikken nergens op slaat, leert een
> gebruiker om waarschuwingen te negeren."

### 6. Monitoren — wie hoeft er níet te komen

**Klik op "Monitoren".**

> "23 patiënten op afstand gevolgd, 7 met een signaal, 16 stabiel. En dát is de kern: wie
> stabiel is, hoeft niet langs. Dat is óók een uitkomst, en het scheelt een oproep."

Wijs een regel aan, bijvoorbeeld **Fatima Vermeulen**:

> "Per patiënt: wie het is, wat het signaal is, en een suggestieknop die kleurt zodra er
> iets achter zit. Staat er niets achter, dan staat dat er — je hoeft niet open te klappen
> om te ontdekken dat er niets is."

Klap er één uit en laat de **onderbouwing en de bronverwijzing** zien.

> "Elke klinische suggestie wijst naar de richtlijn waarop hij berust. Zonder die
> verwijzing is het een advies zonder verantwoording, en bij een MDR-audit niet houdbaar."

### 7. Afronden — wat blijft er liggen

**Klik op "Afronden".**

> "Twee categorieën. Acht patiënten met een ontbrekende ketenindicator — dat is een
> werklijst, geen cijfer. En acht vragenlijsten die klaargezet kunnen worden voor de
> volgende keer. Allebei veilig in bulk."

> "Nul openstaande taken. Dat is waar het naartoe moet: aan het eind van de dag is de
> administratie klaar omdat hij onderweg is ontstaan, niet omdat iemand een uur is blijven
> zitten."

---

## Afsluiten

Kies één zin, afhankelijk van je publiek:

- **Voor zorgverleners:** *"Het verschil is niet dat er meer in staat. Het verschil is dat
  het systeem de vraag beantwoordt die jij op dat moment stelt."*
- **Voor bestuurders:** *"53% van het gesignaleerde werk is logistiek en draait vanzelf.
  De rest zijn klinische beslissingen, en die horen bij een mens te blijven."*
- **Voor IT en inkoop:** *"FHIR als intern model, niet als exportformaat. Alles wat je
  ziet is één datamodel met herkomst per regel."*

---

## Spiekbriefje

Getallen die kloppen op het moment dat je inlogt, bij een verse demo.

| Waar | Wat |
|---|---|
| Assistent · triage | 14 zorgvragen · 7 portaal · 7 telefoon/balie · 1 zelfzorg afgevangen |
| Huisarts · autoriseren | 163 openstaand · **29 vragen jouw oordeel** · 134 routine |
| Huisarts · overleg | 11:00, 30 minuten, 4 punten |
| POH · tegels | Voorbereiden 9 (8) · Spreekuur 9 (3) · Monitoren 23 (7) · Afronden 3 (0) |
| POH · agenda | 12 items · 3 afgerond · 1 niet verschenen · 1 aangemeld |
| POH · eerste aandacht | Fatima Vermeulen — CCQ van 1 naar 2 |
| POH · nu aan de beurt | Anneke Bos, 10:40 |
| Automatisering | 53% · 23× labaanvraag · 21× vragenlijst · 39 punten voor jou |
| Praktijk | 48 patiënten |

**De acute meldingen, op volgorde van binnenkomst:**

| Na | Patiënt | Wat | Voor wie |
|---|---|---|---|
| 0 s | Dirk Mulder (83) | pijn op de borst — **spoed, modaal** | huisarts, assistent |
| 40 s | Piet de Vries (72) | benauwder, pufjes helpen minder | huisarts, **POH**, assistent |
| 95 s | Greetje de Boer (76) | thuismeter 212/118 | huisarts, **POH** |
| 150 s | Youssef de Boer | kalium 6,2 | huisarts |

---

## Wat je beter niet doet

**Open geen willekeurig dossier via het zoekveld.** De 48 patiënten zijn niet allemaal
even rijk gevuld; een deel heeft geen episodes en weinig historie. De patiënten in dit
script zijn dat wel. Wil je toch vrij rondklikken, neem dan iemand uit de agenda van de
POH of uit het monitoringcohort.

**Beloof geen koppelingen.** Er is geen LSP, geen ZorgDomein, geen G-Standaard en geen
receptverkeer. De velden en het werkproces zijn er; de transportlaag niet. Als iemand
ernaar vraagt is het eerlijkste antwoord: *"de order heeft een bestemming en een route —
wat eronder zit is een koppeling die we nog moeten bouwen."*

**Klik de videobelknop niet aan alsof er beeld komt.** Hij opent een venster dat het
werkproces toont en zet geen verbinding op. Dat is expres, en dat is ook het antwoord.

**Laat de praktijkmanager (`mirjam`) weg** tenzij je publiek erom vraagt. Zij heeft geen
dossiertoegang — dat is een goed verhaal over autorisatie, maar het leidt af van de reis.

**Reset tussen twee demo's door.** Als je in de vorige ronde medicatie hebt gewijzigd of
een consult hebt vastgelegd, staat dat er nog. **Demo herstellen** zet alles terug.
