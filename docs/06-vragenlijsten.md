# 06 — Vragenlijsten als motor

## 1. Het misverstand

Leveranciers zeggen: *"wij ondersteunen vragenlijsten"*. Ze bedoelen: er is een formulier
en het antwoord komt als tekst in het journaal. Dat is aantoonbaar wat er gebeurt — zie
het Bricks-voorbeeld in `docs/10` §3.4, waar zes MPG-scores als losse O-regels in het
journaal belanden zonder enig gevolg.

Een vragenlijst is in werkelijkheid een **beslisboom die zorgprocessen aanstuurt**.

## 2. Wat een vragenlijst moet kunnen

| Capaciteit | Voorbeeld |
| --- | --- |
| **Conditionele vragen** | Rookt u? → ja → hoeveel, sinds wanneer, wilt u stoppen? |
| **Scores berekenen** | CCQ, PHQ-9, GAD-7, MPG, EQ-5D, SCORE2-risico |
| **Gestructureerd landen** | elk antwoord wordt een gecodeerde `Observation`, niet vrije tekst |
| **Vergelijken met eerder** | CCQ 1.8 → 2.9: een verslechtering van 1.1 is klinisch relevant |
| **Triggeren** | score boven drempel → taak, bericht, protocolwijziging, zelfzorgadvies |
| **Routeren** | naar huisarts óf POH, afhankelijk van de inhoud |
| **Terugkoppelen** | de patiënt krijgt meteen iets terug, niet alleen "bedankt" |
| **Voorbereiden** | vóór het consult uitgezet, uitkomst staat klaar bij de zorgverlener |

## 3. Het triggermodel

```ts
interface Trigger {
  id: string
  wanneer: Voorwaarde        // over antwoorden, scores, trends en dossiergegevens
  dan: Actie[]
  ernst: 'informatief' | 'aandacht' | 'urgent'
  onderbouwing: string       // vrij leesbaar: waarom vuurt deze regel
  richtlijn?: { naam: string; paragraaf?: string }
}

type Actie =
  | { type: 'taak';            categorie: string; rol: string; prioriteit: string }
  | { type: 'notificeer';      rol: 'huisarts' | 'poh-s' | 'assistent'; bericht: string }
  | { type: 'zelfzorgadvies';  adviesId: string }
  | { type: 'vervolgvraag';    vraagId: string }
  | { type: 'plan-afspraak';   afspraakType: string; binnenDagen: number }
  | { type: 'wijzig-intensiteit'; naar: Intensiteit; reden: string }
  | { type: 'lab-aanvraag';    bepalingen: string[] }
  | { type: 'meting-uitvragen'; codes: string[]; frequentie: string }
```

### Voorbeeld: CCQ bij COPD

```
CCQ afgenomen
 ├─ totaalscore ≥ 2.0 én toename ≥ 0.4 t.o.v. vorige
 │    → taak POH 'signaal-monitoring' urgent
 │    → notificeer POH: "CCQ verslechterd van 1.8 naar 2.9"
 │    → plan-afspraak 'copd-controle' binnen 14 dagen
 │    → zelfzorgadvies 'copd-longaanval-herkennen'
 ├─ vraag 'benauwd in rust' = veel/zeer veel
 │    → vervolgvraag 'sinds wanneer, koorts, sputum'
 │    → bij koorts + sputumverandering: notificeer huisarts, ernst urgent
 └─ stabiel, score < 1.0, drie metingen achtereen
      → voorstel intensiteit 'extensief' (ter bevestiging door POH)
```

Let op de laatste tak: het systeem stelt ook voor om **minder** te doen. Dat is
persoonsgerichte zorg, en geen enkel huidig systeem doet het.

## 4. Twee kanten van dezelfde lijst

Dezelfde `Questionnaire` wordt op twee plekken gerenderd:

- **Patiëntkant** (portaal/app): één vraag per scherm, begrijpelijke taal, B1-niveau,
  voortgangsindicator, opslaan en later verder, meteen een terugkoppeling.
- **Zorgverlenerkant**: compact, meerdere vragen tegelijk, sneltoetsen, met de vorige
  waarden ernaast.

Eén definitie, twee presentaties. Geen dubbel onderhoud.

## 5. Beslissingsondersteuning en de MDR

Zodra een trigger een klinisch advies geeft dat het handelen beïnvloedt, is het
regelsysteem mogelijk een medisch hulpmiddel (MDR, waarschijnlijk klasse IIa).
Wij lopen die route niet weg; we richten de architectuur er vanaf dag één op in:

1. **Afgebakende module.** De regelmotor is een apart, versioneerbaar onderdeel met een
   eigen versienummer. Niet verweven met de rest.
2. **Traceerbaarheid.** Elke vuurende regel legt vast: regel-id, versie, invoerwaarden,
   uitkomst, getoond aan wie, en wat de zorgverlener ermee deed.
3. **Richtlijnherkomst.** Elke regel verwijst naar de NHG-standaard of richtlijn met
   paragraaf en versie.
4. **Mens in de lus.** Geen enkele regel voert zelfstandig een klinische handeling uit.
   Alles is een voorstel dat een bevoegde zorgverlener accepteert of afwijst — met reden
   bij afwijzen, want die reden is het beste verbetersignaal dat er is.
5. **Gescheiden risicoklassen.** Puur logistieke regels (oproepen, plannen, herinneren)
   staan in een aparte motor dan klinische regels. Zo valt niet het hele systeem onder
   de MDR — alleen het deel dat dat verdient.

Zie `docs/07` voor de bredere compliance-aanpak.
