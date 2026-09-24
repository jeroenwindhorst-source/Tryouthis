import { useState } from 'react';
import { api, type Suggestie } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import {
  Fout, Kaart, Laden, Leeg, ModuleChips, Signalen, SuggestieKaart, Vragenlijstkaart,
  Zelfredzaamheidsmeter,
} from '../onderdelen';

/**
 * MIJN COHORT — wie ik op afstand volg
 *
 * Dit scherm stond eerst als 'Monitoren' tussen de dagblokken, en dat klopte niet: het
 * beantwoordt de vraag *wie volg ik*, niet *wat moet ik vandaag doen*. Wat vandaag
 * aandacht vraagt, staat in Opvolgen — inclusief de afwijkende beloopen die hier eerder
 * dubbel stonden.
 *
 * Wat hier overblijft is het overzicht, en dat is meer waard dan het lijkt: zestien van
 * de drieëntwintig mensen hebben niets nodig. Dat is geen leegte maar een uitkomst, en
 * het is precies wat een datadump met een Excel eroverheen niet laat zien.
 */
export function Monitoren({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig, herlaad } = useData(() => api.monitoring());
  const [open, setOpen] = useState<string | undefined>();
  const [bezigMet, setBezigMet] = useState<string | undefined>();
  const [lijstUit, setLijstUit] = useState<Record<string, boolean>>({});

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Monitoringcohort" />;

  const metSignaal = data.filter((r) => r.signalen.length > 0);
  const stabiel = data.length - metSignaal.length;

  const handel = async (patientId: string, suggestie: Suggestie, actieId: string) => {
    setBezigMet(patientId + suggestie.regelId);
    try {
      await api.suggestie(patientId, suggestie.regelId, actieId);
      herlaad();
    } finally { setBezigMet(undefined); }
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Mijn cohort</h1>
          <div className="onder">
            {data.length} patiënten op afstand gevolgd · {metSignaal.length} met een signaal ·
            {' '}{stabiel} stabiel
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Dit is een overzicht, geen werklijst.</strong> Iedereen die je op afstand volgt,
        gesorteerd op afwijking in plaats van op alfabet. Wie stabiel is hoeft niets — dat is óók
        een uitkomst, en het scheelt een oproep. Wat vandaag om een besluit vraagt, staat bij
        <strong> Opvolgen</strong>; daar handel je het ook af.
      </div>

      <Kaart titel="Vraagt aandacht" icoon="radar" telling={metSignaal.length} strak>
        {metSignaal.length === 0 && <Leeg tekst="Geen signalen — iedereen die je volgt is stabiel." />}
        <table>
          <tbody>
            {metSignaal.map((regel) => {
              const uit = open === regel.patientId;
              return (
                <tr key={regel.patientId}>
                  <td>
                    {/*
                      Vaste kolommen in plaats van een flexrij die per patiënt anders uitvalt.
                      Je leest deze lijst verticaal — naam onder naam, signaal onder signaal —
                      en dat werkt alleen als elke regel op dezelfde plek begint.
                    */}
                    <div className="monitorregel">
                      <div className="wie">
                        <button className="knop" data-toon="stil" onClick={() => openPatient(regel.patientId)}>
                          <strong>{regel.naam}</strong>
                        </button>
                        <div className="mini">{regel.leeftijd} jaar</div>
                        <div style={{ marginTop: 5 }}><ModuleChips modules={regel.modules} /></div>
                        {regel.zelfredzaamheid && (
                          <div style={{ marginTop: 7 }}>
                            <Zelfredzaamheidsmeter {...regel.zelfredzaamheid} compact />
                            <div className="mini">zelfredzaamheid</div>
                          </div>
                        )}
                      </div>

                      <div className="waarom">
                        <Signalen signalen={regel.signalen} />
                        {/*
                          Eén regel uit de vragenlijst, in de woorden van de patiënt. Bij
                          monitoren op afstand is dat vaak het enige dat er werkelijk toe
                          doet: een HbA1c van 59 verandert niets aan je dag, 'ik haal mijn
                          medicijnen niet meer op' wel.
                        */}
                        {regel.vragenlijst?.kernzin && (
                          <div className="citaatregel">
                            <Icoon naam="gesprek" grootte={12} /> “{regel.vragenlijst.kernzin}”
                          </div>
                        )}
                      </div>

                      {/*
                        De knop zegt met kleur wat er te halen valt: zijn er suggesties, dan
                        vraagt hij erom; zijn er geen, dan blijft hij stil. Anders moet je hem
                        openklappen om te ontdekken dat er niets staat.
                      */}
                      <div className="doen">
                        <button className="knop"
                          data-toon={uit ? undefined : regel.suggesties.length > 0 ? 'aandacht' : 'stil'}
                          onClick={() => setOpen(uit ? undefined : regel.patientId)}>
                          <Icoon naam={uit ? 'kruis' : 'gesprek'} grootte={13} />
                          {uit
                            ? 'Sluiten'
                            : regel.suggesties.length === 0
                              ? 'geen suggesties'
                              : `${regel.suggesties.length} suggestie${regel.suggesties.length === 1 ? '' : 's'}`}
                        </button>
                        <button className="knop" data-toon="stil" onClick={() => openPatient(regel.patientId)}>
                          Dossier <Icoon naam="pijl" grootte={13} />
                        </button>
                      </div>
                    </div>

                    {uit && (
                      <div style={{ marginTop: 12 }}>
                        {regel.vragenlijst && (
                          <Vragenlijstkaart inzage={regel.vragenlijst} uitgeklapt={lijstUit[regel.patientId]}
                            opUitklappen={() => setLijstUit((u) => ({
                              ...u, [regel.patientId]: !u[regel.patientId],
                            }))} />
                        )}
                        {regel.suggesties.length === 0
                          ? <span className="mini">Geen suggesties — beoordelen op eigen inzicht.</span>
                          : regel.suggesties.map((s) => (
                            <SuggestieKaart key={s.id} suggestie={s}
                              bezig={bezigMet === regel.patientId + s.regelId}
                              opActie={(actieId) => handel(regel.patientId, s, actieId)} />
                          ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Kaart>

      {stabiel > 0 && (
        <Kaart titel="Stabiel — geen actie nodig" icoon="vink" telling={stabiel}>
          <div className="chips">
            {data.filter((r) => r.signalen.length === 0).map((r) => (
              <button key={r.patientId} className="knop" data-toon="stil"
                onClick={() => openPatient(r.patientId)}>{r.naam}</button>
            ))}
          </div>
        </Kaart>
      )}
    </>
  );
}
