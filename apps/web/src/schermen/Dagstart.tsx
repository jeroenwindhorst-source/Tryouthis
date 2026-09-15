import { api } from '../api';
import { useData } from '../gebruik';
import { Fout, Kaart, Laden, ProgrammaLabels, Signalen, Tegel } from '../onderdelen';

/**
 * De dagstart ís het startscherm (docs/05 §1.1).
 * Geen zoekveld, maar: dit is jouw dag, dit moet je doen, dit is al voorbereid.
 */
export function Dagstart({ openPatient }: { openPatient: (id: string) => void }) {
  const { data, fout, bezig } = useData(() => api.dagstart());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Dagstart" />;

  const datum = new Date(data.datum).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
      <div className="tegels">
        <Tegel getal={data.samenvatting.afspraken} label="afspraken vandaag" toon="accent" />
        <Tegel getal={data.samenvatting.vragenAandacht} label="vragen aandacht" />
        <Tegel getal={data.samenvatting.voorbereidingIncompleet} label="voorbereiding niet compleet" />
        {data.werkvoorraad.map((w) => (
          <Tegel key={w.categorie} getal={w.aantal} label={w.categorie.toLowerCase()} />
        ))}
      </div>

      <Kaart titel={`Spreekuur — ${datum}`} telling={`${data.spreekuur.length} afspraken`}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 62 }}>Tijd</th>
              <th>Patiënt</th>
              <th style={{ width: 170 }}>Zorgprogramma</th>
              <th style={{ width: 210 }}>Voorbereiding</th>
              <th>Bijzonderheden</th>
            </tr>
          </thead>
          <tbody>
            {data.spreekuur.map((regel) => (
              <tr key={regel.patientId + regel.tijd}>
                <td className="tijd">{regel.tijd}</td>
                <td className="nadruk">
                  <button className="knop" data-toon="stil" onClick={() => openPatient(regel.patientId)}>
                    {regel.naam}
                  </button>
                  <div className="reden">{regel.leeftijd} jaar · {regel.soort}</div>
                </td>
                <td><ProgrammaLabels programmas={regel.programmas} /></td>
                <td>
                  {regel.voorbereidingCompleet
                    ? <span className="label" data-toon="ok">compleet</span>
                    : <>
                        <span className="label" data-toon="aandacht">ontbreekt</span>
                        <div className="reden">{regel.ontbreekt.join(', ')}</div>
                      </>}
                </td>
                <td><Signalen signalen={regel.signalen} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>

      <Kaart titel="Werkvoorraad">
        <table>
          <tbody>
            {data.werkvoorraad.map((w) => (
              <tr key={w.categorie}>
                <td style={{ width: 60 }} className="nadruk">{w.aantal}</td>
                <td className="nadruk">{w.categorie}
                  <div className="reden">{w.toelichting}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>
    </>
  );
}
