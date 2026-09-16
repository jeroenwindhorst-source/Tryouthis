import { useEffect, useRef, useState } from 'react';
import { api, type Gebruiker, type Zoektreffer } from './api';
import { useData } from './gebruik';
import { Icoon } from './iconen';
import { Woordmerk } from './logo';
import { Inloggen } from './schermen/Inloggen';
import { Dagstart } from './schermen/Dagstart';
import { Voorbereiden } from './schermen/Voorbereiden';
import { Monitoren } from './schermen/Monitoren';
import { Instroom } from './schermen/Instroom';
import { Afronden } from './schermen/Afronden';
import { Protocol } from './schermen/Protocol';
import { Consult } from './schermen/Consult';
import { Terminologie } from './schermen/Terminologie';
import { AssistentWerkplek } from './schermen/Assistent';
import { HuisartsWerkplek } from './schermen/Huisarts';
import { Beheer } from './schermen/Beheer';
import { Berichten } from './schermen/Berichten';
import { Overleg } from './schermen/Overleg';
import { Plannen } from './schermen/Plannen';
import { Rapportage } from './schermen/Rapportage';
import { Acuut, Acuutmelding, useAcuut } from './schermen/Acuut';
import { Gebruikers } from './schermen/Gebruikers';
import { STANDAARD_VOORKEUREN, Voorkeuren, type Persoonlijk } from './schermen/Voorkeuren';

interface Ingang { id: string; label: string; icoon: string; recht?: string }

/**
 * De werkplek wordt opgebouwd uit wat deze rol mag en doet.
 *
 * Niet één menu met grijze knoppen voor wat je niet mag — dat leert mensen alleen af om
 * te kijken. Wat niet bij jouw werk hoort, staat er niet.
 */
const WERKPROCES: Record<string, Ingang[]> = {
  'poh-s': [
    { id: 'dagstart', label: 'Dagstart', icoon: 'zon' },
    { id: 'acuut', label: 'Acuut', icoon: 'waarschuwing' },
    { id: 'voorbereiden', label: 'Voorbereiden', icoon: 'klembord' },
    { id: 'spreekuur', label: 'Spreekuur', icoon: 'agenda' },
    { id: 'monitoren', label: 'Monitoren', icoon: 'radar' },
    { id: 'overleg', label: 'Overleg', icoon: 'persoon' },
    { id: 'afronden', label: 'Afronden', icoon: 'afvinken' },
  ],
  assistent: [
    { id: 'as-overzicht', label: 'Dagstart', icoon: 'zon' },
    { id: 'acuut', label: 'Acuut', icoon: 'waarschuwing' },
    { id: 'as-triage', label: 'Triage', icoon: 'gesprek' },
    { id: 'plannen', label: 'Plannen', icoon: 'slot' },
    { id: 'spreekuur', label: 'Dossiers', icoon: 'klembord' },
    { id: 'overleg', label: 'Overleg', icoon: 'persoon' },
  ],
  huisarts: [
    { id: 'ha-overzicht', label: 'Dagstart', icoon: 'zon' },
    { id: 'acuut', label: 'Acuut', icoon: 'waarschuwing' },
    { id: 'ha-autoriseren', label: 'Autoriseren', icoon: 'klembord' },
    { id: 'spreekuur', label: 'Spreekuur', icoon: 'agenda' },
    { id: 'overleg', label: 'Overleg', icoon: 'persoon' },
    { id: 'ha-team', label: 'Het team', icoon: 'persoon' },
  ],
  administrator: [
    { id: 'rapportage', label: 'Praktijk in cijfers', icoon: 'rapport' },
    { id: 'beheer', label: 'Configuratie', icoon: 'schakelaar' },
    { id: 'gebruikers', label: 'Gebruikers', icoon: 'persoon' },
    { id: 'protocol', label: 'Het protocol', icoon: 'boek' },
  ],
};

const PRAKTIJK: Record<string, Ingang[]> = {
  'poh-s': [
    { id: 'instroom', label: 'Instroom', icoon: 'instroom' },
    { id: 'plannen', label: 'Plannen', icoon: 'slot' },
    { id: 'protocol', label: 'Het protocol', icoon: 'boek' },
  ],
  assistent: [{ id: 'protocol', label: 'Het protocol', icoon: 'boek' }],
  huisarts: [
    { id: 'instroom', label: 'Instroom', icoon: 'instroom' },
    { id: 'plannen', label: 'Plannen', icoon: 'slot' },
    { id: 'protocol', label: 'Het protocol', icoon: 'boek' },
  ],
  administrator: [],
};

const START: Record<string, string> = {
  'poh-s': 'dagstart', assistent: 'as-overzicht',
  huisarts: 'ha-overzicht', administrator: 'rapportage',
};

