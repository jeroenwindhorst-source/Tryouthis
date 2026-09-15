# 08 — Interoperabiliteit

## 1. Uitgangspunt

Elke uitwisseling loopt over de FHIR-facade. Er is geen "interne API" die meer kan dan
wat een externe partij kan. Dat dwingt kwaliteit af: als onze eigen werkplek het via de
standaard kan, kan een ander het ook.

## 2. Wat er de deur uit en in moet

| Stroom | Standaard/kader | Prioriteit |
| --- | --- | --- |
| Huisarts → huisarts (overdracht) | Huisartsgegevens / MedMij | hoog |
| Huisarts → HAP (waarneming) | professionele samenvatting | hoog |
| Huisarts ↔ ziekenhuis (verwijzing/retour) | eOverdracht / Twiin, BgZ | hoog |
| Huisarts ↔ apotheek | Medicatieproces 9 (MP9) | hoog |
| Lab-uitslagen | HL7v2 → FHIR `Observation`, LOINC | hoog |
| Patiënt ↔ PGO | MedMij, alle relevante informatiestandaarden | hoog |
| Ketenzorg/indicatoren | InEen/NHG-indicatoren, Vektis | midden |
| Thuismeting/telemonitoring | FHIR `Observation` + `Device`, PHD-profielen | midden |
| Landelijk opvragen | LSP, en daarna Nuts/Twiin-adressering | midden |
| Onderzoek/secundair | pseudonieme export, EHDS-conform | later |

## 3. Nederlandse profielen

We volgen **nl-core** (Nictiz) en de zibs. Concreet:
`nl-core-Patient`, `nl-core-HealthProfessional`, `nl-core-Problem`,
`nl-core-Encounter`, `nl-core-MedicationAgreement`, `nl-core-AllergyIntolerance`,
`nl-core-LaboratoryTestResult`, en de Huisartsgegevens-set voor overdracht.

Validatie is een **schrijfmoment-controle**, geen exportcontrole. Wat niet valideert,
komt er niet in — met een begrijpelijke melding, niet een profielfout in het Engels.

## 4. Adressering en vertrouwen

Uitwisseling faalt in Nederland zelden op formaat en bijna altijd op *adressering en
vertrouwen*: wie is de ontvanger, mag die dit ontvangen, en hoe weet ik dat zeker.
Daarom vanaf het begin: ZorgAB voor adressering, UZI/PKI-overheid voor identiteit,
en Nuts-compatibele vertrouwensketen waar dat kan.

## 5. De API als product

Externe partijen (AI-toepassingen, ketenpartners, onderzoek, apps van de praktijk zelf)
krijgen:

- `/fhir/*` — conforme FHIR R4 REST, met `CapabilityStatement`
- SMART on FHIR app launch, met scopes en gebruikerstoestemming
- FHIR Subscription (webhooks) voor gebeurtenissen: nieuwe uitslag, ingevulde
  vragenlijst, gewijzigd zorgplan
- Bulk Data Access (`$export`) voor populatie-analyse, pseudoniem waar mogelijk
- Een testomgeving met synthetische populatie die van dag één publiek is

Dat laatste is een strategische keuze. De reden dat innovatie in de eerste lijn
stilstaat, is dat niemand erbij kan. Een open, goed gedocumenteerde API met een echte
testomgeving is het sterkste onderscheidende kenmerk dat dit project kan hebben.
