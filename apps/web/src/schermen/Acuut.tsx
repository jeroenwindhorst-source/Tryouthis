import { useEffect, useState } from 'react';
import { api, type AcuutSignaal, type Acuutbeeld, type Gebruiker } from '../api';
import { Icoon } from '../iconen';
import { Kaart, Leeg } from '../onderdelen';

const URGENTIE_TOON: Record<string, string> = {
  spoed: 'urgent', 'binnen-een-uur': 'aandacht', vandaag: 'informatief',
};

const BRON_ICOON: Record<string, string> = {
  telefoon: 'gesprek', portaal: 'huis', thuismeting: 'buisje',
  uitslag: 'buisje', triage: 'radar',
};

const ROL_LABEL: Record<string, string> = {
  huisarts: 'huisarts', 'poh-s': 'POH-S', assistent: 'assistent',
};

/**
 * ACUTE INSTROOM
 *
 * De dag is gepland en dan belt er iemand. Overdag gaat dat niet naar de huisartsenpost:
 * het moet hier, nu, door iemand worden opgepakt.
 *
 * Twee dingen gaan daar in de praktijk mis, en allebei zijn ze een systeemprobleem. Het
 * valt niet op — een teller die van 3 naar 4 gaat terwijl je een consult doet, ziet
 * niemand. En als het wél opvalt bij drie mensen tegelijk, gaan er twee bellen of geen
 * enkele.
 *
 * Daarom dringt een melding zich op naar rato van de urgentie, en is oppakken een
 * expliciete handeling. "Ik pak hem op" is geen beleefdheid maar het antwoord op de vraag
 * die de andere twee anders moeten stellen.
 */
export function useAcuut(gebruiker: Gebruiker, actief: boolean) {
  const [beeld, setBeeld] = useState<Acuutbeeld | undefined>();
  const [weggeklikt, setWeggeklikt] = useState<string[]>([]);

  useEffect(() => {
    if (!actief) return;
    let levend = true;
    const haal = () => {
      api.acuut(gebruiker.rol)
        .then((b) => { if (levend) setBeeld(b); })
        .catch(() => undefined);
    };
    haal();
    // Elke tien seconden kijken of er iets binnen is. In productie is dit een
    // pushverbinding; pollen is hier genoeg en maakt zichtbaar wat het mechanisme doet.
    const klok = window.setInterval(haal, 10_000);
    return () => { levend = false; window.clearInterval(klok); };
  }, [gebruiker.rol, actief]);

  const tonen = (beeld?.open ?? []).filter((s) => !weggeklikt.includes(s.id));

  return {
    beeld,
    setBeeld,
    /** Het signaal dat zich nu opdringt: het urgentste openstaande dat nog niet weg is. */
    dringend: tonen.find((s) => s.opdringen === 'modaal') ?? tonen[0],
    aantalOpen: beeld?.open.length ?? 0,
    klikWeg: (id: string) => setWeggeklikt((l) => [...l, id]),
  };
}

/**
 * De melding zelf.
 *
 * Spoed krijgt een modaal venster dat je moet wegklikken; de rest een kaart rechtsonder
 * die je kunt laten staan. Dat verschil is bewust: alles even hard laten schreeuwen is
 * hetzelfde als niets laten schreeuwen.
 */
