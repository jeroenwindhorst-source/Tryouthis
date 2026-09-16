import { useState } from 'react';
import {
  api, type Gebruiker, type Verrichtingbeeld, type Verrichtingsoort,
} from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const BEOORDELAAR = [
  { id: 'zelf', label: 'Ik beoordeel het zelf', uitleg: 'De uitslag is duidelijk en je handelt hem nu af.' },
  { id: 'huisarts', label: 'Huisarts beoordeelt', uitleg: 'Gaat naar de autorisatiestroom, met de uitslag erbij.' },
  { id: 'teleconsultatie', label: 'Specialist op afstand', uitleg: 'Teleconsultatie: vraagstelling mee, antwoord doorgaans binnen een werkdag.' },
] as const;

/**
 * VERRICHTINGEN
 *
 * Een order voor een ECG is niet af als het ECG gemaakt is. Er komt een strook uit, er
 * moet iemand naar kijken, en dat is vaak iemand anders dan wie hem aanvroeg. In veel
 * systemen stopt het spoor bij "aangevraagd" en belandt de uitslag als los document
 * ergens in het dossier.
 *
 * Hier hangt de uitkomst aan de order, met de uitvoerder erbij — meestal de assistent —
 * en met een expliciete keuze wie hem beoordeelt. Die derde optie, de specialist op
 * afstand, is de interessantste: een ECG dat de cardioloog binnen een dag beoordeelt,
 * voorkomt een verwijzing als het beeld goedaardig blijkt.
 */
