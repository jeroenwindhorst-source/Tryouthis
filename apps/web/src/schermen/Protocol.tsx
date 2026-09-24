import { useState } from 'react';
import {
  api, type Gebruiker, type Protocolitem, type Protocolmodule, type Protocolwijziging,
} from '../api';
import { useData } from '../gebruik';
import { Icoon, icoonVanModule } from '../iconen';
import { Fout, Kaart, Laden, ModuleIdChips } from '../onderdelen';

function intervalTekst(dagen: number): string {
  if (dagen >= 730) return 'elke 2 jaar';
  if (dagen >= 360) return 'jaarlijks';
  if (dagen >= 170) return 'halfjaarlijks';
  if (dagen >= 85) return 'per kwartaal';
  return `elke ${dagen} dagen`;
}

function doorlooptekst(dagen: number): string {
  if (dagen === 0) return 'tijdens het consult';
  if (dagen === 1) return 'tot de dag ervoor';
  return `${dagen} dagen vooraf`;
}

/**
 * HET PROTOCOL — inzien én aanpassen
 *
 * Dit scherm liet eerst alleen zien wat de richtlijn zegt, en daarmee was het een folder.
 * Elke praktijk wijkt af: het prikpunt is traag, de optometrist doet de funduscontrole,
 * bij deze populatie wordt vaker gecontroleerd. Die afwijkingen bestáán, maar ze zitten
 * in hoofden en in losse afspraken — en daardoor is nergens te zien waar een praktijk van
 * de richtlijn afwijkt en waarom.
 *
 * Nu staat per onderdeel de richtlijnwaarde náást de praktijkwaarde, met wie hem
 * veranderde, wanneer en waarom. Aanpassen kan niet zonder reden en niet zonder recht.
 * Dat is geen formaliteit: een afwijking zonder onderbouwing is over een half jaar niet
 * te onderscheiden van een vergissing.
 */
