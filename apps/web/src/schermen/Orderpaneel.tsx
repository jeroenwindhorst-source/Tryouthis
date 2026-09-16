import { useEffect, useState } from 'react';
import {
  api, type Catalogustreffer, type Gebruiker, type NieuweOrder, type VoorgesteldeOrderSet,
} from '../api';
import { Icoon } from '../iconen';

const SOORT_ICOON: Record<string, string> = {
  medicatie: 'pil', lab: 'buisje', verwijzing: 'uitgaand',
  onderzoek: 'radar', afspraak: 'agenda', begeleiding: 'gesprek',
};

const SOORTEN = [
  { id: 'medicatie', label: 'Medicatie' },
  { id: 'lab', label: 'Lab' },
  { id: 'onderzoek', label: 'Onderzoek' },
  { id: 'verwijzing', label: 'Verwijzing' },
  { id: 'afspraak', label: 'Afspraak' },
] as const;

/**
 * Hoe een afspraak in de agenda komt.
 *
 * Vier routes, en welke je kiest hangt af van de patiënt en niet van de gebruiker.
 * Dezelfde POH kiest bij de ene mens het portaal en belt bij de andere; dat is geen
 * inconsistentie maar zorg. Daarom staat de keuze bij de order en niet in een instelling.
 */
const ROUTES = [
  { id: 'zelf', label: 'Ik plan het nu in', uitleg: 'Je kiest zelf een vrije plek in de agenda.' },
  { id: 'assistent', label: 'Assistent belt en plant', uitleg: 'Komt op de werklijst van de assistent, met de reden erbij.' },
  { id: 'portaal', label: 'Patiënt plant zelf', uitleg: 'Uitnodiging in het portaal; de patiënt kiest uit de opengestelde plekken.' },
  { id: 'automatisch', label: 'Systeem plant', uitleg: 'Alleen voor routine zonder beoordeling. De patiënt krijgt een bevestiging.' },
] as const;

type Soort = (typeof SOORTEN)[number]['id'];

/** Wat er in het mandje ligt: een order plus wat de gebruiker eraan veranderd heeft. */
interface Mandjeregel extends NieuweOrder {
  sleutel: string;
  varianten: string[];
}

/**
 * HET ORDERPANEEL
 *
 * Twee manieren om iets te bestellen, in één paneel, omdat het één handeling is.
 *
 * Links in het dossier klik je op "Medicatie" of "Verwijzing" en dit schuift open. Je
 * zoekt een middel, een bepaling of een specialisme, past de dosering of de vraagstelling
 * aan en legt het in het mandje. Daaronder staan de pakketten die het systeem voorstelt
 * op grond van dit dossier — die kun je in één keer meenemen.
 *
 * Het mandje is er omdat een consult zelden één order oplevert. Je bestelt de pijnstiller
 * én de controle én de verwijzing, en je wilt dat in één handeling doen met één overzicht
 * van wat er uitgaat en wat er langs de huisarts moet.
 */
