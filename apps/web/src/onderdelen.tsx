import type { ReactNode } from 'react';
import { Icoon, icoonVanModule } from './iconen';
import { MODULE_NAAM, type Ernst, type ModuleChip, type Signaal, type Suggestie } from './api';

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
        {suggestie.richtlijn && <span>{suggestie.richtlijn.naam}{suggestie.richtlijn.paragraaf ? ` — ${suggestie.richtlijn.paragraaf}` : ''}</span>}
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
