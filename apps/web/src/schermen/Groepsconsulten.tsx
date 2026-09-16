import { useState } from 'react';
import { api, type Gebruiker, type Groepsconsult } from '../api';
import { useData } from '../gebruik';
import { Icoon, icoonVanModule } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const STATUS_TOON: Record<string, string> = {
  aangemeld: 'ok', aanwezig: 'ok', uitgenodigd: 'informatief',
  afgemeld: 'neutraal', 'niet-verschenen': 'urgent',
};

const STATUS_LABEL: Record<string, string> = {
  uitgenodigd: 'uitgenodigd', aangemeld: 'aangemeld', aanwezig: 'aanwezig',
  afgemeld: 'afgemeld', 'niet-verschenen': 'niet verschenen',
};

const THEMAS = [
  { id: 'dm-leefstijl', titel: 'Leven met diabetes', thema: 'Leefstijl bij diabetes type 2',
    module: 'glucose', duurMinuten: 90, maxDeelnemers: 10,
    programma: ['Wat doet eten met je bloedsuiker', 'Bewegen: wat werkt en wat houdt vol',
      'Ervaringen uitwisselen', 'Individuele vragen'] },
  { id: 'copd-ademhaling', titel: 'Ademhaling en energie', thema: 'Omgaan met COPD',
    module: 'ademhaling', duurMinuten: 90, maxDeelnemers: 8,
    programma: ['Inhalatietechniek — samen oefenen', 'Energie verdelen over de dag',
      'Wat te doen bij toename van klachten', 'Vragen'] },
  { id: 'stoppen-roken', titel: 'Stoppen met roken — groepstraject',
    thema: 'Begeleiding stoppen met roken', module: 'leefstijl', duurMinuten: 60, maxDeelnemers: 12,
    programma: ['Waarom stoppen zo moeilijk is', 'Een stopdatum kiezen',
      'Medicamenteuze ondersteuning', 'Afspraken voor de komende weken'] },
  { id: 'hart-vaat', titel: 'Hart en vaten in balans', thema: 'Cardiovasculair risicomanagement',
    module: 'vaatrisico', duurMinuten: 75, maxDeelnemers: 10,
    programma: ['Wat betekent je risicoprofiel', 'Bloeddruk en cholesterol',
      'Medicatie — waarom en hoe lang', 'Thuis meten'] },
  { id: 'kwetsbaar-ouder', titel: 'Vitaal ouder worden', thema: 'Kwetsbaarheid en zelfredzaamheid',
    module: 'kwetsbaarheid', duurMinuten: 90, maxDeelnemers: 8,
    programma: ['Valpreventie in en om het huis', 'Wat regelt het wijkteam',
      'Medicatie: minder kan ook beter', 'Wat wil je zelf blijven kunnen'] },
];

/**
 * GROEPSCONSULTEN
 *
 * Acht mensen met diabetes die samen leren koolhydraten herkennen, halen meer uit dat uur
 * dan acht keer tien minuten individueel — en ze halen er iets uit wat een individueel
 * consult per definitie niet kan geven: elkaar.
 *
 * Systemen ondersteunen dit vrijwel nooit, omdat een agenda die is gebouwd rond "één
 * tijdslot, één patiënt" een blok met acht mensen niet kan weergeven. Het gevolg is een
 * Excel naast het systeem en registratie achteraf, één voor één.
 *
 * Hier is het een agenda-item met deelnemers, en stelt het systeem voor wie erbij past —
 * want wie een groepsconsult plant, wil niet zelf 48 dossiers doorzoeken.
 */