export function Protocol({ gebruiker }: { gebruiker?: Gebruiker }) {
  const { data, fout, bezig, setData } = useData(
    () => api.protocol(gebruiker?.id), [gebruiker?.id]);
  const [bewerk, setBewerk] = useState<string | undefined>();
  const [melding, setMelding] = useState<string | undefined>();
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Protocol" />;

  const sleutel = (moduleId: string, itemCode?: string) => `${moduleId}|${itemCode ?? ''}`;

  const wijzig = async (wijziging: Protocolwijziging) => {
    if (!gebruiker) return;
    setBezigMet(sleutel(wijziging.moduleId, wijziging.itemCode));
    try {
      const uitkomst = await api.wijzigProtocol(wijziging, gebruiker.id);
      setMelding(uitkomst.melding);
      setData(uitkomst.overzicht);
      if (uitkomst.uitgevoerd) setBewerk(undefined);
    } finally { setBezigMet(undefined); }
  };

  const herstel = async (moduleId: string, itemCode?: string) => {
    if (!gebruiker) return;
    setBezigMet(sleutel(moduleId, itemCode));
    try {
      const uitkomst = await api.herstelProtocol(moduleId, itemCode, gebruiker.id);
      setMelding(uitkomst.melding);
      setData(uitkomst.overzicht);
      setBewerk(undefined);
    } finally { setBezigMet(undefined); }
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Het protocol</h1>
          <div className="onder">
            {data.modules.length} aandachtsgebieden · regelset {data.regelsetVersie}
            {data.aantalAfwijkingen > 0 && (
              <> · <strong>{data.aantalAfwijkingen} afwijking{data.aantalAfwijkingen === 1 ? '' : 'en'} van de richtlijn</strong></>
            )}
          </div>
        </div>
      </div>

      <div className="notitie">
        <strong>Eén protocol, geen zorgprogramma’s.</strong> {data.toelichting} Een mens heeft
        zelden één probleem; zodra de aandoening het organiserende principe wordt, krijg je per
        definitie losse trajecten, losse oproepen en losse consulten.
      </div>

      {data.magAanpassen ? (
        <div className="notitie" data-toon="merk">
          <strong>Je mag dit protocol aanpassen.</strong> De richtlijn blijft altijd zichtbaar
          naast wat jullie ervan gemaakt hebben. Een afwijking vraagt een reden — zonder die
          reden is hij over een half jaar niet te onderscheiden van een vergissing. Wat je hier
          wijzigt, werkt meteen door in alle zorgplannen en in de aanloop.
        </div>
      ) : (
        <div className="notitie">
          Je kunt het protocol inzien. Aanpassen doen de huisarts, de praktijkondersteuner of
          de praktijkmanager.
        </div>
      )}

      {melding && (
        <div className="notitie" data-toon="merk" style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
          <Icoon naam="vink" grootte={14} /> {melding}
          <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }}
            onClick={() => setMelding(undefined)}>Sluiten</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.modules.map((module) => (
          <Moduleblok key={module.id} module={module} magAanpassen={data.magAanpassen}
            bewerk={bewerk} opBewerk={setBewerk} bezigMet={bezigMet}
            opWijzig={wijzig} opHerstel={herstel} />
        ))}
      </div>

      <Kaart titel="Achtergrond: koppeling naar landelijke ketenzorg" icoon="tag">
        <p style={{ marginTop: 0, color: 'var(--ink-2)', fontSize: 12.5 }}>
          Declaratie, ketencontracten en indicatorenrapportage draaien in Nederland op programma’s
          per aandoening. Die werkelijkheid negeren betekent dat een praktijk haar financiering
          breekt. De koppeling gebeurt daarom hier — automatisch, achteraf, en zonder dat iemand
          “voor de keten” hoeft te registreren.
        </p>
        <table>
          <thead>
            <tr><th style={{ width: 230 }}>Keten</th><th>Wordt gedekt door</th><th style={{ width: 150 }}>Declaratie</th></tr>
          </thead>
          <tbody>
            {data.ketens.map((keten) => (
              <tr key={keten.id}>
                <td className="nadruk">{keten.naam}</td>
                <td><ModuleIdChips ids={keten.modules} /></td>
                <td>
                  <div className="nadruk">{keten.declaratie.prestatiecode}</div>
                  <div className="mini">{keten.declaratie.omschrijving}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kaart>
    </>
  );
}

function Moduleblok({ module, magAanpassen, bewerk, opBewerk, bezigMet, opWijzig, opHerstel }: {
  module: Protocolmodule;
  magAanpassen: boolean;
  bewerk?: string;
  opBewerk: (sleutel: string | undefined) => void;
  bezigMet?: string;
  opWijzig: (wijziging: Protocolwijziging) => void;
  opHerstel: (moduleId: string, itemCode?: string) => void;
}) {
  return (
    <section className={`kaart mod-${module.id}`} style={{ opacity: module.actief ? 1 : 0.62 }}>
      <header style={{ borderLeft: '3px solid var(--tint)', borderRadius: '10px 0 0 0' }}>
        <span style={{ color: 'var(--tint)' }}>
          <Icoon naam={icoonVanModule(module.id, module.icoon)} grootte={18} />
        </span>
        <h2 style={{ fontSize: 14, color: 'var(--tint)' }}>{module.naam}</h2>
        <span className="merkje" data-toon="neutraal">{module.rol}</span>
        {!module.actief && <span className="merkje" data-toon="aandacht">uit voor deze praktijk</span>}
        <span className="telling">{module.items.length} metingen</span>
      </header>

      <div className="body">
        <p style={{ marginTop: 0, color: 'var(--ink-2)', fontSize: 13 }}>{module.omschrijving}</p>

        {module.afwijking && (
          <Afwijkingsregel afwijking={module.afwijking} magAanpassen={magAanpassen}
            opHerstel={() => opHerstel(module.id)} />
        )}

        <div style={{ marginBottom: 12 }}>
          <span className="mini">Relevant wanneer: </span>
          <span style={{ fontSize: 12.5 }}>{module.relevantie}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Meting</th>
              <th style={{ width: 120 }}>Hoe vaak</th>
              <th style={{ width: 172 }}>Wanneer binnen</th>
              <th>Wordt korter of langer wanneer…</th>
              {magAanpassen && <th style={{ width: 96 }} />}
            </tr>
          </thead>
          <tbody>
            {module.items.map((item) => {
              const sleutel = `${module.id}|${item.code}`;
              const open = bewerk === sleutel;
              return (
                <Itemrij key={item.code} item={item} moduleId={module.id}
                  magAanpassen={magAanpassen} open={open} bezig={bezigMet === sleutel}
                  opOpen={() => opBewerk(open ? undefined : sleutel)}
                  opWijzig={opWijzig} opHerstel={opHerstel} />
              );
            })}
          </tbody>
        </table>

        <div className="mini" style={{ marginTop: 10 }}>
          Richtlijn: {module.richtlijnen.map((r) => `${r.naam} (${r.versie})`).join(' · ')}
        </div>

        {magAanpassen && (
          <div className="knop-rij" style={{ marginTop: 11 }}>
            <button className="knop" data-toon="stil"
              onClick={() => opBewerk(bewerk === module.id ? undefined : module.id)}>
              <Icoon naam="schakelaar" grootte={13} />
              {module.actief ? ' Dit aandachtsgebied uitzetten' : ' Weer aanzetten'}
            </button>
          </div>
        )}

        {bewerk === module.id && (
          <Redenformulier
            titel={module.actief
              ? `${module.naam} uitzetten voor deze praktijk`
              : `${module.naam} weer aanzetten`}
            bezig={bezigMet === `${module.id}|`}
            opAnnuleer={() => opBewerk(undefined)}
            opBevestig={(reden) => opWijzig({ moduleId: module.id, actief: !module.actief, reden })} />
        )}
      </div>
    </section>
  );
}

/** Eén meting, met de richtlijn ernaast zodra de praktijk ervan afwijkt. */
function Itemrij({ item, moduleId, magAanpassen, open, bezig, opOpen, opWijzig, opHerstel }: {
  item: Protocolitem;
  moduleId: string;
  magAanpassen: boolean;
  open: boolean;
  bezig: boolean;
  opOpen: () => void;
  opWijzig: (wijziging: Protocolwijziging) => void;
  opHerstel: (moduleId: string, itemCode?: string) => void;
}) {
  const andersInterval = item.praktijk.intervalDagen !== item.richtlijn.intervalDagen;
  const andersDoorlooptijd = item.praktijk.doorlooptijdDagen !== item.richtlijn.doorlooptijdDagen;

  return (
    <>
      <tr style={{ opacity: item.praktijk.actief ? 1 : 0.55 }}>
        <td className="nadruk">
          {item.naam}
          <div className="mini">{item.code}</div>
          {!item.praktijk.actief && (
            <span className="merkje" data-toon="aandacht">uit voor deze praktijk</span>
          )}
        </td>
        <td>
          {intervalTekst(item.praktijk.intervalDagen)}
          {/*
            De richtlijnwaarde blijft staan zodra de praktijk afwijkt. Alleen de eigen
            waarde tonen maakt van een bewuste keuze binnen een paar maanden een
            aanname die niemand meer kan navertellen.
          */}
          {andersInterval && (
            <div className="mini">richtlijn: {intervalTekst(item.richtlijn.intervalDagen)}</div>
          )}
        </td>
        <td>
          {doorlooptekst(item.praktijk.doorlooptijdDagen)}
          {/* Bij een meting die tijdens het consult gebeurt, voegt de reden niets toe. */}
          {item.praktijk.doorlooptijdDagen > 0 && (
            <div className="mini">{item.doorlooptijdReden}</div>
          )}
          {andersDoorlooptijd && (
            <div className="mini">richtlijn: {doorlooptekst(item.richtlijn.doorlooptijdDagen)}</div>
          )}
        </td>
        <td>
          {item.intervalRegels.length === 0
            ? <span className="mini">vast interval</span>
            : (
              <div style={{ display: 'grid', gap: 4 }}>
                {item.intervalRegels.map((r, i) => (
                  <div key={i} style={{ fontSize: 12.5 }}>
                    <span className="merkje" data-toon={r.factor < 1 ? 'aandacht' : 'ok'}>
                      {r.factor < 1
                        ? `${Math.round((1 - r.factor) * 100)}% korter`
                        : `${Math.round((r.factor - 1) * 100)}% langer`}
                    </span>{' '}
                    {r.reden}
                  </div>
                ))}
              </div>
            )}
          <div className="chips" style={{ marginTop: 6 }}>
            {item.zelfAanleverbaar && <span className="merkje" data-toon="ok">thuis mogelijk</span>}
            {item.praktijk.labVooraf && <span className="merkje" data-toon="neutraal">lab vooraf</span>}
            {item.vragenlijst && <span className="merkje" data-toon="informatief">vragenlijst</span>}
          </div>
        </td>
        {magAanpassen && (
          <td>
            <button className="knop" data-toon="stil" onClick={opOpen}>
              <Icoon naam={open ? 'kruis' : 'schakelaar'} grootte={12} />
              {open ? ' Sluiten' : ' Aanpassen'}
            </button>
          </td>
        )}
      </tr>

      {item.afwijking && (
        <tr>
          <td colSpan={magAanpassen ? 5 : 4} style={{ paddingTop: 0 }}>
            <Afwijkingsregel afwijking={item.afwijking} magAanpassen={magAanpassen}
              opHerstel={() => opHerstel(moduleId, item.code)} />
          </td>
        </tr>
      )}

      {open && (
        <tr>
          <td colSpan={magAanpassen ? 5 : 4}>
            <Itemformulier item={item} bezig={bezig} opAnnuleer={opOpen}
              opBevestig={(w) => opWijzig({ ...w, moduleId, itemCode: item.code })} />
          </td>
        </tr>
      )}
    </>
  );
}

function Afwijkingsregel({ afwijking, magAanpassen, opHerstel }: {
  afwijking: { reden: string; door: string; op: string };
  magAanpassen: boolean;
  opHerstel: () => void;
}) {
  return (
    <div className="afwijking">
      <span className="merkje" data-toon="aandacht">afwijking</span>
      <div>
        <div style={{ fontSize: 12.5 }}>{afwijking.reden}</div>
        <div className="mini">{afwijking.door} · {afwijking.op}</div>
      </div>
      {magAanpassen && (
        <button className="knop" data-toon="stil" style={{ marginLeft: 'auto' }} onClick={opHerstel}>
          <Icoon naam="herstel" grootte={12} /> Terug naar de richtlijn
        </button>
      )}
    </div>
  );
}

/** Het formulier voor één meting: waarden links, de verplichte reden eronder. */
function Itemformulier({ item, bezig, opAnnuleer, opBevestig }: {
  item: Protocolitem;
  bezig: boolean;
  opAnnuleer: () => void;
  opBevestig: (wijziging: Omit<Protocolwijziging, 'moduleId'>) => void;
}) {
  const [interval, setInterval] = useState(String(item.praktijk.intervalDagen));
  const [doorlooptijd, setDoorlooptijd] = useState(String(item.praktijk.doorlooptijdDagen));
  const [labVooraf, setLabVooraf] = useState(item.praktijk.labVooraf);
  const [actief, setActief] = useState(item.praktijk.actief);
  const [reden, setReden] = useState('');

  return (
    <div className="protocolformulier">
      <div className="velden">
        <label>
          <span className="mini">Hoe vaak (dagen)</span>
          <input type="number" min={7} max={1460} value={interval}
            onChange={(e) => setInterval(e.target.value)} />
          <span className="mini">richtlijn: {item.richtlijn.intervalDagen}</span>
        </label>
        <label>
          <span className="mini">Dagen vooraf binnen</span>
          <input type="number" min={0} max={30} value={doorlooptijd}
            onChange={(e) => setDoorlooptijd(e.target.value)} />
          <span className="mini">richtlijn: {item.richtlijn.doorlooptijdDagen}</span>
        </label>
        <label className="schakel">
          <input type="checkbox" checked={labVooraf} onChange={(e) => setLabVooraf(e.target.checked)} />
          <span>Vooraf laten prikken</span>
        </label>
        <label className="schakel">
          <input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} />
          <span>Doen we in deze praktijk</span>
        </label>
      </div>

      <label style={{ display: 'block', marginTop: 10 }}>
        <span className="mini">Waarom wijkt deze praktijk af? (verplicht)</span>
        <textarea rows={2} value={reden} onChange={(e) => setReden(e.target.value)}
          placeholder="Bijvoorbeeld: het prikpunt verwerkt maar twee keer per week." />
      </label>

      <div className="knop-rij" style={{ marginTop: 9 }}>
        <button className="knop" data-toon="primair" disabled={bezig || reden.trim().length < 5}
          onClick={() => opBevestig({
            intervalDagen: Number(interval),
            doorlooptijdDagen: Number(doorlooptijd),
            labVooraf,
            actief,
            reden,
          })}>
          <Icoon naam="vink" grootte={13} /> Vastleggen
        </button>
        <button className="knop" data-toon="stil" onClick={opAnnuleer}>Annuleren</button>
      </div>
      <div className="reden" style={{ marginTop: 6 }}>
        Dit geldt voor de hele praktijk en werkt meteen door in alle zorgplannen. De
        richtlijnwaarde blijft ernaast staan.
      </div>
    </div>
  );
}

/** Alleen een reden, voor aan- en uitzetten van een heel aandachtsgebied. */
function Redenformulier({ titel, bezig, opAnnuleer, opBevestig }: {
  titel: string;
  bezig: boolean;
  opAnnuleer: () => void;
  opBevestig: (reden: string) => void;
}) {
  const [reden, setReden] = useState('');
  return (
    <div className="protocolformulier" style={{ marginTop: 10 }}>
      <strong style={{ fontSize: 13 }}>{titel}</strong>
      <label style={{ display: 'block', marginTop: 8 }}>
        <span className="mini">Waarom? (verplicht)</span>
        <textarea rows={2} value={reden} onChange={(e) => setReden(e.target.value)} />
      </label>
      <div className="knop-rij" style={{ marginTop: 9 }}>
        <button className="knop" data-toon="primair" disabled={bezig || reden.trim().length < 5}
          onClick={() => opBevestig(reden)}>
          <Icoon naam="vink" grootte={13} /> Vastleggen
        </button>
        <button className="knop" data-toon="stil" onClick={opAnnuleer}>Annuleren</button>
      </div>
    </div>
  );
}
