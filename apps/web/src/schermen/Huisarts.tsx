import { useState } from 'react';
import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Agenda, Fout, Kaart, Laden, Leeg } from '../onderdelen';

/**
 * Werkplek van de huisarts.
 *
 * Het autorisatiescherm is bewust anders dan wat bestaande systemen tonen. In Bricks
 * Huisarts staat de teller in de screenshot op 163 (docs/10 §3.1) — een getal dat groeit
 * tot iemand het 's avonds wegklikt. Hier is dezelfde stapel gesorteerd op de enige vraag
 * die telt: welke hiervan vragen écht jouw oordeel?
 */
export function HuisartsWerkplek({ scherm, openPatient }: {
  scherm: 'overzicht' | 'autoriseren' | 'team';
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.huisarts());
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Werkplek" />;

  const accordeer = async (ids: string[], sleutel: string) => {
    setBezigMet(sleutel);
    try { setData(await api.accordeer(ids)); } finally { setBezigMet(undefined); }
  };
  const afwijzen = async (id: string, reden: string) => {
    setBezigMet(id);
    try { setData(await api.wijsAutorisatieAf(id, reden)); } finally { setBezigMet(undefined); }
  };

  const datum = new Date(data.datum).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  if (scherm === 'overzicht') {
    return (
      <>
        <div className="paginakop">
          <div>
            <h1>Goedemorgen, {data.zorgverlener.naam.split(' ')[0]}</h1>
            <div className="onder">{datum} · {data.zorgverlener.rol}</div>
          </div>
        </div>

        <div className="stappen">
          <div className="stap">
            <div className="kop">
              <span className="ikoon"><Icoon naam="agenda" /></span>
              <h3>Spreekuur</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{data.agenda.filter((a) => a.patientId).length}</span>
              <span className="naast">consulten vandaag</span>
            </div>
            <div className="wat">Plus visites en overleg met POH en assistent.</div>
          </div>
          <div className="stap" data-aandacht={data.autorisatie.vraagtOordeel > 0}>
            <div className="kop">
              <span className="ikoon"><Icoon naam="klembord" /></span>
              <h3>Autoriseren</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{data.autorisatie.vraagtOordeel}</span>
              <span className="naast">vragen jouw oordeel</span>
            </div>
            <div className="wat">
              Van {data.autorisatie.open} openstaande verzoeken is {data.autorisatie.routine} routine
              en veilig in bulk af te handelen.
            </div>
          </div>
          <div className="stap">
            <div className="kop">
              <span className="ikoon"><Icoon naam="persoon" /></span>
              <h3>Het team</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{data.team.reduce((s, t) => s + t.registraties, 0)}</span>
              <span className="naast">registraties vandaag</span>
            </div>
            <div className="wat">Wat POH, assistent en ingebedde apps hebben vastgelegd, met herkomst.</div>
          </div>
        </div>

        <div className="raster2">
          <Kaart titel="Mijn dag" icoon="agenda" telling={data.agenda.length}>
            <Agenda regels={data.agenda} openPatient={openPatient} />
          </Kaart>

          <div>
            <Kaart titel="Autorisatie in één oogopslag" icoon="klembord">
              <div className="vergelijking" style={{ marginBottom: 12 }}>
                <div>
                  <div className="cijfer">{data.autorisatie.open}</div>
                  <div className="onder">op de stapel</div>
                </div>
                <span style={{ color: 'var(--merk-diep)' }}><Icoon naam="pijl" grootte={20} /></span>
                <div>
                  <div className="cijfer">{data.autorisatie.vraagtOordeel}</div>
                  <div className="onder">vragen jouw oordeel</div>
                </div>
                <div className="uitleg">
                  De rest is routine: binnen protocol, binnen referentiewaarde, geen interactie.
                  Elk verzoek zegt waarom het op de stapel ligt.
                </div>
              </div>
              {data.autorisatie.groepen.slice(0, 4).map((g) => (
                <div key={g.soort} className="regel">
                  <span className="sleutel">{g.titel}<div className="mini">{g.toelichting}</div></span>
                  <span className="waarde">
                    {g.vraagtOordeel.length > 0 && (
                      <span className="merkje" data-toon="aandacht">{g.vraagtOordeel.length} beoordelen</span>
                    )}{' '}
                    <span className="merkje" data-toon="neutraal">{g.routine.length} routine</span>
                  </span>
                </div>
              ))}
            </Kaart>
          </div>
        </div>
      </>
    );
  }

  if (scherm === 'team') {
    return (
      <>
        <div className="paginakop">
          <div>
            <h1>Het team</h1>
            <div className="onder">Wat er vandaag is vastgelegd, en door wie</div>
          </div>
        </div>

        <div className="notitie">
          <strong>Herkomst is nooit weggelaten.</strong> Bij elke registratie staat wie hem heeft
          vastgelegd, in welke rol, en of er een AI-hulpmiddel bij betrokken was. Wat een
          AI-component voorstelt telt pas mee als een mens het heeft bevestigd — dat filter zit in
          de datalaag, niet in een afspraak.
        </div>

        <Kaart titel="Registraties vandaag" icoon="persoon" strak>
          <table>
            <thead>
              <tr><th style={{ width: 210 }}>Wie</th><th style={{ width: 110 }}>Vastgelegd</th><th>Wat</th></tr>
            </thead>
            <tbody>
              {data.team.map((t) => (
                <tr key={t.rol}>
                  <td className="nadruk">{t.naam}<div className="mini">{t.rol}</div></td>
                  <td className="nadruk" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.registraties}</td>
                  <td className="reden">{t.toelichting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kaart>
      </>
    );
  }

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Autoriseren</h1>
          <div className="onder">
            {data.autorisatie.open} openstaand · {data.autorisatie.vraagtOordeel} vragen jouw oordeel
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Een teller is geen werkvoorraad.</strong> Deze stapel is gesorteerd op de enige vraag
        die telt: waar moet een arts naar kijken? Wat binnen protocol valt, binnen de referentiewaarde
        ligt en geen interactie geeft, kan in één handeling — met de onderbouwing erbij, zodat je ziet
        waar je voor tekent.
      </div>

      {data.autorisatie.open === 0 && <Leeg tekst="Niets openstaand. Dat komt zelden voor." />}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.autorisatie.groepen.map((groep) => (
          <section key={groep.soort} className="kaart">
            <header>
              <span style={{ color: groep.vraagtOordeel.length ? 'var(--aandacht)' : 'var(--ink-3)' }}>
                <Icoon naam={groep.vraagtOordeel.length ? 'waarschuwing' : 'klembord'} />
              </span>
              <h2>{groep.titel}</h2>
              {groep.vraagtOordeel.length > 0 && (
                <span className="merkje" data-toon="aandacht">{groep.vraagtOordeel.length} beoordelen</span>
              )}
              <span className="telling">{groep.routine.length + groep.vraagtOordeel.length}</span>
            </header>
            <div className="body">
              {groep.vraagtOordeel.length > 0 && (
                <>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', marginBottom: 8 }}>
                    Vraagt jouw oordeel
                  </h3>
                  {groep.vraagtOordeel.map((v) => (
                    <div key={v.id} className="suggestie" data-ernst="aandacht">
                      <div className="kop">
                        <h3>{v.omschrijving}</h3>
                        <span className="merkje" data-toon="neutraal">{v.naam}</span>
                        <span className="mini" style={{ marginLeft: 'auto' }}>
                          {v.ingediendDoor.naam} · {v.ingediendOp.slice(11, 16)}
                        </span>
                      </div>
                      <div className="bevinding">{v.aanleiding}</div>
                      {v.redenGeenRoutine && (
                        <div className="waarom">Waarom niet routine: {v.redenGeenRoutine}.</div>
                      )}
                      <div className="knop-rij">
                        <button className="knop" data-toon="primair" disabled={bezigMet === v.id}
                          onClick={() => accordeer([v.id], v.id)}>
                          <Icoon naam="vink" grootte={13} /> Akkoord
                        </button>
                        <button className="knop" disabled={bezigMet === v.id}
                          onClick={() => afwijzen(v.id, 'eerst een afspraak inplannen')}>
                          Niet akkoord — afspraak eerst
                        </button>
                        <button className="knop" data-toon="stil" onClick={() => openPatient(v.patientId)}>
                          Dossier openen
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {groep.routine.length > 0 && (
                <div style={{ marginTop: groep.vraagtOordeel.length ? 14 : 0 }}>
                  <div className="automatisch">
                    <h3><Icoon naam="bliksem" /> {groep.routine.length} routineverzoeken</h3>
                    <div style={{ fontSize: 12.5, color: 'var(--ok)', marginBottom: 10 }}>
                      {groep.toelichting}
                    </div>
                    <div className="knop-rij">
                      <button className="knop" data-toon="primair"
                        disabled={bezigMet === groep.soort}
                        onClick={() => accordeer(groep.routine.map((v) => v.id), groep.soort)}>
                        <Icoon naam="vink" grootte={13} /> Alle {groep.routine.length} accorderen
                      </button>
                      <button className="knop">Eerst bekijken</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
