import { useEffect, useState, type ReactNode } from 'react';
import { Icoon, icoonVanModule } from './iconen';
import {
  api,
  MODULE_NAAM,
  type AgendaRegel, type Beleidsafspraak, type Ernst, type ModuleChip, type Signaal,
  type Bereikbaarheid, type Bereikbaarheidskanaal,
  type Suggestie, type Takenoverzicht, type Vragenlijstinzage, type WachtkamerIntake,
} from './api';

export function Kaart({ titel, icoon, telling, extra, strak, children }: {
  titel?: string; icoon?: string; telling?: ReactNode; extra?: ReactNode;
  strak?: boolean; children: ReactNode;
}) {
  return (
    <section className="kaart">
      {titel && (
        <header>
          {icoon && <span style={{ color: 'var(--ink-3)' }}><Icoon naam={icoon} /></span>}
          <h2>{titel}</h2>
          {extra}
          {telling !== undefined && <span className="telling">{telling}</span>}
        </header>
      )}
      <div className={strak ? 'body strak' : 'body'}>{children}</div>
    </section>
  );
}

/** Chip voor een aandachtsgebied. Kleur + icoon + tekst, altijd alle drie. */
export function ModuleChipje({ module, kort = true }: { module: ModuleChip; kort?: boolean }) {
  return (
    <span className={`chip mod-${module.id}`}>
      <Icoon naam={icoonVanModule(module.id, module.icoon)} grootte={13} />
      {kort ? (MODULE_NAAM[module.id] ?? module.naam) : module.naam}
    </span>
  );
}

export function ModuleChips({ modules, leegTekst = 'geen aandachtsgebieden' }: {
  modules: ModuleChip[]; leegTekst?: string;
}) {
  if (modules.length === 0) return <span className="mini">{leegTekst}</span>;
  return <span className="chips">{modules.map((m) => <ModuleChipje key={m.id} module={m} />)}</span>;
}

export function ModuleIdChips({ ids }: { ids: string[] }) {
  return (
    <span className="chips">
      {ids.map((id) => (
        <span key={id} className={`chip mod-${id}`}>
          <Icoon naam={icoonVanModule(id)} grootte={13} />
          {MODULE_NAAM[id] ?? id}
        </span>
      ))}
    </span>
  );
}

const ERNST_LABEL: Record<Ernst, string> = { urgent: 'urgent', aandacht: 'aandacht', informatief: 'info' };

export function ErnstMerk({ ernst }: { ernst: Ernst }) {
  return <span className="merkje" data-toon={ernst}>{ERNST_LABEL[ernst]}</span>;
}

