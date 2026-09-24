# 14 — Configuratie en ingebedde apps

## 1. Waarom configuratie een module is, geen instellingenscherm

In de huidige HIS-markt is vrijwel alles wat een praktijk wil veranderen een
leverancierswijziging. Een zorggroep die een controle-interval wil aanpassen, een
praktijk die een eigen zoekterm wil toevoegen, een regio die een app wil aansluiten:
het gaat allemaal via een ticket, en het duurt maanden.

Dat komt niet doordat leveranciers traag zijn. Het komt doordat terminologie, protocol,
beslisregels en integraties als code in het product zitten in plaats van als
instellingen erboven.

## 2. Vier niveaus

```
landelijk   →   zorggroep   →   praktijk   →   gebruiker
```

Het laagste niveau dat iets zegt, wint. Dat is geen technische keuze maar de
bestuurlijke werkelijkheid van de Nederlandse eerste lijn:

| Niveau | Wie | Wat daar hoort |
| --- | --- | --- |
| **Landelijk** | NHG, Nictiz | Terminologie, referentiesets, SNOMED-editie, ICPC-tabel. Niet lokaal te wijzigen, wel aan te vullen. |
| **Zorggroep** | Kaderhuisarts, ketenmanagement | Welke aandachtsgebieden meedoen, regionale intervalafspraken, indicatoren, declaratie, regionaal ingekochte apps. |
| **Praktijk** | Praktijkmanager | Werkwijze, eigen zoektermen, welke automatisering aan staat, eigen apps, regels die bewust uit staan. |
| **Gebruiker** | De zorgverlener zelf | Favorieten, schermvoorkeuren. |

## 3. Herkomst is even belangrijk als de waarde

Bij elke instelling is zichtbaar op welk niveau hij is gezet, door wie, en welke
onderliggende instelling daarmee is overruled. Een beheerder die niet kan zien waar
een waarde vandaan komt, durft niets te veranderen — en dan is configureerbaarheid
alsnog waardeloos.

In de werkplek staat dat onder **Configuratie**: de vier lagen met hun beheerder en
wijzigingsdatum, en daaronder een tabel met elke effectieve waarde, het niveau waar hij
vandaan komt en wat hij heeft overschreven.

## 4. Samenvoegen: vervangen, niet mengen

Een niveau vervangt een instelling volledig of laat hem met rust. Bewust géén diepe
samenvoeging van lijsten — dan weet niemand meer wat waar vandaan komt en wordt
foutzoeken onmogelijk.

De enige uitzondering is `apps`: daar tellen lagen op. Een praktijk zet apps áán
bovenop wat de zorggroep regionaal levert, zonder die te verliezen.

## 5. De terminologielaag hoort hier

Wat in `docs/02` als terminologielaag is beschreven, is in de eindsituatie een set
instellingen op deze niveaus:

| Instelling | Hoort op | Waarom |
| --- | --- | --- |
| Actieve referentiesets | landelijk | Wat je mag registreren is een landelijke afspraak |
| SNOMED-editie, ICPC-tabelversie | landelijk | Distributie en versiebeheer liggen bij NHG/Nictiz |
| Breed zoeken in SNOMED toegestaan | landelijk, praktijk mag aanscherpen | Voorkomt dat 385.000 concepten in een registratiescherm belanden |
| Eigen synoniemen | praktijk | "Ouderdomssuiker" is lokaal taalgebruik, geen landelijke term |
| Favoriete codes | zorggroep, gebruiker | Wat een regio veel registreert verschilt van wat één POH veel registreert |

Belangrijk: lokale toevoegingen zijn altijd *aanvullingen op* de landelijke set, nooit
vervangingen. Een eigen synoniem laat je een landelijk concept sneller vinden; het maakt
geen nieuw concept. Zo blijft uitwisseling werken.

## 6. Ingebedde apps

