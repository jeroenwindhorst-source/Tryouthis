import { useState } from 'react';
import { Icoon } from './iconen';
import { api } from './api';
import { useData } from './gebruik';
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

type Rol = 'poh-s' | 'assistent' | 'huisarts';

interface Ingang { id: string; label: string; icoon: string }

const ROLLEN: { id: Rol; naam: string; functie: string; icoon: string }[] = [
  { id: 'poh-s', naam: 'Sanne Bakker', functie: 'POH-Somatiek', icoon: 'schild' },
  { id: 'assistent', naam: 'Ilse Hendriks', functie: 'Doktersassistent', icoon: 'gesprek' },
  { id: 'huisarts', naam: 'Daan Verhoeven', functie: 'Huisarts', icoon: 'persoon' },
];

/**
 * Eén dossier, drie ingangen.
 *
 * De navigatie volgt per rol het eigen werkproces: de POH werkt van dagstart naar
 * afronden, de assistent werkt een stroom af, en de huisarts wisselt tussen spreekuur
 * en autoriseren. Wat ze delen — protocol, terminologie, configuratie — staat eronder.
 */
const WERKPROCES: Record<Rol, Ingang[]> = {
  'poh-s': [
    { id: 'dagstart', label: 'Dagstart', icoon: 'zon' },
    { id: 'voorbereiden', label: 'Voorbereiden', icoon: 'klembord' },
    { id: 'spreekuur', label: 'Spreekuur', icoon: 'agenda' },
    { id: 'monitoren', label: 'Monitoren', icoon: 'radar' },
    { id: 'afronden', label: 'Afronden', icoon: 'afvinken' },
  ],
  assistent: [
    { id: 'as-overzicht', label: 'Dagstart', icoon: 'zon' },
    { id: 'as-triage', label: 'Triage', icoon: 'gesprek' },
    { id: 'spreekuur', label: 'Dossiers', icoon: 'klembord' },
  ],
  huisarts: [
    { id: 'ha-overzicht', label: 'Dagstart', icoon: 'zon' },
    { id: 'ha-autoriseren', label: 'Autoriseren', icoon: 'klembord' },
    { id: 'spreekuur', label: 'Spreekuur', icoon: 'agenda' },
    { id: 'ha-team', label: 'Het team', icoon: 'persoon' },
  ],
};

const PRAKTIJK: Ingang[] = [
  { id: 'instroom', label: 'Instroom', icoon: 'instroom' },
  { id: 'protocol', label: 'Het protocol', icoon: 'boek' },
  { id: 'terminologie', label: 'Terminologie', icoon: 'tag' },
  { id: 'beheer', label: 'Configuratie', icoon: 'schakelaar' },
];

const START: Record<Rol, string> = {
  'poh-s': 'dagstart', assistent: 'as-overzicht', huisarts: 'ha-overzicht',
};

export function App() {
  const [rol, setRol] = useState<Rol>('poh-s');
  const [scherm, setScherm] = useState<string>('dagstart');
  const [patientId, setPatientId] = useState<string | undefined>();

  const dagstart = useData(() => api.dagstart());
  const huisarts = useData(() => api.huisarts());
  const assistent = useData(() => api.assistent());

  const tellingen: Record<string, { n: number; urgent?: boolean }> = {};
  if (rol === 'poh-s') {
    for (const stap of dagstart.data?.stappen ?? []) {
      tellingen[stap.id] = { n: stap.aandacht || stap.aantal, urgent: stap.aandacht > 0 };
    }
  }
  if (rol === 'assistent' && assistent.data) {
    tellingen['as-triage'] = { n: assistent.data.stroom.triageNieuw, urgent: true };
  }
  if (rol === 'huisarts' && huisarts.data) {
    tellingen['ha-autoriseren'] = {
      n: huisarts.data.autorisatie.vraagtOordeel,
      urgent: huisarts.data.autorisatie.vraagtOordeel > 0,
    };
  }

  const open = (id: string) => { setPatientId(id); setScherm('spreekuur'); };
  const ga = (id: string) => { setPatientId(undefined); setScherm(id); };
  const wisselRol = (nieuw: Rol) => { setRol(nieuw); setPatientId(undefined); setScherm(START[nieuw]); };

  const huidigeRol = ROLLEN.find((r) => r.id === rol)!;

  const Ingangen = ({ lijst }: { lijst: Ingang[] }) => (
    <>
      {lijst.map((i) => {
        const telling = tellingen[i.id];
        return (
          <button key={i.id} data-actief={scherm === i.id} onClick={() => ga(i.id)}>
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
        <div className="merk">
          <Icoon naam="klok" grootte={20} />
          <span>
            Cadans
            <small>Huisartsenpraktijk De Linde</small>
          </span>
        </div>

        <div className="groep">Ik werk als</div>
        <div className="rolkiezer">
          {ROLLEN.map((r) => (
            <button key={r.id} data-actief={rol === r.id} onClick={() => wisselRol(r.id)}>
              <Icoon naam={r.icoon} grootte={15} />
              <span>
                {r.naam}
                <small>{r.functie}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="groep">Mijn werkproces</div>
        <Ingangen lijst={WERKPROCES[rol]} />

        <div className="groep">Praktijk</div>
        <Ingangen lijst={PRAKTIJK} />

        <div className="voet">
          {huidigeRol.naam} · {huidigeRol.functie}
          <div style={{ marginTop: 8, opacity: .8 }}>
            Demo · 48 synthetische patiënten
          </div>
        </div>
      </nav>

      <main className="werkblad">
        {scherm === 'spreekuur' && patientId && (
          <Consult patientId={patientId} terug={() => setPatientId(undefined)} />
        )}

        {scherm === 'spreekuur' && !patientId && rol === 'poh-s' && <Voorbereiden openPatient={open} />}
        {scherm === 'spreekuur' && !patientId && rol === 'assistent' && (
          <AssistentWerkplek scherm="overzicht" openPatient={open} />
        )}
        {scherm === 'spreekuur' && !patientId && rol === 'huisarts' && (
          <HuisartsWerkplek scherm="overzicht" openPatient={open} />
        )}

        {scherm === 'dagstart' && <Dagstart gaNaar={ga} openPatient={open} />}
        {scherm === 'voorbereiden' && <Voorbereiden openPatient={open} />}
        {scherm === 'monitoren' && <Monitoren openPatient={open} />}
        {scherm === 'afronden' && <Afronden />}

        {scherm === 'as-overzicht' && <AssistentWerkplek scherm="overzicht" openPatient={open} />}
        {scherm === 'as-triage' && <AssistentWerkplek scherm="triage" openPatient={open} />}

        {scherm === 'ha-overzicht' && <HuisartsWerkplek scherm="overzicht" openPatient={open} />}
        {scherm === 'ha-autoriseren' && <HuisartsWerkplek scherm="autoriseren" openPatient={open} />}
        {scherm === 'ha-team' && <HuisartsWerkplek scherm="team" openPatient={open} />}

        {scherm === 'instroom' && <Instroom openPatient={open} />}
        {scherm === 'protocol' && <Protocol />}
        {scherm === 'terminologie' && <Terminologie />}
        {scherm === 'beheer' && <Beheer />}
      </main>
    </div>
  );
}
