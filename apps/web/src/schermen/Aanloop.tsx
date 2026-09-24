import { useState } from 'react';
import { api, AANLOOPSTATUS_LABEL, type Aanloopstatus } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Laden, Leeg, ModuleChips } from '../onderdelen';

/**
 * DE AANLOOP
 *
 * Deze tegel heette eerst 'Voorbereiden' en ging over de patiënten van vandaag. Dat was
 * dubbelop: voorbereiden dóé je in het spreekuur, vlak voordat je iemand binnenroept.
 *
 * Wat hier hoort, speelt eerder. Het systeem stuurt drie weken voor een controle
 * automatisch een uitnodiging om bloed te laten prikken. Bij de meesten werkt dat. Bij
 * sommigen niet, en dan zit er over een week iemand in de spreekkamer terwijl er niets
 * te bespreken valt. Dat is nu pas te zien op het moment dat het te laat is.
 *
 * Het systeem weet het ruim van tevoren. Hier staat het, op volgorde van wat er nog aan
 * te doen is: bellen als er nog tijd is, verzetten als die er niet meer is.
 */

const TOON: Record<Aanloopstatus, string> = {
  'op-schema': 'ok', 'herinnering-loopt': 'informatief', bellen: 'aandacht', verzetten: 'urgent',
};

export function Aanloop({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig } = useData(() => api.aanloop());
  const [afgehandeld, setAfgehandeld] = useState<Record<string, string>>({});

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Aanloop" />;

  const teDoen = data.filter((a) => a.status === 'bellen' || a.status === 'verzetten');
  const rest = data.filter((a) => a.status !== 'bellen' && a.status !== 'verzetten');

  const regel = (a: (typeof data)[number]) => {
    const besluit = afgehandeld[a.afspraakId];
    return (
      <section key={a.afspraakId} className="kaart">
        <header>
          <span className="tijd">{a.datum.slice(8, 10)}-{a.datum.slice(5, 7)}</span>
          <h2 style={{ fontSize: 15 }}>{a.naam}</h2>
          <span className="mini">{a.leeftijd} jaar · over {a.dagenTot} dagen om {a.tijd}</span>
          <span style={{ marginLeft: 'auto' }}>
            {besluit
              ? <span className="merkje" data-toon="ok">{besluit}</span>
              : <span className="merkje" data-toon={TOON[a.status]}>{AANLOOPSTATUS_LABEL[a.status]}</span>}
          </span>
        </header>

        <div className="body">
          <ModuleChips modules={a.modules} />

          <div style={{ margin: '11px 0' }}>
            <strong style={{ fontSize: 13 }}>{a.advies}</strong>
            <div className="reden">{a.toelichting}</div>
          </div>

          {/* De stand per onderdeel, want 'niet rond' is te weinig om op te handelen. */}
          <div className="chips">
            {a.vooraf.map((v) => (
              <span key={v.naam} className="merkje" data-toon={v.binnen ? 'ok' : 'aandacht'}>
                <Icoon naam="buisje" grootte={12} /> {v.naam}
                {v.binnen ? ` · ${v.op}` : ' · niet geprikt'}
              </span>
            ))}
            {a.vragenlijst && (
              <span className="merkje" data-toon={a.vragenlijst.status === 'ingevuld' ? 'ok' : 'aandacht'}>
                <Icoon naam="gesprek" grootte={12} /> {a.vragenlijst.naam}
                {a.vragenlijst.status === 'ingevuld'
                  ? ' · ingevuld'
                  : ` · ${a.vragenlijst.openDagen} dagen open`}
              </span>
            )}
          </div>

          {!besluit && a.status !== 'op-schema' && (
            <div className="knop-rij" style={{ marginTop: 13 }}>
              <button className="knop" data-toon="primair"
                onClick={() => setAfgehandeld((g) => ({ ...g, [a.afspraakId]: 'gebeld' }))}>
                <Icoon naam="gesprek" grootte={13} /> Bellen en herinneren
              </button>
              <button className="knop"
                onClick={() => setAfgehandeld((g) => ({ ...g, [a.afspraakId]: 'verzet' }))}>
                <Icoon naam="agenda" grootte={13} /> Afspraak later plannen
              </button>
              <button className="knop" onClick={() => openPatient(a.patientId)}>
                <Icoon naam="klembord" grootte={13} /> Dossier openen
              </button>
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Aanloop</h1>
          <div className="onder">
            {data.length} controles in de komende weken · {teDoen.length} vragen nu iets van mij
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Waarom dit blok bestaat.</strong> Iedereen hier kreeg automatisch bericht om bloed
        te laten prikken. Dat is het werk dat het systeem al doet. Wat het systeem niet kan
        beslissen, is wat je doet met de mensen bij wie dat bericht niets heeft opgeleverd — en
        dat verschilt per patiënt, afhankelijk van hoeveel dagen er nog over zijn.
      </div>

      {data.length === 0 && <Leeg tekst="Geen geplande controles in de komende weken." />}

      {teDoen.length > 0 && (
        <>
          <h2 className="sectiekop">Vraagt nu actie</h2>
          <div style={{ display: 'grid', gap: 12 }}>{teDoen.map(regel)}</div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="sectiekop">Loopt zoals het hoort</h2>
          <div style={{ display: 'grid', gap: 12 }}>{rest.map(regel)}</div>
        </>
      )}
    </>
  );
}
