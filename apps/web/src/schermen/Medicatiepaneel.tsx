import { useEffect, useState } from 'react';
import {
  api, type Catalogustreffer, type Gebruiker, type Medicatieoverzicht, type Medicatieregel,
  type Medicatievoorbeeld, type Medicatiewijziging, type Wijzigingsoort,
} from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Laden, Leeg } from '../onderdelen';

const SOORTEN: { id: Wijzigingsoort; label: string; uitleg: string; icoon: string }[] = [
  { id: 'dosering', label: 'Dosering aanpassen', icoon: 'schakelaar',
    uitleg: 'Zelfde middel, andere sterkte of frequentie.' },
  { id: 'vervangen', label: 'Vervangen', icoon: 'uitgaand',
    uitleg: 'Dit middel stopt, een ander start.' },
  { id: 'stoppen', label: 'Stoppen', icoon: 'kruis',
    uitleg: 'Het middel stopt en er gaat geen recept uit.' },
];

const ROUTES: { id: 'digitaal' | 'print' | 'meegeven'; label: string; uitleg: string; icoon: string }[] = [
  { id: 'digitaal', label: 'Elektronisch naar de apotheek', icoon: 'uitgaand',
    uitleg: 'Ligt vandaag klaar; de patiënt hoeft niets mee te nemen.' },
  { id: 'print', label: 'Printen aan de balie', icoon: 'document',
    uitleg: 'Voor een apotheek die niet elektronisch ontvangt, of als de patiënt het liever meeneemt.' },
  { id: 'meegeven', label: 'Meegeven, apotheek onbekend', icoon: 'persoon',
    uitleg: 'De patiënt kiest zelf waar hij het inlevert.' },
];

/**
 * HET MEDICATIEPANEEL
 *
 * Een middel wijzigen is één handeling voor de zorgverlener en vier voor het dossier: het
 * oude stopt, het nieuwe start, de lopende order wordt ingetrokken en er gaat een recept
 * uit. Bestaande systemen laten je die vier los van elkaar doen, en dat is precies waar
 * het misgaat — een verhoogde dosering zonder recept, of een recept zonder dat het oude
 * gestopt is, en dan staat er twee keer metformine in het dossier.
 *
 * Daarom schuift dit paneel open naast het dossier, net als het orderpaneel: je blijft
 * waar je was, je ziet wat er staat, je past het aan, en vóórdat je bevestigt staat er in
 * zinnen wat er gaat gebeuren.
 *
 * De keuze waar het recept heen gaat, hoort bij het recept en niet bij de patiënt. Iemand
 * gebruikt meestal dezelfde apotheek — die staat voorgeselecteerd — maar wie morgen bij
 * zijn dochter logeert, wil het daar ophalen. Een systeem dat de voorkeursapotheek
 * vastzet, dwingt tot bellen.
 */
