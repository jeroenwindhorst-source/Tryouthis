import { useState } from 'react';
import { api, type Rapport } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

/**
 * RAPPORTEN
 *
 * "Welke patiënten met diabetes hebben dit jaar geen funduscontrole gehad" wordt in
 * praktijken beantwoord met een datadump naar Excel. Dat werkt, één keer per kwartaal,
 * door één iemand die de export kent — en het antwoord is bij aankomst al verouderd.
 *
 * Dit scherm stelt dezelfde vraag aan de gegevens waarmee het zorgproces zelf draait. Drie
 * dingen onderscheiden het van een rapportagetool die ernaast hangt: je klikt door naar de
 * patiënt (een getal zonder namen is geen werklijst), het draait op dezelfde definities
 * als het scherm van de POH, en de export bevat geen namen.
 */
export function Rapporten({ openPatient }: { openPatient?: (id: string) => void }) {
  const [criteria, setCriteria] = useState<Record<string, string>>({ module: 'glucose' });
  const [uitgevoerd, setUitgevoerd] = useState<Record<string, string>>({ module: 'glucose' });
  const [export_, setExport] = useState<{
    regels: Record<string, string | number>[]; toelichting: string;
  } | undefined>();

  const { data, fout, bezig } = useData(
    () => api.rapport(uitgevoerd), [JSON.stringify(uitgevoerd)]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Rapport" />;

  const zet = (id: string, waarde: string) =>
    setCriteria((c) => {
      const nieuw = { ...c };
      if (waarde === '') delete nieuw[id];
      else nieuw[id] = waarde;
      return nieuw;
    });

  const grootste = data.verdeling[0]?.aantal ?? 1;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Rapporten</h1>
          <div className="onder">
            Zoeken over de hele praktijk, met dezelfde gegevens waarmee het zorgproces draait
          </div>
        </div>
      </div>

      <div className="planbord">
        <div className="planzijde">
          <Kaart titel="Zoekvraag" icoon="filter">
            <p className="reden" style={{ marginTop: 0 }}>
              Een korte lijst met vragen die werkelijk gesteld worden. Een querybuilder over
              honderd velden gebruikt niemand.
            </p>

            {data.velden.map((veld) => (
              <div key={veld.id} style={{ marginBottom: 11 }}>
                <label className="veld">
                  {veld.naam}
                  {veld.eenheid && <span className="mini"> ({veld.eenheid})</span>}
                </label>
                {veld.soort === 'keuze' ? (
                  <select value={criteria[veld.id] ?? ''}
                    onChange={(e) => zet(veld.id, e.target.value)}>
                    <option value="">— maakt niet uit —</option>
                    {veld.opties?.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input type="number" inputMode="decimal" value={criteria[veld.id] ?? ''}
                    placeholder="—" onChange={(e) => zet(veld.id, e.target.value)} />
                )}
                <div className="mini">{veld.uitleg}</div>
              </div>
            ))}

            <div className="knop-rij">
              <button className="knop" data-toon="primair"
                onClick={() => { setUitgevoerd(criteria); setExport(undefined); }}>
                <Icoon naam="vergrootglas" grootte={13} /> Zoeken
              </button>
              <button className="knop" onClick={() => { setCriteria({}); setUitgevoerd({}); }}>
                Leegmaken
              </button>
            </div>
          </Kaart>
        </div>

        <div>
          <Kaart titel="Resultaat" icoon="rapport"
            telling={`${data.totaal} van ${data.vanTotaal}`}>
            <div className="rapportkop">
              <div className="cijfer">{data.totaal}</div>
              <div>
                <strong>{data.omschrijving}</strong>
                <div className="mini">
                  {Math.round((data.totaal / Math.max(1, data.vanTotaal)) * 100)}% van de
                  ingeschreven patiënten
                </div>
              </div>
            </div>

            {data.verdeling.length > 0 && (
              <>
                <div className="mini" style={{ marginTop: 12, marginBottom: 6 }}>
                  Verdeling over aandachtsgebieden
                </div>
                {data.verdeling.map((v) => (
                  <div key={v.label} className="verdeelregel">
                    <span className="naam">{v.label}</span>
                    <span className="balk">
                      <i style={{ width: `${Math.round((v.aantal / grootste) * 100)}%` }} />
                    </span>
                    <span className="getal">{v.aantal}</span>
                  </div>
                ))}
              </>
            )}

            <div className="knop-rij" style={{ marginTop: 13 }}>
              <button className="knop" disabled={data.totaal === 0}
                onClick={async () => setExport(await api.rapportExport(uitgevoerd))}>
                <Icoon naam="uitgaand" grootte={13} /> Exporteren naar BI
              </button>
              <span className="mini" style={{ alignSelf: 'center' }}>
                Geaggregeerd en zonder namen.
              </span>
            </div>

            {export_ && (
              <div className="notitie" style={{ marginTop: 11 }}>
                <strong>Wat er de deur uit gaat.</strong> {export_.toelichting}
                <table className="waardetabel" style={{ marginTop: 9 }}>
                  <thead>
                    <tr><th>Leeftijdsklasse</th><th>Keten</th><th className="rechts">Aantal</th></tr>
                  </thead>
                  <tbody>
                    {export_.regels.map((r, i) => (
                      <tr key={i}>
                        <td>{String(r.leeftijdsklasse)}</td>
                        <td>{String(r.keten)}</td>
                        <td className="rechts getal">{String(r.aantal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Kaart>

          <Kaart titel="Patiënten" icoon="lijst" telling={data.regels.length}>
            {data.regels.length === 0 && (
              <Leeg tekst="Geen patiënten binnen deze zoekvraag." />
            )}
            {data.regels.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Aandachtsgebieden</th>
                    {data.kolomnamen.map((k) => <th key={k}>{k}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.regels.map((regel) => (
                    <tr key={regel.patientId}>
                      <td>
                        <strong>{regel.naam}</strong>
                        <div className="mini">{regel.leeftijd} jaar</div>
                      </td>
                      <td className="mini">
                        {regel.modules.join(', ') || '—'}
                        {regel.ketens.length > 0 && (
                          <div>{regel.ketens.join(', ')}</div>
                        )}
                      </td>
                      {data.kolomnamen.map((naam) => {
                        const kolom = regel.kolommen.find((k) => k.naam === naam);
                        return (
                          <td key={naam}>
                            {kolom ? (
                              <span className="merkje" data-toon={kolom.toon ?? 'neutraal'}>
                                {kolom.waarde}
                              </span>
                            ) : '—'}
                          </td>
                        );
                      })}
                      <td className="rechts">
                        {openPatient && (
                          <button className="knop" onClick={() => openPatient(regel.patientId)}>
                            Dossier <Icoon naam="pijl" grootte={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Kaart>

          <div className="notitie">
            <strong>Waarom hier namen staan en in de export niet.</strong> Het punt van
            "23× funduscontrole ontbreekt" is dat je weet wie dat zijn — anders is het een
            cijfer en geen werklijst. Maar wat naar een BI-omgeving gaat, gaat geaggregeerd en
            gepseudonimiseerd, met groepen kleiner dan vijf samengevoegd. Een export met namen
            is geen rapportage maar een dossierkopie, en die hoort niet buiten het systeem te
            komen zonder de logging die erbij hoort.
          </div>
        </div>
      </div>
    </>
  );
}
