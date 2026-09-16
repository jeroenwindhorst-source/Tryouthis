# 16 — Ordermanagement

Zie ADR-0009 voor het besluit. Dit document beschrijft wat er staat.

## 1. Waarom de order het scharnier is

Het consult is pas af als er iets de praktijk uit gaat. Een order is dat moment:
het recept naar de apotheek, de bepaling naar het lab, de brief naar de tweede lijn,
de verrichting naar de agenda. Alles daarvoor is voorbereiding, alles daarna is
opvolging.

Daarom staat de ordertab naast het consult en niet in een aparte module: hij leest
hetzelfde dossier, dezelfde aandachtsgebieden en dezelfde meetwaarden als het scherm
waar het besluit valt.

## 2. Ordersets

```
OrderSet {
  id, titel, waarom            — één zin, in mensentaal
  module                       — welk aandachtsgebied hem aanbiedt
  richtlijn { bron, paragraaf, url, uitgever }
  regels: OrderRegel[]
}

OrderRegel {
  soort: 'medicatie' | 'lab' | 'verwijzing' | 'verrichting'
  omschrijving, code, dosering?, termijn?
  recht                        — welk recht een gebruiker nodig heeft
}
```

De negen sets die er nu zijn:

| Set | Module | Bron |
|---|---|---|
| Start metformine | glucose | NHG-Standaard DM2 |
| Bloeddruk intensiveren | vaatrisico | NHG-Standaard CVRM |
| Jaarlab diabetes | glucose | NHG-Standaard DM2 |
| Funduscontrole | glucose | NHG-Standaard DM2 |
| Voetzorg | glucose | Zorgmodule Preventie Diabetische Voetulcera |
| Stoppen met roken | leefstijl | NHG-Behandelrichtlijn Stoppen met roken |
| COPD-jaarcontrole | ademhaling | NHG-Standaard COPD |
| Medicatiebeoordeling | medicatieveiligheid | Richtlijn Polyfarmacie bij ouderen |
| Sociaal domein | kwetsbaarheid | lokale werkafspraak (zorggroepniveau) |

De laatste is bewust geen landelijke richtlijn: het laat zien dat een zorggroep een
eigen set mag toevoegen, zolang de herkomst maar ingevuld is.

## 2b. Losse orders — de catalogus

Ordersets dekken het voorspelbare deel van het werk. Het grootste deel van een
huisartsendag is niet voorspelbaar: iemand heeft rugpijn en heeft paracetamol nodig,
iemand anders moet naar de chirurg voor een liesbreuk. Daar bestaat geen pakket voor,
en er hoort er ook geen te komen.

Daarom staat naast de sets een **catalogus** met één zoekveld over vier soorten:

| Soort | Wat erin zit | Hoe het de praktijk verlaat |
|---|---|---|
| medicatie | ~30 veelgebruikte middelen met ATC, vorm en gangbare doseringen | recept naar de apotheek |
| lab | 20 bepalingen met materiaal | aanvraag naar het laboratorium |
| onderzoek | ECG, spirometrie, 24-uursmeting, enkel-armindex, beeldvorming | praktijk of diagnostisch centrum |
| verwijzing | 22 bestemmingen in eerste en tweede lijn, met vraagstellingen | ZorgDomein of directe verwijsbrief |
| afspraak | 8 afspraaksoorten binnen de eigen praktijk, inclusief video en visite | agenda, via een van vier planroutes (docs/18) |
| afspraak (groep) | 5 groepsconsulten per thema | een plek op een bestaand groepsblok (docs/20) |

Eén zoekveld voor alle vier, want de zorgverlener denkt in "wat moet er gebeuren" en
niet in "welke van de vier ordersoorten is dit". Die indeling is een systeemindeling en
hoort niet in het zoekpad te staan.

De dosering of de vraagstelling staat al ingevuld en is aan te passen vóórdat je de
order toevoegt, niet erna in een bewerkscherm. Wat het vaakst gekozen wordt staat als
knop klaar; typen is de uitzondering. Bij een verwijzing staat de route erbij — wat via
ZorgDomein gaat krijgt een gestructureerd formulier met een verplichte vraagstelling en
een terugkoppeling, de rest is een brief. Dat verschil hoort zichtbaar te zijn op het
moment van verwijzen, niet pas als de brief terugkomt.

