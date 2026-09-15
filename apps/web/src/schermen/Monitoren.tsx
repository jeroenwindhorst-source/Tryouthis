import { useState } from 'react';
import { api, type Suggestie } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import {
  Fout, Kaart, Laden, Leeg, ModuleChips, Signalen, SuggestieKaart, Zelfredzaamheidsmeter,
} from '../onderdelen';

/**
 * Monitoring als eigen processtap (docs/12 §2.4) — de stap die in geen enkel bestaand
 * HIS bestaat. Gesorteerd op afwijking, niet op alfabet, en met de suggestie er direct
 * naast zodat je per patiënt één klik nodig hebt in plaats van een dossier.
 */
export function Monitoren({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig, herlaad } = useData(() => api.monitoring());
  const [open, setOpen] = useState<string | undefined>();
  const [bezigMet, setBezigMet] = useState<string | undefined>();

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
          <h1>Monitoren</h1>
          <div className="onder">
            {data.length} patiënten op afstand gevolgd · {metSignaal.length} met een signaal ·
            {' '}{stabiel} stabiel
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Wat je hier kunt doen.</strong> Alleen wie afwijkt staat bovenaan, met de trend en
        een voorgestelde vervolgactie. Wie stabiel is hoeft niets — dat is óók een uitkomst, en het
        scheelt een oproep. Klap een regel uit om de onderbouwing te zien en direct te handelen.
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
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 190 }}>
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

                      <div style={{ flex: 1, minWidth: 220 }}>
                        <Signalen signalen={regel.signalen} />
                      </div>

                      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                        <button className="knop" onClick={() => setOpen(uit ? undefined : regel.patientId)}>
                          <Icoon naam={uit ? 'kruis' : 'gesprek'} grootte={13} />
                          {uit ? 'Sluiten' : `${regel.suggesties.length} suggestie${regel.suggesties.length === 1 ? '' : 's'}`}
                        </button>
                        <button className="knop" data-toon="stil" onClick={() => openPatient(regel.patientId)}>
                          Dossier <Icoon naam="pijl" grootte={13} />
                        </button>
                      </div>
                    </div>

                    {uit && (
                      <div style={{ marginTop: 12 }}>
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