export function App() {
  const [gebruiker, setGebruiker] = useState<Gebruiker | undefined>();
  const [scherm, setScherm] = useState('dagstart');
  const [patientId, setPatientId] = useState<string | undefined>();
  const [voorkeuren, setVoorkeuren] = useState<Persoonlijk>(STANDAARD_VOORKEUREN);
  // Elke herstelronde krijgt een eigen sleutel, zodat alle schermen opnieuw laden.
  // Zonder dat blijft er ergens een oud overzicht in het geheugen staan.
  const [ronde, setRonde] = useState(0);

  if (!gebruiker) {
    return (
      <Inloggen opAangemeld={(g) => { setGebruiker(g); setScherm(START[g.rol] ?? 'dagstart'); }} />
    );
  }

  const open = (id: string) => { setPatientId(id); setScherm('spreekuur'); };
  const ga = (id: string) => { setPatientId(undefined); setScherm(id); };

  const herstel = async () => {
    await api.herstelDemo();
    setPatientId(undefined);
    setScherm(START[gebruiker.rol] ?? 'dagstart');
    setRonde((n) => n + 1);
  };

  return (
    <Werkplek
      key={ronde}
      gebruiker={gebruiker} scherm={scherm} patientId={patientId}
      voorkeuren={voorkeuren} opVoorkeuren={setVoorkeuren}
      opOpen={open} opGa={ga} opHerstel={herstel}
      opAfmelden={() => { setGebruiker(undefined); setPatientId(undefined); }}
      opSluitPatient={() => setPatientId(undefined)} />
  );
}

