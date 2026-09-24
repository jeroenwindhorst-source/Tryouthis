import type { Appointment, Deelcontact, Dossier, Observation, Rol, Task } from '@zpe/fhir-model';
import { leeftijd } from '@zpe/fhir-model';
import {
  beoordeelInstroom, beoordeelZelfredzaamheid, bouwZorgplan, CODE, leegPersoonlijkPlan,
  type PersoonlijkPlan,
} from '@zpe/care-engine';
import {
  genereerAanloop, genereerPraktijk, genereerSpreekuur, genereerZelfredzaamheid, type Praktijk,
} from './populatie.js';
import { genereerVoorafLab } from './laboratorium.js';
import {
  genereerAfnames, type Afnameopdracht, type Vragenlijstafname,
} from './vragenlijstafnames.js';
import { appsVoor } from './configuratie-demo.js';
import { bouwHistorie, genereerThuismetingen } from './historie.js';
import { genereerGesprekken, genereerPatientgesprekken, type Gesprek } from './berichten.js';
import { genereerExterneDocumenten, type ExternDocument } from './externe-bronnen.js';
import { genereerOrderhistorie, maakOrder, type NieuweOrder, type Order, type Orderstatus } from './orderopslag.js';
import { genereerBespreekpunten, type Bespreekpunt, type NieuwBespreekpunt } from './bespreeklijst.js';
import { genereerBeleidsafspraken, type Beleidsafspraak } from './beleidsafspraken.js';
import { genereerAcuteSignalen, type AcuutSignaal } from './acuut.js';
import { filterMedia, genereerMedia, type Mediabestand, type Mediafilter } from './media.js';
import { vindApotheek, type Medicatiewijziging } from './medicatie.js';
import {
  genereerGroepsconsulten, type Groepsconsult, type Groepsdeelnemer, type NieuwGroepsconsult,
} from './groepsconsult.js';
import type { Contactvorm } from './contactsoorten.js';
import { vindVerrichting, type Verrichtinguitslag } from './verrichtingen.js';
import {
  genereerVerzoeken, maakVerzoek, vrijeSlots,
  type Afspraakverzoek, type NieuwAfspraakverzoek, type Slot,
} from './planning.js';
import {
  genereerAgenda, genereerAutorisaties, genereerIntakes, genereerTriage, zetDagstatus,
  type AgendaItem, type Afspraakstatus, type Autorisatieverzoek, type Triageverzoek,
  type WachtkamerIntake,
} from './werkvoorraad.js';

/**
 * Opslaginterface. De in-memory implementatie hieronder en de Postgres-implementatie
 * (docs/01 §2) delen deze interface, zodat de domeinlogica los van de opslag getest
 * kan worden en de vertical slice draait zonder infrastructuur.
 */
export interface DossierRepository {
  peildatum(): Date;
  alleDossiers(): Dossier[];
  dossier(patientId: string): Dossier | undefined;
  spreekuur(datum: string): Appointment[];
  /** De al geplande controles van de komende weken — het werk vóór het werk. */
  aanloop(): Appointment[];
  taken(): Task[];
  voegTaakToe(taak: Task): void;
  /** Het persoonlijke plan: modules, intervallen, doelen en voorkeuren van deze mens. */
  persoonlijkPlan(patientId: string): PersoonlijkPlan;
  bewaarPersoonlijkPlan(plan: PersoonlijkPlan): void;
  /** Aandachtsgebieden die al eerder in beeld zijn geweest. */
  bekendeModules(patientId: string): string[];
  markeerModuleBekend(patientId: string, moduleId: string): void;
  /** Suggesties die de zorgverlener heeft afgehandeld — komen niet terug. */
  afgehandeldeSuggesties(patientId: string): string[];
  handelSuggestieAf(patientId: string, regelId: string, besluit: string, reden?: string): void;
  /** Registratie vanuit het consult: metingen en het SOEP-deelcontact. */
  registreer(patientId: string, observaties: Observation[], deelcontact?: Deelcontact): void;

  /** De agenda van één rol, of van de hele praktijk. */
  agenda(rol?: Rol): AgendaItem[];
  /** Triage-instroom van vandaag: telefonisch én digitaal, in één stroom. */
  triage(): Triageverzoek[];
  handelTriageAf(id: string): void;
  /** Autorisatieverzoeken die op de huisarts wachten. */
  autorisaties(): Autorisatieverzoek[];
  accordeer(ids: string[]): void;
  wijsAutorisatieAf(id: string, reden: string): void;
  /** Wat ingebedde partnerapps in de wachtkamer hebben opgeleverd. */
  intakes(): WachtkamerIntake[];
  bevestigIntake(id: string): void;

  /** Uitgezette en ingevulde vragenlijsten; zonder patientId die van de hele praktijk. */
  afnames(patientId?: string): Vragenlijstafname[];
  neemAfnameOver(id: string, door: string): void;
  /** Nieuwe episode openen vanuit het consult. */
  maakEpisode(patientId: string, code: { icpc: string; snomed?: string; display: string }, door: string): string | undefined;
  /** Interne communicatie tussen teamleden. */
  alleGesprekken(): Gesprek[];
  stuurBericht(gesprekId: string, vanId: string, tekst: string): void;
  markeerGelezen(gesprekId: string, gebruikerId: string): void;

  /** Wat er van buiten de praktijk binnenkwam: BgZ, e-Overdracht, retourberichten. */
  externeDocumenten(patientId: string): ExternDocument[];
  markeerExternGelezen(patientId: string, documentId: string): void;

  /** Geplaatste orders: medicatie, lab, verwijzingen, onderzoek. */
  orders(patientId: string): Order[];
  plaatsOrders(nieuw: NieuweOrder[], door: { id: string; naam: string; rol: Rol; rechten: string[] }): Order[];
  zetOrderstatus(orderId: string, status: Orderstatus, door: string, reden?: string): void;

  /** De gedeelde lijst voor het teamoverleg. */
  bespreekpunten(): Bespreekpunt[];
  zetOpBespreeklijst(punt: NieuwBespreekpunt, door: { id: string; naam: string; rol: Rol }): Bespreekpunt;
  handelBespreekpuntAf(id: string, uitkomst: string, door: string): void;

  /** Afspraakstatus op de dag zelf: aangemeld, wachtkamer, in consult, afgerond. */
  zetAfspraakstatus(afspraakId: string, status: Afspraakstatus): void;

  /** Acute instroom die iemand moet oppakken, en wie dat doet. */
  acuteSignalen(): AcuutSignaal[];
  pakAcuutOp(id: string, door: { id: string; naam: string; rol: Rol }): void;
  handelAcuutAf(id: string, uitkomst: string): void;
  /** Hoe lang deze sessie loopt; bepaalt welke signalen al binnen zijn. */
  sessieSeconden(): number;

