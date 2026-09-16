import { useState } from 'react';
import { api, type Gebruiker, type OrderRegel, type VoorgesteldeOrderSet } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const SOORT_ICOON: Record<string, string> = {
  medicatie: 'pil', lab: 'buisje', verwijzing: 'pijl',
  onderzoek: 'radar', afspraak: 'agenda', begeleiding: 'gesprek',
};

const RECHT_LABEL: Record<string, string> = {
  'medicatie-voorschrijven': 'voorschrijven',
  verwijzen: 'verwijzen',
  'lab-aanvragen': 'lab aanvragen',
  'dossier-registreren': 'registreren',
};

/**
 * Orders: medicatie, lab, verwijzingen en vervolgafspraken.
 *
 * De bouwsteen is de orderset — een samenhangend pakket bij één klinische beslissing.
 * "Starten met metformine" is niet één recept maar een recept, een ophoogschema, controle
 * van de nierfunctie en een HbA1c over drie maanden. Wie dat met de hand bij elkaar moet
 * zoeken, vergeet het derde item.
 *
 * Elke regel is los aan of uit te zetten: het is een voorstel, geen pakket dat je moet
 * slikken. En wat de rol niet zelfstandig mag, wordt geen blokkade maar een
 * autorisatieverzoek met context.
 */
export function Orders({ patientId, gebruiker }: { patientId: string; gebruiker: Gebruiker }) {
  const { data, fout, bezig } = useData(() => api.orders(patientId), [patientId]);
  const [gekozen, setGekozen] = useState<Record<string, boolean>>({});
  const [geplaatst, setGeplaatst] = useState<{ direct: OrderRegel[]; autorisatie: OrderRegel[]; naam: string }[]>([]);

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Orders" />;

  const sleutel = (setId: string, regelId: string) => `${setId}:${regelId}`;
  const staatAan = (set: VoorgesteldeOrderSet, regel: OrderRegel) =>
    gekozen[sleutel(set.set.id, regel.id)] ?? regel.standaardAan;

  const plaats = (voorstel: VoorgesteldeOrderSet) => {
    const aan = voorstel.set.regels.filter((r) => staatAan(voorstel, r));
    setGeplaatst((g) => [{
      naam: voorstel.set.naam,
      direct: aan.filter((r) => gebruiker.rechten.includes(r.vereistRecht)),
      autorisatie: aan.filter((r) => !gebruiker.rechten.includes(r.vereistRecht)),
    }, ...g]);
  };

  return (
    <>
      <div className="notitie">
        <strong>Wat je hier kunt doen.</strong> Het systeem stelt alleen pakketten voor waarvan
        de aanleiding in dit dossier staat — geen catalogus van alles wat theoretisch kan. Zet
        regels aan of uit, pas ze aan, en plaats wat klopt.
        {!gebruiker.rechten.includes('medicatie-voorschrijven') && (
          <> Medicatie mag jij voorstellen, niet voorschrijven: die regels gaan als
          autorisatieverzoek met context naar de huisarts.</>
        )}
      </div>

      {geplaatst.length > 0 && (
        <div className="automatisch">
          <h3><Icoon naam="afvinken" /> Geplaatst</h3>
          {geplaatst.map((g, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong>{g.naam}</strong>
              <ul>
                {g.direct.map((r) => <li key={r.id}>{r.omschrijving} — uitgevoerd</li>)}
                {g.autorisatie.map((r) => (
                  <li key={r.id}>{r.omschrijving} — als voorstel naar de huisarts</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {data.length === 0 && (
        <Leeg tekst="Geen ordervoorstellen. Er is op dit moment niets waarvoor de aanleiding in het dossier staat." />
      )}

      {data.map((voorstel) => {
        const blokkerend = voorstel.waarschuwingen.some((w) => w.ernst === 'blokkerend');
        return (
          <Kaart key={voorstel.set.id} titel={voorstel.set.naam} icoon="pil"
            telling={`${voorstel.set.regels.filter((r) => staatAan(voorstel, r)).length} geselecteerd`}>
            <p className="reden" style={{ marginTop: 0 }}>{voorstel.set.waarvoor}</p>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 11 }}>
              <span className="merkje" data-toon="informatief">waarom nu</span>
              <span style={{ fontSize: 12.5 }}>{voorstel.onderbouwing}</span>
            </div>

            {voorstel.waarschuwingen.map((w, i) => (
              <div key={i} className="waarschuwing" data-ernst={w.ernst}>
                <Icoon naam="waarschuwing" grootte={14} />
                <span>
                  {w.tekst}
                  {w.bron && <div className="mini" style={{ marginTop: 2 }}>{w.bron}</div>}
                </span>
              </div>
            ))}

            <div className="orderset" style={{ border: 0, padding: 0 }}>
              {voorstel.set.regels.map((regel) => {
                const mag = gebruiker.rechten.includes(regel.vereistRecht);
                return (
                  <div key={regel.id} className="orderregel">
                    <input type="checkbox" id={sleutel(voorstel.set.id, regel.id)}
                      checked={staatAan(voorstel, regel)}
                      onChange={(e) => setGekozen((g) => ({
                        ...g, [sleutel(voorstel.set.id, regel.id)]: e.target.checked,
                      }))} />
                    <label htmlFor={sleutel(voorstel.set.id, regel.id)} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--ink-3)' }}>
                          <Icoon naam={SOORT_ICOON[regel.soort] ?? 'doel'} grootte={14} />
                        </span>
                        <strong style={{ fontSize: 13 }}>{regel.omschrijving}</strong>
                        <span className="merkje" data-toon="neutraal">{regel.soort}</span>
                        {!mag && (
                          <span className="merkje" data-toon="aandacht">
                            via huisarts — {RECHT_LABEL[regel.vereistRecht]}
                          </span>
                        )}
                      </span>
                      {regel.detail && <div className="reden" style={{ marginTop: 2 }}>{regel.detail}</div>}
                      {regel.toelichting && (
                        <div className="mini" style={{ marginTop: 2, fontStyle: 'italic' }}>{regel.toelichting}</div>
                      )}
                    </label>
                    <span />
                  </div>
                );
              })}
            </div>

            <div className="knop-rij" style={{ marginTop: 13 }}>
              <button className="knop" data-toon="primair" disabled={blokkerend}
                onClick={() => plaats(voorstel)}>
                <Icoon naam="vink" grootte={13} /> Plaatsen
              </button>
              <button className="knop">Aanpassen</button>
              {blokkerend && (
                <span className="mini" style={{ alignSelf: 'center', color: 'var(--urgent)' }}>
                  Geblokkeerd door een contra-indicatie. Pas de regels aan of overleg met de huisarts.
                </span>
              )}
            </div>

            {voorstel.set.richtlijn && (
              <div className="bron" style={{ marginTop: 10 }}>
                <span>
                  Gebaseerd op{' '}
                  {voorstel.set.richtlijn.url ? (
                    <a className="bronlink" href={voorstel.set.richtlijn.url} target="_blank" rel="noreferrer">
                      {voorstel.set.richtlijn.naam}<Icoon naam="pijl" grootte={11} />
                    </a>
                  ) : voorstel.set.richtlijn.naam}
                  {voorstel.set.richtlijn.paragraaf ? ` — ${voorstel.set.richtlijn.paragraaf}` : ''}
                </span>
              </div>
            )}
          </Kaart>
        );
      })}
    </>
  );
}
