import { useState } from 'react';
import {
  api, type Afspraakverzoek, type Gebruiker, type Praktijkplanbord, type Slot,
  type Taakregel, type Werkblok, type Zoektreffer,
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
  | { soort: 'patient'; patientId: string; naam: string; reden: string; duurMinuten: number }
  /*
   * Een uitgezette taak. Die hoort hier omdat hij tijd kost en dus een plek in de dag
   * verdient — terugbellen is geen 'tussendoortje' maar werk met een duur.
   */
  | { soort: 'taak'; taak: Taakregel }
  /*
   * Eigen werk zonder patiënt.
   *
   * Een agenda die alleen patiënten kent, liegt: uitslagen nalopen, terugbellen en
   * administratie kosten evenveel tijd als een consult maar zijn onzichtbaar. Het gevolg
   * is bekend — de dag zit vol en er is niets gepland voor wat er ook nog moet.
   */
  | { soort: 'blok'; blok: Werkblok };

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
  const taken = useData(() => api.taken(gebruiker.id), [gebruiker.id]);
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
      } else if (gekozen.soort === 'taak') {
        await api.planTaak(gekozen.taak.id, slot.start);
        setData(await api.planbordPraktijk());
        taken.herlaad();
      } else if (gekozen.soort === 'blok') {
        setData(await api.planWerkblok(gekozen.blok.id, slot.rol, slot.start));
      } else {
        setData(await api.planLosseAfspraak({
          patientId: gekozen.patientId, rol: slot.rol, start: slot.start,
          duurMinuten: gekozen.duurMinuten, reden: gekozen.reden,
        }));
      }
      setGekozen(undefined);
    } finally { setBezigMet(undefined); }
  };

  const openTaken = (taken.data?.mijn ?? []).filter((t) => t.status === 'open');
  const uitgezet = (taken.data?.uitgezet ?? []).filter((t) => t.status !== 'afgerond');

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
          <span className="merkje" data-toon={openTaken.length > 0 ? 'aandacht' : 'ok'}>
            {openTaken.length} {openTaken.length === 1 ? 'eigen taak' : 'eigen taken'}
          </span>
          <span className="merkje" data-toon={data.teplannen.length > 0 ? 'aandacht' : 'ok'}>
            {data.teplannen.length} nog in te plannen
          </span>
        </div>
      </div>

      {gekozen && (
        <div className="selectiebalk">
          <Icoon naam="agenda" grootte={15} />
          <strong>
            {gekozen.soort === 'verzoek' ? gekozen.verzoek.naam
              : gekozen.soort === 'taak' ? gekozen.taak.titel
              : gekozen.soort === 'blok' ? gekozen.blok.titel
              : gekozen.naam}
          </strong>
          <span className="mini">
            {gekozen.soort === 'verzoek'
              ? `${gekozen.verzoek.reden} · ${gekozen.verzoek.duurMinuten} min · bij de ${ROL_LABEL[gekozen.verzoek.voorRol] ?? gekozen.verzoek.voorRol}`
              : gekozen.soort === 'taak'
                ? `${gekozen.taak.aanleiding} · ${gekozen.taak.duurMinuten} min`
                : gekozen.soort === 'blok'
                  ? `${gekozen.blok.reden} · ${gekozen.blok.duurMinuten} min`
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
          {/*
            De eigen werklijst hoort op het planbord en niet in een apart scherm: 'wat
            moet ik nog doen' en 'waar past dat' zijn dezelfde vraag, en die beantwoord je
            door ze naast elkaar te zetten.
          */}
          <Kaart titel="Mijn werklijst" icoon="bliksem" telling={openTaken.length}>
            {openTaken.length === 0 && (
              <Leeg tekst="Niets uitgezet bij jou. Wat je in Aanloop of Opvolgen uitzet, komt hier." />
            )}
            {openTaken.map((t) => (
              <div key={t.id} className="planverzoek" draggable
                data-gekozen={gekozen?.soort === 'taak' && gekozen.taak.id === t.id}
                onDragStart={() => setGekozen({ soort: 'taak', taak: t })}
                onClick={() => setGekozen({ soort: 'taak', taak: t })}>
                <div className="kop">
                  <Icoon naam={t.icoon} grootte={13} />
                  <strong style={{ fontSize: 13 }}>{t.titel}</strong>
                  {t.dringend && <span className="merkje" data-toon="urgent">vandaag</span>}
                </div>
                <div className="reden">{t.aanleiding}</div>
                <div className="mini">
                  {t.soortLabel} · {t.duurMinuten} min · uitgezet door {t.aangemaaktDoor}
                  {t.uiterlijkOp && ` · uiterlijk ${t.uiterlijkOp}`}
                </div>
                <div className="knop-rij" style={{ marginTop: 7 }}>
                  {t.patientId && (
                    <button className="knop" data-toon="stil"
                      onClick={(e) => { e.stopPropagation(); openPatient(t.patientId!); }}>
                      <Icoon naam="klembord" grootte={12} /> Dossier
                    </button>
                  )}
                  <button className="knop" data-toon="stil" disabled={bezigMet === t.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setBezigMet(t.id);
                      try {
                        await api.rondTaakAf(t.id, gebruiker.id, 'direct afgehandeld');
                        taken.herlaad();
                      } finally { setBezigMet(undefined); }
                    }}>
                    <Icoon naam="vink" grootte={12} /> Direct gedaan
                  </button>
                </div>
              </div>
            ))}
          </Kaart>

          {/*
            Voorgedefinieerde blokken. Twintig minuten vrij is geen gat maar ruimte — en
            die is meer waard als je hem kunt vullen met het werk dat er toch al ligt.
          */}
          <Kaart titel="Eigen werk inplannen" icoon="klembord">
            <div className="chips" style={{ padding: '2px 0 8px' }}>
              {(taken.data?.werkblokken ?? []).map((b) => (
                <button key={b.id} className="merkje"
                  data-toon={gekozen?.soort === 'blok' && gekozen.blok.id === b.id ? 'informatief' : 'neutraal'}
                  draggable
                  onDragStart={() => setGekozen({ soort: 'blok', blok: b })}
                  onClick={() => setGekozen(
                    gekozen?.soort === 'blok' && gekozen.blok.id === b.id
                      ? undefined
                      : { soort: 'blok', blok: b },
                  )}>
                  {b.titel} <span className="mini">{b.duurMinuten} min</span>
                </button>
              ))}
            </div>
            <p className="mini" style={{ margin: 0 }}>
              Kies een blok en klik op een vrije plek. Zo staat er in de agenda dat de tijd
              bezet is, en waarvoor — in plaats van dat hij er voor de buitenwereld vrij
              uitziet.
            </p>
          </Kaart>

          {uitgezet.length > 0 && (
            <Kaart titel="Uitgezet bij een ander" icoon="persoon" telling={uitgezet.length}>
              {uitgezet.map((t) => (
                <div key={t.id} className="planverzoek" style={{ cursor: 'default' }}>
                  <div className="kop">
                    <strong style={{ fontSize: 13 }}>{t.titel}</strong>
                    <span className="merkje" data-toon={t.status === 'gepland' ? 'ok' : 'informatief'}>
                      {t.standLabel}
                    </span>
                  </div>
                  <div className="mini">bij {t.voorNaam} · {t.soortLabel}</div>
                </div>
              ))}
            </Kaart>
          )}

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

  const past = (slot: Slot) => {
    if (!gekozen) return true;
    if (gekozen.soort === 'verzoek') {
      return gekozen.verzoek.voorRol === slot.rol
        && gekozen.verzoek.duurMinuten <= slot.duurMinuten;
    }
    // Een taak hoort in de agenda van wie hem oppakt, niet in de eerste vrije plek.
    if (gekozen.soort === 'taak') return gekozen.taak.voorRol === slot.rol;
    return true;
  };

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