export function Groepsconsulten({ gebruiker, openPatient }: {
  gebruiker: Gebruiker;
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.groepsconsulten());
  const [gekozenId, setGekozenId] = useState<string | undefined>();
  const [nieuw, setNieuw] = useState(false);
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Groepsconsulten" />;

  const gekozen: Groepsconsult | undefined =
    data.find((g) => g.id === gekozenId) ?? data[0];

  const voegToe = async (patientId: string, naam: string, onderbouwing: string) => {
    if (!gekozen) return;
    setBezigMet(patientId);
    try {
      setData(await api.voegDeelnemerToe(gekozen.id, {
        patientId, naam, status: 'uitgenodigd', onderbouwing,
      }));
    } finally { setBezigMet(undefined); }
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Groepsconsulten</h1>
          <div className="onder">
            Eén blok, meerdere patiënten · registratie na afloop per deelnemer
          </div>
        </div>
        <div className="acties">
          <button className="knop" data-toon="primair" onClick={() => setNieuw(!nieuw)}>
            <Icoon naam={nieuw ? 'kruis' : 'plus'} grootte={13} />
            {nieuw ? 'Annuleren' : 'Nieuw groepsconsult'}
          </button>
        </div>
      </div>

      {nieuw && (
        <Nieuwvenster gebruiker={gebruiker}
          opKlaar={(lijst) => { setData(lijst); setNieuw(false); setGekozenId(lijst[0]?.id); }} />
      )}

      <div className="planbord">
        <div className="planzijde">
          <Kaart titel="Gepland" icoon="agenda" telling={data.length} strak>
            {data.length === 0 && <Leeg tekst="Nog geen groepsconsulten gepland." />}
            {data.map((g) => (
              <button key={g.id} className="gesprekknop" data-actief={gekozen?.id === g.id}
                onClick={() => setGekozenId(g.id)}>
                <strong style={{ fontSize: 13 }}>{g.titel}</strong>
                <div className="mini">
                  {g.datum} om {g.tijd} · {g.duurMinuten} min
                </div>
                <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`chip mod-${g.module}`}>
                    <Icoon naam={icoonVanModule(g.module)} grootte={12} /> {g.thema}
                  </span>
                </div>
                <div className="mini" style={{ marginTop: 4 }}>
                  {g.deelnemers.length} van {g.maxDeelnemers} plekken · {g.aangemeld} aangemeld
                </div>
              </button>
            ))}
          </Kaart>
        </div>

        {gekozen && (
          <div>
            <Kaart titel={gekozen.titel} icoon="persoon"
              telling={`${gekozen.deelnemers.length}/${gekozen.maxDeelnemers}`}>
              <div className="regel">
                <span className="sleutel">
                  Wanneer
                  <div className="mini">{gekozen.plaats}</div>
                </span>
                <span className="waarde">
                  {gekozen.datum} · {gekozen.tijd}
                  <div className="mini" style={{ fontWeight: 400 }}>{gekozen.duurMinuten} minuten</div>
                </span>
              </div>
              <div className="regel">
                <span className="sleutel">Begeleider</span>
                <span className="waarde" style={{ fontWeight: 400 }}>
                  {gekozen.begeleider.naam}
                </span>
              </div>

              <div className="mini" style={{ marginTop: 10, marginBottom: 4 }}>Programma</div>
              <ol className="uitleg">
                {gekozen.programma.map((p) => <li key={p}>{p}</li>)}
              </ol>

              <div className="notitie" style={{ marginTop: 11 }}>
                <strong>Registratie gebeurt na afloop, per deelnemer.</strong> Het consult is
                gezamenlijk, het dossier niet: ieder krijgt zijn eigen deelcontact met wat er
                voor hém uit kwam.
              </div>
            </Kaart>

            <Kaart titel="Deelnemers" icoon="persoon" telling={gekozen.deelnemers.length}>
              {gekozen.deelnemers.length === 0 && (
                <Leeg tekst="Nog niemand aangemeld. Kies hieronder wie erbij past." />
              )}
              {gekozen.deelnemers.map((d) => (
                <div key={d.patientId} className="deelnemerregel">
                  <button className="knop" data-toon="stil" style={{ padding: 0, fontWeight: 650 }}
                    onClick={() => openPatient(d.patientId)}>
                    {d.naam} <Icoon naam="pijl" grootte={12} />
                  </button>
                  <span className="mini">{d.onderbouwing}</span>
                  <select className="statuskeuze" value={d.status}
                    onChange={async (e) => {
                      setBezigMet(d.patientId);
                      try {
                        setData(await api.zetDeelnemerstatus(gekozen.id, d.patientId, e.target.value));
                      } finally { setBezigMet(undefined); }
                    }}>
                    {Object.entries(STATUS_LABEL).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                  <span className="merkje" data-toon={STATUS_TOON[d.status] ?? 'neutraal'}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                  <button className="knop" data-toon="stil" disabled={bezigMet === d.patientId}
                    onClick={async () => {
                      setBezigMet(d.patientId);
                      try { setData(await api.verwijderDeelnemer(gekozen.id, d.patientId)); }
                      finally { setBezigMet(undefined); }
                    }}>
                    <Icoon naam="kruis" grootte={12} />
                  </button>
                </div>
              ))}
            </Kaart>

            <Kaart titel="Wie past hierbij" icoon="instroom" telling={gekozen.voorgesteld.length}>
              <p className="reden" style={{ marginTop: 0 }}>
                Patiënten bij wie dit aandachtsgebied actief is en die nog niet op de lijst
                staan. Met de onderbouwing erbij — een voorstel zonder reden is een
                willekeurige lijst.
              </p>
              {gekozen.deelnemers.length >= gekozen.maxDeelnemers && (
                <div className="notitie" data-toon="waarschuwing">
                  De groep is vol ({gekozen.maxDeelnemers} plekken).
                </div>
              )}
              {gekozen.voorgesteld.map((v) => (
                <div key={v.patientId} className="regel">
                  <span className="sleutel">
                    {v.naam}
                    <div className="mini">
                      {v.leeftijd} jaar · {v.onderbouwing}
                      {v.zelfredzaamheid !== undefined && v.zelfredzaamheid > 0
                        && ` · zelfredzaamheid ${v.zelfredzaamheid}`}
                    </div>
                  </span>
                  <span className="waarde">
                    <button className="knop"
                      disabled={bezigMet === v.patientId
                        || gekozen.deelnemers.length >= gekozen.maxDeelnemers}
                      onClick={() => voegToe(v.patientId, v.naam, v.onderbouwing)}>
                      <Icoon naam="plus" grootte={13} /> Uitnodigen
                    </button>
                  </span>
                </div>
              ))}
            </Kaart>
          </div>
        )}
      </div>
    </>
  );
}

