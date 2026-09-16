# ADR-0012 — Wat de patiënt aanlevert is geen registratie van de praktijk

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0005, ADR-0010

## Context

Een patiënt komt binnen met een gewicht dat hij thuis heeft gewogen, een bloeddrukreeks
uit een app, of een waarde die hij in de wachtkamer aan een intake-assistent heeft
verteld. Die gegevens zijn echt en vaak beter dan de praktijkmeting: een thuisgemeten
bloeddruk voorspelt meer dan één meting op een spreekkamer.

Tot nu toe had de zorgverlener twee keuzes: overnemen alsof je het zelf gemeten had, of
weggooien. Allebei fout. Overnemen maakt van andermans waarde jouw registratie — en dus
een grondslag voor een ketenindicator en een declaratie. Weggooien betekent dat de
informatie die de patiënt aandroeg nergens terug te vinden is, terwijl hij er moeite
voor heeft gedaan.

## Besluit

**Een derde optie: bewaren met de patiënt als bron.**

Elke meting die in het consult wordt vastgelegd heeft een bron: `praktijk` of `patient`.
De keuze staat per meting in het registratieblok en is met één klik om te zetten.

- **`praktijk`** — jij legt de waarde vast en neemt hem voor je rekening. Herkomst is
  `zorgverlener` met jouw naam en rol.
- **`patient`** — de waarde komt in het dossier met de patiënt als auteur. Hij is overal
  zichtbaar, telt mee in het beloop en in de grafiek, en is als zodanig gemarkeerd.

**Een waarde van de patiënt vult geen ketenindicator.** De indicator zoekt de laatste
*eigen* registratie. Bestaat die niet terwijl er wél een patiëntwaarde is, dan zegt de
indicator dat letterlijk: "wel een waarde van 12 maart, maar door de patiënt aangeleverd
en nog niet overgenomen". Geen stil gat, maar een zichtbaar verschil met een
voor de hand liggende volgende stap.

Technisch loopt dit via `isEigenRegistratie(herkomst)` in `@zpe/fhir-model`, naast de
bestaande `isKlinischGeldig()`. Twee vragen die uit elkaar gehouden moeten worden:

| Vraag | Functie | Gebruikt voor |
|---|---|---|
| Is dit klinisch bruikbaar? | `isKlinischGeldig` | alles wat de zorgverlener ziet |
| Is dit ónze registratie? | `isEigenRegistratie` | indicatoren, declaratie, uitwisseling |

Een onbevestigde AI-suggestie faalt op de eerste vraag; een patiëntwaarde alleen op de
tweede. Dat verschil is precies goed: de AI-suggestie is misschien onjuist, de
patiëntwaarde is misschien juist maar niet van ons.

## Waarom dit ongemakkelijk mag zijn

Deze keuze kost de zorgverlener een handeling die hij nu niet heeft. Dat is bewust. De
handeling ís het besluit: neem ik deze waarde over, met mijn naam eronder? In een
systeem dat dat stilzwijgend voor je doet, staat op een dag een declaratie op basis van
een getal dat niemand heeft gecontroleerd.

## Gevolgen

De wachtkamer-intake krijgt twee knoppen in plaats van één: *Overnemen in het dossier*
en *Bewaren als melding van de patiënt*. Dat maakt het verschil zichtbaar op het moment
dat het genomen wordt.

In de FHIR-facade (docs/08) landt dit op `Observation.performer` en de
`Provenance.agent.type` — een patiëntwaarde krijgt de patiënt als performer. Dat is
conform de zib en niet iets wat we zelf verzinnen.

Wat hier nog niet zit: gegevens die via MedMij binnenkomen uit een app van de patiënt.
Die vallen onder dezelfde regel, maar het kanaal bestaat nog niet.
