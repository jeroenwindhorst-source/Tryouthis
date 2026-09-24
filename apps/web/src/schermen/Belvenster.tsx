import { useState } from 'react';
import { api, type Bereikbaarheid, type Gespreksuitkomst } from '../api';
import { Icoon } from '../iconen';
import { Bereikbaarheidskaart } from '../onderdelen';

/**
 * HET BELVENSTER
 *
 * Geen kiezer en geen telefooncentrale — die zit in de telefonie, niet in het dossier.
 * Wat hier staat is het antwoord op de vraag die je stelt op het moment dat je gaat
 * bellen: welk nummer, en is er iets dat ik moet weten voordat ik opneem?
 *
 * De knop 'Bellen' legt het gesprek vast als contact zodra je het afrondt. Dat is het
 * punt: een telefoontje is zorg (docs/19), en wie hem niet vastlegt heeft wel gewerkt
 * maar niets geleverd.
 */
export function Belvenster({ patientId, naam, gegevens, episodes, gebruiker, taakId, opSluit, opVastgelegd }: {
  patientId: string;
  naam: string;
  gegevens: Bereikbaarheid;
  /** Waar het contact aan hangt. Zonder episode is er geen deelcontact en dus geen SOEP. */
  episodes: { id: string; titel: string; status: string }[];
  gebruiker: { id: string };
  /** De werktaak waar dit telefoontje uit voortkwam, als die er is. */
  taakId?: string;
  opSluit: () => void;
  opVastgelegd: (melding: string) => void;
}) {
  const [gebeld, setGebeld] = useState<string | undefined>();
  const [notitie, setNotitie] = useState('');
  const [afspraak, setAfspraak] = useState('');
  const [duur, setDuur] = useState(5);
  const lopend = episodes.filter((e) => e.status === 'active');
  const [episodeId, setEpisodeId] = useState(lopend[0]?.id ?? '');
  const [bezig, setBezig] = useState(false);
  const [uitkomst, setUitkomst] = useState<Gespreksuitkomst | undefined>();

  const leg = async () => {
    setBezig(true);
    try {
      const antwoord = await api.legContactVast(patientId, {
        notitie, afspraak, contactvorm: 'telefonisch', duurMinuten: duur,
        episodeId: episodeId || undefined, kanaal: gebeld, taakId,
        gebruikerId: gebruiker.id,
      });
      setUitkomst(antwoord);
      opVastgelegd(antwoord.melding);
    } finally { setBezig(false); }
  };

  return (
    <>
      <div className="paneel-scherm" onClick={opSluit} />
      <div className="videovenster" role="dialog" aria-label="Bellen">
        <header>
          <span className="kop"><Icoon naam="gesprek" grootte={15} /> {naam} bellen</span>
          <button className="knop" data-toon="stil" onClick={opSluit}>
            <Icoon naam="kruis" grootte={15} />
          </button>
        </header>

        <div className="belblok">
          {uitkomst ? (
            /*
              Na afloop niet het venster dichtklappen met een vinkje, maar laten zien wát
              er is vastgelegd. Dat is het verschil met de vorige versie: die sloot het
              venster en liet niets achter, en dan heb je geen idee of er iets in het
              dossier staat.
            */
            <>
              <div className="notitie" data-toon="ok">
                <strong>{uitkomst.melding}</strong>
              </div>
              {uitkomst.regel && (
                <div className="journaalregel" style={{ marginTop: 12 }}>
                  <div className="mini">
                    {uitkomst.regel.datum} {uitkomst.regel.tijd} · {uitkomst.regel.soort}
                    {' · '}{uitkomst.regel.episodeTitel} · {uitkomst.regel.auteur}
                  </div>
                  {uitkomst.regel.regels.map((r) => (
                    <div key={r.letter} className="soepregel">
                      <span className="letter">{r.letter}</span>
                      <span>{r.tekst}</span>
                    </div>
                  ))}
                  {uitkomst.regel.regels.length === 0 && (
                    <div className="reden">
                      Alleen het contact zelf — er is geen tekst vastgelegd.
                    </div>
                  )}
                </div>
              )}
              {uitkomst.declaratie && (
                <div className="notitie"
                  data-toon={uitkomst.declaratie.declarabel ? 'ok' : 'waarschuwing'}
                  style={{ marginTop: 12 }}>
                  <strong>
                    {uitkomst.declaratie.declarabel
                      ? `Declarabel: ${uitkomst.declaratie.prestatie?.omschrijving}`
                      : 'Nog niet declarabel'}
                  </strong>
                  <div className="mini" style={{ marginTop: 4 }}>{uitkomst.declaratie.toelichting}</div>
                  {uitkomst.declaratie.ontbreekt.length > 0 && (
                    <ul className="uitleg" style={{ marginTop: 6 }}>
                      {uitkomst.declaratie.ontbreekt.map((o) => <li key={o}>{o}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {uitkomst.taak && (
                <div className="notitie" style={{ marginTop: 12 }}>
                  <strong>Taak afgerond:</strong> {uitkomst.taak.titel} — hij verdwijnt van
                  de werklijst
                  {uitkomst.taak.agendaItemId
                    ? ' en het blok in de agenda staat op afgerond.'
                    : '.'}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="notitie" data-toon="merk" style={{ marginBottom: 12 }}>
                <strong>Waarmee zou je beginnen?</strong> {gegevens.advies}
              </div>

              <Bereikbaarheidskaart gegevens={gegevens} opBellen={(k) => setGebeld(k.waarde)} />

              {gebeld && (
                <>
                  <div className="notitie" data-toon="merk" style={{ marginTop: 12 }}>
                    <strong>Verbonden met {gebeld}.</strong> In de demo belt er niets; in
                    productie belt je toestel en loopt de teller mee.
                  </div>

                  {/*
                    Het veld waar het om begon: een telefoontje zonder notitie is een
                    belpoging. Hier staat wat er gezegd is (S) en wat er is afgesproken
                    (P) — twee velden, want dat is precies wat er bij een telefoontje toe
                    doet en meer is het niet.
                  */}
                  <h3 className="blokkop" style={{ marginTop: 16 }}>Wat is er gezegd?</h3>
                  <textarea className="taakveld" rows={3} value={notitie}
                    placeholder="Patiënt gesproken; wat kwam er uit"
                    onChange={(e) => setNotitie(e.target.value)} />

                  <h3 className="blokkop" style={{ marginTop: 12 }}>Wat is er afgesproken?</h3>
                  <textarea className="taakveld" rows={2} value={afspraak}
                    placeholder="Vervolg: wie doet wat, en wanneer"
                    onChange={(e) => setAfspraak(e.target.value)} />

                  <div className="raster2" style={{ marginTop: 12 }}>
                    <div>
                      <label className="veld">Bij welke episode</label>
                      <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)}>
                        {lopend.map((e) => (
                          <option key={e.id} value={e.id}>{e.titel}</option>
                        ))}
                        <option value="">Geen episode</option>
                      </select>
                    </div>
                    <div>
                      <label className="veld">Duur (minuten)</label>
                      <input type="number" min={1} max={60} value={duur}
                        onChange={(e) => setDuur(Number(e.target.value) || 1)} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <footer>
          {uitkomst ? (
            <button className="knop" data-toon="primair" onClick={opSluit}>
              <Icoon naam="vink" grootte={13} /> Sluiten
            </button>
          ) : (
            <button className="knop" data-toon="primair" disabled={!gebeld || bezig} onClick={leg}>
              <Icoon naam="vink" grootte={13} /> Gesprek vastleggen als contact
            </button>
          )}
          <span className="mini">
            Een telefonisch consult is een contactvorm met een eigen declaratieregel — niet
            een aantekening bij een ander consult.
          </span>
        </footer>
      </div>
    </>
  );
}
