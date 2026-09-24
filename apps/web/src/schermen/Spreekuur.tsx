import { useState } from 'react';
import { api, type Voorbereiding } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import {
  Agenda, ErnstMerk, Fout, IntakeKaart, Kaart, Laden, Leeg, ModuleChips, Vragenlijstkaart,
  Zelfredzaamheidsmeter,
} from '../onderdelen';
import { Taakvenster } from './Taakvenster';

/**
 * HET SPREEKUUR — de dag, mét de voorbereiding erin
 *
 * Eerder stonden 'Voorbereiden' en 'Spreekuur' als twee tegels naast elkaar, en dat
 * klopte niet met hoe het werk gaat. Een POH bereidt haar spreekuur niet de avond
 * tevoren in één ruk voor; ze kijkt vlak voordat ze iemand binnenroept wat er over deze
 * mens te weten valt. Dat is één handeling op één moment, en dus één scherm.
 *
 * Bovenaan staat wie er nu aan de beurt is. Daaronder de dag als tijdlijn. Daaronder per
 * patiënt de voorbereiding: wat er binnen is, wat de patiënt zelf heeft ingevuld en waar
 * dit gesprek over zou moeten gaan.
 *
 * Wat hier níét meer staat: 'nog bloed prikken'. Dat hoort weken eerder geregeld te zijn
 * en staat daarom in de Aanloop. Wie vandaag komt, heeft zijn uitslagen.
 */

/**
 * De voorbereiding van één patiënt.
 *
 * Dezelfde kaart voor wie nu aan de beurt is en voor de rest van de dag — alleen de
 * plaats verschilt. Wie nu binnenkomt staat bovenaan opengeklapt; de anderen staan
 * eronder, zodat je vooruit kunt kijken zonder dat het scherm erover gaat.
 */
