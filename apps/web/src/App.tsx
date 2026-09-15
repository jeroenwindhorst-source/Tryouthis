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

type Scherm =
  | 'dagstart' | 'voorbereiden' | 'spreekuur' | 'monitoren' | 'afronden'
  | 'instroom' | 'protocol' | 'terminologie';

interface Ingang { id: Scherm; label: string; icoon: string }

const WERKPROCES: Ingang[] = [
  { id: 'dagstart', label: 'Dagstart', icoon: 'zon' },
  { id: 'voorbereiden', label: 'Voorbereiden', icoon: 'klembord' },
  { id: 'spreekuur', label: 'Spreekuur', icoon: 'agenda' },
  { id: 'monitoren', label: 'Monitoren', icoon: 'radar' },
  { id: 'afronden', label: 'Afronden', icoon: 'afvinken' },
];

const OVERZICHT: Ingang[] = [
  { id: 'instroom', label: 'Instroom', icoon: 'instroom' },
  { id: 'protocol', label: 'Het protocol', icoon: 'boek' },
  { id: 'terminologie', label: 'Terminologie', icoon: 'tag' },
];

export function App() {
  const [scherm, setScherm] = useState<Scherm>('dagstart');
  const [patientId, setPatientId] = useState<string | undefined>();
  const dagstart = useData(() => api.dagstart());

  const aantallen: Partial<Record<Scherm, { n: number; urgent?: boolean }>> = {};
  for (const stap of dagstart.data?.stappen ?? []) {
    aantallen[stap.id as Scherm] = { n: stap.aandacht || stap.aantal, urgent: stap.aandacht > 0 };
  }

  const open = (id: string) => { setPatientId(id); setScherm('spreekuur'); };
  const ga = (id: string) => { setPatientId(undefined); setScherm(id as Scherm); };

  const Ingangen = ({ lijst }: { lijst: Ingang[] }) => (
    <>
      {lijst.map((i) => {
        const telling = aantallen[i.id];
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
          <Icoon naam="schild" grootte={20} />
          <span>
            Zorgplatform
            <small>werkplek POH-Somatiek</small>
          </span>
        </div>

        <div className="groep">Mijn werkproces</div>
        <Ingangen lijst={WERKPROCES} />

        <div className="groep">Praktijk</div>
        <Ingangen lijst={OVERZICHT} />

        <div className="voet">
          Sanne Bakker · POH-S<br />
          Huisartsenpraktijk De Linde
        </div>
      </nav>

      <main className="werkblad">
        {scherm === 'dagstart' && <Dagstart gaNaar={ga} openPatient={open} />}
        {scherm === 'voorbereiden' && <Voorbereiden openPatient={open} />}
        {scherm === 'spreekuur' && (
          patientId
            ? <Consult patientId={patientId} terug={() => setPatientId(undefined)} />
            : <Voorbereiden openPatient={open} />
        )}
        {scherm === 'monitoren' && <Monitoren openPatient={open} />}
        {scherm === 'afronden' && <Afronden />}
        {scherm === 'instroom' && <Instroom openPatient={open} />}
        {scherm === 'protocol' && <Protocol />}
        {scherm === 'terminologie' && <Terminologie />}
      </main>
    </div>
  );
}
