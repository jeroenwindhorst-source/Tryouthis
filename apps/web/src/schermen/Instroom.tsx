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

      <div style={{ display: 'grid', gap: 12 }}>
        {data.map((regel) => (
          <section key={regel.patientId} className="kaart">
            <header>
              <h2 style={{ fontSize: 15 }}>{regel.naam}</h2>
              <span className="mini">{regel.leeftijd} jaar</span>
              <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
                onClick={() => openPatient(regel.patientId)}>
                Dossier <Icoon naam="pijl" grootte={13} />
              </button>
            </header>
            <div className="body">
              <div style={{ display: 'grid', gap: 10 }}>
                {regel.nieuweModules.map((m) => (
                  <div key={m.moduleId} className={`modulekaart mod-${m.moduleId}`}>
                    <div className="kop">
                      <span style={{ color: 'var(--tint)' }}>
                        <Icoon naam={icoonVanModule(m.moduleId, m.icoon)} />
                      </span>
                      <h3>{m.naam}</h3>
                      <button className="knop" data-toon="primair" style={{ marginLeft: 'auto' }}
                        disabled={bezigMet === regel.patientId + m.moduleId}
                        onClick={() => accepteer(regel.patientId, m.moduleId)}>
                        <Icoon naam="plus" grootte={13} /> Toevoegen aan plan
                      </button>
                    </div>
                    <div className="reden">{m.onderbouwing}</div>
                  </div>
                ))}
              </div>

              <div className="raster2" style={{ marginTop: 12 }}>
                <div>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', marginBottom: 6 }}>
                    Wat er gebeurt als je akkoord gaat
                  </h3>
                  <ul className="uitleg">{regel.gevolgen.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </div>
                <div>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', marginBottom: 6 }}>
                    Achtergrond: declaratie
                  </h3>
                  {regel.ketens.length > 0 ? (
                    <ul className="uitleg">
                      {regel.ketens.map((k) => <li key={k.naam}>{k.naam} ({k.prestatiecode})</li>)}
                    </ul>
                  ) : (
                    <span className="mini">
                      Valt onder geen landelijke keten. De zorg is er niet minder nodig om.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
