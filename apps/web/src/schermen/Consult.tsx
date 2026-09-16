import { useState, type CSSProperties } from 'react';
import {
  api, MODULE_NAAM,
  type ExternDocument, type GeplandContact, type GeplandItem, type Gebruiker,
  type JournaalRegel, type Meetreeks, type NieuweOrder, type PatientOverzicht,
  type RegistratieUitkomst, type Treffer,
} from '../api';
import { useData } from '../gebruik';
import { Trendgrafiek } from '../grafiek';
import { Icoon, icoonVanModule } from '../iconen';
import {
  ErnstMerk, Fout, IntakeKaart, Kaart, Laden, Leeg, ModuleIdChips, Signalen, SuggestieKaart,
  Zelfredzaamheidsmeter,
} from '../onderdelen';
import { Orders } from './Orders';
import { Orderpaneel } from './Orderpaneel';
import { Bespreekknop } from './Overleg';

/**
 * Veelgebruikte planafspraken.
 *
 * Geen keuzelijst die de tekst vervangt, maar bouwstenen die de vier zinnen invullen die
 * iedereen elke dag typt. Wat overblijft is het deel dat werkelijk over deze mens gaat.
 */
const PLANZINNEN = [
  'Controle over 3 maanden',
  'Controle over 6 weken',
  'Uitleg gegeven en meegegeven via het portaal',
  'Thuis zelf meten en doorgeven',
  'Contact opnemen bij verergering',
  'Besproken met de huisarts',
];

const INTENSITEITEN = [
  { id: 'extensief', label: 'rustig', uitleg: 'stabiel, weinig risico, patiënt wil rust' },
  { id: 'basis', label: 'volgens plan', uitleg: 'het protocol als uitgangspunt' },
  { id: 'intensief', label: 'intensief', uitleg: 'ontregeld of hoog risico' },
  { id: 'eigen-regie', label: 'eigen regie', uitleg: 'patiënt monitort zelf, meldt zich bij afwijking' },
  { id: 'palliatief', label: 'palliatief', uitleg: 'streefwaarden vervallen, comfort leidend' },
];

type Tab = 'consult' | 'journaal' | 'metingen' | 'orders';
type OrderSoort = 'medicatie' | 'lab' | 'onderzoek' | 'verwijzing';

/** Wat er tijdens het consult wordt ingevuld. Staat hier, zodat de wachtkamer-intake het kan vullen. */
export interface Registratie {
  waarden: Record<string, string>;
  soep: Record<string, string>;
  episodeId: string;
  suggestieCodes: { icpc: string; display: string }[];
}

