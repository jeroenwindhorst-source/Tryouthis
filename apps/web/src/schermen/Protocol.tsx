import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon, icoonVanModule } from '../iconen';
import { Fout, Kaart, Laden, ModuleIdChips } from '../onderdelen';

function intervalTekst(dagen: number): string {
  if (dagen >= 730) return 'elke 2 jaar';
  if (dagen >= 360) return 'jaarlijks';
  if (dagen >= 170) return 'halfjaarlijks';
  if (dagen >= 85) return 'per kwartaal';
  return `elke ${dagen} dagen`;
}

/**
 * Het protocol, zichtbaar gemaakt.
 *
 * Dit scherm bestaat om één ding te laten zien: er is géén protocol per aandoening.
 * Er is één protocol, opgebouwd uit aandachtsgebieden, en de aandoening bepaalt hooguit
 * of een gebied relevant is — niet welk traject iemand in gaat.
 */
export function Protocol() {
  const { data, fout, bezig } = useData(() => api.protocol());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Protocol" />;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Het protocol</h1>
          <div className="onder">
            {data.modules.length} aandachtsgebieden · regelset {data.regelsetVersie}
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Eén protocol, geen zorgprogramma’s.</strong> {data.toelichting} Een mens heeft
        zelden één probleem; zodra de aandoening het organiserende principe wordt, krijg je per
        definitie losse trajecten, losse oproepen en losse consulten.
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {data.modules.map((module) => (
          <section key={module.id} className={`kaart mod-${module.id}`}>
            <header style={{ borderLeft: '3px solid var(--tint)', borderRadius: '10px 0 0 0' }}>
              <span style={{ color: 'var(--tint)' }}>
                <Icoon naam={icoonVanModule(module.id, module.icoon)} grootte={18} />
              </span>
              <h2 style={{ fontSize: 14, color: 'var(--tint)' }}>{module.naam}</h2>
              <span className="merkje" data-toon="neutraal">{module.rol}</span>
              <span className="telling">{module.items.length} metingen</span>
            </header>

            <div className="body">
              <p style={{ marginTop: 0, color: 'var(--ink-2)', fontSize: 13 }}>{module.omschrijving}</p>

              <div style={{ marginBottom: 12 }}>
                <span className="mini">Relevant wanneer: </span>
                <span style={{ fontSize: 12.5 }}>{module.relevantie}</span>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Meting</th>
                    <th style={{ width: 130 }}>Uitgangsinterval</th>
                    <th>Wordt korter of langer wanneer…</th>
                    <th style={{ width: 130 }}>Bijzonderheden</th>
                  </tr>
                </thead>
                <tbody>
                  {module.items.map((item) => (
                    <tr key={item.code}>
                      <td className="nadruk">{item.naam}<div className="mini">{item.code}</div></td>
                      <td>{intervalTekst(item.basisIntervalDagen)}</td>
                      <td>
                        {item.intervalRegels.length === 0
                          ? <span className="mini">vast interval</span>
                          : (
                            <div style={{ display: 'grid', gap: 4 }}>
                              {item.intervalRegels.map((r, i) => (
                                <div key={i} style={{ fontSize: 12.5 }}>
                                  <span className="merkje" data-toon={r.factor < 1 ? 'aandacht' : 'ok'}>
                                    {r.factor < 1 ? `${Math.round((1 - r.factor) * 100)}% korter` : `${Math.round((r.factor - 1) * 100)}% langer`}
                                  </span>{' '}
                                  {r.reden}
                                </div>
                              ))}
                            </div>
                          )}
                      </td>
                      <td>
                        {item.zelfAanleverbaar && <div className="merkje" data-toon="ok">thuis mogelijk</div>}
                        {item.labVooraf && <div className="merkje" data-toon="neutraal">lab vooraf</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mini" style={{ marginTop: 10 }}>
                Richtlijn: {module.richtlijnen.map((r) => `${r.naam} (${r.versie})`).join(' · ')}
              </div>
            </div>
          </section>
        ))}
      </div>

      <Kaart titel="Achtergrond: koppeling naar landelijke ketenzorg" icoon="tag">
        <p style={{ marginTop: 0, color: 'var(--ink-2)', fontSize: 12.5 }}>
          Declaratie, ketencontracten en indicatorenrapportage draaien in Nederland op programma’s
          per aandoening. Die werkelijkheid negeren betekent dat een praktijk haar financiering
          breekt. De koppeling gebeurt daarom hier — automatisch, achteraf, en zonder dat iemand
          “voor de keten” hoeft te registreren.
        </p>
        <table>
          <thead>
            <tr><th style={{ width: 230 }}>Keten</th><th>Wordt gedekt door</th><th style={{ width: 150 }}>Declaratie</th></tr>
          </thead>
          <tbody>
            {data.ketens.map((keten) => (
              <tr key={keten.id}>
                <td className="nadruk">{keten.naam}</td>
                <td><ModuleIdChips ids={keten.modules} /></td>
                <td>
                  <div className="nadruk">{keten.declaratie.prestatiecode}</div>
                  <div className="mini">{keten.declaratie.omschrijving}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>
    </>
  );
}
