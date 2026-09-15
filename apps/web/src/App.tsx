import { useState } from 'react';
import { Dagstart } from './schermen/Dagstart';
import { Monitoring } from './schermen/Monitoring';
import { Inclusie } from './schermen/Inclusie';
import { Dossier } from './schermen/Dossier';
import { Terminologie } from './schermen/Terminologie';

type Scherm = 'dagstart' | 'monitoring' | 'inclusie' | 'terminologie';

const TABS: { id: Scherm; label: string }[] = [
  { id: 'dagstart', label: 'Dagstart' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'inclusie', label: 'Inclusie & casefinding' },
  { id: 'terminologie', label: 'Terminologie' },
];

export function App() {
  const [scherm, setScherm] = useState<Scherm>('dagstart');
  const [patientId, setPatientId] = useState<string | undefined>();

  const openPatient = (id: string) => setPatientId(id);
  const sluitPatient = () => setPatientId(undefined);

  return (
    <>
      <div className="balk">
        <div className="merk">Zorgplatform Eerstelijn<span>werkplek POH-Somatiek</span></div>
        <div className="rechts">
          <span>S. Bakker · POH-S</span>
          <span>Huisartsenpraktijk De Linde</span>
        </div>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} data-actief={!patientId && scherm === t.id}
            onClick={() => { setPatientId(undefined); setScherm(t.id); }}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {patientId
          ? <Dossier patientId={patientId} terug={sluitPatient} />
          : scherm === 'dagstart' ? <Dagstart openPatient={openPatient} />
          : scherm === 'monitoring' ? <Monitoring openPatient={openPatient} />
          : scherm === 'inclusie' ? <Inclusie />
          : <Terminologie />}
      </main>
    </>
  );
}