export function Acuutmelding({ signaal, gebruiker, opOpgepakt, opWeg, openPatient }: {
  signaal: AcuutSignaal;
  gebruiker: Gebruiker;
  opOpgepakt: (beeld: Acuutbeeld) => void;
  opWeg: () => void;
  openPatient: (id: string) => void;
}) {
  const [bezig, setBezig] = useState(false);
  const modaal = signaal.opdringen === 'modaal';

  const pakOp = async () => {
    setBezig(true);
    try {
      opOpgepakt(await api.pakAcuutOp(signaal.id, gebruiker.id, gebruiker.rol));
      openPatient(signaal.patientId);
    } finally { setBezig(false); }
  };

  const inhoud = (
    <>
      <header>
        <span className="merkje" data-toon={URGENTIE_TOON[signaal.urgentie] ?? 'aandacht'}>
          <Icoon naam="waarschuwing" grootte={11} /> {signaal.urgentieLabel}
        </span>
        <span className="mini">
          <Icoon naam={BRON_ICOON[signaal.bron] ?? 'gesprek'} grootte={12} />{' '}
          {signaal.bronLabel} · {signaal.binnenOmTijd}
        </span>
        {!modaal && (
          <button className="knop" data-toon="stil" onClick={opWeg} title="Later">
            <Icoon naam="kruis" grootte={14} />
          </button>
        )}
      </header>

      <h3>{signaal.naam} <span className="mini">{signaal.leeftijd} jaar</span></h3>
      <p className="samenvatting">{signaal.samenvatting}</p>

      <div className="onderbouwing">
        <strong>Waarom nu</strong>
        <div>{signaal.onderbouwing}</div>
      </div>
      <div className="onderbouwing">
        <strong>Voorstel</strong>
        <div>{signaal.voorgesteldeActie}</div>
      </div>

      <div className="mini" style={{ marginTop: 8 }}>
        Staat ook bij: {signaal.voorRollen.map((r) => ROL_LABEL[r] ?? r).join(', ')}.
        Zodra jij hem oppakt, zien zij dat.
      </div>

      <div className="knop-rij" style={{ marginTop: 12 }}>
        <button className="knop" data-toon="primair" disabled={bezig} onClick={pakOp}>
          <Icoon naam="vink" grootte={13} /> Ik pak hem op
        </button>
        <button className="knop" onClick={() => openPatient(signaal.patientId)}>
          <Icoon naam="klembord" grootte={13} /> Dossier bekijken
        </button>
        {modaal && (
          <button className="knop" data-toon="stil" onClick={opWeg}>
            Niet nu — laat staan voor een collega
          </button>
        )}
      </div>
    </>
  );

  if (modaal) {
    return (
      <>
        <div className="paneel-scherm" />
        <div className="acuutmodaal" role="alertdialog" aria-label="Spoedmelding">{inhoud}</div>
      </>
    );
  }
  return <div className="acuuttoast" role="alert">{inhoud}</div>;
}