export function Consult({ patientId, gebruiker, terug }: {
  patientId: string;
  gebruiker: Gebruiker;
  terug: () => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.patient(patientId), [patientId]);
  const [tab, setTab] = useState<Tab>('consult');
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  const [toonNietActief, setToonNietActief] = useState(false);
  const [uitkomst, setUitkomst] = useState<RegistratieUitkomst | undefined>();
  const [gekozenMeting, setGekozenMeting] = useState<string | undefined>();
  const [orderpaneel, setOrderpaneel] = useState<OrderSoort | 'alles' | undefined>();
  const [ordersVandaag, setOrdersVandaag] = useState<NieuweOrder[]>([]);
  const [registratie, setRegistratie] = useState<Registratie>({
    waarden: {}, soep: {}, episodeId: '', suggestieCodes: [],
  });

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Dossier" />;

  const plan = data.zorgplan;
  const klinisch = data.suggesties.filter((s) => s.klasse === 'klinisch');
  const logistiek = data.suggesties.filter((s) => s.klasse === 'logistiek');

  const werk = async (sleutel: string, actie: () => Promise<PatientOverzicht>) => {
    setBezigMet(sleutel);
    try { setData(await actie()); } finally { setBezigMet(undefined); }
  };
  const wijzigPlan = (wijziging: Parameters<typeof api.plan>[1], sleutel: string) =>
    werk(sleutel, () => api.plan(patientId, wijziging));

  /**
   * De intake overnemen vult daadwerkelijk de registratie: de anamnese komt in het
   * S-veld, de meegebrachte metingen in de meetvelden en de codesuggesties komen als
   * kiesbare E-codering klaar te staan. Zonder die doorwerking is "overnemen" een knop
   * die niets doet.
   */
  const neemIntakeOver = async () => {
    const intake = data.intake;
    if (!intake) return;
    setRegistratie((r) => ({
      ...r,
      soep: { ...r.soep, S: intake.anamnese },
      waarden: {
        ...r.waarden,
        ...Object.fromEntries(intake.metingen.map((m) => [m.code, String(m.waarde)])),
      },
      suggestieCodes: intake.codesuggesties.map((c) => ({ icpc: c.icpc, display: c.display })),
    }));
    setTab('consult');
    await werk('intake', async () => {
      await api.bevestigIntake(intake.id);
      return api.patient(patientId);
    });
  };

  const opMetingKlik = (code: string) => { setGekozenMeting(code); setTab('metingen'); };

  return (
    <>
      <div className="patientbalk">
        <button className="knop" onClick={terug}>
          <Icoon naam="pijl-links" grootte={13} /> Terug
        </button>
        <span className="naam">{data.patient.naam}</span>
        <span className="mini">
          {data.patient.geboortedatum} · {data.patient.leeftijd} jaar · BSN {data.patient.bsn}
        </span>
        <ModuleIdChips ids={plan.modules.map((m) => m.id)} />
        <span style={{ marginLeft: 'auto' }}>
          {data.patient.portaalActief
            ? <span className="merkje" data-toon="ok">portaal actief</span>
            : (
              <button className="knop" style={{ padding: '3px 10px', fontSize: 11.5 }}
                title="Nodig de patiënt uit voor het portaal">
                <Icoon naam="huis" grootte={12} /> Geen portaal — uitnodigen
              </button>
            )}
        </span>
      </div>

      <div className="dossiertabs">
        <button data-actief={tab === 'consult'} onClick={() => setTab('consult')}>
          <Icoon naam="klembord" grootte={14} /> Consult
        </button>
        <button data-actief={tab === 'journaal'} onClick={() => setTab('journaal')}>
          <Icoon naam="lijst" grootte={14} /> Journaal
        </button>
        <button data-actief={tab === 'metingen'} onClick={() => setTab('metingen')}>
          <Icoon naam="buisje" grootte={14} /> Meetwaarden
        </button>
        <button data-actief={tab === 'orders'} onClick={() => setTab('orders')}>
          <Icoon naam="pil" grootte={14} /> Orders
        </button>
      </div>

      {tab === 'journaal' && <Journaal patientId={patientId} />}
      {tab === 'metingen' && (
        <Metingen patientId={patientId} gekozen={gekozenMeting} opKies={setGekozenMeting} />
      )}
      {tab === 'orders' && (
        <Orders patientId={patientId} gebruiker={gebruiker}
          opNieuweOrder={() => setOrderpaneel('alles')} />
      )}

      {orderpaneel && (
        <Orderpaneel patientId={patientId} patientNaam={data.patient.naam} gebruiker={gebruiker}
          startSoort={orderpaneel === 'alles' ? undefined : orderpaneel}
          opSluit={() => setOrderpaneel(undefined)}
          opGeplaatst={(orders) => setOrdersVandaag((l) => [...l, ...orders])} />
      )}

      {tab === 'consult' && (
        <div className="dossier">
          {/* ── Links: wie is dit ──────────────────────────────────────── */}
          <div>
            {plan.zelfredzaamheid && plan.zelfredzaamheid.gemiddelde > 0 && (
              <Kaart titel="Zelfredzaamheid" icoon="schild"
                telling={plan.zelfredzaamheid.trend
                  ? `${plan.zelfredzaamheid.trend.verschil > 0 ? '+' : ''}${plan.zelfredzaamheid.trend.verschil}`
                  : undefined}>
                <Zelfredzaamheidsmeter
                  gemiddelde={plan.zelfredzaamheid.gemiddelde}
                  niveau={plan.zelfredzaamheid.niveau}
                  richting={plan.zelfredzaamheid.trend?.richting} />
                <p className="reden" style={{ marginTop: 9 }}>{plan.zelfredzaamheid.betekenis}</p>

                {plan.zelfredzaamheid.knelpunten.length > 0 && (
                  <>
                    <div className="mini" style={{ marginTop: 10, marginBottom: 4 }}>Knelpunten</div>
                    {plan.zelfredzaamheid.knelpunten.map((k) => (
                      <div key={k.domein.id} className="domein"
                        style={{ '--zrm-kleur': 'var(--aandacht)' } as CSSProperties}>
                        <span className="naam">{k.domein.naam}
                          <div className="mini">{k.domein.zorgbetekenis}</div>
                        </span>
                        <span className="punten">
                          {[1, 2, 3, 4, 5].map((n) => <i key={n} data-aan={n <= k.score} />)}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                <div className="mini" style={{ marginTop: 10 }}>
                  Contact-intervallen staan hierdoor op factor {plan.zelfredzaamheid.factor}.
                  {!plan.zelfredzaamheid.digitaalBereikbaar && ' Digitale oproep is niet passend.'}
                </div>
              </Kaart>
            )}

            {plan.doelen.length > 0 && (
              <Kaart titel="Wat deze patiënt zelf wil" icoon="doel">
                {plan.doelen.map((d) => (
                  <div key={d.id} style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--merk-diep)' }}>
                    “{d.tekst}”
                    <div className="mini" style={{ fontStyle: 'normal', marginTop: 3 }}>
                      afgesproken {d.afgesprokenOp}
                    </div>
                  </div>
                ))}
              </Kaart>
            )}

            <Kaart titel="Signalen" icoon="waarschuwing">
              <Signalen signalen={data.signalen} />
            </Kaart>

            <Kaart titel="Medicatie" icoon="pil" telling={data.medicatie.length}>
              {data.medicatie.length === 0 && <span className="mini">Geen chronische medicatie.</span>}
              {data.medicatie.map((m) => (
                <div key={m.naam} className="regel">
                  <span className="sleutel">{m.naam}<div className="mini">{m.atc}</div></span>
                  <span className="waarde" style={{ fontWeight: 500 }}>{m.dosering}</span>
                </div>
              ))}
            </Kaart>

            {/*
              Bestellen hoort bij het besluit, dus staat het hier — naast de medicatie en
              binnen handbereik tijdens het consult. Het ordertabblad is het overzicht
              achteraf; daar begin je geen recept.
            */}
            <Kaart titel="Bestellen" icoon="uitgaand"
              telling={ordersVandaag.length > 0 ? `${ordersVandaag.length} vandaag` : undefined}>
              <div className="orderknoppen">
                <button className="knop" onClick={() => setOrderpaneel('medicatie')}>
                  <Icoon naam="pil" grootte={13} /> Medicatie
                </button>
                <button className="knop" onClick={() => setOrderpaneel('verwijzing')}>
                  <Icoon naam="uitgaand" grootte={13} /> Verwijzing
                </button>
                <button className="knop" onClick={() => setOrderpaneel('lab')}>
                  <Icoon naam="buisje" grootte={13} /> Lab
                </button>
                <button className="knop" onClick={() => setOrderpaneel('onderzoek')}>
                  <Icoon naam="radar" grootte={13} /> Onderzoek
                </button>
              </div>
              <button className="knop" data-toon="stil" style={{ marginTop: 8 }}
                onClick={() => setTab('orders')}>
                Alles wat loopt <Icoon naam="pijl" grootte={12} />
              </button>
            </Kaart>

            <Bespreekknop patientId={patientId} naam={data.patient.naam} gebruiker={gebruiker} />

            <Kaart titel="Oproepen" icoon="gesprek" telling={data.oproepen.length}>
              {data.oproepen.length === 0 && (
                <span className="mini">Geen oproepen — past bij de gekozen aanpak.</span>
              )}
              {data.oproepen.slice(0, 2).map((o, i) => (
                <div key={i} style={{ marginBottom: 9 }}>
                  <div className="regel">
                    <span className="sleutel">{o.uitnodigenOp}</span>
                    <span className="waarde"><span className="merkje" data-toon="neutraal">{o.kanaal}</span></span>
                  </div>
                  <div className="mini">{o.toelichting}</div>
                </div>
              ))}
            </Kaart>
          </div>

          {/* ── Midden: beslissen, registreren, plannen ─────────────────── */}
          <div>
            {data.intake && (
              <IntakeKaart intake={data.intake} bezig={bezigMet === 'intake'}
                opBevestig={neemIntakeOver} />
            )}

            <Kaart titel="Beslissingsondersteuning" icoon="gesprek" telling={`${klinisch.length} voor jou`}>
              {klinisch.length === 0 && logistiek.length === 0 && (
                <span className="mini">Geen suggesties. Alles loopt volgens plan.</span>
              )}
              {klinisch.map((s) => (
                <SuggestieKaart key={s.id} suggestie={s} bezig={bezigMet === s.regelId}
                  opActie={(actieId) => werk(s.regelId, () => api.suggestie(patientId, s.regelId, actieId))} />
              ))}
              {logistiek.length > 0 && (
                <div className="automatisch" style={{ marginTop: klinisch.length ? 14 : 0, marginBottom: 0 }}>
                  <h3><Icoon naam="bliksem" /> Dit regelt het systeem zelf</h3>
                  <ul>{logistiek.map((s) => <li key={s.id}>{s.titel} — {s.bevinding}</li>)}</ul>
                </div>
              )}
            </Kaart>

            {uitkomst && (
              <Kaart titel="Consult afgerond" icoon="afvinken"
                telling={`${uitkomst.vastgelegd.length} vastgelegd`}>
                <div className="afgerondkop">
                  <span className="merkje" data-toon="ok">
                    <Icoon naam="vink" grootte={11} /> vastgelegd in het dossier
                  </span>
                  <span className="mini">
                    De afspraak van vandaag staat nu op <strong>afgerond</strong> in de agenda.
                  </span>
                </div>

                <table>
                  <tbody>
                    {uitkomst.vastgelegd.map((v) => (
                      <tr key={v.code}>
                        <td>{v.naam}</td>
                        <td className="rechts getal">{v.waarde}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {ordersVandaag.length > 0 && (
                  <>
                    <div className="mini" style={{ marginTop: 10, marginBottom: 4 }}>
                      Orders die aan dit consult hangen
                    </div>
                    <ul className="uitleg">
                      {ordersVandaag.map((o, i) => (
                        <li key={i}>{o.omschrijving}{o.detail ? ` — ${o.detail}` : ''}</li>
                      ))}
                    </ul>
                  </>
                )}

                {uitkomst.verantwoordingGevuld.length > 0 && (
                  <div className="notitie" data-toon="ok" style={{ marginTop: 10 }}>
                    Hiermee zijn vanzelf op orde:{' '}
                    {uitkomst.verantwoordingGevuld.map((v) => `${v.indicator} (${v.keten})`).join(', ')}.
                  </div>
                )}
                {uitkomst.vervolg.length > 0 && (
                  <ul className="uitleg" style={{ marginTop: 8 }}>
                    {uitkomst.vervolg.map((v, i) => <li key={i}>{v}</li>)}
                  </ul>
                )}

                <div className="knop-rij" style={{ marginTop: 12 }}>
                  <button className="knop" onClick={() => setTab('journaal')}>
                    <Icoon naam="boek" grootte={13} /> Bekijk in het journaal
                  </button>
                  <button className="knop" onClick={terug}>
                    <Icoon naam="pijl-links" grootte={13} /> Terug naar het spreekuur
                  </button>
                  <button className="knop" data-toon="stil" onClick={() => setUitkomst(undefined)}>
                    Nog iets vastleggen
                  </button>
                </div>
              </Kaart>
            )}

            {!uitkomst && (
              <Registreren patientId={patientId} overzicht={data} registratie={registratie}
                ordersVandaag={ordersVandaag} opOrder={() => setOrderpaneel('alles')}
                opWijzig={setRegistratie}
                opKlaar={(nieuw, uit) => { setData(nieuw); setUitkomst(uit); }} />
            )}

            <Kaart titel="Het plan van deze patiënt" icoon="agenda" telling={`${plan.contacten.length} contacten`}>
              {plan.contacten.length > 0 && !plan.vergelijking.valtBuitenKeten && (
                <div className="vergelijking">
                  <div>
                    <div className="cijfer">{plan.vergelijking.traditioneleContacten}</div>
                    <div className="onder" title={plan.vergelijking.traditioneleTrajecten.join(', ')}>
                      losse trajecten
                    </div>
                  </div>
                  <span style={{ color: 'var(--merk-diep)' }}><Icoon naam="pijl" grootte={20} /></span>
                  <div>
                    <div className="cijfer">{plan.vergelijking.geintegreerdeContacten}</div>
                    <div className="onder">geïntegreerde contacten</div>
                  </div>
                  <div className="uitleg">
                    <div className="chips" style={{ marginBottom: 5 }}>
                      {plan.vergelijking.traditioneleTrajecten.map((t) => (
                        <span key={t} className="merkje" data-toon="neutraal">{t}</span>
                      ))}
                    </div>
                    {plan.vergelijking.extraOnderwerpen.length > 0 && (
                      <>Die trajecten dekken {plan.vergelijking.extraOnderwerpen.join(', ')} niet.</>
                    )}
                  </div>
                </div>
              )}

              {plan.vergelijking.valtBuitenKeten && (
                <div className="notitie" data-toon="waarschuwing">
                  <strong>Valt buiten elke landelijke keten.</strong> Wel een chronische zorgvraag,
                  geen programma. In de huidige inrichting krijgt deze patiënt daar geen
                  gestructureerde begeleiding voor.
                </div>
              )}

              {plan.contacten.map((contact) => (
                <ContactKaart key={contact.id} contact={contact} opMetingKlik={opMetingKlik} />
              ))}

              {plan.toelichting.length > 0 && (
                <>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', margin: '15px 0 5px' }}>
                    Waarom dit plan er zo uitziet
                  </h3>
                  <ul className="uitleg">{plan.toelichting.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </>
              )}
              {plan.consequenties.length > 0 && (
                <>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)', margin: '15px 0 5px' }}>
                    Gevolgen van gemaakte keuzes
                  </h3>
                  <ul className="uitleg">{plan.consequenties.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </>
              )}
            </Kaart>

            <Kaart titel="Op maat maken" icoon="schakelaar">
              <label className="veld">Hoe intensief volgen we deze patiënt?</label>
              <div className="segment" style={{ marginBottom: 14 }}>
                {INTENSITEITEN.map((i) => (
                  <button key={i.id} data-actief={plan.intensiteit === i.id} title={i.uitleg}
                    disabled={Boolean(bezigMet)}
                    onClick={() => wijzigPlan({ intensiteit: i.id }, 'intensiteit')}>
                    {i.label}
                  </button>
                ))}
              </div>

              <div className="raster2">
                <div>
                  <label className="veld">Hoe vaak wil de patiënt maximaal komen?</label>
                  <div className="segment">
                    {[undefined, 2, 3, 4].map((n) => (
                      <button key={String(n)} data-actief={data.persoonlijk.voorkeuren.maxContactenPerJaar === n}
                        disabled={Boolean(bezigMet)}
                        onClick={() => wijzigPlan({
                          voorkeuren: { ...data.persoonlijk.voorkeuren, maxContactenPerJaar: n },
                        }, 'max')}>
                        {n === undefined ? 'geen maximum' : `${n}× per jaar`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="veld">Metingen die de patiënt thuis kan doen</label>
                  <div className="segment">
                    <button data-actief={!data.persoonlijk.voorkeuren.liefstThuismeting}
                      disabled={Boolean(bezigMet)}
                      onClick={() => wijzigPlan({
                        voorkeuren: { ...data.persoonlijk.voorkeuren, liefstThuismeting: false },
                      }, 'thuis')}>in de praktijk</button>
                    <button data-actief={data.persoonlijk.voorkeuren.liefstThuismeting === true}
                      disabled={Boolean(bezigMet)}
                      onClick={() => wijzigPlan({
                        voorkeuren: { ...data.persoonlijk.voorkeuren, liefstThuismeting: true },
                      }, 'thuis')}>liefst thuis</button>
                  </div>
                </div>
              </div>

              <label className="veld" style={{ marginTop: 14 }}>Aandachtsgebieden</label>
              {plan.modules.map((module) => (
                <div key={module.id} className={`modulekaart mod-${module.id}`}>
                  <div className="kop">
                    <span style={{ color: 'var(--tint)' }}>
                      <Icoon naam={icoonVanModule(module.id, module.icoon)} />
                    </span>
                    <h3>{module.naam}</h3>
                    {module.herkomst === 'handmatig-aan' && (
                      <span className="merkje" data-toon="informatief">handmatig aan</span>
                    )}
                    <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
                      disabled={Boolean(bezigMet)}
                      onClick={() => wijzigPlan({
                        moduleKeuzes: [
                          ...data.persoonlijk.moduleKeuzes.filter((k) => k.moduleId !== module.id),
                          { moduleId: module.id, aan: false, reden: 'wordt elders gevolgd', door: gebruiker.naam, op: new Date().toISOString().slice(0, 10) },
                        ],
                      }, `uit-${module.id}`)}>
                      <Icoon naam="kruis" grootte={13} /> Uitzetten
                    </button>
                  </div>
                  <div className="reden">{module.onderbouwing}</div>
                </div>
              ))}

              <button className="knop" data-toon="stil" style={{ marginTop: 6 }}
                onClick={() => setToonNietActief(!toonNietActief)}>
                <Icoon naam={toonNietActief ? 'kruis' : 'plus'} grootte={13} />
                {toonNietActief ? 'Verberg' : `Toon ${plan.nietActief.length} niet-actieve gebieden`}
              </button>

              {toonNietActief && (
                <div style={{ marginTop: 9 }}>
                  {plan.nietActief.map((m) => (
                    <div key={m.id} className="regel">
                      <span className="sleutel">{m.naam}<div className="mini">{m.onderbouwing}</div></span>
                      <span className="waarde">
                        <button className="knop" data-toon="stil" disabled={Boolean(bezigMet)}
                          onClick={() => wijzigPlan({
                            moduleKeuzes: [
                              ...data.persoonlijk.moduleKeuzes.filter((k) => k.moduleId !== m.id),
                              { moduleId: m.id, aan: true, reden: 'op klinische gronden toegevoegd', door: gebruiker.naam, op: new Date().toISOString().slice(0, 10) },
                            ],
                          }, `aan-${m.id}`)}>
                          <Icoon naam="plus" grootte={13} /> Aanzetten
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Kaart>
          </div>

          {/* ── Rechts: dossierstructuur ───────────────────────────────── */}
          <div>
            <Kaart titel="Episodes" icoon="lijst" telling={data.episodes.length} strak>
              <table>
                <tbody>
                  {data.episodes.map((e) => (
                    <tr key={e.id}>
                      <td style={{ width: 62 }} className="nadruk">{e.icpc}</td>
                      <td>
                        <button className="knop" data-toon="stil" style={{ padding: 0, textAlign: 'left' }}
                          onClick={() => setTab('journaal')}>{e.titel}</button>
                        <div className="mini">sinds {e.start}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Kaart>

            <Kaart titel="Verantwoording" icoon="tag" telling={plan.ketens.length}>
              <p className="mini" style={{ marginTop: 0 }}>
                Automatisch afgeleid. Je registreert hier niets voor.
              </p>
              {plan.ketens.length === 0 && <span className="mini">Valt onder geen landelijke keten.</span>}
              {plan.ketens.map((keten) => (
                <div key={keten.ketenId} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <strong style={{ fontSize: 12.5 }}>{keten.naam}</strong>
                    <span className="merkje"
                      data-toon={keten.volledigheid === 1 ? 'ok' : keten.volledigheid > 0.6 ? 'aandacht' : 'urgent'}>
                      {Math.round(keten.volledigheid * 100)}%
                    </span>
                  </div>
                  <div className="mini">{keten.declaratie.prestatiecode} · {keten.grondslag}</div>
                  <div style={{ marginTop: 5, display: 'grid', gap: 2 }}>
                    {keten.indicatoren.filter((i) => !i.voldaan).map((i) => (
                      <div key={i.code} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                        <span style={{ color: 'var(--aandacht)' }}><Icoon naam="kruis" grootte={11} /></span>
                        {i.naam} <span className="mini">— {i.toelichting}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Kaart>

            <Kaart titel="Meetwaarden nu" icoon="buisje"
              extra={
                <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
                  onClick={() => setTab('metingen')}>
                  alles <Icoon naam="pijl" grootte={12} />
                </button>
              }>
              <p className="mini" style={{ marginTop: 0 }}>
                Wat voor dít contact telt. De rest staat onder Meetwaarden.
              </p>
              {(plan.contacten[0]?.metingen ?? []).filter((m) => m.laatsteWaarde !== undefined).map((m) => (
                <button key={m.code} className="regel"
                  style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => opMetingKlik(m.code)}>
                  <span className="sleutel">{m.naam}</span>
                  <span className="waarde" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {m.laatsteWaarde}
                    <div className="mini" style={{ fontWeight: 400 }}>{m.laatsteOp}</div>
                  </span>
                </button>
              ))}
            </Kaart>
          </div>
        </div>
      )}
    </>
  );
}

function ContactKaart({ contact, opMetingKlik }: {
  contact: GeplandContact; opMetingKlik: (code: string) => void;
}) {
  return (
    <div className="contact" data-soort={contact.soort}>
      <div className="kop">
        <span className="datum">{contact.datum}</span>
        <span className="merkje" data-toon={contact.soort === 'uitgebreide-controle' ? 'informatief' : 'neutraal'}>
          {contact.soort === 'uitgebreide-controle' ? 'uitgebreid' : 'controle'}
        </span>
        <ModuleIdChips ids={contact.modules} />
        <span className="duur"><Icoon naam="klok" grootte={13} /> {contact.duurMinuten} min</span>
      </div>

      {contact.metingen.map((m) => (
        <div className="meting" key={m.code}>
          <span className="naam">
            {m.naam}
            {m.modules.length > 1 && (
              <span className="merkje" data-toon="ok">
                telt voor {m.modules.map((x) => MODULE_NAAM[x] ?? x).join(' + ')}
              </span>
            )}
            {m.zelfAanleverbaar && <span className="merkje" data-toon="neutraal">thuis mogelijk</span>}
            {m.labVooraf && <span className="merkje" data-toon="aandacht">lab vooraf</span>}
          </span>
          <span className="waarde">
            {m.laatsteWaarde !== undefined ? (
              <button className="knop" data-toon="stil" style={{ padding: '0 4px', fontSize: 12 }}
                title="Bekijk het beloop van deze meting"
                onClick={() => opMetingKlik(m.code)}>
                {m.laatsteWaarde} op {m.laatsteOp} <Icoon naam="pijl" grootte={11} />
              </button>
            ) : 'nog niet bepaald'}
          </span>
        </div>
      ))}

      {contact.vragenlijsten.length > 0 && (
        <div className="mini" style={{ marginTop: 7 }}>
          Vooraf uitzetten: {contact.vragenlijsten.join(', ')}
        </div>
      )}
    </div>
  );
}

/**
 * HET JOURNAAL — eigen zorg én wat van buiten kwam
 *
 * Links de bronnen: onze eigen episodes (huisartsenzorg) en daaronder de partijen waar
 * deze patiënt ook komt. Rechts één chronologische stroom waarin beide door elkaar staan,
 * want zo is de zorg ook verlopen.
 *
 * Wat wij vastlegden staat in SOEP. Wat van buiten kwam níet: een BgZ heeft vaste secties,
 * een e-Overdracht een verpleegkundige structuur. Dat in SOEP persen zou de herkomst
 * wegpoetsen, en juist die moet zichtbaar blijven — het is niet van ons en het telt niet
 * automatisch mee in de beslisregels.
 */
function Journaal({ patientId }: { patientId: string }) {
  const [bron, setBron] = useState<string | undefined>();
  const [open, setOpen] = useState<string | undefined>();
  const { data, fout, bezig, setData } = useData(
    () => api.historie(patientId, bron), [patientId, bron]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Journaal" />;

  const eigen = data.bronnen.filter((b) => b.aard === 'episode');
  const extern = data.bronnen.filter((b) => b.aard !== 'episode');

  const lees = async (documentId: string) => {
    setOpen(open === documentId ? undefined : documentId);
    if (open !== documentId) setData(await api.markeerExternGelezen(patientId, documentId));
  };

  return (
    <div className="raster2" style={{ gridTemplateColumns: '282px minmax(0, 1fr)' }}>
      <div>
        <Kaart titel="Huisartsenzorg" icoon="lijst" telling={eigen.length} strak>
          <button className="gesprekknop" data-actief={!bron} onClick={() => setBron(undefined)}>
            <strong style={{ fontSize: 13 }}>Alles bij elkaar</strong>
            <div className="mini">
              {data.aantalContacten} eigen contacten · {data.aantalExtern} van buiten
            </div>
          </button>
          {eigen.map((b) => (
            <button key={b.id} className="gesprekknop" data-actief={bron === b.id}
              onClick={() => setBron(b.id)}>
              <strong style={{ fontSize: 13 }}>{b.titel}</strong>
              <div className="mini">{b.aantal} contact{b.aantal === 1 ? '' : 'en'} · {b.toelichting}</div>
            </button>
          ))}
        </Kaart>

        <Kaart titel="Zorg buiten de praktijk" icoon="gebouw" telling={extern.length} strak>
          {extern.length === 0 && (
            <div className="body">
              <span className="mini">
                Niets binnengekomen van andere zorgverleners.
              </span>
            </div>
          )}
          {extern.map((b) => (
            <div key={b.id} className="bronblok">
              <button className="gesprekknop" data-actief={bron === b.id}
                onClick={() => setBron(bron === b.id ? undefined : b.id)}>
                <strong style={{ fontSize: 13 }}>
                  {b.titel}
                  {b.ongelezen ? <span className="stip" /> : null}
                </strong>
                <div className="mini">{b.aantal} bericht{b.aantal === 1 ? '' : 'en'} · {b.toelichting}</div>
              </button>
              {b.portaal && (
                <a className="portaallink" href={b.portaal.url} target="_blank" rel="noreferrer">
                  <Icoon naam="uitgaand" grootte={12} /> Openen in {b.portaal.naam}
                </a>
              )}
            </div>
          ))}
          <div className="body" style={{ paddingTop: 0 }}>
            <p className="mini" style={{ marginBottom: 0 }}>
              Binnengekomen via BgZ, e-Overdracht of als retourbericht. De portaallink is een
              ingang naar het systeem van de instelling — geen koppeling, wel de plek waar je
              hem verwacht.
            </p>
          </div>
        </Kaart>
      </div>

      <Kaart titel="Tijdlijn" icoon="boek" telling={`${data.tijdlijn.length} items`}>
        {data.tijdlijn.length === 0 && <Leeg tekst="Nog niets vastgelegd voor deze bron." />}
        <div className="journaal">
          {data.tijdlijn.map((item) => item.soort === 'contact' ? (
            <Contactregel key={item.contact.encounterId + item.datum} regel={item.contact}
              open={open === item.contact.encounterId}
              opKlik={() => setOpen(open === item.contact.encounterId ? undefined : item.contact.encounterId)}
              opEpisode={() => setBron(item.contact.episodeId)} />
          ) : (
            <Externregel key={item.document.id} document={item.document}
              open={open === item.document.id} opKlik={() => lees(item.document.id)} />
          ))}
        </div>
      </Kaart>
    </div>
  );
}

/** Eén eigen contact: SOEP, met de rest van de registratie één klik verderop. */
function Contactregel({ regel, open, opKlik, opEpisode }: {
  regel: JournaalRegel; open: boolean; opKlik: () => void; opEpisode: () => void;
}) {
  return (
    <div className="journaalregel" data-open={open}>
      <div>
        <div className="wanneer">{regel.datum}</div>
        <div className="mini">{regel.soort}</div>
      </div>
      <div>
        <button className="regelknop" onClick={opKlik}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="merkje" data-toon="neutraal">{regel.episodeIcpc} {regel.episodeTitel}</span>
            <span className="mini">{regel.auteur} · {regel.auteurRol}</span>
            {regel.bron !== 'zorgverlener' && (
              <span className="merkje" data-toon="aandacht">{regel.bron}</span>
            )}
            <span className="mini" style={{ marginLeft: 'auto' }}>
              {open ? 'minder' : 'het hele consult'}
            </span>
          </div>
        </button>
        <div className="soep">
          {regel.regels.map((r, i) => (
            <div key={i} className="soepregel">
              <span className="soepletter" data-letter={r.letter}>{r.letter}</span>
              <span>{r.tekst}</span>
            </div>
          ))}
        </div>
        {open && (
          <div className="contactdetail">
            <div className="regel">
              <span className="sleutel">Contact-id<div className="mini">verwijzing naar de registratie</div></span>
              <span className="waarde" style={{ fontWeight: 400, fontSize: 12 }}>{regel.encounterId}</span>
            </div>
            <div className="regel">
              <span className="sleutel">Herkomst</span>
              <span className="waarde" style={{ fontWeight: 400, fontSize: 12 }}>
                {regel.bron} · vastgelegd door {regel.auteur}
              </span>
            </div>
            <button className="knop" style={{ marginTop: 8 }} onClick={opEpisode}>
              <Icoon naam="lijst" grootte={13} /> Alleen deze episode tonen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Eén bericht van buiten.
 *
 * Bewust een andere vorm dan een eigen contact: een kop met de bron en de standaard, een
 * samenvatting, en de secties zoals ze binnenkwamen. Het verschil moet je kunnen zien
 * zonder te lezen wie het schreef.
 */
function Externregel({ document, open, opKlik }: {
  document: ExternDocument; open: boolean; opKlik: () => void;
}) {
  const vertraging = Math.round(
    (new Date(document.ontvangenOp).getTime() - new Date(document.datum).getTime()) / 86_400_000);

  return (
    <div className="journaalregel extern" data-open={open}>
      <div>
        <div className="wanneer">{document.datum}</div>
        <div className="mini">{document.bron.soort}</div>
      </div>
      <div>
        <button className="regelknop" onClick={opKlik}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="merkje" data-toon="informatief">
              <Icoon naam="gebouw" grootte={11} /> {document.bron.naam}
            </span>
            <span className="merkje" data-toon="neutraal">{document.uitwisseling}</span>
            {document.opOnzeVerwijzing && (
              <span className="merkje" data-toon="ok">op onze verwijzing</span>
            )}
            {!document.gelezen && <span className="merkje" data-toon="aandacht">nieuw</span>}
            <span className="mini" style={{ marginLeft: 'auto' }}>{open ? 'minder' : 'meer'}</span>
          </div>
          <strong style={{ fontSize: 13, display: 'block', marginTop: 5, textAlign: 'left' }}>
            {document.titel}
          </strong>
        </button>
        <p className="reden" style={{ marginTop: 4 }}>{document.samenvatting}</p>

        {open && (
          <div className="externdetail">
            {document.secties.map((sectie) => (
              <div key={sectie.naam} className="sectie">
                <h4>{sectie.naam}</h4>
                {sectie.regels.map((r) => (
                  <div key={r.label} className="regel">
                    <span className="sleutel">{r.label}</span>
                    <span className="waarde" style={{ fontWeight: 400, textAlign: 'left', maxWidth: 420 }}>
                      {r.waarde}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            <div className="knop-rij" style={{ marginTop: 10 }}>
              {document.bron.portaal && (
                <a className="knop" href={document.bron.portaal.url} target="_blank" rel="noreferrer">
                  <Icoon naam="uitgaand" grootte={13} /> Openen in {document.bron.portaal.naam}
                </a>
              )}
              <span className="mini" style={{ alignSelf: 'center' }}>
                Zorg op {document.datum}, bij ons binnen op {document.ontvangenOp}
                {vertraging > 0 ? ` — ${vertraging} dagen later` : ''}.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MEETSOORTEN = [
  { id: 'lab', label: 'Lab' },
  { id: 'lichamelijk', label: 'Lichamelijk' },
  { id: 'vragenlijst', label: 'Vragenlijsten' },
  { id: 'verrichting', label: 'Verrichtingen' },
] as const;

/**
 * MEETWAARDEN
 *
 * Twee manieren van kijken, want er zijn twee vragen. "Hoe loopt dit?" beantwoord je met
 * een grafiek; "wat stond er in die uitslag van maart?" met een tabel. Eén weergave
 * dwingt je steeds de verkeerde te gebruiken.
 *
 * Het filter op soort is er omdat een dossier van tien jaar al snel dertig reeksen heeft.
 * Lab wil je los kunnen zien van bloeddrukken en vragenlijstscores — die lees je anders
 * en je zoekt ze op een ander moment.
 */
function Metingen({ patientId, gekozen, opKies }: {
  patientId: string; gekozen?: string; opKies: (code: string) => void;
}) {
  const { data, fout, bezig } = useData(() => api.meetreeksen(patientId), [patientId]);
  const [soorten, setSoorten] = useState<string[]>([]);
  const [weergave, setWeergave] = useState<'beloop' | 'tabel' | 'labblad'>('beloop');

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Meetwaarden" />;

  const zichtbaar = soorten.length === 0 ? data : data.filter((m) => soorten.includes(m.soort));
  const actief: Meetreeks | undefined =
    zichtbaar.find((m) => m.code === gekozen)
    ?? zichtbaar.find((m) => m.punten.length > 1) ?? zichtbaar[0];

  return (
    <div className="raster2" style={{ gridTemplateColumns: '300px minmax(0, 1fr)' }}>
      <Kaart titel="Alle meetwaarden" icoon="buisje" telling={`${zichtbaar.length}/${data.length}`} strak>
        <div className="body" style={{ paddingBottom: 8 }}>
          <div className="chips">
            <button className="filterchip" data-actief={soorten.length === 0}
              onClick={() => setSoorten([])}>Alles</button>
            {MEETSOORTEN.map((s) => {
              const aantal = data.filter((m) => m.soort === s.id).length;
              if (aantal === 0) return null;
              return (
                <button key={s.id} className="filterchip" data-actief={soorten.includes(s.id)}
                  onClick={() => setSoorten((h) =>
                    h.includes(s.id) ? h.filter((x) => x !== s.id) : [...h, s.id])}>
                  {s.label} <span className="mini">{aantal}</span>
                </button>
              );
            })}
          </div>
        </div>
        <table>
          <tbody>
            {zichtbaar.map((m) => (
              <tr key={m.code}>
                <td style={{ padding: 0 }}>
                  <button className="gesprekknop" data-actief={actief?.code === m.code}
                    onClick={() => opKies(m.code)}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <strong style={{ fontSize: 13, flex: 1 }}>{m.naam}</strong>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {m.laatste ?? '—'}
                      </span>
                    </div>
                    <div className="mini" style={{ display: 'flex', gap: 7, marginTop: 2 }}>
                      <span>{m.laatsteOp}</span>
                      <span>·</span>
                      <span>{m.punten.length} metingen</span>
                      {m.relevantNu && <span className="merkje" data-toon="informatief">nu relevant</span>}
                    </div>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>

      <div>
        <div className="segment" style={{ marginBottom: 12, maxWidth: 380 }}>
          <button data-actief={weergave === 'beloop'} onClick={() => setWeergave('beloop')}>
            <Icoon naam="grafiek" grootte={13} /> beloop
          </button>
          <button data-actief={weergave === 'tabel'} onClick={() => setWeergave('tabel')}>
            <Icoon naam="tabel" grootte={13} /> deze reeks
          </button>
          <button data-actief={weergave === 'labblad'} onClick={() => setWeergave('labblad')}>
            <Icoon naam="buisje" grootte={13} /> labblad
          </button>
        </div>

        {weergave === 'labblad' && <Labtabel reeksen={data} />}

        {weergave !== 'labblad' && actief && (
          <Kaart titel={actief.naam} icoon={weergave === 'tabel' ? 'tabel' : 'grafiek'}
            telling={actief.eenheid ? actief.eenheid : undefined}>
            {weergave === 'beloop' ? (
              <>
                <Trendgrafiek punten={actief.punten} eenheid={actief.eenheid} streef={actief.streef} />
                {actief.streef && (
                  <div className="mini" style={{ marginTop: 8 }}>
                    Referentie: {actief.streef.label}. De stippellijn in de grafiek.
                  </div>
                )}
                {actief.verschil !== undefined && (
                  <div style={{ marginTop: 10 }}>
                    <span className="merkje"
                      data-toon={Math.abs(actief.verschil) > 0 ? 'informatief' : 'neutraal'}>
                      {actief.verschil > 0 ? '+' : ''}{actief.verschil} ten opzichte van de vorige meting
                    </span>
                  </div>
                )}
              </>
            ) : (
              <table className="waardetabel">
                <thead>
                  <tr><th>Datum</th><th className="rechts">Waarde</th><th className="rechts">Verschil</th></tr>
                </thead>
                <tbody>
                  {[...actief.punten].reverse().map((punt, i, lijst) => {
                    const vorige = lijst[i + 1];
                    const verschil = vorige
                      ? Math.round((punt.waarde - vorige.waarde) * 10) / 10 : undefined;
                    return (
                      <tr key={punt.op}>
                        <td>{punt.op}</td>
                        <td className="rechts getal">{punt.waarde} {actief.eenheid}</td>
                        <td className="rechts getal mini">
                          {verschil === undefined ? '—' : `${verschil > 0 ? '+' : ''}${verschil}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Kaart>
        )}

        {weergave !== 'labblad' && !actief && (
          <Leeg tekst="Geen meetwaarden in deze selectie." />
        )}
      </div>
    </div>
  );
}

/**
 * Het labblad: alle bepalingen naast elkaar, per afnamedatum.
 *
 * Dit is hoe een uitslag binnenkomt en hoe een arts hem leest — per kolom één prik, niet
 * per bepaling een losse grafiek. De laatste twaalf afnamemomenten, want verder terug
 * kijk je zelden en dan is de grafiek beter.
 */
function Labtabel({ reeksen }: { reeksen: Meetreeks[] }) {
  const lab = reeksen.filter((m) => m.soort === 'lab');
  const datums = [...new Set(lab.flatMap((m) => m.punten.map((p) => p.op)))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 12);

  if (lab.length === 0) return <Leeg tekst="Geen labwaarden in dit dossier." />;

  return (
    <Kaart titel="Labblad" icoon="tabel" telling={`${lab.length} bepalingen`}>
      <p className="reden" style={{ marginTop: 0 }}>
        Alle bepalingen per afnamemoment, nieuwste links. Een waarde buiten de referentie
        staat gemarkeerd; de referentie zelf staat achter de naam.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="waardetabel">
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>Bepaling</th>
              {datums.map((d) => (
                <th key={d} className="rechts" title={d}>
                  {`${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(2, 4)}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lab.map((m) => (
              <tr key={m.code}>
                <td>
                  {m.naam}
                  <div className="mini">{m.eenheid}{m.streef ? ` · ${m.streef.label}` : ''}</div>
                </td>
                {datums.map((d) => {
                  const punt = m.punten.find((p) => p.op === d);
                  const buiten = punt && m.streef && (
                    (m.streef.boven !== undefined && punt.waarde > m.streef.boven)
                    || (m.streef.onder !== undefined && punt.waarde < m.streef.onder));
                  return (
                    <td key={d} className="rechts getal" data-buiten={buiten ? 'true' : undefined}>
                      {punt ? punt.waarde : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kaart>
  );
}

/**
 * Vastleggen tijdens het consult.
 *
 * De velden staan niet leeg: het systeem weet welke metingen dit contact vraagt, en wat
 * de wachtkamer-intake heeft opgeleverd staat er al in. Een nieuwe episode openen kan
 * hier ook — je hoeft geen tweede consult te starten omdat de klacht ergens anders bij
 * hoort.
 */
function Registreren({
  patientId, overzicht, registratie, ordersVandaag, opOrder, opWijzig, opKlaar,
}: {
  patientId: string;
  overzicht: PatientOverzicht;
  registratie: Registratie;
  /** Wat er tijdens dit consult al besteld is; komt onder P te staan. */
  ordersVandaag: NieuweOrder[];
  opOrder: () => void;
  opWijzig: (nieuw: Registratie) => void;
  opKlaar: (nieuw: PatientOverzicht, uitkomst: RegistratieUitkomst) => void;
}) {
  const contact = overzicht.zorgplan.contacten[0];
  const [bezig, setBezig] = useState(false);
  const [nieuweEpisode, setNieuweEpisode] = useState(false);
  const [zoek, setZoek] = useState('');
  const [treffers, setTreffers] = useState<Treffer[]>([]);

  if (!contact) return null;

  const alles: GeplandItem[] = contact.metingen;
  const handmatig = alles.filter((m) => m.invoer.soort !== 'vragenlijst');
  const viaVragenlijst = alles.filter((m) => m.invoer.soort === 'vragenlijst');
  const ingevuld = handmatig.filter((m) => (registratie.waarden[m.code] ?? '').trim() !== '');
  const episodeId = registratie.episodeId || overzicht.episodes[0]?.id || '';

  const zet = (deel: Partial<Registratie>) => opWijzig({ ...registratie, ...deel });

  const zoekCode = async (q: string) => {
    setZoek(q);
    if (q.trim().length < 2) { setTreffers([]); return; }
    const uitkomst = await api.zoekTerm(q, false);
    setTreffers(uitkomst.treffers.slice(0, 6));
  };

  const maakEpisode = async (treffer: Treffer) => {
    setBezig(true);
    try {
      const antwoord = await api.maakEpisode(patientId, {
        icpc: treffer.concept.icpc1 ?? '',
        snomed: treffer.concept.snomed,
        display: treffer.concept.display,
      });
      zet({ episodeId: antwoord.episodeId });
      setNieuweEpisode(false);
      setZoek(''); setTreffers([]);
      opKlaar(antwoord.overzicht, {
        vastgelegd: [], verantwoordingGevuld: [],
        vervolg: [`Nieuwe episode geopend: ${treffer.concept.display}. Dit consult valt er nu onder.`],
      });
    } finally { setBezig(false); }
  };

  const afronden = async () => {
    setBezig(true);
    try {
      const metingen = ingevuld.map((m) => {
        const ruw = registratie.waarden[m.code];
        if (m.invoer.soort === 'keuze') {
          const optie = m.invoer.opties.find((o) => o.code === ruw);
          return { code: m.code, keuze: { code: ruw, display: optie?.label } };
        }
        if (m.invoer.soort === 'verrichting') return { code: m.code, waarde: 1 };
        return { code: m.code, waarde: Number(ruw) };
      });
      const antwoord = await api.consult(patientId, {
        metingen, soep: registratie.soep, episodeId: episodeId || undefined,
      });
      opWijzig({ waarden: {}, soep: {}, episodeId: '', suggestieCodes: [] });
      opKlaar(antwoord.overzicht, antwoord.uitkomst);
    } finally { setBezig(false); }
  };

  return (
    <Kaart titel="Vastleggen" icoon="klembord" telling={`${ingevuld.length}/${handmatig.length} ingevuld`}>
      <p className="reden" style={{ marginTop: 0 }}>
        Deze metingen horen bij het contact van vandaag. Je registreert één keer; de
        ketenverantwoording en de planning volgen er automatisch uit.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 11, marginBottom: 14 }}>
        {handmatig.map((m) => (
          <div key={m.code}>
            <label className="veld">
              {m.naam}
              {m.invoer.soort === 'getal' && m.invoer.eenheid && <span className="mini"> ({m.invoer.eenheid})</span>}
              {m.laatsteWaarde !== undefined && (
                <span className="mini"> · was {m.laatsteWaarde} op {m.laatsteOp}</span>
              )}
            </label>

            {m.invoer.soort === 'keuze' && (
              <select value={registratie.waarden[m.code] ?? ''}
                onChange={(e) => zet({ waarden: { ...registratie.waarden, [m.code]: e.target.value } })}>
                <option value="">— kies —</option>
                {m.invoer.opties.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select>
            )}
            {m.invoer.soort === 'verrichting' && (
              <button className="knop" style={{ width: '100%' }}
                data-toon={registratie.waarden[m.code] ? 'primair' : undefined}
                onClick={() => zet({
                  waarden: { ...registratie.waarden, [m.code]: registratie.waarden[m.code] ? '' : 'verricht' },
                })}>
                <Icoon naam="vink" grootte={13} /> {registratie.waarden[m.code] ? 'Verricht' : 'Markeer als verricht'}
              </button>
            )}
            {m.invoer.soort === 'getal' && (
              <input type="number" inputMode="decimal" value={registratie.waarden[m.code] ?? ''}
                placeholder={m.laatsteWaarde !== undefined ? String(m.laatsteWaarde) : '—'}
                onChange={(e) => zet({ waarden: { ...registratie.waarden, [m.code]: e.target.value } })} />
            )}
          </div>
        ))}
      </div>

      {viaVragenlijst.length > 0 && (
        <div className="mini" style={{ marginBottom: 12, display: 'flex', gap: 7, alignItems: 'center' }}>
          <Icoon naam="gesprek" grootte={13} />
          {viaVragenlijst.map((m) => m.naam).join(', ')} komt binnen via de vragenlijst.
        </div>
      )}

      <label className="veld">Episode</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={episodeId} onChange={(e) => zet({ episodeId: e.target.value })}>
          {overzicht.episodes.map((e) => (
            <option key={e.id} value={e.id}>{e.icpc} — {e.titel}</option>
          ))}
        </select>
        <button className="knop" onClick={() => setNieuweEpisode(!nieuweEpisode)}>
          <Icoon naam={nieuweEpisode ? 'kruis' : 'plus'} grootte={13} />
          {nieuweEpisode ? 'Annuleren' : 'Nieuwe episode'}
        </button>
      </div>

      {nieuweEpisode && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <label className="veld">Zoek een diagnose of klacht</label>
          <input type="search" value={zoek} autoFocus
            placeholder="Bijvoorbeeld 'hoesten' of 'R95'"
            onChange={(e) => zoekCode(e.target.value)} />
          {registratie.suggestieCodes.length > 0 && zoek.length < 2 && (
            <div style={{ marginTop: 9 }}>
              <div className="mini" style={{ marginBottom: 5 }}>Suggesties uit de wachtkamer-intake</div>
              <div className="chips">
                {registratie.suggestieCodes.map((c) => (
                  <button key={c.icpc} className="knop" style={{ padding: '3px 10px', fontSize: 12 }}
                    onClick={() => zoekCode(c.display)}>
                    {c.icpc} {c.display}
                  </button>
                ))}
              </div>
            </div>
          )}
          {treffers.length > 0 && (
            <div style={{ marginTop: 9 }}>
              {treffers.map((t) => (
                <button key={t.concept.snomed} className="gesprekknop" disabled={bezig}
                  onClick={() => maakEpisode(t)}>
                  <strong style={{ fontSize: 13 }}>{t.concept.display}</strong>
                  <div className="mini">
                    ICPC {t.concept.icpc1 ?? '—'} · SNOMED {t.concept.snomed}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {([['S', 'Subjectief — wat vertelt de patiënt'], ['O', 'Objectief — wat zie en meet je'],
           ['E', 'Evaluatie — wat is je conclusie'], ['P', 'Plan — wat spreek je af']] as const)
          .map(([letter, uitleg]) => (
          <div key={letter} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span className="soepletter" data-letter={letter} style={{ marginTop: 7 }}>{letter}</span>
            <textarea rows={letter === 'S' && registratie.soep.S ? 4 : 1} placeholder={uitleg}
              value={registratie.soep[letter] ?? ''}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              onChange={(e) => zet({ soep: { ...registratie.soep, [letter]: e.target.value } })} />
          </div>
        ))}
      </div>

      {/*
        Het plan is de plek waar het consult de praktijk verlaat. Vrije tekst blijft,
        want een afspraak met een mens laat zich niet in een keuzelijst persen — maar
        wat een order ís, hoort een order te worden en niet een zin die niemand uitvoert.
      */}
      <div className="planbouw">
        <div className="mini" style={{ marginBottom: 6 }}>Plan aanvullen</div>
        <div className="chips">
          {PLANZINNEN.map((zin) => (
            <button key={zin} className="filterchip"
              onClick={() => zet({
                soep: {
                  ...registratie.soep,
                  P: [registratie.soep.P, zin].filter(Boolean).join('. '),
                },
              })}>
              <Icoon naam="plus" grootte={12} /> {zin}
            </button>
          ))}
          <button className="filterchip" data-nadruk="true" onClick={opOrder}>
            <Icoon naam="uitgaand" grootte={12} /> Order plaatsen
          </button>
        </div>

        {ordersVandaag.length > 0 && (
          <div className="planorders">
            <div className="mini" style={{ marginBottom: 4 }}>
              Deze orders hangen straks aan dit deelcontact
            </div>
            {ordersVandaag.map((o, i) => (
              <div key={i} className="regel">
                <span className="sleutel">
                  {o.omschrijving}
                  <div className="mini">{o.soort}{o.route ? ` · ${o.route}` : ''}</div>
                </span>
                <span className="waarde" style={{ fontWeight: 400, fontSize: 12.5 }}>{o.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {registratie.suggestieCodes.length > 0 && (
        <div style={{ marginTop: 11 }}>
          <div className="mini" style={{ marginBottom: 5 }}>
            Codesuggesties uit de intake — klik om als evaluatie over te nemen
          </div>
          <div className="chips">
            {registratie.suggestieCodes.map((c) => (
              <button key={c.icpc} className="knop" style={{ padding: '3px 10px', fontSize: 12 }}
                onClick={() => zet({
                  soep: {
                    ...registratie.soep,
                    E: [registratie.soep.E, `${c.icpc} ${c.display}`].filter(Boolean).join('; '),
                  },
                })}>
                <Icoon naam="plus" grootte={12} /> {c.icpc} {c.display}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="knop-rij" style={{ marginTop: 14 }}>
        <button className="knop" data-toon="primair" disabled={bezig || ingevuld.length === 0}
          onClick={afronden}>
          <Icoon naam="vink" grootte={13} /> Consult afronden
        </button>
        <span className="mini" style={{ alignSelf: 'center' }}>
          {ingevuld.length === 0 ? 'Vul minstens één meting in.' : 'Declaratie en indicatoren volgen automatisch.'}
        </span>
      </div>
    </Kaart>
  );
}
