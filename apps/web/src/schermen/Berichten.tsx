import { useState } from 'react';
import { api, type Gebruiker, type Gesprek } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const AANLEIDING_ICOON: Record<string, string> = {
  uitslag: 'buisje', autorisatie: 'klembord', monitoring: 'radar',
  consult: 'agenda', overleg: 'persoon',
};

/**
 * Interne communicatie.
 *
 * Het verschil met een los berichtenbakje: een gesprek hangt aan een patiënt én aan een
 * aanleiding. Eén klik brengt je naar het dossier waar het over gaat, zodat je niet bij
 * elk bericht opnieuw hoeft te zoeken wie dit ook alweer was.
 */
export function Berichten({ gebruiker, openPatient }: {
  gebruiker: Gebruiker;
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.berichten(gebruiker.id), [gebruiker.id]);
  const [actiefId, setActiefId] = useState<string | undefined>();
  const [concept, setConcept] = useState('');
  const [bezigMet, setBezigMet] = useState(false);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Berichten" />;

  const actief: Gesprek | undefined =
    data.gesprekken.find((g) => g.id === actiefId) ?? data.gesprekken[0];

  const open = async (gesprek: Gesprek) => {
    setActiefId(gesprek.id);
    if (gesprek.berichten.some((b) => !b.gelezen && b.vanId !== gebruiker.id)) {
      setData(await api.markeerGelezen(gesprek.id, gebruiker.id));
    }
  };

  const verstuur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actief || !concept.trim()) return;
    setBezigMet(true);
    try {
      setData(await api.stuurBericht(actief.id, gebruiker.id, concept.trim()));
      setConcept('');
    } finally { setBezigMet(false); }
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Berichten</h1>
          <div className="onder">
            {data.gesprekken.length} gesprekken
            {data.ongelezen > 0 && ` · ${data.ongelezen} ongelezen`}
          </div>
        </div>
      </div>

      {data.gesprekken.length === 0 && <Leeg tekst="Geen berichten." />}

      {data.gesprekken.length > 0 && (
        <div className="gesprekken">
          <Kaart strak>
            {data.gesprekken.map((g) => {
              const laatste = g.berichten.at(-1);
              const ongelezen = g.berichten.some((b) => !b.gelezen && b.vanId !== gebruiker.id);
              return (
                <button key={g.id} className="gesprekknop"
                  data-actief={actief?.id === g.id} data-ongelezen={ongelezen}
                  onClick={() => open(g)}>
                  <div className="onderwerp" style={{ fontWeight: ongelezen ? 650 : 550, fontSize: 13 }}>
                    {g.onderwerp}
                  </div>
                  <div className="mini" style={{ marginTop: 3 }}>
                    {g.patientNaam ? `${g.patientNaam} · ` : ''}
                    {laatste?.van.split(' ')[0]} · {laatste?.op.slice(11, 16)}
                  </div>
                  {g.urgent && (
                    <span className="merkje" data-toon="urgent" style={{ marginTop: 5, display: 'inline-block' }}>
                      urgent
                    </span>
                  )}
                </button>
              );
            })}
          </Kaart>

          {actief && (
            <Kaart>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h2 style={{ fontSize: 15 }}>{actief.onderwerp}</h2>
                  <div className="mini" style={{ marginTop: 3 }}>
                    {actief.deelnemers.length} deelnemers
                  </div>
                </div>
                {actief.patientId && (
                  <button className="knop" onClick={() => openPatient(actief.patientId!)}>
                    <Icoon naam="persoon" grootte={13} /> {actief.patientNaam}
                  </button>
                )}
              </div>

              {actief.aanleiding && (
                <div className="notitie" style={{ marginBottom: 14 }}>
                  <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                    <Icoon naam={AANLEIDING_ICOON[actief.aanleiding.soort] ?? 'gesprek'} grootte={14} />
                    <strong>Aanleiding:</strong> {actief.aanleiding.tekst}
                  </span>
                </div>
              )}

              <div>
                {actief.berichten.map((b) => (
                  <div key={b.id} className="bericht" data-eigen={b.vanId === gebruiker.id}>
                    <div className="van">
                      {b.vanId === gebruiker.id ? 'Jij' : b.van}
                      <span className="mini">
                        {new Date(b.op).toLocaleString('nl-NL', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="tekst">{b.tekst}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={verstuur} style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <input type="text" value={concept} placeholder="Schrijf een bericht…"
                  onChange={(e) => setConcept(e.target.value)} />
                <button className="knop" data-toon="primair" type="submit"
                  disabled={bezigMet || !concept.trim()}>
                  <Icoon naam="pijl" grootte={13} /> Versturen
                </button>
              </form>
            </Kaart>
          )}
        </div>
      )}
    </>
  );
}
