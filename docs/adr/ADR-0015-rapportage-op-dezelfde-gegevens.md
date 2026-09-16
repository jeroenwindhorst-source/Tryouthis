# ADR-0015 — Rapportage draait op het zorgplan, en export gaat alleen geaggregeerd

**Status:** aanvaard · **Datum:** 2026-09-16 · **Vult aan:** ADR-0003, ADR-0012

## Context

Een praktijk wil vragen kunnen stellen over de eigen populatie: *wie heeft diabetes en is
het afgelopen jaar niet gezien? Bij wie ontbreekt de funduscontrole? Welke kwetsbare
ouderen gebruiken meer dan vijf chronische middelen?* Dat is geen bijzaak — het is de
werklijst waarmee een praktijk haar eigen gaten dicht, en het is de basis van de
verantwoording naar de zorggroep en de verzekeraar.

In bestaande systemen gebeurt dat op twee plekken tegelijk: een rapportagemodule met eigen
querydefinities, en de schermen waarin het zorgproces draait. Die twee lopen uit de pas. De
POH ziet op haar scherm dat een indicator voldaan is; het kwartaalrapport zegt van niet.
Dan gaat de discussie over de definitie in plaats van over de patiënt.

## Besluit

**1. Rapportage draait over dezelfde zorgplannen als het zorgproces.** Er is geen tweede
definitie van "diabetes", "indicator voldaan" of "actief aandachtsgebied". Wat het rapport
telt, is precies wat de POH op haar scherm ziet, want het komt uit dezelfde functie.

**2. De zoekvraag is een korte lijst met vragen die werkelijk gesteld worden**, geen
querybuilder over honderd velden. De velden zijn: aandachtsgebied, ketenzorg, ontbrekende
indicator, leeftijd van/tot, zelfredzaamheid onder, aantal chronische middelen, niet gezien
sinds, en meetwaarde boven een grens. Een generieke querybuilder wordt door niemand gebruikt
en levert bij wie hem wél gebruikt onvergelijkbare cijfers op.

**3. De resultaatkolommen volgen uit de vraag.** Wie op "indicator ontbreekt" zoekt, krijgt
een kolom met wat er ontbreekt. Wie op een meetwaarde zoekt, krijgt die waarde. Een vaste
kolomset dwingt de gebruiker om zelf te reconstrueren waarom iemand in de lijst staat.

**4. Doorklikken naar het dossier hoort erbij — voor wie dossiertoegang heeft.** Een
rapport is een werklijst en niet een cijfer; de volgende handeling is meestal "deze mens
opzoeken". Wie geen zorgrol heeft (de praktijkmanager, de beheerder) ziet dezelfde aantallen
zonder de doorklikknop, want autorisatie hangt aan de rol en niet aan het scherm.

**5. Export gaat uitsluitend geaggregeerd en geanonimiseerd naar een BI-omgeving.**

- namen, BSN en geboortedatum gaan er niet in;
- leeftijd wordt een klasse (< 40, 40-54, 55-69, 70-84, 85+);
- groepen kleiner dan vijf worden samengevoegd tot één restgroep.

Die laatste regel is de belangrijkste. Bij een praktijk van tweeduizend mensen is "1
patiënt, 85+, COPD" geen statistiek maar een naam. Een export met groepen van één is
pseudonimisering die in de praktijk geen anonimisering is, en dan is de AVG-grondslag weg.

## Overwogen en verworpen

**Een exportknop naar CSV met patiëntregels.** Dat is wat iedereen vraagt en het is precies
wat er misgaat: zo'n bestand leeft daarna buiten het dossier, zonder logging, zonder
bewaartermijn en zonder dat iemand weet wie het heeft. Wie een werklijst wil, gebruikt de
lijst in het scherm — daar hangt autorisatie en logging aan (NEN 7513).

**Een nachtelijke kopie naar een datawarehouse.** Verworpen om de reden in de context: een
tweede definitieplek. Wat een BI-omgeving nodig heeft, is de uitkomst van een vraag die hier
gesteld is, niet een kopie van de brondatabase.

**Rapportage onder "Beheer".** Verworpen: rapporten zijn zorginhoudelijk werk. Ze staan
onder *Praktijk*, bij iedereen die ze mag draaien.

## Gevolgen

Rapporten rekenen over de hele populatie en dat kost tijd. In de demo met 48 patiënten is
dat niets; bij een praktijk van tweeduizend hoort er caching op de zorgplanberekening te
komen. Dat is een prestatievraagstuk en geen reden om een tweede definitie in te voeren.

De exportfunctie levert bewust minder detail dan een analist zou willen. Dat is de prijs van
een export die je zonder verwerkersovereenkomst per vraag kunt gebruiken.

Wat hier nog niet zit: opgeslagen zoekvragen die je periodiek opnieuw draait, en een
vergelijking met andere praktijken in de zorggroep.
