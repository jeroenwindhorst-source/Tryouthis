# 02 — Terminologie: ICPC-1 NL en SNOMED CT naast elkaar

## 1. Het probleem in één zin

De huisartsensector registreert in ICPC-1 NL (ruim 1.400 codes, bewust grofmazig),
de rest van de zorg communiceert in SNOMED CT (~385.000 concepten). Toon je die
385.000 concepten aan een huisarts, dan is het systeem onbruikbaar. Toon je ze niet,
dan kun je niets van buiten ontvangen.

## 2. De oplossing: drie niveaus, hard gescheiden

| Niveau | Wat | Mag je in registreren? | Hoe getoond |
| --- | --- | --- | --- |
| **1. Registratieset** | ICPC-1 NL + de NHG-referentieset SNOMED die daaraan gekoppeld is | **Ja** — dit is de enige set die de zoekfunctie bij registratie aanbiedt | Normaal, met ICPC-code zichtbaar |
| **2. Uitbreidingsset** | SNOMED-concepten die binnen de NL-huisartsen-refset vallen maar buiten de directe ICPC-mapping (specifieker) | Ja, maar altijd gekoppeld aan een ICPC-"paraplu" | Normaal, met de ICPC-parent erbij |
| **3. Externe concepten** | De volledige SNOMED CT-terminologie, ontvangen van ziekenhuis, apotheek, lab, thuiszorg | **Nee** | Zichtbaar gemarkeerd als extern, met herkomst, en waar mogelijk met de dichtstbijzijnde eigen code als context |

Dit onderscheid is geen UI-detail. Het zit in het datamodel: elke `Coding` draagt
een `registratieniveau` en een `herkomst`. Een externe SNOMED-code kan in het dossier
staan zonder ooit door een huisarts geregistreerd te zijn — en dat moet je kunnen zien.

## 3. Waarom niet gewoon "alles SNOMED"

Drie redenen die in de sector telkens worden onderschat:

1. **Declaratie en ketenzorg draaien op ICPC.** Ketenzorg-inclusie, indicatoren
   (NHG/InEen), en het HIS-referentiemodel gebruiken ICPC. Overstappen zonder mapping
   betekent dat je je eigen financiering breekt.
2. **ICPC is bewust grofmazig en dat is een feature.** `K86 Hypertensie zonder
   orgaanbeschadiging` is precies genoeg voor de huisarts. SNOMED dwingt een keuze
   tussen tientallen specifieker concepten die de huisarts niet kán maken.
3. **Historische dossiers blijven ICPC.** Vijftig jaar registratie converteer je niet.
   Beide codes moeten dus permanent naast elkaar bestaan, niet tijdelijk.

Daarom: **dual coding**. Wij registreren altijd beide, met de mapping onder water.

## 4. Datamodel van een gecodeerde registratie

```ts
interface GecodeerdConcept {
  icpc1?:  { code: string; display: string }   // 'T90.02', 'Diabetes mellitus type 2'
  snomed?: { code: string; display: string }   // '44054006', 'Diabetes mellitus type 2'
  niveau:  'registratieset' | 'uitbreidingsset' | 'extern'
  herkomst: {
    bron: 'zorgverlener' | 'ai-suggestie' | 'extern-systeem' | 'patient'
    systeem?: string          // bijv. 'Epic - Ziekenhuis X'
    bevestigdDoor?: string    // verplicht als bron === 'ai-suggestie'
    vertrouwen?: number       // 0..1, alleen bij AI
  }
  mappingKwaliteit?: 'exact' | 'ruimer' | 'nauwer' | 'gedeeltelijk' | 'geen'
}
```

`mappingKwaliteit` volgt de FHIR `ConceptMap.equivalence`-semantiek. Dit veld is
cruciaal bij ontvangst: een ziekenhuis stuurt `Diabetische nefropathie`; onze
dichtstbijzijnde eigen code is `T90.02 DM2` (ruimer) plus `U99.01 chronische nierschade`
(gedeeltelijk). Die nuance moet zichtbaar blijven, niet weggeplet worden.

## 5. Verwerking van inkomende externe codes

```
externe SNOMED-code binnen
        │
        ├─ zit in registratieset?      → toon als eigen code, stel voor over te nemen
        ├─ zit in uitbreidingsset?     → toon met ICPC-parent, stel voor over te nemen
        ├─ is subsumed door een concept in onze set (via IS-A)?
        │                              → toon als extern, met de eigen parent als context
        └─ geen relatie                → toon als extern, ongecodeerd in ons kader,
                                          bewaar origineel volledig (nooit weggooien)
```

Wat we **nooit** doen: een externe code stilzwijgend vervangen door onze eigen code.
Het origineel blijft altijd bewaard in `Condition.code.coding[]`; onze interpretatie
komt ernaast, niet ervoor.

## 6. De mapping zelf

De opdrachtgever beschikt over een bestaande ICPC-1 NL ↔ SNOMED CT-mapping. Die wordt
de gezagsbron. Het inleesformaat is vastgelegd in
`packages/terminology/src/mapping-schema.ts`; verwacht wordt een tabel met minimaal:

| Kolom | Verplicht | Voorbeeld |
| --- | --- | --- |
| `icpc1Code` | ja | `T90.02` |
| `icpc1Display` | ja | `Diabetes mellitus type 2` |
| `snomedCode` | ja | `44054006` |
| `snomedFsn` | nee | `Diabetes mellitus type 2 (disorder)` |
| `snomedDisplayNl` | ja | `Diabetes mellitus type 2` |
| `equivalentie` | ja | `exact` / `ruimer` / `nauwer` / `gedeeltelijk` |
| `refset` | nee | `huisarts-diagnose` |
| `geldigVanaf` / `geldigTot` | nee | `2024-01-01` |

Aanlevering in CSV of Excel is prima; de importer normaliseert. Zolang de echte mapping
er niet is, draait de repo op een kleine, expliciet als demo gemarkeerde seed
(`packages/terminology/src/seed.ts`) met echte SNOMED-concept-id's en echte ICPC-codes,
zodat de logica getest kan worden.

## 7. Versiebeheer

Terminologie verandert. SNOMED CT NL kent twee releases per jaar, ICPC-1 NL wordt door
het NHG bijgehouden. Daarom:

- Elke `Coding` in het dossier legt vast tegen **welke versie** hij is geregistreerd.
- Codes worden nooit verwijderd, alleen `inactive` gemaakt met een opvolger.
- Een populatiequery zegt expliciet of hij historisch (zoals geregistreerd) of actueel
  (na hermapping) wil rekenen. Voor indicatoren is dat het verschil tussen kloppen en
  niet kloppen.

## 8. Prestatie-eis

Zoeken in de registratieset moet onder de 100 ms blijven, inclusief synoniemen en
typefouten. Implementatie: in-memory index met trigram-matching over voorkeursterm +
synoniemen + ICPC-code, opgebouwd bij start. De registratieset is klein genoeg
(enkele tienduizenden termen) om volledig in het geheugen te passen. De volledige
SNOMED-set staat in Postgres en wordt alleen geraadpleegd bij ontvangst en bij
expliciet "zoek breder".
