# 13 — Beslissingsondersteuning en automatisering

## 1. Het onderscheid dat alles bepaalt

Niet alle "slimme" functionaliteit is hetzelfde. Er zijn twee soorten regels, en ze door
elkaar halen is de reden dat leveranciers óf te weinig durven óf te veel beloven.

| | **Logistieke regels** | **Klinische regels** |
| --- | --- | --- |
| Voorbeeld | labaanvraag klaarzetten, vragenlijst uitzetten, oproep versturen, herinnering sturen | medicatiebeleid heroverwegen, controlefrequentie aanpassen, verwijzen, afschalen |
| Raakt een klinische beslissing | nee | ja |
| Mag automatisch draaien | **ja** | **nooit** |
| Valt onder de MDR | nee | waarschijnlijk klasse IIa |
| Wie beslist | het systeem, terug te draaien | een bevoegde zorgverlener |

Door die scheiding technisch af te dwingen valt niet het hele systeem onder de MDR —
alleen het deel dat dat verdient (ADR-0005). En de zorgverlener ziet in één oogopslag
wat vanzelf is gegaan en waar zij zelf over gaat.

In de demopopulatie is ongeveer 58% van het gesignaleerde werk logistiek. Dat is de
concrete invulling van "meer dan de helft van de tijd gaat op aan administratie": het
grootste deel daarvan hoeft geen mens te raken.

## 2. Wat een suggestie moet bevatten

```ts
interface Suggestie {
  titel: string;
  bevinding: string;        // de feiten, met waarden en datums — narekenbaar
  onderbouwing: string;     // waarom dit ertoe doet
  richtlijn?: { naam: string; paragraaf?: string };
  ernst: 'informatief' | 'aandacht' | 'urgent';
  klasse: 'logistiek' | 'klinisch';
  automatisch: boolean;     // alleen waar bij logistiek
  rol: 'poh-s' | 'huisarts' | 'assistent';
  acties: SuggestieActie[]; // elk met een `gevolg`: wat gebeurt er als ik dit kies
  regelId: string;
  regelVersie: string;
}
```

Vier eisen, alle vier afgedwongen door tests:

1. **Bevinding vóór advies.** Eerst de feiten met waarden en datums, dan pas de
   aanbeveling. Een advies dat je niet kunt narekenen is geen advies maar een orakel.
2. **Elke actie zegt wat er gebeurt.** Geen knop zonder `gevolg`.
3. **Afwijzen kan altijd**, met reden. Die reden is het beste verbetersignaal dat er is.
4. **Regel-id, versie én bron zijn zichtbaar.** Onder elke suggestie staat waarop hij
   berust, met een klikbare verwijzing naar de richtlijn — NHG-standaard, behandelrichtlijn
   of internationale bron — inclusief paragraaf en versie. Zonder herleidbaarheid is een
   advies niet verantwoordbaar en bij een MDR-audit niet houdbaar.

   De URL's volgen het patroon van `richtlijnen.nhg.org` en moeten bij release tegen de
   actuele index worden gecontroleerd: standaarden worden hernoemd en samengevoegd, en
   een dode link ondermijnt precies het vertrouwen dat de verwijzing moet opbouwen.
   Daarom is de naam altijd het primaire signaal en de link secundair.

## 3. De regels

### Klinisch — altijd een voorstel

| Regel | Vuurt wanneer | Voorstel |
| --- | --- | --- |
| `glucose-ontregeld` | HbA1c > 64 mmol/mol | Beleid heroverwegen; begin bij therapietrouw en techniek, niet bij ophogen |
| `bloeddruk-te-hoog` | systolisch ≥ 160 | Eerst een thuismeetreeks; die onderscheidt praktijkhypertensie van echte hypertensie |
| `nierfunctie-gedaald` | eGFR < 45 of ≥ 25% daling | Medicatiebeoordeling — **naar de huisarts**, niet naar de POH |
| `stoppen-met-roken` | rookt én long- of vaatmodule actief | Begeleidingstraject; grootste gezondheidswinst van alles wat we kunnen doen |
| `mentaal-laag` | gezondheidsoppervlakte ≤ 5 | Agenderen als gespreksonderwerp; eventueel POH-GGZ |
| `afschalen-stabiel` | drie metingen op streefwaarde | **Minder** vaak controleren |
| `module-*` | aandachtsgebied nieuw relevant | Toevoegen aan het plan |
| `zelfredzaamheid-gedaald` | score lager dan bij de vorige afname | Vaker contact, of overleg met wijkteam (`docs/15`) |

### Logistiek — mag automatisch

| Regel | Vuurt wanneer | Handeling |
| --- | --- | --- |
| `lab-klaarzetten` | eerstvolgend contact vraagt labbepalingen | Aanvraag klaar, prikafspraak ruim vóór het consult |
| `vragenlijst-uitzetten` | contact heeft een voorbereidende vragenlijst | Uitzetten via portaal, met herinnering |
| `thuismeting-aanbieden` | ≥ 2 items zijn thuis meetbaar en portaal actief | Aanbieden (wel met bevestiging: of het passend is, beoordeelt de zorgverlener) |

## 4. Het systeem stelt ook voor om minder te doen

`afschalen-stabiel` is de regel die in geen enkel bestaand systeem zit. Alles wordt
gebouwd om te signaleren wat misgaat; niets signaleert wat goed genoeg gaat om minder te
doen. Terwijl dat precies is wat persoonsgerichte zorg én capaciteitsdruk vragen.

De regel vuurt bij drie achtereenvolgende metingen op streefwaarde en stelt voor de
intensiteit naar `rustig` te zetten. Nooit automatisch — afschalen is een klinische
beslissing — maar wel proactief.

## 5. Herkomst en AI

De regelmotor is deterministisch: gegeven hetzelfde dossier volgt dezelfde uitkomst.
Dat is bewust. AI-componenten (spraak naar SOEP, codeersuggesties, samenvatting) leveren
*invoer* voor het dossier, geen adviezen — en dragen altijd `Herkomst.bron =
'ai-suggestie'` tot een mens bevestigt (`docs/03` §3).

Onbevestigde AI-output telt nergens mee: niet in de regels, niet in indicatoren, niet in
uitwisseling. Dat filter zit in de datalaag (`isKlinischGeldig`), niet in beleid.

## 6. Wat er in de werkplek van te zien is

- **Dagstart** — "het systeem heeft dit vandaag al voor je gedaan", met het percentage
  logistiek werk en het aantal punten dat op een mens wacht.
- **Aanloop** — per geplande controle of de voorbereiding op schema ligt, met het advies
  dat bij het aantal resterende dagen hoort.
- **Spreekuur** — per patiënt van vandaag de twee tot drie gespreksonderwerpen die uit de
  klinische regels volgen, met de ingevulde vragenlijst erboven.
- **Opvolgen** — wat binnenkwam bij mensen zonder afspraak, met een voorstel per regel.
- **Monitoren** — per patiënt uitklapbaar de suggesties, direct af te handelen.
- **Consult** — bovenaan de klinische suggesties (jouw beslissing), daaronder een groen
  blok met wat het systeem zelf heeft geregeld.
- **Afronden** — wat bulkgewijs mag en wat een mens moet beoordelen, expliciet gescheiden.
