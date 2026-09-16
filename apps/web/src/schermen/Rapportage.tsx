import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden } from '../onderdelen';

const ROL_LABEL: Record<string, string> = {
  huisarts: 'Huisarts', 'poh-s': 'POH-Somatiek', assistent: 'Doktersassistent',
};

/**
 * PRAKTIJKRAPPORTAGE
 *
 * De vraag van een praktijkmanager is niet "hoeveel consulten waren er" — dat weet
 * iedereen wel. De vraag is: lopen we ergens geld of kwaliteit mis doordat de registratie
 * niet compleet is, en wáár zit dat dan? Daar wordt nu een datadump voor gemaakt die in
 * Excel wordt uitgeplozen, meestal een keer per kwartaal, meestal te laat.
 *
 * Deze rapportage rekent terug vanuit dezelfde ketenindicatoren die het systeem toch al
 * afleidt voor het zorgproces. Geen tweede registratie en geen tweede telling: één bron,
 * zodat het cijfer van de manager en het scherm van de POH niet uiteen kunnen lopen.
 *
 * En belangrijker: elk knelpunt is een lijst patiënten, geen getal. "23× funduscontrole
 * ontbreekt" is pas bruikbaar als je weet wie dat zijn — dat is het verschil tussen een
 * rapportage en een werklijst.
 */
