# ADR-0019 — Een knop levert werk op, of hij hoort er niet te staan

**Status:** aanvaard · **Datum:** 2026-09-24 · **Vult aan:** ADR-0009, ADR-0011, ADR-0017

## Context

In de aanloop stond bij een patiënt van wie het bloedonderzoek niet geprikt was een knop
**Bellen en herinneren**. Die knop zette een merkje in het scherm. Meer niet.

Bij het volgende bezoek aan datzelfde scherm stond dezelfde regel er weer. Niemand was
gebeld, er was niets ingepland, en bij de assistent — die dit werk in de praktijk doet —
was niets te zien. Hetzelfde gold voor *Afspraak verzetten* en voor *Bericht sturen* in
Opvolgen.

Dat is erger dan een knop die niets doet. Een knop die eruitziet alsof hij iets in gang
zet, maar alleen het scherm verandert waarin je hem indrukt, leert mensen dat het systeem
niet te vertrouwen is. Precies dat is de klacht over bestaande systemen: je ziet het
probleem, maar er komt geen werk uit voort.

Wat ontbrak was de tussenstap die in een praktijk vanzelfsprekend is: **wie doet het?**
Bellen dat de uitslag ontbreekt kan de assistent prima. Diezelfde uitslag bespreken niet.
Dat besluit verschilt per geval en per dag — dezelfde POH pakt het ene zelf op en legt het
andere neer — en het hoort dus bij de handeling, niet in een instelling.

## Besluit

**Elke actieknop opent een paneel en levert een werktaak op.** Hetzelfde paneel en
dezelfde vorm als het orderpaneel (ADR-0009), omdat het hetzelfde soort handeling is: je
kiest wát er moet gebeuren, bij wíé het terechtkomt, en je geeft mee waaróm.

Een werktaak draagt: soort, titel, aanleiding, patiënt, ontvanger, duur, uiterlijke datum,
wie hem uitzette en wanneer, en een status (*open → gepland → afgerond*). Hij verwijst
terug naar het scherm dat hem veroorzaakte, zodat die regel zijn stand kan tonen.

Daaruit volgen vier regels.

**1. De aanleiding is verplicht.** Wie de taak oppakt ziet alleen wat er in de taak staat.
Zonder aanleiding is het een opdracht zonder context — en dan belt er iemand die niet weet
waarover. De aanleiding wordt daarom voorgevuld vanuit het scherm zelf: *"LDL-cholesterol
en de vragenlijst zijn nog niet binnen; de afspraak staat over vier dagen."*

**2. Een rol en een persoon zijn allebei geldig en betekenen iets anders.** *De assistent*
kan door iedereen worden opgepakt die er die dag is; *Ilse* niet. Allebei komt voor, en
wie ze door elkaar haalt krijgt werk dat blijft liggen omdat iedereen dacht dat een ander
het deed. De mogelijke ontvangers hangen aan het soort werk en niet aan een
rechtenmatrix: een uitslag bespreken hoort bij wie hem kan duiden.

**3. De regel die de taak veroorzaakte verandert van stand.** In Aanloop wordt de status
*opgepakt* en zakt de regel naar beneden; in Opvolgen komt er *opgepakt* te staan. Zonder
dat blijft dezelfde regel schreeuwen terwijl er iemand mee bezig is, en dat is precies
waarom mensen zulke lijsten gaan negeren.

**4. De taak kost tijd en verdient dus een plek in de agenda.** Inplannen zet hem als blok
in de agenda van wie hem oppakt. De taak verhuist daarbij niet — hij krijgt er een plek
bij, zodat het spoor naar waar hij vandaan kwam intact blijft.

### Waar de werklijst staat

Geen eigen ingang in de linkerbalk. Een werklijst die je moet gaan opzoeken wordt niet
bekeken; deze staat op de **dagstart**, naast de agenda, waar je toch al kijkt — bij de
POH en bij de assistent, hetzelfde onderdeel. Inplannen doe je op het **planbord**, want
daar ligt de vrije tijd.

## Eigen werk in de agenda

Hieruit volgt een tweede correctie. Het planbord kende alleen patiënten. Maar een agenda
die alleen patiënten kent, liegt: uitslagen nalopen, terugbellen en administratie kosten
evenveel tijd als een consult en zijn onzichtbaar. Het gevolg is bekend — de dag zit vol
en er is niets gepland voor wat er ook nog moet.

Daarom staan er nu, naast de patiënten en de openstaande taken, **voorgedefinieerde
blokken**: patiënten terugbellen, voorbereiding spreekuur, uitslagen nalopen,
administratie, overleg, pauze. Kies er een en klik op een vrije plek. Een korte gesloten
lijst en geen vrij tekstveld: dat levert binnen een maand vijftien varianten op van
'patiënt bellen', en dan valt er niets meer over te zeggen — niet in een werklijst, niet
in een agenda en niet in een rapportage.

## Gevolgen

- `Werktaak` in `packages/praktijk/src/taken.ts`; opslag met `maakTaak`, `planTaak`,
  `rondTaakAf` en `planWerkblok` op de repository.
- `Aanloopregel` en `Opvolgregel` dragen `taak?`, en de aanloopstatus kent `opgepakt`.
- Een taak op rol komt bij iedereen van die rol; een taak op naam alleen bij die persoon
  (`takenVoor()`).
- `Takenpaneel.tsx` volgt de vorm van `Orderpaneel.tsx` — één patroon voor 'iets uitzetten'.
- Vijf tests, waaronder de expliciete: een uitgezette taak overleeft het opnieuw openen van
  het scherm, en een taak zonder aanleiding wordt geweigerd.

## Alternatieven

**Direct uitvoeren zonder paneel.** 'Bellen en herinneren' zou meteen een belafspraak bij
de assistent kunnen maken. Scheelt twee klikken en is fout: de keuze wie het oppakt is
juist de klinische afweging. Een systeem dat die voor je invult, maakt hem onzichtbaar.

**Een eigen scherm 'Taken' in de linkerbalk.** Overwogen en verworpen: er zijn al vier
werkblokken, en een vijfde ingang voor iets dat je twee keer per dag bekijkt maakt de
navigatie zwaarder dan het werk. De dagstart is waar je toch al kijkt.

**De taak als agenda-item, zonder eigen bestaan.** Dan is een taak pas echt als hij een
tijd heeft. Maar de meeste taken worden uitgezet zonder dat je weet wanneer ze passen, en
een taak die pas bestaat als je hem inplant, bestaat vaak nooit.
