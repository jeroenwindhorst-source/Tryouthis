import { useState } from 'react';
import { api, type Mediabestand } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const SOORT_ICOON: Record<string, string> = {
  pdf: 'document', foto: 'radar', strook: 'grafiek', scan: 'gebouw', geluid: 'microfoon',
};

const BRON_TOON: Record<string, string> = {
  ziekenhuis: 'informatief', patient: 'aandacht', praktijk: 'neutraal',
  paramedisch: 'informatief', lab: 'neutraal', thuiszorg: 'informatief',
};

/**
 * MEDIA
 *
 * De gestructureerde secties van een BgZ zijn altijd beperkter dan de brief zelf, en een
 * foto van een wond zegt in één blik meer dan drie regels tekst. In de meeste systemen
 * staat dat in een aparte documentenmap buiten het journaal om — en dan staat de uitslag
 * in de tijdlijn en de bijbehorende PDF ergens anders.
 *
 * Hier hangt elk bestand aan zijn aanleiding, zodat het van twee kanten te vinden is: via
 * dit tabblad, en via het contact of bericht waar het bij hoort.
 */
export function Media({ patientId, patientNaam, opTijdlijn }: {
  patientId: string;
  patientNaam: string;
  opTijdlijn?: (bronId: string) => void;
}) {
  const [soorten, setSoorten] = useState<string[]>([]);
  const [bronnen, setBronnen] = useState<string[]>([]);
  const [jaar, setJaar] = useState('');
  const [vraag, setVraag] = useState('');
  const [open, setOpen] = useState<string | undefined>();

  const { data, fout, bezig, setData } = useData(
    () => api.media(patientId, { soorten, bronnen, jaar: jaar || undefined, vraag }),
    [patientId, soorten.join(','), bronnen.join(','), jaar, vraag],
  );

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Media" />;

  const wissel = (lijst: string[], zetter: (l: string[]) => void, waarde: string) =>
    zetter(lijst.includes(waarde) ? lijst.filter((x) => x !== waarde) : [...lijst, waarde]);

  const lees = async (bestand: Mediabestand) => {
    setOpen(open === bestand.id ? undefined : bestand.id);
    if (!bestand.gelezen) setData(await api.markeerMediaGelezen(patientId, bestand.id));
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Media</h1>
          <div className="onder">
            {patientNaam} · {data.totaal} bestanden
            {data.ongelezen > 0 && ` · ${data.ongelezen} nog niet bekeken`}
          </div>
        </div>
      </div>

      <Kaart titel="Filter" icoon="filter" telling={`${data.bestanden.length} van ${data.totaal}`}>
        <div className="zoekdoos" style={{ marginBottom: 10, maxWidth: 420 }}>
          <span className="icoon"><Icoon naam="vergrootglas" grootte={15} /></span>
          <input type="search" value={vraag} placeholder="Zoek in titel, categorie of omschrijving"
            onChange={(e) => setVraag(e.target.value)} />
        </div>

        <label className="veld">Soort</label>
        <div className="chips" style={{ marginBottom: 10 }}>
          <button className="filterchip" data-actief={soorten.length === 0}
            onClick={() => setSoorten([])}>Alles</button>
          {data.soorten.map((s) => (
            <button key={s.soort} className="filterchip" data-actief={soorten.includes(s.soort)}
              onClick={() => wissel(soorten, setSoorten, s.soort)}>
              <Icoon naam={SOORT_ICOON[s.soort] ?? 'document'} grootte={12} /> {s.label}
              <span className="mini">{s.aantal}</span>
            </button>
          ))}
        </div>

        <label className="veld">Afkomstig van</label>
        <div className="chips" style={{ marginBottom: 10 }}>
          <button className="filterchip" data-actief={bronnen.length === 0}
            onClick={() => setBronnen([])}>Alles</button>
          {data.bronnen.map((b) => (
            <button key={b.bron} className="filterchip" data-actief={bronnen.includes(b.bron)}
              onClick={() => wissel(bronnen, setBronnen, b.bron)}>
              {b.label} <span className="mini">{b.aantal}</span>
            </button>
          ))}
        </div>

        {data.jaren.length > 1 && (
          <>
            <label className="veld">Jaar</label>
            <div className="chips">
              <button className="filterchip" data-actief={jaar === ''}
                onClick={() => setJaar('')}>Alle jaren</button>
              {data.jaren.map((j) => (
                <button key={j} className="filterchip" data-actief={jaar === j}
                  onClick={() => setJaar(j)}>{j}</button>
              ))}
            </div>
          </>
        )}
      </Kaart>

      {data.bestanden.length === 0 && (
        <Leeg tekst={data.totaal === 0
          ? 'Geen documenten of foto’s bij deze patiënt.'
          : 'Niets binnen dit filter.'} />
      )}

      <div className="mediaraster">
        {data.bestanden.map((bestand) => (
          <div key={bestand.id} className="mediakaart" data-open={open === bestand.id}>
            <button className="voorkant" onClick={() => lees(bestand)}>
              <span className="miniatuur" data-soort={bestand.soort}>
                <Icoon naam={SOORT_ICOON[bestand.soort] ?? 'document'} grootte={26} />
              </span>
              <span className="tekst">
                <strong>{bestand.titel}</strong>
                <span className="merkjes">
                  <span className="merkje" data-toon={BRON_TOON[bestand.bron] ?? 'neutraal'}>
                    {bestand.bron}
                  </span>
                  <span className="merkje" data-toon="neutraal">{bestand.categorie}</span>
                  {!bestand.gelezen && <span className="merkje" data-toon="aandacht">nieuw</span>}
                </span>
                <span className="mini">
                  {bestand.datum} · {bestand.bestandsnaam} · {Math.round(bestand.groottekB)} kB
                </span>
              </span>
            </button>

            {open === bestand.id && (
              <div className="achterkant">
                <p className="reden">{bestand.omschrijving}</p>

                <div className="voorbeeld">
                  <Icoon naam={SOORT_ICOON[bestand.soort] ?? 'document'} grootte={32} />
                  <div className="mini">
                    De demo bevat geen echte bestanden. Wat hier staat is de metadata en de
                    koppeling — het deel dat een dossier moet regelen. De opslag zelf hoort in
                    een documentvoorziening met eigen versiebeheer en logging.
                  </div>
                </div>

                <div className="regel">
                  <span className="sleutel">Ontvangen</span>
                  <span className="waarde" style={{ fontWeight: 400 }}>{bestand.ontvangenOp}</span>
                </div>
                {bestand.gekoppeldAan && (
                  <div className="regel">
                    <span className="sleutel">
                      Hoort bij
                      <div className="mini">{bestand.gekoppeldAan.omschrijving}</div>
                    </span>
                    <span className="waarde">
                      {opTijdlijn && bestand.gekoppeldAan.bronId && (
                        <button className="knop" data-toon="stil"
                          onClick={() => opTijdlijn(bestand.gekoppeldAan!.bronId!)}>
                          <Icoon naam="boek" grootte={12} /> In de tijdlijn
                        </button>
                      )}
                    </span>
                  </div>
                )}

                <div className="knop-rij" style={{ marginTop: 10 }}>
                  <button className="knop">
                    <Icoon naam="uitgaand" grootte={13} /> Openen
                  </button>
                  <button className="knop" data-toon="stil">
                    <Icoon naam="document" grootte={13} /> Bij een contact voegen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
