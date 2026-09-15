import { useState, type CSSProperties } from 'react';
import {
  api, MODULE_NAAM,
  type GeplandContact, type GeplandItem, type PatientOverzicht, type RegistratieUitkomst,
} from '../api';
import { useData } from '../gebruik';
import { Icoon, icoonVanModule } from '../iconen';
import {
  ErnstMerk, Fout, IntakeKaart, Kaart, Laden, ModuleIdChips, Signalen, SuggestieKaart,
  Zelfredzaamheidsmeter,
} from '../onderdelen';

const INTENSITEITEN = [
  { id: 'extensief', label: 'rustig', uitleg: 'stabiel, weinig risico, patiënt wil rust' },
  { id: 'basis', label: 'volgens plan', uitleg: 'het protocol als uitgangspunt' },
  { id: 'intensief', label: 'intensief', uitleg: 'ontregeld of hoog risico' },
  { id: 'eigen-regie', label: 'eigen regie', uitleg: 'patiënt monitort zelf, meldt zich bij afwijking' },
  { id: 'palliatief', label: 'palliatief', uitleg: 'streefwaarden vervallen, comfort leidend' },
];

/**
 * Het consultscherm.
 *
 * Bovenaan staat wat het systeem denkt (en waarom), daaronder het plan van deze mens,
 * en daarnaast de knoppen om dat plan op maat te maken. De volgorde is bewust: eerst het
 * oordeel dat jij moet vellen, dan de uitvoering.
 */
