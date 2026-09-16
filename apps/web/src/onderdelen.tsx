import type { ReactNode } from 'react';
import { Icoon, icoonVanModule } from './iconen';
import {
  MODULE_NAAM,
  type AgendaRegel, type Ernst, type ModuleChip, type Signaal, type Suggestie, type WachtkamerIntake,
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
export function Agenda({ regels, openPatient }: {
  regels: AgendaRegel[];
  openPatient?: (id: string) => void;
}) {
  if (regels.length === 0) return <Leeg tekst="Geen afspraken vandaag." />;
  return (
    <div className="agenda">
      {regels.map((r) => {
        // De hele regel is de knop, niet alleen de naam: je klikt op een afspraak, niet op tekst.
        const klikbaar = Boolean(r.patientId && openPatient);
        return (
        <div key={r.id} className="regel" data-soort={r.soort} data-aandacht={Boolean(r.aandacht)}
          data-klikbaar={klikbaar}
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
              {r.naam ? `${r.leeftijd} jaar · ${r.reden ?? r.titel}` : `${r.duurMinuten} minuten`}
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
            {r.intakeKlaar && <span className="merkje" data-toon="informatief">intake klaar</span>}
            {r.voorbereid === false && <span className="merkje" data-toon="aandacht">niet compleet</span>}
            {r.voorbereid === true && <span className="merkje" data-toon="ok">voorbereid</span>}
          </div>
        </div>
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
export function IntakeKaart({ intake, bezig, opBevestig }: {
  intake: WachtkamerIntake; bezig?: boolean; opBevestig?: () => void;
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
        <div className="knop-rij" style={{ marginTop: 12 }}>
          <button className="knop" data-toon="primair" disabled={bezig} onClick={opBevestig}>
            <Icoon naam="vink" grootte={13} /> Overnemen in het dossier
          </button>
          <span className="mini" style={{ alignSelf: 'center' }}>
            Tot je bevestigt telt dit nergens in mee — niet in indicatoren, niet in uitwisseling.
          </span>
        </div>
      )}
    </div>
  );
}
