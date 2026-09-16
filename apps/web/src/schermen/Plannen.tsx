import { useState } from 'react';
import {
  api, type Afspraakverzoek, type Gebruiker, type Praktijkplanbord, type Slot, type Zoektreffer,
} from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg, ModuleChips, Statusmerk } from '../onderdelen';

const ROL_LABEL: Record<string, string> = {
  huisarts: 'Huisarts', 'poh-s': 'POH-Somatiek', assistent: 'Doktersassistent',
};

const ROUTE_MERK: Record<string, string> = {
  assistent: 'aandacht', portaal: 'informatief', zelf: 'neutraal', automatisch: 'ok',
};

/** Wat er aan de muis hangt, of wat er geselecteerd is bij toetsenbordgebruik. */
type Sleep =
  | { soort: 'verzoek'; verzoek: Afspraakverzoek }
  | { soort: 'patient'; patientId: string; naam: string; reden: string; duurMinuten: number };

/**
 * HET PLANBORD
 *
 * Dit is het werk van de assistent, en het is precies het werk waar bestaande systemen
 * het slechtst in zijn: iemand aan de lijn hebben en die in de juiste agenda op de juiste
 * plek zetten. Daarvoor moet je alle drie de agenda's tegelijk zien — "past dit bij de
 * POH of moet het naar de huisarts" is de eerste vraag en niet de laatste.
 *
 * Twee manieren om iets te plannen, allebei nodig:
 *  - **slepen**, voor wie de muis al vast heeft en snel wil;
 *  - **aanklikken**, want slepen werkt niet met een toetsenbord en niet met één hand aan
 *    de telefoon. Selecteer links, klik rechts op een plek. Zelfde resultaat.
 *
 * De vrije plekken staan tussen de afspraken en niet in een aparte lijst. Een tijdstip
 * zonder zijn omgeving laat je de verkeerde plek kiezen: net naast het visiteblok, of
 * vlak voor de lunch.
 */
export function Plannen({ gebruiker, openPatient }: {
  gebruiker: Gebruiker;
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.planbordPraktijk());
  const [gekozen, setGekozen] = useState<Sleep | undefined>();
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Planbord" />;

  const plan = async (slot: Slot) => {
    if (!gekozen) return;
    setBezigMet(slot.id);
    try {
      if (gekozen.soort === 'verzoek') {
        setData(await api.planAfspraak(gekozen.verzoek.id, slot.start));
      } else {
        setData(await api.planLosseAfspraak({
          patientId: gekozen.patientId, rol: slot.rol, start: slot.start,
          duurMinuten: gekozen.duurMinuten, reden: gekozen.reden,
        }));
      }
      setGekozen(undefined);
    } finally { setBezigMet(undefined); }
  };

  // De assistent plant voor iedereen; voor haar is geen enkele agenda 'de eigen agenda'.
  const eigenRol = gebruiker.rol === 'assistent' ? undefined : gebruiker.rol;
  const kolommen = eigenRol
    ? [...data.kolommen].sort((a, b) => Number(b.rol === eigenRol) - Number(a.rol === eigenRol))
    : data.kolommen;

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Plannen</h1>
          <div className="onder">
            {data.datum} · {eigenRol
              ? 'jouw agenda vooraan, die van je collega’s ernaast'
              : 'drie agenda’s naast elkaar'}, met de vrije plekken ertussen
          </div>
        </div>
        <div className="acties">
          <span className="merkje" data-toon={data.teplannen.length > 0 ? 'aandacht' : 'ok'}>
            {data.teplannen.length} nog in te plannen
          </span>
        </div>
      </div>

      {gekozen && (
        <div className="selectiebalk">
          <Icoon naam="agenda" grootte={15} />
          <strong>
            {gekozen.soort === 'verzoek' ? gekozen.verzoek.naam : gekozen.naam}
          </strong>
          <span className="mini">
            {gekozen.soort === 'verzoek'
              ? `${gekozen.verzoek.reden} · ${gekozen.verzoek.duurMinuten} min · bij de ${ROL_LABEL[gekozen.verzoek.voorRol] ?? gekozen.verzoek.voorRol}`
              : `${gekozen.reden} · ${gekozen.duurMinuten} min`}
          </span>
          <span className="mini" style={{ marginLeft: 'auto' }}>
            Klik nu op een vrije plek, of sleep hem erheen.
          </span>
          <button className="knop" data-toon="stil" onClick={() => setGekozen(undefined)}>
            <Icoon naam="kruis" grootte={13} /> Laat los
          </button>
        </div>
      )}

      <div className="planbord">
        <div className="planzijde">
          <Kaart titel="Nog in te plannen" icoon="klembord" telling={data.teplannen.length}>
            {data.teplannen.length === 0 && (
              <Leeg tekst="Niets openstaand. Alles wat aangevraagd is, staat in de agenda." />
            )}
            {data.teplannen.map((v) => (
              <div key={v.id} className="planverzoek" draggable
                data-gekozen={gekozen?.soort === 'verzoek' && gekozen.verzoek.id === v.id}
                onDragStart={() => setGekozen({ soort: 'verzoek', verzoek: v })}
                onClick={() => setGekozen({ soort: 'verzoek', verzoek: v })}>
                <div className="kop">
                  <strong style={{ fontSize: 13 }}>{v.naam}</strong>
                  <span className="merkje" data-toon={ROUTE_MERK[v.route] ?? 'neutraal'}>
                    {data.routes[v.route]?.label ?? v.route}
                  </span>
                </div>
                <div className="reden">{v.reden}</div>
                <div className="mini">
                  bij de {ROL_LABEL[v.voorRol] ?? v.voorRol} · {v.duurMinuten} min ·
                  aangevraagd door {v.aangevraagdDoor.naam}
                </div>
                {v.status === 'uitgezet' && (
                  <div className="mini" style={{ color: 'var(--info)' }}>
                    Staat bij de patiënt in het portaal. Je kunt hem alsnog zelf inplannen als
                    hij niet reageert.
                  </div>
                )}
                {v.vragenlijst && (
                  <div className="mini">Met vragenlijst: {v.vragenlijst}</div>
                )}
                <div className="knop-rij" style={{ marginTop: 7 }}>
                  <button className="knop" data-toon="stil"
                    onClick={(e) => { e.stopPropagation(); openPatient(v.patientId); }}>
                    <Icoon naam="klembord" grootte={12} /> Dossier
                  </button>
                  <button className="knop" data-toon="stil" disabled={bezigMet === v.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setBezigMet(v.id);
                      try { setData(await api.annuleerVerzoek(v.id, 'niet meer nodig')); }
                      finally { setBezigMet(undefined); }
                    }}>
                    <Icoon naam="kruis" grootte={12} /> Vervalt
                  </button>
                </div>
              </div>
            ))}
          </Kaart>

          <Zoekenplannen gebruiker={gebruiker} opKies={setGekozen} />
        </div>

        {/*
          Wiens agenda dit is, bepaalt de verdeling.

          Een assistent plant voor de hele praktijk: voor haar zijn de drie agenda's
          gelijkwaardig en staan ze even breed. Een POH of huisarts kijkt hier vooral
          naar zijn eigen dag en gebruikt de andere twee als context ("kan dit naar de
          assistent?"). Dan hoort de eigen agenda vooraan en breder — anders zoek je elke
          keer opnieuw welke van de drie kolommen van jou is.
        */}
        <div className="dagkolommen" data-nadruk={Boolean(eigenRol)}>
          {kolommen.map((kolom) => (
            <Dagkolom key={kolom.rol} kolom={kolom} gekozen={gekozen} eigen={kolom.rol === eigenRol}
              bezigMet={bezigMet} opPlan={plan} openPatient={openPatient} />
          ))}
        </div>
      </div>
    </>
  );
}

