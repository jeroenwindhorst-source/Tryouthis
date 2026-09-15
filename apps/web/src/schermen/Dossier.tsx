import { useState } from 'react';
import { api, PROGRAMMA_NAAM, type GeplandContact } from '../api';
import { useData } from '../gebruik';
import { Fout, Kaart, Laden, ProgrammaLabels, Signalen } from '../onderdelen';

const INTENSITEITEN: { id: string; label: string; uitleg: string }[] = [
  { id: 'extensief', label: 'extensief', uitleg: 'stabiel, weinig risico, patiënt wil rust' },
  { id: 'basis', label: 'basis', uitleg: 'protocol volgen' },
  { id: 'intensief', label: 'intensief', uitleg: 'ontregeld of hoog risico' },
  { id: 'eigen-regie', label: 'eigen regie', uitleg: 'patiënt monitort zelf, meldt zich bij afwijking' },
  { id: 'palliatief', label: 'palliatief', uitleg: 'streefwaarden vervallen, comfort leidend' },
];

/**
 * Het dossier in de bekende driedeling context / tijdlijn / structuur (docs/10 §4.1),
 * met als vierde element de protocolkolom: wat er voor déze patiënt in dit contact
 * moet gebeuren, samengevoegd over alle zorgprogramma's heen.
 */