export function Rapportage() {
  const { data, fout, bezig } = useData(() => api.rapportage());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Rapportage" />;

  const werk = data.werkvoorraad;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Praktijk in cijfers</h1>
          <div className="onder">
            Peildatum {data.datum} · afgeleid uit het zorgproces, niet apart geregistreerd
          </div>
        </div>
      </div>

      <div className="kengetallen">
        <Kengetal label="Ingeschreven" waarde={data.populatie.ingeschreven} />
        <Kengetal label="Met chronische zorgvraag" waarde={data.populatie.metZorgvraag}
          onder={`${Math.round((data.populatie.metZorgvraag / data.populatie.ingeschreven) * 100)}% van de praktijk`} />
        <Kengetal label="Buiten elke keten" waarde={data.populatie.zonderKeten}
          toon="aandacht"
          onder="wel chronische zorg, geen programma en dus geen ketenfinanciering" />
        <Kengetal label="Open autorisaties" waarde={werk.autorisatiesOpen}
          onder={`${werk.autorisatiesRoutine} daarvan routine`} />
        <Kengetal label="Te plannen" waarde={werk.teplannen}
          toon={werk.teplannen > 6 ? 'aandacht' : undefined} />
        <Kengetal label="Op de bespreeklijst" waarde={werk.bespreekpunten} />
      </div>

      <div className="raster2" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <Kaart titel="Ketenzorg — volledigheid van de registratie" icoon="euro"
          telling={`${data.ketens.length} ketens`}>
          <p className="reden" style={{ marginTop: 0 }}>
            Per keten: hoeveel patiënten erin vallen, bij hoeveel de registratie compleet is,
            en waar het misgaat bij de rest. Het knelpunt is de werklijst — daar zit de winst,
            in zorg én in declaratie.
          </p>

          {data.ketens.map((keten) => (
            <div key={keten.naam} className="ketenregel">
              <div className="kop">
                <strong style={{ fontSize: 13.5 }}>{keten.naam}</strong>
                <span className="mini">{keten.prestatiecode}</span>
                <span className="merkje"
                  data-toon={keten.percentage >= 85 ? 'ok' : keten.percentage >= 65 ? 'aandacht' : 'urgent'}
                  style={{ marginLeft: 'auto' }}>
                  {keten.percentage}% compleet
                </span>
              </div>

              <div className="ketenbalk">
                <i style={{ width: `${keten.percentage}%` }}
                  data-toon={keten.percentage >= 85 ? 'ok' : keten.percentage >= 65 ? 'aandacht' : 'urgent'} />
              </div>
              <div className="mini">
                {keten.volledig} van {keten.patienten} patiënten volledig geregistreerd
              </div>

              {keten.knelpunten.length > 0 && (
                <div className="knelpunten">
                  {keten.knelpunten.map((k) => (
                    <span key={k.naam} className="merkje" data-toon="aandacht">
                      {k.aantal}× {k.naam}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="notitie" style={{ marginTop: 12 }}>
            <strong>Wat hier nog niet zit.</strong> Dit is volledigheid van registratie, geen
            declaratiecontrole: er is geen koppeling met de zorggroep of de verzekeraar, en de
            prestatiecodes zijn niet tegen de actuele NZa-beleidsregels gelegd. Doorklikken naar
            de patiënten achter een knelpunt hoort hier te zitten en zit er nog niet in — de
            beheerrol heeft bewust geen dossiertoegang, dus die lijst hoort naar de POH te gaan
            en niet naar dit scherm.
          </div>
        </Kaart>

        <div>
          <Kaart titel="Bezetting vandaag" icoon="agenda">
            {data.bezetting.map((b) => (
              <div key={b.rol} className="bezettingsregel">
                <div className="kop">
                  <strong style={{ fontSize: 13 }}>{ROL_LABEL[b.rol] ?? b.rol}</strong>
                  <span className="mini" style={{ marginLeft: 'auto' }}>
                    {b.afspraken} afspraken · {Math.round(b.geboekteMinuten / 6) / 10} uur
                  </span>
                </div>
                <div className="mini">
                  {b.vrijeSlots} vrije plekken
                  {b.noshow > 0 && ` · ${b.noshow} niet verschenen`}
                </div>
              </div>
            ))}
            <p className="mini" style={{ marginTop: 9 }}>
              Niet-verschenen afspraken zijn hier zichtbaar omdat het een praktijkvraag is en
              geen patiëntvraag: structureel veel no-shows zegt iets over de oproepwijze, niet
              over de mensen.
            </p>
          </Kaart>

          <Kaart titel="Aandachtsgebieden in de praktijk" icoon="doel"
            telling={data.populatie.modules.length}>
            <p className="reden" style={{ marginTop: 0 }}>
              Waar de zorgvraag zit, los van welk programma daaraan hangt.
            </p>
            {data.populatie.modules.map((m) => {
              const breedte = Math.round((m.aantal / (data.populatie.modules[0]?.aantal || 1)) * 100);
              return (
                <div key={m.naam} className="verdeelregel">
                  <span className="naam">{m.naam}</span>
                  <span className="balk"><i style={{ width: `${breedte}%` }} /></span>
                  <span className="getal">{m.aantal}</span>
                </div>
              );
            })}
          </Kaart>

          <Kaart titel="Stromen" icoon="radar">
            <div className="regel">
              <span className="sleutel">Triage open<div className="mini">binnengekomen vandaag</div></span>
              <span className="waarde">{werk.triageOpen}</span>
            </div>
            <div className="regel">
              <span className="sleutel">
                Autorisaties routine
                <div className="mini">binnen protocol, veilig in bulk af te handelen</div>
              </span>
              <span className="waarde">{werk.autorisatiesRoutine}</span>
            </div>
            <div className="regel">
              <span className="sleutel">
                Vraagt een oordeel
                <div className="mini">wat een arts moet zien</div>
              </span>
              <span className="waarde">{werk.autorisatiesOpen - werk.autorisatiesRoutine}</span>
            </div>
          </Kaart>
        </div>
      </div>
    </>
  );
}

function Kengetal({ label, waarde, onder, toon }: {
  label: string; waarde: number; onder?: string; toon?: string;
}) {
  return (
    <div className="kengetal" data-toon={toon}>
      <div className="getal">{waarde}</div>
      <div className="label">{label}</div>
      {onder && <div className="mini">{onder}</div>}
    </div>
  );
}
