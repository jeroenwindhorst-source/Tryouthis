import { useState } from 'react';
import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden } from '../onderdelen';

/**
 * Dagafsluiting (docs/05 §1.4): is mijn dag aantoonbaar af?
 *
 * Het verschil met een teller van 163 openstaande items: elk punt draagt een reden en,
 * waar het veilig kan, een afhandeling in bulk. Wat een mens moet beoordelen staat apart.
 */
export function Afronden() {
  const { data, fout, bezig } = useData(() => api.afronden());
  const [afgehandeld, setAfgehandeld] = useState<Record<string, boolean>>({});

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Dagafsluiting" />;

  const open = data.punten.filter((p) => p.aantal > 0 && !afgehandeld[p.categorie]);

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Afronden</h1>
          <div className="onder">
            {open.length === 0 ? 'Je dag is rond.' : `${open.length} punten open`}
          </div>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="automatisch">
          <h3><Icoon naam="afvinken" /> Klaar</h3>
          <div style={{ fontSize: 12.5, color: '#12684d' }}>
            Alle registraties zijn compleet, de verantwoording is op orde en er staat niets open.
          </div>
        </div>
      ) : (
        <div className="notitie">
          <strong>Wat je hier kunt doen.</strong> Elk punt zegt waaróm het openstaat. Wat logistiek
          is en geen klinische beslissing bevat, kun je in één handeling afdoen — dat is het
          verschil met een lijst van 163 regels die je stuk voor stuk moet uitzoeken.
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.punten.map((punt) => {
          const klaar = punt.aantal === 0 || afgehandeld[punt.categorie];
          return (
            <section key={punt.categorie} className="kaart">
              <header>
                <span style={{ color: klaar ? 'var(--ok)' : punt.blokkerend ? 'var(--urgent)' : 'var(--aandacht)' }}>
                  <Icoon naam={klaar ? 'afvinken' : punt.blokkerend ? 'waarschuwing' : 'klembord'} />
                </span>
                <h2>{punt.categorie}</h2>
                {punt.blokkerend && !klaar && <span className="merkje" data-toon="urgent">blokkerend</span>}
                <span className="telling">{klaar ? 'afgerond' : punt.aantal}</span>
              </header>
              <div className="body">
                <div style={{ fontWeight: 550, marginBottom: 3 }}>{punt.omschrijving}</div>
                <div className="reden">{punt.toelichting}</div>
                {!klaar && (
                  <div className="knop-rij" style={{ marginTop: 11 }}>
                    {punt.bulkVeilig ? (
                      <button className="knop" data-toon="primair"
                        onClick={() => setAfgehandeld((a) => ({ ...a, [punt.categorie]: true }))}>
                        <Icoon naam="bliksem" grootte={13} /> Alle {punt.aantal} in één keer afhandelen
                      </button>
                    ) : (
                      <button className="knop">
                        <Icoon naam="lijst" grootte={13} /> Stuk voor stuk beoordelen
                      </button>
                    )}
                    <button className="knop" data-toon="stil">Later</button>
                  </div>
                )}
                {!klaar && !punt.bulkVeilig && (
                  <div className="gevolg" style={{ marginTop: 6 }}>
                    Hier zit een klinische beoordeling in; bulkafhandeling is daarom uitgeschakeld.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Kaart titel="Verantwoording gebeurt vanzelf" icoon="tag">
        <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 12.5 }}>
          Je hebt vandaag nergens “voor de keten” geregistreerd. De koppeling naar DM-, CVRM- en
          COPD-ketenzorg is automatisch afgeleid uit wat je feitelijk hebt vastgelegd. Wat hierboven
          onder Verantwoording staat, zijn de gaten die daaruit overblijven — geen apart invulwerk.
        </p>
      </Kaart>
    </>
  );
}
