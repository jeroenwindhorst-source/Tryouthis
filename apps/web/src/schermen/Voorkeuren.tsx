import type { Gebruiker } from '../api';
import { Icoon } from '../iconen';
import { Kaart } from '../onderdelen';

export interface Persoonlijk {
  dichtheid: 'compact' | 'ruim';
  startscherm: string;
  toonUitleg: boolean;
}

export const STANDAARD_VOORKEUREN: Persoonlijk = {
  dichtheid: 'compact', startscherm: 'dagstart', toonUitleg: true,
};

/**
 * Persoonlijke voorkeuren — wat élke gebruiker over zichzelf mag instellen.
 *
 * Bewust klein gehouden. Wat de zorg raakt (protocol, terminologie, beslisregels) hoort
 * op praktijk- of zorggroepniveau, niet bij de individuele gebruiker: anders werkt elke
 * zorgverlener in een net iets ander systeem en is niets meer vergelijkbaar (docs/14).
 */
export function Voorkeuren({ gebruiker, voorkeuren, opWijzig }: {
  gebruiker: Gebruiker;
  voorkeuren: Persoonlijk;
  opWijzig: (nieuw: Persoonlijk) => void;
}) {
  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Mijn voorkeuren</h1>
          <div className="onder">{gebruiker.naam} · {gebruiker.functie}</div>
        </div>
      </div>

      <div className="notitie">
        <strong>Dit geldt alleen voor jou.</strong> Instellingen die de zorg raken — welke
        aandachtsgebieden meedoen, welke terminologie geldt, welke beslisregels aan staan —
        worden op praktijk- of zorggroepniveau gezet. Anders werkt iedereen in een net iets
        ander systeem en is niets meer vergelijkbaar.
      </div>

      <div className="raster2">
        <Kaart titel="Weergave" icoon="schakelaar">
          <label className="veld">Informatiedichtheid</label>
          <div className="segment" style={{ marginBottom: 16 }}>
            <button data-actief={voorkeuren.dichtheid === 'compact'}
              onClick={() => opWijzig({ ...voorkeuren, dichtheid: 'compact' })}>
              compact
            </button>
            <button data-actief={voorkeuren.dichtheid === 'ruim'}
              onClick={() => opWijzig({ ...voorkeuren, dichtheid: 'ruim' })}>
              ruim
            </button>
          </div>

          <label className="veld">Uitlegblokken tonen</label>
          <div className="segment">
            <button data-actief={voorkeuren.toonUitleg}
              onClick={() => opWijzig({ ...voorkeuren, toonUitleg: true })}>
              aan
            </button>
            <button data-actief={!voorkeuren.toonUitleg}
              onClick={() => opWijzig({ ...voorkeuren, toonUitleg: false })}>
              uit
            </button>
          </div>
          <div className="mini" style={{ marginTop: 6 }}>
            De blauwe blokken met uitleg boven elk scherm. Handig bij het inwerken,
            overbodig zodra je het systeem kent.
          </div>
        </Kaart>

        <Kaart titel="Mijn account" icoon="persoon">
          <div className="regel">
            <span className="sleutel">Naam</span><span className="waarde">{gebruiker.naam}</span>
          </div>
          <div className="regel">
            <span className="sleutel">Functie</span><span className="waarde">{gebruiker.functie}</span>
          </div>
          <div className="regel">
            <span className="sleutel">Identificatie</span><span className="waarde">{gebruiker.identificatie}</span>
          </div>
          <div className="regel">
            <span className="sleutel">Tweefactor</span>
            <span className="waarde">
              <span className="merkje" data-toon={gebruiker.tweefactorActief ? 'ok' : 'aandacht'}>
                {gebruiker.tweefactorActief ? 'actief' : 'niet actief'}
              </span>
            </span>
          </div>
          <div className="knop-rij" style={{ marginTop: 14 }}>
            <button className="knop"><Icoon naam="schild" grootte={13} /> Wachtwoord wijzigen</button>
            <button className="knop">Tweefactor opnieuw instellen</button>
          </div>
        </Kaart>
      </div>
    </>
  );
}
