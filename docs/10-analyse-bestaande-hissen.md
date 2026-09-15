# 10 — Analyse van bestaande HIS'en (mediKIT, HealthConnected, Bricks Huisarts)

Bron: schermafbeeldingen aangeleverd door de opdrachtgever, september 2026.
Doel: (a) de functionele ondergrens vaststellen — wat moet er sowieso in zitten —
en (b) benoemen waar deze systemen structureel tekortschieten voor teamgebaseerde,
persoonsgerichte chronische zorg.

---

## 1. Wat we zien

### 1.1 mediKIT — "Dossier" en "Intake"

Driekoloms dossierscherm:

| Kolom | Inhoud |
| --- | --- |
| **Links — patiëntcontext** | Patiëntgegevens (naam, geboortedatum + leeftijd, adres), waarschuwingsbanner *"Patiënt niet aangemeld bij ION"*, uitklapbare secties: Persoonsgegevens, Adres en contact, Inschrijving en export, Identificatie (met attentie-icoon), Voorkeuren, Verzekering, Woonverband. Daaronder losse panelen: Memo, Allergieën/Bijwerkingen, Medicatie, **Beantwoorde vragenlijsten**, Contra-indicaties, Afspraken. |
| **Midden — tijdlijn** | Doorzoekbare, gefilterde chronologische stroom (Consult · Medicatie · Overleg/brieven · Uitslagen · Memo · Afspraak). Elke regel: datum, zorgverlener, soort contact, tijdvak. SOEP-regels als `S` / `E` badges onder een episodekop. Medicatieregels inline. Paginering. |
| **Rechts — structuur** | Episodelijst (zoekveld, filter, checkbox *Toon inactief*) met datum, omschrijving, ICPC-code en icoonacties (koppelen, tonen, wijzigen). Uitslagen. Correspondentie/Overleg (filter Overleg · Document · Inkomende post). Berichten. |

Intake-scherm: **Hulpvraag** als vrije tekst, koppeling aan *bestaande episode*, bijlage,
**soort contact** (Telefoon · e-Consult · Videogesprek · Balie · Incident), en dan twee
actiegroepen: *Acties* (Consult, Recept) en *Agenda* (Naar de agenda, Overleg).

### 1.2 HealthConnected

- Linker hoofdnavigatie: Nieuws, Agenda, **Takenlijst**, Patiënten, Correspondentie,
  Berichten, Contacten, **Selectie**, **Rapportages**, Apps, Adresboek.
- Dossier als venster met tabs: Overzicht · Patiënt · Journaal · Episodes · Medicatie ·
  **ICA** · **Meetwaarden** · Bijlagen · Post.
- Rechterpaneel met eigen tabs: **Registratie · Patiënt · Taken · Agenda**, met bovenaan
  altijd *"Nieuw contact of afspraak — start hieronder direct een nieuwe registratie of
  noteer eerst de hulpvraag"*.
- Patiënttab toont: portaalstatus (Patiëntportaal ✓, Netwerkportaal ✓), BSN met
  verificatievinkje, **Behandelgrenzen** (reanimatie, kunstmatige beademing, overig),
  Notities, **Labels** (COVID, Griep, Pneumokokken, DM), contactpersonen met relatie en
  voorkeursnummer.
- Medicatie: filter Alle/Actief/Inactief, per regel de **episodekoppeling** (`N01`, `D02`,
  `T92`…), doseringsnotatie, herhaaltype, badges CHRONISCH / GDS / PATIËNT,
  datum laatste uitgifte, en een teller **"Medicatiebewaking — 14 meldingen"**.
- Onderaan het scherm staan **geopende patiënten als tabbladen** (A. Bakker, A. Hussein,
  M. Berghen, B. Berends) — de assistent werkt aan meerdere dossiers tegelijk.

### 1.3 Bricks Huisarts

- Bovennavigatie: Welkom · Patiënten · **Hulpvraag** · Agenda · **Autorisatie (163)** ·
  **Taken (3)** · Communicatie · Rapporten.
