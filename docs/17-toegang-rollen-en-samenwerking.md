# 17 — Toegang, rollen en samenwerking

## 1. Inloggen

Het systeem opent op een aanmeldscherm: gebruikersnaam, wachtwoord, daarna een
tweefactorcode. Dat is de volgorde die een zorgverlener kent en die NEN 7510 vraagt
voor toegang tot een patiëntdossier.

> **Dit is een demonstratie, geen authenticatie.** De vier accounts staan als
> platte tekst in `packages/praktijk/src/gebruikers.ts` met hetzelfde wachtwoord, en
> de tweefactorcode is een constante. Er is geen hashing, geen sessieverval, geen
> brute-force-rem, geen koppeling met UZI of DigiD. Het scherm bestaat om de
> rolwissel te tonen en om te laten zien waar de echte laag komt te zitten.
> Productie vraagt UZI-pas of een andere middelvoorziening op betrouwbaarheidsniveau
> hoog, en logging conform NEN 7513.

## 2. Vier rollen

| Rol | Ziet als eerste | Mag niet |
|---|---|---|
| **Huisarts** | autorisaties, agenda, consult | — |
| **Doktersassistent** | triage, agenda, dossiers zoeken | medicatie voorschrijven |
| **POH-S** | dagstart, monitoringcohort, instroom | medicatie voorschrijven (wel voorstellen) |
| **Administrator** | gebruikersbeheer, configuratie | **het dossier** |

De laatste regel is het punt. Een beheerder beheert accounts, rechten en instellingen
en heeft daarvoor geen enkele patiëntgegevens nodig. In veel systemen is
"systeembeheerder" feitelijk de rol met de meeste toegang; hier is het de rol met de
minste. Wie zowel wil beheren als behandelen, heeft twee rollen.

De navigatie volgt de rol: `WERKPROCES` en `PRAKTIJK` zijn per rol andere lijsten.
Dat is geen verbergen van functies maar het tonen van het eigen werkproces — zie
`docs/12-procesmodel.md`.

## 3. Rechten

Rechten zijn benoemd op handeling, niet op scherm:

```
'dossier-lezen' | 'dossier-schrijven' | 'medicatie-voorstellen'
'medicatie-voorschrijven' | 'lab-aanvragen' | 'verwijzen'
'autoriseren' | 'triage' | 'gebruikers-beheren' | 'configuratie-beheren'
```

Een scherm vraagt het recht, niet andersom. Daardoor kan hetzelfde consultscherm
door drie rollen gebruikt worden en gedraagt het zich per rol anders, in plaats van
dat er drie schermen zijn die uit elkaar lopen.

## 4. Berichten tussen collega's

Zorg in een team loopt vast op de vraag "heb je dat nog gezien?". Het berichtenscherm
is daarom geen losse chat: elk gesprek hangt aan een **patiënt** en aan een
**aanleiding** (een uitslag, een consult, een order, een signaal uit monitoring).

```
Gesprek { patientId, aanleiding: { soort, tekst }, deelnemers, berichten[] }
```

Daarmee is het bericht onderdeel van het dossier in plaats van ernaast. Wat er
klinisch toe doet hoort in het journaal; het overleg erheen hoort vindbaar te zijn
zonder het journaal te vervuilen.

## 4b. Berichten van patiënten

Twee bakjes, want het zijn twee soorten gesprek. Met een collega overleg je; een patiënt
stelt een vraag waar een antwoord op hoort — en soms is dat antwoord zorg.

Daarom staat bij elk patiëntbericht of het **dossierwaardig** is:

- *"Kan de afspraak van donderdag verzet worden?"* — administratief. Dit hoeft niet in
  het dossier.
- *"Mijn suikers zijn hoger sinds de vakantie, moet ik iets doen?"* — dit is zorg. Het
  antwoord hoort als deelcontact in het journaal en niet alleen in het berichtenbakje,
  anders weet over twee weken niemand meer wat er is afgesproken.

Dat onderscheid is het hele punt van het kanaal. Het e-consult is in een gemiddelde
praktijk het snelst groeiende contactkanaal en het slechtst vastgelegde: het komt binnen
in een aparte postbak, het antwoord gaat daar de deur uit, en in het dossier staat niets.

## 5. Configuratie per gebruiker

De vierde configuratielaag (`gebruiker`, zie `docs/14-configuratie.md`) is bewust
smal: dichtheid van de weergave, startscherm, notificaties. Een gebruiker past aan
hoe hij kijkt, niet wat er geldt. Terminologie, intervallen en ordersets zijn
praktijk- of zorggroepniveau — anders betekent hetzelfde getal twee dingen op twee
werkplekken.

Elke effectieve instelling toont bij welke laag hij vandaan komt en wat hij
overschrijft. Dat is dezelfde herkomstregel als bij beslissingsondersteuning: het
systeem laat altijd zien waarop iets berust.
