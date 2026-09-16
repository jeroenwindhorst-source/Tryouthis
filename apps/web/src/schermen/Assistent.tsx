import { useState } from 'react';
import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Agenda, Fout, Kaart, Laden, Leeg } from '../onderdelen';

const KANAAL_ICOON: Record<string, string> = {
  telefoon: 'gesprek', portaal: 'huis', balie: 'persoon', 'e-consult': 'gesprek',
};

const URGENTIE_TOON: Record<string, string> = {
  spoed: 'urgent', vandaag: 'urgent', 'deze-week': 'aandacht',
  routine: 'neutraal', zelfzorg: 'ok',
};

/**
 * Werkplek van de doktersassistent.
 *
 * Het startscherm is de stróóm, niet de agenda (docs/05 §2): wat komt er binnen en waar
 * moet het heen. Telefonisch en digitaal lopen door één triagemodel — in de procesplaat
 * komen die twee routes samen bij dezelfde gestructureerde zorgvraag (docs/12 §2.2).
 */
export function AssistentWerkplek({ scherm, gaNaar, openPatient }: {
  scherm: 'overzicht' | 'triage';
  /** Ook hier zijn de tegels knoppen: elke tegel brengt je naar het scherm waar dat werk staat. */
  gaNaar: (scherm: string) => void;
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.assistent());

  // De assistent is degene die dit in de praktijk bijhoudt: wie er binnenkomt, wie
  // zich meldt aan de balie en wie niet komt opdagen.
  const zetStatus = async (afspraakId: string, status: string) => {
    const agenda = await api.zetAfspraakstatus(afspraakId, status, 'assistent');
    setData((huidig) => huidig && { ...huidig, agenda });
  };
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Werkplek" />;

  const afhandelen = async (id: string) => {
    setBezigMet(id);
    try { setData(await api.handelTriageAf(id)); } finally { setBezigMet(undefined); }
  };

  if (scherm === 'overzicht') {
    return (
      <>
        <div className="paginakop">
          <div>
            <h1>Goedemorgen, {data.zorgverlener.naam.split(' ')[0]}</h1>
            <div className="onder">
              {new Date(data.datum).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}{data.zorgverlener.rol}
            </div>
          </div>
        </div>

        <div className="stappen">
          <button className="stap" onClick={() => gaNaar('as-triage')}>
            <span className="pijl"><Icoon naam="pijl" grootte={14} /></span>
            <div className="kop">
              <span className="ikoon"><Icoon naam="gesprek" /></span>
              <h3>Binnengekomen</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{data.stroom.triageNieuw}</span>
              <span className="naast">zorgvragen te beoordelen</span>
            </div>
            <div className="wat">
              {data.stroom.viaPortaal} via het portaal (al getrieerd), {data.stroom.viaTelefoon} telefonisch of aan de balie.
            </div>
          </button>
          <button className="stap" onClick={() => gaNaar('as-triage')}>
            <span className="pijl"><Icoon naam="pijl" grootte={14} /></span>
            <div className="kop">
              <span className="ikoon"><Icoon naam="bliksem" /></span>
              <h3>Zelf afgevangen</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{data.stroom.zelfzorgAfgevangen}</span>
              <span className="naast">met zelfzorgadvies</span>
            </div>
            <div className="wat">
              Digitale triage gaf een advies waarmee de patiënt verder kon. Geen afspraak nodig.
            </div>
          </button>
          <button className="stap" onClick={() => gaNaar('plannen')}>
            <span className="pijl"><Icoon naam="pijl" grootte={14} /></span>
            <div className="kop">
              <span className="ikoon"><Icoon naam="agenda" /></span>
              <h3>Mijn agenda</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{data.agenda.filter((a) => a.patientId).length}</span>
              <span className="naast">verrichtingen</span>
            </div>
            <div className="wat">Plus telefonisch spreekuur en het routeren van post en uitslagen.</div>
          </button>
          <button className="stap" onClick={() => gaNaar('overleg')}>
            <span className="pijl"><Icoon naam="pijl" grootte={14} /></span>
            <div className="kop">
              <span className="ikoon"><Icoon naam="klembord" /></span>
              <h3>Naar de huisarts</h3>
            </div>
            <div className="cijfers">
              <span className="groot">{data.autorisatieIngediend}</span>
              <span className="naast">wachten op akkoord</span>
            </div>
            <div className="wat">Recepten, uitslagen en post die jij hebt klaargezet.</div>
          </button>
        </div>

        <div className="raster2">
          <Kaart titel="Mijn dag" icoon="agenda" telling={data.agenda.length}>
            <Agenda regels={data.agenda} openPatient={openPatient} opStatus={zetStatus} />
          </Kaart>

          <Kaart titel="Nieuw binnengekomen" icoon="gesprek" telling={data.triage.length}>
            {data.triage.slice(0, 5).map((t) => (
              <div key={t.id} style={{ paddingBottom: 11, marginBottom: 11, borderBottom: '1px solid var(--line-zacht)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--ink-3)' }}>
                    <Icoon naam={KANAAL_ICOON[t.kanaal] ?? 'gesprek'} grootte={14} />
                  </span>
                  <strong style={{ fontSize: 13 }}>{t.naam}</strong>
                  <span className="mini">{t.leeftijd} jaar · {t.binnenOp.slice(11, 16)}</span>
                  {t.zelftriage && (
                    <span className="merkje" data-toon={URGENTIE_TOON[t.zelftriage.urgentie]}>
                      {t.zelftriage.urgentie}
                    </span>
                  )}
                </div>
                <div className="reden" style={{ marginTop: 3 }}>{t.hulpvraag}</div>
              </div>
            ))}
            {data.triage.length === 0 && <Leeg tekst="Niets openstaand." />}
          </Kaart>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Triage</h1>
          <div className="onder">{data.triage.length} zorgvragen · één model, twee kanalen</div>
        </div>
      </div>

      <div className="notitie">
        <strong>Digitaal en telefonisch lopen door hetzelfde model.</strong> Wie via het portaal
        binnenkomt heeft de triagevragen al doorlopen; die uitkomst staat hieronder, inclusief het
        advies dat de patiënt al heeft gekregen. Wie belt, trieer jij — met dezelfde vragen, zodat
        de uitkomst vergelijkbaar is en de zorgvraag hetzelfde in het dossier landt.
      </div>

      {data.triage.length === 0 && <Leeg tekst="Alle zorgvragen zijn afgehandeld." />}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.triage.map((t) => (
          <section key={t.id} className="kaart">
            <header>
              <span style={{ color: 'var(--ink-3)' }}>
                <Icoon naam={KANAAL_ICOON[t.kanaal] ?? 'gesprek'} />
              </span>
              <h2 style={{ fontSize: 14 }}>{t.naam}</h2>
              <span className="mini">{t.leeftijd} jaar</span>
              <span className="merkje" data-toon="neutraal">{t.kanaal}</span>
              <span className="telling">{t.binnenOp.slice(11, 16)}</span>
            </header>
            <div className="body">
              <div style={{ fontStyle: 'italic', marginBottom: 10 }}>“{t.hulpvraag}”</div>

              {t.zelftriage ? (
                <div className="automatisch" style={{ marginBottom: 12 }}>
                  <h3><Icoon naam="bliksem" /> Digitale triage is al doorlopen</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span className="merkje" data-toon={URGENTIE_TOON[t.zelftriage.urgentie]}>
                      {t.zelftriage.urgentie}
                    </span>
                    <span className="merkje" data-toon="neutraal">naar {t.zelftriage.bestemming}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ok)' }}>{t.zelftriage.toelichting}</div>
                </div>
              ) : (
                <div className="notitie" data-toon="waarschuwing" style={{ marginBottom: 12 }}>
                  <strong>Telefonisch binnengekomen.</strong> Loop de triagevragen door; de uitkomst
                  landt op dezelfde manier als bij digitale triage.
                </div>
              )}

              <div className="knop-rij">
                <button className="knop" data-toon="primair" disabled={bezigMet === t.id}
                  onClick={() => afhandelen(t.id)}>
                  <Icoon naam="agenda" grootte={13} /> Afspraak inplannen
                </button>
                <button className="knop" disabled={bezigMet === t.id} onClick={() => afhandelen(t.id)}>
                  <Icoon naam="pijl" grootte={13} /> Doorzetten naar POH
                </button>
                <button className="knop" disabled={bezigMet === t.id} onClick={() => afhandelen(t.id)}>
                  <Icoon naam="waarschuwing" grootte={13} /> Overleg huisarts
                </button>
                <button className="knop" data-toon="stil" disabled={bezigMet === t.id}
                  onClick={() => afhandelen(t.id)}>
                  Zelfzorgadvies, geen afspraak
                </button>
                <button className="knop" data-toon="stil" onClick={() => openPatient(t.patientId)}>
                  Dossier openen
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