Een afspraak-order krijgt er één veld bij: **wie plant hem in**. Vier routes — zelf, de
assistent, de patiënt via het portaal, of automatisch — en die keuze hoort bij deze
afspraak en niet bij de gebruiker. Zie [ADR-0011](adr/ADR-0011-vier-planroutes.md).

**Een groepsconsult is óók een afspraak-order, maar dan zonder planroute.** Er valt niets
in te plannen: er staat al een blok, en deze mens wordt daarop gezet. De order zoekt het
eerstvolgende groepsconsult met dat thema waar nog plek is en voegt de patiënt toe als
*uitgenodigd*. Is er geen blok gepland, dan blijft de order wachten tot er één is — hij
wordt níet stilletjes een individueel consult, want dat verandert het besluit. Zie
[`docs/20` §5](20-dossierdiepte-en-rapportage.md).

Gekozen orders gaan in een **mandje** en worden in één handeling geplaatst. Een consult
levert zelden één order op: je bestelt de pijnstiller én de controle én de verwijzing,
en je wilt in één overzicht zien wat er uitgaat en wat er langs de huisarts moet.

> ⚠️ De catalogus is demomateriaal. Doseringen zijn gangbaar maar niet tegen de
> G-Standaard gecontroleerd, en de lijst is bewust klein. Een echt formularium komt uit
> de G-Standaard en de NHG-Tabellen, onder licentie.

## 3. De contra-indicatiecheck

`controleer(regel, dossier)` geeft `Waarschuwing[]` terug, elk met een niveau:

- **blokkerend** — de regel wordt uit de set gehaald. De gebruiker ziet dat er iets
  weggehaald is, wat het was en op grond waarvan.
- **let-op** — de regel blijft staan met de waarschuwing eronder. De gebruiker
  beslist.

De check draait op het meest recente dossier op het moment van samenstellen, niet op
een gecachete waarde. Een eGFR van vorige week telt; een eGFR van vorig jaar krijgt
een eigen waarschuwing over de ouderdom van de bepaling.

## 4. Rechten en autorisatie

`plaatsOrder(set, gebruiker, dossier)` splitst:

```
{
  regels:        OrderRegel[]   — deze gebruiker mag dit zelf uitvoeren
  terAutorisatie: OrderRegel[]  — gaat als voorstel naar een bevoegde collega
  geblokkeerd:   { regel, waarschuwing }[]
}
```

Wat welke rol mag staat in `packages/praktijk/src/gebruikers.ts`. De relevante
splitsing: de POH-S heeft `medicatie-voorstellen`, de huisarts heeft
`medicatie-voorschrijven`. De POH ziet de hele set, plaatst hem in één handeling, en
ziet direct welk deel naar de huisarts gaat.

Het voorstel neemt de onderbouwing mee. In de autorisatiestroom van de huisarts staat
dus niet "metformine 500 mg 2dd" maar het middel, de reden, de bron en de uitgevoerde
contra-indicatiecheck. Dat is het verschil tussen 84 recepten afvinken en 84 besluiten
nemen — zie `docs/05-werkplekken.md` §3.

## 5. Wat hier nog niet zit

- Geen echte koppeling met apotheek (NHG-Tabel 25 / G-Standaard) of lab (LOINC-order).
  De codes staan er, de transportlaag niet.
- Geen medicatiebewaking op interacties. De check kijkt nu naar nierfunctie, leeftijd,
  polyfarmacie en dubbelmedicatie — niet naar middel-middelinteracties en niet naar
  overgevoeligheden, want die staan nog niet in het dossiermodel. Dat vraagt een
  G-Standaard-licentie en hoort in dezelfde MDR-beoordeling als de rest.
- Geen herhaalservice-logica. De 84 herhaalrecepten in de werkvoorraad zijn gegenereerd,
  niet geordend via dit pad.
