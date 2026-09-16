import { useState } from 'react';
import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon, icoonVanModule } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

/**
 * Instroom — casefinding zonder programma-denken.
 *
 * De vraag is niet "voldoet deze patiënt aan de inclusiecriteria van programma X",
 * maar: welk aandachtsgebied is voor deze mens relevant geworden? Dat is een
 * zorginhoudelijke vraag die in één zin te beantwoorden is.
 */
export function Instroom({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig, herlaad } = useData(() => api.instroom());
  const praktijk = useData(() => api.praktijk());
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  const [gekozen, setGekozen] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Instroom" />;

  const accepteer = async (patientId: string, moduleId: string) => {
    setBezigMet(patientId + moduleId);
    try {
      await api.accepteerModule(patientId, moduleId);
      herlaad();
      praktijk.herlaad();
    } finally { setBezigMet(undefined); }
  };

  // Alle voorstellen als losse regels: één patiënt kan meerdere gebieden tegelijk krijgen.
  const regels = data.flatMap((r) =>
    r.nieuweModules.map((m) => ({ patientId: r.patientId, naam: r.naam, leeftijd: r.leeftijd, module: m })));
  const zichtbaar = filter ? regels.filter((r) => r.module.moduleId === filter) : regels;
  const sleutel = (patientId: string, moduleId: string) => `${patientId}:${moduleId}`;
  const selectie = zichtbaar.filter((r) => gekozen[sleutel(r.patientId, r.module.moduleId)]);

  const perModule = new Map<string, { naam: string; icoon: string; aantal: number }>();
  for (const r of regels) {
    const bestaand = perModule.get(r.module.moduleId);
    perModule.set(r.module.moduleId, {
      naam: r.module.naam, icoon: r.module.icoon, aantal: (bestaand?.aantal ?? 0) + 1,
    });
  }

  const kiesAlles = (aan: boolean) => {
    const nieuw = { ...gekozen };
    for (const r of zichtbaar) nieuw[sleutel(r.patientId, r.module.moduleId)] = aan;
    setGekozen(nieuw);
  };

  const verwerkSelectie = async () => {
    setBezigMet('batch');
    try {
      for (const r of selectie) await api.accepteerModule(r.patientId, r.module.moduleId);
      setGekozen({});
      herlaad();
      praktijk.herlaad();
    } finally { setBezigMet(undefined); }
  };

  const p = praktijk.data;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Instroom</h1>
          <div className="onder">{data.length} patiënten met een nieuw relevant aandachtsgebied</div>
        </div>
      </div>

      <div className="notitie">
        <strong>Zonder datadump, zonder Excel.</strong> De relevantieregels draaien continu over het
        dossier. Wie vandaag aan de criteria gaat voldoen, staat morgen in deze lijst. Accepteren
        betekent niet automatisch meer contacten: de controles worden samengevoegd met wat er al staat.
      </div>

      {p && (
        <div className="raster2" style={{ marginBottom: 14 }}>
          <Kaart titel="Praktijkbeeld" icoon="persoon">
            <div className="regel"><span className="sleutel">Patiënten</span><span className="waarde">{p.patienten}</span></div>
            <div className="regel"><span className="sleutel">Met chronische zorgvraag</span><span className="waarde">{p.metChronischeZorg}</span></div>
            <div className="regel"><span className="sleutel">Binnen een landelijke keten</span><span className="waarde">{p.binnenKeten}</span></div>
            <div className="regel">
              <span className="sleutel">Wél zorgvraag, géén keten</span>
              <span className="waarde" style={{ color: 'var(--aandacht)' }}>{p.buitenKeten}</span>
            </div>
            <div className="regel"><span className="sleutel">Meerdere trajecten tegelijk</span><span className="waarde">{p.meerdereTrajecten}</span></div>
            <p className="reden" style={{ marginBottom: 0, marginTop: 10 }}>
              Die {p.buitenKeten} patiënten hebben een chronische zorgvraag maar vallen onder geen
              enkel landelijk programma. In de huidige inrichting krijgen zij daarvoor geen
              gestructureerde begeleiding — ze bestaan simpelweg niet in de ketenadministratie.
            </p>
          </Kaart>

          <Kaart titel="Aandachtsgebieden in de praktijk" icoon="lijst">
            {p.modules.map((m) => (
              <div key={m.naam} className="regel">
                <span className="sleutel">{m.naam}</span>
                <span className="waarde">{m.aantal}</span>
              </div>
            ))}
          </Kaart>
        </div>
      )}

      {data.length === 0 && <Leeg tekst="Geen nieuwe aandachtsgebieden — de praktijk is bij." />}

      {regels.length > 0 && (
        <>
          <Kaart titel="In één keer verwerken" icoon="bliksem">
            <p className="reden" style={{ marginTop: 0 }}>
              Instroom komt zelden één patiënt tegelijk. Kies een aandachtsgebied, controleer de
              onderbouwing per regel, en verwerk de hele groep in één handeling — zonder dat er
              ooit een uitdraai aan te pas komt.
            </p>
            <div className="chips" style={{ marginBottom: 12 }}>
              <button className="knop" data-toon={!filter ? 'primair' : undefined}
                style={{ padding: '3px 11px', fontSize: 12 }} onClick={() => setFilter(undefined)}>
                Alles ({regels.length})
              </button>
              {[...perModule.entries()].map(([id, m]) => (
                <button key={id} className="knop" data-toon={filter === id ? 'primair' : undefined}
                  style={{ padding: '3px 11px', fontSize: 12 }} onClick={() => setFilter(id)}>
                  <Icoon naam={icoonVanModule(id, m.icoon)} grootte={13} /> {m.naam} ({m.aantal})
                </button>
              ))}
            </div>

            <div className="knop-rij">
              <button className="knop" onClick={() => kiesAlles(true)}>
                <Icoon naam="vink" grootte={13} /> Alle {zichtbaar.length} selecteren
              </button>
              <button className="knop" data-toon="stil" onClick={() => kiesAlles(false)}>
                Selectie wissen
              </button>
            </div>
          </Kaart>

          {selectie.length > 0 && (
            <div className="selectiebalk">
              <Icoon naam="vink" grootte={15} />
              <strong>{selectie.length} geselecteerd</strong>
              <span className="mini">
                {[...new Set(selectie.map((r) => r.patientId))].length} patiënten ·
                {' '}{[...new Set(selectie.map((r) => r.module.naam))].join(', ')}
              </span>
              <button className="knop" data-toon="primair" style={{ marginLeft: 'auto' }}
                disabled={bezigMet === 'batch'} onClick={verwerkSelectie}>
                <Icoon naam="bliksem" grootte={13} />
                {bezigMet === 'batch' ? 'Bezig…' : 'Toevoegen aan hun plan'}
              </button>
            </div>
          )}

          <Kaart titel="Voorstellen" icoon="instroom" telling={zichtbaar.length} strak>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }} />
                  <th style={{ width: 200 }}>Patiënt</th>
                  <th style={{ width: 190 }}>Aandachtsgebied</th>
                  <th>Waarom nu</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((r) => (
                  <tr key={sleutel(r.patientId, r.module.moduleId)}>
                    <td>
                      <input type="checkbox"
                        checked={Boolean(gekozen[sleutel(r.patientId, r.module.moduleId)])}
                        onChange={(e) => setGekozen((g) => ({
                          ...g, [sleutel(r.patientId, r.module.moduleId)]: e.target.checked,
                        }))} />
                    </td>
                    <td className="nadruk">
                      <button className="knop" data-toon="stil" style={{ padding: 0, fontWeight: 600 }}
                        onClick={() => openPatient(r.patientId)}>{r.naam}</button>
                      <div className="mini">{r.leeftijd} jaar</div>
                    </td>
                    <td>
                      <span className={`chip mod-${r.module.moduleId}`}>
                        <Icoon naam={icoonVanModule(r.module.moduleId, r.module.icoon)} grootte={13} />
                        {r.module.naam}
                      </span>
                    </td>
                    <td className="reden">{r.module.onderbouwing}</td>
                    <td className="rechts">
                      <button className="knop" disabled={bezigMet === r.patientId + r.module.moduleId}
                        onClick={() => accepteer(r.patientId, r.module.moduleId)}>
                        <Icoon naam="plus" grootte={13} /> Toevoegen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>
        </>
      )}

    </>
  );
}
