import { useState, type CSSProperties } from 'react';
import {
  api, MODULE_NAAM,
  type GeplandContact, type GeplandItem, type Gebruiker, type Meetreeks,
  type PatientOverzicht, type RegistratieUitkomst, type Treffer,
} from '../api';
import { useData } from '../gebruik';
import { Trendgrafiek } from '../grafiek';
import { Icoon, icoonVanModule } from '../iconen';
import {
  ErnstMerk, Fout, IntakeKaart, Kaart, Laden, Leeg, ModuleIdChips, Signalen, SuggestieKaart,
  Zelfredzaamheidsmeter,
} from '../onderdelen';
import { Orders } from './Orders';

const INTENSITEITEN = [
  { id: 'extensief', label: 'rustig', uitleg: 'stabiel, weinig risico, patiënt wil rust' },
  { id: 'basis', label: 'volgens plan', uitleg: 'het protocol als uitgangspunt' },
  { id: 'intensief', label: 'intensief', uitleg: 'ontregeld of hoog risico' },
  { id: 'eigen-regie', label: 'eigen regie', uitleg: 'patiënt monitort zelf, meldt zich bij afwijking' },
  { id: 'palliatief', label: 'palliatief', uitleg: 'streefwaarden vervallen, comfort leidend' },
];

type Tab = 'consult' | 'journaal' | 'metingen' | 'orders';

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
        <button className="knop" onClick={terug}><Icoon naam="pijl" grootte={13} /> Terug</button>
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
        <Orders patientId={patientId} gebruiker={gebruiker} />
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
              <button className="knop" style={{ marginTop: 10 }} onClick={() => setTab('orders')}>
                <Icoon naam="plus" grootte={13} /> Medicatie of verwijzing
              </button>
            </Kaart>

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

            <Registreren patientId={patientId} overzicht={data} registratie={registratie}
              opWijzig={setRegistratie}
              opKlaar={(nieuw, uit) => { setData(nieuw); setUitkomst(uit); }} />

            {uitkomst && (
              <div className="automatisch">
                <h3><Icoon naam="afvinken" /> Consult vastgelegd</h3>
                <ul>{uitkomst.vastgelegd.map((v) => <li key={v.code}>{v.naam}: {v.waarde}</li>)}</ul>
                {uitkomst.verantwoordingGevuld.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ok)' }}>
                    Hiermee zijn vanzelf op orde:{' '}
                    {uitkomst.verantwoordingGevuld.map((v) => `${v.indicator} (${v.keten})`).join(', ')}.
                  </div>
                )}
                {uitkomst.vervolg.length > 0 && (
                  <ul style={{ marginTop: 8 }}>{uitkomst.vervolg.map((v, i) => <li key={i}>{v}</li>)}</ul>
                )}
              </div>
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

/** Het journaal: alle eerdere contacten, filterbaar op episode. */
function Journaal({ patientId }: { patientId: string }) {
  const [episode, setEpisode] = useState<string | undefined>();
  const { data, fout, bezig } = useData(() => api.historie(patientId, episode), [patientId, episode]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Journaal" />;

  return (
    <div className="raster2" style={{ gridTemplateColumns: '260px minmax(0, 1fr)' }}>
      <Kaart titel="Episodes" icoon="lijst" telling={data.episodes.length} strak>
        <button className="gesprekknop" data-actief={!episode} onClick={() => setEpisode(undefined)}>
          <strong style={{ fontSize: 13 }}>Alle episodes</strong>
          <div className="mini">{data.aantalContacten} contacten</div>
        </button>
        {data.episodes.map((e) => (
          <button key={e.id} className="gesprekknop" data-actief={episode === e.id}
            onClick={() => setEpisode(e.id)}>
            <strong style={{ fontSize: 13 }}>{e.icpc} {e.titel}</strong>
            <div className="mini">
              {e.aantalContacten} contact{e.aantalContacten === 1 ? '' : 'en'} · sinds {e.start}
            </div>
          </button>
        ))}
      </Kaart>

      <Kaart titel="Journaal" icoon="boek" telling={`${data.journaal.length} contacten`}>
        {data.journaal.length === 0 && <Leeg tekst="Nog geen contacten vastgelegd." />}
        <div className="journaal">
          {data.journaal.map((regel) => (
            <div key={regel.encounterId} className="journaalregel">
              <div>
                <div className="wanneer">{regel.datum}</div>
                <div className="mini">{regel.soort}</div>
              </div>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="merkje" data-toon="neutraal">{regel.episodeIcpc} {regel.episodeTitel}</span>
                  <span className="mini">{regel.auteur} · {regel.auteurRol}</span>
                  {regel.bron !== 'zorgverlener' && (
                    <span className="merkje" data-toon="aandacht">{regel.bron}</span>
                  )}
                </div>
                <div className="soep">
                  {regel.regels.map((r, i) => (
                    <div key={i} className="soepregel">
                      <span className="soepletter" data-letter={r.letter}>{r.letter}</span>
                      <span>{r.tekst}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Kaart>
    </div>
  );
}

/** Meetwaarden met het beloop erbij — een kolom getallen leest niemand. */
function Metingen({ patientId, gekozen, opKies }: {
  patientId: string; gekozen?: string; opKies: (code: string) => void;
}) {
  const { data, fout, bezig } = useData(() => api.meetreeksen(patientId), [patientId]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Meetwaarden" />;

  const actief: Meetreeks | undefined =
    data.find((m) => m.code === gekozen) ?? data.find((m) => m.punten.length > 1) ?? data[0];

  return (
    <div className="raster2" style={{ gridTemplateColumns: '300px minmax(0, 1fr)' }}>
      <Kaart titel="Alle meetwaarden" icoon="buisje" telling={data.length} strak>
        <table>
          <tbody>
            {data.map((m) => (
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

      {actief && (
        <Kaart titel={actief.naam} icoon="doel"
          telling={actief.eenheid ? actief.eenheid : undefined}>
          <Trendgrafiek punten={actief.punten} eenheid={actief.eenheid} streef={actief.streef} />
          {actief.streef && (
            <div className="mini" style={{ marginTop: 8 }}>
              Referentie: {actief.streef.label}. De stippellijn in de grafiek.
            </div>
          )}
          {actief.verschil !== undefined && (
            <div style={{ marginTop: 10 }}>
              <span className="merkje" data-toon={Math.abs(actief.verschil) > 0 ? 'informatief' : 'neutraal'}>
                {actief.verschil > 0 ? '+' : ''}{actief.verschil} ten opzichte van de vorige meting
              </span>
            </div>
          )}
        </Kaart>
      )}
    </div>
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
function Registreren({ patientId, overzicht, registratie, opWijzig, opKlaar }: {
  patientId: string;
  overzicht: PatientOverzicht;
  registratie: Registratie;
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