  /** Uitkomst van een verrichting vastleggen, inclusief teleconsultatie. */
  legVerrichtingVast(uitslag: Verrichtinguitslag): void;
  verrichtinguitslagen(patientId: string): Verrichtinguitslag[];

  /**
   * Een medicatiewijziging als één handeling: stoppen, starten, intrekken, voorschrijven.
   * Geeft de order terug die eruit voortkwam, of undefined bij een enkel stoppen.
   */
  wijzigMedicatie(
    wijziging: Medicatiewijziging, door: { id: string; naam: string; rol: Rol; rechten: string[] },
  ): Order | undefined;

  /** Documenten, foto's en stroken, gekoppeld aan hun aanleiding. */
  media(patientId: string, filter?: Mediafilter): Mediabestand[];
  markeerMediaGelezen(patientId: string, mediaId: string): void;

  /** Groepsconsulten: één blok, meerdere patiënten. */
  groepsconsulten(): Groepsconsult[];
  maakGroepsconsult(nieuw: NieuwGroepsconsult, door: { id: string; naam: string; rol: Rol }): Groepsconsult;
  voegDeelnemerToe(groepId: string, deelnemer: Omit<Groepsdeelnemer, 'toegevoegdOp'>): void;
  verwijderDeelnemer(groepId: string, patientId: string): void;
  zetDeelnemerstatus(groepId: string, patientId: string, status: Groepsdeelnemer['status']): void;

  /** Behandelgrenzen en wilsafspraken; zichtbaar vóór je handelt, niet erna. */
  beleidsafspraken(patientId: string): Beleidsafspraak[];

  /** Wat er uit het teamoverleg kwam, per patiënt — geen SOEP, wel dossier. */
  overlegnotities(patientId: string): Overlegnotitie[];

  /** Vrije plekken in de agenda van een rol. */
  vrijeSlots(rol: Rol, duurMinuten?: number): Slot[];
  /** Afspraakverzoeken: wat nog ingepland moet worden en langs welke route. */
  afspraakverzoeken(): Afspraakverzoek[];
  maakAfspraakverzoek(
    verzoek: NieuwAfspraakverzoek, door: { id: string; naam: string; rol: Rol },
  ): Afspraakverzoek;
  planAfspraak(verzoekId: string, start: string): AgendaItem | undefined;
  planLosseAfspraak(gegevens: {
    patientId: string; rol: Rol; start: string; duurMinuten: number; reden: string; titel?: string;
  }): AgendaItem | undefined;
  annuleerVerzoek(verzoekId: string, reden: string): void;

  /** Alles terug naar de beginstand — voor een volgende demo. */
  herstelBeginstand(): void;
}

/**
 * Wat er in het overleg besproken is, als dossieritem.
 *
 * Bewust geen deelcontact met SOEP-regels: er is geen patiënt gezien, geen anamnese
 * afgenomen en geen onderzoek gedaan. Er is óver iemand gesproken en daar kwam een
 * besluit uit. Dat in SOEP persen maakt het tot een consult dat niet heeft
 * plaatsgevonden — maar het weglaten maakt het besluit onvindbaar.
 */
export interface Overlegnotitie {
  id: string;
  patientId: string;
  op: string;
  vraag: string;
  context?: string;
  uitkomst: string;
  ingebrachtDoor: string;
  besprokenDoor: string;
  deelnemers: string[];
}

export class InMemoryRepository implements DossierRepository {
  private praktijk!: Praktijk;
  private afspraken!: Appointment[];
  private aanloopAfspraken!: Appointment[];
  private afnameLijst: Vragenlijstafname[] = [];
  private taakLijst: Task[] = [];
  private plannen = new Map<string, PersoonlijkPlan>();
  private agendaItems!: AgendaItem[];
  private triageLijst!: Triageverzoek[];
  private autorisatieLijst!: Autorisatieverzoek[];
  private intakeLijst!: WachtkamerIntake[];
  private gesprekken!: Gesprek[];
  private externLijst = new Map<string, ExternDocument[]>();
  private orderLijst = new Map<string, Order[]>();
  private bespreeklijst: Bespreekpunt[] = [];
  private beleidLijst = new Map<string, Beleidsafspraak[]>();
  private notities = new Map<string, Overlegnotitie[]>();
  private verzoeken: Afspraakverzoek[] = [];
  private acuut: AcuutSignaal[] = [];
  private uitslagen = new Map<string, Verrichtinguitslag[]>();
  private gestartOp = Date.now();
  private mediaLijst = new Map<string, Mediabestand[]>();
  private groepen: Groepsconsult[] = [];
  private bekend = new Map<string, Set<string>>();
  private afgehandeld = new Map<string, Map<string, { besluit: string; reden?: string }>>();

  constructor(private readonly maakPraktijk: () => Praktijk = genereerPraktijk) {
    this.bouwOp();
  }

