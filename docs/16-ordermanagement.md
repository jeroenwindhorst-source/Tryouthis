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
- Geen medicatiebewaking op interacties. De check kijkt nu naar nierfunctie, leeftijd
  en polyfarmacie — niet naar middel-middelinteracties. Dat vraagt een G-Standaard-
  licentie en hoort in dezelfde MDR-beoordeling als de rest.
- Geen herhaalservice-logica. De 84 herhaalrecepten in de werkvoorraad zijn gegenereerd,
  niet geordend via dit pad.