export function Verrichtingen({ patientId, patientNaam, gebruiker }: {
  patientId: string;
  patientNaam: string;
  gebruiker: Gebruiker;
}) {
  const { data, fout, bezig, setData } = useData(
    () => api.verrichtingen(patientId), [patientId]);
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Verrichtingen" />;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Verrichtingen</h1>
          <div className="onder">{patientNaam} · uitvoeren, vastleggen en laten beoordelen</div>
        </div>
      </div>

      <div className="raster2" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        <div>
          <Kaart titel="Uit te voeren" icoon="radar" telling={data.open.length}>
            {data.open.length === 0 && (
              <Leeg tekst="Niets openstaand. Aanvragen doe je via Bestellen → Onderzoek." />
            )}
            {data.open.map(({ order, soort }) => (
              <Uitvoerblok key={order.id} orderId={order.id} omschrijving={order.omschrijving}
                soort={soort} patientId={patientId} gebruiker={gebruiker}
                bezig={bezigMet === order.id}
                opKlaar={(nieuw) => setData(nieuw)}
                opBezig={(aan) => setBezigMet(aan ? order.id : undefined)} />
            ))}
          </Kaart>

          <Kaart titel="Uitgevoerd" icoon="afvinken" telling={data.uitslagen.length}>
            {data.uitslagen.length === 0 && <Leeg tekst="Nog geen uitslagen vastgelegd." />}
            {data.uitslagen.map((u) => (
              <div key={u.orderId} className="uitslagblok">
                <div className="kop">
                  <strong style={{ fontSize: 13.5 }}>{u.soortNaam}</strong>
                  <span className="mini">
                    {u.uitgevoerdOp.slice(0, 10)} · {u.uitgevoerdDoor.naam} ({u.uitgevoerdDoor.rol})
                  </span>
                  <span className="merkje"
                    data-toon={u.beoordelaar === 'zelf' ? 'ok'
                      : u.beoordelaar === 'teleconsultatie' ? 'informatief' : 'aandacht'}
                    style={{ marginLeft: 'auto' }}>
                    {u.beoordelaar === 'zelf' ? 'zelf beoordeeld'
                      : u.beoordelaar === 'teleconsultatie'
                        ? `naar ${u.teleconsult?.specialisme}` : 'bij de huisarts'}
                  </span>
                </div>

                <table className="waardetabel">
                  <tbody>
                    {u.velden.map((v) => (
                      <tr key={v.naam}>
                        <td>{v.naam}</td>
                        <td className="rechts getal">{v.waarde}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {u.afwijkingen.length > 0 && (
                  <div className="waarschuwing" data-ernst="let-op" style={{ marginTop: 8 }}>
                    <Icoon naam="waarschuwing" grootte={13} />
                    <span>
                      {u.afwijkingen.map((a) => `${a.veld} ${a.waarde} — ${a.reden}`).join('; ')}
                    </span>
                  </div>
                )}

                {u.teleconsult && (
                  <div className="notitie" style={{ marginTop: 8 }}>
                    <strong>Naar {u.teleconsult.specialisme}:</strong> {u.teleconsult.vraagstelling}
                    <div className="mini">verstuurd {u.teleconsult.verstuurdOp.slice(0, 10)}</div>
                  </div>
                )}
                {u.conclusie && <p className="reden">{u.conclusie}</p>}
              </div>
            ))}
          </Kaart>
        </div>

        <div className="notitie">
          <strong>Waarom dit een eigen scherm is.</strong> De aanvraag, de uitvoering en de
          beoordeling zijn drie handelingen door mogelijk drie verschillende mensen. Als de
          uitslag als los document in het dossier belandt, is de koppeling met de aanvraag weg
          en weet niemand meer wie wat deed.
          <p style={{ marginTop: 9, marginBottom: 0 }}>
            Getalwaarden uit een verrichting gaan in dezelfde meetreeks als dezelfde waarde uit
            het lab — een FEV1 uit een spirometrie is geen andere FEV1. Zo blijft het beloop
            één lijn.
          </p>
        </div>
      </div>
    </>
  );
}

function Uitvoerblok({
  orderId, omschrijving, soort, patientId, gebruiker, bezig, opKlaar, opBezig,
}: {
  orderId: string;
  omschrijving: string;
  soort?: Verrichtingsoort;
  patientId: string;
  gebruiker: Gebruiker;
  bezig: boolean;
  opKlaar: (nieuw: Verrichtingbeeld) => void;
  opBezig: (aan: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [waarden, setWaarden] = useState<Record<string, string>>({});
  const [beoordelaar, setBeoordelaar] = useState<string>('zelf');
  const [vraagstelling, setVraagstelling] = useState('');

  if (!soort) {
    return (
      <div className="regel">
        <span className="sleutel">
          {omschrijving}
          <div className="mini">Geen gestructureerde uitkomst bekend voor deze verrichting.</div>
        </span>
      </div>
    );
  }

  const magUitvoeren = soort.doorRollen.includes(gebruiker.rol);

  const leggenVast = async () => {
    opBezig(true);
    try {
      opKlaar(await api.legVerrichtingVast(gebruiker.id, {
        patientId, orderId, soortCode: soort.code, waarden,
        beoordelaar,
        vraagstelling: beoordelaar === 'teleconsultatie' ? vraagstelling : undefined,
        conclusie: waarden[`${soort.code}-conclusie`],
      }));
      setOpen(false);
    } finally { opBezig(false); }
  };

  return (
    <div className="ordertreffer" data-open={open}>
      <button className="hoofdregel" onClick={() => setOpen(!open)}>
        <span style={{ color: 'var(--ink-3)' }}><Icoon naam="radar" grootte={14} /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <strong style={{ fontSize: 13 }}>{soort.naam}</strong>
          <div className="mini">
            {soort.duurMinuten} min · uit te voeren door{' '}
            {soort.doorRollen.join(', ')}
          </div>
        </span>
        {!magUitvoeren && <span className="merkje" data-toon="neutraal">niet jouw rol</span>}
        <span className="mini">{open ? 'inklappen' : 'uitkomst vastleggen'}</span>
      </button>

      {open && (
        <div className="uitklap">
          {!magUitvoeren && (
            <div className="notitie" style={{ marginBottom: 10 }}>
              Deze verrichting wordt normaal uitgevoerd door de{' '}
              {soort.doorRollen.join(' of de ')}. Je kunt hem hier wel vastleggen, maar je naam
              komt er als uitvoerder onder te staan.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 11 }}>
            {soort.uitkomstvelden.map((veld) => (
              <div key={veld.code}>
                <label className="veld">
                  {veld.naam}
                  {veld.eenheid && <span className="mini"> ({veld.eenheid})</span>}
                </label>
                {veld.soort === 'keuze' && (
                  <select value={waarden[veld.code] ?? ''}
                    onChange={(e) => setWaarden((w) => ({ ...w, [veld.code]: e.target.value }))}>
                    <option value="">— kies —</option>
                    {veld.opties?.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                )}
                {veld.soort === 'getal' && (
                  <input type="number" inputMode="decimal" value={waarden[veld.code] ?? ''}
                    onChange={(e) => setWaarden((w) => ({ ...w, [veld.code]: e.target.value }))} />
                )}
                {veld.soort === 'tekst' && (
                  <input type="text" value={waarden[veld.code] ?? ''}
                    onChange={(e) => setWaarden((w) => ({ ...w, [veld.code]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>

          <label className="veld" style={{ marginTop: 12 }}>Wie beoordeelt de uitslag?</label>
          <div className="routekeuze">
            {BEOORDELAAR.filter((b) => b.id !== 'teleconsultatie' || soort.teleconsultatie)
              .map((b) => (
                <button key={b.id} className="routeknop" data-actief={beoordelaar === b.id}
                  onClick={() => setBeoordelaar(b.id)}>
                  <strong>{b.label}</strong>
                  <span className="mini">
                    {b.id === 'teleconsultatie' && soort.teleconsultatie
                      ? soort.teleconsultatie.toelichting : b.uitleg}
                  </span>
                </button>
              ))}
          </div>

          {beoordelaar === 'teleconsultatie' && (
            <>
              <label className="veld" style={{ marginTop: 10 }}>
                Vraagstelling aan {soort.teleconsultatie?.specialisme}
              </label>
              <input type="text" value={vraagstelling} autoFocus
                placeholder="Bijvoorbeeld: past dit ritme bij boezemfibrilleren, en is antistolling geïndiceerd?"
                onChange={(e) => setVraagstelling(e.target.value)} />
              <p className="mini" style={{ marginTop: 6 }}>
                Teleconsultatie is een eigen prestatie en telt niet als verwijzing. De
                terugkoppeling komt in het journaal bij de externe bronnen te staan.
              </p>
            </>
          )}

          <div className="knop-rij" style={{ marginTop: 12 }}>
            <button className="knop" data-toon="primair" disabled={bezig}
              onClick={leggenVast}>
              <Icoon naam="vink" grootte={13} /> Vastleggen
            </button>
            <button className="knop" onClick={() => setOpen(false)}>Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}