function Voorbereidingskaart({ v, uitgeklapt, opUitklappen, openPatient }: {
  v: Voorbereiding;
  uitgeklapt: boolean;
  opUitklappen: () => void;
  openPatient: (id: string) => void;
}) {
  return (
    <section className="kaart">
      <header>
        <span className="tijd">{v.tijd}</span>
        <h2 style={{ fontSize: 15 }}>{v.naam}</h2>
        <span className="mini">{v.leeftijd} jaar · {v.soort}</span>
        <span style={{ marginLeft: 'auto' }}>
          {v.compleet
            ? <span className="merkje" data-toon="ok">alles binnen</span>
            : <span className="merkje" data-toon="aandacht">{v.ontbreekt.length} ontbreekt</span>}
        </span>
      </header>

      <div className="body">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <ModuleChips modules={v.modules} />
          {v.zelfredzaamheid && (
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="mini">zelfredzaamheid</span>
              <Zelfredzaamheidsmeter gemiddelde={v.zelfredzaamheid.gemiddelde}
                niveau={v.zelfredzaamheid.niveau} />
            </span>
          )}
        </div>

        {/*
          De vragenlijst staat bovenaan, vóór de meetwaarden. Dat is een keuze: wat de
          patiënt zelf opschreef bepaalt waar het gesprek over gaat, en als het onder de
          uitslagen staat lees je het niet meer.
        */}
        {v.vragenlijst && (
          <Vragenlijstkaart inzage={v.vragenlijst} uitgeklapt={uitgeklapt}
            opUitklappen={opUitklappen} />
        )}

        {v.intake && <IntakeKaart intake={v.intake} />}

        <div className="raster2">
          <div>
            <h3 className="blokkop">Binnen vóór dit consult</h3>
            {v.binnen.length > 0 ? (
              <div style={{ display: 'grid', gap: 3 }}>
                {v.binnen.map((b) => (
                  <div key={b} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ok)' }}><Icoon naam="vink" grootte={13} /></span>{b}
                  </div>
                ))}
              </div>
            ) : (
              // 'Nog niets binnen' naast een groen 'alles binnen' leest als een fout.
              // Bij deze patiënt hoefde er vooraf simpelweg niets geregeld te worden.
              <span className="mini">
                {v.ontbreekt.length === 0
                  ? 'Voor dit consult hoefde er vooraf niets geprikt of ingevuld te worden.'
                  : 'Nog niets binnen.'}
              </span>
            )}

            {v.ontbreekt.length > 0 && (
              <>
                <h3 className="blokkop" style={{ marginTop: 12 }}>Had binnen moeten zijn</h3>
                <div style={{ display: 'grid', gap: 3 }}>
                  {v.ontbreekt.map((o) => (
                    <div key={o} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--aandacht)' }}>
                        <Icoon naam={o.includes('vragenlijst') ? 'gesprek' : 'buisje'} grootte={13} />
                      </span>{o}
                    </div>
                  ))}
                </div>
              </>
            )}

            {v.tijdensConsult.length > 0 && (
              <>
                <h3 className="blokkop" style={{ marginTop: 12 }}>Doe ik zo meteen zelf</h3>
                <div className="chips">
                  {v.tijdensConsult.map((t) => (
                    <span key={t} className="merkje" data-toon="neutraal">{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <h3 className="blokkop">Waar dit gesprek over zou moeten gaan</h3>
            {v.gespreksonderwerpen.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {v.gespreksonderwerpen.map((g) => (
                  <div key={g.titel} style={{ fontSize: 12.5 }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                      <ErnstMerk ernst={g.ernst} />
                      <strong>{g.titel}</strong>
                    </div>
                    <div className="reden">{g.bevinding}</div>
                  </div>
                ))}
              </div>
            ) : <span className="mini">Geen bijzonderheden — routinecontrole.</span>}

            {v.doelen.length > 0 && (
              <div style={{ marginTop: 12, padding: '9px 11px', background: 'var(--merk-zacht)', borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--merk-diep)', fontWeight: 600, fontSize: 12 }}>
                  <Icoon naam="doel" grootte={13} /> Eigen doel van de patiënt
                </div>
                {v.doelen.map((d) => (
                  <div key={d.tekst} style={{ fontSize: 12.5, marginTop: 3, color: 'var(--merk-diep)' }}>“{d.tekst}”</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="knop-rij" style={{ marginTop: 13 }}>
          <button className="knop" data-toon="primair" onClick={() => openPatient(v.patientId)}>
            <Icoon naam="agenda" grootte={13} /> Open consultscherm
          </button>
        </div>
      </div>
    </section>
  );
}

export function Spreekuur({ gebruiker, openPatient }: {
  gebruiker: { id: string };
  openPatient: (id: string) => void;
}) {
  const dag = useData(() => api.dagstart());
  const voor = useData(() => api.voorbereiding());
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({});
  const [taak, setTaak] = useState<string | undefined>();

  if (dag.fout) return <Fout boodschap={dag.fout} />;
  if (voor.fout) return <Fout boodschap={voor.fout} />;
  if (dag.bezig || !dag.data || voor.bezig || !voor.data) return <Laden wat="Spreekuur" />;

  const data = dag.data;
  const voorbereidingen = voor.data;

  // De statussen veranderen tijdens de dag; alleen de agenda bijwerken houdt de rest rustig.
  const zetStatus = async (afspraakId: string, status: string) => {
    const agenda = await api.zetAfspraakstatus(afspraakId, status, 'poh-s');
    dag.setData((huidig) => huidig && { ...huidig, agenda });
  };

  const metPatient = data.agenda.filter((a) => a.patientId);
  const gedaan = metPatient.filter((a) => a.status === 'afgerond').length;
  const wacht = metPatient.filter((a) => a.status === 'wachtkamer' || a.status === 'aangemeld').length;
  const volgende = metPatient.find((a) => a.status === 'wachtkamer')
    ?? metPatient.find((a) => a.status === 'aangemeld')
    ?? metPatient.find((a) => a.status === 'gepland');

  const nu = voorbereidingen.find((v) => v.patientId === volgende?.patientId);
  const rest = voorbereidingen.filter((v) => v !== nu);

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Spreekuur</h1>
          <div className="onder">
            {metPatient.length} patiënten vandaag · {gedaan} geweest · {wacht} binnen
          </div>
        </div>
      </div>

      {voorbereidingen.length === 0 && <Leeg tekst="Geen afspraken vandaag." />}

      {/*
        De patiënt die nu binnenkomt staat compleet bovenaan, opengeklapt. Dat is het
        moment waarop een POH dit scherm opent: niet om de dag te overzien, maar om te
        weten wat er over déze mens te weten valt voordat de deur opengaat.
      */}
      {nu && (
        <>
          <h2 className="sectiekop">
            Nu aan de beurt — {nu.naam}, {nu.tijd}
            {volgende?.aandacht && (
              <span className="merkje" data-toon="aandacht" style={{ marginLeft: 9 }}>
                {volgende.aandacht}
              </span>
            )}
          </h2>
          <Voorbereidingskaart v={nu} openPatient={openPatient}
            uitgeklapt={uitgeklapt[nu.patientId] ?? true}
            opUitklappen={() => setUitgeklapt((u) => ({
              ...u, [nu.patientId]: !(u[nu.patientId] ?? true),
            }))} />
        </>
      )}

      <Kaart titel="Mijn dag" icoon="agenda" telling={`${data.agenda.length} in de agenda`}>
        <Agenda regels={data.agenda} openPatient={openPatient} opStatus={zetStatus}
          opTaak={setTaak} />
      </Kaart>

      {taak && (
        <Taakvenster taakId={taak} gebruiker={gebruiker} openPatient={openPatient}
          opSluit={() => setTaak(undefined)} opGewijzigd={dag.herlaad} />
      )}

      {rest.length > 0 && (
        <>
          <h2 className="sectiekop">De rest van vandaag</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {rest.map((v) => (
              <Voorbereidingskaart key={v.patientId + v.tijd} v={v} openPatient={openPatient}
                uitgeklapt={uitgeklapt[v.patientId] ?? false}
                opUitklappen={() => setUitgeklapt((u) => ({ ...u, [v.patientId]: !u[v.patientId] }))} />
            ))}
          </div>
        </>
      )}
    </>
  );
}