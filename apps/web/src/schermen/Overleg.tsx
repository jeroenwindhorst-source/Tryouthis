import { useState } from 'react';
import { api, type Bespreekpunt, type Gebruiker } from '../api';
import { useData } from '../gebruik';
import { Icoon } from '../iconen';
import { Fout, Kaart, Laden, Leeg } from '../onderdelen';

const ROL_LABEL: Record<string, string> = {
  'poh-s': 'POH-Somatiek', huisarts: 'huisarts', assistent: 'doktersassistent',
};

/**
 * HET OVERLEG
 *
 * Halverwege de ochtend staat er een blok in de agenda van de huisarts, de POH en de
 * assistent. Dat blok had tot nu toe geen inhoud: je liep er met een papiertje naartoe.
 *
 * Dit is die inhoud. Eén gedeelde lijst, geen lijst per persoon — twee lijsten met
 * hetzelfde doel lopen altijd uit elkaar. Per punt staat de vraag, de context uit het
 * dossier en straks de uitkomst, zodat na het overleg terug te vinden is wat er besloten
 * is en door wie.
 */
export function Overleg({ gebruiker, openPatient }: {
  gebruiker: Gebruiker;
  openPatient: (id: string) => void;
}) {
  const { data, fout, bezig, setData } = useData(() => api.overleg(gebruiker.rol), [gebruiker.rol]);
  const [uitkomsten, setUitkomsten] = useState<Record<string, string>>({});
  const [bezigMet, setBezigMet] = useState<string | undefined>();

  if (fout) return <Fout boodschap={fout} />;
  if (bezig || !data) return <Laden wat="Bespreeklijst" />;

  const afhandelen = async (punt: Bespreekpunt) => {
    const tekst = (uitkomsten[punt.id] ?? '').trim();
    if (!tekst) return;
    setBezigMet(punt.id);
    try {
      setData(await api.handelBespreekpuntAf(punt.id, tekst, gebruiker.naam, gebruiker.rol));
      setUitkomsten((u) => ({ ...u, [punt.id]: '' }));
    } finally { setBezigMet(undefined); }
  };

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Overleg</h1>
          <div className="onder">
            {data.blok
              ? `${data.blok.titel} · ${data.blok.tijd} · ${data.blok.duurMinuten} minuten`
              : 'Gedeelde bespreeklijst van het team'}
          </div>
        </div>
        <div className="acties">
          <span className="merkje" data-toon={data.open.length > 0 ? 'aandacht' : 'ok'}>
            {data.open.length} te bespreken
          </span>
        </div>
      </div>

      <div className="notitie">
        <strong>Eén lijst voor het hele team.</strong> Wie een patiënt inbrengt, ziet hem hier
        terug en de ander ook. Een bespreekpunt is geen bericht: het hoort bij dit moment,
        het heeft een vraag, en het is pas klaar als er een antwoord staat.
      </div>

      <Kaart titel="Te bespreken" icoon="gesprek" telling={data.open.length}>
        {data.open.length === 0 && (
          <Leeg tekst="Niets op de lijst. Vanuit een dossier zet je iemand erop." />
        )}
        {data.open.map((punt) => (
          <div key={punt.id} className="bespreekpunt">
            <div className="kop">
              <button className="knop" data-toon="stil" style={{ padding: 0, fontWeight: 650 }}
                onClick={() => openPatient(punt.patientId)}>
                {punt.naam} <Icoon naam="pijl" grootte={12} />
              </button>
              <span className="mini">
                ingebracht door {punt.ingebrachtDoor.naam} ({ROL_LABEL[punt.ingebrachtDoor.rol] ?? punt.ingebrachtDoor.rol})
                · {punt.ingebrachtOp.slice(0, 10)}
              </span>
              <span className="merkje" data-toon="neutraal" style={{ marginLeft: 'auto' }}>
                voor {punt.voorRollen.map((r) => ROL_LABEL[r] ?? r).join(', ')}
              </span>
            </div>
            <p className="vraag">{punt.vraag}</p>
            {punt.context && <div className="reden">{punt.context}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input type="text" placeholder="Wat is er afgesproken?"
                value={uitkomsten[punt.id] ?? ''}
                onChange={(e) => setUitkomsten((u) => ({ ...u, [punt.id]: e.target.value }))} />
              <button className="knop" data-toon="primair"
                disabled={bezigMet === punt.id || !(uitkomsten[punt.id] ?? '').trim()}
                onClick={() => afhandelen(punt)}>
                <Icoon naam="vink" grootte={13} /> Besproken
              </button>
            </div>
          </div>
        ))}
      </Kaart>

      {data.besproken.length > 0 && (
        <Kaart titel="Besproken" icoon="afvinken" telling={data.besproken.length}>
          {data.besproken.map((punt) => (
            <div key={punt.id} className="regel">
              <span className="sleutel">
                {punt.naam}
                <div className="mini">{punt.vraag}</div>
              </span>
              <span className="waarde" style={{ maxWidth: 380, textAlign: 'left', fontWeight: 400 }}>
                {punt.uitkomst}
                <div className="mini">{punt.besprokenDoor} · {punt.besprokenOp?.slice(0, 10)}</div>
              </span>
            </div>
          ))}
        </Kaart>
      )}
    </>
  );
}