export function Signalen({ signalen }: { signalen: Signaal[] }) {
  if (signalen.length === 0) return <span className="mini">geen bijzonderheden</span>;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {signalen.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
          <ErnstMerk ernst={s.ernst} />
          <span style={{ fontSize: 12.5 }}>{s.tekst}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Eén suggestie van de beslissingsondersteuning.
 *
 * De volgorde is niet toevallig: eerst de bevinding (de feiten), dan waarom dat ertoe
 * doet, dan pas de knoppen. Zo kun je het oordeel narekenen voordat je het overneemt.
 * Onderaan staan altijd de herkomst en de regelversie — zonder dat is een advies niet
 * verantwoordbaar (docs/adr/ADR-0005).
 */
export function SuggestieKaart({ suggestie, bezig, opActie }: {
  suggestie: Suggestie;
  bezig?: boolean;
  opActie: (actieId: string) => void;
}) {
  return (
    <article className="suggestie" data-ernst={suggestie.ernst} data-klasse={suggestie.klasse}>
      <div className="kop">
        <span style={{ color: suggestie.klasse === 'logistiek' ? 'var(--ok)' : 'var(--ink-2)' }}>
          <Icoon naam={suggestie.klasse === 'logistiek' ? 'bliksem' : 'gesprek'} />
        </span>
        <h3>{suggestie.titel}</h3>
        <ErnstMerk ernst={suggestie.ernst} />
        {suggestie.klasse === 'logistiek'
          ? <span className="merkje" data-toon="ok">kan automatisch</span>
          : <span className="merkje" data-toon="neutraal">jouw beslissing</span>}
        {suggestie.rol !== 'poh-s' && (
          <span className="merkje" data-toon="neutraal">via {suggestie.rol}</span>
        )}
      </div>

      <div className="bevinding">{suggestie.bevinding}</div>
      <div className="waarom">{suggestie.onderbouwing}</div>

      <div className="knop-rij">
        {suggestie.acties.map((actie) => (
          <button key={actie.id} className="knop" disabled={bezig}
            data-toon={actie.aard === 'primair' ? 'primair' : actie.aard === 'afwijzen' ? 'stil' : undefined}
            title={actie.gevolg}
            onClick={() => opActie(actie.id)}>
            {actie.aard === 'primair' && <Icoon naam="vink" grootte={13} />}
            {actie.label}
          </button>
        ))}
      </div>

      {suggestie.acties[0] && <div className="gevolg">{suggestie.acties[0].gevolg}</div>}

      <div className="bron">
        {suggestie.richtlijn && (
          <span>
            Gebaseerd op{' '}
            {suggestie.richtlijn.url
              ? (
                <a className="bronlink" href={suggestie.richtlijn.url} target="_blank" rel="noreferrer">
                  {suggestie.richtlijn.naam}
                  <Icoon naam="pijl" grootte={11} />
                </a>
              )
              : suggestie.richtlijn.naam}
            {suggestie.richtlijn.versie ? ` (${suggestie.richtlijn.versie})` : ''}
            {suggestie.richtlijn.paragraaf ? ` — ${suggestie.richtlijn.paragraaf}` : ''}
          </span>
        )}
        <span>regel {suggestie.regelId} · versie {suggestie.regelVersie}</span>
      </div>
    </article>
  );
}

export function Laden({ wat }: { wat: string }) {
  return <div className="leeg">{wat} wordt geladen…</div>;
}

export function Fout({ boodschap }: { boodschap: string }) {
  return (
    <div className="notitie" data-toon="waarschuwing">
      <strong>Kan de gegevens niet ophalen.</strong> {boodschap}
      <br />Draait de API? Start hem met <code>npm run api</code>.
    </div>
  );
}

export function Leeg({ tekst }: { tekst: string }) {
  return <div className="leeg">{tekst}</div>;
}

/** De dag als tijdlijn. Blokken en patiëntafspraken door elkaar, zoals de dag echt loopt. */
/**
 * De status van een afspraak, als merkje.
 *
 * Dit is het antwoord op de vraag die de hele ochtend gesteld wordt: zit hij er al?
 * Kleur alleen is niet genoeg, dus er staat altijd tekst in. En 'gepland' krijgt geen
 * merkje: dat is de rusttoestand en een merkje bij alles is een merkje bij niets.
 */
const STATUS_TOON: Record<string, string> = {
  aangemeld: 'informatief', wachtkamer: 'ok', 'in-consult': 'informatief',
  afgerond: 'neutraal', noshow: 'urgent',
};

export function Statusmerk({ regel }: { regel: AgendaRegel }) {
  if (regel.status === 'gepland' || !regel.patientId) return null;
  return (
    <span className="statusmerk" data-status={regel.status} data-toon={STATUS_TOON[regel.status]}>
      <i />
      {regel.statusLabel}
      {regel.status === 'aangemeld' || regel.status === 'wachtkamer'
        ? regel.aangemeldOm ? ` ${regel.aangemeldOm}` : ''
        : ''}
    </span>
  );
}

export function Agenda({ regels, openPatient, opStatus }: {
  regels: AgendaRegel[];
  openPatient?: (id: string) => void;
  /** Handmatig corrigeren wat de zuil niet weet: iemand meldt zich aan de balie of komt niet. */
  opStatus?: (afspraakId: string, status: string) => void;
}) {
  if (regels.length === 0) return <Leeg tekst="Geen afspraken vandaag." />;
  return (
    <div className="agenda">
      {regels.map((r) => {
        // De hele regel is de knop, niet alleen de naam: je klikt op een afspraak, niet op tekst.
        const klikbaar = Boolean(r.patientId && openPatient);
        return (
        <div key={r.id} className="regel" data-soort={r.soort} data-aandacht={Boolean(r.aandacht)}
          data-status={r.status} data-klikbaar={klikbaar}
          role={klikbaar ? 'button' : undefined} tabIndex={klikbaar ? 0 : undefined}
          onClick={klikbaar ? () => openPatient!(r.patientId!) : undefined}
          onKeyDown={klikbaar
            ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPatient!(r.patientId!); } }
            : undefined}>
          <span className="klok">{r.tijd}</span>
          <span className="streep" />
          <div>
            <div className="wie">{r.naam ?? r.titel}</div>
            <div className="bij">
              {r.naam ? `${r.leeftijd} jaar · ${r.reden ?? r.titel}` : (r.reden ?? `${r.duurMinuten} minuten`)}
            </div>
            {r.modules.length > 0 && (
              <div style={{ marginTop: 5 }}><ModuleChips modules={r.modules} /></div>
            )}
            {r.aandacht && (
              <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
                <span style={{ color: 'var(--aandacht)' }}><Icoon naam="waarschuwing" grootte={13} /></span>
                {r.aandacht}
              </div>
            )}
          </div>
          <div className="rechts">
            <span className="duur">{r.duurMinuten} min</span>
            <Statusmerk regel={r} />
            {r.intakeKlaar && <span className="merkje" data-toon="informatief">intake klaar</span>}
            {r.voorbereid === false && <span className="merkje" data-toon="aandacht">niet compleet</span>}
            {r.voorbereid === true && <span className="merkje" data-toon="ok">voorbereid</span>}
            {opStatus && r.patientId && r.status !== 'afgerond' && (
              <select className="statuskeuze" value={r.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); opStatus(r.id, e.target.value); }}>
                <option value="gepland">gepland</option>
                <option value="aangemeld">aangemeld</option>
                <option value="wachtkamer">in de wachtkamer</option>
                <option value="in-consult">in consult</option>
                <option value="afgerond">afgerond</option>
                <option value="noshow">niet verschenen</option>
              </select>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

const BELEIDSLABEL: Record<string, string> = {
  reanimatie: 'Reanimatie', ziekenhuisopname: 'Ziekenhuisopname', 'ic-opname': 'IC-opname',
  antibiotica: 'Antibiotica', wilsverklaring: 'Wilsverklaring',
  vertegenwoordiger: 'Vertegenwoordiger', donorregistratie: 'Donorregistratie',
};

/**
 * Behandelgrenzen, boven het dossier.
 *
 * "Niet reanimeren" moet je zien vóórdat je iets doet, niet nadat je hebt gezocht. Als
 * het tussen de andere regels staat, wordt het niet gelezen — en dan is de afspraak er
 * wel maar werkt hij niet. Daarom een band die niet weg te klikken is, met wie het
 * besloot en wanneer, want een afspraak van acht jaar geleden vraagt om herbevestiging.
 */
export function Beleidsband({ afspraken, peiljaar }: {
  afspraken: Beleidsafspraak[]; peiljaar?: number;
}) {
  if (afspraken.length === 0) return null;
  const waarschuwend = afspraken.filter(
    (a) => a.besluit === 'niet' || (a.soort === 'reanimatie' && a.besluit !== 'wel'));
  if (waarschuwend.length === 0) {
    return (
      <div className="beleidsband" data-toon="neutraal">
        <span className="kop"><Icoon naam="schild" grootte={14} /> Behandelwensen vastgelegd</span>
        {afspraken.map((a) => (
          <span key={a.id} className="punt">
            <strong>{BELEIDSLABEL[a.soort] ?? a.soort}:</strong> {a.samenvatting}
            <span className="mini"> · {a.vastgelegdOp}, met {a.besprokenMet}</span>
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="beleidsband" data-toon="grens">
      <span className="kop"><Icoon naam="beperking" grootte={14} /> Behandelgrens</span>
      {afspraken.map((a) => {
        const jaren = peiljaar ? peiljaar - Number(a.vastgelegdOp.slice(0, 4)) : 0;
        return (
          <span key={a.id} className="punt">
            <strong>{BELEIDSLABEL[a.soort] ?? a.soort}:</strong> {a.samenvatting}
            <span className="mini">
              {' '}· vastgelegd {a.vastgelegdOp} door {a.vastgelegdDoor.naam}, besproken met {a.besprokenMet}
              {jaren >= 2 ? ` — ${jaren} jaar oud, herbevestigen` : ''}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Zelfredzaamheid als getal én als balk — het getal alleen zegt te weinig. */
export function Zelfredzaamheidsmeter({ gemiddelde, niveau, richting, compact }: {
  gemiddelde: number; niveau: string; richting?: string; compact?: boolean;
}) {
  return (
    <span className="zrm" data-niveau={niveau}>
      <span className="cijfer">{gemiddelde.toFixed(1)}</span>
      {!compact && <span className="van">van 5</span>}
      <span className="balk"><i style={{ width: `${(gemiddelde / 5) * 100}%` }} /></span>
      {!compact && <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{niveau}</span>}
      {richting === 'achteruit' && <span className="merkje" data-toon="aandacht">gedaald</span>}
      {richting === 'vooruit' && <span className="merkje" data-toon="ok">vooruit</span>}
    </span>
  );
}

/**
 * Wat een ingebedde partnerapp heeft opgeleverd.
 *
 * Het voelt als eigen functionaliteit — zelfde vormtaal, zelfde plek in het scherm —
 * maar de herkomst blijft zichtbaar en niets telt mee zonder bevestiging. Naadloos mag
 * niet betekenen: niet meer te zien waar het vandaan komt.
 */
export function IntakeKaart({ intake, bezig, opBevestig, opBewaarAlsMelding }: {
  intake: WachtkamerIntake; bezig?: boolean; opBevestig?: () => void;
  opBewaarAlsMelding?: () => void;
}) {
  return (
    <div className="intake">
      <div className="kop">
        <span style={{ color: 'var(--merk)' }}><Icoon naam="gesprek" /></span>
        <h3>Voorbereiding uit de wachtkamer</h3>
        <span className="merkje" data-toon="neutraal">{intake.app.naam}</span>
        {intake.bevestigd
          ? <span className="merkje" data-toon="ok">bevestigd</span>
          : <span className="merkje" data-toon="aandacht">nog niet bevestigd</span>}
        <span className="mini" style={{ marginLeft: 'auto' }}>
          {intake.opgenomenOp.slice(11, 16)} · {Math.round(intake.duurSeconden / 60)} min gesprek
        </span>
      </div>

      <div className="citaat">“{intake.hulpvraag}”</div>
      <div className="anamnese">{intake.anamnese}</div>

      {intake.codesuggesties.length > 0 && (
        <div style={{ marginTop: 11 }}>
          <div className="mini" style={{ marginBottom: 5 }}>Codesuggesties — jij bepaalt wat er landt</div>
          <div className="chips">
            {intake.codesuggesties.map((c) => (
              <span key={c.icpc} className="merkje" data-toon="neutraal"
                style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                {c.icpc} {c.display}
                <span className="vertrouwen">
                  <i><b style={{ width: `${c.vertrouwen * 100}%` }} /></i>
                  {Math.round(c.vertrouwen * 100)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {intake.metingen.length > 0 && (
        <div style={{ marginTop: 9 }}>
          <div className="mini" style={{ marginBottom: 5 }}>Meegebrachte metingen</div>
          <div className="chips">
            {intake.metingen.map((m) => (
              <span key={m.code} className="merkje" data-toon="informatief">
                {m.naam} {m.waarde} {m.eenheid}
              </span>
            ))}
          </div>
        </div>
      )}

      {!intake.bevestigd && opBevestig && (
        <>
          <div className="knop-rij" style={{ marginTop: 12 }}>
            <button className="knop" data-toon="primair" disabled={bezig} onClick={opBevestig}>
              <Icoon naam="vink" grootte={13} /> Overnemen in het dossier
            </button>
            {opBewaarAlsMelding && (
              <button className="knop" disabled={bezig} onClick={opBewaarAlsMelding}>
                <Icoon naam="persoon" grootte={13} /> Bewaren als melding van de patiënt
              </button>
            )}
          </div>
          {/*
            Twee routes, want er zijn twee situaties. Overnemen betekent: jij legt deze
            waarden vast en neemt ze voor je rekening. Bewaren als melding betekent: ze
            blijven zichtbaar in het dossier met de patiënt als bron, maar het is jouw
            registratie niet en het vult dus geen ketenindicator. Zonder dat onderscheid
            moet je kiezen tussen weggooien en doen alsof je het zelf gemeten hebt.
          */}
          <p className="mini" style={{ marginTop: 8, marginBottom: 0 }}>
            Tot je iets kiest telt dit nergens in mee — niet in indicatoren, niet in
            uitwisseling. Per meting kun je de bron daarna nog wijzigen in het
            registratieblok.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * DE INGEVULDE VRAGENLIJST
 *
 * Eén onderdeel voor drie plekken: in de voorbereiding van het spreekuur (samengevat),
 * in het consult (helemaal, met de knop om over te nemen) en in het dossier (als
 * terugblik). Dat is geen zuinigheid maar een eis: de POH moet op alle drie de plekken
 * hetzelfde zien, anders gaat ze zoeken naar welk scherm de echte antwoorden toont.
 *
 * De samengevatte vorm laat zien wat de patiënt zelf inbracht en welke regels afgingen.
 * De volledige vorm laat elke vraag zien zoals hij aan de patiënt gesteld is — want een
 * antwoord zonder de vraag erbij is in een gesprek waardeloos.
 */
export function Vragenlijstkaart({ inzage, uitgeklapt, opUitklappen, opOvernemen, bezig }: {
  inzage: Vragenlijstinzage;
  uitgeklapt?: boolean;
  opUitklappen?: () => void;
  opOvernemen?: () => void;
  bezig?: boolean;
}) {
  const open = inzage.status === 'open';

  return (
    <div className="vragenlijst" data-status={inzage.status}>
      <div className="kop">
        <span style={{ color: 'var(--merk)' }}><Icoon naam="gesprek" /></span>
        <h3>{inzage.naam}</h3>
        <span className="merkje" data-toon="neutraal">versie {inzage.versie}</span>
        {open
          ? <span className="merkje" data-toon="aandacht">
              niet ingevuld{inzage.openDagen !== undefined && ` · ${inzage.openDagen} dagen open`}
            </span>
          : <span className="merkje" data-toon="ok">ingevuld {inzage.ingevuldOp?.slice(0, 10)}</span>}
        {inzage.overgenomenOp && (
          <span className="merkje" data-toon="informatief">
            overgenomen door {inzage.overgenomenDoor}
          </span>
        )}
        <span className="mini" style={{ marginLeft: 'auto' }}>{inzage.kanaal}</span>
      </div>

      {open ? (
        <div className="anamnese">
          De uitnodiging is verstuurd op {inzage.uitgezetOp.slice(0, 10)}, maar er is nog niets
          ingevuld. Vraag het in het consult zelf uit, of zet de lijst in de wachtkamer klaar.
        </div>
      ) : (
        <>
          {/*
            Wat de patiënt zelf inbracht staat bovenaan en in zijn eigen woorden. In een
            consult dat door het protocol wordt geleid, komt dit anders als laatste —
            en meestal helemaal niet.
          */}
          {inzage.overname.eigenOnderwerp && (
            <div className="citaat">“{inzage.overname.eigenOnderwerp}”</div>
          )}

          {inzage.scores.length > 0 && (
            <div className="chips" style={{ marginTop: 9 }}>
              {inzage.scores.map((s) => (
                <span key={s.naam} className="merkje" data-toon="informatief">
                  {s.naam} {s.waarde}
                </span>
              ))}
            </div>
          )}

          {inzage.signalen.length > 0 && (
            <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>
              {inzage.signalen.map((sg) => (
                <div key={sg.tekst} style={{ fontSize: 12.5 }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <ErnstMerk ernst={sg.ernst} />
                    <strong>{sg.tekst}</strong>
                  </div>
                  <div className="reden">{sg.onderbouwing}</div>
                </div>
              ))}
            </div>
          )}

          {uitgeklapt && (
            <div className="antwoorden">
              {inzage.rubrieken.map((rubriek) => (
                <div key={rubriek.naam} className="rubriek">
                  <h4>{rubriek.naam}</h4>
                  {rubriek.regels.map((regel) => (
                    <div key={regel.vraagId} className="regel" data-opvallend={regel.opvallend}>
                      <div className="vraag">
                        {regel.patientTekst ?? regel.tekst}
                        {regel.kantlijn && <span className="kantlijn">{regel.kantlijn}</span>}
                      </div>
                      <div className="antwoord">
                        {regel.antwoord || <span className="mini">niet ingevuld</span>}
                        {regel.antwoord && regel.eenheid ? ` ${regel.eenheid}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {inzage.licentie && (
                <div className="mini" style={{ marginTop: 10 }}>Bron: {inzage.licentie}</div>
              )}
            </div>
          )}

          <div className="knop-rij" style={{ marginTop: 12 }}>
            {opUitklappen && (
              <button className="knop" onClick={opUitklappen}>
                <Icoon naam="lijst" grootte={13} />
                {uitgeklapt ? ' Antwoorden inklappen' : ' Hele vragenlijst bekijken'}
              </button>
            )}
            {opOvernemen && !inzage.overgenomenOp && (
              <button className="knop" data-toon="primair" disabled={bezig} onClick={opOvernemen}>
                <Icoon naam="vink" grootte={13} /> Overnemen in mijn dossier
              </button>
            )}
          </div>

          {opOvernemen && !inzage.overgenomenOp && (
            <div className="reden" style={{ marginTop: 7 }}>
              Overnemen zet deze tekst onder de S van de SOEP en de waarden als
              patiëntgerapporteerde metingen in het dossier. Tot dat moment zijn het
              antwoorden van de patiënt, geen registratie van de praktijk.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * MIJN WERKLIJST
 *
 * Waar uitgezette taken terechtkomen. Hetzelfde onderdeel bij de POH en bij de
 * assistent, want het is dezelfde vraag: wat ligt er voor mij klaar?
 *
 * Bewust géén eigen ingang in de linkerbalk. Een werklijst die je moet gaan opzoeken,
 * wordt niet bekeken; deze staat op de dagstart, naast de agenda, waar je toch al kijkt.
 * Inplannen doe je op het planbord — daar ligt de vrije tijd.
 */
export function Werklijst({ gebruiker, naarPlannen, openPatient }: {
  gebruiker: { id: string };
  naarPlannen?: () => void;
  openPatient?: (id: string) => void;
}) {
  const [data, setData] = useState<Takenoverzicht | undefined>();
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  /*
   * De contactgegevens bij de taak zelf. Een taak die 'bel deze patiënt' heet en je
   * vervolgens het dossier in stuurt om het nummer te zoeken, laat het belangrijkste
   * werk aan jou over. Per taak opgehaald en niet vooraf: het gaat om één nummer van één
   * mens, en dat hoort pas geladen te worden als je het wilt zien.
   */
  const [bereik, setBereik] = useState<Record<string, Bereikbaarheid & { naam: string }>>({});
  const [open, setOpen] = useState<string | undefined>();

  const toonContact = async (taakId: string, patientId: string) => {
    if (open === taakId) { setOpen(undefined); return; }
    setOpen(taakId);
    if (!bereik[taakId]) {
      const gegevens = await api.bereikbaarheid(patientId);
      setBereik((b) => ({ ...b, [taakId]: gegevens }));
    }
  };

  useEffect(() => {
    let geldig = true;
    api.taken(gebruiker.id).then((o) => { if (geldig) setData(o); });
    return () => { geldig = false; };
  }, [gebruiker.id]);

  const taken = (data?.mijn ?? []).filter((t) => t.status !== 'afgerond');
  if (!data || taken.length === 0) return null;

  const rondAf = async (id: string) => {
    setBezigMet(id);
    try {
      await api.rondTaakAf(id, gebruiker.id, 'afgehandeld');
      setData(await api.taken(gebruiker.id));
    } finally { setBezigMet(undefined); }
  };

  return (
    <Kaart titel="Mijn werklijst" icoon="bliksem" telling={`${data.open} in te plannen`}>
      <div style={{ display: 'grid', gap: 9 }}>
        {taken.map((taak) => (
          <div key={taak.id} className="werktaak" data-dringend={taak.dringend}>
            <span className="ikoon"><Icoon naam={taak.icoon} grootte={14} /></span>
            <div>
              <strong style={{ fontSize: 13 }}>{taak.titel}</strong>
              <div className="reden">{taak.aanleiding}</div>
              <div className="mini">
                {taak.soortLabel} · {taak.duurMinuten} min · uitgezet door {taak.aangemaaktDoor}
                {taak.uiterlijkOp && ` · uiterlijk ${taak.uiterlijkOp}`}
              </div>
            </div>
            <div className="acties">
              <span className="merkje" data-toon={taak.status === 'gepland' ? 'ok' : 'aandacht'}>
                {taak.standLabel}
              </span>
              <div className="knop-rij">
                {taak.patientId && (
                  <button className="knop" data-toon={open === taak.id ? undefined : 'stil'}
                    onClick={() => toonContact(taak.id, taak.patientId!)}>
                    <Icoon naam="gesprek" grootte={12} />
                    {open === taak.id ? ' Verbergen' : ' Contactgegevens'}
                  </button>
                )}
                {taak.patientId && openPatient && (
                  <button className="knop" data-toon="stil" onClick={() => openPatient(taak.patientId!)}>
                    <Icoon naam="klembord" grootte={12} /> Dossier
                  </button>
                )}
                {taak.status === 'open' && naarPlannen && (
                  <button className="knop" data-toon="stil" onClick={naarPlannen}>
                    <Icoon naam="agenda" grootte={12} /> Inplannen
                  </button>
                )}
                <button className="knop" data-toon="stil" disabled={bezigMet === taak.id}
                  onClick={() => rondAf(taak.id)}>
                  <Icoon naam="vink" grootte={12} /> Gedaan
                </button>
              </div>
            </div>

            {open === taak.id && (
              <div className="contactuitklap">
                {bereik[taak.id]
                  ? (
                    <>
                      <div className="reden" style={{ marginBottom: 7 }}>
                        {bereik[taak.id].advies}
                      </div>
                      <Bereikbaarheidskaart gegevens={bereik[taak.id]} compact />
                    </>
                  )
                  : <span className="mini">Contactgegevens ophalen…</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Kaart>
  );
}

const KANAAL_ICOON: Record<string, string> = {
  mobiel: 'gesprek', vast: 'gesprek', email: 'document', portaal: 'huis',
};

/**
 * HOE BEREIK IK DEZE MENS?
 *
 * Zodra het systeem 'bel deze patiënt' als taak kan uitzetten, moet het ook kunnen
 * beantwoorden hóé. Dat stond nergens: het dossier kende wel een telefoonnummer, maar
 * geen enkel scherm liet het zien — dus zocht je het in een ander systeem op, of je belde
 * de assistent om het te vragen.
 *
 * Bewust meer dan een nummer. Welk kanaal deze mens zelf het liefst heeft, wat de
 * praktijk over zijn bereikbaarheid heeft geleerd, en wie er gebeld mag worden als hij
 * het zelf niet redt — met daarbij wát die naaste mag horen.
 */
export function Bereikbaarheidskaart({ gegevens, compact, opBellen }: {
  gegevens: Bereikbaarheid;
  /** Compacte vorm voor in een werklijst: alleen wat je nodig hebt om te bellen. */
  compact?: boolean;
  opBellen?: (kanaal: Bereikbaarheidskanaal) => void;
}) {
  return (
    <div className="bereikbaarheid" data-compact={compact}>
      {gegevens.kanalen.length === 0 && (
        <span className="mini">Geen contactgegevens bekend.</span>
      )}
      {gegevens.kanalen.map((kanaal) => (
        <div key={kanaal.soort} className="kanaal">
          <span className="ikoon"><Icoon naam={KANAAL_ICOON[kanaal.soort] ?? 'gesprek'} grootte={14} /></span>
          <div>
            <div className="waarde">{kanaal.waarde}</div>
            <div className="mini">
              {kanaal.label}
              {kanaal.voorkeur && ' · voorkeur van de patiënt'}
            </div>
          </div>
          {kanaal.belbaar && opBellen && (
            <button className="knop" data-toon="primair" onClick={() => opBellen(kanaal)}>
              <Icoon naam="gesprek" grootte={12} /> Bellen
            </button>
          )}
        </div>
      ))}

      {!compact && gegevens.adres && (
        <div className="kanaal">
          <span className="ikoon"><Icoon naam="huis" grootte={14} /></span>
          <div>
            <div className="waarde">{gegevens.adres}</div>
            <div className="mini">Woonadres</div>
          </div>
        </div>
      )}

      {/*
        Wat de praktijk in de loop der jaren heeft geleerd. Dit staat nu op briefjes en
        in hoofden, en het is precies wat je nodig hebt op het moment dat je de hoorn
        oppakt — niet erna.
      */}
      {gegevens.toelichting && (
        <div className="bereiknotitie">
          <Icoon naam="waarschuwing" grootte={13} /> {gegevens.toelichting}
        </div>
      )}

      {gegevens.contactpersoon && (
        <div className="kanaal naaste">
          <span className="ikoon"><Icoon naam="persoon" grootte={14} /></span>
          <div>
            <div className="waarde">
              {gegevens.contactpersoon.naam}
              <span className="mini"> · {gegevens.contactpersoon.relatie}</span>
            </div>
            <div className="mini">{gegevens.contactpersoon.telefoon} — {gegevens.contactpersoon.magUitleg}</div>
          </div>
        </div>
      )}
    </div>
  );
}
