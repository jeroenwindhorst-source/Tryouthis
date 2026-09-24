import { useState } from 'react';
import { api, OPVOLGBRON_LABEL, type Opvolgbron, type Opvolgregel, type Suggestie } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import {
  ErnstMerk, Fout, Kaart, Laden, Leeg, ModuleChips, SuggestieKaart, Zelfredzaamheidsmeter,
} from '../onderdelen';

/**
 * OPVOLGEN — alles wat aandacht vraagt bij wie vandaag niet komt
 *
 * Dit scherm stond eerst naast 'Monitoren', en die twee gingen over grotendeels dezelfde
 * mensen: dezelfde eGFR van 40 stond hier als binnengekomen uitslag en daar als
 * afwijkende waarde. Twee lijsten waarvan je moet onthouden in welke iets staat, kosten
 * meer dan ze opleveren.
 *
 * Nu één lijst, één vorm: aanleiding, bevinding, voorstel, en drie knoppen om het af te
 * handelen. De aanleiding blijft zichtbaar en filterbaar, want die bepaalt hoe je
 * reageert — een uitslag lees je anders dan een zin die iemand zelf opschreef.
 *
 * Het volledige cohort dat op afstand wordt gevolgd, inclusief iedereen die stabiel is,
 * staat onder Praktijk › Mijn cohort. Dat is een overzicht, geen werklijst.
 */

const ICOON: Record<Opvolgbron, string> = {
  labuitslag: 'buisje', vragenlijst: 'gesprek', thuismeting: 'radar', signaal: 'grafiek',
};

/** Waarom deze aanleiding anders is dan de andere — één regel, bij het filter. */
const WAAROM: Record<Opvolgbron, string> = {
  labuitslag: 'Binnengekomen op een aanvraag van de praktijk.',
  vragenlijst: 'De patiënt heeft zelf iets opgeschreven.',
  thuismeting: 'De patiënt meet zelf, en de reeks wijkt af.',
  signaal: 'Er kwam niets binnen; het beloop in het dossier wijkt af.',
};

