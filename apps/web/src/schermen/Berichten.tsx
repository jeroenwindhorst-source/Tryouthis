import { useEffect, useState } from 'react';
import {
  api, type Contactvorm, type Declaratiebeeld, type Gebruiker, type Gesprek, type Treffer,
} from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

/**
 * Aan welke episode hangt dit contact?
 *
 * Zonder episode is het antwoord een los briefje: het staat niet bij het verhaal waar het
 * over gaat, en het telt niet mee voor de verantwoording. Vaak gaat een portaalvraag over
 * iets bestaands; soms is het iets nieuws en dan open je hier een episode, zonder eerst
 * het dossier te hoeven openen.
 */
function Episodekeuze({ patientId, gekozen, opKies }: {
  patientId: string; gekozen: string; opKies: (id: string) => void;
}) {
  const [episodes, setEpisodes] = useState<{ id: string; titel: string; icpc?: string }[]>([]);
  const [nieuw, setNieuw] = useState(false);
  const [zoek, setZoek] = useState('');
  const [treffers, setTreffers] = useState<Treffer[]>([]);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    api.patient(patientId)
      .then((p) => {
        setEpisodes(p.episodes);
        // Eén episode? Dan is de keuze geen keuze en vullen we hem alvast in.
        if (p.episodes.length > 0 && !gekozen) opKies(p.episodes[0].id);
      })
      .catch(() => setEpisodes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const zoekCode = async (q: string) => {
    setZoek(q);
    if (q.trim().length < 2) { setTreffers([]); return; }
    const uitkomst = await api.zoekTerm(q, false);
    setTreffers(uitkomst.treffers.slice(0, 5));
  };

  const maak = async (treffer: Treffer) => {
    setBezig(true);
    try {
      const antwoord = await api.maakEpisode(patientId, {
        icpc: treffer.concept.icpc1 ?? '',
        snomed: treffer.concept.snomed,
        display: treffer.concept.display,
      });
      setEpisodes(antwoord.overzicht.episodes);
      opKies(antwoord.episodeId);
      setNieuw(false); setZoek(''); setTreffers([]);
    } finally { setBezig(false); }
  };

  return (
    <div style={{ marginTop: 9 }}>
      <label className="veld">Episode</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={gekozen} onChange={(e) => opKies(e.target.value)}>
          <option value="">— geen episode —</option>
          {episodes.map((e) => (
            <option key={e.id} value={e.id}>{e.icpc} — {e.titel}</option>
          ))}
        </select>
        <button className="knop" onClick={() => setNieuw(!nieuw)}>
          <Icoon naam={nieuw ? 'kruis' : 'plus'} grootte={13} />
          {nieuw ? 'Annuleren' : 'Nieuwe'}
        </button>
      </div>

      {nieuw && (
        <div style={{ marginTop: 8 }}>
          <input type="search" value={zoek} autoFocus
            placeholder="Zoek een diagnose of klacht"
            onChange={(e) => zoekCode(e.target.value)} />
          {treffers.map((t) => (
            <button key={t.concept.snomed} className="gesprekknop" disabled={bezig}
              onClick={() => maak(t)}>
              <strong style={{ fontSize: 13 }}>{t.concept.display}</strong>
              <div className="mini">ICPC {t.concept.icpc1 ?? '—'} · SNOMED {t.concept.snomed}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const BERICHTVORMEN: { id: Contactvorm; label: string; icoon: string; uitleg: string }[] = [
  { id: 'e-consult', label: 'E-consult', icoon: 'huis',
    uitleg: 'Schriftelijk antwoord via het portaal. Telt als consult als de vraag inhoudelijk is.' },
  { id: 'telefonisch', label: 'Telefonisch', icoon: 'gesprek',
    uitleg: 'Je hebt naar aanleiding van dit bericht gebeld.' },
  { id: 'videoconsult', label: 'Videoconsult', icoon: 'video',
    uitleg: 'Je hebt beeldgebeld. Sterkere identificatie dan telefonisch.' },
  { id: 'herhaalrecept', label: 'Herhaalrecept', icoon: 'pil',
    uitleg: 'Administratief. Zit in het inschrijftarief en is geen consult.' },
];

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
  const [vorm, setVorm] = useState<Contactvorm>('e-consult');
  const [vastleggen, setVastleggen] = useState(true);
  const [declaratie, setDeclaratie] = useState<Declaratiebeeld | undefined>();
  const [episodeId, setEpisodeId] = useState('');

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
      if (actief.soort === 'patient' && vastleggen) {
        // Antwoord én registratie in één handeling. Een antwoord dat alleen in het
        // berichtenbakje blijft staan, bestaat over twee weken niet meer.
        const antwoord = await api.beantwoordBericht({
          gesprekId: actief.id, gebruikerId: gebruiker.id, tekst: concept.trim(),
          contactvorm: vorm, episodeId: episodeId || undefined,
          duurMinuten: vorm === 'videoconsult' ? 10 : undefined,
        });
        setData(antwoord.berichten);
        setDeclaratie(antwoord.uitkomst?.declaratie);
      } else {
        setData(await api.stuurBericht(actief.id, gebruiker.id, concept.trim()));
      }
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

      {/*
        Twee bakjes, want het zijn twee soorten gesprek. Met een collega overleg je;
        een patiënt stelt een vraag waar een antwoord op hoort — en soms is dat antwoord
        zorg en hoort het in het dossier, met een eigen contactvorm en declaratieregel.
        Dat verschil verdient meer dan een schakelaartje in de hoek: het bepaalt wat je
        met het bericht mág doen. Daarom staat het groot, boven de lijst.
      */}
      <div className="bakken">
        <button data-actief={bak === 'collega'}
          onClick={() => { setBak('collega'); setActiefId(undefined); }}>
          <span className="ikoon"><Icoon naam="persoon" grootte={17} /></span>
          <span className="tekst">
            <strong>Collega's</strong>
            <span className="mini">Intern overleg. Blijft binnen de praktijk.</span>
          </span>
          <span className="telling">{data.collega.length}</span>
        </button>
        <button data-actief={bak === 'patient'}
          onClick={() => { setBak('patient'); setActiefId(undefined); }}>
          <span className="ikoon"><Icoon naam="gesprek" grootte={17} /></span>
          <span className="tekst">
            <strong>Patiënten</strong>
            <span className="mini">Vragen uit het portaal. Kan zorg worden.</span>
          </span>
          <span className="telling">
            {data.patient.length}
            {data.ongelezenPatient > 0 && (
              <span className="merkje" data-toon="urgent">{data.ongelezenPatient} nieuw</span>
            )}
          </span>
        </button>
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

              {actief.soort === 'patient' && (
                <div className="berichtvorm">
                  {/*
                    Wat dit contact wordt, kies je hier — niet achteraf bij de declaratie.
                    Een schriftelijk antwoord is een e-consult; heb je gebeld of beeldgebeld
                    naar aanleiding van dit bericht, dan is het dát, met een andere prestatie
                    en een andere zekerheid over met wie je sprak (docs/19).
                  */}
                  <label className="veld">Dit wordt een…</label>
                  <div className="chips">
                    {BERICHTVORMEN.map((v) => (
                      <button key={v.id} className="filterchip" data-actief={vorm === v.id}
                        title={v.uitleg} onClick={() => setVorm(v.id)}>
                        <Icoon naam={v.icoon} grootte={12} /> {v.label}
                      </button>
                    ))}
                  </div>

                  {vastleggen && actief.patientId && (
                    <Episodekeuze patientId={actief.patientId} gekozen={episodeId}
                      opKies={setEpisodeId} />
                  )}

                  <label className="aanvinken" style={{ marginTop: 9 }}>
                    <input type="checkbox" checked={vastleggen}
                      onChange={(e) => setVastleggen(e.target.checked)} />
                    <span>
                      Als contact vastleggen in het dossier
                      <div className="mini">
                        {vastleggen
                          ? 'De vraag komt onder S, jouw antwoord onder P, met de contactvorm erbij.'
                          : 'Alleen een bericht. Kies dit voor administratieve vragen.'}
                      </div>
                    </span>
                  </label>
                </div>
              )}

              {declaratie && (
                <div className="declaratie" data-declarabel={declaratie.declarabel}
                  style={{ marginTop: 10 }}>
                  <div className="kop">
                    <Icoon naam="euro" grootte={14} />
                    <strong>Vastgelegd als {declaratie.naam}</strong>
                    {declaratie.prestatie && (
                      <span className="merkje" data-toon={declaratie.declarabel ? 'ok' : 'aandacht'}>
                        {declaratie.prestatie.code}
                      </span>
                    )}
                  </div>
                  <div className="mini">{declaratie.toelichting}</div>
                  {declaratie.ontbreekt.length > 0 && (
                    <div className="mini">
                      Ontbreekt nog: {declaratie.ontbreekt.join(', ')} — vul aan in het dossier.
                    </div>
                  )}
                </div>
              )}

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
