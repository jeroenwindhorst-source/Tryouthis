# 07 — Beveiliging, privacy en compliance

Dit hoofdstuk is geen bijlage. In de Nederlandse zorg bepaalt het of je überhaupt mag
draaien, en de eisen raken de architectuur direct.

## 1. Wettelijk en normatief kader

| Kader | Wat het eist | Architectuurgevolg |
| --- | --- | --- |
| **AVG / UAVG** | grondslag, dataminimalisatie, rechten van betrokkene | doelbinding per query; export- en inzagefunctie als eerste-klas feature |
| **Wgbo** | dossierplicht, bewaartermijn (20 jaar), inzagerecht | append-only opslag; niets wordt echt verwijderd, alleen logisch |
| **Wabvpz** | gespecificeerde toestemming, elektronische inzage | toestemmingsregister als eigen domein, per uitwisselingsdoel |
| **NEN 7510** | ISMS voor de zorg | organisatorisch + technisch; basis voor certificering |
| **NEN 7512** | vertrouwensniveaus bij uitwisseling | wederzijdse authenticatie, PKI-overheid/UZI |
| **NEN 7513** | logging van toegang tot patiëntgegevens | onvervalsbare, doorzoekbare `AuditEvent`-log; patiënt kan inzien wie keek |
| **Wegiz** | verplichte elektronische gegevensuitwisseling per aangewezen stroom | FHIR-profielen, geen eigen formaten |
| **EHDS** | Europese primaire/secundaire toegang | EEHRxF-compatibiliteit; SNOMED als betekenislaag (`docs/02`) |
| **MDR** | beslissingsondersteuning = mogelijk hulpmiddel | afgebakende, versioneerbare regelmotor (`docs/06` §5) |
| **AI Act** | AI in de zorg = hoog risico | herkomst, menselijk toezicht, logging, transparantie (`docs/03` §3) |

## 2. Identiteit en toegang

- **Zorgverleners**: UZI-pas of een gecertificeerde IdP met MFA; sessies kort, met
  snelle herauthenticatie (een POH die per patiënt opnieuw moet inloggen, omzeilt het
  systeem — beveiliging die het werk breekt, ís geen beveiliging).
- **Patiënten**: DigiD op minimaal substantieel.
- **Systemen**: OAuth 2.0 / SMART on FHIR met mTLS, scopes per resource en per doel.
- **Autorisatie**: attribuutgebaseerd (rol × relatie × episode-afscherming × doel), niet
  alleen rolgebaseerd. Behandelrelatie is een expliciet, controleerbaar gegeven.

## 3. Logging (NEN 7513) die echt werkt

Elke leesactie op patiëntgegevens logt: wie, wanneer, welk gegeven, vanuit welke rol,
met welk doel, en vanaf welk apparaat. De log is append-only, apart opgeslagen en
onafhankelijk doorzoekbaar.

Twee eisen die meestal vergeten worden:
1. De patiënt moet zijn eigen log kunnen inzien, leesbaar. Niet als CSV-dump.
2. De log moet doorbreking van afscherming (bijv. GGZ-episode in een spoedsituatie)
   apart markeren en actief onder de aandacht brengen van de privacyfunctionaris.

## 4. Gegevensbescherming in het ontwerp

- Versleuteling in rust (kolom-niveau voor BSN en bijzondere categorieën) en in transit.
- Pseudonimisering standaard in alles wat niet direct zorgverlening is: rapportages,
  onderzoek, kwaliteitsindicatoren, foutopsporing.
- Scheiding van omgevingen; **nooit** productiedata in test of ontwikkeling — synthetische
  populatiegeneratie is onderdeel van de toolchain, geen bijzaak.
- Geen persoonsgegevens in logs, traces of foutmeldingen.
- Hosting in de EU, bij voorkeur NL; geen Amerikaanse cloud zonder aantoonbare
  soevereiniteitsoplossing (CLOUD Act-risico is reëel en toezichthouders kijken mee).

## 5. AI-componenten

AI is welkom (spraak naar SOEP, codeersuggesties, samenvatting, signalering) onder
vier voorwaarden die technisch worden afgedwongen, niet beleidsmatig beloofd:

1. **Altijd gemarkeerd als suggestie** tot een bevoegde zorgverlener bevestigt.
2. **Niet-bevestigde AI-output telt nergens mee** — niet in indicatoren, niet in
   populatiequeries, niet in uitwisseling. Dit is een filter in de datalaag, geen
   afspraak.
3. **Volledig logbaar**: model, versie, invoer, uitvoer, vertrouwen, wat de mens deed.
4. **Verwerking bij voorkeur binnen de eigen omgeving.** Gaat er data naar een externe
   modelaanbieder, dan is dat een expliciete, per-functie zichtbare keuze met
   verwerkersovereenkomst — geen impliciete default.

## 6. Continuïteit

Een HIS is kritieke infrastructuur voor de praktijk. Uitval betekent geen zorg.

- Doelstellingen: RPO < 5 minuten, RTO < 1 uur.
- **Read-only noodmodus**: bij storing in de schrijflaag blijft het dossier leesbaar.
  Dit is een architectuureis, geen operationele wens.
- Exportfunctie waarmee de praktijk haar eigen data volledig en in standaardformaat
  meekrijgt. Geen vendor lock-in — en dat is ook een verkoopargument in een markt waar
  praktijken zich gevangen voelen.