function Werkplek({
  gebruiker, scherm, patientId, voorkeuren, opVoorkeuren, opOpen, opGa, opHerstel,
  opAfmelden, opSluitPatient,
}: {
  gebruiker: Gebruiker; scherm: string; patientId?: string;
  voorkeuren: Persoonlijk; opVoorkeuren: (p: Persoonlijk) => void;
  opOpen: (id: string) => void; opGa: (id: string) => void; opHerstel: () => Promise<void>;
  opAfmelden: () => void; opSluitPatient: () => void;
}) {
  const zorgrol = gebruiker.rol !== 'administrator';
  const dagstart = useData(() => (gebruiker.rol === 'poh-s' ? api.dagstart() : Promise.resolve(undefined)), [gebruiker.id]);
  const huisarts = useData(() => (gebruiker.rol === 'huisarts' ? api.huisarts() : Promise.resolve(undefined)), [gebruiker.id]);
  const assistent = useData(() => (gebruiker.rol === 'assistent' ? api.assistent() : Promise.resolve(undefined)), [gebruiker.id]);
  const berichten = useData(() => api.berichten(gebruiker.id), [gebruiker.id]);
  // Acute instroom loopt buiten de schermen om: het moet ook opvallen terwijl je met
  // iets anders bezig bent. Dat is het hele punt van deze functie.
  const acuut = useAcuut(gebruiker, zorgrol);

  const tellingen: Record<string, { n: number; urgent?: boolean }> = {};
  for (const stap of dagstart.data?.stappen ?? []) {
    tellingen[stap.id] = { n: stap.aandacht || stap.aantal, urgent: stap.aandacht > 0 };
  }
  if (assistent.data) tellingen['as-triage'] = { n: assistent.data.stroom.triageNieuw, urgent: true };
  if (assistent.data) tellingen.plannen = { n: 0 };
  if (huisarts.data) {
    tellingen['ha-autoriseren'] = {
      n: huisarts.data.autorisatie.vraagtOordeel, urgent: huisarts.data.autorisatie.vraagtOordeel > 0,
    };
  }
  if (berichten.data?.ongelezen) tellingen.berichten = { n: berichten.data.ongelezen, urgent: true };
  if (acuut.aantalOpen > 0) tellingen.acuut = { n: acuut.aantalOpen, urgent: true };

  const Ingangen = ({ lijst }: { lijst: Ingang[] }) => (
    <>
      {lijst.map((i) => {
        const telling = tellingen[i.id];
        return (
          <button key={i.id} data-actief={scherm === i.id} onClick={() => opGa(i.id)}>
            <Icoon naam={i.icoon} />
            {i.label}
            {telling && telling.n > 0 && (
              <span className="badge" data-toon={telling.urgent ? 'urgent' : undefined}>{telling.n}</span>
            )}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="app">
      <nav className="zijbalk">
        <div className="merk"><Woordmerk grootte={26} subtitel="Huisartsenpraktijk De Linde" /></div>

        <div className="groep">Mijn werk</div>
        <Ingangen lijst={WERKPROCES[gebruiker.rol] ?? []} />
        <Ingangen lijst={[{ id: 'berichten', label: 'Berichten', icoon: 'gesprek' }]} />

        {(PRAKTIJK[gebruiker.rol] ?? []).length > 0 && (
          <>
            <div className="groep">Praktijk</div>
            <Ingangen lijst={PRAKTIJK[gebruiker.rol]} />
          </>
        )}

        <div className="groep">Instellingen</div>
        <Ingangen lijst={
          gebruiker.rechten.includes('configuratie-praktijk')
            ? [{ id: 'voorkeuren', label: 'Mijn voorkeuren', icoon: 'persoon' }]
            : [{ id: 'voorkeuren', label: 'Mijn voorkeuren', icoon: 'persoon' }]
        } />

        <div className="voet">
          {gebruiker.naam} · {gebruiker.functie}
          <div style={{ marginTop: 8, opacity: .8 }}>Demo · 48 synthetische patiënten</div>
        </div>
      </nav>

      <div>
        <header className="kopbalk">
          {zorgrol
            ? <Zoeken opOpen={opOpen} />
            : <span className="mini">Beheeromgeving — geen toegang tot dossiers</span>}

          <Demoknop opHerstel={opHerstel} />

          <div className="gebruikerchip">
            <span className="bol">{gebruiker.initialen}</span>
            <span style={{ fontSize: 12.5 }}>
              <strong>{gebruiker.naam}</strong>
              <div className="mini">{gebruiker.functie}</div>
            </span>
            <button className="knop" data-toon="stil" onClick={opAfmelden} title="Afmelden">
              <Icoon naam="uitloggen" grootte={15} />
            </button>
          </div>
        </header>

        <main className="werkblad" data-dichtheid={voorkeuren.dichtheid}>
          {scherm === 'spreekuur' && patientId && (
            <Consult patientId={patientId} gebruiker={gebruiker} terug={opSluitPatient} />
          )}
          {scherm === 'spreekuur' && !patientId && gebruiker.rol === 'poh-s' && (
            <Voorbereiden openPatient={opOpen} toonUitleg={voorkeuren.toonUitleg} />
          )}
          {scherm === 'spreekuur' && !patientId && gebruiker.rol === 'assistent' && (
            <Dossierzoeker opOpen={opOpen} />
          )}
          {scherm === 'spreekuur' && !patientId && gebruiker.rol === 'huisarts' && (
            <HuisartsWerkplek scherm="overzicht" openPatient={opOpen} />
          )}

          {scherm === 'dagstart' && <Dagstart gaNaar={opGa} openPatient={opOpen} />}
          {scherm === 'voorbereiden' && <Voorbereiden openPatient={opOpen} toonUitleg={voorkeuren.toonUitleg} />}
          {scherm === 'monitoren' && <Monitoren openPatient={opOpen} />}
          {scherm === 'afronden' && <Afronden />}

          {scherm === 'as-overzicht' && <AssistentWerkplek scherm="overzicht" openPatient={opOpen} />}
          {scherm === 'as-triage' && <AssistentWerkplek scherm="triage" openPatient={opOpen} />}

          {scherm === 'ha-overzicht' && <HuisartsWerkplek scherm="overzicht" openPatient={opOpen} />}
          {scherm === 'ha-autoriseren' && <HuisartsWerkplek scherm="autoriseren" openPatient={opOpen} />}
          {scherm === 'ha-team' && <HuisartsWerkplek scherm="team" openPatient={opOpen} />}

          {scherm === 'instroom' && <Instroom openPatient={opOpen} />}
          {scherm === 'protocol' && <Protocol />}
          {scherm === 'beheer' && <Beheer />}
          {scherm === 'gebruikers' && <Gebruikers />}
          {scherm === 'berichten' && <Berichten gebruiker={gebruiker} openPatient={opOpen} />}
          {scherm === 'overleg' && <Overleg gebruiker={gebruiker} openPatient={opOpen} />}
          {scherm === 'plannen' && <Plannen gebruiker={gebruiker} openPatient={opOpen} />}
          {scherm === 'acuut' && <Acuut gebruiker={gebruiker} openPatient={opOpen} />}
          {scherm === 'rapportage' && <Rapportage />}
          {scherm === 'voorkeuren' && (
            <Voorkeuren gebruiker={gebruiker} voorkeuren={voorkeuren} opWijzig={opVoorkeuren} />
          )}
          {scherm === 'terminologie' && <Terminologie />}
        </main>
      </div>

      {acuut.dringend && (
        <Acuutmelding signaal={acuut.dringend} gebruiker={gebruiker}
          opOpgepakt={acuut.setBeeld}
          opWeg={() => acuut.klikWeg(acuut.dringend!.id)}
          openPatient={opOpen} />
      )}
    </div>
  );
}

/**
 * De demo terugzetten.
 *
 * Alles wat je tijdens een demonstratie aanpast — consulten, orders, geaccordeerde
 * recepten, afgehandelde triages — leeft in het geheugen. Zonder deze knop is de tweede
 * demonstratie een andere dan de eerste, en dat is precies wat je niet wilt als je hem
 * aan verschillende mensen laat zien. De generatoren draaien op vaste zaden, dus dit
 * levert exact dezelfde beginstand op.
 */
function Demoknop({ opHerstel }: { opHerstel: () => Promise<void> }) {
  const [vraagt, setVraagt] = useState(false);
  const [bezig, setBezig] = useState(false);

  if (!vraagt) {
    return (
      <button className="demoknop" onClick={() => setVraagt(true)}
        title="Alle wijzigingen terugdraaien naar de beginstand">
        <Icoon naam="herstel" grootte={14} /> Demo herstellen
      </button>
    );
  }

  return (
    <div className="demobevestiging">
      <span className="mini">
        Alles terug naar de beginstand? Consulten, orders en autorisaties van deze ronde
        verdwijnen.
      </span>
      <button className="knop" data-toon="primair" disabled={bezig}
        onClick={async () => {
          setBezig(true);
          try { await opHerstel(); } finally { setBezig(false); setVraagt(false); }
        }}>
        <Icoon naam="herstel" grootte={13} /> Herstellen
      </button>
      <button className="knop" onClick={() => setVraagt(false)}>Annuleren</button>
    </div>
  );
}

/** Patiënt zoeken op naam, geboortedatum of BSN — vanuit elk scherm. */
function Zoeken({ opOpen }: { opOpen: (id: string) => void }) {
  const [vraag, setVraag] = useState('');
  const [treffers, setTreffers] = useState<Zoektreffer[]>([]);
  const [open, setOpen] = useState(false);
  const doos = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const buiten = (e: MouseEvent) => {
      if (doos.current && !doos.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', buiten);
    return () => document.removeEventListener('mousedown', buiten);
  }, []);

  const zoek = async (q: string) => {
    setVraag(q);
    if (q.trim().length < 2) { setTreffers([]); setOpen(false); return; }
    setTreffers(await api.zoek(q));
    setOpen(true);
  };

  return (
    <div className="zoekdoos" ref={doos}>
      <span className="icoon"><Icoon naam="vergrootglas" grootte={15} /></span>
      <input type="search" value={vraag} placeholder="Zoek patiënt op naam, geboortedatum of BSN"
        onChange={(e) => zoek(e.target.value)} onFocus={() => treffers.length && setOpen(true)} />
      {open && (
        <div className="zoekresultaten">
          {treffers.length === 0 && <div className="leeg">Geen patiënt gevonden.</div>}
          {treffers.map((t) => (
            <button key={t.patientId} onClick={() => { opOpen(t.patientId); setOpen(false); setVraag(''); }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ fontSize: 13 }}>{t.naam}</strong>
                <span className="mini">{t.geboortedatum} · {t.leeftijd} jaar</span>
                <span className="mini" style={{ marginLeft: 'auto' }}>op {t.reden}</span>
              </div>
              <div className="mini">BSN {t.bsn}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Voor de assistent: dossiers zijn er om op te zoeken, niet om door te bladeren. */
function Dossierzoeker({ opOpen }: { opOpen: (id: string) => void }) {
  const [vraag, setVraag] = useState('');
  const [treffers, setTreffers] = useState<Zoektreffer[]>([]);

  const zoek = async (q: string) => {
    setVraag(q);
    setTreffers(q.trim().length >= 2 ? await api.zoek(q) : []);
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Dossiers</h1>
          <div className="onder">Zoek op naam, geboortedatum of BSN</div>
        </div>
      </div>

      <div className="notitie">
        <strong>Zoeken, niet bladeren.</strong> Aan de balie en aan de telefoon begin je met een
        naam of een geboortedatum. Een lijst met alle patiënten van de praktijk helpt daar niet bij.
      </div>

      <div className="kaart">
        <div className="body">
          <input type="search" value={vraag} autoFocus
            placeholder="Bijvoorbeeld 'de Vries' of '1955'"
            onChange={(e) => zoek(e.target.value)} />
        </div>
        {treffers.length > 0 && (
          <table>
            <tbody>
              {treffers.map((t) => (
                <tr key={t.patientId}>
                  <td>
                    <button className="knop" data-toon="stil" style={{ padding: 0, fontWeight: 600 }}
                      onClick={() => opOpen(t.patientId)}>{t.naam}</button>
                    <div className="mini">{t.geboortedatum} · {t.leeftijd} jaar · BSN {t.bsn}</div>
                  </td>
                  <td className="rechts">
                    <button className="knop" onClick={() => opOpen(t.patientId)}>
                      Openen <Icoon naam="pijl" grootte={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