- Patiëntbalk met statusbadges: `CAT` `GV-` `PRTL+` `DBC chronische zorg`
  `DBC ouderenzorg` `VC` `WVB` `AFS` `ZP`, plus zorgverlener, patiëntnummer en praktijk.
- Consult-tabs: Journaal · Metingen · Verwijzen · Medicatie · **Protocollen** · Taken ·
  Wiki · Overig, met rechtsboven **Einde consult**.
- Journaal met expliciete **S/O/E/P-invoervelden**, episodedropdown, en 5 parallelle
  consultpagina's (1–5).
- Episodenlijst met ICPC-code + omschrijving en rode (actief) / grijze (inactief) markering:
  `B74.01 Multipel myeloom`, `Z29.01 Burn-out`, `B85.01 Gestoorde glucosetolerantie`,
  `K77.03 Hartfalen`, `R96 ASTMA`, `F83.01 Diabetische retinopathie`,
  `T90.02 Diabetes mellitus type 2`, `P85 LVB`…
- **Attentieregels** (`Att`, `All`) en **Ruiters** (`AR` `dvh` `GW` `GV` `EN` `GS`).
- Medicatieprofiel met sectie *Chronisch* en "Wacht op verzending: 50".
- Belangrijk: een ingevulde vragenlijst (*"Vragenlijst ter voorbereiding spreekuur
  Integrale Chronische Zorg Drenthe"*, bron `PA - FORM`) landt als reeks **O-regels** in
  het journaal: *MPG score lichaamsfuncties: 8, mentaal welbevinden: 7, zingeving: 6,
  meedoen: 6, dagelijks functioneren: 8, totaal gezondheidsoppervlakte: 7*.

---

## 2. Functionele ondergrens die hieruit volgt

Dit moet ons systeem sowieso kunnen. We nemen het over als **eisenlijst**, niet als
ontwerp.

**Patiëntcontext**: NAW + leeftijd, BSN met verificatiestatus, identificatiestatus,
verzekering, woonverband, voorkeuren, contactpersonen met relatie, portaalstatus,
inschrijfstatus/ION, behandelgrenzen, labels/vaccinatiestatus, memo/notities.

**Klinisch**: episodelijst (actief/inactief, ICPC, aanmaakdatum, koppelacties), journaal
met SOEP per deelcontact en episodekoppeling, meetwaarden, ICA (intoleranties,
contra-indicaties, allergieën), medicatie met episodekoppeling + herhaaltype + chronisch/GDS
+ medicatiebewaking, uitslagen, bijlagen, correspondentie in/uit, attentieregels en ruiters.

**Proces**: hulpvraag-gestuurde intake, contactsoort (balie/telefoon/e-consult/video/visite/
incident), agenda, takenlijst, autorisatieverzoeken, berichten, protocollen, verwijzen,
receptuur, selectie/rapportage, einde-consult-afsluiting.

**Werkomgeving**: meerdere dossiers tegelijk open, doorzoekbare tijdlijn met filters,
snelkoppelingen, en een expliciete opslaan-/afsluitactie.

---

## 3. Waar deze systemen structureel tekortschieten

Dit is de kern van het bestaansrecht van dit project. Elk punt hieronder is zichtbaar
in de screenshots zelf.

### 3.1 De werkvoorraad is een stuwmeer, geen werkproces
Bricks toont **"Autorisatie 163"** en **"Wacht op verzending: 50"**; HealthConnected toont
**"Medicatiebewaking 14 meldingen"**. Dit zijn tellers, geen workflows. Ze groeien, ze
worden aan het eind van de dag "weggeklikt", en ze bevatten geen prioritering, geen
oorzaakanalyse en geen mogelijkheid tot veilige bulkafhandeling van het triviale deel.
→ *Ons antwoord:* werkvoorraad als getypeerde `Task`-stroom met prioriteit, reden,
verwachte handeling en veilige batchafhandeling (zie `docs/04`).

### 3.2 De POH komt in geen enkel scherm voor als eigen rol
Alle drie de systemen tonen één dossier vanuit huisartsperspectief. Er is geen
POH-dagstart, geen monitoringcohort, geen zorgprogrammaplanning, geen eigen
werkvoorraad. Chronische zorg wordt afgedwongen via generieke "Protocollen" en
"Selectie"-modules — precies de route die in de praktijk in een Excel eindigt.
→ *Ons antwoord:* rolgebonden werkplekken op hetzelfde dossier (zie `docs/05`).

### 3.3 De episodelijst is plat; multimorbiditeit is onzichtbaar
In het Bricks-voorbeeld staan `T90.02 DM2`, `R96 Astma`, `K77.03 Hartfalen`,
`F83.01 Diabetische retinopathie` en `B85.01 Gestoorde glucosetolerantie` als
gelijkwaardige regels naast `A02 Koude rillingen` en `R08 Jeukende neus`. Het systeem
weet niet dat de eerste vijf samen één zorgvraag vormen en de laatste twee ruis zijn.
Drie zorgprogramma's → drie oproepen → drie consulten.
→ *Ons antwoord:* zorgprogramma's als expliciete laag bóven episodes, met samenvoeging
tot één integraal zorgplan (zie `docs/04`).

### 3.4 De vragenlijst is een dood eindpunt
Het Bricks-journaal laat zien wat er nu gebeurt: een ingevulde MPG-vragenlijst wordt
als zes losse O-regels tekst in het journaal geplakt. Er gebeurt niets mee. Geen
trigger, geen vergelijking met de vorige meting, geen taak, geen afwijkend beleid,
geen terugkoppeling naar de patiënt.
→ *Ons antwoord:* `Questionnaire` met logica en regels die `Task`s, notificaties,
protocolaanpassingen en zelfzorgadvies produceren (zie `docs/06`).

### 3.5 Codering is registratie, geen betekenis
ICPC-codes worden getoond als labels (`N01`, `D02`, `T92` bij medicatie). Er is geen
SNOMED-laag, dus inkomende informatie van ziekenhuis, apotheek of thuiszorg kan niet
betekenisvol landen — die wordt tekst.
→ *Ons antwoord:* ICPC én SNOMED naast elkaar met expliciete mapping en een hard
onderscheid referentieset/extern (zie `docs/02`).

### 3.6 Registratie kent geen herkomst
Nergens is zichtbaar of een regel door de huisarts, de POH, een AI-hulpmiddel of een
extern systeem is vastgelegd. Bij `PA - FORM` zie je de bron toevallig wél — dat is de
uitzondering die de regel bevestigt.
→ *Ons antwoord:* `Provenance` verplicht op elke klinische registratie (zie `docs/03`).

### 3.7 Het werk begint bij het scherm, niet bij de dag
Alle drie starten bij "zoek een patiënt" of "start een contact". Geen van de systemen
opent met: *dit is jouw dag, dit moet je doen, hier is het al voorbereid*.
→ *Ons antwoord:* de dagstart ís het startscherm (zie `docs/05`).

---

## 4. Wat we bewust overnemen

Deze systemen zijn niet slecht ontworpen — ze lossen het probleem van 2005 goed op.
Wat we overnemen, omdat het werkt en omdat gebruikers het kennen:

1. **De driedeling context / tijdlijn / structuur** in het dossierscherm. Herkenbaar en
   efficiënt. We houden die layout aan en veranderen de *inhoud*, niet de *plek*.
2. **Hulpvraag als startpunt van een contact** (mediKIT, HealthConnected). Correct
   uitgangspunt, dat houden we — en we koppelen het aan triage en protocol.
3. **SOEP met expliciete velden en episodekoppeling** (Bricks). De registratiestandaard
   van de sector; niet aan tornen.
4. **Meerdere dossiers tegelijk open** (HealthConnected). Onmisbaar voor de assistent.
5. **Attentieregels en ruiters**. Dit is werkende, snelle signalering; wij maken ze
   alleen gecodeerd en herleidbaar in plaats van vrije tekst.
6. **Episode actief/inactief met filter**. Simpel en effectief.
7. **Contactsoorten als eerste keuze** bij intake.

De vormtaal (rustige kleuren, hoge informatiedichtheid, kleine typografie) is eveneens
correct voor dit domein: een zorgverlener wil geen consumenten-UI met veel witruimte,
maar veel informatie in één oogopslag zonder scrollen.