  /**
   * De hele beginstand in één functie.
   *
   * Dat is niet alleen netjes: het is wat `herstelBeginstand()` mogelijk maakt. Een
   * demo die je maar één keer kunt draaien omdat je de gegevens hebt aangepast, is na
   * het eerste gesprek onbruikbaar. De generatoren werken met vaste zaden, dus opnieuw
   * opbouwen levert exact dezelfde praktijk op.
   */
  private bouwOp(): void {
    this.praktijk = this.maakPraktijk();
    this.taakLijst = [];
    this.plannen = new Map();
    this.bekend = new Map();
    this.afgehandeld = new Map();
    this.externLijst = new Map();
    this.orderLijst = new Map();
    this.beleidLijst = new Map();
    this.notities = new Map();
    this.verzoeken = [];
    this.acuut = [];
    this.uitslagen = new Map();
    this.gestartOp = Date.now();
    this.mediaLijst = new Map();
    this.groepen = [];
    this.afnameLijst = [];

    // Drie jaar dossierhistorie: contacten met SOEP en de bijbehorende meetreeksen.
    // Zonder historie is er niets om in terug te kijken, en dan lijkt elk dossier nieuw.
    this.praktijk.dossiers.forEach((dossier, i) => {
      const extra = bouwHistorie(dossier, this.praktijk.peildatum, 3000 + i);
      dossier.contacten.push(...extra.contacten);
      dossier.deelcontacten.push(...extra.deelcontacten);
      dossier.observaties.push(...extra.observaties);

      // Wat er van buiten binnenkwam, en wat er in het verleden besteld is.
      this.externLijst.set(dossier.patient.id,
        genereerExterneDocumenten(dossier, this.praktijk.peildatum, 5000 + i));
      this.orderLijst.set(dossier.patient.id,
        genereerOrderhistorie(dossier, this.praktijk.peildatum, 7000 + i));
      const beleid = genereerBeleidsafspraken(dossier, this.praktijk.peildatum, 11000 + i);
      if (beleid.length > 0) this.beleidLijst.set(dossier.patient.id, beleid);

      this.mediaLijst.set(dossier.patient.id, genereerMedia(
        dossier, this.externLijst.get(dossier.patient.id) ?? [], this.praktijk.peildatum, 13000 + i,
      ));
    });

    this.gesprekken = [
      ...genereerGesprekken(this.praktijk),
      ...genereerPatientgesprekken(this.praktijk),
    ];
    this.afspraken = genereerSpreekuur(this.praktijk);


    this.agendaItems = zetDagstatus([
      ...genereerAgenda(this.praktijk),
      ...this.afspraken.map((a): AgendaItem => ({
        id: a.id, start: a.start, duurMinuten: a.eindeMinuten, rol: 'poh-s',
        patientId: a.patientId, naam: this.naamVan(a.patientId),
        soort: a.soort, titel: 'Chronische controle', reden: a.reden, status: 'gepland',
      })),
    ].sort((a, b) => a.start.localeCompare(b.start)), this.praktijk.peildatum);
    // De kandidaten dragen hun dossierkenmerken mee, zodat een acuut signaal terechtkomt
    // bij iemand bij wie de onderbouwing ook werkelijk in het dossier staat.
    this.acuut = genereerAcuteSignalen(
      this.praktijk.dossiers.slice(0, 45).map((d) => ({
        patientId: d.patient.id,
        naam: this.naamVan(d.patient.id),
        leeftijd: leeftijd(d, this.praktijk.peildatum),
        icpc: d.episodes
          .filter((e) => e.status === 'active')
          .flatMap((e) => (e.code.coding ?? []).map((c) => c.code)),
        atc: d.medicatie
          .filter((m) => m.status === 'active')
          .flatMap((m) => (m.middel.coding ?? []).map((c) => c.code)),
        aantalContacten: d.contacten.length,
      })),
      this.praktijk.peildatum,
    );

    // Wie vanochtend al een acuut signaal draagt, komt niet óók nog in de gewone
    // triagestroom: dat zijn twee verschillende deuren, en dezelfde man die tweemaal op
    // één ochtend contact zoekt leidt af van waar het over gaat.
    this.triageLijst = genereerTriage(
      this.praktijk, undefined, new Set(this.acuut.map((a) => a.patientId)),
    );
    this.autorisatieLijst = genereerAutorisaties(this.praktijk);

    const wachtkamerApp = appsVoor('wachtkamer')[0];
    this.intakeLijst = wachtkamerApp
      ? genereerIntakes(this.praktijk, this.agendaItems.filter((a) => a.rol === 'poh-s'), {
          id: wachtkamerApp.id, naam: wachtkamerApp.naam, leverancier: wachtkamerApp.leverancier,
        })
      : [];

    // Startsituatie: bij twee derde van de patiënten zijn de relevante aandachtsgebieden
    // al eens gezien; bij de rest niet. Dat laatste is de achterstand die de praktijk
    // nu met een datadump en een Excel probeert op te sporen.
    this.praktijk.dossiers.forEach((dossier, i) => {
      if (i % 3 === 0) return;
      const resultaat = beoordeelInstroom(dossier, [], undefined, this.praktijk.peildatum);
      const set = new Set(resultaat.nieuw.map((m) => m.moduleId));
      if (set.size > 0) this.bekend.set(dossier.patient.id, set);
    });

    // Zelfredzaamheid is bij deze praktijk de leidende factor voor contactfrequentie,
    // dus hij hoort bij vrijwel iedereen in beeld te zijn — niet bij een enkeling.
    this.praktijk.dossiers.forEach((dossier, i) => {
      const bekend = this.bekend.get(dossier.patient.id);
      if (!bekend || bekend.size === 0) return;
      this.plannen.set(dossier.patient.id, {
        ...leegPersoonlijkPlan(dossier.patient.id),
        zelfredzaamheid: genereerZelfredzaamheid(dossier, this.praktijk.peildatum, 9000 + i),
      });
    });

    // Een paar patiënten hebben daarnaast expliciete afspraken over contactfrequentie.
    const metPlan = this.praktijk.dossiers.filter((_, i) => i % 11 === 4);
    for (const dossier of metPlan) {
      this.plannen.set(dossier.patient.id, {
        ...this.persoonlijkPlan(dossier.patient.id),
        voorkeuren: { maxContactenPerJaar: 2 },
        doelen: [{
          id: `${dossier.patient.id}-doel-1`,
          tekst: 'Ik wil zonder rollator naar de markt kunnen blijven lopen.',
          gekoppeldeModules: ['leefstijl', 'vaatrisico'],
          afgesprokenOp: this.praktijk.peildatum.toISOString().slice(0, 10),
        }],
      });
    }

    this.verzoeken = genereerVerzoeken(
      this.praktijk.dossiers.slice(0, 40).map((d) => ({
        patientId: d.patient.id, naam: this.naamVan(d.patient.id),
      })),
      this.praktijk.peildatum,
    );


    this.groepen = genereerGroepsconsulten(
      this.praktijk.dossiers.map((d) => ({
        patientId: d.patient.id,
        naam: this.naamVan(d.patient.id),
        modules: [...(this.bekend.get(d.patient.id) ?? [])],
      })),
      this.praktijk.peildatum,
    );

    // Ook hier: een overlegvraag hoort bij een dossier dat de vraag waarmaakt. In een
    // overleg wordt er juist doorgeklikt, en dan valt een lege episodelijst meteen op.
    this.bespreeklijst = genereerBespreekpunten(
      this.praktijk.dossiers.slice(0, 30).map((d) => {
        const actief = d.medicatie.filter((m) => m.status === 'active');
        const laatste = (code: string) => {
          const reeks = d.observaties
            .filter((o) => o.code.coding?.[0]?.code === code)
            .sort((a, x) => a.effectief.localeCompare(x.effectief));
          const waarde = reeks.at(-1)?.waarde;
          return waarde && 'value' in waarde ? waarde.value : undefined;
        };
        return {
          patientId: d.patient.id,
          naam: this.naamVan(d.patient.id),
          vrouw: d.patient.geslacht === 'female',
          icpc: d.episodes
            .filter((e) => e.status === 'active')
            .flatMap((e) => (e.code.coding ?? []).map((c) => c.code)),
          atc: actief.flatMap((m) => (m.middel.coding ?? []).map((c) => c.code)),
          middelen: actief.map((m) => m.middel.text ?? m.middel.coding?.[0]?.code ?? 'middel'),
          hba1c: laatste(CODE.hba1c),
          egfr: laatste(CODE.egfr),
          rrSys: laatste(CODE.rrSys),
          zelfredzaamheid: (() => {
            const z = this.plannen.get(d.patient.id)?.zelfredzaamheid;
            return z ? beoordeelZelfredzaamheid(z).gemiddelde : undefined;
          })(),
        };
      }),
      this.praktijk.peildatum,
    );

    /*
     * Wie vandaag op het spreekuur komt, heeft het bloedonderzoek al achter de rug.
     *
     * Dat is geen cosmetische ingreep in de demogegevens maar het herstellen van de
     * bedoelde volgorde: de uitnodiging gaat weken vooruit de deur uit, de patiënt gaat
     * naar het prikpunt, en de uitslag staat er als de POH het consult voorbereidt.
     * Stond die uitslag er niet, dan hoorde deze patiënt vandaag niet op het spreekuur
     * maar in de aanloop.
     */
    const geprikt = new Date(this.praktijk.peildatum);
    geprikt.setDate(geprikt.getDate() - 8);
    for (const [i, afspraak] of this.afspraken.entries()) {
      const dossier = this.dossier(afspraak.patientId);
      if (!dossier) continue;
      const plan = bouwZorgplan(dossier, this.persoonlijkPlan(afspraak.patientId), {
        peildatum: this.praktijk.peildatum,
      });
      dossier.observaties.push(...genereerVoorafLab(dossier, plan, geprikt, 21000 + i));
    }

    // De komende weken: al geplande controles waar de voorbereiding nog moet landen.
    this.aanloopAfspraken = genereerAanloop(
      this.praktijk, new Set(this.afspraken.map((a) => a.patientId)),
    );

    /*
     * Bij tweederde van de aanloop is het bloed wél geprikt. Bij de rest niet, en dat is
     * de reden dat dit blok bestaat: het verschil tussen "de herinnering is verstuurd"
     * en "er is iets gebeurd" is precies wat nu niemand ziet.
     */
    this.aanloopAfspraken.forEach((afspraak, i) => {
      if (i % 3 === 0) return;
      const dossier = this.dossier(afspraak.patientId);
      if (!dossier) return;
      const prikdag = new Date(afspraak.start.slice(0, 10));
      prikdag.setDate(prikdag.getDate() - 12);
      // Alleen wat al in het verleden ligt kan geprikt zijn; de rest wacht nog.
      if (prikdag > this.praktijk.peildatum) return;
      const plan = bouwZorgplan(dossier, this.persoonlijkPlan(afspraak.patientId), {
        peildatum: this.praktijk.peildatum,
      });
      dossier.observaties.push(...genereerVoorafLab(dossier, plan, prikdag, 23000 + i));
    });

    /*
     * De vragenlijsten. Bij het spreekuur van vandaag de consultvoorbereidende lijst,
     * vrijwel overal ingevuld — daar hoort de POH hem immers vóór het consult te lezen.
     * Bij de aanloop de jaarlijkse screening, die juist de vraag beantwoordt óf iemand
     * op de praktijk moet komen; daar is een deel nog open.
     */
    /*
     * Wie in de wachtkamer een verhaal heeft verteld, krijgt een vragenlijst die daar
     * niet tegenin gaat. Twee bronnen die allebei van de patiënt komen en elkaar
     * tegenspreken, maken het dossier ongeloofwaardig.
     */
    const ZWAARDER = [
      'draagt het alleen', 'werk loopt over', 'zorgt voor een ander',
      'net verhuisd', 'mantelzorger van zichzelf',
    ];
    const metIntake = new Set(this.intakeLijst.map((i) => i.patientId));

    const opdrachten: Afnameopdracht[] = [
      ...this.afspraken.map((a, i): Afnameopdracht => ({
        patientId: a.patientId,
        vragenlijstId: 'vl-consultvoorbereiding',
        voorAfspraakOp: a.start.slice(0, 10),
        ingevuld: i % 7 !== 5,
        kanaal: i % 5 === 3 ? 'wachtkamer' : 'portaal',
        uitgezetDagenVoor: 10,
        /*
         * Drie profielen liggen vast. Niet omdat de rest er niet toe doet, maar omdat een
         * demonstratie begint bij wie er op dat moment aan de beurt is — met de klok op
         * 10:20 is dat de afspraak van 10:40 — en daar hoort een vragenlijst te liggen
         * waarin iets staat dat een consult van richting verandert.
         */
        profiel: i === 4 ? 'draagt het alleen'
          : i === 0 ? 'zorgt voor een ander'
          : i === 1 ? 'werk loopt over'
          : undefined,
        profielUit: metIntake.has(a.patientId) ? ZWAARDER : undefined,
      })),
      ...this.aanloopAfspraken.map((a, i): Afnameopdracht => ({
        patientId: a.patientId,
        vragenlijstId: 'vl-jaarscreening',
        voorAfspraakOp: a.start.slice(0, 10),
        ingevuld: i % 3 !== 0,
        kanaal: i % 6 === 2 ? 'papier' : 'portaal',
        uitgezetDagenVoor: 21,
      })),
    ];
    this.afnameLijst = genereerAfnames(opdrachten, this.praktijk.peildatum);

    // Een deel van de praktijk meet thuis de bloeddruk. Niet iedereen: dat is precies
    // het punt van zelfmeting, het past bij de een wel en bij de ander niet.
    this.praktijk.dossiers.forEach((dossier, i) => {
      if (i % 3 === 2) return;
      dossier.observaties.push(...genereerThuismetingen(dossier, this.praktijk.peildatum, 27000 + i));
    });
  }