export function Orderpaneel({ patientId, patientNaam, gebruiker, startSoort, opSluit, opGeplaatst }: {
  patientId: string;
  patientNaam: string;
  gebruiker: Gebruiker;
  startSoort?: Soort;
  opSluit: () => void;
  opGeplaatst: (orders: NieuweOrder[]) => void;
}) {
  const [soorten, setSoorten] = useState<Soort[]>(startSoort ? [startSoort] : []);
  const [vraag, setVraag] = useState('');
  const [treffers, setTreffers] = useState<Catalogustreffer[]>([]);
  const [buitenFilter, setBuitenFilter] = useState(0);
  const [voorstellen, setVoorstellen] = useState<VoorgesteldeOrderSet[]>([]);
  const [mandje, setMandje] = useState<Mandjeregel[]>([]);
  const [bezig, setBezig] = useState(false);
  const [toonVoorstellen, setToonVoorstellen] = useState(true);

  useEffect(() => { api.orders(patientId).then(setVoorstellen).catch(() => setVoorstellen([])); }, [patientId]);

  useEffect(() => {
    let geldig = true;
    if (vraag.trim().length < 2) { setTreffers([]); setBuitenFilter(0); return; }
    api.zoekOrders(patientId, vraag, soorten).then((r) => { if (geldig) setTreffers(r); });
    // Het paneel opent vaak met een filter aan ("Medicatie"), en dan levert zoeken op
    // "chirurgie" niets op. Zonder deze telling lijkt de catalogus leeg terwijl het
    // antwoord één klik verderop staat.
    if (soorten.length > 0) {
      api.zoekOrders(patientId, vraag).then((r) => { if (geldig) setBuitenFilter(r.length); });
    } else setBuitenFilter(0);
    return () => { geldig = false; };
  }, [patientId, vraag, soorten.join(',')]);

  const legIn = (regel: Omit<Mandjeregel, 'sleutel'>) =>
    setMandje((m) => [...m, { ...regel, sleutel: `${regel.omschrijving}-${m.length}-${Date.now()}` }]);

  const uitCatalogus = (t: Catalogustreffer, detail: string, planroute?: string) => legIn({
    patientId,
    soort: t.soort,
    omschrijving: t.naam,
    detail,
    atc: t.atc,
    route: t.route,
    bestemming: t.instellingen?.[0],
    waarschuwingen: t.waarschuwingen,
    levert: t.levert,
    bijRol: t.bijRol,
    duurMinuten: t.duurMinuten,
    planroute: t.soort === 'afspraak' ? (planroute ?? 'assistent') : undefined,
    vereistRecht: t.vereistRecht,
    varianten: t.varianten,
  });

  const uitSet = (voorstel: VoorgesteldeOrderSet) => {
    for (const regel of voorstel.set.regels.filter((r) => r.standaardAan)) {
      const geblokkeerd = voorstel.waarschuwingen.some(
        (w) => w.ernst === 'blokkerend' && regel.soort === 'medicatie');
      if (geblokkeerd) continue;
      legIn({
        patientId,
        soort: regel.soort,
        omschrijving: regel.omschrijving,
        detail: regel.detail,
        atc: regel.atc,
        uitSet: { id: voorstel.set.id, naam: voorstel.set.naam },
        richtlijn: voorstel.set.richtlijn,
        waarschuwingen: voorstel.waarschuwingen,
        levert: regel.levert,
        vereistRecht: regel.vereistRecht,
        varianten: [],
      });
    }
  };

  const plaats = async () => {
    if (mandje.length === 0) return;
    setBezig(true);
    try {
      const orders: NieuweOrder[] = mandje.map(({ sleutel: _s, varianten: _v, ...rest }) => rest);
      await api.plaatsOrders(gebruiker.id, orders);
      opGeplaatst(orders);
      setMandje([]);
      opSluit();
    } finally { setBezig(false); }
  };

  const direct = mandje.filter((m) => gebruiker.rechten.includes(m.vereistRecht));
  const naarArts = mandje.filter((m) => !gebruiker.rechten.includes(m.vereistRecht));
  const blokkerend = mandje.some((m) => m.waarschuwingen?.some((w) => w.ernst === 'blokkerend'));

  return (
    <>
      <div className="paneel-scherm" onClick={opSluit} />
      <aside className="orderpaneel" role="dialog" aria-label="Order plaatsen">
        <header>
          <div>
            <h2>Order plaatsen</h2>
            <div className="mini">{patientNaam}</div>
          </div>
          <button className="knop" data-toon="stil" onClick={opSluit} title="Sluiten">
            <Icoon naam="kruis" grootte={15} />
          </button>
        </header>

        <div className="paneel-body">
          <div className="chips" style={{ marginBottom: 10 }}>
            <button className="filterchip" data-actief={soorten.length === 0}
              onClick={() => setSoorten([])}>Alles</button>
            {SOORTEN.map((s) => (
              <button key={s.id} className="filterchip" data-actief={soorten.includes(s.id)}
                onClick={() => setSoorten((huidig) =>
                  huidig.includes(s.id) ? huidig.filter((x) => x !== s.id) : [...huidig, s.id])}>
                <Icoon naam={SOORT_ICOON[s.id]} grootte={13} /> {s.label}
              </button>
            ))}
          </div>

          <div className="zoekdoos" style={{ marginBottom: 12 }}>
            <span className="icoon"><Icoon naam="vergrootglas" grootte={15} /></span>
            <input type="search" value={vraag} autoFocus
              placeholder="Zoek middel, bepaling, onderzoek of specialisme"
              onChange={(e) => setVraag(e.target.value)} />
          </div>

          {vraag.trim().length >= 2 && treffers.length === 0 && (
            buitenFilter > 0 ? (
              <div className="notitie">
                Niets binnen dit filter, maar wel <strong>{buitenFilter}</strong> daarbuiten.{' '}
                <button className="knop" data-toon="stil" onClick={() => setSoorten([])}>
                  Toon alles
                </button>
              </div>
            ) : (
              <p className="mini">Niets gevonden. De demo-catalogus is klein en bewust onvolledig.</p>
            )
          )}

          {treffers.map((t) => (
            <Trefferregel key={t.id} treffer={t} mag={gebruiker.rechten.includes(t.vereistRecht)}
              opKies={(detail, planroute) => uitCatalogus(t, detail, planroute)} />
          ))}

          {vraag.trim().length < 2 && (
            <>
              <button className="knop" data-toon="stil" style={{ marginBottom: 8 }}
                onClick={() => setToonVoorstellen(!toonVoorstellen)}>
                <Icoon naam={toonVoorstellen ? 'kruis' : 'plus'} grootte={13} />
                {voorstellen.length} voorgestelde pakketten
              </button>

              {toonVoorstellen && voorstellen.length === 0 && (
                <p className="mini">
                  Geen pakketvoorstellen: er staat op dit moment niets in het dossier dat er
                  aanleiding toe geeft. Zoek hierboven een losse order.
                </p>
              )}

              {toonVoorstellen && voorstellen.map((v) => (
                <div key={v.set.id} className="ordervoorstel">
                  <div className="kop">
                    <Icoon naam="pil" grootte={14} />
                    <strong>{v.set.naam}</strong>
                    <span className="merkje" data-toon="neutraal">{v.set.regels.length} regels</span>
                  </div>
                  <div className="reden">{v.onderbouwing}</div>
                  <ul className="mini">
                    {v.set.regels.filter((r) => r.standaardAan).map((r) => (
                      <li key={r.id}>{r.omschrijving}{r.detail ? ` — ${r.detail}` : ''}</li>
                    ))}
                  </ul>
                  {v.waarschuwingen.map((w, i) => (
                    <div key={i} className="waarschuwing" data-ernst={w.ernst}>
                      <Icoon naam="waarschuwing" grootte={13} />
                      <span>{w.tekst}{w.bron && <div className="mini">{w.bron}</div>}</span>
                    </div>
                  ))}
                  <div className="knop-rij">
                    <button className="knop" onClick={() => uitSet(v)}>
                      <Icoon naam="plus" grootte={13} /> Hele pakket toevoegen
                    </button>
                    {v.set.richtlijn?.url && (
                      <a className="bronlink" href={v.set.richtlijn.url} target="_blank" rel="noreferrer">
                        {v.set.richtlijn.naam}<Icoon naam="uitgaand" grootte={11} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <footer className="paneel-voet">
          {mandje.length === 0 ? (
            <span className="mini">Nog niets gekozen. Zoek hierboven of neem een pakket over.</span>
          ) : (
            <>
              <div className="mandje">
                {mandje.map((m) => (
                  <div key={m.sleutel} className="mandjeregel">
                    <span style={{ color: 'var(--ink-3)' }}>
                      <Icoon naam={SOORT_ICOON[m.soort] ?? 'doel'} grootte={13} />
                    </span>
                    <span>
                      <strong style={{ fontSize: 12.5 }}>{m.omschrijving}</strong>
                      {m.detail && <div className="mini">{m.detail}</div>}
                      {m.uitSet && <div className="mini">uit pakket {m.uitSet.naam}</div>}
                    </span>
                    {m.planroute && (
                      <span className="merkje" data-toon="informatief">
                        {ROUTES.find((r) => r.id === m.planroute)?.label ?? m.planroute}
                      </span>
                    )}
                    {!gebruiker.rechten.includes(m.vereistRecht) && (
                      <span className="merkje" data-toon="aandacht">naar huisarts</span>
                    )}
                    <button className="knop" data-toon="stil"
                      onClick={() => setMandje((l) => l.filter((x) => x.sleutel !== m.sleutel))}
                      title="Van de lijst halen">
                      <Icoon naam="kruis" grootte={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="knop-rij" style={{ marginTop: 10 }}>
                <button className="knop" data-toon="primair" disabled={bezig || blokkerend}
                  onClick={plaats}>
                  <Icoon naam="vink" grootte={13} /> Plaatsen ({mandje.length})
                </button>
                <span className="mini" style={{ alignSelf: 'center' }}>
                  {blokkerend
                    ? 'Er staat een blokkerende contra-indicatie in de lijst. Haal die regel eruit.'
                    : `${direct.length} gaan direct uit, ${naarArts.length} als voorstel naar de huisarts.`}
                </span>
              </div>
            </>
          )}
        </footer>
      </aside>
    </>
  );
}

/**
 * Eén zoekresultaat.
 *
 * De dosering of vraagstelling staat al ingevuld en is aan te passen vóórdat je hem
 * toevoegt — niet erna in een bewerkscherm. Wat je het vaakst kiest, staat als knop
 * klaar; typen is de uitzondering.
 */
function Trefferregel({ treffer, mag, opKies }: {
  treffer: Catalogustreffer; mag: boolean; opKies: (detail: string, planroute?: string) => void;
}) {
  const [detail, setDetail] = useState(treffer.detail);
  const [planroute, setPlanroute] = useState<string>('assistent');
  const [open, setOpen] = useState(false);
  const blokkerend = treffer.waarschuwingen.some((w) => w.ernst === 'blokkerend');

  return (
    <div className="ordertreffer" data-open={open}>
      <button className="hoofdregel" onClick={() => setOpen(!open)}>
        <span style={{ color: 'var(--ink-3)' }}>
          <Icoon naam={SOORT_ICOON[treffer.soort] ?? 'doel'} grootte={14} />
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <strong style={{ fontSize: 13 }}>{treffer.naam}</strong>
          <div className="mini">{detail}{treffer.route ? ` · ${treffer.route}` : ''}</div>
        </span>
        {treffer.waarschuwingen.length > 0 && (
          <span className="merkje" data-toon={blokkerend ? 'urgent' : 'aandacht'}>
            {blokkerend ? 'geblokkeerd' : 'let op'}
          </span>
        )}
        {!mag && <span className="merkje" data-toon="aandacht">via huisarts</span>}
      </button>

      {open && (
        <div className="uitklap">
          {treffer.waarschuwingen.map((w, i) => (
            <div key={i} className="waarschuwing" data-ernst={w.ernst}>
              <Icoon naam="waarschuwing" grootte={13} />
              <span>{w.tekst}{w.bron && <div className="mini">{w.bron}</div>}</span>
            </div>
          ))}

          <label className="veld">
            {treffer.soort === 'medicatie' ? 'Dosering'
              : treffer.soort === 'verwijzing' ? 'Vraagstelling' : 'Toelichting'}
          </label>
          <input type="text" value={detail} onChange={(e) => setDetail(e.target.value)} />

          {treffer.varianten.length > 0 && (
            <div className="chips" style={{ marginTop: 7 }}>
              {treffer.varianten.map((v) => (
                <button key={v} className="filterchip" data-actief={detail === v}
                  onClick={() => setDetail(v)}>{v}</button>
              ))}
            </div>
          )}

          {treffer.soort === 'afspraak' && (
            <div style={{ marginTop: 11 }}>
              <label className="veld">Wie plant deze afspraak in?</label>
              <div className="routekeuze">
                {ROUTES.map((r) => (
                  <button key={r.id} className="routeknop" data-actief={planroute === r.id}
                    onClick={() => setPlanroute(r.id)}>
                    <strong>{r.label}</strong>
                    <span className="mini">{r.uitleg}</span>
                  </button>
                ))}
              </div>
              <div className="mini" style={{ marginTop: 6 }}>
                Bij de {treffer.bijRol} · {treffer.duurMinuten} minuten · {treffer.vorm}
              </div>
            </div>
          )}

          {treffer.instellingen && treffer.instellingen.length > 0 && (
            <div className="mini" style={{ marginTop: 7 }}>
              Bestemming: {treffer.instellingen.join(', ')}
            </div>
          )}
          {treffer.portaal && (
            <div className="mini" style={{ marginTop: 3 }}>
              Terugkoppeling verschijnt in het journaal; het dossier van de instelling is te
              openen via {treffer.portaal.naam}.
            </div>
          )}

          <div className="knop-rij" style={{ marginTop: 9 }}>
            <button className="knop" data-toon="primair" disabled={blokkerend}
              onClick={() => { opKies(detail, planroute); setOpen(false); }}>
              <Icoon naam="plus" grootte={13} /> Toevoegen
            </button>
            {blokkerend && (
              <span className="mini" style={{ alignSelf: 'center', color: 'var(--urgent)' }}>
                Gecontraïndiceerd bij deze patiënt.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
