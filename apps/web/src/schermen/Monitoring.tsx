import { api } from '../api';
import { useData } from '../gebruik';
import { Fout, Kaart, Laden, ProgrammaLabels, Signalen } from '../onderdelen';

/**
 * Het monitoringcohort (docs/05 §1.2): gesorteerd op afwijking, niet op alfabet,
 * met per patiënt een aantal voorgestelde vervolgacties zodat de POH één klik
 * per patiënt nodig heeft in plaats van een dossier per patiënt.
 */
export function Monitoring({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig } = useData(() => api.monitoring());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Monitoringcohort" />;

  const metSignaal = data.filter((r) => r.signalen.length > 0);
  const zonderSignaal = data.length - metSignaal.length;

  return (
    <>
      <div className="notitie">
        <strong>Dit scherm bestaat niet in de huidige HIS'en.</strong> Monitoring is daar geen
        processtap maar een afgeleide van een consult. Hier is het een eigen werkvoorraad:
        {' '}{metSignaal.length} van de {data.length} gevolgde patiënten vragen nu aandacht,
        {' '}{zonderSignaal} zijn stabiel en hoeven niets.
      </div>

      <Kaart titel="Patiënten die ik op afstand volg" telling={`${metSignaal.length} met signaal`}>
        <table>
          <thead>
            <tr>
              <th>Patiënt</th>
              <th style={{ width: 150 }}>Programma</th>
              <th>Signaal</th>
              <th style={{ width: 320 }}>Voorgestelde vervolgactie</th>
            </tr>
          </thead>
          <tbody>
            {metSignaal.map((regel) => (
              <tr key={regel.patientId}>
                <td className="nadruk">
                  <button className="knop" data-toon="stil" onClick={() => openPatient(regel.patientId)}>
                    {regel.naam}
                  </button>
                  <div className="reden">{regel.leeftijd} jaar</div>
                </td>
                <td><ProgrammaLabels programmas={regel.programmas} /></td>
                <td><Signalen signalen={regel.signalen} /></td>
                <td>
                  <div className="knop-rij">
                    {regel.voorstellen.map((v) => (
                      <button key={v.actie} className="knop"
                        data-toon={v.actie === 'plan-afspraak' ? 'primair' : undefined}>
                        {v.omschrijving}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {metSignaal.length === 0 && (
              <tr><td colSpan={4} className="leeg">Geen signalen — alle gevolgde patiënten zijn stabiel.</td></tr>
            )}
          </tbody>
        </table>
      </Kaart>
    </>
  );
}