Een praktijk wil in de wachtkamer software van derden gebruiken — spraakgestuurde
voorbereiding, digitale triage, telemonitoring — en die moet aanvoelen als eigen
functionaliteit. Tegelijk mag "naadloos" nooit betekenen: niet meer te zien waar iets
vandaan komt.

Daarom is elke app een registratie met vijf verplichte velden:

```ts
interface AppRegistratie {
  plek: 'wachtkamer' | 'consult' | 'triage' | 'portaal';
  levert: string[];                              // welke gegevens het terugschrijft
  herkomst: 'extern-systeem' | 'ai-suggestie';   // hoe die gegevens gemerkt worden
  bevestigingVerplicht: boolean;                 // bij AI altijd
  grondslag: string;                             // toestemming en verwerkersovereenkomst
}
```

### Hoe het voelt, en hoe het werkt

**Voor de patiënt en de zorgverlener** staat de uitkomst gewoon in het scherm waar hij
thuishoort: bij de consultvoorbereiding en bovenaan het consult, in dezelfde vormtaal
als de rest. Geen apart tabblad, geen tweede inlog.

**Onder water** draagt alles wat de app oplevert `Herkomst.bron = 'ai-suggestie'` of
`'extern-systeem'` (`docs/03` §3). Een AI-suggestie telt nergens in mee — niet in
indicatoren, niet in populatiequeries, niet in uitwisseling — tot een bevoegde
zorgverlener hem bevestigt. Dat filter zit in de datalaag (`isKlinischGeldig`), niet in
een afspraak.

In de demo levert een wachtkamer-app een gesproken voorbereiding op: de hulpvraag in de
woorden van de patiënt, een gestructureerde anamnese, codesuggesties mét
vertrouwensscore, en meegebrachte thuismetingen. De zorgverlener ziet wat er is
voorgesteld en neemt over wat klopt.

### Technisch

Apps draaien via SMART on FHIR app launch op dezelfde API die externe partijen zien
(`docs/08` §5). Er is geen achterdeur: wat een app kan, kan elke andere partij ook.
De vormtaal wordt gedeeld via designtokens, zodat een ingebedde app er als onderdeel
van het systeem uitziet zonder dat hij er onderdeel van is.

## 6b. Het protocol aanpassen

De vier niveaus hierboven gaan over instellingen. Het protocol zelf — welke metingen bij
een aandachtsgebied horen, hoe vaak ze moeten, hoeveel dagen vóór het consult ze binnen
moeten zijn — was tot nu toe alleen te lezen.

Dat klopt niet met de praktijk. Elke praktijk wijkt af: het prikpunt is traag, de
optometrist doet de funduscontrole, deze populatie vraagt om vaker controleren. Die
afwijkingen bestaan al, maar ze zitten in hoofden en werkafspraken en niet in het systeem.

Aanpassen kan nu, onder drie voorwaarden:

1. **De richtlijn blijft ernaast staan.** De landelijke modules worden nooit gemuteerd;
   de praktijkinstelling is een laag eroverheen. In het scherm staat bij elke gewijzigde
   waarde wat de richtlijn zei.
2. **Een afwijking vraagt een reden**, samen met wie hem maakte en wanneer. Zonder reden
   is een afwijking over een half jaar niet te onderscheiden van een vergissing.
3. **Het recht ligt bij wie ermee werkt** — huisarts, praktijkondersteuner én
   praktijkmanager. Wie het spreekuur draait weet als eerste dat het prikpunt traag is.

Zie [ADR-0018](adr/ADR-0018-protocol-is-aanpasbaar-met-reden.md).

## 7. Wat hiervan in de repo zit

```
packages/configuratie/src/index.ts       niveaus, instellingen, app-registratie, oplossing
packages/praktijk/src/configuratie-demo.ts   vier gevulde lagen als voorbeeld
apps/web/src/schermen/Beheer.tsx         de beheerweergave met herkomst per instelling
```

De resolutie is een pure functie: `losOp(lagen) → effectieve configuratie met herkomst`.
Geen verborgen volgorde, geen impliciete defaults.
