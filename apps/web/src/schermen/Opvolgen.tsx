import { useState } from 'react';
import { api, OPVOLGBRON_LABEL, type Opvolgbron } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { ErnstMerk, Fout, Laden, Leeg } from '../onderdelen';

/**
 * OPVOLGEN — wat binnenkwam en nu een besluit vraagt
 *
 * Het blok dat er niet was, tussen het spreekuur en het monitoren in.
 *
 * Monitoren beantwoordt de vraag 'hoe gaat het met de groep die ik op afstand volg'.
 * Dat is een overzicht, en je kijkt er als het je uitkomt. Wat er níét in past zijn de
 * dingen die sinds gisteren zijn binnengekomen en waar je vandaag iets mee kunt: een
 * labuitslag die afwijkt, een vragenlijst waarin iemand iets opschrijft dat niet kan
 * wachten, tien dagen thuisgemeten bloeddrukken die te hoog zijn.
 *
 * Voor geen van die dingen is een afspraak nodig. Een bericht, een recept of een
 * telefoontje volstaat. Zonder dit blok wachten ze tot de volgende controle in de
 * agenda staat — soms drie maanden.
 */

const ICOON: Record<Opvolgbron, string> = {
  labuitslag: 'buisje', vragenlijst: 'gesprek', thuismeting: 'radar',
};

export function Opvolgen({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig } = useData(() => api.opvolgen());
  const [gedaan, setGedaan] = useState<Record<string, string>>({});

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Opvolgen" />;

  const open = data.filter((o) => !gedaan[o.id]);

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Opvolgen</h1>
          <div className="onder">
            {open.length} binnengekomen zonder afspraak · {open.filter((o) => o.ernst === 'urgent').length} urgent
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Zonder afspraak af te handelen.</strong> Alles hieronder gaat over patiënten die
        vandaag niet op het spreekuur staan. Voor het merendeel is een bericht of een aangepast
        recept genoeg. Wat je hier afhandelt, hoeft niet in een consult van twintig minuten.
      </div>

      {data.length === 0 && <Leeg tekst="Er is niets binnengekomen dat om een besluit vraagt." />}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.map((o) => (
          <section key={o.id} className="kaart" style={{ opacity: gedaan[o.id] ? 0.6 : 1 }}>
            <header>
              <span style={{ color: 'var(--merk)' }}><Icoon naam={ICOON[o.bron]} grootte={15} /></span>
              <h2 style={{ fontSize: 15 }}>{o.naam}</h2>
              <span className="mini">{o.leeftijd} jaar</span>
              <span className="merkje" data-toon="neutraal">{OPVOLGBRON_LABEL[o.bron]}</span>
              <span className="mini">{o.binnenOp}</span>
              <span style={{ marginLeft: 'auto' }}>
                {gedaan[o.id]
                  ? <span className="merkje" data-toon="ok">{gedaan[o.id]}</span>
                  : <ErnstMerk ernst={o.ernst} />}
              </span>
            </header>

            <div className="body">
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{o.titel}</div>
              <div className="reden" style={{ marginTop: 4 }}>{o.bevinding}</div>

              <div style={{
                marginTop: 11, padding: '9px 11px',
                background: 'var(--merk-zacht)', borderRadius: 6, color: 'var(--merk-diep)',
              }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontWeight: 600, fontSize: 12 }}>
                  <Icoon naam="bliksem" grootte={13} /> Voorstel
                </div>
                <div style={{ fontSize: 12.5, marginTop: 3 }}>{o.voorstel}</div>
              </div>

              {!gedaan[o.id] && (
                <div className="knop-rij" style={{ marginTop: 13 }}>
                  <button className="knop" data-toon="primair" onClick={() => openPatient(o.patientId)}>
                    <Icoon naam="klembord" grootte={13} /> Openen en afhandelen
                  </button>
                  <button className="knop"
                    onClick={() => setGedaan((g) => ({ ...g, [o.id]: 'bericht gestuurd' }))}>
                    <Icoon naam="gesprek" grootte={13} /> Bericht sturen
                  </button>
                  <button className="knop"
                    onClick={() => setGedaan((g) => ({ ...g, [o.id]: 'bij volgende controle' }))}>
                    <Icoon naam="agenda" grootte={13} /> Kan wachten tot de controle
                  </button>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