export function Consult({ patientId, terug }: { patientId: string; terug: () => void }) {
  const { data, fout, bezig, setData } = useData(() => api.patient(patientId), [patientId]);
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  const [toonNietActief, setToonNietActief] = useState(false);
  const [uitkomst, setUitkomst] = useState<RegistratieUitkomst | undefined>();

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
            : <span className="merkje" data-toon="aandacht">geen portaal</span>}
        </span>
      </div>

      <div className="dossier">
        {/* ── Links: wie is dit ────────────────────────────────────────── */}
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

          <Kaart titel="Oproepen" icoon="gesprek" telling={data.oproepen.length}>
            {data.oproepen.length === 0 && (
              <span className="mini">Geen oproepen — past bij de gekozen aanpak.</span>
            )}
            {data.oproepen.slice(0, 3).map((o, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                <div className="regel">
                  <span className="sleutel">{o.uitnodigenOp}</span>
                  <span className="waarde"><span className="merkje" data-toon="neutraal">{o.kanaal}</span></span>
                </div>
                <div className="mini">{o.toelichting}</div>
              </div>
            ))}
            {data.oproepen.length > 3 && (
              <div className="mini">+ {data.oproepen.length - 3} later dit jaar</div>
            )}
          </Kaart>
        </div>

        {/* ── Midden: beslissen, dan plannen ───────────────────────────── */}
        <div>
          {data.intake && (
            <IntakeKaart intake={data.intake} bezig={bezigMet === 'intake'}
              opBevestig={() => werk('intake', async () => {
                await api.bevestigIntake(data.intake!.id);
                return api.patient(patientId);
              })} />
          )}

          <Kaart titel="Beslissingsondersteuning" icoon="gesprek"
            telling={`${klinisch.length} voor jou`}>
            {klinisch.length === 0 && logistiek.length === 0 && (
              <span className="mini">Geen suggesties. Alles loopt volgens plan.</span>
            )}

            {klinisch.map((s) => (
              <SuggestieKaart key={s.id} suggestie={s} bezig={bezigMet === s.regelId}
                opActie={(actieId) => werk(s.regelId, () => api.suggestie(patientId, s.regelId, actieId))} />
            ))}

            {logistiek.length > 0 && (
              <>
                <div className="automatisch" style={{ marginTop: klinisch.length ? 14 : 0, marginBottom: 10 }}>
                  <h3><Icoon naam="bliksem" /> Dit regelt het systeem zelf</h3>
                  <ul>
                    {logistiek.map((s) => <li key={s.id}>{s.titel} — {s.bevinding}</li>)}
                  </ul>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ok)' }}>
                    Logistiek werk zonder klinische beslissing. Je kunt het terugdraaien, maar je
                    hoeft er niets voor te doen.
                  </div>
                </div>
              </>
            )}
          </Kaart>

          <Registratie patientId={patientId} overzicht={data}
            opKlaar={(nieuw, uit) => { setData(nieuw); setUitkomst(uit); }} />

          {uitkomst && (
            <div className="automatisch">
              <h3><Icoon naam="afvinken" /> Consult vastgelegd</h3>
              <ul>
                {uitkomst.vastgelegd.map((v) => <li key={v.code}>{v.naam}: {v.waarde}</li>)}
              </ul>
              {uitkomst.verantwoordingGevuld.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ok)' }}>
                  Hiermee zijn vanzelf op orde:{' '}
                  {uitkomst.verantwoordingGevuld.map((v) => `${v.indicator} (${v.keten})`).join(', ')}.
                  Je hebt daar niets extra's voor ingevuld.
                </div>
              )}
              {uitkomst.vervolg.length > 0 && (
                <ul style={{ marginTop: 8 }}>
                  {uitkomst.vervolg.map((v, i) => <li key={i}>{v}</li>)}
                </ul>
              )}
            </div>
          )}

          <Kaart titel="Het plan van deze patiënt" icoon="agenda"
            telling={`${plan.contacten.length} contacten`}>
            {plan.contacten.length > 0 && !plan.vergelijking.valtBuitenKeten && (
              <div className="vergelijking">
                <div>
                  <div className="cijfer">{plan.vergelijking.traditioneleContacten}</div>
                  <div className="onder">losse trajecten</div>
                </div>
                <span style={{ color: 'var(--merk-diep)' }}><Icoon naam="pijl" grootte={20} /></span>
                <div>
                  <div className="cijfer">{plan.vergelijking.geintegreerdeContacten}</div>
                  <div className="onder">geïntegreerde contacten</div>
                </div>
                <div className="uitleg">
                  {plan.vergelijking.traditioneleTrajecten.join(', ')} zouden nu losse trajecten zijn.
                  {plan.vergelijking.extraOnderwerpen.length > 0 && (
                    <> Bovendien dekken die trajecten {plan.vergelijking.extraOnderwerpen.join(', ').toLowerCase()} niet.</>
                  )}
                </div>
              </div>
            )}

            {plan.vergelijking.valtBuitenKeten && (
              <div className="notitie" data-toon="waarschuwing">
                <strong>Valt buiten elke landelijke keten.</strong> Deze patiënt heeft wel een
                chronische zorgvraag, maar past in geen enkel programma. In de huidige inrichting
                krijgt hij daar geen gestructureerde begeleiding voor.
              </div>
            )}

            {plan.contacten.length === 0 && (
              <span className="mini">Geen protocollaire contacten gepland.</span>
            )}

            {plan.contacten.map((contact) => <Contact key={contact.id} contact={contact} />)}

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
                    }, 'thuis')}>
                    in de praktijk
                  </button>
                  <button data-actief={data.persoonlijk.voorkeuren.liefstThuismeting === true}
                    disabled={Boolean(bezigMet)}
                    onClick={() => wijzigPlan({
                      voorkeuren: { ...data.persoonlijk.voorkeuren, liefstThuismeting: true },
                    }, 'thuis')}>
                    liefst thuis
                  </button>
                </div>
                <div className="mini" style={{ marginTop: 5 }}>
                  Thuismetingen bepalen dan niet langer hoe vaak iemand moet komen.
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
                    title="Uitzetten vraagt een reden; die wordt vastgelegd."
                    onClick={() => wijzigPlan({
                      moduleKeuzes: [
                        ...data.persoonlijk.moduleKeuzes.filter((k) => k.moduleId !== module.id),
                        { moduleId: module.id, aan: false, reden: 'wordt elders gevolgd', door: 'Sanne Bakker', op: new Date().toISOString().slice(0, 10) },
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
                    <span className="sleutel">
                      {m.naam}
                      <div className="mini">{m.onderbouwing}</div>
                    </span>
                    <span className="waarde">
                      <button className="knop" data-toon="stil" disabled={Boolean(bezigMet)}
                        onClick={() => wijzigPlan({
                          moduleKeuzes: [
                            ...data.persoonlijk.moduleKeuzes.filter((k) => k.moduleId !== m.id),
                            { moduleId: m.id, aan: true, reden: 'op klinische gronden toegevoegd', door: 'Sanne Bakker', op: new Date().toISOString().slice(0, 10) },
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

        {/* ── Rechts: dossierstructuur ─────────────────────────────────── */}
        <div>
          <Kaart titel="Episodes" icoon="lijst" telling={data.episodes.length} strak>
            <table>
              <tbody>
                {data.episodes.map((e) => (
                  <tr key={e.id}>
                    <td style={{ width: 62 }} className="nadruk">{e.icpc}</td>
                    <td>{e.titel}<div className="mini">sinds {e.start}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>

          <Kaart titel="Verantwoording" icoon="tag" telling={plan.ketens.length}>
            <p className="mini" style={{ marginTop: 0 }}>
              Automatisch afgeleid. Je registreert hier niets voor.
            </p>
            {plan.ketens.length === 0 && (
              <span className="mini">Valt onder geen landelijke keten.</span>
            )}
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

          <Kaart titel="Meetwaarden" icoon="buisje" telling={data.metingen.length} strak>
            <table>
              <tbody>
                {data.metingen.filter((m) => m.laatste !== undefined).map((m) => (
                  <tr key={m.code}>
                    <td>{m.naam}<div className="mini">{m.reeks.length} metingen</div></td>
                    <td className="rechts nadruk" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {m.laatste} {m.eenheid}
                      <div className="mini">{m.op}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>
        </div>
      </div>
    </>
  );
}

function Contact({ contact }: { contact: GeplandContact }) {
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
            {m.laatsteWaarde !== undefined ? `laatst ${m.laatsteWaarde} (${m.laatsteOp})` : 'nog niet bepaald'}
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
 * Vastleggen tijdens het consult.
 *
 * De velden zijn niet leeg: het systeem weet welke metingen dit contact vraagt en zet
 * ze klaar. De SOEP-regels blijven staat zoals de sector ze kent (docs/10 §4.3) — daar
 * valt niets aan te verbeteren, alleen aan toe te voegen.
 */
function Registratie({ patientId, overzicht, opKlaar }: {
  patientId: string;
  overzicht: PatientOverzicht;
  opKlaar: (nieuw: PatientOverzicht, uitkomst: RegistratieUitkomst) => void;
}) {
  const contact = overzicht.zorgplan.contacten[0];
  const alles: GeplandItem[] = contact?.metingen ?? [];
  const [waarden, setWaarden] = useState<Record<string, string>>({});
  const [soep, setSoep] = useState<Record<string, string>>({});
  const [episodeId, setEpisodeId] = useState(overzicht.episodes[0]?.id ?? '');
  const [bezig, setBezig] = useState(false);

  if (!contact) return null;

  // Wat via een vragenlijst binnenkomt, vul je niet met de hand in.
  const handmatig = alles.filter((m) => m.invoer.soort !== 'vragenlijst');
  const viaVragenlijst = alles.filter((m) => m.invoer.soort === 'vragenlijst');
  const ingevuld = handmatig.filter((m) => (waarden[m.code] ?? '').trim() !== '');

  const afronden = async () => {
    setBezig(true);
    try {
      const metingen = ingevuld.map((m) => {
        const ruw = waarden[m.code];
        if (m.invoer.soort === 'keuze') {
          const optie = m.invoer.opties.find((o) => o.code === ruw);
          return { code: m.code, keuze: { code: ruw, display: optie?.label } };
        }
        if (m.invoer.soort === 'verrichting') {
          return { code: m.code, waarde: 1 };
        }
        return { code: m.code, waarde: Number(ruw) };
      });
      const antwoord = await api.consult(patientId, { metingen, soep, episodeId: episodeId || undefined });
      setWaarden({});
      setSoep({});
      opKlaar(antwoord.overzicht, antwoord.uitkomst);
    } finally { setBezig(false); }
  };

  return (
    <Kaart titel="Vastleggen" icoon="klembord"
      telling={`${ingevuld.length}/${handmatig.length} ingevuld`}>
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
              {m.laatsteWaarde !== undefined && <span className="mini"> · was {m.laatsteWaarde}</span>}
            </label>

            {m.invoer.soort === 'keuze' && (
              <select value={waarden[m.code] ?? ''}
                onChange={(e) => setWaarden((w) => ({ ...w, [m.code]: e.target.value }))}>
                <option value="">— kies —</option>
                {m.invoer.opties.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select>
            )}

            {m.invoer.soort === 'verrichting' && (
              <button className="knop" style={{ width: '100%' }}
                data-toon={waarden[m.code] ? 'primair' : undefined}
                onClick={() => setWaarden((w) => ({ ...w, [m.code]: w[m.code] ? '' : 'verricht' }))}>
                <Icoon naam="vink" grootte={13} /> {waarden[m.code] ? 'Verricht' : 'Markeer als verricht'}
              </button>
            )}

            {m.invoer.soort === 'getal' && (
              <input type="number" inputMode="decimal" value={waarden[m.code] ?? ''}
                placeholder={m.laatsteWaarde !== undefined ? String(m.laatsteWaarde) : '—'}
                onChange={(e) => setWaarden((w) => ({ ...w, [m.code]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>

      {viaVragenlijst.length > 0 && (
        <div className="mini" style={{ marginBottom: 12, display: 'flex', gap: 7, alignItems: 'center' }}>
          <Icoon naam="gesprek" grootte={13} />
          {viaVragenlijst.map((m) => m.naam).join(', ')} {viaVragenlijst.length === 1 ? 'komt' : 'komen'} binnen
          via de vragenlijst — niet met de hand invullen.
        </div>
      )}

      <label className="veld">Episode</label>
      <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} style={{ marginBottom: 12 }}>
        {overzicht.episodes.map((e) => (
          <option key={e.id} value={e.id}>{e.icpc} — {e.titel}</option>
        ))}
      </select>

      <div style={{ display: 'grid', gap: 8 }}>
        {([['S', 'Subjectief — wat vertelt de patiënt'], ['O', 'Objectief — wat zie en meet je'],
           ['E', 'Evaluatie — wat is je conclusie'], ['P', 'Plan — wat spreek je af']] as const).map(([letter, uitleg]) => (
          <div key={letter} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <span style={{
              width: 24, height: 24, borderRadius: 5, display: 'grid', placeItems: 'center',
              background: 'var(--merk-zacht)', color: 'var(--merk-diep)', fontWeight: 700, fontSize: 12, flex: 'none',
            }}>{letter}</span>
            <input type="text" placeholder={uitleg} value={soep[letter] ?? ''}
              onChange={(e) => setSoep((s) => ({ ...s, [letter]: e.target.value }))} />
          </div>
        ))}
      </div>

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
