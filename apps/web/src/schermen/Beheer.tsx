import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden } from '../onderdelen';

const LABEL: Record<string, string> = {
  actieveRefsets: 'Actieve referentiesets',
  externZoekenToegestaan: 'Breed zoeken in SNOMED toegestaan',
  eigenSynoniemen: 'Eigen zoektermen',
  favorieteCodes: 'Favoriete codes',
  snomedEditie: 'SNOMED-editie',
  icpcTabelVersie: 'ICPC-tabel',
  actieveModules: 'Actieve aandachtsgebieden',
  intervalFactor: 'Factor op controle-intervallen',
  samenvoegVensterDagen: 'Samenvoegvenster (dagen)',
  klinischeRegelsAan: 'Klinische beslisregels aan',
  logistiekeAutomatiseringAan: 'Logistieke automatisering aan',
  uitgezetteRegels: 'Uitgezette regels',
  apps: 'Ingebedde apps',
};

function toon(waarde: unknown): string {
  if (Array.isArray(waarde)) {
    if (waarde.length === 0) return '—';
    if (typeof waarde[0] === 'string') return waarde.join(', ');
    return `${waarde.length} item${waarde.length === 1 ? '' : 's'}`;
  }
  if (typeof waarde === 'boolean') return waarde ? 'ja' : 'nee';
  return String(waarde);
}

/**
 * Configuratie is geen ingebakken code maar een instelling op vier niveaus.
 *
 * Dat is niet alleen flexibiliteit: het is de bestuurlijke werkelijkheid van de
 * Nederlandse eerste lijn. Zolang terminologie, protocol en integraties door elkaar
 * lopen, is elke wijziging een leverancierswijziging — precies waarom het nu maanden
 * duurt. Per instelling is zichtbaar wie hem heeft gezet en wat daardoor is overruled.
 */
export function Beheer() {
  const { data, fout, bezig } = useData(() => api.beheer());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Configuratie" />;

  const apps = data.instellingen.find((i) => i.sleutel === 'apps')?.waarde as
    | { id: string; naam: string; leverancier: string; plek: string; doel: string; levert: string[];
        herkomst: string; bevestigingVerplicht: boolean; grondslag: string; status: string }[]
    | undefined;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Configuratie</h1>
          <div className="onder">Vier niveaus · het laagste niveau dat iets zegt, wint</div>
        </div>
      </div>

      <div className="notitie">
        <strong>Terminologie, protocol en integraties zijn instellingen, geen code.</strong> Het NHG
        en Nictiz bepalen de terminologie, de zorggroep maakt afspraken over protocol en indicatoren,
        de praktijk kiest haar werkwijze en apps, en jij stelt je eigen scherm in. Zolang die vier
        door elkaar lopen, is elke wijziging een leverancierswijziging.
      </div>

      <Kaart titel="De lagen" icoon="lijst">
        {data.lagen.map((laag) => (
          <div key={laag.niveau} className={`laag niveau-${laag.niveau}`}>
            <div>
              <span className="merkje" data-toon="neutraal">
                <span className="stip" />{laag.niveau}
              </span>
              <div className="nadruk" style={{ fontSize: 13 }}>{laag.naam}</div>
              <div className="mini">{laag.beheerder}</div>
              <div className="mini">gewijzigd {laag.gewijzigdOp}</div>
            </div>
            <div>
              <div className="reden">{laag.uitleg}</div>
              <div className="chips" style={{ marginTop: 7 }}>
                {laag.instellingen.map((sleutel) => (
                  <span key={sleutel} className="merkje" data-toon="neutraal">
                    {LABEL[sleutel] ?? sleutel}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </Kaart>

      <Kaart titel="Wat er nu geldt, en waar het vandaan komt" icoon="doel" strak>
        <table>
          <thead>
            <tr>
              <th style={{ width: 250 }}>Instelling</th>
              <th>Waarde</th>
              <th style={{ width: 210 }}>Gezet op</th>
              <th style={{ width: 190 }}>Overruled</th>
            </tr>
          </thead>
          <tbody>
            {data.instellingen.map((i) => (
              <tr key={i.sleutel}>
                <td className="nadruk">{LABEL[i.sleutel] ?? i.sleutel}</td>
                <td>{toon(i.waarde)}</td>
                <td>
                  <span className={`merkje niveau-${i.niveau}`} data-toon="neutraal">
                    <span className="stip" />{i.niveau}
                  </span>
                  <div className="mini">{i.bron}</div>
                </td>
                <td className="mini">
                  {i.overschreven.length === 0
                    ? '—'
                    : i.overschreven.map((o) => `${o.niveau} (${o.bron})`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>

      {apps && apps.length > 0 && (
        <Kaart titel="Ingebedde apps" icoon="schakelaar" telling={apps.length}>
          <p className="reden" style={{ marginTop: 0 }}>
            Partnerapps draaien in het scherm alsof ze erbij horen, maar wat ze opleveren draagt
            altijd herkomst. Bij een AI-component is bevestiging door een mens verplicht voordat
            het klinisch meetelt.
          </p>
          {apps.map((app) => (
            <div key={app.id} className="modulekaart" style={{ borderLeftColor: 'var(--merk)' }}>
              <div className="kop">
                <span style={{ color: 'var(--merk)' }}><Icoon naam="schakelaar" /></span>
                <h3 style={{ color: 'var(--merk-diep)' }}>{app.naam}</h3>
                <span className="merkje" data-toon="neutraal">{app.plek}</span>
                <span className="merkje" data-toon={app.herkomst === 'ai-suggestie' ? 'aandacht' : 'informatief'}>
                  {app.herkomst}
                </span>
                {app.bevestigingVerplicht && (
                  <span className="merkje" data-toon="aandacht">bevestiging verplicht</span>
                )}
                <span className="mini" style={{ marginLeft: 'auto' }}>{app.leverancier}</span>
              </div>
              <div className="reden">{app.doel}</div>
              <div className="mini" style={{ marginTop: 5 }}>
                Levert: {app.levert.join(', ')} · {app.grondslag}
              </div>
            </div>
          ))}
        </Kaart>
      )}
    </>
  );
}
