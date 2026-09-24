import { useEffect, useState, type CSSProperties } from 'react';
import {
  api, MODULE_NAAM,
  type ExternDocument, type GeplandContact, type GeplandItem, type Gebruiker,
  type Contactvorm, type Declaratiebeeld, type Eigenmetingdag, type JournaalRegel,
  type Meetreeks, type WachtkamerIntake,
  type NieuweOrder, type Overlegnotitie, type PatientOverzicht, type RegistratieUitkomst,
  PATIENTSOORTEN, TIJDLIJNSOORT_LABEL,
  type Treffer, type Tijdlijnsoort, type Vragenlijstinzage,
} from '../api';
import { useData } from '../gebruik';
import { Trendgrafiek } from '../grafiek';
import { Soepveld } from '../soepveld';
import { Zorgreis } from '../zorgreis';
import { Icoon, icoonVanModule } from '../iconen';
import {
  Beleidsband, ErnstMerk, Fout, IntakeKaart, Kaart, Laden, Leeg, ModuleIdChips, Signalen,
  SuggestieKaart, Vragenlijstkaart, Zelfredzaamheidsmeter,
} from '../onderdelen';
import { Orders } from './Orders';
import { Orderpaneel } from './Orderpaneel';
import { Medicatiepaneel } from './Medicatiepaneel';
import { Verrichtingen } from './Verrichtingen';
import { Overzicht } from './Overzicht';
import { Media } from './Media';
import { Bespreekknop } from './Overleg';

/**
 * Veelgebruikte planafspraken.
 *
 * Geen keuzelijst die de tekst vervangt, maar bouwstenen die de vier zinnen invullen die
 * iedereen elke dag typt. Wat overblijft is het deel dat werkelijk over deze mens gaat.
 */
const PLANZINNEN = [
  'Controle over 3 maanden',
  'Controle over 6 weken',
  'Uitleg gegeven en meegegeven via het portaal',
  'Thuis zelf meten en doorgeven',
  'Contact opnemen bij verergering',
  'Besproken met de huisarts',
];

const INTENSITEITEN = [
  { id: 'extensief', label: 'rustig', uitleg: 'stabiel, weinig risico, patiënt wil rust' },
  { id: 'basis', label: 'volgens plan', uitleg: 'het protocol als uitgangspunt' },
  { id: 'intensief', label: 'intensief', uitleg: 'ontregeld of hoog risico' },
  { id: 'eigen-regie', label: 'eigen regie', uitleg: 'patiënt monitort zelf, meldt zich bij afwijking' },
  { id: 'palliatief', label: 'palliatief', uitleg: 'streefwaarden vervallen, comfort leidend' },
];

type Tab = 'overzicht' | 'consult' | 'journaal' | 'metingen' | 'media' | 'orders' | 'verrichtingen';
type OrderSoort = 'medicatie' | 'lab' | 'onderzoek' | 'verwijzing' | 'afspraak';

/**
 * Wat deze registratie administratief oplevert, vóór het afronden.
 *
 * Niet om tot declareren aan te zetten, maar omdat het omgekeerde vaker gebeurt: werk
 * dat gedaan is en niet vergoed wordt omdat één veld leeg bleef. Wie dat aan het eind
 * van het kwartaal ontdekt, kan er niets meer aan doen.
 */
function Declaratievoorbeeld({ vorm, duurMinuten, heeftSoep, heeftEpisode }: {
  vorm: Contactvorm; duurMinuten: number; heeftSoep: boolean; heeftEpisode: boolean;
}) {
  const [beeld, setBeeld] = useState<Declaratiebeeld | undefined>();
  const [vormen, setVormen] = useState<Awaited<ReturnType<typeof api.contactvormen>>>([]);

  useEffect(() => { api.contactvormen().then(setVormen).catch(() => setVormen([])); }, []);

  useEffect(() => {
    // De beoordeling draait in de domeinlaag en niet hier: dezelfde regel moet gelden in
    // de browser, in de server en straks in de declaratie-export.
    const definitie = vormen.find((v) => v.id === vorm);
    if (!definitie) { setBeeld(undefined); return; }
    const ontbreekt: string[] = [];
    if (!heeftSoep) ontbreekt.push('geen SOEP-registratie');
    if (!heeftEpisode) ontbreekt.push('niet aan een episode gekoppeld');
    const lang = definitie.duurGrensMinuten !== undefined
      && duurMinuten >= definitie.duurGrensMinuten;
    const langVorm = vormen.find((v) => v.id === `${vorm}-lang`);
    const gekozen = lang && langVorm ? langVorm : definitie;
    setBeeld({
      vorm: gekozen.id, naam: gekozen.naam, declarabel: gekozen.declarabel && ontbreekt.length === 0,
      prestatie: gekozen.prestatie, ontbreekt,
      toelichting: gekozen.declarabel
        ? (ontbreekt.length === 0
          ? `Voldoet aan de voorwaarden voor ${gekozen.prestatie?.omschrijving.toLowerCase()}.`
          : 'Nog niet declarabel; vul aan wat hierboven ontbreekt.')
        : (gekozen.nietDeclarabelOmdat ?? ''),
    });
  }, [vorm, duurMinuten, heeftSoep, heeftEpisode, vormen]);

  if (!beeld) return null;

  return (
    <div className="declaratie" data-declarabel={beeld.declarabel}>
      <div className="kop">
        <Icoon naam="euro" grootte={14} />
        <strong>{beeld.naam}</strong>
        {beeld.prestatie && (
          <span className="merkje" data-toon={beeld.declarabel ? 'ok' : 'aandacht'}>
            {beeld.prestatie.code}
          </span>
        )}
      </div>
      <div className="mini">{beeld.toelichting}</div>
      {beeld.ontbreekt.length > 0 && (
        <ul className="uitleg">{beeld.ontbreekt.map((o) => <li key={o}>{o}</li>)}</ul>
      )}
      {beeld.prestatie && beeld.declarabel && (
        <div className="mini" style={{ marginTop: 4 }}>
          Voorwaarden: {beeld.prestatie.voorwaarden.join(' · ')}
        </div>
      )}
    </div>
  );
}

const VORMEN: { id: Contactvorm; label: string; icoon: string; uitleg: string }[] = [
  { id: 'consult', label: 'Op de praktijk', icoon: 'klembord',
    uitleg: 'Face-to-face. De duurstaffel bepaalt of het een kort of lang consult is.' },
  { id: 'telefonisch', label: 'Telefonisch', icoon: 'gesprek',
    uitleg: 'Inhoudelijk telefonisch contact — geen afspraak maken of uitslag doorgeven.' },
  { id: 'videoconsult', label: 'Videoconsult', icoon: 'video',
    uitleg: 'Beeld én geluid, met de patiënt zelf. Zelfde duurstaffel als op de praktijk.' },
  { id: 'e-consult', label: 'E-consult', icoon: 'huis',
    uitleg: 'Schriftelijke vraag via het portaal met een inhoudelijk antwoord.' },
  { id: 'visite', label: 'Visite', icoon: 'huis',
    uitleg: 'Bij de patiënt thuis.' },
  { id: 'verrichting', label: 'Verrichting', icoon: 'radar',
    uitleg: 'Een uitgevoerde handeling met een vastgelegde uitkomst.' },
];

/** Vormen waarbij de duur de prestatie bepaalt. */
const DUURVORMEN: Contactvorm[] = ['consult', 'visite', 'videoconsult'];

const PLAN_ICOON: Record<string, string> = {
  medicatie: 'pil', lab: 'buisje', verwijzing: 'uitgaand', onderzoek: 'radar',
  afspraak: 'agenda', begeleiding: 'gesprek',
};

const ROUTE_KORT: Record<string, string> = {
  zelf: 'zelf inplannen', assistent: 'assistent plant', portaal: 'patiënt plant zelf',
  automatisch: 'systeem plant',
};

/** Wat er tijdens het consult wordt ingevuld. Staat hier, zodat de wachtkamer-intake het kan vullen. */
export interface Registratie {
  waarden: Record<string, string>;
  /**
   * Per meting: leg jij hem vast, of bewaar je hem als melding van de patiënt?
   *
   * Dat is geen formaliteit. Een gewicht dat de patiënt thuis noemde is een echte waarde
   * en hoort zichtbaar te blijven — maar het is jouw registratie niet, en het vult dus
   * geen ketenindicator. Zonder deze keuze moet je kiezen tussen weggooien en doen alsof
   * je het zelf gemeten hebt.
   */
  bronnen: Record<string, 'praktijk' | 'patient'>;
  soep: Record<string, string>;
  episodeId: string;
  suggestieCodes: { icpc: string; display: string }[];
}

