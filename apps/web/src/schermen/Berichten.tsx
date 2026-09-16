import { useState } from 'react';
import { api, type Gebruiker, type Gesprek } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const KANAAL_LABEL: Record<string, string> = {
  'e-consult': 'e-consult', herhaalrecept: 'herhaalrecept',
  uitslagvraag: 'vraag over uitslag', portaalvraag: 'portaalvraag',
};

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
  const [bak, setBak] = useState<'collega' | 'patient'>('collega');
  const [concept, setConcept] = useState('');
  const [bezigMet, setBezigMet] = useState(false);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Berichten" />;

  const lijst = bak === 'patient' ? data.patient : data.collega;
  const actief: Gesprek | undefined =
    lijst.find((g) => g.id === actiefId) ?? lijst[0];

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
        <div className="acties">
          {/*
            Twee bakjes, want het zijn twee soorten gesprek. Met een collega overleg je;
            een patiënt stelt een vraag waar een antwoord op hoort — en soms is dat antwoord
            zorg en hoort het in het dossier. Eén lange lijst dwingt je bij elk bericht
            opnieuw te kijken wie er aan de andere kant zit.
          */}
          <div className="segment">
            <button data-actief={bak === 'collega'}
              onClick={() => { setBak('collega'); setActiefId(undefined); }}>
              <Icoon naam="persoon" grootte={13} /> Collega's ({data.collega.length})
            </button>
            <button data-actief={bak === 'patient'}
              onClick={() => { setBak('patient'); setActiefId(undefined); }}>
              <Icoon naam="gesprek" grootte={13} /> Patiënten ({data.patient.length})
              {data.ongelezenPatient > 0 && (
                <span className="badge" data-toon="urgent">{data.ongelezenPatient}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {lijst.length === 0 && (
        <Leeg tekst={bak === 'patient' ? 'Geen berichten van patiënten.' : 'Geen berichten.'} />
      )}

      {lijst.length > 0 && (
        <div className="gesprekken">
          <Kaart strak>
            {lijst.map((g) => {
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
                  {g.kanaal && (
                    <span className="merkje" data-toon="neutraal"
                      style={{ marginTop: 5, display: 'inline-block' }}>
                      {KANAAL_LABEL[g.kanaal] ?? g.kanaal}
                    </span>
                  )}
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
                    {actief.soort === 'patient'
                      ? `Via het portaal · ${KANAAL_LABEL[actief.kanaal ?? ''] ?? actief.kanaal}`
                      : `${actief.deelnemers.length} deelnemers`}
                  </div>
                </div>
                {actief.patientId && (
                  <button className="knop" onClick={() => openPatient(actief.patientId!)}>
                    <Icoon naam="persoon" grootte={13} /> {actief.patientNaam}
                  </button>
                )}
              </div>

              {actief.soort === 'patient' && (
                <div className="notitie" data-toon={actief.dossierwaardig ? 'waarschuwing' : undefined}
                  style={{ marginBottom: 14 }}>
                  {actief.dossierwaardig ? (
                    <>
                      <strong>Dit is zorg, geen berichtje.</strong> De vraag gaat over het
                      beloop van een aandoening, dus het antwoord hoort als deelcontact in het
                      journaal te komen en niet alleen in dit bakje. Anders weet over twee weken
                      niemand meer wat er is afgesproken.
                    </>
                  ) : (
                    <>
                      <strong>Administratief.</strong> Dit hoeft niet in het dossier; het is een
                      vraag over een recept of een afspraak.
                    </>
                  )}
                </div>
              )}

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
                <input type="text" value={concept}
                  placeholder={actief.soort === 'patient'
                    ? 'Antwoord aan de patiënt…' : 'Schrijf een bericht…'}
                  onChange={(e) => setConcept(e.target.value)} />
                <button className="knop" data-toon="primair" type="submit"
                  disabled={bezigMet || !concept.trim()}>
                  <Icoon naam="pijl" grootte={13} /> Versturen
                </button>
              </form>

              {actief.soort === 'patient' && (
                <div className="knop-rij" style={{ marginTop: 10 }}>
                  <button className="knop" onClick={() => actief.patientId && openPatient(actief.patientId)}>
                    <Icoon naam="klembord" grootte={13} /> Openen en vastleggen in het dossier
                  </button>
                  <span className="mini" style={{ alignSelf: 'center' }}>
                    {actief.dossierwaardig
                      ? 'Het antwoord hoort hier als deelcontact terecht te komen.'
                      : 'Alleen nodig als er alsnog iets klinisch uit komt.'}
                  </span>
                </div>
              )}
            </Kaart>
          )}
        </div>
      )}
    </>
  );
}