export function Dossier({ patientId, terug }: { patientId: string; terug: () => void }) {
  const { data, fout, bezig, setData } = useData(() => api.patient(patientId), [patientId]);
  const [wisselt, setWisselt] = useState(false);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Dossier" />;

  const plan = data.zorgplan;
  const wijzigIntensiteit = async (intensiteit: string) => {
    setWisselt(true);
    try { setData(await api.intensiteit(patientId, intensiteit)); }
    finally { setWisselt(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button className="knop" onClick={terug}>← Terug</button>
        <strong style={{ fontSize: 15 }}>{data.patient.naam}</strong>
        <span className="reden">
          {data.patient.geboortedatum} ({data.patient.leeftijd} jaar) · BSN {data.patient.bsn}
        </span>
        <ProgrammaLabels programmas={plan.programmas} />
        {data.patient.portaalActief
          ? <span className="label" data-toon="ok">portaal actief</span>
          : <span className="label" data-toon="aandacht">geen portaal</span>}
      </div>

      <div className="dossier">
        {/* ── Kolom 1: context ─────────────────────────────────────────── */}
        <div>
          <Kaart titel="Patiëntgegevens">
            <div className="inhoud">
              <div className="rij"><span className="sleutel">Geboortedatum</span><span className="waarde">{data.patient.geboortedatum}</span></div>
              <div className="rij"><span className="sleutel">Geslacht</span><span className="waarde">{data.patient.geslacht === 'female' ? 'vrouw' : 'man'}</span></div>
              <div className="rij"><span className="sleutel">BSN</span><span className="waarde">{data.patient.bsn}</span></div>
              <div className="rij"><span className="sleutel">Intensiteit</span><span className="waarde">{data.intensiteit}</span></div>
            </div>
          </Kaart>

          <Kaart titel="Signalen">
            <div className="inhoud"><Signalen signalen={data.signalen} /></div>
          </Kaart>

          <Kaart titel="Oproepen" telling={data.oproepen.length}>
            <div className="inhoud">
              {data.oproepen.length === 0 && (
                <div className="reden">Geen oproepen — past bij de gekozen intensiteit.</div>
              )}
              {data.oproepen.slice(0, 3).map((o, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div className="rij">
                    <span className="sleutel">{o.uitnodigenOp}</span>
                    <span className="waarde"><span className="label" data-toon="neutraal">{o.kanaal}</span></span>
                  </div>
                  <div className="reden">{o.toelichting}</div>
                </div>
              ))}
            </div>
          </Kaart>
        </div>

        {/* ── Kolom 2: de protocolkolom — het samengevoegde plan ───────── */}
        <div>
          <Kaart titel="Integraal zorgplan"
            kop={
              <div className="segment" style={{ marginLeft: 12 }}>
                {INTENSITEITEN.map((i) => (
                  <button key={i.id} data-actief={data.intensiteit === i.id} title={i.uitleg}
                    disabled={wisselt} onClick={() => wijzigIntensiteit(i.id)}>
                    {i.label}
                  </button>
                ))}
              </div>
            }>
            <div className="inhoud">
              {plan.contacten.length > 0 ? (
                <div className="vergelijking">
                  <div>
                    <div className="cijfer">{plan.vergelijking.zonderSamenvoeging}</div>
                    <div className="uitleg">losse contacten</div>
                  </div>
                  <div className="pijl">→</div>
                  <div>
                    <div className="cijfer">{plan.vergelijking.metSamenvoeging}</div>
                    <div className="uitleg">geïntegreerde contacten</div>
                  </div>
                  <div className="uitleg" style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    {plan.vergelijking.bespaardeContacten} contacten en{' '}
                    {plan.vergelijking.bespaardeMinuten} minuten minder per jaar,
                    <br />bij dezelfde protocollaire dekking.
                  </div>
                </div>
              ) : (
                <div className="reden" style={{ marginBottom: 10 }}>
                  Geen protocollaire planning voor deze patiënt.
                </div>
              )}

              {plan.contacten.map((contact) => <Contact key={contact.id} contact={contact} />)}

              {plan.toelichting.length > 0 && (
                <>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#5b6b7b', margin: '14px 0 4px' }}>
                    Waarom deze planning
                  </h3>
                  <ul className="uitleg">
                    {plan.toelichting.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </>
              )}
            </div>
          </Kaart>
        </div>

        {/* ── Kolom 3: structuur ───────────────────────────────────────── */}
        <div>
          <Kaart titel="Episodelijst" telling={data.episodes.length}>
            <table>
              <tbody>
                {data.episodes.map((e) => (
                  <tr key={e.id}>
                    <td style={{ width: 62 }} className="nadruk">{e.icpc}</td>
                    <td>{e.titel}<div className="reden">sinds {e.start}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>

          <Kaart titel="Zorgprogramma's">
            <table>
              <tbody>
                {data.inclusie.beoordelingen.map((b) => (
                  <tr key={b.programmaId}>
                    <td>
                      <span className="label" data-toon={b.status === 'geincludeerd' ? 'ok' : 'neutraal'}>
                        {b.status}
                      </span>
                    </td>
                    <td>{b.programmaNaam}<div className="reden">{b.onderbouwing}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kaart>

          <Kaart titel="Meetwaarden" telling={data.metingen.length}>
            <table>
              <tbody>
                {data.metingen.filter((m) => m.laatste !== undefined).map((m) => (
                  <tr key={m.code}>
                    <td>{m.naam}<div className="reden">{m.code}</div></td>
                    <td className="rechts nadruk" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {m.laatste} {m.eenheid}
                      <div className="reden">{m.op}</div>
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
        <span className="label" data-toon={contact.soort === 'jaarcontrole' ? 'informatief' : 'neutraal'}>
          {contact.soort}
        </span>
        <ProgrammaLabels programmas={contact.programmas} />
        <span className="duur">{contact.duurMinuten} min</span>
      </div>

      {contact.metingen.map((m) => (
        <div className="meting" key={m.code}>
          <span className="naam">
            {m.naam}
            {m.programmas.length > 1 && (
              <span className="label" data-toon="ok" style={{ marginLeft: 6 }}>
                telt voor {m.programmas.map((p) => PROGRAMMA_NAAM[p] ?? p).join(' + ')}
              </span>
            )}
            {m.zelfAanleverbaar && (
              <span className="label" data-toon="neutraal" style={{ marginLeft: 4 }}>thuismeting mogelijk</span>
            )}
            {m.labVooraf && (
              <span className="label" data-toon="aandacht" style={{ marginLeft: 4 }}>lab vooraf</span>
            )}
          </span>
          <span className="waarde">
            {m.laatsteWaarde !== undefined ? `laatst ${m.laatsteWaarde} (${m.laatsteOp})` : 'nog niet bepaald'}
          </span>
        </div>
      ))}

      {contact.vragenlijsten.length > 0 && (
        <div className="reden" style={{ marginTop: 6 }}>
          Vooraf uitzetten: {contact.vragenlijsten.join(', ')}
        </div>
      )}
    </div>
  );
}
