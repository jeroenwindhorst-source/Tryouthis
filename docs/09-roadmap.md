# 09 — Roadmap en aanpak

## 1. Volgorde van bewijs

Niet "eerst alles bouwen en dan uitrollen", maar per fase één ding onomstotelijk
aantonen.

### Fase 0 — Fundament *(deze repo)*
Datamodel, terminologielaag, het geïntegreerde protocol, persoonlijk zorgplan,
vragenlijstmotor, POH-werkplek als vertical slice. Draait op synthetische data.

**Bewijs:** een patiënt met DM2 + CVRM + COPD krijgt aantoonbaar één samengevoegd
plan met 3 contacten in plaats van 8, en de inclusie gebeurt in-dossier zonder Excel.

### Fase 1 — Werkende POH-module naast het bestaande HIS (6–9 mnd)
Leest uit het bestaande HIS (via beschikbare koppelingen/extractie), schrijft terug wat
kan. Draait bij 2–3 pilotpraktijken voor chronische zorg.

**Bewijs:** administratietijd van de POH meetbaar omlaag; oproepproces zonder Excel.
Dit is ook commercieel het slimste instappunt: praktijken hoeven hun HIS niet te
vervangen om het voordeel te krijgen.

### Fase 2 — Volwaardig HIS voor de pilotpraktijken (12–18 mnd)
Journaal, episodes, medicatie + bewaking, agenda, correspondentie, declaratie,
assistentenwerkplek, patiëntportaal. Migratiepad vanuit bestaande HIS'en.

**Bewijs:** een praktijk kan volledig over, inclusief dataconversie en uitwisseling.

### Fase 3 — Opschaling
Certificering (NEN 7510, MDR voor de beslissingsondersteuningsmodule), aansluiting op
landelijke voorzieningen, meerdere praktijken, ketenzorgorganisaties.

## 2. Waarom deze volgorde

De POH-module eerst, omdat:
- daar de pijn het grootst en het meest meetbaar is;
- je geen HIS hoeft te vervangen om waarde te leveren (lage drempel voor de praktijk);
- het precies het oranje cluster uit het AHA-functiemodel is (`docs/11` §2) — de functies
  die nu bij niemand goed belegd zijn;
- je er het volledige datamodel voor nodig hebt, dus je bouwt het fundament sowieso;
- een KIS-vervanger een duidelijker verkoopverhaal heeft dan "nóg een HIS".

## 3. Risico's die het project kunnen breken

| Risico | Waarom reëel | Beheersing |
| --- | --- | --- |
| **Datatoegang tot bestaande HIS'en** | Leveranciers hebben geen belang bij een goede koppeling | Vroeg testen; Wegiz/EHDS als hefboom; extractieroute als terugvaloptie |
| **Certificeringslast** | NEN 7510 + MDR kosten tijd en geld vóór de eerste euro omzet | Vanaf dag één inrichten (`docs/07`); MDR-scope bewust klein houden |
| **Ketenzorgfinanciering** | Het verdienmodel van ketenzorg beloont contacten, niet uitkomsten | Samenwerken met zorggroep/verzekeraar in de pilot; de besparing aantoonbaar maken |
| **Adoptie** | Zorgverleners hebben migratiemoeheid | Naast bestaand HIS beginnen; winst binnen twee weken zichtbaar |
| **Scope** | Een HIS is enorm; alles tegelijk willen is de standaardvalkuil | Per fase één bewijs; niets bouwen dat geen fase-doel dient |
| **Terminologiebeheer** | Halfjaarlijkse releases, mapping-onderhoud | Vanaf het begin versioneerbaar (`docs/02` §7); niet achteraf inbouwen |

## 4. Wat er nu nodig is van de opdrachtgever

1. **De ICPC-1 NL ↔ SNOMED-mapping** in het formaat uit `docs/02` §6 (CSV/Excel is prima).
2. **Bevestiging van de lezing van het AHA-functiemodel** (oranje = gat, `docs/11`).
3. **Diepe uitwerking van het aandachtsgebied hart- en vaatrisico** (CVRM), conform de
   keuze die stedelijk al is gemaakt. Let wel: dat is een *module* binnen het ene
   protocol, geen apart zorgprogramma.
4. **Toegang tot een echt protocol** (bijv. de AHA-protocollen of die van een zorggroep)
   om de protocolmotor tegen de werkelijkheid te toetsen.
5. **Contact met 1–2 praktijken** die als klankbord willen dienen — niet aan het eind,
   maar nu.
