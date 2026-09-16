import { useState } from 'react';
import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden } from '../onderdelen';

/**
 * Dagafsluiting.
 *
 * "Handel alle negen in één keer af" is alleen acceptabel als je kunt zien wát je
 * afhandelt. Daarom staat elk item er met naam, actie en reden, standaard aangevinkt en
 * los uit te zetten. In controle zijn betekent: kunnen kiezen, niet alleen kunnen
 * bevestigen.
 */
export function Afronden() {
  const { data, fout, bezig } = useData(() => api.afronden());
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({});
  const [uitgezet, setUitgezet] = useState<Record<string, boolean>>({});
  const [afgehandeld, setAfgehandeld] = useState<Record<string, number>>({});

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Dagafsluiting" />;

  const gekozen = (punt: { items: { id: string }[]; categorie: string }) =>
    punt.items.filter((i) => !uitgezet[i.id]);

  const open = data.punten.filter((p) => p.aantal > 0 && afgehandeld[p.categorie] === undefined);

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Afronden</h1>
          <div className="onder">{open.length === 0 ? 'Je dag is rond.' : `${open.length} punten open`}</div>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="automatisch">
          <h3><Icoon naam="afvinken" /> Klaar</h3>
          <div style={{ fontSize: 12.5, color: 'var(--ok)' }}>
            Alle registraties zijn compleet, de verantwoording is op orde en er staat niets open.
          </div>
        </div>
      ) : (
        <div className="notitie">
          <strong>Je ziet wat je afhandelt.</strong> Elk punt is uitklapbaar: per regel staat de
          patiënt, de actie die wordt uitgevoerd en waarom die openstaat. Alles staat standaard aan;
          wat je niet wilt, vink je uit. Wat een klinisch oordeel vraagt, kan sowieso niet in bulk.
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.punten.map((punt) => {
          const klaar = punt.aantal === 0 || afgehandeld[punt.categorie] !== undefined;
          const uit = uitgeklapt[punt.categorie];
          const selectie = gekozen(punt);
          return (
            <section key={punt.categorie} className="kaart">
              <header>
                <span style={{ color: klaar ? 'var(--ok)' : punt.blokkerend ? 'var(--urgent)' : 'var(--aandacht)' }}>
                  <Icoon naam={klaar ? 'afvinken' : punt.blokkerend ? 'waarschuwing' : 'klembord'} />
                </span>
                <h2>{punt.categorie}</h2>
                {punt.blokkerend && !klaar && <span className="merkje" data-toon="urgent">blokkerend</span>}
                <span className="telling">
                  {klaar ? `${afgehandeld[punt.categorie] ?? punt.aantal} afgehandeld` : punt.aantal}
                </span>
              </header>
              <div className="body">
                <div style={{ fontWeight: 550, marginBottom: 3 }}>{punt.omschrijving}</div>
                <div className="reden">{punt.toelichting}</div>

                {!klaar && punt.items.length > 0 && (
                  <>
                    <button className="knop" data-toon="stil" style={{ marginTop: 10 }}
                      onClick={() => setUitgeklapt((u) => ({ ...u, [punt.categorie]: !uit }))}>
                      <Icoon naam={uit ? 'kruis' : 'lijst'} grootte={13} />
                      {uit ? 'Verberg de regels' : `Toon de ${punt.items.length} regels`}
                    </button>

                    {uit && (
                      <table style={{ marginTop: 10 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 34 }} />
                            <th style={{ width: 170 }}>Patiënt</th>
                            <th>Wat er gebeurt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {punt.items.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <input type="checkbox" checked={!uitgezet[item.id]}
                                  onChange={(e) => setUitgezet((u) => ({ ...u, [item.id]: !e.target.checked }))} />
                              </td>
                              <td className="nadruk">{item.naam}</td>
                              <td>
                                {item.actie}
                                <div className="mini" style={{ marginTop: 2 }}>{item.detail}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {!klaar && (
                  <div className="knop-rij" style={{ marginTop: 12 }}>
                    {punt.bulkVeilig ? (
                      <button className="knop" data-toon="primair" disabled={selectie.length === 0}
                        onClick={() => setAfgehandeld((a) => ({ ...a, [punt.categorie]: selectie.length }))}>
                        <Icoon naam="bliksem" grootte={13} />
                        {selectie.length === punt.items.length
                          ? `Alle ${selectie.length} afhandelen`
                          : `${selectie.length} geselecteerde afhandelen`}
                      </button>
                    ) : (
                      <button className="knop" onClick={() => setUitgeklapt((u) => ({ ...u, [punt.categorie]: true }))}>
                        <Icoon naam="lijst" grootte={13} /> Stuk voor stuk beoordelen
                      </button>
                    )}
                    <button className="knop" data-toon="stil">Later</button>
                    {selectie.length !== punt.items.length && punt.items.length > 0 && (
                      <span className="mini" style={{ alignSelf: 'center' }}>
                        {punt.items.length - selectie.length} uitgevinkt, blijft openstaan
                      </span>
                    )}
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
