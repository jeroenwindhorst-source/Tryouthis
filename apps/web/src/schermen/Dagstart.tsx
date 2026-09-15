import { api, type Processtap } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden } from '../onderdelen';

const STAP_ICOON: Record<Processtap['id'], string> = {
  voorbereiden: 'klembord', spreekuur: 'agenda', monitoren: 'radar', afronden: 'afvinken',
};

/**
 * De dagstart ís het startscherm (docs/05 §1.1) — geen zoekveld.
 *
 * De vier kaarten zijn het werkproces van de POH, in volgorde. Per stap staat er
 * letterlijk bij wát je daar ziet, want dat is precies wat in bestaande systemen
 * ontbreekt: je moet er maar achter komen waar je je werk vindt.
 */
export function Dagstart({ gaNaar, openPatient }: {
  gaNaar: (scherm: string) => void;
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig } = useData(() => api.dagstart());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Dagstart" />;

  const datum = new Date(data.datum).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Goedemorgen, {data.zorgverlener.naam.split(' ')[0]}</h1>
          <div className="onder">{datum} · {data.zorgverlener.rol}</div>
        </div>
      </div>

      <div className="stappen">
        {data.stappen.map((stap) => (
          <button key={stap.id} className="stap" data-aandacht={stap.aandacht > 0}
            onClick={() => gaNaar(stap.id)}>
            <span className="pijl"><Icoon naam="pijl" grootte={14} /></span>
            <div className="kop">
              <span className="ikoon"><Icoon naam={STAP_ICOON[stap.id]} /></span>
              <h3>{stap.naam}</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{stap.aantal}</span>
              <span className="naast">
                {stap.aandacht > 0 ? `${stap.aandacht} vragen aandacht` : 'alles bij'}
              </span>
            </div>
            <div className="wat">{stap.watZieIk}</div>
          </button>
        ))}
      </div>

      <div className="raster2">
        <div>
          <div className="automatisch">
            <h3><Icoon naam="bliksem" /> Het systeem heeft dit vandaag al voor je gedaan</h3>
            {data.automatisering.vandaagAutomatisch.length > 0 ? (
              <ul>
                {data.automatisering.vandaagAutomatisch.map((x) => (
                  <li key={x.titel}><strong>{x.aantal}×</strong> {x.titel.toLowerCase()}</li>
                ))}
              </ul>
            ) : <div style={{ fontSize: 12.5, color: '#12684d' }}>Niets automatisch gedaan vandaag.</div>}
            <div style={{ marginTop: 10, fontSize: 12, color: '#0b5c43' }}>
              {data.automatisering.graad}% van het werk dat het systeem signaleerde is logistiek en
              draait zonder tussenkomst. De overige {data.automatisering.wachtOpJou} punten zijn
              klinische beslissingen — die blijven bij jou.
            </div>
          </div>

          <Kaart titel="Vraagt vandaag als eerste aandacht" icoon="waarschuwing"
            telling={data.urgent.length}>
            {data.urgent.length === 0
              ? <div className="mini">Niets urgents. Dat is ook informatie.</div>
              : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.urgent.map((u) => (
                    <button key={u.patientId + u.titel} className="knop"
                      style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '10px 12px', height: 'auto' }}
                      onClick={() => openPatient(u.patientId)}>
                      <span style={{ color: 'var(--urgent)' }}><Icoon naam="waarschuwing" /></span>
                      <span>
                        <strong>{u.naam}</strong> — {u.titel}
                        <div className="reden">{u.bevinding}</div>
                      </span>
                    </button>
                  ))}
                </div>
              )}
          </Kaart>
        </div>

        <Kaart titel="Hoe dit scherm werkt" icoon="boek">
          <p style={{ marginTop: 0, color: 'var(--ink-2)', fontSize: 12.5 }}>
            De vier kaarten hierboven zijn je werkproces, in volgorde. Je begint links en eindigt
            rechts. Elke kaart zegt wat je er vindt, zodat je niet hoeft te zoeken waar je werk staat.
          </p>
          <ul className="uitleg">
            <li><strong>Voorbereiden</strong> — is het lab binnen, is de vragenlijst ingevuld, waar gaat dit gesprek over?</li>
            <li><strong>Spreekuur</strong> — het plan van deze mens, de suggesties en je registratie in één scherm.</li>
            <li><strong>Monitoren</strong> — alleen wie afwijkt. Wie stabiel is, hoeft niet langs.</li>
            <li><strong>Afronden</strong> — wat er open staat en wat er automatisch is geregeld.</li>
          </ul>
          <p style={{ color: 'var(--ink-2)', fontSize: 12.5, marginBottom: 0 }}>
            Er staat nergens een zorgprogramma. Je werkt met aandachtsgebieden per mens; de
            koppeling naar ketenzorg en declaratie gebeurt automatisch op de achtergrond.
          </p>
        </Kaart>
      </div>
    </>
  );
}