  herstelBeginstand(): void { this.bouwOp(); }

  beleidsafspraken(patientId: string): Beleidsafspraak[] {
    return this.beleidLijst.get(patientId) ?? [];
  }

  overlegnotities(patientId: string): Overlegnotitie[] {
    return this.notities.get(patientId) ?? [];
  }

  // ── Plannen ──────────────────────────────────────────────────────────────

  vrijeSlots(rol: Rol, duurMinuten?: number): Slot[] {
    return vrijeSlots(this.agendaItems, rol, this.praktijk.peildatum, duurMinuten);
  }

  afspraakverzoeken(): Afspraakverzoek[] { return this.verzoeken; }

  maakAfspraakverzoek(
    verzoek: NieuwAfspraakverzoek, door: { id: string; naam: string; rol: Rol },
  ): Afspraakverzoek {
    const nieuw = maakVerzoek(verzoek, door, this.verzoeken.length + 1, new Date());
    this.verzoeken.unshift(nieuw);

    // De route 'automatisch' betekent wat er staat: het systeem zoekt de eerste plek en
    // plant hem. Alleen toegestaan voor logistiek werk; dat onderscheid zit in de
    // gebruikerskant, niet hier (docs/13 §2).
    if (nieuw.route === 'automatisch') {
      const slot = this.vrijeSlots(nieuw.voorRol, nieuw.duurMinuten)[0];
      if (slot) this.planAfspraak(nieuw.id, slot.start);
    }
    return nieuw;
  }

