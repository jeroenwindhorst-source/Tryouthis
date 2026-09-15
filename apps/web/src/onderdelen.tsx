import type { ReactNode } from 'react';
import { PROGRAMMA_NAAM, type Signaal } from './api';

export function Kaart({ titel, telling, kop, children }:
  { titel: string; telling?: ReactNode; kop?: ReactNode; children: ReactNode }) {
  return (
    <section className="kaart">
      <h2>{titel}{kop}{telling !== undefined && <span className="telling">{telling}</span>}</h2>
      {children}
    </section>
  );
}

export function Tegel({ getal, label, toon }: { getal: ReactNode; label: string; toon?: string }) {
  return (
    <div className="tegel" data-toon={toon}>
      <div className="getal">{getal}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function ProgrammaLabels({ programmas }: { programmas: string[] }) {
  if (programmas.length === 0) return <span className="label" data-toon="neutraal">geen programma</span>;
  return (
    <>
      {programmas.map((p) => (
        <span key={p} className="label" data-toon={p}>{PROGRAMMA_NAAM[p] ?? p}</span>
      ))}
    </>
  );
}

/** Een signaal toont altijd de reden — nooit een teller zonder context (docs/05 §5.2). */
export function Signalen({ signalen }: { signalen: Signaal[] }) {
  if (signalen.length === 0) return <span className="reden">geen bijzonderheden</span>;
  return (
    <>
      {signalen.map((s, i) => (
        <div className="signaal" key={i}>
          <span className="label" data-toon={s.ernst}>
            {s.ernst === 'urgent' ? 'urgent' : s.ernst === 'aandacht' ? 'aandacht' : 'info'}
          </span>
          <span>{s.tekst}</span>
        </div>
      ))}
    </>
  );
}

export function Laden({ wat }: { wat: string }) {
  return <div className="leeg">{wat} wordt geladen…</div>;
}

export function Fout({ boodschap }: { boodschap: string }) {
  return (
    <div className="notitie">
      <strong>Kan de gegevens niet ophalen.</strong> {boodschap}
      <br />Draait de API? Start hem met <code>npm run api</code>.
    </div>
  );
}
