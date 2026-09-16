import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden } from '../onderdelen';

const RECHT_LABEL: Record<string, string> = {
  'dossier-lezen': 'Dossier lezen',
  'dossier-registreren': 'Registreren',
  'medicatie-voorschrijven': 'Medicatie voorschrijven',
  'medicatie-voorstellen': 'Medicatie voorstellen',
  verwijzen: 'Verwijzen',
  'lab-aanvragen': 'Lab aanvragen',
  autoriseren: 'Autoriseren',
  triage: 'Triage',
  monitoring: 'Monitoring',
  'instroom-beheren': 'Instroom',
  'protocol-inzien': 'Protocol inzien',
  'configuratie-praktijk': 'Praktijkconfiguratie',
  'configuratie-persoonlijk': 'Eigen voorkeuren',
  'gebruikers-beheren': 'Gebruikersbeheer',
  berichten: 'Berichten',
};

/**
 * Gebruikersbeheer — alleen voor de beheerder.
 *
 * Let op het rechtenmodel: de POH mag medicatie *voorstellen*, niet voorschrijven. Dat
 * is geen beperking maar de reden dat het autorisatieproces bestaat: een voorstel gaat
 * met context naar de huisarts in plaats van dat de POH vastloopt.
 *
 * De beheerder heeft bewust géén dossiertoegang. Beheer en zorginhoud zijn gescheiden;
 * dat is een eis uit NEN 7510 en tegelijk gewoon verstandig.
 */
export function Gebruikers() {
  const { data, fout, bezig } = useData(() => api.gebruikers());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Gebruikers" />;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Gebruikers</h1>
          <div className="onder">{data.length} accounts · Huisartsenpraktijk De Linde</div>
        </div>
        <div className="acties">
          <button className="knop" data-toon="primair">
            <Icoon naam="plus" grootte={13} /> Gebruiker toevoegen
          </button>
        </div>
      </div>

      <div className="notitie" data-toon="waarschuwing">
        <strong>Demo-accounts.</strong> Wachtwoorden staan in de broncode en de tweefactorcode
        is vast. In productie loopt aanmelden via UZI-pas of een gecertificeerde identity
        provider met MFA, en bestaat het veld wachtwoord hier niet.
      </div>

      <Kaart titel="Accounts" icoon="persoon" strak>
        <table>
          <thead>
            <tr>
              <th style={{ width: 210 }}>Naam</th>
              <th style={{ width: 130 }}>Rol</th>
              <th style={{ width: 130 }}>Identificatie</th>
              <th>Rechten</th>
              <th style={{ width: 150 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((g) => (
              <tr key={g.id}>
                <td className="nadruk">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
                      background: 'var(--merk-zacht)', color: 'var(--merk-diep)', fontWeight: 700, fontSize: 11,
                    }}>{g.initialen}</span>
                    <span>
                      {g.naam}
                      <div className="mini" style={{ fontWeight: 400 }}>{g.gebruikersnaam}</div>
                    </span>
                  </span>
                </td>
                <td>{g.functie}</td>
                <td className="mini">{g.identificatie}</td>
                <td>
                  <div className="chips">
                    {g.rechten.map((r) => (
                      <span key={r} className="merkje" data-toon="neutraal">{RECHT_LABEL[r] ?? r}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className="merkje" data-toon={g.actief ? 'ok' : 'neutraal'}>
                    {g.actief ? 'actief' : 'inactief'}
                  </span>
                  {g.tweefactorActief && (
                    <span className="merkje" data-toon="informatief" style={{ marginLeft: 4 }}>2FA</span>
                  )}
                  {g.laatsteAanmelding && (
                    <div className="mini" style={{ marginTop: 4 }}>
                      laatst {new Date(g.laatsteAanmelding).toLocaleString('nl-NL', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>
    </>
  );
}