  planAfspraak(verzoekId: string, start: string): AgendaItem | undefined {
    const verzoek = this.verzoeken.find((v) => v.id === verzoekId);
    if (!verzoek) return undefined;
    const item = this.planLosseAfspraak({
      patientId: verzoek.patientId, rol: verzoek.voorRol, start,
      duurMinuten: verzoek.duurMinuten, reden: verzoek.reden,
    });
    if (!item) return undefined;
    verzoek.status = 'ingepland';
    verzoek.ingepland = { start, duurMinuten: verzoek.duurMinuten, rol: verzoek.voorRol };
    return item;
  }

  planLosseAfspraak(gegevens: {
    patientId: string; rol: Rol; start: string; duurMinuten: number; reden: string; titel?: string;
  }): AgendaItem | undefined {
    const dossier = this.dossier(gegevens.patientId);
    if (!dossier) return undefined;
    const item: AgendaItem = {
      id: `ag-nieuw-${this.agendaItems.length + 1}-${Date.now()}`,
      start: gegevens.start,
      duurMinuten: gegevens.duurMinuten,
      rol: gegevens.rol,
      patientId: gegevens.patientId,
      naam: this.naamVan(gegevens.patientId),
      soort: 'consult',
      titel: gegevens.titel ?? 'Afspraak',
      reden: gegevens.reden,
      status: 'gepland',
    };
    this.agendaItems.push(item);
    this.agendaItems.sort((a, b) => a.start.localeCompare(b.start));
    return item;
  }

  annuleerVerzoek(verzoekId: string, reden: string): void {
    const verzoek = this.verzoeken.find((v) => v.id === verzoekId);
    if (!verzoek) return;
    verzoek.status = 'geannuleerd';
    verzoek.toelichting = reden;
  }

  private naamVan(patientId: string): string {
    const dossier = this.dossier(patientId);
    if (!dossier) return patientId;
    const n = dossier.patient.naam;
    return [n.voornaam, n.tussenvoegsel, n.achternaam].filter(Boolean).join(' ');
  }

  peildatum(): Date { return this.praktijk.peildatum; }

  agenda(rol?: Rol): AgendaItem[] {
    return rol ? this.agendaItems.filter((a) => a.rol === rol) : this.agendaItems;
  }
  triage(): Triageverzoek[] { return this.triageLijst; }
  handelTriageAf(id: string): void {
    const verzoek = this.triageLijst.find((t) => t.id === id);
    if (verzoek) verzoek.status = 'afgehandeld';
  }
  autorisaties(): Autorisatieverzoek[] { return this.autorisatieLijst; }
  accordeer(ids: string[]): void {
    const set = new Set(ids);
    for (const verzoek of this.autorisatieLijst) {
      if (set.has(verzoek.id)) verzoek.status = 'geaccordeerd';
    }
  }
  wijsAutorisatieAf(id: string, reden: string): void {
    const verzoek = this.autorisatieLijst.find((v) => v.id === id);
    if (verzoek) { verzoek.status = 'afgewezen'; verzoek.aanleiding = `${verzoek.aanleiding} — afgewezen: ${reden}`; }
  }
  maakEpisode(
    patientId: string, code: { icpc: string; snomed?: string; display: string }, door: string,
  ): string | undefined {
    const dossier = this.dossier(patientId);
    if (!dossier) return undefined;
    const nu = new Date().toISOString();
    const id = `${patientId}-ep-${dossier.episodes.length + 1}`;
    dossier.episodes.push({
      resourceType: 'EpisodeOfCare',
      id,
      patientId,
      status: 'active',
      titel: code.display,
      code: {
        coding: [
          { system: 'http://hl7.org/fhir/sid/icpc-1-nl', code: code.icpc, display: code.display },
          ...(code.snomed
            ? [{ system: 'http://snomed.info/sct', code: code.snomed, display: code.display }]
            : []),
        ],
        text: code.display,
      },
      periode: { start: nu.slice(0, 10) },
      herkomst: { bron: 'zorgverlener', vastgelegdOp: nu, auteurId: door, auteurRol: 'poh-s' },
    });
    return id;
  }

  alleGesprekken(): Gesprek[] { return this.gesprekken; }
  stuurBericht(gesprekId: string, vanId: string, tekst: string): void {
    const gesprek = this.gesprekken.find((g) => g.id === gesprekId);
    if (!gesprek) return;
    gesprek.berichten.push({
      id: `bericht-${gesprekId}-${gesprek.berichten.length + 1}`,
      vanId, tekst, op: new Date().toISOString(), gelezen: true,
    });
  }
  markeerGelezen(gesprekId: string, gebruikerId: string): void {
    const gesprek = this.gesprekken.find((g) => g.id === gesprekId);
    if (!gesprek) return;
    for (const bericht of gesprek.berichten) {
      if (bericht.vanId !== gebruikerId) bericht.gelezen = true;
    }
  }

  intakes(): WachtkamerIntake[] { return this.intakeLijst; }
  bevestigIntake(id: string): void {
    const intake = this.intakeLijst.find((i) => i.id === id);
    if (intake) intake.bevestigd = true;
  }
  alleDossiers(): Dossier[] { return this.praktijk.dossiers; }
  dossier(patientId: string): Dossier | undefined {
    return this.praktijk.dossiers.find((d) => d.patient.id === patientId);
  }
  spreekuur(datum: string): Appointment[] {
    return this.afspraken.filter((a) => a.start.startsWith(datum));
  }
  aanloop(): Appointment[] { return this.aanloopAfspraken; }

  afnames(patientId?: string): Vragenlijstafname[] {
    return patientId
      ? this.afnameLijst.filter((a) => a.patientId === patientId)
      : this.afnameLijst;
  }

  /**
   * Overnemen is een handeling met een naam eraan.
   *
   * Zolang dit niet is gebeurd, zijn de antwoorden van de patiënt; daarna staat de
   * praktijk ervoor in. Dat onderscheid vastleggen kost één veld en is het verschil
   * tussen een dossier dat je kunt verantwoorden en een dossier dat vol staat met
   * waarden waarvan niemand meer weet wie ze heeft gezien (ADR-0012).
   */
  neemAfnameOver(id: string, door: string): void {
    const afname = this.afnameLijst.find((a) => a.id === id);
    if (!afname || !afname.ingevuldOp) return;
    afname.overgenomenOp = new Date().toISOString();
    afname.overgenomenDoor = door;
  }
  taken(): Task[] { return this.taakLijst; }
  voegTaakToe(taak: Task): void { this.taakLijst.push(taak); }

  persoonlijkPlan(patientId: string): PersoonlijkPlan {
    return this.plannen.get(patientId) ?? leegPersoonlijkPlan(patientId);
  }
  bewaarPersoonlijkPlan(plan: PersoonlijkPlan): void {
    this.plannen.set(plan.patientId, plan);
  }