function Nieuwvenster({ gebruiker, opKlaar }: {
  gebruiker: Gebruiker;
  opKlaar: (lijst: Groepsconsult[]) => void;
}) {
  const [themaId, setThemaId] = useState(THEMAS[0].id);
  const [datum, setDatum] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().slice(0, 10);
  });
  const [tijd, setTijd] = useState('14:00');
  const [plaats, setPlaats] = useState('Praktijkruimte achter, De Linde');
  const [bezig, setBezig] = useState(false);

  const thema = THEMAS.find((t) => t.id === themaId)!;

  const maak = async () => {
    setBezig(true);
    try {
      opKlaar(await api.maakGroepsconsult(gebruiker.id, {
        titel: thema.titel, thema: thema.thema, module: thema.module,
        start: `${datum}T${tijd}:00+02:00`,
        duurMinuten: thema.duurMinuten, plaats, maxDeelnemers: thema.maxDeelnemers,
        programma: thema.programma,
      }));
    } finally { setBezig(false); }
  };

  return (
    <Kaart titel="Nieuw groepsconsult" icoon="plus">
      <label className="veld">Thema</label>
      <div className="chips" style={{ marginBottom: 11 }}>
        {THEMAS.map((t) => (
          <button key={t.id} className="filterchip" data-actief={themaId === t.id}
            onClick={() => setThemaId(t.id)}>
            <Icoon naam={icoonVanModule(t.module)} grootte={12} /> {t.titel}
          </button>
        ))}
      </div>

      <div className="raster2">
        <div>
          <label className="veld">Datum</label>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        <div>
          <label className="veld">Begintijd</label>
          <input type="time" value={tijd} onChange={(e) => setTijd(e.target.value)} />
        </div>
      </div>

      <label className="veld" style={{ marginTop: 9 }}>Plaats</label>
      <input type="text" value={plaats} onChange={(e) => setPlaats(e.target.value)} />

      <div className="notitie" style={{ marginTop: 11 }}>
        <strong>{thema.duurMinuten} minuten · maximaal {thema.maxDeelnemers} deelnemers.</strong>{' '}
        Het blok komt in je agenda te staan, zodat niemand er een spreekuur overheen plant.
      </div>

      <div className="knop-rij" style={{ marginTop: 11 }}>
        <button className="knop" data-toon="primair" disabled={bezig} onClick={maak}>
          <Icoon naam="vink" grootte={13} /> Inplannen
        </button>
      </div>
    </Kaart>
  );
}