export function Opvolgen({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig, setData } = useData(() => api.opvolgen());
  const [gedaan, setGedaan] = useState<Record<string, string>>({});
  const [uitgeklapt, setUitgeklapt] = useState<string | undefined>();
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  const [filter, setFilter] = useState<Opvolgbron | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Opvolgen" />;

  const open = data.filter((o) => !gedaan[o.id]);
  const zichtbaar = filter ? data.filter((o) => o.bron === filter) : data;
  const aanwezig = [...new Set(data.map((o) => o.bron))];

  const handel = async (regel: Opvolgregel, suggestie: Suggestie, actieId: string) => {
    setBezigMet(regel.patientId + suggestie.regelId);
    try {
      await api.suggestie(regel.patientId, suggestie.regelId, actieId);
      setData(await api.opvolgen());
    } finally { setBezigMet(undefined); }
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Opvolgen</h1>
          <div className="onder">
            {open.length} vragen aandacht · {open.filter((o) => o.ernst === 'urgent').length} urgent
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Zonder afspraak af te handelen.</strong> Alles hieronder gaat over patiënten die
        vandaag niet op het spreekuur staan. Voor het merendeel is een bericht of een aangepast
        recept genoeg. Wat je hier afhandelt, hoeft niet in een consult van twintig minuten.
      </div>

      {/*
        Filteren op aanleiding, niet op ernst. Ernst staat al in de volgorde; de aanleiding
        bepaalt hóé je reageert, en dat is waar je op wilt kunnen inzoomen.
      */}
      {aanwezig.length > 1 && (
        <div className="tijdlijnfilter" data-stijl="keuze">
          <button className="merkje" data-toon={filter ? 'neutraal' : 'informatief'}
            data-aan={!filter} onClick={() => setFilter(undefined)}>
            Alles <span className="mini">{data.length}</span>
          </button>
          {aanwezig.map((bron) => (
            <button key={bron} className="merkje" title={WAAROM[bron]}
              data-toon={filter === bron ? 'informatief' : 'neutraal'}
              data-aan={filter === bron}
              onClick={() => setFilter(filter === bron ? undefined : bron)}>
              <Icoon naam={ICOON[bron]} grootte={11} /> {OPVOLGBRON_LABEL[bron]}
              <span className="mini">{data.filter((o) => o.bron === bron).length}</span>
            </button>
          ))}
        </div>
      )}

      {filter && <div className="reden" style={{ margin: '0 0 12px' }}>{WAAROM[filter]}</div>}

      {data.length === 0 && <Leeg tekst="Er is niets dat om een besluit vraagt." />}

      <div style={{ display: 'grid', gap: 12 }}>
        {zichtbaar.map((o) => {
          const uit = uitgeklapt === o.id;
          return (
            <section key={o.id} className="kaart" style={{ opacity: gedaan[o.id] ? 0.6 : 1 }}>
              <header>
                <span style={{ color: 'var(--merk)' }}><Icoon naam={ICOON[o.bron]} grootte={15} /></span>
                <h2 style={{ fontSize: 15 }}>{o.naam}</h2>
                <span className="mini">{o.leeftijd} jaar</span>
                <span className="merkje" data-toon="neutraal">{OPVOLGBRON_LABEL[o.bron]}</span>
                <span className="mini">{o.binnenOp}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {gedaan[o.id]
                    ? <span className="merkje" data-toon="ok">{gedaan[o.id]}</span>
                    : <ErnstMerk ernst={o.ernst} />}
                </span>
              </header>

              <div className="body">
                {(o.modules.length > 0 || o.zelfredzaamheid) && (
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <ModuleChips modules={o.modules} />
                    {o.zelfredzaamheid && (
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Zelfredzaamheidsmeter {...o.zelfredzaamheid} compact />
                        <span className="mini">zelfredzaamheid</span>
                      </span>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{o.titel}</div>
                <div className="reden" style={{ marginTop: 4 }}>{o.bevinding}</div>

                <div style={{
                  marginTop: 11, padding: '9px 11px',
                  background: 'var(--merk-zacht)', borderRadius: 6, color: 'var(--merk-diep)',
                }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontWeight: 600, fontSize: 12 }}>
                    <Icoon naam="bliksem" grootte={13} /> Voorstel
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 3 }}>{o.voorstel}</div>
                </div>

                {/*
                  De afhandelbare suggesties zaten eerder achter een tweede scherm. Ze horen
                  hier, onder de regel die ze veroorzaakte — anders moet je twee lijsten
                  langs voor één besluit.
                */}
                {uit && o.suggesties.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {o.suggesties.map((s) => (
                      <SuggestieKaart key={s.id} suggestie={s}
                        bezig={bezigMet === o.patientId + s.regelId}
                        opActie={(actieId) => handel(o, s, actieId)} />
                    ))}
                  </div>
                )}

                {!gedaan[o.id] && (
                  <div className="knop-rij" style={{ marginTop: 13 }}>
                    <button className="knop" data-toon="primair" onClick={() => openPatient(o.patientId)}>
                      <Icoon naam="klembord" grootte={13} /> Openen en afhandelen
                    </button>
                    {o.suggesties.length > 0 && (
                      <button className="knop" data-toon={uit ? undefined : 'aandacht'}
                        onClick={() => setUitgeklapt(uit ? undefined : o.id)}>
                        <Icoon naam={uit ? 'kruis' : 'bliksem'} grootte={13} />
                        {uit
                          ? ' Sluiten'
                          : ` ${o.suggesties.length} suggestie${o.suggesties.length === 1 ? '' : 's'} hier afhandelen`}
                      </button>
                    )}
                    <button className="knop"
                      onClick={() => setGedaan((g) => ({ ...g, [o.id]: 'bericht gestuurd' }))}>
                      <Icoon naam="gesprek" grootte={13} /> Bericht sturen
                    </button>
                    <button className="knop"
                      onClick={() => setGedaan((g) => ({ ...g, [o.id]: 'bij volgende controle' }))}>
                      <Icoon naam="agenda" grootte={13} /> Kan wachten tot de controle
                    </button>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Kaart titel="Wie hier niet staat" icoon="vink">
        <p className="mini" style={{ margin: 0 }}>
          Iedereen die je op afstand volgt en bij wie niets afwijkt. Dat is geen gat in dit
          scherm maar de uitkomst: geen oproep nodig. Het volledige cohort staat onder
          <strong> Praktijk › Mijn cohort</strong>.
        </p>
      </Kaart>
    </>
  );
}