  bekendeModules(patientId: string): string[] { return [...(this.bekend.get(patientId) ?? [])]; }
  markeerModuleBekend(patientId: string, moduleId: string): void {
    const set = this.bekend.get(patientId) ?? new Set();
    set.add(moduleId);
    this.bekend.set(patientId, set);
  }

  registreer(patientId: string, observaties: Observation[], deelcontact?: Deelcontact): void {
    const dossier = this.dossier(patientId);
    if (!dossier) return;
    dossier.observaties.push(...observaties);
    if (deelcontact) dossier.deelcontacten.push(deelcontact);

    // De afspraak van vandaag is hiermee afgerond. Dat hoort het systeem zelf te weten:
    // wie een consult vastlegt, heeft de patiënt gezien.
    const vandaag = this.praktijk.peildatum.toISOString().slice(0, 10);
    for (const item of this.agendaItems) {
      if (item.patientId === patientId && item.start.startsWith(vandaag) && item.status !== 'noshow') {
        item.status = 'afgerond';
      }
    }

    // Orders die tijdens dit consult geplaatst zijn, horen aan het deelcontact te hangen;
    // anders staat het plan in het journaal en de uitvoering ergens anders.
    if (deelcontact) {
      for (const order of this.orderLijst.get(patientId) ?? []) {
        if (!order.deelcontactId && order.geplaatstOp.slice(0, 10) === vandaag) {
          order.deelcontactId = deelcontact.id;
        }
      }
    }
  }

  // ── Externe bronnen ──────────────────────────────────────────────────────

