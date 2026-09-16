import { useState } from 'react';
import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import {
  ErnstMerk, Fout, IntakeKaart, Kaart, Laden, Leeg, ModuleChips, Zelfredzaamheidsmeter,
} from '../onderdelen';

/**
 * Consultvoorbereiding — in de procesplaat de stap die vóór het consult hoort te
 * zitten (docs/12 §2.3). In bestaande systemen bestaat deze stap niet: daar ontdek je
 * tijdens het consult dat het lab er nog niet is.
 */
export function Voorbereiden({ openPatient, toonUitleg = true }: {
  openPatient: (id: string) => void;
  toonUitleg?: boolean;
}) {
  const { data, fout, bezig } = useData(() => api.voorbereiding());
  const [geregeld, setGeregeld] = useState<Record<string, boolean>>({});

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Voorbereiding" />;

  const incompleet = data.filter((v) => !v.compleet).length;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Voorbereiden</h1>
          <div className="onder">
            {data.length} afspraken vandaag · {incompleet} nog niet compleet
          </div>
        </div>
        <div className="acties">
          <button className="knop" data-toon="primair"
            onClick={() => setGeregeld(Object.fromEntries(data.map((v) => [v.patientId, true])))}>
            <Icoon naam="bliksem" grootte={14} /> Alles wat ontbreekt klaarzetten
          </button>
        </div>
      </div>

      {toonUitleg && (
        <div className="notitie">
          <strong>Wat je hier kunt doen.</strong> Per patiënt zie je wat er binnen is, wat ontbreekt
          en waar het gesprek over zou moeten gaan. Labaanvragen en vragenlijsten klaarzetten is
          logistiek werk zonder klinische beslissing — dat kan in één handeling voor iedereen.
        </div>
      )}

      {data.length === 0 && <Leeg tekst="Geen afspraken vandaag." />}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.map((v) => (
          <section key={v.patientId + v.tijd} className="kaart">
            <header>
              <span className="tijd">{v.tijd}</span>
              <h2 style={{ fontSize: 15 }}>{v.naam}</h2>
              <span className="mini">{v.leeftijd} jaar · {v.soort}</span>
              <span style={{ marginLeft: 'auto' }}>
                {v.compleet || geregeld[v.patientId]
                  ? <span className="merkje" data-toon="ok">voorbereid</span>
                  : <span className="merkje" data-toon="aandacht">{v.ontbreekt.length} ontbreekt</span>}
              </span>
            </header>

            <div className="body">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <ModuleChips modules={v.modules} />
                {v.zelfredzaamheid && (
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="mini">zelfredzaamheid</span>
                    <Zelfredzaamheidsmeter gemiddelde={v.zelfredzaamheid.gemiddelde}
                      niveau={v.zelfredzaamheid.niveau} />
                  </span>
                )}
              </div>

              {v.intake && <IntakeKaart intake={v.intake} />}

              <div className="raster2">
                <div>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', marginBottom: 7 }}>
                    Klaar voor het gesprek
                  </h3>
                  {v.binnen.length > 0 ? (
                    <div style={{ display: 'grid', gap: 3 }}>
                      {v.binnen.map((b) => (
                        <div key={b} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5 }}>
                          <span style={{ color: 'var(--ok)' }}><Icoon naam="vink" grootte={13} /></span>{b}
                        </div>
                      ))}
                    </div>
                  ) : <span className="mini">Nog niets binnen.</span>}

                  {!v.compleet && !geregeld[v.patientId] && (
                    <>
                      <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', margin: '12px 0 7px' }}>
                        Ontbreekt nog
                      </h3>
                      <div style={{ display: 'grid', gap: 3, marginBottom: 10 }}>
                        {v.ontbreekt.map((o) => (
                          <div key={o} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5 }}>
                            <span style={{ color: 'var(--aandacht)' }}>
                              <Icoon naam={o.includes('vragenlijst') ? 'gesprek' : 'buisje'} grootte={13} />
                            </span>{o}
                          </div>
                        ))}
                      </div>
                      <button className="knop" onClick={() => setGeregeld((g) => ({ ...g, [v.patientId]: true }))}>
                        <Icoon naam="bliksem" grootte={13} /> Klaarzetten
                      </button>
                    </>
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', marginBottom: 7 }}>
                    Waar dit gesprek over zou moeten gaan
                  </h3>
                  {v.gespreksonderwerpen.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {v.gespreksonderwerpen.map((g) => (
                        <div key={g.titel} style={{ fontSize: 12.5 }}>
                          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                            <ErnstMerk ernst={g.ernst} />
                            <strong>{g.titel}</strong>
                          </div>
                          <div className="reden">{g.bevinding}</div>
                        </div>
                      ))}
                    </div>
                  ) : <span className="mini">Geen bijzonderheden — routinecontrole.</span>}

                  {v.doelen.length > 0 && (
                    <div style={{ marginTop: 12, padding: '9px 11px', background: 'var(--merk-zacht)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--merk-diep)', fontWeight: 600, fontSize: 12 }}>
                        <Icoon naam="doel" grootte={13} /> Eigen doel van de patiënt
                      </div>
                      {v.doelen.map((d) => (
                        <div key={d.tekst} style={{ fontSize: 12.5, marginTop: 3, color: 'var(--merk-diep)' }}>“{d.tekst}”</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="knop-rij" style={{ marginTop: 13 }}>
                <button className="knop" data-toon="primair" onClick={() => openPatient(v.patientId)}>
                  <Icoon naam="agenda" grootte={13} /> Open consultscherm
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