/** Het overzichtsscherm: alles wat binnenkwam, wie het oppakte en wat eruit kwam. */
export function Acuut({ gebruiker, openPatient }: {
  gebruiker: Gebruiker;
  openPatient: (id: string) => void;
}) {
  const [beeld, setBeeld] = useState<Acuutbeeld | undefined>();
  const [uitkomsten, setUitkomsten] = useState<Record<string, string>>({});
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  useEffect(() => { api.acuut(gebruiker.rol).then(setBeeld).catch(() => undefined); },
    [gebruiker.rol]);

  if (!beeld) return <Leeg tekst="Bezig met laden…" />;

  const pakOp = async (signaal: AcuutSignaal) => {
    setBezigMet(signaal.id);
    try { setBeeld(await api.pakAcuutOp(signaal.id, gebruiker.id, gebruiker.rol)); }
    finally { setBezigMet(undefined); }
  };

  const handelAf = async (signaal: AcuutSignaal) => {
    const tekst = (uitkomsten[signaal.id] ?? '').trim();
    if (!tekst) return;
    setBezigMet(signaal.id);
    try {
      setBeeld(await api.handelAcuutAf(signaal.id, tekst, gebruiker.rol));
      setUitkomsten((u) => ({ ...u, [signaal.id]: '' }));
    } finally { setBezigMet(undefined); }
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Acuut</h1>
          <div className="onder">
            Wat er vandaag tussendoor binnenkwam en door iemand opgepakt moet worden
          </div>
        </div>
        <div className="acties">
          <span className="merkje" data-toon={beeld.open.length > 0 ? 'urgent' : 'ok'}>
            {beeld.open.length} open
          </span>
        </div>
      </div>

      <div className="notitie">
        <strong>Overdag komt dit hier terecht en niet bij de huisartsenpost.</strong> Iedereen
        die het kan oppakken ziet het; wie het oppakt maakt dat zichtbaar voor de rest. Dat
        laatste is het verschil tussen drie mensen die bellen en niemand die belt.
      </div>

      <Kaart titel="Open" icoon="waarschuwing" telling={beeld.open.length}>
        {beeld.open.length === 0 && <Leeg tekst="Niets openstaand." />}
        {beeld.open.map((s) => (
          <div key={s.id} className="acuutregel" data-urgentie={s.urgentie}>
            <div className="kop">
              <span className="merkje" data-toon={URGENTIE_TOON[s.urgentie] ?? 'aandacht'}>
                {s.urgentieLabel}
              </span>
              <button className="knop" data-toon="stil" style={{ padding: 0, fontWeight: 650 }}
                onClick={() => openPatient(s.patientId)}>
                {s.naam} <Icoon naam="pijl" grootte={12} />
              </button>
              <span className="mini">{s.leeftijd} jaar · {s.bronLabel} · {s.binnenOmTijd}</span>
            </div>
            <p className="samenvatting">{s.samenvatting}</p>
            <div className="mini">{s.onderbouwing}</div>
            <div className="mini" style={{ marginTop: 4, color: 'var(--merk-diep)' }}>
              Voorstel: {s.voorgesteldeActie}
            </div>
            <div className="knop-rij" style={{ marginTop: 9 }}>
              <button className="knop" data-toon="primair" disabled={bezigMet === s.id}
                onClick={() => pakOp(s)}>
                <Icoon naam="vink" grootte={13} /> Ik pak hem op
              </button>
            </div>
          </div>
        ))}
      </Kaart>

      {beeld.opgepakt.length > 0 && (
        <Kaart titel="Wordt opgepakt" icoon="persoon" telling={beeld.opgepakt.length}>
          {beeld.opgepakt.map((s) => (
            <div key={s.id} className="acuutregel">
              <div className="kop">
                <strong style={{ fontSize: 13 }}>{s.naam}</strong>
                <span className="merkje" data-toon="informatief">
                  {s.opgepaktDoor?.naam} ({ROL_LABEL[s.opgepaktDoor?.rol ?? ''] ?? s.opgepaktDoor?.rol})
                </span>
                <span className="mini">sinds {s.opgepaktOp?.slice(11, 16)}</span>
              </div>
              <p className="samenvatting">{s.samenvatting}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="text" placeholder="Wat is er gedaan?"
                  value={uitkomsten[s.id] ?? ''}
                  onChange={(e) => setUitkomsten((u) => ({ ...u, [s.id]: e.target.value }))} />
                <button className="knop" data-toon="primair"
                  disabled={bezigMet === s.id || !(uitkomsten[s.id] ?? '').trim()}
                  onClick={() => handelAf(s)}>
                  <Icoon naam="vink" grootte={13} /> Afgehandeld
                </button>
              </div>
            </div>
          ))}
        </Kaart>
      )}

      {beeld.afgehandeld.length > 0 && (
        <Kaart titel="Afgehandeld vandaag" icoon="afvinken" telling={beeld.afgehandeld.length}>
          {beeld.afgehandeld.map((s) => (
            <div key={s.id} className="regel">
              <span className="sleutel">
                {s.naam}
                <div className="mini">{s.samenvatting}</div>
              </span>
              <span className="waarde" style={{ fontWeight: 400, textAlign: 'left', maxWidth: 360 }}>
                {s.uitkomst}
                <div className="mini">
                  {s.opgepaktDoor?.naam} · {s.afgehandeldOp?.slice(11, 16)}
                </div>
              </span>
            </div>
          ))}
        </Kaart>
      )}
    </>
  );
}