/**
 * Vanuit het dossier iemand op de bespreeklijst zetten.
 *
 * Dit is bewust géén bericht sturen. Een bericht kies je een ontvanger bij en is klaar als
 * hij gelezen is; dit hoort bij het overlegmoment en blijft staan tot er een antwoord is.
 */
export function Bespreekknop({ patientId, naam, gebruiker }: {
  patientId: string; naam: string; gebruiker: Gebruiker;
}) {
  const [open, setOpen] = useState(false);
  const [vraag, setVraag] = useState('');
  const [context, setContext] = useState('');
  const [klaar, setKlaar] = useState(false);
  const [bezig, setBezig] = useState(false);

  const voorRollen = gebruiker.rol === 'huisarts' ? ['poh-s'] : ['huisarts'];

  const inbrengen = async () => {
    if (!vraag.trim()) return;
    setBezig(true);
    try {
      await api.zetOpBespreeklijst(gebruiker.id, {
        patientId, naam, vraag: vraag.trim(), context: context.trim() || undefined, voorRollen,
      });
      setKlaar(true); setOpen(false); setVraag(''); setContext('');
    } finally { setBezig(false); }
  };

  return (
    <Kaart titel="Samen bekijken" icoon="persoon">
      {klaar && !open && (
        <div className="notitie" data-toon="ok" style={{ marginBottom: 9 }}>
          Staat op de bespreeklijst voor het overleg van vandaag.
        </div>
      )}
      {!open && (
        <>
          <p className="mini" style={{ marginTop: 0 }}>
            Zet deze patiënt op de gedeelde bespreeklijst voor het teamoverleg, met je vraag erbij.
          </p>
          <button className="knop" onClick={() => setOpen(true)}>
            <Icoon naam="plus" grootte={13} /> Op de bespreeklijst
          </button>
        </>
      )}

      {open && (
        <>
          <label className="veld">Wat wil je bespreken?</label>
          <textarea rows={2} value={vraag} autoFocus
            placeholder="Bijvoorbeeld: HbA1c blijft stijgen ondanks maximale metformine — tweede middel?"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
            onChange={(e) => setVraag(e.target.value)} />

          <label className="veld" style={{ marginTop: 9 }}>Context (optioneel)</label>
          <input type="text" value={context}
            placeholder="Waarden, beloop of wat de ander moet weten om mee te denken"
            onChange={(e) => setContext(e.target.value)} />

          <div className="knop-rij" style={{ marginTop: 10 }}>
            <button className="knop" data-toon="primair" disabled={bezig || !vraag.trim()}
              onClick={inbrengen}>
              <Icoon naam="vink" grootte={13} /> Inbrengen
            </button>
            <button className="knop" onClick={() => setOpen(false)}>Annuleren</button>
            <span className="mini" style={{ alignSelf: 'center' }}>
              Gaat naar de {voorRollen.map((r) => ROL_LABEL[r] ?? r).join(' en ')}.
            </span>
          </div>
        </>
      )}
    </Kaart>
  );
}