function Dagkolom({ kolom, gekozen, eigen, bezigMet, opPlan, openPatient }: {
  kolom: Praktijkplanbord['kolommen'][number];
  gekozen?: Sleep;
  /** Is dit de agenda van de ingelogde gebruiker? Die krijgt de ruimte. */
  eigen?: boolean;
  bezigMet?: string;
  opPlan: (slot: Slot) => void;
  openPatient: (id: string) => void;
}) {
  // Afspraken en vrije plekken door elkaar, op tijd. Een lijst met alleen vrije tijden
  // zonder de afspraken eromheen laat je de verkeerde plek kiezen.
  const regels = [
    ...kolom.agenda.map((a) => ({ tijd: a.tijd, soort: 'afspraak' as const, afspraak: a })),
    ...kolom.slots.map((s) => ({ tijd: s.tijd, soort: 'vrij' as const, slot: s })),
  ].sort((a, b) => a.tijd.localeCompare(b.tijd));

  const past = (slot: Slot) =>
    !gekozen
    || (gekozen.soort === 'verzoek'
      ? gekozen.verzoek.voorRol === slot.rol && gekozen.verzoek.duurMinuten <= slot.duurMinuten
      : true);

  return (
    <div className="dagkolom" data-eigen={eigen}>
      <header>
        <strong>{ROL_LABEL[kolom.rol] ?? kolom.rol}</strong>
        {eigen && <span className="merkje" data-toon="informatief">jouw agenda</span>}
        <span className="mini">
          {kolom.agenda.filter((a) => a.patientId).length} afspraken · {kolom.slots.length} vrij
        </span>
      </header>

      <div className="dagregels">
        {regels.map((regel) => regel.soort === 'afspraak' ? (
          <div key={regel.afspraak.id} className="dagregel" data-soort={regel.afspraak.soort}
            data-klikbaar={Boolean(regel.afspraak.patientId)}
            onClick={regel.afspraak.patientId
              ? () => openPatient(regel.afspraak.patientId!) : undefined}>
            <span className="klok">{regel.tijd}</span>
            <div>
              <div className="wie">{regel.afspraak.naam ?? regel.afspraak.titel}</div>
              <div className="mini">
                {regel.afspraak.reden ?? regel.afspraak.titel} · {regel.afspraak.duurMinuten} min
              </div>
              {/*
                Geen aandachtsgebieden in deze kolommen. Het planbord beantwoordt één vraag
                — waar is plek — en drie kolommen vol gekleurde chips maken de vrije plekken
                juist onvindbaar. Het klinische beeld staat één klik verderop in het dossier.
              */}
            </div>
            <Statusmerk regel={regel.afspraak} />
          </div>
        ) : (
          <button key={regel.slot.id} className="vrijeplek"
            data-past={past(regel.slot)} data-portaal={regel.slot.patientPlanbaar}
            disabled={bezigMet === regel.slot.id || !past(regel.slot)}
            onDragOver={(e) => { if (past(regel.slot)) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); opPlan(regel.slot); }}
            onClick={() => gekozen && opPlan(regel.slot)}>
            <span className="klok">{regel.tijd}</span>
            <span className="tekst">
              {regel.slot.duurMinuten} min vrij
              {regel.slot.patientPlanbaar && (
                <span className="mini"> · open voor de patiënt — {regel.slot.bestemd}</span>
              )}
            </span>
            {gekozen && past(regel.slot) && (
              <span className="merkje" data-toon="ok">hier inplannen</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Patiënt zoeken en direct een plek geven.
 *
 * Aan de telefoon is dit de hele handeling: naam, reden, plek. Alles wat daartussen zit
 * — een dossier openen, een formulier, een aparte planmodule — is loopwerk terwijl er
 * iemand wacht.
 */
function Zoekenplannen({ gebruiker, opKies }: {
  gebruiker: Gebruiker;
  opKies: (sleep: Sleep) => void;
}) {
  const [vraag, setVraag] = useState('');
  const [treffers, setTreffers] = useState<Zoektreffer[]>([]);
  const [patient, setPatient] = useState<Zoektreffer | undefined>();
  const [reden, setReden] = useState('');
  const [duur, setDuur] = useState(10);

  const zoek = async (q: string) => {
    setVraag(q);
    setTreffers(q.trim().length >= 2 ? await api.zoek(q) : []);
  };

  return (
    <Kaart titel="Iemand aan de lijn" icoon="gesprek">
      <p className="reden" style={{ marginTop: 0 }}>
        Zoek de patiënt, zet de reden erbij en sleep hem naar een vrije plek — of klik hem
        aan en klik daarna op de plek.
      </p>

      {!patient && (
        <>
          <div className="zoekdoos">
            <span className="icoon"><Icoon naam="vergrootglas" grootte={15} /></span>
            <input type="search" value={vraag} placeholder="Naam, geboortedatum of BSN"
              onChange={(e) => zoek(e.target.value)} />
          </div>
          {treffers.map((t) => (
            <button key={t.patientId} className="gesprekknop"
              onClick={() => { setPatient(t); setVraag(''); setTreffers([]); }}>
              <strong style={{ fontSize: 13 }}>{t.naam}</strong>
              <div className="mini">{t.geboortedatum} · {t.leeftijd} jaar · BSN {t.bsn}</div>
              {t.modules.length > 0 && (
                <div style={{ marginTop: 4 }}><ModuleChips modules={t.modules} /></div>
              )}
            </button>
          ))}
        </>
      )}

      {patient && (
        <>
          <div className="regel">
            <span className="sleutel">
              {patient.naam}
              <div className="mini">{patient.geboortedatum} · {patient.leeftijd} jaar</div>
            </span>
            <span className="waarde">
              <button className="knop" data-toon="stil" onClick={() => setPatient(undefined)}>
                <Icoon naam="kruis" grootte={12} /> ander
              </button>
            </span>
          </div>

          <label className="veld" style={{ marginTop: 9 }}>Reden</label>
          <input type="text" value={reden} placeholder="Waarvoor komt de patiënt?"
            onChange={(e) => setReden(e.target.value)} />

          <label className="veld" style={{ marginTop: 9 }}>Duur</label>
          <div className="segment">
            {[10, 20, 30].map((n) => (
              <button key={n} data-actief={duur === n} onClick={() => setDuur(n)}>{n} min</button>
            ))}
          </div>

          <button className="knop" data-toon="primair" style={{ marginTop: 11 }}
            disabled={!reden.trim()}
            onClick={() => opKies({
              soort: 'patient', patientId: patient.patientId, naam: patient.naam,
              reden: reden.trim(), duurMinuten: duur,
            })}>
            <Icoon naam="agenda" grootte={13} /> Kies een plek
          </button>

          <p className="mini" style={{ marginTop: 9 }}>
            De patiënt ziet de afspraak direct in het portaal
            {patient.modules.length > 0
              ? ', met de consultvoorbereidende vragenlijst erbij als die openstaat.'
              : '.'}
            {gebruiker.rol === 'assistent' && ' Je kunt daarna meteen de volgende opzoeken.'}
          </p>
        </>
      )}
    </Kaart>
  );
}