export function Medicatiepaneel({ patientId, patientNaam, gebruiker, startMiddelId, opSluit, opGewijzigd }: {
  patientId: string;
  patientNaam: string;
  gebruiker: Gebruiker;
  /** Direct openen op één middel, als je daarop geklikt hebt. */
  startMiddelId?: string;
  opSluit: () => void;
  opGewijzigd: (overzicht: Medicatieoverzicht) => void;
}) {
  const { data, fout, bezig, setData } = useData(
    () => api.medicatieoverzicht(patientId), [patientId]);

  const [middelId, setMiddelId] = useState<string | undefined>(startMiddelId);
  const [nieuwStarten, setNieuwStarten] = useState(false);
  const [soort, setSoort] = useState<Wijzigingsoort>('dosering');
  const [dosering, setDosering] = useState('');
  const [vervanger, setVervanger] = useState<Catalogustreffer | undefined>();
  const [zoek, setZoek] = useState('');
  const [treffers, setTreffers] = useState<Catalogustreffer[]>([]);
  const [reden, setReden] = useState('');
  const [route, setRoute] = useState<'digitaal' | 'print' | 'meegeven'>('digitaal');
  const [apotheekId, setApotheekId] = useState<string | undefined>();
  const [opmerking, setOpmerking] = useState('');
  const [episodeId, setEpisodeId] = useState('');
  const [voorbeeld, setVoorbeeld] = useState<Medicatievoorbeeld | undefined>();
  const [bezigMet, setBezigMet] = useState(false);
  const [klaar, setKlaar] = useState<{ naarAutorisatie: boolean; regels: string[] } | undefined>();

  const gekozen: Medicatieregel | undefined = data?.lopend.find((m) => m.id === middelId);

  // De voorkeursapotheek staat voorgeselecteerd zodra we weten welke het is. Voorselecteren
  // scheelt een handeling; vastzetten zou een beslissing afnemen.
  useEffect(() => {
    if (data && !apotheekId) setApotheekId(data.voorkeursapotheek.id);
  }, [data, apotheekId]);

  // Openen op een middel betekent: je wilt dáár iets mee. De dosering staat alvast in het
  // veld zodat aanpassen typen is en geen overtypen.
  useEffect(() => {
    if (gekozen) { setDosering(gekozen.dosering); setSoort('dosering'); }
  }, [gekozen?.id]);

  useEffect(() => {
    if (zoek.trim().length < 2) { setTreffers([]); return; }
    let geldig = true;
    api.zoekOrders(patientId, zoek, ['medicatie'])
      .then((uitkomst) => { if (geldig) setTreffers(uitkomst); })
      .catch(() => { if (geldig) setTreffers([]); });
    return () => { geldig = false; };
  }, [patientId, zoek]);

  const wijziging: Medicatiewijziging | undefined = (() => {
    if (nieuwStarten) {
      if (!vervanger) return undefined;
      return {
        patientId, soort: 'starten', reden,
        nieuw: { atc: vervanger.atc ?? '', naam: vervanger.naam, dosering },
        aflevering: { route, apotheekId, opmerking: opmerking.trim() || undefined },
        episodeId: episodeId || undefined,
      };
    }
    if (!gekozen) return undefined;
    if (soort === 'stoppen') {
      return {
        patientId, soort, statementId: gekozen.id, reden,
        aflevering: { route: 'meegeven' },
        episodeId: episodeId || undefined,
      };
    }
    if (soort === 'vervangen') {
      if (!vervanger) return undefined;
      return {
        patientId, soort, statementId: gekozen.id, reden,
        nieuw: { atc: vervanger.atc ?? '', naam: vervanger.naam, dosering },
        aflevering: { route, apotheekId, opmerking: opmerking.trim() || undefined },
        episodeId: episodeId || undefined,
      };
    }
    return {
      patientId, soort: 'dosering', statementId: gekozen.id, reden,
      nieuw: { atc: gekozen.atc ?? '', naam: gekozen.naam, dosering },
      aflevering: { route, apotheekId, opmerking: opmerking.trim() || undefined },
      episodeId: episodeId || undefined,
    };
  })();

  // Wat er gaat gebeuren komt uit de domeinlaag en niet uit dit scherm. Zo kunnen de
  // zinnen die je leest en de handeling die volgt niet uit elkaar lopen.
  const sleutel = JSON.stringify(wijziging);
  useEffect(() => {
    if (!wijziging) { setVoorbeeld(undefined); return; }
    let geldig = true;
    api.medicatievoorbeeld(wijziging)
      .then((v) => { if (geldig) setVoorbeeld(v); })
      .catch(() => { if (geldig) setVoorbeeld(undefined); });
    return () => { geldig = false; };
  }, [sleutel]);

  const voerUit = async () => {
    if (!wijziging) return;
    setBezigMet(true);
    try {
      const uitkomst = await api.wijzigMedicatie(gebruiker.id, wijziging);
      setData(uitkomst.overzicht);
      opGewijzigd(uitkomst.overzicht);
      setKlaar({ naarAutorisatie: uitkomst.naarAutorisatie, regels: voorbeeld?.regels ?? [] });
    } finally { setBezigMet(false); }
  };

  const opnieuw = () => {
    setKlaar(undefined); setMiddelId(undefined); setNieuwStarten(false);
    setVervanger(undefined); setZoek(''); setReden(''); setOpmerking('');
  };

  const mag = gebruiker.rechten.includes('medicatie-voorschrijven');
  const compleet = Boolean(wijziging)
    && reden.trim() !== ''
    && (soort === 'stoppen' || dosering.trim() !== '')
    && !voorbeeld?.waarschuwing;

  return (
    <>
      <div className="paneel-scherm" onClick={opSluit} />
      <aside className="orderpaneel" role="dialog" aria-label="Medicatie wijzigen">
        <header>
          <div>
            <h2>Medicatie</h2>
            <div className="mini">{patientNaam}</div>
          </div>
          <button className="knop" data-toon="stil" onClick={opSluit} title="Sluiten">
            <Icoon naam="kruis" grootte={15} />
          </button>
        </header>

        <div className="paneel-body">
          {fout && <Fout boodschap={fout} />}
          {(bezig || !data) && !fout && <Laden wat="Medicatie" />}

          {data && klaar && (
            <div className="notitie" data-toon="ok">
              <strong>
                {klaar.naarAutorisatie
                  ? 'Voorgelegd aan de huisarts.'
                  : 'Doorgevoerd en verstuurd.'}
              </strong>
              <ul className="uitleg" style={{ marginTop: 6 }}>
                {klaar.regels.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {klaar.naarAutorisatie && (
                <p className="mini" style={{ marginBottom: 0 }}>
                  Het middel is in het dossier gewijzigd; het recept staat klaar ter
                  accordering en gaat pas uit als de huisarts tekent (docs/16 §4).
                </p>
              )}
              <div className="knop-rij" style={{ marginTop: 10 }}>
                <button className="knop" onClick={opnieuw}>
                  <Icoon naam="pil" grootte={13} /> Nog een middel aanpassen
                </button>
                <button className="knop" data-toon="stil" onClick={opSluit}>Sluiten</button>
              </div>
            </div>
          )}

          {data && !klaar && !gekozen && !nieuwStarten && (
            <>
              <p className="mini" style={{ marginTop: 0 }}>
                Kies het middel dat je wilt aanpassen. Het oude stopt, het nieuwe start en
                het recept gaat in dezelfde handeling de deur uit.
              </p>

              {data.lopend.length === 0 && <Leeg tekst="Geen lopende medicatie." />}
              {data.lopend.map((m) => (
                <button key={m.id} className="middelregel" onClick={() => setMiddelId(m.id)}>
                  <span className="ikoon"><Icoon naam="pil" grootte={15} /></span>
                  <span className="tekst">
                    <strong>{m.naam}</strong>
                    <span className="mini">
                      {m.dosering}
                      {m.begin ? ` · sinds ${m.begin}` : ''}
                      {m.chronisch ? ' · chronisch' : ''}
                    </span>
                    {m.laatsteOrder && (
                      <span className="mini">
                        laatste recept {m.laatsteOrder.geplaatstOp}
                        {m.laatsteOrder.bestemming ? ` · ${m.laatsteOrder.bestemming}` : ''}
                        {' · '}{m.laatsteOrder.status}
                      </span>
                    )}
                    {m.waarschuwingen.map((w, i) => (
                      <span key={i} className="merkje"
                        data-toon={w.ernst === 'blokkerend' ? 'urgent' : 'aandacht'}>
                        {w.tekst}
                      </span>
                    ))}
                  </span>
                  <Icoon naam="pijl" grootte={13} />
                </button>
              ))}

              <button className="knop" style={{ marginTop: 10 }}
                onClick={() => { setNieuwStarten(true); setSoort('starten'); setDosering(''); }}>
                <Icoon naam="plus" grootte={13} /> Nieuw middel starten
              </button>

              {data.gestopt.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="mini" style={{ marginBottom: 5 }}>Eerder gestopt</div>
                  {data.gestopt.map((m) => (
                    <div key={m.id} className="regel">
                      <span className="sleutel" style={{ fontWeight: 400 }}>
                        {m.naam}
                        <div className="mini">{m.dosering}</div>
                      </span>
                      <span className="waarde" style={{ fontWeight: 400, fontSize: 12 }}>
                        {m.einde ? `gestopt ${m.einde}` : 'gestopt'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {data && !klaar && (gekozen || nieuwStarten) && (
            <>
              <button className="knop" data-toon="stil" style={{ marginBottom: 10 }}
                onClick={() => { setMiddelId(undefined); setNieuwStarten(false); setVervanger(undefined); setZoek(''); }}>
                <Icoon naam="pijl-links" grootte={13} /> Ander middel
              </button>

              {gekozen && (
                <div className="middelkop">
                  <div>
                    <strong>{gekozen.naam}</strong>
                    <div className="mini">
                      {gekozen.dosering} · {gekozen.atc}
                      {gekozen.begin ? ` · sinds ${gekozen.begin}` : ''}
                    </div>
                  </div>
                  {gekozen.waarschuwingen.map((w, i) => (
                    <div key={i} className="waarschuwing" data-ernst={w.ernst}>
                      <Icoon naam="waarschuwing" grootte={13} />
                      <span>{w.tekst}{w.bron && <div className="mini">{w.bron}</div>}</span>
                    </div>
                  ))}
                </div>
              )}

              {gekozen && (
                <>
                  <label className="veld">Wat ga je doen?</label>
                  <div className="routekeuze" style={{ marginBottom: 12 }}>
                    {SOORTEN.map((s) => (
                      <button key={s.id} className="routeknop" data-actief={soort === s.id}
                        onClick={() => {
                          setSoort(s.id);
                          setVervanger(undefined); setZoek('');
                          setDosering(s.id === 'vervangen' ? '' : gekozen.dosering);
                        }}>
                        <strong><Icoon naam={s.icoon} grootte={12} /> {s.label}</strong>
                        <span className="mini">{s.uitleg}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {(soort === 'vervangen' || nieuwStarten) && (
                <>
                  <label className="veld">
                    {nieuwStarten ? 'Welk middel start je?' : 'Waarmee vervang je het?'}
                  </label>
                  {vervanger ? (
                    <div className="middelkop" style={{ marginBottom: 10 }}>
                      <div>
                        <strong>{vervanger.naam}</strong>
                        <div className="mini">{vervanger.atc}</div>
                      </div>
                      <button className="knop" data-toon="stil"
                        onClick={() => { setVervanger(undefined); setDosering(''); }}>
                        <Icoon naam="kruis" grootte={12} /> Ander middel kiezen
                      </button>
                      {vervanger.waarschuwingen.map((w, i) => (
                        <div key={i} className="waarschuwing" data-ernst={w.ernst}>
                          <Icoon naam="waarschuwing" grootte={13} />
                          <span>{w.tekst}{w.bron && <div className="mini">{w.bron}</div>}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="zoekdoos" style={{ marginBottom: 8, maxWidth: 'none' }}>
                        <span className="icoon"><Icoon naam="vergrootglas" grootte={15} /></span>
                        <input type="search" value={zoek} autoFocus
                          placeholder="Zoek op naam, ATC of indicatie"
                          onChange={(e) => setZoek(e.target.value)} />
                      </div>
                      {zoek.trim().length >= 2 && treffers.length === 0 && (
                        <p className="mini">
                          Niets gevonden. Het demoformularium is klein en bewust onvolledig.
                        </p>
                      )}
                      {treffers.slice(0, 8).map((t) => (
                        <button key={t.id} className="middelregel"
                          onClick={() => { setVervanger(t); setDosering(t.detail); }}>
                          <span className="ikoon"><Icoon naam="pil" grootte={15} /></span>
                          <span className="tekst">
                            <strong>{t.naam}</strong>
                            <span className="mini">{t.detail} · {t.atc}</span>
                            {t.waarschuwingen.map((w, i) => (
                              <span key={i} className="merkje"
                                data-toon={w.ernst === 'blokkerend' ? 'urgent' : 'aandacht'}>
                                {w.tekst}
                              </span>
                            ))}
                          </span>
                          <Icoon naam="plus" grootte={13} />
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}

              {soort !== 'stoppen' && (vervanger || soort === 'dosering') && (
                <>
                  <label className="veld">Dosering</label>
                  <input type="text" value={dosering} onChange={(e) => setDosering(e.target.value)} />
                  {(vervanger?.varianten ?? []).length > 0 && (
                    <div className="chips" style={{ marginTop: 7 }}>
                      {vervanger!.varianten.map((v) => (
                        <button key={v} className="filterchip" data-actief={dosering === v}
                          onClick={() => setDosering(v)}>{v}</button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/*
                Verplicht, en met knoppen erbij. Een verplicht vrij tekstveld levert "ivm"
                op; een lijst met wat er werkelijk speelt levert iets op wat een collega
                over een jaar kan lezen.
              */}
              <label className="veld" style={{ marginTop: 12 }}>Waarom?</label>
              <input type="text" value={reden} placeholder="Verplicht — dit staat straks in het journaal"
                onChange={(e) => setReden(e.target.value)} />
              <div className="chips" style={{ marginTop: 7 }}>
                {(data.redenen[nieuwStarten ? 'starten' : soort] ?? []).map((r) => (
                  <button key={r} className="filterchip" data-actief={reden === r}
                    onClick={() => setReden(r)}>{r}</button>
                ))}
              </div>

              {data.episodes.length > 0 && (
                <>
                  <label className="veld" style={{ marginTop: 12 }}>Bij welke episode hoort dit?</label>
                  <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)}>
                    <option value="">— geen episode —</option>
                    {data.episodes.map((e) => (
                      <option key={e.id} value={e.id}>{e.icpc} — {e.titel}</option>
                    ))}
                  </select>
                </>
              )}

              {soort !== 'stoppen' && (
                <>
                  <label className="veld" style={{ marginTop: 14 }}>Waar gaat het recept heen?</label>
                  <div className="routekeuze">
                    {ROUTES.map((r) => (
                      <button key={r.id} className="routeknop" data-actief={route === r.id}
                        onClick={() => setRoute(r.id)}>
                        <strong><Icoon naam={r.icoon} grootte={12} /> {r.label}</strong>
                        <span className="mini">{r.uitleg}</span>
                      </button>
                    ))}
                  </div>

                  {route === 'digitaal' && (
                    <div style={{ marginTop: 9 }}>
                      <label className="veld">Welke apotheek?</label>
                      <select value={apotheekId ?? ''} onChange={(e) => setApotheekId(e.target.value)}>
                        {data.apotheken.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.naam} — {a.plaats}
                            {a.id === data.voorkeursapotheek.id ? ' (vaste apotheek)' : ''}
                            {a.digitaal ? '' : ' — geen elektronische ontvangst'}
                          </option>
                        ))}
                      </select>
                      <div className="mini" style={{ marginTop: 5 }}>
                        {data.apotheken.find((a) => a.id === apotheekId)?.bijzonderheid
                          ?? 'Deze keuze geldt voor dit recept, niet voor de patiënt.'}
                      </div>
                    </div>
                  )}

                  <label className="veld" style={{ marginTop: 11 }}>
                    Opmerking voor de apotheek <span className="mini">(optioneel)</span>
                  </label>
                  <input type="text" value={opmerking}
                    placeholder="Met spoed · in de weekdoos · kleine verpakking"
                    onChange={(e) => setOpmerking(e.target.value)} />
                </>
              )}
            </>
          )}
        </div>

        {data && !klaar && (gekozen || nieuwStarten) && (
          <footer className="paneel-voet">
            {/*
              De samenvatting staat vóór de knop en niet erna: daarna is het een mededeling.
              De zinnen komen uit dezelfde functie die de wijziging straks uitvoert.
            */}
            {voorbeeld && voorbeeld.regels.length > 0 && (
              <div className="watergebeurt">
                <div className="mini">Dit gaat er gebeuren</div>
                <ul className="uitleg">
                  {voorbeeld.regels.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {voorbeeld?.waarschuwing && (
              <div className="waarschuwing" data-ernst="blokkerend">
                <Icoon naam="waarschuwing" grootte={13} />
                <span>{voorbeeld.waarschuwing}</span>
              </div>
            )}

            {voorbeeld?.waarschuwingen.map((w, i) => (
              <div key={i} className="waarschuwing" data-ernst={w.ernst}>
                <Icoon naam="waarschuwing" grootte={13} />
                <span>{w.tekst}{w.bron && <div className="mini">{w.bron}</div>}</span>
              </div>
            ))}

            <div className="knop-rij">
              <button className="knop" data-toon="primair" disabled={!compleet || bezigMet}
                onClick={voerUit}>
                <Icoon naam={soort === 'stoppen' ? 'kruis' : 'uitgaand'} grootte={13} />
                {soort === 'stoppen'
                  ? 'Stoppen vastleggen'
                  : mag ? 'Wijzigen en recept versturen' : 'Wijzigen en voorleggen aan de huisarts'}
              </button>
              <button className="knop" data-toon="stil" onClick={opSluit}>Annuleren</button>
            </div>

            {!mag && soort !== 'stoppen' && (
              <div className="mini">
                Jij mag medicatie voorstellen, niet voorschrijven. De wijziging gaat het
                dossier in en het recept wacht op de huisarts.
              </div>
            )}
            {reden.trim() === '' && (
              <div className="mini">Vul eerst in waarom je dit doet.</div>
            )}
          </footer>
        )}
      </aside>
    </>
  );
}
