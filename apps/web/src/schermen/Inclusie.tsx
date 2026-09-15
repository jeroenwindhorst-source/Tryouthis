import { useState } from 'react';
import { api } from '../api';
import { useData } from '../gebruik';
import { Fout, Kaart, Laden, Tegel } from '../onderdelen';

/**
 * Casefinding en inclusie (docs/04 §1) — dit vervangt de datadump-naar-Excel-route.
 * Elke kandidaat draagt zijn onderbouwing en de gevolgen van inclusie; afwijzen kan
 * zonder uitleg te moeten geven aan een spreadsheet.
 */
export function Inclusie() {
  const { data, fout, bezig, herlaad } = useData(() => api.kandidaten());
  const praktijk = useData(() => api.praktijk());
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Kandidatenlijst" />;

  const besluit = async (patientId: string, programmaId: string, keuze: 'includeer' | 'wijs-af') => {
    setBezigMet(patientId + programmaId);
    try {
      await api.besluit(patientId, programmaId, keuze);
      herlaad();
      praktijk.herlaad();
    } finally {
      setBezigMet(undefined);
    }
  };

  return (
    <>
      <div className="notitie">
        <strong>Zonder datadump, zonder Excel.</strong> De inclusiecriteria zijn regels over het
        dossier zelf en draaien continu. Wie vandaag aan de criteria gaat voldoen, staat morgen
        in deze lijst — niemand hoeft een uitdraai aan te vragen.
      </div>

      {praktijk.data && (
        <div className="tegels">
          <Tegel getal={praktijk.data.patienten} label="patiënten in de praktijk" />
          <Tegel getal={praktijk.data.metZorgprogramma} label="met chronische zorgvraag" />
          <Tegel getal={praktijk.data.multimorbide} label="met meerdere programma's" toon="accent" />
          <Tegel getal={data.length} label="openstaande inclusievoorstellen" />
          <Tegel getal={`${praktijk.data.bespaardeUrenPerJaar} u`} label="bespaarde consulttijd per jaar" toon="accent" />
        </div>
      )}

      <Kaart titel="Inclusievoorstellen" telling={`${data.length} voorstellen`}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 190 }}>Patiënt</th>
              <th style={{ width: 210 }}>Zorgprogramma</th>
              <th>Waarom komt deze patiënt in beeld</th>
              <th style={{ width: 175 }}>Besluit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((k) => (
              <tr key={k.patientId + k.programmaId}>
                <td className="nadruk">{k.naam}<div className="reden">{k.leeftijd} jaar</div></td>
                <td>
                  <span className="label" data-toon={k.programmaId}>{k.programmaNaam}</span>
                </td>
                <td>
                  {k.onderbouwing}
                  <ul className="uitleg">
                    {k.gevolgen.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </td>
                <td>
                  <div className="knop-rij">
                    <button className="knop" data-toon="primair"
                      disabled={bezigMet === k.patientId + k.programmaId}
                      onClick={() => besluit(k.patientId, k.programmaId, 'includeer')}>
                      Includeren
                    </button>
                    <button className="knop"
                      disabled={bezigMet === k.patientId + k.programmaId}
                      onClick={() => besluit(k.patientId, k.programmaId, 'wijs-af')}>
                      Afwijzen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={4} className="leeg">Geen openstaande voorstellen — de keten is bij.</td></tr>
            )}
          </tbody>
        </table>
      </Kaart>
    </>
  );
}