export function Consult({ patientId, gebruiker, terug, startTab = 'consult' }: {
  patientId: string;
  gebruiker: Gebruiker;
  terug: () => void;
  /** Waarmee het dossier opent. Persoonlijke voorkeur — zie Voorkeuren. */
  startTab?: Tab;
}) {
  const { data, fout, bezig, herlaad, setData } = useData(() => api.patient(patientId), [patientId]);
  const [tab, setTab] = useState<Tab>(startTab);
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  const [toonNietActief, setToonNietActief] = useState(false);
  const [uitkomst, setUitkomst] = useState<RegistratieUitkomst | undefined>();
  const [gekozenMeting, setGekozenMeting] = useState<string | undefined>();
  const [orderpaneel, setOrderpaneel] = useState<OrderSoort | 'alles' | undefined>();
  const [medicatiepaneel, setMedicatiepaneel] = useState<{ middelId?: string } | undefined>();
  const [medicatieGewijzigd, setMedicatieGewijzigd] = useState(false);
  const [ordersVandaag, setOrdersVandaag] = useState<NieuweOrder[]>([]);
  const [video, setVideo] = useState(false);
  const [toonDetails, setToonDetails] = useState(false);
  const [journaalBron, setJournaalBron] = useState<string | undefined>();
  const [vragenlijsten, setVragenlijsten] = useState<Vragenlijstinzage[] | undefined>();
  const [lijstUit, setLijstUit] = useState<Record<string, boolean>>({});
  const [registratie, setRegistratie] = useState<Registratie>({
    waarden: {}, bronnen: {}, soep: {}, episodeId: '', suggestieCodes: [],
  });

  // De vragenlijsten horen bij de patiënt, niet bij het patiëntoverzicht: ze worden ook
  // buiten het consult gelezen. Apart ophalen houdt het overzicht klein.
  useEffect(() => {
    let geldig = true;
    api.vragenlijsten(patientId).then((lijsten) => { if (geldig) setVragenlijsten(lijsten); });
    return () => { geldig = false; };
  }, [patientId]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Dossier" />;

  const plan = data.zorgplan;
  const klinisch = data.suggesties.filter((s) => s.klasse === 'klinisch');
  const logistiek = data.suggesties.filter((s) => s.klasse === 'logistiek');

  const werk = async (sleutel: string, actie: () => Promise<PatientOverzicht>) => {
    setBezigMet(sleutel);
    try { setData(await actie()); } finally { setBezigMet(undefined); }
  };
  const wijzigPlan = (wijziging: Parameters<typeof api.plan>[1], sleutel: string) =>
    werk(sleutel, () => api.plan(patientId, wijziging));

  /**
   * De intake overnemen vult daadwerkelijk de registratie: de anamnese komt in het
   * S-veld, de meegebrachte metingen in de meetvelden en de codesuggesties komen als
   * kiesbare E-codering klaar te staan. Zonder die doorwerking is "overnemen" een knop
   * die niets doet.
   */
  const neemIntakeOver = async (alsPatientmelding = false) => {
    const intake = data.intake;
    if (!intake) return;
    setRegistratie((r) => ({
      ...r,
      soep: { ...r.soep, S: intake.anamnese },
      waarden: {
        ...r.waarden,
        ...Object.fromEntries(intake.metingen.map((m) => [m.code, String(m.waarde)])),
      },
      bronnen: {
        ...r.bronnen,
        ...Object.fromEntries(intake.metingen.map((m) =>
          [m.code, alsPatientmelding ? 'patient' as const : 'praktijk' as const])),
      },
      suggestieCodes: intake.codesuggesties.map((c) => ({ icpc: c.icpc, display: c.display })),
    }));
    setTab('consult');
    await werk('intake', async () => {
      await api.bevestigIntake(intake.id);
      return api.patient(patientId);
    });
  };

  /**
   * De vragenlijst overnemen.
   *
   * Dezelfde beweging als bij de intake, en dat is geen toeval: in beide gevallen gaat
   * het om gegevens die van de patiënt komen en die pas iets worden als een zorgverlener
   * ze aanvaardt. De opgebouwde tekst landt onder de S — want het ís wat de patiënt
   * aangeeft — en de waarden landen als patiëntgerapporteerde metingen, niet als eigen
   * registratie (ADR-0012).
   */
  const neemVragenlijstOver = async (inzage: Vragenlijstinzage) => {
    setRegistratie((r) => ({
      ...r,
      soep: { ...r.soep, S: [r.soep.S, inzage.overname.subjectief].filter(Boolean).join('\n\n') },
      waarden: {
        ...r.waarden,
        ...Object.fromEntries(inzage.overname.metingen.map((m) => [m.code, String(m.waarde)])),
      },
      bronnen: {
        ...r.bronnen,
        ...Object.fromEntries(inzage.overname.metingen.map((m) => [m.code, 'patient' as const])),
      },
    }));
    setTab('consult');
    setBezigMet('vragenlijst');
    try {
      const { inzage: bijgewerkt } = await api.neemVragenlijstOver(inzage.afnameId, gebruiker.naam);
      if (bijgewerkt) {
        setVragenlijsten((lijsten) =>
          lijsten?.map((l) => (l.afnameId === bijgewerkt.afnameId ? bijgewerkt : l)));
      }
    } finally { setBezigMet(undefined); }
  };

  const opMetingKlik = (code: string) => { setGekozenMeting(code); setTab('metingen'); };

  const vandaag = new Date().toISOString().slice(0, 10);
  // De laatste meting is de beste benadering van "wanneer heb ik deze mens gezien" die
  // het patiëntoverzicht bevat; het volledige journaal staat één tab verderop.
  const laatsteContactDatum = data.metingen
    .map((m) => m.op)
    .filter((op): op is string => Boolean(op))
    .sort()
    .at(-1);

  return (
    <>
      <div className="patientbalk">
        <button className="knop" onClick={terug}>
          <Icoon naam="pijl-links" grootte={13} /> Terug
        </button>
        <span className="naam">{data.patient.naam}</span>
        <span className="mini">
          {data.patient.geboortedatum} · {data.patient.leeftijd} jaar · BSN {data.patient.bsn}
        </span>
        <ModuleIdChips ids={plan.modules.map((m) => m.id)} />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center' }}>
          {/*
            Videobellen hoort hier en niet in een apart scherm: het is een manier om dit
            consult te voeren, geen andere soort zorg. De knop start in de demo niets —
            wat hij laat zien is waar hij hoort te zitten in het werkproces.
          */}
          <button className="knop" onClick={() => setVideo(true)}
            title="Start een videoconsult met deze patiënt">
            <Icoon naam="video" grootte={13} /> Videobellen
          </button>
          {data.patient.portaalActief
            ? <span className="merkje" data-toon="ok">portaal actief</span>
            : (
              <button className="knop" title="Nodig de patiënt uit voor het portaal">
                <Icoon naam="huis" grootte={13} /> Uitnodigen voor het portaal
              </button>
            )}
        </span>
      </div>

      <Beleidsband afspraken={data.beleid} peiljaar={new Date().getFullYear()} />

      {video && (
        <Videovenster naam={data.patient.naam} portaal={Boolean(data.patient.portaalActief)}
          opSluit={() => setVideo(false)} />
      )}

      <div className="dossiertabs">
        <button data-actief={tab === 'overzicht'} onClick={() => setTab('overzicht')}>
          <Icoon naam="boek" grootte={14} /> Overzicht
        </button>
        <button data-actief={tab === 'consult'} onClick={() => setTab('consult')}>
          <Icoon naam="klembord" grootte={14} /> Consult
        </button>
        <button data-actief={tab === 'journaal'} onClick={() => setTab('journaal')}>
          <Icoon naam="lijst" grootte={14} /> Journaal
        </button>
        <button data-actief={tab === 'metingen'} onClick={() => setTab('metingen')}>
          <Icoon naam="buisje" grootte={14} /> Meetwaarden
        </button>
        <button data-actief={tab === 'media'} onClick={() => setTab('media')}>
          <Icoon naam="document" grootte={14} /> Media
        </button>
        <button data-actief={tab === 'orders'} onClick={() => setTab('orders')}>
          <Icoon naam="pil" grootte={14} /> Orders
        </button>
        <button data-actief={tab === 'verrichtingen'} onClick={() => setTab('verrichtingen')}>
          <Icoon naam="radar" grootte={14} /> Verrichtingen
        </button>
      </div>

      {tab === 'overzicht' && (
        <Overzicht patientId={patientId} gebruiker={gebruiker}
          opTab={(t) => setTab(t as Tab)} />
      )}
      {tab === 'journaal' && <Journaal patientId={patientId} bron={journaalBron} />}
      {tab === 'media' && (
        <Media patientId={patientId} patientNaam={data.patient.naam}
          opTijdlijn={(bronId) => { setJournaalBron(bronId); setTab('journaal'); }} />
      )}
      {tab === 'metingen' && (
        <Metingen patientId={patientId} gekozen={gekozenMeting} opKies={setGekozenMeting} />
      )}
      {tab === 'orders' && (
        <Orders patientId={patientId} gebruiker={gebruiker}
          opNieuweOrder={() => setOrderpaneel('alles')}
          opMedicatie={(middelId) => setMedicatiepaneel({ middelId })} />
      )}

      {tab === 'verrichtingen' && (
        <Verrichtingen patientId={patientId} patientNaam={data.patient.naam} gebruiker={gebruiker} />
      )}

      {medicatiepaneel && (
        <Medicatiepaneel patientId={patientId} patientNaam={data.patient.naam} gebruiker={gebruiker}
          startMiddelId={medicatiepaneel.middelId}
          opSluit={() => {
            // Pas bij het sluiten het hele dossier opnieuw ophalen: de suggesties en het
            // zorgplan rekenen met de medicatie. Tijdens het wijzigen niet, want dan
            // verdwijnt het paneel onder je handen terwijl je nog leest wat er gebeurd is.
            setMedicatiepaneel(undefined);
            if (medicatieGewijzigd) { setMedicatieGewijzigd(false); herlaad(); }
          }}
          opGewijzigd={(overzicht) => {
            setMedicatieGewijzigd(true);
            setData((huidig) => huidig && {
              ...huidig,
              medicatie: overzicht.lopend.map((m) => ({
                id: m.id, naam: m.naam, atc: m.atc, dosering: m.dosering, chronisch: m.chronisch,
              })),
            });
          }} />
      )}

      {orderpaneel && (
        <Orderpaneel patientId={patientId} patientNaam={data.patient.naam} gebruiker={gebruiker}
          startSoort={orderpaneel === 'alles' ? undefined : orderpaneel}
          opSluit={() => setOrderpaneel(undefined)}
          opGeplaatst={(orders) => setOrdersVandaag((l) => [...l, ...orders])} />
      )}

      {tab === 'consult' && (
        <div className="dossier">
          {/*
            ── Links: wie is dit, in de volgorde waarin je het wilt weten ──

            De blokken staan in de volgorde van het gesprek zelf en niet in de volgorde
            waarin het systeem ze toevallig kan opleveren:

              1. wat nú aandacht vraagt (daar begin je mee),
              2. wie deze mens is — zelfredzaamheid en wat hij zelf wil,
              3. wat hij gebruikt,
              4. wat je kunt uitzetten,
              5. wat er daarna gepland of opgeroepen staat.

            Wie dat door elkaar zet, laat de zorgverlener elke keer opnieuw zoeken waar
            het stukje staat dat hij op dat moment nodig heeft.
          */}
          <div>
            <Kaart titel="Signalen" icoon="waarschuwing">
              <Signalen signalen={data.signalen} />
            </Kaart>

            {plan.zelfredzaamheid && plan.zelfredzaamheid.gemiddelde > 0 && (
              <Kaart titel="Zelfredzaamheid" icoon="schild"
                telling={plan.zelfredzaamheid.trend
                  ? `${plan.zelfredzaamheid.trend.verschil > 0 ? '+' : ''}${plan.zelfredzaamheid.trend.verschil}`
                  : undefined}>
                <Zelfredzaamheidsmeter
                  gemiddelde={plan.zelfredzaamheid.gemiddelde}
                  niveau={plan.zelfredzaamheid.niveau}
                  richting={plan.zelfredzaamheid.trend?.richting} />
                <p className="reden" style={{ marginTop: 9 }}>{plan.zelfredzaamheid.betekenis}</p>

                {plan.zelfredzaamheid.knelpunten.length > 0 && (
                  <>
                    <div className="mini" style={{ marginTop: 10, marginBottom: 4 }}>Knelpunten</div>
                    {plan.zelfredzaamheid.knelpunten.map((k) => (
                      <div key={k.domein.id} className="domein"
                        style={{ '--zrm-kleur': 'var(--aandacht)' } as CSSProperties}>
                        <span className="naam">{k.domein.naam}
                          <div className="mini">{k.domein.zorgbetekenis}</div>
                        </span>
                        <span className="punten">
                          {[1, 2, 3, 4, 5].map((n) => <i key={n} data-aan={n <= k.score} />)}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                <div className="mini" style={{ marginTop: 10 }}>
                  Contact-intervallen staan hierdoor op factor {plan.zelfredzaamheid.factor}.
                  {!plan.zelfredzaamheid.digitaalBereikbaar && ' Digitale oproep is niet passend.'}
                </div>

                {plan.zelfredzaamheid.bijgesteld && (
                  <div className="notitie" data-toon="waarschuwing" style={{ marginTop: 10 }}>
                    <strong>Handmatig bijgesteld.</strong> Berekend niveau was{' '}
                    {plan.zelfredzaamheid.bijgesteld.berekendNiveau} (factor{' '}
                    {plan.zelfredzaamheid.bijgesteld.berekendeFactor}).{' '}
                    {plan.zelfredzaamheid.bijgesteld.reden} — {plan.zelfredzaamheid.bijgesteld.door},{' '}
                    {plan.zelfredzaamheid.bijgesteld.op}
                  </div>
                )}

                <Bijstellen plan={data} gebruiker={gebruiker} bezig={Boolean(bezigMet)}
                  opWijzig={(bijstelling) => wijzigPlan({
                    zelfredzaamheid: data.persoonlijk.zelfredzaamheid
                      ? { ...data.persoonlijk.zelfredzaamheid, bijstelling }
                      : undefined,
                  }, 'zrm')} />
              </Kaart>
            )}

            {plan.doelen.length > 0 && (
              <Kaart titel="Wat deze patiënt zelf wil" icoon="doel">
                {plan.doelen.map((d) => (
                  <div key={d.id} style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--merk-diep)' }}>
                    “{d.tekst}”
                    <div className="mini" style={{ fontStyle: 'normal', marginTop: 3 }}>
                      afgesproken {d.afgesprokenOp}
                    </div>
                  </div>
                ))}
              </Kaart>
            )}

            {/*
              Medicatie is niet alleen iets om naar te kijken. Een regel is een knop:
              erop klikken opent het paneel waarin je dit middel aanpast, stopt of
              vervangt — met het recept in dezelfde handeling. Een lijst waar je niets
              mee kunt, dwingt de zorgverlener naar een ander scherm en laat hem daar
              vier losse handelingen doen.
            */}
            <Kaart titel="Medicatie" icoon="pil" telling={data.medicatie.length}>
              {data.medicatie.length === 0 && <span className="mini">Geen chronische medicatie.</span>}
              {data.medicatie.map((m) => (
                <button key={m.id ?? m.naam} className="medicatieregel"
                  onClick={() => setMedicatiepaneel({ middelId: m.id })}>
                  <span className="sleutel">{m.naam}<div className="mini">{m.atc}</div></span>
                  <span className="waarde">{m.dosering}</span>
                  <Icoon naam="schakelaar" grootte={13} />
                </button>
              ))}
              <div className="knop-rij" style={{ marginTop: 9 }}>
                <button className="knop" onClick={() => setMedicatiepaneel({})}>
                  <Icoon naam="pil" grootte={13} /> Medicatie aanpassen
                </button>
              </div>
            </Kaart>

            {/*
              Bestellen hoort bij het besluit, dus staat het hier — naast de medicatie en
              binnen handbereik tijdens het consult. Het ordertabblad is het overzicht
              achteraf; daar begin je geen recept.
            */}
            <Kaart titel="Bestellen" icoon="uitgaand"
              telling={ordersVandaag.length > 0 ? `${ordersVandaag.length} vandaag` : undefined}>
              <div className="orderknoppen">
                <button className="knop" onClick={() => setOrderpaneel('medicatie')}>
                  <Icoon naam="pil" grootte={13} /> Medicatie
                </button>
                <button className="knop" onClick={() => setOrderpaneel('verwijzing')}>
                  <Icoon naam="uitgaand" grootte={13} /> Verwijzing
                </button>
                <button className="knop" onClick={() => setOrderpaneel('lab')}>
                  <Icoon naam="buisje" grootte={13} /> Lab
                </button>
                <button className="knop" onClick={() => setOrderpaneel('onderzoek')}>
                  <Icoon naam="radar" grootte={13} /> Onderzoek
                </button>
                {/*
                  Een afspraak is een order als elke andere (ADR-0009), en dat geldt ook
                  voor een groepsconsult: "ik zet je op de leefstijlgroep" is vanuit het
                  consult dezelfde handeling als "ik plan een controle".
                */}
                <button className="knop" data-breed="true" onClick={() => setOrderpaneel('afspraak')}>
                  <Icoon naam="agenda" grootte={13} /> Afspraak of groepsconsult
                </button>
              </div>
              <button className="knop" data-toon="stil" style={{ marginTop: 8 }}
                onClick={() => setTab('orders')}>
                Alles wat loopt <Icoon naam="pijl" grootte={12} />
              </button>
            </Kaart>

            {/*
              Wie een dossier opent vanuit de autorisatiestapel, wil daar ook kunnen
              tekenen. Terug naar de lijst en het item opnieuw opzoeken is precies het
              loopwerk dat de stapel zo groot maakt.
            */}
            {data.autorisaties.length > 0 && gebruiker.rechten.includes('autoriseren') && (
              <Kaart titel="Wacht op jouw akkoord" icoon="klembord" telling={data.autorisaties.length}>
                {data.autorisaties.map((verzoek) => (
                  <div key={verzoek.id} className="autorisatieregel">
                    <div>
                      <strong style={{ fontSize: 13 }}>{verzoek.omschrijving}</strong>
                      <div className="reden">{verzoek.aanleiding}</div>
                      <div className="mini">
                        {verzoek.ingediendDoor.naam} · {verzoek.ingediendOp.slice(0, 10)}
                        {verzoek.routine ? ' · routine' : ''}
                      </div>
                      {verzoek.redenGeenRoutine && (
                        <div className="mini" style={{ color: 'var(--aandacht)' }}>
                          {verzoek.redenGeenRoutine}
                        </div>
                      )}
                    </div>
                    <div className="knop-rij" style={{ marginTop: 7 }}>
                      <button className="knop" data-toon="primair" disabled={bezigMet === verzoek.id}
                        onClick={() => werk(verzoek.id, async () => {
                          await api.accordeer([verzoek.id]);
                          return api.patient(patientId);
                        })}>
                        <Icoon naam="vink" grootte={13} /> Akkoord
                      </button>
                      <button className="knop" data-toon="gevaar" disabled={bezigMet === verzoek.id}
                        onClick={() => werk(verzoek.id, async () => {
                          await api.wijsAutorisatieAf(verzoek.id, 'afgewezen vanuit het dossier');
                          return api.patient(patientId);
                        })}>
                        <Icoon naam="kruis" grootte={13} /> Afwijzen
                      </button>
                    </div>
                  </div>
                ))}
              </Kaart>
            )}

            <Kaart titel="Afspraken" icoon="agenda"
              telling={data.planverzoeken.length > 0 ? `${data.planverzoeken.length} te plannen` : undefined}>
              {data.volgendeAfspraak ? (
                <div className="regel">
                  <span className="sleutel">
                    Volgende afspraak
                    <div className="mini">{data.volgendeAfspraak.reden ?? data.volgendeAfspraak.titel}</div>
                  </span>
                  <span className="waarde">
                    {data.volgendeAfspraak.start.slice(0, 10)}
                    <div className="mini" style={{ fontWeight: 400 }}>
                      {data.volgendeAfspraak.start.slice(11, 16)} · {data.volgendeAfspraak.duurMinuten} min
                    </div>
                  </span>
                </div>
              ) : (
                <span className="mini">Geen afspraak gepland.</span>
              )}

              {data.planverzoeken.map((v) => (
                <div key={v.id} className="regel">
                  <span className="sleutel">
                    {v.reden}
                    <div className="mini">
                      bij de {v.voorRol} · {v.duurMinuten} min · {ROUTE_KORT[v.route] ?? v.route}
                    </div>
                  </span>
                  <span className="waarde">
                    <span className="merkje" data-toon={v.status === 'uitgezet' ? 'informatief' : 'aandacht'}>
                      {v.status === 'uitgezet' ? 'bij de patiënt' : 'te plannen'}
                    </span>
                  </span>
                </div>
              ))}

              <button className="knop" style={{ marginTop: 10 }}
                onClick={() => setOrderpaneel('afspraak')}>
                <Icoon naam="plus" grootte={13} /> Afspraak plannen
              </button>
            </Kaart>

            <Bespreekknop patientId={patientId} naam={data.patient.naam} gebruiker={gebruiker} />

            <Kaart titel="Oproepen" icoon="gesprek" telling={data.oproepen.length}>
              {data.oproepen.length === 0 && (
                <span className="mini">Geen oproepen — past bij de gekozen aanpak.</span>
              )}
              {data.oproepen.slice(0, 2).map((o, i) => (
                <div key={i} style={{ marginBottom: 9 }}>
                  <div className="regel">
                    <span className="sleutel">{o.uitnodigenOp}</span>
                    <span className="waarde"><span className="merkje" data-toon="neutraal">{o.kanaal}</span></span>
                  </div>
                  <div className="mini">{o.toelichting}</div>
                </div>
              ))}
            </Kaart>
          </div>

          {/*
            ── Midden: de loop van het consult ──────────────────────────

            Voorbereiding uit de wachtkamer, dan wat het systeem opmerkt, dan wat je
            vastlegt, dan wat daaruit volgt. Precies de volgorde waarin een consult
            verloopt, zodat je van boven naar beneden werkt in plaats van heen en weer.
          */}
          <div>
            {/*
              De vragenlijst staat vóór de wachtkamerintake en vóór de suggesties. Dat is
              met opzet: dit is het enige blok waarin de patiënt zelf aan het woord is, en
              alles eronder gaat over wat het systeem ervan vindt.
            */}
            {(vragenlijsten ?? [])
              .filter((l) => l.status === 'ingevuld')
              .slice(0, 2)
              .map((l) => (
                <Vragenlijstkaart key={l.afnameId} inzage={l}
                  uitgeklapt={lijstUit[l.afnameId]}
                  bezig={bezigMet === 'vragenlijst'}
                  opUitklappen={() => setLijstUit((u) => ({ ...u, [l.afnameId]: !u[l.afnameId] }))}
                  opOvernemen={() => neemVragenlijstOver(l)} />
              ))}

            {data.intake && (
              <IntakeKaart intake={data.intake} bezig={bezigMet === 'intake'}
                opBevestig={() => neemIntakeOver(false)}
                opBewaarAlsMelding={() => neemIntakeOver(true)} />
            )}

            <Kaart titel="Beslissingsondersteuning" icoon="gesprek" telling={`${klinisch.length} voor jou`}>
              {klinisch.length === 0 && logistiek.length === 0 && (
                <span className="mini">Geen suggesties. Alles loopt volgens plan.</span>
              )}
              {klinisch.map((s) => (
                <SuggestieKaart key={s.id} suggestie={s} bezig={bezigMet === s.regelId}
                  opActie={(actieId) => werk(s.regelId, () => api.suggestie(patientId, s.regelId, actieId))} />
              ))}
              {logistiek.length > 0 && (
                <div className="automatisch" style={{ marginTop: klinisch.length ? 14 : 0, marginBottom: 0 }}>
                  <h3><Icoon naam="bliksem" /> Dit regelt het systeem zelf</h3>
                  <ul>{logistiek.map((s) => <li key={s.id}>{s.titel} — {s.bevinding}</li>)}</ul>
                </div>
              )}
            </Kaart>

            {uitkomst && (
              <Kaart titel="Consult afgerond" icoon="afvinken"
                telling={`${uitkomst.vastgelegd.length} vastgelegd`}>
                <div className="afgerondkop">
                  <span className="merkje" data-toon="ok">
                    <Icoon naam="vink" grootte={11} /> vastgelegd in het dossier
                  </span>
                  {uitkomst.declaratie && (
                    <span className="merkje"
                      data-toon={uitkomst.declaratie.declarabel ? 'ok' : 'aandacht'}>
                      <Icoon naam="euro" grootte={11} /> {uitkomst.declaratie.naam}
                      {uitkomst.declaratie.prestatie ? ` · ${uitkomst.declaratie.prestatie.code}` : ''}
                    </span>
                  )}
                  <span className="mini">
                    De afspraak van vandaag staat nu op <strong>afgerond</strong> in de agenda.
                  </span>
                </div>

                {uitkomst.declaratie && !uitkomst.declaratie.declarabel && (
                  <div className="notitie" data-toon="waarschuwing" style={{ marginBottom: 10 }}>
                    <strong>Nog niet declarabel.</strong> {uitkomst.declaratie.toelichting}
                    {uitkomst.declaratie.ontbreekt.length > 0
                      && ` Ontbreekt: ${uitkomst.declaratie.ontbreekt.join(', ')}.`}
                  </div>
                )}

                <table>
                  <tbody>
                    {uitkomst.vastgelegd.map((v) => (
                      <tr key={v.code}>
                        <td>{v.naam}</td>
                        <td className="rechts getal">{v.waarde}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {ordersVandaag.length > 0 && (
                  <>
                    <div className="mini" style={{ marginTop: 10, marginBottom: 4 }}>
                      Orders die aan dit consult hangen
                    </div>
                    <ul className="uitleg">
                      {ordersVandaag.map((o, i) => (
                        <li key={i}>{o.omschrijving}{o.detail ? ` — ${o.detail}` : ''}</li>
                      ))}
                    </ul>
                  </>
                )}

                {uitkomst.verantwoordingGevuld.length > 0 && (
                  <div className="notitie" data-toon="ok" style={{ marginTop: 10 }}>
                    Hiermee zijn vanzelf op orde:{' '}
                    {uitkomst.verantwoordingGevuld.map((v) => `${v.indicator} (${v.keten})`).join(', ')}.
                  </div>
                )}
                {uitkomst.vervolg.length > 0 && (
                  <ul className="uitleg" style={{ marginTop: 8 }}>
                    {uitkomst.vervolg.map((v, i) => <li key={i}>{v}</li>)}
                  </ul>
                )}

                <div className="knop-rij" style={{ marginTop: 12 }}>
                  <button className="knop" onClick={() => setTab('journaal')}>
                    <Icoon naam="boek" grootte={13} /> Bekijk in het journaal
                  </button>
                  <button className="knop" onClick={terug}>
                    <Icoon naam="pijl-links" grootte={13} /> Terug naar het spreekuur
                  </button>
                  <button className="knop" data-toon="stil" onClick={() => setUitkomst(undefined)}>
                    <Icoon naam="plus" grootte={13} /> Nieuw contact starten
                  </button>
                </div>
              </Kaart>
            )}

            {!uitkomst && (
              <Registreren patientId={patientId} overzicht={data} gebruiker={gebruiker}
                registratie={registratie}
                ordersVandaag={ordersVandaag} opOrder={() => setOrderpaneel('alles')}
                opWijzig={setRegistratie}
                opKlaar={(nieuw, uit) => { setData(nieuw); setUitkomst(uit); }} />
            )}

            <Kaart titel="Het plan van deze patiënt" icoon="agenda" telling={`${plan.contacten.length} contacten`}>
              {plan.contacten.length > 0 && !plan.vergelijking.valtBuitenKeten && (
                <div className="vergelijking">
                  <div>
                    <div className="cijfer">{plan.vergelijking.traditioneleContacten}</div>
                    <div className="onder" title={plan.vergelijking.traditioneleTrajecten.join(', ')}>
                      losse trajecten
                    </div>
                  </div>
                  <span style={{ color: 'var(--merk-diep)' }}><Icoon naam="pijl" grootte={20} /></span>
                  <div>
                    <div className="cijfer">{plan.vergelijking.geintegreerdeContacten}</div>
                    <div className="onder">geïntegreerde contacten</div>
                  </div>
                  <div className="uitleg">
                    <div className="chips" style={{ marginBottom: 5 }}>
                      {plan.vergelijking.traditioneleTrajecten.map((t) => (
                        <span key={t} className="merkje" data-toon="neutraal">{t}</span>
                      ))}
                    </div>
                    {plan.vergelijking.extraOnderwerpen.length > 0 && (
                      <>Die trajecten dekken {plan.vergelijking.extraOnderwerpen.join(', ')} niet.</>
                    )}
                  </div>
                </div>
              )}

              {plan.vergelijking.valtBuitenKeten && (
                <div className="notitie" data-toon="waarschuwing">
                  <strong>Valt buiten elke landelijke keten.</strong> Wel een chronische zorgvraag,
                  geen programma. In de huidige inrichting krijgt deze patiënt daar geen
                  gestructureerde begeleiding voor.
                </div>
              )}

              <Zorgreis contacten={plan.contacten} vandaag={vandaag}
                laatsteContact={laatsteContactDatum} />

              <button className="knop" data-toon="stil" style={{ marginTop: 10 }}
                onClick={() => setToonDetails(!toonDetails)}>
                <Icoon naam={toonDetails ? 'kruis' : 'lijst'} grootte={13} />
                {toonDetails ? 'Verberg de details per contact' : 'Wat er per contact gebeurt'}
              </button>

              {toonDetails && plan.contacten.map((contact) => (
                <ContactKaart key={contact.id} contact={contact} opMetingKlik={opMetingKlik} />
              ))}

              {plan.toelichting.length > 0 && (
                <>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', margin: '15px 0 5px' }}>
                    Waarom dit plan er zo uitziet
                  </h3>
                  <ul className="uitleg">{plan.toelichting.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </>
              )}
              {plan.consequenties.length > 0 && (
                <>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', margin: '15px 0 5px' }}>
                    Gevolgen van gemaakte keuzes
                  </h3>
                  <ul className="uitleg">{plan.consequenties.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </>
              )}
            </Kaart>

            <Kaart titel="Op maat maken" icoon="schakelaar">
              <label className="veld">Hoe intensief volgen we deze patiënt?</label>
              <div className="segment" style={{ marginBottom: 14 }}>
                {INTENSITEITEN.map((i) => (
                  <button key={i.id} data-actief={plan.intensiteit === i.id} title={i.uitleg}
                    disabled={Boolean(bezigMet)}
                    onClick={() => wijzigPlan({ intensiteit: i.id }, 'intensiteit')}>
                    {i.label}
                  </button>
                ))}
              </div>

              <div className="raster2">
                <div>
                  <label className="veld">Hoe vaak wil de patiënt maximaal komen?</label>
                  <div className="segment">
                    {[undefined, 2, 3, 4].map((n) => (
                      <button key={String(n)} data-actief={data.persoonlijk.voorkeuren.maxContactenPerJaar === n}
                        disabled={Boolean(bezigMet)}
                        onClick={() => wijzigPlan({
                          voorkeuren: { ...data.persoonlijk.voorkeuren, maxContactenPerJaar: n },
                        }, 'max')}>
                        {n === undefined ? 'geen maximum' : `${n}× per jaar`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="veld">Metingen die de patiënt thuis kan doen</label>
                  <div className="segment">
                    <button data-actief={!data.persoonlijk.voorkeuren.liefstThuismeting}
                      disabled={Boolean(bezigMet)}
                      onClick={() => wijzigPlan({
                        voorkeuren: { ...data.persoonlijk.voorkeuren, liefstThuismeting: false },
                      }, 'thuis')}>in de praktijk</button>
                    <button data-actief={data.persoonlijk.voorkeuren.liefstThuismeting === true}
                      disabled={Boolean(bezigMet)}
                      onClick={() => wijzigPlan({
                        voorkeuren: { ...data.persoonlijk.voorkeuren, liefstThuismeting: true },
                      }, 'thuis')}>liefst thuis</button>
                  </div>
                </div>
              </div>

              <label className="veld" style={{ marginTop: 14 }}>Aandachtsgebieden</label>
              {plan.modules.map((module) => (
                <div key={module.id} className={`modulekaart mod-${module.id}`}>
                  <div className="kop">
                    <span style={{ color: 'var(--tint)' }}>
                      <Icoon naam={icoonVanModule(module.id, module.icoon)} />
                    </span>
                    <h3>{module.naam}</h3>
                    {module.herkomst === 'handmatig-aan' && (
                      <span className="merkje" data-toon="informatief">handmatig aan</span>
                    )}
                    <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
                      disabled={Boolean(bezigMet)}
                      onClick={() => wijzigPlan({
                        moduleKeuzes: [
                          ...data.persoonlijk.moduleKeuzes.filter((k) => k.moduleId !== module.id),
                          { moduleId: module.id, aan: false, reden: 'wordt elders gevolgd', door: gebruiker.naam, op: new Date().toISOString().slice(0, 10) },
                        ],
                      }, `uit-${module.id}`)}>
                      <Icoon naam="kruis" grootte={13} /> Uitzetten
                    </button>
                  </div>
                  <div className="reden">{module.onderbouwing}</div>
                </div>
              ))}

              <button className="knop" data-toon="stil" style={{ marginTop: 6 }}
                onClick={() => setToonNietActief(!toonNietActief)}>
                <Icoon naam={toonNietActief ? 'kruis' : 'plus'} grootte={13} />
                {toonNietActief ? 'Verberg' : `Toon ${plan.nietActief.length} niet-actieve gebieden`}
              </button>

              {toonNietActief && (
                <div style={{ marginTop: 9 }}>
                  {plan.nietActief.map((m) => (
                    <div key={m.id} className="regel">
                      <span className="sleutel">{m.naam}<div className="mini">{m.onderbouwing}</div></span>
                      <span className="waarde">
                        <button className="knop" data-toon="stil" disabled={Boolean(bezigMet)}
                          onClick={() => wijzigPlan({
                            moduleKeuzes: [
                              ...data.persoonlijk.moduleKeuzes.filter((k) => k.moduleId !== m.id),
                              { moduleId: m.id, aan: true, reden: 'op klinische gronden toegevoegd', door: gebruiker.naam, op: new Date().toISOString().slice(0, 10) },
                            ],
                          }, `aan-${m.id}`)}>
                          <Icoon naam="plus" grootte={13} /> Aanzetten
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Kaart>
          </div>

          {/* ── Rechts: dossierstructuur ───────────────────────────────── */}
          <div>
            <Kaart titel="Episodes" icoon="lijst" telling={data.episodes.length} strak>
              <table>
                <tbody>
                  {data.episodes.map((e) => (
                    <tr key={e.id}>
                      <td style={{ width: 62 }} className="nadruk">{e.icpc}</td>
                      <td>
                        <button className="knop" data-toon="stil" style={{ padding: 0, textAlign: 'left' }}
                          onClick={() => setTab('journaal')}>{e.titel}</button>
                        <div className="mini">sinds {e.start}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Kaart>

            <Kaart titel="Verantwoording" icoon="tag" telling={plan.ketens.length}>
              <p className="mini" style={{ marginTop: 0 }}>
                Automatisch afgeleid. Je registreert hier niets voor.
              </p>
              {plan.ketens.length === 0 && <span className="mini">Valt onder geen landelijke keten.</span>}
              {plan.ketens.map((keten) => (
                <div key={keten.ketenId} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <strong style={{ fontSize: 12.5 }}>{keten.naam}</strong>
                    <span className="merkje"
                      data-toon={keten.volledigheid === 1 ? 'ok' : keten.volledigheid > 0.6 ? 'aandacht' : 'urgent'}>
                      {Math.round(keten.volledigheid * 100)}%
                    </span>
                  </div>
                  <div className="mini">{keten.declaratie.prestatiecode} · {keten.grondslag}</div>
                  <div style={{ marginTop: 5, display: 'grid', gap: 2 }}>
                    {keten.indicatoren.filter((i) => !i.voldaan).map((i) => (
                      <div key={i.code} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                        <span style={{ color: 'var(--aandacht)' }}><Icoon naam="kruis" grootte={11} /></span>
                        {i.naam} <span className="mini">— {i.toelichting}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Kaart>

            <Kaart titel="Meetwaarden nu" icoon="buisje"
              extra={
                <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
                  onClick={() => setTab('metingen')}>
                  alles <Icoon naam="pijl" grootte={12} />
                </button>
              }>
              <p className="mini" style={{ marginTop: 0 }}>
                Wat voor dít contact telt. De rest staat onder Meetwaarden.
              </p>
              {(plan.contacten[0]?.metingen ?? []).filter((m) => m.laatsteWaarde !== undefined).map((m) => (
                <button key={m.code} className="regel"
                  style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => opMetingKlik(m.code)}>
                  <span className="sleutel">{m.naam}</span>
                  <span className="waarde" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {m.laatsteWaarde}
                    <div className="mini" style={{ fontWeight: 400 }}>{m.laatsteOp}</div>
                  </span>
                </button>
              ))}
            </Kaart>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Videoconsult.
 *
 * Bewust géén nagebouwde videoverbinding: dat zou suggereren dat er iets werkt wat er
 * niet is. Wat hier wél staat is het werkproces eromheen — hoe de patiënt de uitnodiging
 * krijgt, dat het dossier ernaast open blijft, en dat er achteraf gewoon een deelcontact
 * geregistreerd wordt. Dat is het deel dat een HIS moet regelen; het beeld komt van een
 * partij die daar goed in is (docs/14 §4, ingebedde apps).
 */
function Videovenster({ naam, portaal, opSluit }: {
  naam: string; portaal: boolean; opSluit: () => void;
}) {
  const [gestart, setGestart] = useState(false);
  return (
    <>
      <div className="paneel-scherm" onClick={opSluit} />
      <div className="videovenster" role="dialog" aria-label="Videoconsult">
        <header>
          <span className="kop"><Icoon naam="video" grootte={15} /> Videoconsult met {naam}</span>
          <button className="knop" data-toon="stil" onClick={opSluit}>
            <Icoon naam="kruis" grootte={15} />
          </button>
        </header>
        <div className="beeld">
          {gestart ? (
            <>
              <span className="stip-live" /> Verbinding wordt opgezet…
              <div className="mini">
                In de demo gebeurt er verder niets. In productie draait hier de ingebedde
                videodienst, met dezelfde herkomstregels als elke andere partnerapp.
              </div>
            </>
          ) : (
            <>
              <Icoon naam="video" grootte={40} />
              <div className="mini">
                {portaal
                  ? 'De patiënt krijgt een link in het portaal en kan direct deelnemen.'
                  : 'Deze patiënt heeft geen portaal. De link gaat per sms; dat is zwakker '
                    + 'geauthenticeerd en dat hoor je te weten voordat je begint.'}
              </div>
            </>
          )}
        </div>
        <footer>
          <button className="knop" data-toon="primair" onClick={() => setGestart(true)}
            disabled={gestart}>
            <Icoon naam="video" grootte={13} /> {gestart ? 'Bezig…' : 'Uitnodiging versturen en starten'}
          </button>
          <span className="mini">
            Na afloop leg je het consult vast zoals elk ander contact; de vorm komt in het
            journaal te staan.
          </span>
        </footer>
      </div>
    </>
  );
}

const ZRM_NIVEAUS = [
  { id: 'acuut', label: 'acute problematiek', factor: 0.5 },
  { id: 'beperkt', label: 'beperkt zelfredzaam', factor: 0.7 },
  { id: 'voldoende', label: 'voldoende', factor: 1 },
  { id: 'goed', label: 'goed', factor: 1.3 },
  { id: 'volledig', label: 'volledig', factor: 1.6 },
];

/**
 * De score overrulen op professionele gronden.
 *
 * Een gemiddelde van elf domeinen is een hulpmiddel, geen oordeel. Wie deze mens kent,
 * ziet soms iets wat niet in de scores zit. Die inschatting mag winnen — maar alleen mét
 * reden en zichtbaar naast het berekende getal, anders is het cijfer voor iedereen die
 * er later naar kijkt onbetrouwbaar geworden.
 */
function Bijstellen({ plan, gebruiker, bezig, opWijzig }: {
  plan: PatientOverzicht;
  gebruiker: Gebruiker;
  bezig: boolean;
  opWijzig: (bijstelling: { niveau: string; reden: string; door: string; op: string } | undefined) => void;
}) {
  const huidig = plan.persoonlijk.zelfredzaamheid?.bijstelling;
  const [open, setOpen] = useState(false);
  const [niveau, setNiveau] = useState(huidig?.niveau ?? plan.zorgplan.zelfredzaamheid?.niveau ?? 'voldoende');
  const [reden, setReden] = useState(huidig?.reden ?? '');

  if (!plan.persoonlijk.zelfredzaamheid) return null;

  if (!open) {
    return (
      <div className="knop-rij" style={{ marginTop: 10 }}>
        <button className="knop" data-toon="stil" onClick={() => setOpen(true)}>
          <Icoon naam="schakelaar" grootte={13} /> Zelf inschatten
        </button>
        {huidig && (
          <button className="knop" data-toon="stil" disabled={bezig}
            onClick={() => opWijzig(undefined)}>
            <Icoon naam="herstel" grootte={13} /> Terug naar de score
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <label className="veld">Jouw inschatting</label>
      <div className="chips" style={{ marginBottom: 9 }}>
        {ZRM_NIVEAUS.map((n) => (
          <button key={n.id} className="filterchip" data-actief={niveau === n.id}
            onClick={() => setNiveau(n.id)}>
            {n.label} <span className="mini">×{n.factor}</span>
          </button>
        ))}
      </div>
      <label className="veld">Waarom wijk je af van de score?</label>
      <input type="text" value={reden} autoFocus
        placeholder="Bijvoorbeeld: partner is vorige maand overleden, netwerk valt weg"
        onChange={(e) => setReden(e.target.value)} />
      <div className="knop-rij" style={{ marginTop: 9 }}>
        <button className="knop" data-toon="primair" disabled={bezig || !reden.trim()}
          onClick={() => {
            opWijzig({
              niveau, reden: reden.trim(), door: gebruiker.naam,
              op: new Date().toISOString().slice(0, 10),
            });
            setOpen(false);
          }}>
          <Icoon naam="vink" grootte={13} /> Vastleggen
        </button>
        <button className="knop" onClick={() => setOpen(false)}>Annuleren</button>
      </div>
      <p className="mini" style={{ marginTop: 7 }}>
        De bijstelling werkt door op alle contact-intervallen en blijft naast het berekende
        niveau zichtbaar, met jouw naam erbij.
      </p>
    </div>
  );
}

function ContactKaart({ contact, opMetingKlik }: {
  contact: GeplandContact; opMetingKlik: (code: string) => void;
}) {
  return (
    <div className="contact" data-soort={contact.soort}>
      <div className="kop">
        <span className="datum">{contact.datum}</span>
        <span className="merkje" data-toon={contact.soort === 'uitgebreide-controle' ? 'informatief' : 'neutraal'}>
          {contact.soort === 'uitgebreide-controle' ? 'uitgebreid' : 'controle'}
        </span>
        <ModuleIdChips ids={contact.modules} />
        <span className="duur"><Icoon naam="klok" grootte={13} /> {contact.duurMinuten} min</span>
      </div>

      {contact.metingen.map((m) => (
        <div className="meting" key={m.code}>
          <span className="naam">
            {m.naam}
            {m.modules.length > 1 && (
              <span className="merkje" data-toon="ok">
                telt voor {m.modules.map((x) => MODULE_NAAM[x] ?? x).join(' + ')}
              </span>
            )}
            {m.zelfAanleverbaar && <span className="merkje" data-toon="neutraal">thuis mogelijk</span>}
            {m.labVooraf && <span className="merkje" data-toon="aandacht">lab vooraf</span>}
          </span>
          <span className="waarde">
            {m.laatsteWaarde !== undefined ? (
              <button className="knop" data-toon="stil" style={{ padding: '0 4px', fontSize: 12 }}
                title="Bekijk het beloop van deze meting"
                onClick={() => opMetingKlik(m.code)}>
                {m.laatsteWaarde} op {m.laatsteOp} <Icoon naam="pijl" grootte={11} />
              </button>
            ) : 'nog niet bepaald'}
          </span>
        </div>
      ))}

      {contact.vragenlijsten.length > 0 && (
        <div className="mini" style={{ marginTop: 7 }}>
          Vooraf uitzetten: {contact.vragenlijsten.join(', ')}
        </div>
      )}
    </div>
  );
}

/**
 * HET JOURNAAL — eigen zorg én wat van buiten kwam
 *
 * Links de bronnen: onze eigen episodes (huisartsenzorg) en daaronder de partijen waar
 * deze patiënt ook komt. Rechts één chronologische stroom waarin beide door elkaar staan,
 * want zo is de zorg ook verlopen.
 *
 * Wat wij vastlegden staat in SOEP. Wat van buiten kwam níet: een BgZ heeft vaste secties,
 * een e-Overdracht een verpleegkundige structuur. Dat in SOEP persen zou de herkomst
 * wegpoetsen, en juist die moet zichtbaar blijven — het is niet van ons en het telt niet
 * automatisch mee in de beslisregels.
 */
function Journaal({ patientId, bron: startBron }: { patientId: string; bron?: string }) {
  const [bron, setBron] = useState<string | undefined>(startBron);
  const [open, setOpen] = useState<string | undefined>();
  /*
   * Uitgezette soorten, niet aangezette.
   *
   * Het journaal laat standaard álles zien — dat is de belofte van één tijdlijn, en wie
   * hem versmalt hoort dat zelf te doen. Maar op een dossier met tien jaar historie en
   * dagelijkse thuismetingen wil je wél kunnen zeggen: even zonder de metingen. Daarom
   * een filter dat uitzet in plaats van aanzet: wat je niet aanraakt, blijft staan.
   */
  const [uit, setUit] = useState<Tijdlijnsoort[]>([]);
  const { data, fout, bezig, setData } = useData(
    () => api.historie(patientId, bron), [patientId, bron]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Journaal" />;

  const eigen = data.bronnen.filter((b) => b.aard === 'episode');
  const extern = data.bronnen.filter((b) => b.aard !== 'episode' && b.aard !== 'patient');
  const vanPatient = data.bronnen.find((b) => b.aard === 'patient');

  const aanwezig = [...new Set(data.tijdlijn.map((i) => i.soort))];
  const zichtbaar = data.tijdlijn.filter((i) => !uit.includes(i.soort));
  const wissel = (soort: Tijdlijnsoort) =>
    setUit((lijst) => lijst.includes(soort)
      ? lijst.filter((x) => x !== soort)
      : [...lijst, soort]);

  const lees = async (documentId: string) => {
    setOpen(open === documentId ? undefined : documentId);
    if (open !== documentId) setData(await api.markeerExternGelezen(patientId, documentId));
  };

  return (
    <div className="raster2" style={{ gridTemplateColumns: '282px minmax(0, 1fr)' }}>
      <div>
        {/*
          De patiënt als eigen ingang.
          Dit is geen bron zoals een ziekenhuis er een is, maar een dwarsdoorsnede: alles
          wat déze mens zelf heeft doorgegeven, los van bij welke episode het hoort. Die
          vraag is nu alleen te beantwoorden door het hele journaal door te lezen.
        */}
        {vanPatient && (
          <Kaart titel="Van de patiënt zelf" icoon="persoon" telling={vanPatient.aantal} strak>
            <button className="gesprekknop" data-actief={bron === vanPatient.id}
              onClick={() => setBron(bron === vanPatient.id ? undefined : vanPatient.id)}>
              <strong style={{ fontSize: 13 }}>{vanPatient.titel}</strong>
              <div className="mini">{vanPatient.toelichting}</div>
            </button>
            <div className="body" style={{ paddingTop: 0 }}>
              <p className="mini" style={{ marginBottom: 0 }}>
                Echte en bruikbare waarden, maar geen registratie van de praktijk tot iemand
                ze heeft overgenomen.
              </p>
            </div>
          </Kaart>
        )}

        <Kaart titel="Huisartsenzorg" icoon="lijst" telling={eigen.length} strak>
          <button className="gesprekknop" data-actief={!bron} onClick={() => setBron(undefined)}>
            <strong style={{ fontSize: 13 }}>Alles bij elkaar</strong>
            <div className="mini">
              {data.aantalContacten} eigen contacten · {data.aantalExtern} van buiten
            </div>
          </button>
          {eigen.map((b) => (
            <button key={b.id} className="gesprekknop" data-actief={bron === b.id}
              onClick={() => setBron(b.id)}>
              <strong style={{ fontSize: 13 }}>{b.titel}</strong>
              <div className="mini">{b.aantal} contact{b.aantal === 1 ? '' : 'en'} · {b.toelichting}</div>
            </button>
          ))}
        </Kaart>

        <Kaart titel="Zorg buiten de praktijk" icoon="gebouw" telling={extern.length} strak>
          {extern.length === 0 && (
            <div className="body">
              <span className="mini">
                Niets binnengekomen van andere zorgverleners.
              </span>
            </div>
          )}
          {extern.map((b) => (
            <div key={b.id} className="bronblok">
              <button className="gesprekknop" data-actief={bron === b.id}
                onClick={() => setBron(bron === b.id ? undefined : b.id)}>
                <strong style={{ fontSize: 13 }}>
                  {b.titel}
                  {b.ongelezen ? <span className="stip" /> : null}
                </strong>
                <div className="mini">{b.aantal} bericht{b.aantal === 1 ? '' : 'en'} · {b.toelichting}</div>
              </button>
              {b.portaal && (
                <a className="portaallink" href={b.portaal.url} target="_blank" rel="noreferrer">
                  <Icoon naam="uitgaand" grootte={12} /> Openen in {b.portaal.naam}
                </a>
              )}
            </div>
          ))}
          <div className="body" style={{ paddingTop: 0 }}>
            <p className="mini" style={{ marginBottom: 0 }}>
              Binnengekomen via BgZ, e-Overdracht of als retourbericht. De portaallink is een
              ingang naar het systeem van de instelling — geen koppeling, wel de plek waar je
              hem verwacht.
            </p>
          </div>
        </Kaart>
      </div>

      <Kaart titel="Tijdlijn" icoon="boek"
        telling={uit.length > 0
          ? `${zichtbaar.length} van ${data.tijdlijn.length}`
          : `${data.tijdlijn.length} items`}>
        {aanwezig.length > 1 && (
          <div className="tijdlijnfilter">
            {aanwezig.map((soort) => (
              <button key={soort} className="merkje" data-toon={uit.includes(soort) ? 'neutraal' : 'informatief'}
                data-aan={!uit.includes(soort)} onClick={() => wissel(soort)}>
                <Icoon naam={uit.includes(soort) ? 'kruis' : 'vink'} grootte={11} />
                {TIJDLIJNSOORT_LABEL[soort]}
                <span className="mini">{data.tijdlijn.filter((i) => i.soort === soort).length}</span>
              </button>
            ))}
            {uit.length > 0 && (
              <button className="knop" data-toon="stil" onClick={() => setUit([])}>
                Alles weer tonen
              </button>
            )}
            <button className="knop" data-toon="stil"
              onClick={() => setUit(aanwezig.filter((s) => !PATIENTSOORTEN.includes(s)))}>
              <Icoon naam="persoon" grootte={12} /> Alleen wat de patiënt aanleverde
            </button>
          </div>
        )}

        {zichtbaar.length === 0 && (
          <Leeg tekst={uit.length > 0
            ? 'Alles van deze soort staat uit. Zet een filter terug aan.'
            : 'Nog niets vastgelegd voor deze bron.'} />
        )}
        <div className="journaal">
          {zichtbaar.map((item) => {
            if (item.soort === 'contact') {
              return (
                <Contactregel key={item.contact.encounterId + item.datum} regel={item.contact}
                  patientId={patientId}
                  open={open === item.contact.encounterId}
                  opKlik={() => setOpen(open === item.contact.encounterId ? undefined : item.contact.encounterId)}
                  opEpisode={() => setBron(item.contact.episodeId)} />
              );
            }
            if (item.soort === 'overleg') {
              return <Overlegregel key={item.notitie.id} notitie={item.notitie} />;
            }
            if (item.soort === 'eigenmeting') {
              return <Eigenmetingregel key={item.meting.id} meting={item.meting} />;
            }
            if (item.soort === 'vragenlijst') {
              return (
                <Vragenlijstregel key={item.inzage.afnameId} inzage={item.inzage}
                  open={open === item.inzage.afnameId}
                  opKlik={() => setOpen(open === item.inzage.afnameId ? undefined : item.inzage.afnameId)} />
              );
            }
            if (item.soort === 'intake') {
              return <Intakeregel key={item.intake.id} intake={item.intake} />;
            }
            return (
              <Externregel key={item.document.id} document={item.document}
                open={open === item.document.id} opKlik={() => lees(item.document.id)} />
            );
          })}
        </div>
      </Kaart>
    </div>
  );
}

/**
 * Eén eigen contact in het journaal.
 *
 * De SOEP-tekst staat er direct; "het hele consult" haalt op wat er verder op dat moment
 * is vastgelegd. Dat is bewust een aparte ophaalactie: het journaal blijft licht, en wie
 * de reconstructie wil, vraagt erom.
 */
function Contactregel({ regel, patientId, open, opKlik, opEpisode }: {
  regel: JournaalRegel; patientId: string; open: boolean; opKlik: () => void; opEpisode: () => void;
}) {
  return (
    <div className="journaalregel" data-open={open}>
      <div>
        <div className="wanneer">{regel.datum}</div>
        <div className="mini">{regel.tijd ? `${regel.tijd} · ` : ''}{regel.soort}</div>
      </div>
      <div>
        <div className="contactkop">
          <span className="merkje" data-toon="neutraal">{regel.episodeIcpc} {regel.episodeTitel}</span>
          <span className="mini">{regel.auteur} · {regel.auteurRol}</span>
          {regel.bron !== 'zorgverlener' && (
            <span className="merkje" data-toon="aandacht">{regel.bron}</span>
          )}
          {/*
            Een echte knop, geen tekstje rechts. Wat erachter zit is niet "meer van
            hetzelfde" maar een ander soort informatie: de reconstructie van het moment.
          */}
          <button className="knop" data-toon={open ? undefined : 'primair'} onClick={opKlik}>
            <Icoon naam={open ? 'kruis' : 'boek'} grootte={13} />
            {open ? 'Sluiten' : 'Het hele consult'}
          </button>
        </div>

        {!regel.heeftSoep && (
          <div className="mini" style={{ margin: '6px 0' }}>
            Geen verslagtekst bij dit contact — er zijn alleen gegevens vastgelegd.
          </div>
        )}
        {/* Open staat de SOEP in het contactdossier hieronder, op zijn chronologische plek. */}
        {!open && (
          <div className="soep">
            {regel.regels.map((r, i) => (
              <div key={i} className="soepregel">
                <span className="soepletter" data-letter={r.letter}>{r.letter}</span>
                <span>{r.tekst}</span>
              </div>
            ))}
          </div>
        )}

        {regel.aantalMetingen > 0 && !open && (
          <div className="mini" style={{ marginTop: 5 }}>
            {regel.aantalMetingen} meting{regel.aantalMetingen === 1 ? '' : 'en'} vastgelegd bij dit contact.
          </div>
        )}

        {open && (
          <HeleConsult patientId={patientId} encounterId={regel.encounterId} opEpisode={opEpisode} />
        )}
      </div>
    </div>
  );
}

/**
 * Alles wat op dit moment is vastgelegd, in de volgorde waarin het gebeurde.
 *
 * Eerst wie er tegenover je zat en wat er toen al bekend was, dan de hulpvraag, dan wat je
 * hebt opgeschreven, dan wat je hebt gemeten, dan wat je hebt uitgezet, en pas als laatste
 * de administratie. Dat is de volgorde van het consult zelf; een dossier dat begint bij het
 * contact-id is geschreven voor het systeem in plaats van voor de mens die het naleest.
 */
function HeleConsult({ patientId, encounterId, opEpisode }: {
  patientId: string; encounterId: string; opEpisode: () => void;
}) {
  const { data, fout, bezig } = useData(
    () => api.contactdossier(patientId, encounterId), [patientId, encounterId]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Het consult" />;

  return (
    <div className="contactdetail">
      <div className="contactblok">
        <h4><Icoon naam="persoon" grootte={13} /> Wie, en wat er toen bekend was</h4>
        <div className="regel">
          <span className="sleutel">Patiënt</span>
          <span className="waarde">
            {data.patient.naam} · {data.patient.leeftijdToen} jaar toen
            <div className="mini">geboren {data.patient.geboortedatum}</div>
          </span>
        </div>
        <div className="regel">
          <span className="sleutel">Episodes op dat moment</span>
          <span className="waarde">
            <span className="chips">
              {data.patient.episodesToen.length === 0 && <span className="mini">geen</span>}
              {data.patient.episodesToen.map((e) => (
                <span key={e.titel} className="merkje" data-toon="neutraal">
                  {e.icpc} {e.titel}
                </span>
              ))}
            </span>
          </span>
        </div>
        {data.patient.behandelgrenzen.length > 0 && (
          <div className="regel">
            <span className="sleutel">Beleidsafspraken</span>
            <span className="waarde">
              {data.patient.behandelgrenzen.map((b) => (
                <div key={b} className="mini" style={{ color: 'var(--urgent)' }}>{b}</div>
              ))}
            </span>
          </div>
        )}
        <div className="regel">
          <span className="sleutel">Contact</span>
          <span className="waarde" style={{ fontWeight: 400 }}>
            {data.soort}{data.duurMinuten ? ` · ${data.duurMinuten} min` : ''}
            {' · '}{data.uitvoerder.naam} ({data.uitvoerder.rol})
          </span>
        </div>
      </div>

      {data.hulpvraag && (
        <div className="contactblok">
          <h4><Icoon naam="gesprek" grootte={13} /> De hulpvraag</h4>
          <p className="reden">{data.hulpvraag}</p>
        </div>
      )}

      {data.deelcontacten.length > 0 && (
        <div className="contactblok">
          <h4><Icoon naam="klembord" grootte={13} /> Wat er is opgeschreven</h4>
          {data.deelcontacten.map((dc) => (
            <div key={dc.id} style={{ marginBottom: 8 }}>
              <span className="merkje" data-toon="neutraal">{dc.episodeIcpc} {dc.episodeTitel}</span>
              <div className="soep" style={{ marginTop: 5 }}>
                {dc.regels.map((r, i) => (
                  <div key={i} className="soepregel">
                    <span className="soepletter" data-letter={r.letter}>{r.letter}</span>
                    <span>{r.tekst}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="contactblok">
        <h4><Icoon naam="meter" grootte={13} /> Wat er is gemeten</h4>
        {data.metingen.length === 0
          ? <span className="mini">Geen metingen bij dit contact.</span>
          : (
            <table className="waardetabel">
              <tbody>
                {data.metingen.map((m) => (
                  <tr key={m.code + m.waarde}>
                    <td>{m.naam}</td>
                    <td className="getal">{m.waarde} {m.eenheid}</td>
                    <td>
                      {/* Eigen registratie of niet: dat bepaalt of de waarde meetelt (ADR-0012). */}
                      <span className="merkje" data-toon={m.eigenRegistratie ? 'ok' : 'aandacht'}>
                        {m.eigenRegistratie ? 'eigen registratie' : m.bron}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      <div className="contactblok">
        <h4><Icoon naam="lijst" grootte={13} /> Wat er is uitgezet</h4>
        {data.orders.length === 0
          ? <span className="mini">Geen orders bij dit contact.</span>
          : data.orders.map((o) => (
            <div key={o.id} className="regel">
              <span className="sleutel">
                {o.omschrijving}
                {o.detail && <div className="mini">{o.detail}</div>}
              </span>
              <span className="waarde">
                <span className="merkje" data-toon="neutraal">{o.soort}</span>{' '}
                <span className="merkje" data-toon={o.status === 'uitgevoerd' ? 'ok' : 'informatief'}>
                  {o.status}
                </span>
              </span>
            </div>
          ))}
      </div>

      {data.verrichtingen.length > 0 && (
        <div className="contactblok">
          <h4><Icoon naam="hart" grootte={13} /> Verrichtingen</h4>
          {data.verrichtingen.map((v) => (
            <div key={v.naam} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>{v.naam}</strong>
              <div className="mini">
                uitgevoerd door {v.uitgevoerdDoor} · beoordeeld: {v.beoordelaar}
              </div>
              {v.waarden.map((w) => (
                <div key={w.naam} className="regel">
                  <span className="sleutel">{w.naam}</span>
                  <span className="waarde">{w.waarde}</span>
                </div>
              ))}
              {v.conclusie && <p className="reden">{v.conclusie}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="contactblok">
        <h4><Icoon naam="schild" grootte={13} /> Administratie en herkomst</h4>
        {data.declaratie ? (
          <div className="regel">
            <span className="sleutel">Declaratie</span>
            <span className="waarde">
              {data.declaratie.code} — {data.declaratie.omschrijving}
              <span className="merkje" data-toon={data.declaratie.declarabel ? 'ok' : 'aandacht'}
                style={{ marginLeft: 6 }}>
                {data.declaratie.declarabel ? 'declarabel' : 'niet declarabel'}
              </span>
              {data.declaratie.ontbreekt && data.declaratie.ontbreekt.length > 0 && (
                <div className="mini">ontbreekt: {data.declaratie.ontbreekt.join(', ')}</div>
              )}
            </span>
          </div>
        ) : <span className="mini">Geen declaratieregel bij dit contact.</span>}
        <div className="regel">
          <span className="sleutel">Herkomst</span>
          <span className="waarde" style={{ fontWeight: 400, fontSize: 12 }}>
            {data.herkomst.bron} · {data.herkomst.auteurRol} · {data.herkomst.vastgelegdOp.slice(0, 16).replace('T', ' ')}
          </span>
        </div>
        <div className="regel">
          <span className="sleutel">Contact-id<div className="mini">verwijzing naar de registratie</div></span>
          <span className="waarde" style={{ fontWeight: 400, fontSize: 12 }}>{data.encounterId}</span>
        </div>
      </div>

      <button className="knop" onClick={opEpisode}>
        <Icoon naam="lijst" grootte={13} /> Alleen deze episode tonen
      </button>
    </div>
  );
}

/**
 * Wat de patiënt zelf heeft vastgelegd.
 *
 * Geen SOEP en geen contact: er is niemand bij geweest. Het staat er omdat het gebeurd is
 * en omdat je het bij de volgende controle wilt kunnen terugzien — met de herkomst erbij,
 * want deze waarden vullen geen ketenindicator (ADR-0012).
 */
function Eigenmetingregel({ meting }: { meting: Eigenmetingdag }) {
  return (
    <div className="journaalregel eigen">
      <div>
        <div className="wanneer">{meting.datum}</div>
        <div className="mini">eigen meting</div>
      </div>
      <div>
        <div className="contactkop">
          <span className="merkje" data-toon="aandacht">door de patiënt</span>
          <span className="mini">{meting.via}</span>
          {meting.bevestigd && <span className="merkje" data-toon="ok">besproken in een contact</span>}
        </div>
        <table className="waardetabel" style={{ marginTop: 6 }}>
          <tbody>
            {meting.metingen.map((m) => (
              <tr key={m.code + m.waarde}>
                <td>{m.naam}</td>
                <td className="getal">{m.waarde} {m.eenheid}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mini" style={{ marginTop: 5 }}>
          Klinisch bruikbaar, maar geen eigen registratie: deze waarden vullen geen
          ketenindicator tot een zorgverlener ze heeft overgenomen.
        </div>
      </div>
    </div>
  );
}

/**
 * Een ingevulde vragenlijst in het journaal.
 *
 * Hij staat op de dag waarop de patiënt hem invulde, niet op de dag van het consult
 * waarin hij is overgenomen — want dat is wanneer hij bestond, en het verschil tussen
 * die twee data is soms de hele vraag ('dit schreef ze al tien dagen voor het gesprek').
 *
 * Of hij is overgenomen staat er met naam bij. Zonder dat kun je later niet zien of de
 * waarden in het dossier uit deze lijst komen of dat ze nog van de patiënt zijn.
 */
function Vragenlijstregel({ inzage, open, opKlik }: {
  inzage: Vragenlijstinzage; open: boolean; opKlik: () => void;
}) {
  return (
    <div className="journaalregel eigen" data-open={open}>
      <div>
        <div className="wanneer">{inzage.ingevuldOp?.slice(0, 10)}</div>
        <div className="mini">vragenlijst</div>
      </div>
      <div>
        <div className="contactkop">
          <span className="merkje" data-toon="aandacht">door de patiënt</span>
          <strong style={{ fontSize: 13 }}>{inzage.naam}</strong>
          <span className="mini">versie {inzage.versie} · {inzage.kanaal}</span>
          {inzage.overgenomenOp
            ? <span className="merkje" data-toon="ok">
                overgenomen door {inzage.overgenomenDoor} op {inzage.overgenomenOp.slice(0, 10)}
              </span>
            : <span className="merkje" data-toon="neutraal">nog niet overgenomen</span>}
        </div>

        {inzage.kernzin && <div className="citaat">“{inzage.kernzin}”</div>}

        {inzage.signalen.length > 0 && (
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            {inzage.signalen.map((sg) => (
              <div key={sg.tekst} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5 }}>
                <ErnstMerk ernst={sg.ernst} /> {sg.tekst}
              </div>
            ))}
          </div>
        )}

        {open && (
          <div className="antwoorden" style={{ marginTop: 10 }}>
            {inzage.rubrieken.map((rubriek) => (
              <div key={rubriek.naam} className="rubriek">
                <h4>{rubriek.naam}</h4>
                {rubriek.regels.map((regel) => (
                  <div key={regel.vraagId} className="regel" data-opvallend={regel.opvallend}>
                    <div className="vraag">{regel.patientTekst ?? regel.tekst}</div>
                    <div className="antwoord">
                      {regel.antwoord || <span className="mini">niet ingevuld</span>}
                      {regel.antwoord && regel.eenheid ? ` ${regel.eenheid}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="knop-rij" style={{ marginTop: 9 }}>
          <button className="knop" data-toon="stil" onClick={opKlik}>
            <Icoon naam="lijst" grootte={12} />
            {open ? ' Antwoorden inklappen' : ' Alle antwoorden tonen'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * De voorbereiding uit de wachtkamer.
 *
 * Een partnerapp heeft een gesprek omgezet naar gestructureerde tekst. Dat is geen consult
 * en geen registratie van ons — het is een suggestie van een externe partij, en zo staat
 * het er ook: zichtbaar in de tijdlijn, met de leverancier erbij, en met de status of een
 * mens het heeft bevestigd.
 */
function Intakeregel({ intake }: { intake: WachtkamerIntake }) {
  return (
    <div className="journaalregel extern">
      <div>
        <div className="wanneer">{intake.opgenomenOp.slice(0, 10)}</div>
        <div className="mini">voorbereiding</div>
      </div>
      <div>
        <div className="contactkop">
          <span className="merkje" data-toon="extern">{intake.app.naam}</span>
          <span className="mini">
            {intake.waar === 'wachtkamer' ? 'in de wachtkamer' : 'thuis voorbereid'}
            {' · '}{Math.round(intake.duurSeconden / 60)} min
          </span>
          <span className="merkje" data-toon={intake.bevestigd ? 'ok' : 'aandacht'}>
            {intake.bevestigd ? 'bevestigd' : 'nog niet bevestigd'}
          </span>
        </div>
        <p className="reden" style={{ fontStyle: 'italic' }}>&bdquo;{intake.hulpvraag}&rdquo;</p>
        <p className="reden">{intake.anamnese}</p>
        {intake.codesuggesties.length > 0 && (
          <div className="chips" style={{ marginTop: 6 }}>
            {intake.codesuggesties.map((c) => (
              <span key={c.icpc} className="merkje" data-toon="informatief">
                {c.icpc} {c.display} · {Math.round(c.vertrouwen * 100)}%
              </span>
            ))}
          </div>
        )}
        <div className="mini" style={{ marginTop: 5 }}>
          Voorbereiding door een ingebedde app. Telt nergens in mee zolang een zorgverlener
          het niet heeft overgenomen.
        </div>
      </div>
    </div>
  );
}

/**
 * Wat er in het teamoverleg over deze patiënt besloten is.
 *
 * Geen SOEP: er is geen patiënt gezien, geen anamnese afgenomen en geen onderzoek
 * gedaan. Er is óver iemand gesproken en daar kwam iets uit. Die vorm — vraag, uitkomst,
 * wie erbij waren — is wat het is, en dat is precies waarom het een eigen soort is en
 * geen consult dat niet heeft plaatsgevonden.
 */
function Overlegregel({ notitie }: { notitie: Overlegnotitie }) {
  return (
    <div className="journaalregel overleg">
      <div>
        <div className="wanneer">{notitie.op.slice(0, 10)}</div>
        <div className="mini">teamoverleg</div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="merkje" data-toon="neutraal">
            <Icoon naam="persoon" grootte={11} /> besproken in het teamoverleg
          </span>
          <span className="mini">{notitie.deelnemers.join(' en ')}</span>
        </div>
        <div className="overlegblok">
          <div className="regel">
            <span className="sleutel">Vraag<div className="mini">ingebracht door {notitie.ingebrachtDoor}</div></span>
            <span className="waarde" style={{ fontWeight: 400, textAlign: 'left', maxWidth: 460 }}>
              {notitie.vraag}
            </span>
          </div>
          {notitie.context && (
            <div className="regel">
              <span className="sleutel">Context</span>
              <span className="waarde" style={{ fontWeight: 400, textAlign: 'left', maxWidth: 460 }}>
                {notitie.context}
              </span>
            </div>
          )}
          <div className="regel">
            <span className="sleutel">Afgesproken<div className="mini">door {notitie.besprokenDoor}</div></span>
            <span className="waarde" style={{ textAlign: 'left', maxWidth: 460 }}>{notitie.uitkomst}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Eén bericht van buiten.
 *
 * Bewust een andere vorm dan een eigen contact: een kop met de bron en de standaard, een
 * samenvatting, en de secties zoals ze binnenkwamen. Het verschil moet je kunnen zien
 * zonder te lezen wie het schreef.
 */
function Externregel({ document, open, opKlik }: {
  document: ExternDocument; open: boolean; opKlik: () => void;
}) {
  const vertraging = Math.round(
    (new Date(document.ontvangenOp).getTime() - new Date(document.datum).getTime()) / 86_400_000);

  return (
    <div className="journaalregel extern" data-open={open}>
      <div>
        <div className="wanneer">{document.datum}</div>
        <div className="mini">{document.bron.soort}</div>
      </div>
      <div>
        <button className="regelknop" onClick={opKlik}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="merkje" data-toon="informatief">
              <Icoon naam="gebouw" grootte={11} /> {document.bron.naam}
            </span>
            <span className="merkje" data-toon="neutraal">{document.uitwisseling}</span>
            {document.opOnzeVerwijzing && (
              <span className="merkje" data-toon="ok">op onze verwijzing</span>
            )}
            {!document.gelezen && <span className="merkje" data-toon="aandacht">nieuw</span>}
            <span className="mini" style={{ marginLeft: 'auto' }}>{open ? 'minder' : 'meer'}</span>
          </div>
          <strong style={{ fontSize: 13, display: 'block', marginTop: 5, textAlign: 'left' }}>
            {document.titel}
          </strong>
        </button>
        <p className="reden" style={{ marginTop: 4 }}>{document.samenvatting}</p>

        {open && (
          <div className="externdetail">
            {document.secties.map((sectie) => (
              <div key={sectie.naam} className="sectie">
                <h4>{sectie.naam}</h4>
                {sectie.regels.map((r) => (
                  <div key={r.label} className="regel">
                    <span className="sleutel">{r.label}</span>
                    <span className="waarde" style={{ fontWeight: 400, textAlign: 'left', maxWidth: 420 }}>
                      {r.waarde}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            <div className="knop-rij" style={{ marginTop: 10 }}>
              {document.bron.portaal && (
                <a className="knop" href={document.bron.portaal.url} target="_blank" rel="noreferrer">
                  <Icoon naam="uitgaand" grootte={13} /> Openen in {document.bron.portaal.naam}
                </a>
              )}
              <span className="mini" style={{ alignSelf: 'center' }}>
                Zorg op {document.datum}, bij ons binnen op {document.ontvangenOp}
                {vertraging > 0 ? ` — ${vertraging} dagen later` : ''}.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MEETSOORTEN = [
  { id: 'lab', label: 'Lab' },
  { id: 'lichamelijk', label: 'Lichamelijk' },
  { id: 'vragenlijst', label: 'Vragenlijsten' },
  { id: 'verrichting', label: 'Verrichtingen' },
] as const;

/**
 * MEETWAARDEN
 *
 * Twee manieren van kijken, want er zijn twee vragen. "Hoe loopt dit?" beantwoord je met
 * een grafiek; "wat stond er in die uitslag van maart?" met een tabel. Eén weergave
 * dwingt je steeds de verkeerde te gebruiken.
 *
 * Het filter op soort is er omdat een dossier van tien jaar al snel dertig reeksen heeft.
 * Lab wil je los kunnen zien van bloeddrukken en vragenlijstscores — die lees je anders
 * en je zoekt ze op een ander moment.
 */
function Metingen({ patientId, gekozen, opKies }: {
  patientId: string; gekozen?: string; opKies: (code: string) => void;
}) {
  const { data, fout, bezig } = useData(() => api.meetreeksen(patientId), [patientId]);
  const [soorten, setSoorten] = useState<string[]>([]);
  const [weergave, setWeergave] = useState<'beloop' | 'tabel' | 'labblad'>('beloop');

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Meetwaarden" />;

  const zichtbaar = soorten.length === 0 ? data : data.filter((m) => soorten.includes(m.soort));
  const actief: Meetreeks | undefined =
    zichtbaar.find((m) => m.code === gekozen)
    ?? zichtbaar.find((m) => m.punten.length > 1) ?? zichtbaar[0];

  return (
    <div className="raster2" style={{ gridTemplateColumns: '300px minmax(0, 1fr)' }}>
      <Kaart titel="Alle meetwaarden" icoon="buisje" telling={`${zichtbaar.length}/${data.length}`} strak>
        <div className="body" style={{ paddingBottom: 8 }}>
          <div className="chips">
            <button className="filterchip" data-actief={soorten.length === 0}
              onClick={() => setSoorten([])}>Alles</button>
            {MEETSOORTEN.map((s) => {
              const aantal = data.filter((m) => m.soort === s.id).length;
              if (aantal === 0) return null;
              return (
                <button key={s.id} className="filterchip" data-actief={soorten.includes(s.id)}
                  onClick={() => setSoorten((h) =>
                    h.includes(s.id) ? h.filter((x) => x !== s.id) : [...h, s.id])}>
                  {s.label} <span className="mini">{aantal}</span>
                </button>
              );
            })}
          </div>
        </div>
        <table>
          <tbody>
            {zichtbaar.map((m) => (
              <tr key={m.code}>
                <td style={{ padding: 0 }}>
                  <button className="gesprekknop" data-actief={actief?.code === m.code}
                    onClick={() => opKies(m.code)}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <strong style={{ fontSize: 13, flex: 1 }}>{m.naam}</strong>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {m.laatste ?? '—'}
                      </span>
                    </div>
                    <div className="mini" style={{ display: 'flex', gap: 7, marginTop: 2 }}>
                      <span>{m.laatsteOp}</span>
                      <span>·</span>
                      <span>{m.punten.length} metingen</span>
                      {m.relevantNu && <span className="merkje" data-toon="informatief">nu relevant</span>}
                    </div>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>

      <div>
        <div className="segment" style={{ marginBottom: 12, maxWidth: 380 }}>
          <button data-actief={weergave === 'beloop'} onClick={() => setWeergave('beloop')}>
            <Icoon naam="grafiek" grootte={13} /> beloop
          </button>
          <button data-actief={weergave === 'tabel'} onClick={() => setWeergave('tabel')}>
            <Icoon naam="tabel" grootte={13} /> deze reeks
          </button>
          <button data-actief={weergave === 'labblad'} onClick={() => setWeergave('labblad')}>
            <Icoon naam="buisje" grootte={13} /> labblad
          </button>
        </div>

        {weergave === 'labblad' && <Labtabel reeksen={data} />}

        {weergave !== 'labblad' && actief && (
          <Kaart titel={actief.naam} icoon={weergave === 'tabel' ? 'tabel' : 'grafiek'}
            telling={actief.eenheid ? actief.eenheid : undefined}>
            {weergave === 'beloop' ? (
              <>
                <Trendgrafiek punten={actief.punten} eenheid={actief.eenheid} streef={actief.streef} />
                {actief.streef && (
                  <div className="mini" style={{ marginTop: 8 }}>
                    Referentie: {actief.streef.label}. De stippellijn in de grafiek.
                  </div>
                )}
                {actief.verschil !== undefined && (
                  <div style={{ marginTop: 10 }}>
                    <span className="merkje"
                      data-toon={Math.abs(actief.verschil) > 0 ? 'informatief' : 'neutraal'}>
                      {actief.verschil > 0 ? '+' : ''}{actief.verschil} ten opzichte van de vorige meting
                    </span>
                  </div>
                )}
              </>
            ) : (
              <table className="waardetabel">
                <thead>
                  <tr><th>Datum</th><th className="rechts">Waarde</th><th className="rechts">Verschil</th></tr>
                </thead>
                <tbody>
                  {[...actief.punten].reverse().map((punt, i, lijst) => {
                    const vorige = lijst[i + 1];
                    const verschil = vorige
                      ? Math.round((punt.waarde - vorige.waarde) * 10) / 10 : undefined;
                    return (
                      <tr key={punt.op}>
                        <td>{punt.op}</td>
                        <td className="rechts getal">{punt.waarde} {actief.eenheid}</td>
                        <td className="rechts getal mini">
                          {verschil === undefined ? '—' : `${verschil > 0 ? '+' : ''}${verschil}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Kaart>
        )}

        {weergave !== 'labblad' && !actief && (
          <Leeg tekst="Geen meetwaarden in deze selectie." />
        )}
      </div>
    </div>
  );
}

/**
 * Het labblad: alle bepalingen naast elkaar, per afnamedatum.
 *
 * Dit is hoe een uitslag binnenkomt en hoe een arts hem leest — per kolom één prik, niet
 * per bepaling een losse grafiek. De laatste twaalf afnamemomenten, want verder terug
 * kijk je zelden en dan is de grafiek beter.
 */
function Labtabel({ reeksen }: { reeksen: Meetreeks[] }) {
  const lab = reeksen.filter((m) => m.soort === 'lab');
  const datums = [...new Set(lab.flatMap((m) => m.punten.map((p) => p.op)))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 12);

  if (lab.length === 0) return <Leeg tekst="Geen labwaarden in dit dossier." />;

  return (
    <Kaart titel="Labblad" icoon="tabel" telling={`${lab.length} bepalingen`}>
      <p className="reden" style={{ marginTop: 0 }}>
        Alle bepalingen per afnamemoment, nieuwste links. Een waarde buiten de referentie
        staat gemarkeerd; de referentie zelf staat achter de naam.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="waardetabel">
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>Bepaling</th>
              {datums.map((d) => (
                <th key={d} className="rechts" title={d}>
                  {`${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(2, 4)}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lab.map((m) => (
              <tr key={m.code}>
                <td>
                  {m.naam}
                  <div className="mini">{m.eenheid}{m.streef ? ` · ${m.streef.label}` : ''}</div>
                </td>
                {datums.map((d) => {
                  const punt = m.punten.find((p) => p.op === d);
                  const buiten = punt && m.streef && (
                    (m.streef.boven !== undefined && punt.waarde > m.streef.boven)
                    || (m.streef.onder !== undefined && punt.waarde < m.streef.onder));
                  return (
                    <td key={d} className="rechts getal" data-buiten={buiten ? 'true' : undefined}>
                      {punt ? punt.waarde : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kaart>
  );
}

/**
 * Vastleggen tijdens het consult.
 *
 * De velden staan niet leeg: het systeem weet welke metingen dit contact vraagt, en wat
 * de wachtkamer-intake heeft opgeleverd staat er al in. Een nieuwe episode openen kan
 * hier ook — je hoeft geen tweede consult te starten omdat de klacht ergens anders bij
 * hoort.
 */
function Registreren({
  patientId, overzicht, gebruiker, registratie, ordersVandaag, opOrder, opWijzig, opKlaar,
}: {
  patientId: string;
  overzicht: PatientOverzicht;
  gebruiker: Gebruiker;
  registratie: Registratie;
  /** Wat er tijdens dit consult al besteld is; komt onder P te staan. */
  ordersVandaag: NieuweOrder[];
  opOrder: () => void;
  opWijzig: (nieuw: Registratie) => void;
  opKlaar: (nieuw: PatientOverzicht, uitkomst: RegistratieUitkomst) => void;
}) {
  // Géén gepland contact betekent niet: geen contact mogelijk. Dat was precies de reden
  // dat je bij een patiënt zonder zorgplan niets kon vastleggen — terwijl dat juist de
  // patiënt is die zomaar binnenloopt.
  const contact = overzicht.zorgplan.contacten[0];
  const [bezig, setBezig] = useState(false);
  const [nieuweEpisode, setNieuweEpisode] = useState(false);
  const [contactvorm, setContactvorm] = useState<Contactvorm>('consult');
  const [duurMinuten, setDuurMinuten] = useState(15);
  const [zoek, setZoek] = useState('');
  const [treffers, setTreffers] = useState<Treffer[]>([]);

  const alles: GeplandItem[] = contact?.metingen ?? [];
  const handmatig = alles.filter((m) => m.invoer.soort !== 'vragenlijst');
  const viaVragenlijst = alles.filter((m) => m.invoer.soort === 'vragenlijst');
  const ingevuld = handmatig.filter((m) => (registratie.waarden[m.code] ?? '').trim() !== '');
  const soepGevuld = Object.values(registratie.soep).some((t) => (t ?? '').trim() !== '');
  // Een contact zonder meting is een echt contact. Een telefoontje over de uitslag heeft
  // geen enkele meetwaarde en hoort wel in het dossier te staan.
  const ietsIngevuld = ingevuld.length > 0 || soepGevuld;
  const episodeId = registratie.episodeId || overzicht.episodes[0]?.id || '';

  const zet = (deel: Partial<Registratie>) => opWijzig({ ...registratie, ...deel });

  const zoekCode = async (q: string) => {
    setZoek(q);
    if (q.trim().length < 2) { setTreffers([]); return; }
    const uitkomst = await api.zoekTerm(q, false);
    setTreffers(uitkomst.treffers.slice(0, 6));
  };

  const maakEpisode = async (treffer: Treffer) => {
    setBezig(true);
    try {
      const antwoord = await api.maakEpisode(patientId, {
        icpc: treffer.concept.icpc1 ?? '',
        snomed: treffer.concept.snomed,
        display: treffer.concept.display,
      });
      zet({ episodeId: antwoord.episodeId });
      setNieuweEpisode(false);
      setZoek(''); setTreffers([]);
      opKlaar(antwoord.overzicht, {
        vastgelegd: [], verantwoordingGevuld: [],
        vervolg: [`Nieuwe episode geopend: ${treffer.concept.display}. Dit consult valt er nu onder.`],
      });
    } finally { setBezig(false); }
  };

  const afronden = async () => {
    setBezig(true);
    try {
      const metingen = ingevuld.map((m) => {
        const ruw = registratie.waarden[m.code];
        const bron = registratie.bronnen[m.code] ?? 'praktijk';
        if (m.invoer.soort === 'keuze') {
          const optie = m.invoer.opties.find((o) => o.code === ruw);
          return { code: m.code, keuze: { code: ruw, display: optie?.label }, bron };
        }
        if (m.invoer.soort === 'verrichting') return { code: m.code, waarde: 1, bron };
        return { code: m.code, waarde: Number(ruw), bron };
      });
      const antwoord = await api.consult(patientId, {
        metingen, soep: registratie.soep, episodeId: episodeId || undefined,
        gebruikerId: gebruiker.id, contactvorm, duurMinuten,
      });
      opWijzig({ waarden: {}, bronnen: {}, soep: {}, episodeId: '', suggestieCodes: [] });
      opKlaar(antwoord.overzicht, antwoord.uitkomst);
    } finally { setBezig(false); }
  };

  return (
    <Kaart titel="Vastleggen" icoon="klembord" telling={`${ingevuld.length}/${handmatig.length} ingevuld`}>
      <p className="reden" style={{ marginTop: 0 }}>
        {handmatig.length > 0
          ? 'Deze metingen horen bij het contact van vandaag. Je registreert één keer; de '
            + 'ketenverantwoording en de planning volgen er automatisch uit.'
          : 'Het protocol vraagt op dit moment geen metingen bij deze patiënt. Je legt hier '
            + 'gewoon een contact vast: kies de vorm, hang het aan een episode en schrijf de SOEP.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 11, marginBottom: 14 }}>
        {handmatig.map((m) => (
          <div key={m.code}>
            <label className="veld">
              {m.naam}
              {m.invoer.soort === 'getal' && m.invoer.eenheid && <span className="mini"> ({m.invoer.eenheid})</span>}
              {m.laatsteWaarde !== undefined && (
                <span className="mini"> · was {m.laatsteWaarde} op {m.laatsteOp}</span>
              )}
            </label>

            {m.invoer.soort === 'keuze' && (
              <select value={registratie.waarden[m.code] ?? ''}
                onChange={(e) => zet({ waarden: { ...registratie.waarden, [m.code]: e.target.value } })}>
                <option value="">— kies —</option>
                {m.invoer.opties.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select>
            )}
            {m.invoer.soort === 'verrichting' && (
              <button className="knop" style={{ width: '100%' }}
                data-toon={registratie.waarden[m.code] ? 'primair' : undefined}
                onClick={() => zet({
                  waarden: { ...registratie.waarden, [m.code]: registratie.waarden[m.code] ? '' : 'verricht' },
                })}>
                <Icoon naam="vink" grootte={13} /> {registratie.waarden[m.code] ? 'Verricht' : 'Markeer als verricht'}
              </button>
            )}
            {m.invoer.soort === 'getal' && (
              <input type="number" inputMode="decimal" value={registratie.waarden[m.code] ?? ''}
                placeholder={m.laatsteWaarde !== undefined ? String(m.laatsteWaarde) : '—'}
                onChange={(e) => zet({ waarden: { ...registratie.waarden, [m.code]: e.target.value } })} />
            )}

            {(registratie.waarden[m.code] ?? '').trim() !== '' && (
              <div className="bronkeuze">
                <button data-actief={(registratie.bronnen[m.code] ?? 'praktijk') === 'praktijk'}
                  onClick={() => zet({ bronnen: { ...registratie.bronnen, [m.code]: 'praktijk' } })}
                  title="Jij legt deze waarde vast en neemt hem voor je rekening">
                  hier gemeten
                </button>
                <button data-actief={registratie.bronnen[m.code] === 'patient'}
                  onClick={() => zet({ bronnen: { ...registratie.bronnen, [m.code]: 'patient' } })}
                  title="Blijft zichtbaar met de patiënt als bron; vult geen ketenindicator">
                  door patiënt
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {Object.values(registratie.bronnen).includes('patient') && (
        <div className="notitie" style={{ marginBottom: 12 }}>
          <strong>Eén of meer waarden staan op “door patiënt”.</strong> Die blijven in het
          dossier staan met de patiënt als bron en zijn overal als zodanig herkenbaar — maar
          ze vullen geen ketenindicator, want het is jouw registratie niet. Zet hem op
          “hier gemeten” als je hem overneemt.
        </div>
      )}

      {viaVragenlijst.length > 0 && (
        <div className="mini" style={{ marginBottom: 12, display: 'flex', gap: 7, alignItems: 'center' }}>
          <Icoon naam="gesprek" grootte={13} />
          {viaVragenlijst.map((m) => m.naam).join(', ')} komt binnen via de vragenlijst.
        </div>
      )}

      {/*
        De contactvorm hoort hier en niet bij de declaratie achteraf. Hij is nú bekend;
        wie hem later moet reconstrueren, gokt. En het verschil is echt: een videoconsult
        en een telefoontje leveren een andere prestatie op en een andere zekerheid over
        met wie je sprak (docs/19).
      */}
      <label className="veld">Contactvorm</label>
      <div className="chips" style={{ marginBottom: 10 }}>
        {VORMEN.map((v) => (
          <button key={v.id} className="filterchip" data-actief={contactvorm === v.id}
            title={v.uitleg} onClick={() => setContactvorm(v.id)}>
            <Icoon naam={v.icoon} grootte={12} /> {v.label}
          </button>
        ))}
      </div>

      {DUURVORMEN.includes(contactvorm) && (
        <>
          <label className="veld">Duur</label>
          <div className="segment" style={{ marginBottom: 10 }}>
            {[5, 10, 15, 20, 30].map((n) => (
              <button key={n} data-actief={duurMinuten === n} onClick={() => setDuurMinuten(n)}>
                {n} min
              </button>
            ))}
          </div>
        </>
      )}

      <label className="veld">Episode</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={episodeId} onChange={(e) => zet({ episodeId: e.target.value })}>
          {/* Zonder episodes is er niets te kiezen, en dan moet dat er staan in plaats van
              een leeg keuzemenu dat lijkt alsof het laadt. */}
          {overzicht.episodes.length === 0 && (
            <option value="">— nog geen episode; maak er een aan —</option>
          )}
          {overzicht.episodes.map((e) => (
            <option key={e.id} value={e.id}>{e.icpc} — {e.titel}</option>
          ))}
        </select>
        <button className="knop" onClick={() => setNieuweEpisode(!nieuweEpisode)}>
          <Icoon naam={nieuweEpisode ? 'kruis' : 'plus'} grootte={13} />
          {nieuweEpisode ? 'Annuleren' : 'Nieuwe episode'}
        </button>
      </div>

      {nieuweEpisode && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <label className="veld">Zoek een diagnose of klacht</label>
          <input type="search" value={zoek} autoFocus
            placeholder="Bijvoorbeeld 'hoesten' of 'R95'"
            onChange={(e) => zoekCode(e.target.value)} />
          {registratie.suggestieCodes.length > 0 && zoek.length < 2 && (
            <div style={{ marginTop: 9 }}>
              <div className="mini" style={{ marginBottom: 5 }}>Suggesties uit de wachtkamer-intake</div>
              <div className="chips">
                {registratie.suggestieCodes.map((c) => (
                  <button key={c.icpc} className="knop" style={{ padding: '3px 10px', fontSize: 12 }}
                    onClick={() => zoekCode(c.display)}>
                    {c.icpc} {c.display}
                  </button>
                ))}
              </div>
            </div>
          )}
          {treffers.length > 0 && (
            <div style={{ marginTop: 9 }}>
              {treffers.map((t) => (
                <button key={t.concept.snomed} className="gesprekknop" disabled={bezig}
                  onClick={() => maakEpisode(t)}>
                  <strong style={{ fontSize: 13 }}>{t.concept.display}</strong>
                  <div className="mini">
                    ICPC {t.concept.icpc1 ?? '—'} · SNOMED {t.concept.snomed}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {([['S', 'Subjectief — wat vertelt de patiënt'], ['O', 'Objectief — wat zie en meet je'],
           ['E', 'Evaluatie — wat is je conclusie'], ['P', 'Plan — wat spreek je af']] as const)
          .map(([letter, uitleg]) => (
          <Soepveld key={letter} letter={letter} uitleg={uitleg}
            waarde={registratie.soep[letter] ?? ''}
            opWijzig={(nieuw) => zet({ soep: { ...registratie.soep, [letter]: nieuw } })} />
        ))}
      </div>
      <p className="mini" style={{ marginTop: 6 }}>
        Typ een afkorting (<code>con</code>, <code>gb</code>, <code>lst</code>) en druk op Tab
        om hem af te maken, of dicteer met de microfoonknop.
      </p>

      {/*
        Het plan is de plek waar het consult de praktijk verlaat. Vrije tekst blijft,
        want een afspraak met een mens laat zich niet in een keuzelijst persen — maar
        wat een order ís, hoort een order te worden en niet een zin die niemand uitvoert.
      */}
      <div className="planbouw">
        <div className="mini" style={{ marginBottom: 6 }}>Plan aanvullen</div>
        <div className="chips">
          {PLANZINNEN.map((zin) => (
            <button key={zin} className="filterchip"
              onClick={() => zet({
                soep: {
                  ...registratie.soep,
                  P: [registratie.soep.P, zin].filter(Boolean).join('. '),
                },
              })}>
              <Icoon naam="plus" grootte={12} /> {zin}
            </button>
          ))}
          <button className="filterchip" data-nadruk="true" onClick={opOrder}>
            <Icoon naam="uitgaand" grootte={12} /> Order plaatsen
          </button>
        </div>

        {ordersVandaag.length > 0 && (
          <div className="planorders">
            <div className="mini" style={{ marginBottom: 6 }}>
              Wat je vandaag besteld hebt — hangt straks aan dit deelcontact
            </div>
            <ol className="orderlijst">
              {ordersVandaag.map((o, i) => (
                <li key={i}>
                  <span className="soortmerk" data-soort={o.soort}>
                    <Icoon naam={PLAN_ICOON[o.soort] ?? 'doel'} grootte={12} />
                  </span>
                  <span>
                    <strong>{o.omschrijving}</strong>
                    {o.detail ? <> — {o.detail}</> : null}
                    <div className="mini">
                      {o.route ?? o.soort}
                      {o.planroute ? ` · ${ROUTE_KORT[o.planroute] ?? o.planroute}` : ''}
                    </div>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {registratie.suggestieCodes.length > 0 && (
        <div style={{ marginTop: 11 }}>
          <div className="mini" style={{ marginBottom: 5 }}>
            Codesuggesties uit de intake — klik om als evaluatie over te nemen
          </div>
          <div className="chips">
            {registratie.suggestieCodes.map((c) => (
              <button key={c.icpc} className="knop" style={{ padding: '3px 10px', fontSize: 12 }}
                onClick={() => zet({
                  soep: {
                    ...registratie.soep,
                    E: [registratie.soep.E, `${c.icpc} ${c.display}`].filter(Boolean).join('; '),
                  },
                })}>
                <Icoon naam="plus" grootte={12} /> {c.icpc} {c.display}
              </button>
            ))}
          </div>
        </div>
      )}

      <Declaratievoorbeeld vorm={contactvorm} duurMinuten={duurMinuten}
        heeftSoep={Object.values(registratie.soep).some((t) => (t ?? '').trim() !== '')}
        heeftEpisode={Boolean(episodeId)} />

      <div className="knop-rij" style={{ marginTop: 14 }}>
        <button className="knop" data-toon="primair" disabled={bezig || !ietsIngevuld}
          onClick={afronden}>
          <Icoon naam="vink" grootte={13} /> Contact vastleggen
        </button>
        <span className="mini" style={{ alignSelf: 'center' }}>
          {ietsIngevuld
            ? 'Indicatoren en planning volgen automatisch.'
            : 'Vul een meting in of schrijf minstens één SOEP-regel.'}
        </span>
      </div>
    </Kaart>
  );
}
