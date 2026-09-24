import { useEffect, useState } from 'react';
import { api, type Gebruiker, type NieuweTaak, type Taakkeuze, type Taaksoort } from '../api';
import { Icoon } from '../iconen';

/**
 * HET TAKENPANEEL
 *
 * Dezelfde vorm als het orderpaneel, en dat is geen stijlkeuze maar het punt: een taak
 * uitzetten is hetzelfde soort handeling als iets bestellen. Je kiest wát er moet
 * gebeuren, bij wíé het terechtkomt, en je geeft mee waaróm — en daarna kun je hem
 * volgen tot hij af is (ADR-0009).
 *
 * Zonder dit paneel was 'bellen en herinneren' een knop die een merkje veranderde. De
 * tussenstap die ontbrak is precies de vraag die een praktijk dagelijks stelt: kan de
 * assistent dit oppakken, of moet ik het zelf doen? Dat verschilt per geval, dus het
 * hoort bij de handeling en niet in een instelling.
 */
export function Takenpaneel({ gebruiker, voorstel, opSluit, opUitgezet }: {
  gebruiker: Gebruiker;
  /** Waarmee het paneel opent: de knop die erop klikte weet al wat er moet gebeuren. */
  voorstel: {
    soort: Taaksoort;
    titel: string;
    aanleiding: string;
    patientId?: string;
    patientNaam?: string;
    bron: NieuweTaak['bron'];
    uiterlijkOp?: string;
  };
  opSluit: () => void;
  opUitgezet: (melding: string) => void;
}) {
  const [soorten, setSoorten] = useState<Taakkeuze[]>([]);
  const [soort, setSoort] = useState<Taaksoort>(voorstel.soort);
  const [titel, setTitel] = useState(voorstel.titel);
  const [aanleiding, setAanleiding] = useState(voorstel.aanleiding);
  const [ontvanger, setOntvanger] = useState<number>(0);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | undefined>();

  useEffect(() => {
    let geldig = true;
    api.taken(gebruiker.id).then((o) => { if (geldig) setSoorten(o.soorten); });
    return () => { geldig = false; };
  }, [gebruiker.id]);

  const keuze = soorten.find((s) => s.id === soort);
  const ontvangers = keuze?.ontvangers ?? [];
  const gekozen = ontvangers[Math.min(ontvanger, Math.max(0, ontvangers.length - 1))];

  /*
   * Wisselen van soort verandert ook de mogelijke ontvangers — een uitslag bespreken
   * hoort niet bij de assistent. De keuze terugzetten op de eerste is dan juister dan
   * hem laten staan op een index die nu iets anders betekent.
   */
  const kiesSoort = (nieuw: Taaksoort) => {
    setSoort(nieuw);
    setOntvanger(0);
    const definitie = soorten.find((s) => s.id === nieuw);
    if (definitie && titel === voorstel.titel) setTitel(definitie.label);
  };

  const zetUit = async () => {
    if (!gekozen) return;
    setBezig(true);
    try {
      const uitkomst = await api.zetTaakUit({
        soort,
        titel: titel.trim() || keuze?.label || 'Taak',
        aanleiding,
        patientId: voorstel.patientId,
        patientNaam: voorstel.patientNaam,
        bron: voorstel.bron,
        voorRol: gekozen.rol,
        voorGebruikerId: gekozen.id,
        voorNaam: gekozen.naam,
        uiterlijkOp: voorstel.uiterlijkOp,
      }, gebruiker.id);
      if (uitkomst.taak) opUitgezet(uitkomst.melding);
      else setMelding(uitkomst.melding);
    } finally { setBezig(false); }
  };

  return (
    <>
      <div className="paneel-scherm" onClick={opSluit} />
      <aside className="orderpaneel" role="dialog" aria-label="Taak uitzetten">
        <header>
          <span style={{ color: 'var(--merk)' }}><Icoon naam="bliksem" grootte={17} /></span>
          <div>
            <h2>Wat moet er gebeuren?</h2>
            <div className="mini">
              {voorstel.patientNaam ?? 'Zonder patiënt'}
              {voorstel.uiterlijkOp && ` · uiterlijk ${voorstel.uiterlijkOp}`}
            </div>
          </div>
          <button className="knop" data-toon="stil" onClick={opSluit}>
            <Icoon naam="kruis" grootte={14} /> Sluiten
          </button>
        </header>

        <div className="paneel-body">
          {melding && <div className="notitie" data-toon="waarschuwing">{melding}</div>}

          <h3 className="blokkop">Soort werk</h3>
          <div className="taakkeuzes">
            {soorten.map((s) => (
              <button key={s.id} className="taakkeuze" data-actief={s.id === soort}
                onClick={() => kiesSoort(s.id)}>
                <span className="ikoon"><Icoon naam={s.icoon} grootte={15} /></span>
                <div>
                  <strong>{s.label}</strong>
                  <div className="mini">{s.duurMinuten} min</div>
                </div>
              </button>
            ))}
          </div>
          {keuze && <div className="reden" style={{ marginTop: 7 }}>{keuze.uitleg}</div>}

          <h3 className="blokkop" style={{ marginTop: 18 }}>Bij wie leg je het neer?</h3>
          {/*
            'De assistent' en 'Ilse' staan er allebei, en dat is geen dubbeling. Een taak
            voor de rol kan door iedereen die er die dag is worden opgepakt; een taak op
            naam niet. Allebei komt voor, en wie ze door elkaar haalt krijgt werk dat
            blijft liggen omdat iedereen dacht dat een ander het deed.
          */}
          <div className="ontvangers">
            {ontvangers.map((o, i) => (
              <button key={`${o.rol}-${o.id ?? 'rol'}`} className="ontvanger"
                data-actief={i === ontvanger} onClick={() => setOntvanger(i)}>
                <span className="ikoon"><Icoon naam="persoon" grootte={14} /></span>
                <div>
                  <strong>{o.naam}</strong>
                  <div className="mini">{o.uitleg}</div>
                </div>
                {i === ontvanger && <Icoon naam="vink" grootte={14} />}
              </button>
            ))}
          </div>

          <h3 className="blokkop" style={{ marginTop: 18 }}>Wat er moet gebeuren</h3>
          <input className="taakveld" value={titel} onChange={(e) => setTitel(e.target.value)} />

          <h3 className="blokkop" style={{ marginTop: 14 }}>Waarom (gaat mee als context)</h3>
          <textarea className="taakveld" rows={3} value={aanleiding}
            onChange={(e) => setAanleiding(e.target.value)} />
          <div className="reden" style={{ marginTop: 6 }}>
            Wie dit oppakt, ziet alleen wat hier staat. Zonder aanleiding is het een
            opdracht zonder context — en dan belt er iemand die niet weet waarover.
          </div>
        </div>

        <footer className="paneel-voet">
          <div className="knop-rij">
            <button className="knop" data-toon="primair"
              disabled={bezig || aanleiding.trim().length < 3 || !gekozen}
              onClick={zetUit}>
              <Icoon naam="vink" grootte={14} />
              {gekozen ? ` Uitzetten bij ${gekozen.naam}` : ' Uitzetten'}
            </button>
            <button className="knop" data-toon="stil" onClick={opSluit}>Annuleren</button>
          </div>
        </footer>
      </aside>
    </>
  );
}
