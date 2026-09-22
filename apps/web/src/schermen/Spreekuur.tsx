import { api } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Agenda, Fout, Kaart, Laden } from '../onderdelen';

/**
 * HET SPREEKUUR — de dag als werklijst
 *
 * Dit scherm bestond niet: "Spreekuur" in het menu viel terug op de voorbereiding, zodat
 * je op *Spreekuur* klikte en *Voorbereiden* in beeld kreeg. Twee ingangen naar hetzelfde
 * scherm is één ingang te veel, en in een demo is het het moment waarop je moet uitleggen
 * waarom het scherm iets anders heet dan de knop.
 *
 * Wat hier hoort is de dag zelf: wie komt er, wie zit er al, wie is er geweest. Eén klik
 * op een regel opent het dossier op het consultscherm. De voorbereiding — is het lab
 * binnen, is de vragenlijst ingevuld — is een eigen stap en houdt zijn eigen ingang.
 */
export function Spreekuur({ openPatient, gaNaar }: {
  openPatient: (id: string) => void;
  gaNaar: (scherm: string) => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.dagstart());

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Spreekuur" />;

  // De statussen veranderen tijdens de dag; alleen de agenda bijwerken houdt de rest rustig.
  const zetStatus = async (afspraakId: string, status: string) => {
    const agenda = await api.zetAfspraakstatus(afspraakId, status, 'poh-s');
    setData((huidig) => huidig && { ...huidig, agenda });
  };

  const metPatient = data.agenda.filter((a) => a.patientId);
  const gedaan = metPatient.filter((a) => a.status === 'afgerond').length;
  const wacht = metPatient.filter((a) => a.status === 'wachtkamer' || a.status === 'aangemeld').length;
  const volgende = metPatient.find((a) => a.status === 'wachtkamer')
    ?? metPatient.find((a) => a.status === 'aangemeld')
    ?? metPatient.find((a) => a.status === 'gepland');

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Spreekuur</h1>
          <div className="onder">
            {metPatient.length} patiënten vandaag · {gedaan} geweest · {wacht} binnen
          </div>
        </div>
        <div className="acties">
          <button className="knop" onClick={() => gaNaar('voorbereiden')}>
            <Icoon naam="klembord" grootte={13} /> Naar de voorbereiding
          </button>
        </div>
      </div>

      {/*
        De eerstvolgende patiënt staat apart, want dat is de vraag waarmee je hier komt:
        wie haal ik nu op? In een lijst van twaalf regels moet je dat zelf uitrekenen.
      */}
      {volgende && (
        <div className="notitie">
          <strong>Nu aan de beurt: {volgende.naam}</strong> — {volgende.tijd},{' '}
          {volgende.reden ?? volgende.titel}
          {volgende.aandacht && <> · <span className="merkje" data-toon="aandacht">{volgende.aandacht}</span></>}
          <div className="knop-rij" style={{ marginTop: 9 }}>
            <button className="knop" data-toon="primair"
              onClick={() => volgende.patientId && openPatient(volgende.patientId)}>
              <Icoon naam="klembord" grootte={13} /> Open het consultscherm
            </button>
          </div>
        </div>
      )}

      <Kaart titel="Mijn dag" icoon="agenda" telling={`${data.agenda.length} in de agenda`}>
        <Agenda regels={data.agenda} openPatient={openPatient} opStatus={zetStatus} />
      </Kaart>
    </>
  );
}