  externeDocumenten(patientId: string): ExternDocument[] {
    return this.externLijst.get(patientId) ?? [];
  }
  markeerExternGelezen(patientId: string, documentId: string): void {
    const document = (this.externLijst.get(patientId) ?? []).find((d) => d.id === documentId);
    if (document) document.gelezen = true;
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  orders(patientId: string): Order[] {
    return [...(this.orderLijst.get(patientId) ?? [])]
      .sort((a, b) => b.geplaatstOp.localeCompare(a.geplaatstOp));
  }

  plaatsOrders(
    nieuw: NieuweOrder[], door: { id: string; naam: string; rol: Rol; rechten: string[] },
  ): Order[] {
    const geplaatst: Order[] = [];
    for (const regel of nieuw) {
      const bestaand = this.orderLijst.get(regel.patientId) ?? [];
      const order = maakOrder(regel, door, bestaand.length + 1, new Date());
      bestaand.push(order);
      this.orderLijst.set(regel.patientId, bestaand);
      geplaatst.push(order);

      // Een afspraak-order is geen regel in een lijst maar een plek in een agenda. Hij
      // wordt daarom meteen een afspraakverzoek, met de route die de zorgverlener koos:
      // zelf inplannen, de assistent laten bellen, of de patiënt via het portaal.
      // Een groepsconsult plant geen slot maar zet deze mens op een blok dat er al is.
      // Zonder deze route zou "leefstijlgroep" een afspraak van negentig minuten in een
      // lege agenda worden — en dan is het geen groep meer.
      if (order.soort === 'afspraak' && order.groepModule) {
        const blok = this.groepen
          .filter((g) => g.module === order.groepModule && g.status === 'gepland')
          .filter((g) => g.deelnemers.length < g.maxDeelnemers)
          .sort((a, b) => a.start.localeCompare(b.start))[0];
        if (blok) {
          this.voegDeelnemerToe(blok.id, {
            patientId: order.patientId,
            naam: this.naamVan(order.patientId),
            status: 'uitgenodigd',
            onderbouwing: order.detail ?? `Aangemeld vanuit het consult door ${door.naam}`,
          });
          order.groepId = blok.id;
          order.route = `${blok.titel} · ${blok.start.slice(0, 10)} ${blok.start.slice(11, 16)}`;
          order.status = 'geplaatst';
        } else {
          // Geen blok? Dan is de order niet mislukt maar wacht hij op een blok. Stilletjes
          // omzetten naar een individueel consult zou het besluit veranderen.
          order.route = 'wacht op een volgend groepsblok met dit thema';
          order.status = 'geplaatst';
        }
      } else if (order.soort === 'afspraak' && order.bijRol) {
        const verzoek = this.maakAfspraakverzoek({
          patientId: order.patientId,
          naam: this.naamVan(order.patientId),
          voorRol: order.bijRol as Rol,
          reden: order.detail ?? order.omschrijving,
          duurMinuten: order.duurMinuten,
          route: (order.planroute as 'zelf' | 'assistent' | 'portaal' | 'automatisch') ?? 'assistent',
        }, door);
        order.verzoekId = verzoek.id;
        order.status = verzoek.status === 'ingepland' ? 'uitgevoerd' : 'geplaatst';
      }

      // Wat langs de huisarts moet, komt in dezelfde autorisatiestroom terecht als de
      // rest — met de onderbouwing eraan vast, zodat tekenen een besluit is en geen vinkje.
      if (order.status === 'ter-autorisatie') {
        this.autorisatieLijst.unshift({
          id: `aut-${order.id}`,
          patientId: order.patientId,
          naam: this.naamVan(order.patientId),
          soort: order.soort === 'medicatie' ? 'medicatiewijziging' : 'verwijzing',
          omschrijving: `${order.omschrijving}${order.detail ? ` — ${order.detail}` : ''}`,
          aanleiding: order.uitSet
            ? `Onderdeel van orderset "${order.uitSet.naam}".`
            : 'Losse order vanuit het consult.',
          ingediendDoor: { naam: door.naam, rol: door.rol },
          ingediendOp: order.geplaatstOp,
          routine: order.waarschuwingen.length === 0 && order.soort !== 'medicatie',
          redenGeenRoutine: order.waarschuwingen[0]?.tekst
            ?? (order.soort === 'medicatie' ? 'Medicatie vraagt altijd een arts.' : undefined),
          status: 'open',
        });
      }
    }
    return geplaatst;
  }

  zetOrderstatus(orderId: string, status: Orderstatus, door: string, reden?: string): void {
    for (const lijst of this.orderLijst.values()) {
      const order = lijst.find((o) => o.id === orderId);
      if (!order) continue;
      order.status = status;
      order.afgehandeldOp = new Date().toISOString();
      order.afgehandeldDoor = door;
      if (reden) order.reden = reden;
      return;
    }
  }

  // ── Bespreeklijst ────────────────────────────────────────────────────────

  bespreekpunten(): Bespreekpunt[] { return this.bespreeklijst; }

  zetOpBespreeklijst(
    punt: NieuwBespreekpunt, door: { id: string; naam: string; rol: Rol },
  ): Bespreekpunt {
    const nieuw: Bespreekpunt = {
      ...punt,
      id: `bespreek-${this.bespreeklijst.length + 1}-${Date.now()}`,
      ingebrachtDoor: door,
      ingebrachtOp: new Date().toISOString(),
      status: 'open',
    };
    this.bespreeklijst.unshift(nieuw);
    return nieuw;
  }

  handelBespreekpuntAf(id: string, uitkomst: string, door: string): void {
    const punt = this.bespreeklijst.find((p) => p.id === id);
    if (!punt) return;
    const op = new Date().toISOString();
    punt.status = 'besproken';
    punt.uitkomst = uitkomst;
    punt.besprokenOp = op;
    punt.besprokenDoor = door;

    // Het besluit gaat het dossier in, als eigen soort naast de deelcontacten. Zonder
    // dat is het overleg een gesprek geweest waar niets van terug te vinden is.
    const eigen = this.notities.get(punt.patientId) ?? [];
    eigen.unshift({
      id: `overleg-${punt.id}`,
      patientId: punt.patientId,
      op,
      vraag: punt.vraag,
      context: punt.context,
      uitkomst,
      ingebrachtDoor: punt.ingebrachtDoor.naam,
      besprokenDoor: door,
      deelnemers: [...new Set([punt.ingebrachtDoor.naam, door])],
    });
    this.notities.set(punt.patientId, eigen);
  }

  zetAfspraakstatus(afspraakId: string, status: Afspraakstatus): void {
    const item = this.agendaItems.find((a) => a.id === afspraakId);
    if (item) item.status = status;
  }

  // ── Acute instroom ───────────────────────────────────────────────────────

  sessieSeconden(): number { return Math.floor((Date.now() - this.gestartOp) / 1000); }

  /**
   * Alleen wat al binnen is.
   *
   * De signalen hebben een aankomsttijd ten opzichte van het begin van de sessie, omdat
   * het punt van deze functie is dat er iets binnenkomt terwijl je met iets anders bezig
   * bent. Een lijst die er bij het inloggen al compleet staat, laat dat niet zien.
   */
  acuteSignalen(): AcuutSignaal[] {
    const verstreken = this.sessieSeconden();
    return this.acuut.filter((s) => s.naSeconden <= verstreken);
  }

  pakAcuutOp(id: string, door: { id: string; naam: string; rol: Rol }): void {
    const signaal = this.acuut.find((s) => s.id === id);
    // Wie al opgepakt is, blijft opgepakt: twee mensen die tegelijk klikken mogen niet
    // allebei denken dat zij het doen.
    if (!signaal || signaal.status !== 'open') return;
    signaal.status = 'opgepakt';
    signaal.opgepaktDoor = door;
    signaal.opgepaktOp = new Date().toISOString();
  }

  handelAcuutAf(id: string, uitkomst: string): void {
    const signaal = this.acuut.find((s) => s.id === id);
    if (!signaal) return;
    signaal.status = 'afgehandeld';
    signaal.uitkomst = uitkomst;
    signaal.afgehandeldOp = new Date().toISOString();
  }

  // ── Verrichtingen ────────────────────────────────────────────────────────

  legVerrichtingVast(uitslag: Verrichtinguitslag): void {
    // De patiënt volgt uit de order, niet uit een afspraak over hoe het id eruitziet.
    const order = [...this.orderLijst.values()].flat().find((o) => o.id === uitslag.orderId);
    if (!order) return;
    const patientId = order.patientId;

    const lijst = this.uitslagen.get(patientId) ?? [];
    lijst.unshift(uitslag);
    this.uitslagen.set(patientId, lijst);

    order.status = uitslag.beoordelaar === 'zelf' ? 'uitgevoerd' : 'geplaatst';

    // Meetwaarden uit de verrichting horen in het dossier: een FEV1 uit een spirometrie
    // is dezelfde waarde als een FEV1 uit het lab, en moet dus in dezelfde reeks staan.
    const soort = vindVerrichting(uitslag.soortCode);
    const dossier = this.dossier(patientId);
    if (soort && dossier) {
      const nu = uitslag.uitgevoerdOp;
      for (const veld of soort.uitkomstvelden) {
        const ruw = uitslag.waarden[veld.code];
        if (!ruw || veld.soort === 'tekst') continue;
        dossier.observaties.push({
          resourceType: 'Observation',
          id: `${patientId}-verr-${uitslag.orderId}-${veld.code}`,
          patientId,
          code: { coding: [{ system: 'http://loinc.org', code: veld.code }] },
          effectief: nu,
          waarde: veld.soort === 'getal'
            ? { value: Number(ruw.replace(',', '.')), unit: veld.eenheid ?? '' }
            : { code: { system: 'http://snomed.info/sct', code: ruw,
                display: veld.opties?.find((o) => o.code === ruw)?.label } },
          status: 'final',
          herkomst: {
            bron: 'zorgverlener', vastgelegdOp: nu,
            auteurId: uitslag.uitgevoerdDoor.id, auteurRol: uitslag.uitgevoerdDoor.rol,
          },
        });
      }
    }

    // Een uitkomst die een arts moet zien, gaat naar de autorisatiestroom — niet naar
    // een la waar hij wacht tot iemand eraan denkt.
    if (uitslag.beoordelaar !== 'zelf') {
      this.autorisatieLijst.unshift({
        id: `aut-verr-${uitslag.orderId}`,
        patientId,
        naam: this.naamVan(patientId),
        soort: 'poh-registratie',
        omschrijving: `${soort?.naam ?? 'Verrichting'} — uitslag ter beoordeling`,
        aanleiding: uitslag.beoordelaar === 'teleconsultatie'
          ? `Verstuurd naar ${uitslag.teleconsult?.specialisme} met de vraag: `
            + `${uitslag.teleconsult?.vraagstelling}`
          : `Uitgevoerd door ${uitslag.uitgevoerdDoor.naam}; vraagt beoordeling door de huisarts.`,
        ingediendDoor: { naam: uitslag.uitgevoerdDoor.naam, rol: uitslag.uitgevoerdDoor.rol },
        ingediendOp: uitslag.uitgevoerdOp,
        routine: false,
        redenGeenRoutine: 'Uitslag van een verrichting vraagt altijd een oordeel.',
        status: 'open',
      });
    }
  }

  /**
   * Een middel wijzigen in één handeling.
   *
   * De volgorde is die van het besluit en niet die van het datamodel: eerst stopt wat er
   * liep, dan wordt de order die daarbij hoorde ingetrokken, dan start het nieuwe middel,
   * dan gaat het recept de deur uit. Wie dit over vier schermen verdeelt, krijgt dossiers
   * met twee keer hetzelfde middel erin — en dat ziet de apotheek wel en de patiënt niet.
   */
  wijzigMedicatie(
    wijziging: Medicatiewijziging, door: { id: string; naam: string; rol: Rol; rechten: string[] },
  ): Order | undefined {
    const dossier = this.dossier(wijziging.patientId);
    if (!dossier) return undefined;
    const nu = this.praktijk.peildatum.toISOString();
    const vandaag = nu.slice(0, 10);

    const huidig = wijziging.statementId
      ? dossier.medicatie.find((m) => m.id === wijziging.statementId)
      : undefined;

    // 1. Wat er liep, stopt — met de reden erbij, want een gestopt middel zonder reden
    //    is over een jaar een raadsel dat niemand meer durft terug te draaien.
    if (huidig && wijziging.soort !== 'starten') {
      huidig.status = 'stopped';
      huidig.einde = vandaag;
      huidig.herkomst = {
        bron: 'zorgverlener', vastgelegdOp: nu, auteurId: door.id, auteurRol: door.rol,
      };
    }

    // 2. De openstaande order voor dat middel wordt ingetrokken. Blijft hij staan, dan
    //    levert de apotheek straks allebei.
    const atcOud = huidig?.middel.coding?.[0]?.code;
    if (atcOud) {
      for (const order of this.orderLijst.get(wijziging.patientId) ?? []) {
        const loopt = order.status === 'geplaatst' || order.status === 'ter-autorisatie';
        if (order.soort === 'medicatie' && order.atc === atcOud && loopt) {
          order.status = 'ingetrokken';
          order.afgehandeldOp = nu;
          order.afgehandeldDoor = door.naam;
          order.reden = wijziging.soort === 'stoppen'
            ? `Middel gestopt: ${wijziging.reden}`
            : `Vervangen door een nieuw recept: ${wijziging.reden}`;
        }
      }
    }

    // 3. Het nieuwe middel start.
    if (wijziging.soort !== 'stoppen' && wijziging.nieuw) {
      dossier.medicatie.push({
        resourceType: 'MedicationStatement',
        id: `${wijziging.patientId}-med-${dossier.medicatie.length + 1}-${Date.now()}`,
        patientId: wijziging.patientId,
        episodeId: wijziging.episodeId,
        middel: {
          coding: [{ system: 'http://www.whocc.no/atc', code: wijziging.nieuw.atc }],
          text: wijziging.nieuw.naam,
        },
        dosering: wijziging.nieuw.dosering,
        chronisch: wijziging.nieuw.chronisch ?? huidig?.chronisch ?? true,
        status: 'active',
        begin: vandaag,
        herkomst: {
          bron: 'zorgverlener', vastgelegdOp: nu, auteurId: door.id, auteurRol: door.rol,
        },
      });
    }

    // 4. En dan pas het recept. Bij stoppen is er niets te versturen; dat is geen
    //    ontbrekende order maar het hele punt van de handeling.
    if (wijziging.soort === 'stoppen' || !wijziging.nieuw) return undefined;

    const apotheek = wijziging.aflevering.apotheekId
      ? vindApotheek(wijziging.aflevering.apotheekId) : undefined;
    const route = wijziging.aflevering.route === 'digitaal'
      ? `elektronisch recept naar ${apotheek?.naam ?? 'de apotheek'}`
      : wijziging.aflevering.route === 'print'
        ? 'recept geprint aan de balie'
        : 'recept meegegeven aan de patiënt';

    const [order] = this.plaatsOrders([{
      patientId: wijziging.patientId,
      soort: 'medicatie',
      omschrijving: wijziging.nieuw.naam,
      detail: wijziging.nieuw.dosering,
      atc: wijziging.nieuw.atc,
      route,
      bestemming: wijziging.aflevering.route === 'digitaal' ? apotheek?.naam : undefined,
      vereistRecht: 'medicatie-voorschrijven',
    }], door);

    if (order && wijziging.aflevering.opmerking) {
      order.reden = wijziging.aflevering.opmerking;
    }
    return order;
  }

  verrichtinguitslagen(patientId: string): Verrichtinguitslag[] {
    return this.uitslagen.get(patientId) ?? [];
  }

  // ── Media ────────────────────────────────────────────────────────────────

  media(patientId: string, filter?: Mediafilter): Mediabestand[] {
    const eigen = this.mediaLijst.get(patientId) ?? [];
    return filter ? filterMedia(eigen, filter) : eigen;
  }

  markeerMediaGelezen(patientId: string, mediaId: string): void {
    const bestand = (this.mediaLijst.get(patientId) ?? []).find((m) => m.id === mediaId);
    if (bestand) bestand.gelezen = true;
  }

  // ── Groepsconsulten ──────────────────────────────────────────────────────

  groepsconsulten(): Groepsconsult[] { return this.groepen; }

  maakGroepsconsult(
    nieuw: NieuwGroepsconsult, door: { id: string; naam: string; rol: Rol },
  ): Groepsconsult {
    const consult: Groepsconsult = {
      ...nieuw,
      id: `groep-${this.groepen.length + 1}-${Date.now()}`,
      begeleider: door,
      status: 'gepland',
      deelnemers: [],
    };
    this.groepen.unshift(consult);

    // Een groepsconsult is ook een blok in de agenda van de begeleider. Zonder dat staat
    // de tijd nergens gereserveerd en plant iemand er doodleuk een spreekuur overheen.
    this.agendaItems.push({
      id: `ag-${consult.id}`,
      start: consult.start,
      duurMinuten: consult.duurMinuten,
      rol: door.rol,
      soort: 'groepsconsult',
      titel: consult.titel,
      reden: consult.thema,
      status: 'gepland',
    });
    this.agendaItems.sort((a, b) => a.start.localeCompare(b.start));
    return consult;
  }

  voegDeelnemerToe(groepId: string, deelnemer: Omit<Groepsdeelnemer, 'toegevoegdOp'>): void {
    const groep = this.groepen.find((g) => g.id === groepId);
    if (!groep) return;
    if (groep.deelnemers.some((d) => d.patientId === deelnemer.patientId)) return;
    if (groep.deelnemers.length >= groep.maxDeelnemers) return;
    groep.deelnemers.push({ ...deelnemer, toegevoegdOp: new Date().toISOString() });
  }

  verwijderDeelnemer(groepId: string, patientId: string): void {
    const groep = this.groepen.find((g) => g.id === groepId);
    if (!groep) return;
    groep.deelnemers = groep.deelnemers.filter((d) => d.patientId !== patientId);
  }

  zetDeelnemerstatus(
    groepId: string, patientId: string, status: Groepsdeelnemer['status'],
  ): void {
    const deelnemer = this.groepen.find((g) => g.id === groepId)?.deelnemers
      .find((d) => d.patientId === patientId);
    if (deelnemer) deelnemer.status = status;
  }

  afgehandeldeSuggesties(patientId: string): string[] {
    return [...(this.afgehandeld.get(patientId)?.keys() ?? [])];
  }
  handelSuggestieAf(patientId: string, regelId: string, besluit: string, reden?: string): void {
    const kaart = this.afgehandeld.get(patientId) ?? new Map();
    kaart.set(regelId, { besluit, reden });
    this.afgehandeld.set(patientId, kaart);
  }
}
