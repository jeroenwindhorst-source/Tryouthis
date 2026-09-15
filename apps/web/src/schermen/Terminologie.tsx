import { useEffect, useRef, useState } from 'react';
import { api, type Ontvangst, type Treffer } from '../api';
import { Icoon } from '../iconen';
import { Kaart } from '../onderdelen';

const NIVEAU_UITLEG: Record<string, string> = {
  registratieset: 'Registreerbaar — ICPC-1 NL met gekoppelde referentieset',
  uitbreidingsset: 'Registreerbaar onder ICPC-paraplu — specifieker dan ICPC',
  extern: 'Niet registreerbaar — ontvangen van buiten, wel toonbaar',
};

const VOORBEELDEN = [
  { code: '44054006', display: 'Type 2 diabetes mellitus', wat: 'zit in onze eigen set' },
  { code: '127013003', display: 'Diabetic nephropathy', wat: 'specifieker dan ICPC' },
  { code: '371087003', display: 'Diabetic foot ulcer', wat: 'extern, wél context' },
  { code: '254837009', display: 'Malignant neoplasm of breast', wat: 'extern, geen relatie' },
];

/**
 * Het drielagenmodel uit docs/02 §2: de ~385.000 externe SNOMED-concepten mogen nooit
 * ongevraagd in een registratiescherm verschijnen, maar moeten wél kunnen binnenkomen.
 */
export function Terminologie() {
  const [vraag, setVraag] = useState('diabetes');
  const [breed, setBreed] = useState(false);
  const [treffers, setTreffers] = useState<Treffer[]>([]);
  const [waarschuwing, setWaarschuwing] = useState('');
  const [ontvangst, setOntvangst] = useState<Ontvangst | undefined>();

  const zoek = async (q: string, b: boolean) => {
    setVraag(q); setBreed(b);
    if (!q.trim()) { setTreffers([]); return; }
    const resultaat = await api.zoek(q, b);
    setTreffers(resultaat.treffers);
    setWaarschuwing(resultaat.waarschuwing);
  };

  const eersteKeer = useRef(true);
  useEffect(() => {
    if (!eersteKeer.current) return;
    eersteKeer.current = false;
    void zoek(vraag, breed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Terminologie</h1>
          <div className="onder">ICPC-1 NL en SNOMED CT naast elkaar, met een harde grens</div>
        </div>
      </div>

      {waarschuwing && (
        <div className="notitie" data-toon="waarschuwing">
          <strong>Demoterminologie.</strong> {waarschuwing}
        </div>
      )}

      <Kaart titel="Zoeken bij registratie" icoon="tag"
        extra={
          <div className="segment" style={{ marginLeft: 10 }}>
            <button data-actief={!breed} onClick={() => zoek(vraag, false)}>alleen registreerbaar</button>
            <button data-actief={breed} onClick={() => zoek(vraag, true)}>ook externe concepten</button>
          </div>
        }>
        <input type="search" value={vraag}
          placeholder="Zoek op term, synoniem of ICPC-code — bijvoorbeeld 'suikerziekte' of 'T90'"
          onChange={(e) => zoek(e.target.value, breed)} />
        <p className="reden" style={{ marginTop: 8, marginBottom: 0 }}>
          Standaard zoekt de zorgverlener alleen in wat hij mág registreren. Breder zoeken is een
          bewuste handeling — anders krijg je 385.000 concepten in een registratiescherm.
        </p>
      </Kaart>

      <Kaart titel="Treffers" telling={treffers.length} strak>
        <table>
          <thead>
            <tr>
              <th style={{ width: 240 }}>Term</th>
              <th style={{ width: 90 }}>ICPC</th>
              <th style={{ width: 115 }}>SNOMED</th>
              <th>Niveau</th>
              <th style={{ width: 110 }}>Match op</th>
            </tr>
          </thead>
          <tbody>
            {treffers.map((t) => (
              <tr key={t.concept.snomed}>
                <td className="nadruk">
                  {t.concept.display}
                  {t.concept.fsn && <div className="mini">{t.concept.fsn}</div>}
                </td>
                <td>{t.concept.icpc1 ?? <span className="mini">—</span>}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{t.concept.snomed}</td>
                <td>
                  <span className="merkje" data-toon={t.concept.niveau === 'extern' ? 'extern' : 'ok'}>
                    {t.concept.niveau}
                  </span>
                  <div className="mini">{NIVEAU_UITLEG[t.concept.niveau]}</div>
                </td>
                <td className="mini">{t.reden}</td>
              </tr>
            ))}
            {treffers.length === 0 && <tr><td colSpan={5} className="leeg">Geen treffers.</td></tr>}
          </tbody>
        </table>
      </Kaart>

      <Kaart titel="Inkomende code van een externe partij" icoon="gesprek">
        <p className="reden" style={{ marginTop: 0 }}>
          Wat gebeurt er als het ziekenhuis een SNOMED-code stuurt? Het origineel wordt nooit
          weggegooid en nooit stilzwijgend vervangen — onze interpretatie komt ernaast.
        </p>
        <div className="knop-rij">
          {VOORBEELDEN.map((v) => (
            <button key={v.code} className="knop"
              onClick={() => api.ontvang(v.code, v.display).then(setOntvangst)}>
              {v.display} <span className="mini">({v.wat})</span>
            </button>
          ))}
        </div>

        {ontvangst && (
          <div style={{ marginTop: 14 }}>
            <div className="regel">
              <span className="sleutel">Advies</span>
              <span className="waarde">
                <span className="merkje" data-toon={ontvangst.advies.startsWith('overnemen') ? 'ok' : 'extern'}>
                  {ontvangst.advies}
                </span>
              </span>
            </div>
            <div className="regel">
              <span className="sleutel">Toelichting</span>
              <span className="waarde" style={{ maxWidth: '68%', fontWeight: 400, textAlign: 'right' }}>
                {ontvangst.toelichting}
              </span>
            </div>
            {ontvangst.gecodeerd.icpc1 && (
              <div className="regel">
                <span className="sleutel">Eigen codering</span>
                <span className="waarde">
                  {ontvangst.gecodeerd.icpc1.code} — {ontvangst.gecodeerd.icpc1.display}
                </span>
              </div>
            )}
            {ontvangst.context && ontvangst.advies === 'tonen-als-extern-met-context' && (
              <div className="regel">
                <span className="sleutel">Context in ons kader</span>
                <span className="waarde">{ontvangst.context.display} ({ontvangst.context.icpc1})</span>
              </div>
            )}
          </div>
        )}
      </Kaart>
    </>
  );
}
