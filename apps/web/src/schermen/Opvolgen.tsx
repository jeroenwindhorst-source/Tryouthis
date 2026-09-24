import { useState } from 'react';
import {
  api, OPVOLGBRON_LABEL,
  type Gebruiker, type NieuweTaak, type Opvolgbron, type Opvolgregel, type Suggestie,
  type Taaksoort,
} from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import {
  ErnstMerk, Fout, Kaart, Laden, Leeg, ModuleChips, SuggestieKaart, Zelfredzaamheidsmeter,
} from '../onderdelen';
import { Takenpaneel } from './Takenpaneel';

type Voorstel = {
  soort: Taaksoort; titel: string; aanleiding: string;
  patientId?: string; patientNaam?: string;
  bron: NieuweTaak['bron']; uiterlijkOp?: string;
};

/**
 * Welk soort werk een aanleiding meestal oplevert.
 *
 * Een voorstel, geen regel: in het paneel kies je alsnog. Maar de meest voorkomende keuze
 * vooraf invullen scheelt bij elke regel een handeling, en de verkeerde gok kost één klik.
 */
const STANDAARDSOORT: Record<Opvolgbron, Taaksoort> = {
  labuitslag: 'uitslag-bespreken',
  vragenlijst: 'bellen',
  thuismeting: 'uitslag-bespreken',
  signaal: 'voorbereiden',
};

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

export function Opvolgen({ gebruiker, openPatient }: {
  gebruiker: Gebruiker;
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig, setData, herlaad } = useData(() => api.opvolgen());
  const [uitgeklapt, setUitgeklapt] = useState<string | undefined>();
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  const [filter, setFilter] = useState<Opvolgbron | undefined>();
  const [paneel, setPaneel] = useState<Voorstel | undefined>();
  const [melding, setMelding] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Opvolgen" />;

  const open = data.filter((o) => !o.taak);

  const voorstelVoor = (o: Opvolgregel, soort: Taaksoort): Voorstel => ({
    soort,
    titel: `${o.naam}: ${o.titel}`.slice(0, 90),
    aanleiding: `${o.titel} — ${o.bevinding} Voorstel: ${o.voorstel}`,
    patientId: o.patientId,
    patientNaam: o.naam,
    bron: { soort: 'opvolgen', verwijzing: o.id },
  });
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
            {data.length - open.length > 0 && ` · ${data.length - open.length} opgepakt`}
          </div>
        </div>
      </div>

      {melding && (
        <div className="notitie" data-toon="merk" style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
          <Icoon naam="vink" grootte={14} /> {melding}
          <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
            onClick={() => setMelding(undefined)}>Sluiten</button>
        </div>
      )}

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
            <section key={o.id} className="kaart" style={{ opacity: o.taak ? 0.72 : 1 }}>
              <header>
                <span style={{ color: 'var(--merk)' }}><Icoon naam={ICOON[o.bron]} grootte={15} /></span>
                <h2 style={{ fontSize: 15 }}>{o.naam}</h2>
                <span className="mini">{o.leeftijd} jaar</span>
                <span className="merkje" data-toon="neutraal">{OPVOLGBRON_LABEL[o.bron]}</span>
                <span className="mini">{o.binnenOp}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {o.taak
                    ? <span className="merkje" data-toon="ok">opgepakt</span>
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

                {o.taak && (
                  <div className="taakstand">
                    <Icoon naam="vink" grootte={14} />
                    <strong>{o.taak.soortLabel}</strong>
                    <span>ligt bij {o.taak.voorNaam}</span>
                    <span className="merkje" data-toon={o.taak.status === 'gepland' ? 'ok' : 'informatief'}>
                      {o.taak.standLabel}
                    </span>
                  </div>
                )}

                {!o.taak && (
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
                    {/*
                      Uitzetten in plaats van 'afvinken'. De vorige versie zette alleen
                      een merkje in dit scherm, en dan was er na het verversen niets
                      gebeurd — de patiënt was niet gebeld en niemand wist ervan.
                    */}
                    <button className="knop"
                      onClick={() => setPaneel(voorstelVoor(o, STANDAARDSOORT[o.bron]))}>
                      <Icoon naam="bliksem" grootte={13} /> Taak uitzetten
                    </button>
                    <button className="knop"
                      onClick={() => setPaneel(voorstelVoor(o, 'bericht-sturen'))}>
                      <Icoon naam="gesprek" grootte={13} /> Bericht sturen
                    </button>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {paneel && (
        <Takenpaneel gebruiker={gebruiker} voorstel={paneel}
          opSluit={() => setPaneel(undefined)}
          opUitgezet={(tekst) => { setPaneel(undefined); setMelding(tekst); herlaad(); }} />
      )}

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
