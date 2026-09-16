import { useState } from 'react';
import { api, type Gebruiker, type Order, type Orderoverzicht } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const SOORT_ICOON: Record<string, string> = {
  medicatie: 'pil', lab: 'buisje', verwijzing: 'uitgaand',
  onderzoek: 'radar', afspraak: 'agenda', begeleiding: 'gesprek',
};

const STATUS_TOON: Record<string, string> = {
  'ter-autorisatie': 'aandacht', geplaatst: 'informatief',
  uitgevoerd: 'ok', afgewezen: 'urgent', ingetrokken: 'neutraal',
};

const STATUS_LABEL: Record<string, string> = {
  'ter-autorisatie': 'wacht op de huisarts', geplaatst: 'uitgezet',
  uitgevoerd: 'uitgevoerd', afgewezen: 'afgewezen', ingetrokken: 'ingetrokken',
};

/**
 * ORDEROVERZICHT
 *
 * Dit scherm bestelt niets. Bestellen doe je in het dossier, op het moment dat het
 * besluit valt — hier zie je wat daaruit gekomen is.
 *
 * De volgorde volgt de vraag die een zorgverlener stelt als hij hier komt: staat er nog
 * iets open waar iemand iets mee moet? Dan pas: wat is er ooit besteld. Een overzicht dat
 * begint met de geschiedenis, laat het openstaande werk onderin verdwijnen.
 */
export function Orders({ patientId, gebruiker, opNieuweOrder }: {
  patientId: string;
  gebruiker: Gebruiker;
  opNieuweOrder: () => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.orderOverzicht(patientId), [patientId]);
  const [toonHistorie, setToonHistorie] = useState(false);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Orders" />;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Orders</h1>
          <div className="onder">
            Medicatie, lab, onderzoek en verwijzingen — wat loopt en wat is uitgezet
          </div>
        </div>
        <div className="acties">
          <button className="knop" data-toon="primair" onClick={opNieuweOrder}>
            <Icoon naam="plus" grootte={13} /> Nieuwe order
          </button>
        </div>
      </div>

      <div className="raster2" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}>
        <div>
          <Kaart titel="Staat open" icoon="klembord" telling={data.openstaand.length}>
            {data.openstaand.length === 0 && (
              <Leeg tekst="Niets openstaand. Alles wat besteld was, is afgehandeld." />
            )}
            {data.openstaand.map((o) => <Orderregel key={o.id} order={o} />)}
          </Kaart>

          <Kaart titel="Voorgestelde pakketten" icoon="bliksem" telling={data.voorstellen.length}>
            <p className="reden" style={{ marginTop: 0 }}>
              Alleen pakketten waarvan de aanleiding in dít dossier staat — geen catalogus van
              alles wat theoretisch kan. Plaatsen doe je via <em>Nieuwe order</em>, zodat je de
              regels nog kunt aanpassen.
            </p>
            {data.voorstellen.length === 0 && (
              <span className="mini">Geen voorstellen op dit moment.</span>
            )}
            {data.voorstellen.map((v) => (
              <div key={v.set.id} className="ordervoorstel">
                <div className="kop">
                  <Icoon naam="pil" grootte={14} />
                  <strong>{v.set.naam}</strong>
                  <span className="merkje" data-toon="informatief">{v.set.regels.length} regels</span>
                </div>
                <div className="reden">{v.set.waarvoor}</div>
                <div className="mini" style={{ marginTop: 4 }}>Waarom nu: {v.onderbouwing}</div>
                {v.waarschuwingen.map((w, i) => (
                  <div key={i} className="waarschuwing" data-ernst={w.ernst}>
                    <Icoon naam="waarschuwing" grootte={13} />
                    <span>{w.tekst}{w.bron && <div className="mini">{w.bron}</div>}</span>
                  </div>
                ))}
                {v.set.richtlijn && (
                  <div className="bron" style={{ marginTop: 8 }}>
                    <span>
                      Gebaseerd op{' '}
                      {v.set.richtlijn.url ? (
                        <a className="bronlink" href={v.set.richtlijn.url} target="_blank" rel="noreferrer">
                          {v.set.richtlijn.naam}<Icoon naam="uitgaand" grootte={11} />
                        </a>
                      ) : v.set.richtlijn.naam}
                      {v.set.richtlijn.paragraaf ? ` — ${v.set.richtlijn.paragraaf}` : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </Kaart>

          <Kaart titel="Eerder besteld" icoon="lijst" telling={data.afgehandeld.length}
            extra={
              <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
                onClick={() => setToonHistorie(!toonHistorie)}>
                {toonHistorie ? 'verbergen' : 'tonen'}
              </button>
            }>
            {!toonHistorie && (
              <span className="mini">
                {data.afgehandeld.length} afgehandelde orders. Niet standaard zichtbaar — je zoekt
                hier zelden in, en het duwt het openstaande werk uit beeld.
              </span>
            )}
            {toonHistorie && data.afgehandeld.map((o) => <Orderregel key={o.id} order={o} />)}
          </Kaart>
        </div>

        <div>
          <Kaart titel="Actuele medicatie" icoon="pil" telling={data.medicatie.length}>
            {data.medicatie.length === 0 && <span className="mini">Geen chronische medicatie.</span>}
            {data.medicatie.map((m) => (
              <div key={m.naam} className="regel">
                <span className="sleutel">
                  {m.naam}
                  <div className="mini">{m.atc}{m.chronisch ? ' · chronisch' : ''}</div>
                </span>
                <span className="waarde" style={{ fontWeight: 500 }}>{m.dosering}</span>
              </div>
            ))}
            <button className="knop" style={{ marginTop: 10 }} onClick={opNieuweOrder}>
              <Icoon naam="plus" grootte={13} /> Medicatie toevoegen
            </button>
          </Kaart>

          <div className="notitie">
            <strong>Wat hier nog niet zit.</strong> Geen koppeling met de apotheek of het
            laboratorium, en geen interactiebewaking middel-op-middel — dat vraagt de
            G-Standaard. De bewaking die er wél is kijkt naar nierfunctie, leeftijd en
            polyfarmacie, en draait vóórdat je plaatst.
            {!gebruiker.rechten.includes('medicatie-voorschrijven') && (
              <> Jij mag medicatie voorstellen, niet voorschrijven: die regels gaan met
              onderbouwing naar de huisarts.</>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Orderregel({ order }: { order: Order }) {
  return (
    <div className="orderregel-vast">
      <span style={{ color: 'var(--ink-3)' }}>
        <Icoon naam={SOORT_ICOON[order.soort] ?? 'doel'} grootte={14} />
      </span>
      <span>
        <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13 }}>{order.omschrijving}</strong>
          <span className="merkje" data-toon={STATUS_TOON[order.status]}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </span>
        {order.detail && <div className="reden">{order.detail}</div>}
        <div className="mini">
          {order.geplaatstOp.slice(0, 10)} · {order.geplaatstDoor.naam}
          {order.route ? ` · ${order.route}` : ''}
          {order.bestemming ? ` · ${order.bestemming}` : ''}
          {order.uitSet ? ` · uit pakket ${order.uitSet.naam}` : ''}
        </div>
        {order.waarschuwingen.map((w, i) => (
          <div key={i} className="mini" style={{ color: 'var(--aandacht)' }}>{w.tekst}</div>
        ))}
      </span>
    </div>
  );
}
