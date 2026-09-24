import { useEffect, useState } from 'react';
import { api, type Taakdossier } from '../api';
import { Icoon, icoonVanModule } from '../iconen';
import { Bereikbaarheidskaart, ErnstMerk, Laden } from '../onderdelen';
import { Belvenster } from './Belvenster';

/**
 * HET TAAKVENSTER
 *
 * Een taak inplannen bleek niet hetzelfde als weten wat je gaat zeggen. Het blok stond in
 * de agenda, je klikte erop, en dan stond er precies wat je zelf had ingetypt toen je hem
 * uitzette — terwijl de vraag op dat moment een andere is: wát komt er bij deze mens
 * eigenlijk nog tekort?
 *
 * Dat is allemaal te vinden. In de aanloop staat welke uitslag mist, in het zorgplan
 * wanneer de afspraak is, in de signalen wat eruit springt en in het dossier hoe je deze
 * mens bereikt. Alleen stond het op vier plekken en zat je op de vijfde. Hier staat het
 * bij elkaar, met een gespreksdoel erbij en de belknop ernaast — zodat het blok van
 * 11:20 geen herinnering meer is maar een voorbereid gesprek.
 */
export function Taakvenster({ taakId, gebruiker, opSluit, opGewijzigd, openPatient }: {
  taakId: string;
  gebruiker: { id: string };
  opSluit: () => void;
  /** Er is iets veranderd (taak afgerond, contact vastgelegd) — herlaad het scherm eronder. */
  opGewijzigd?: () => void;
  openPatient?: (id: string) => void;
}) {
  const [dossier, setDossier] = useState<Taakdossier | undefined>();
  const [bellen, setBellen] = useState(false);
  const [melding, setMelding] = useState<string | undefined>();
  const [bezig, setBezig] = useState(false);
  /*
   * Het scherm eronder wordt pas bijgewerkt als dit venster dichtgaat.
   *
   * Tussentijds herladen laat het scherm eronder even 'Laden…' tonen, en omdat dit
   * venster daarin zit, verdwijnt het onder je handen — precies op het moment dat je de
   * bevestiging van het vastgelegde gesprek staat te lezen.
   */
  const [gewijzigd, setGewijzigd] = useState(false);
  const sluit = () => { if (gewijzigd) opGewijzigd?.(); opSluit(); };

  const haal = () => api.taakdossier(taakId).then(setDossier);
  useEffect(() => {
    let geldig = true;
    api.taakdossier(taakId).then((d) => { if (geldig) setDossier(d); });
    return () => { geldig = false; };
  }, [taakId]);

  const rondAf = async () => {
    setBezig(true);
    try {
      await api.rondTaakAf(taakId, gebruiker.id, 'Afgehandeld vanuit het taakvenster.');
      await haal();
      setGewijzigd(true);
    } finally { setBezig(false); }
  };

  const open = dossier?.ontbreekt.filter((o) => o.stand !== 'binnen') ?? [];

  return (
    <>
      <div className="paneel-scherm" onClick={sluit} />
      <aside className="orderpaneel" role="dialog" aria-label="Taak">
        <header>
          <span style={{ color: 'var(--merk)' }}>
            <Icoon naam={dossier?.taak.icoon ?? 'bliksem'} grootte={17} />
          </span>
          <div>
            <h2>{dossier?.taak.titel ?? 'Taak'}</h2>
            <div className="mini">
              {dossier
                ? `${dossier.naam}${dossier.leeftijd ? `, ${dossier.leeftijd} jaar` : ''} · `
                  + `${dossier.taak.soortLabel} · ${dossier.taak.standLabel}`
                : 'laden'}
            </div>
          </div>
          <button className="knop" data-toon="stil" onClick={sluit}>
            <Icoon naam="kruis" grootte={14} /> Sluiten
          </button>
        </header>

        <div className="paneel-body">
          {!dossier && <Laden wat="Taak" />}
          {dossier && (
            <>
              {melding && <div className="notitie" data-toon="ok">{melding}</div>}

              {/*
                Bovenaan staat niet de taak maar wat er ontbreekt. De taak weet je al —
                je hebt hem zelf uitgezet of ingepland. Wat je niet weet is waaróm je nu
                belt, en dat is dit lijstje.
              */}
              <h3 className="blokkop">Wat komt er nog tekort</h3>
              {dossier.ontbreekt.length === 0 && (
                <div className="reden">
                  Er ontbreekt niets in de voorbereiding. Deze taak gaat dus ergens anders
                  over — kijk bij de aanleiding hieronder.
                </div>
              )}
              {dossier.ontbreekt.map((o) => (
                <div key={o.naam} className="regel" data-stand={o.stand}>
                  <span className="sleutel">
                    {o.naam}
                    <div className="mini">{o.toelichting}</div>
                  </span>
                  <span className="waarde">
                    <span className="merkje" data-toon={
                      o.stand === 'binnen' ? 'ok' : o.stand === 'open' ? 'aandacht' : 'urgent'
                    }>
                      {o.stand === 'binnen' ? 'binnen' : o.stand === 'open' ? 'nog niet binnen' : 'te laat'}
                    </span>
                  </span>
                </div>
              ))}

              {dossier.afspraak && (
                <div className="notitie"
                  data-toon={dossier.afspraak.status === 'verzetten' ? 'waarschuwing' : 'merk'}
                  style={{ marginTop: 12 }}>
                  <strong>
                    Afspraak {dossier.afspraak.datum} om {dossier.afspraak.tijd} · nog{' '}
                    {dossier.afspraak.dagenTot} dagen
                  </strong>
                  <div className="mini" style={{ marginTop: 4 }}>{dossier.afspraak.advies}</div>
                  <div className="reden" style={{ marginTop: 6 }}>{dossier.afspraak.toelichting}</div>
                </div>
              )}

              {dossier.signalen.length > 0 && (
                <>
                  <h3 className="blokkop" style={{ marginTop: 18 }}>Wat er verder speelt</h3>
                  {dossier.signalen.slice(0, 4).map((s) => (
                    <div key={s.tekst} className="signaalregel">
                      <ErnstMerk ernst={s.ernst} />
                      <span>{s.tekst}</span>
                    </div>
                  ))}
                </>
              )}

              {dossier.modules.length > 0 && (
                <div className="chips" style={{ marginTop: 12 }}>
                  {dossier.modules.map((m) => (
                    <span key={m.id} className={`chip mod-${m.id}`}>
                      <Icoon naam={icoonVanModule(m.id)} grootte={12} /> {m.naam}
                    </span>
                  ))}
                </div>
              )}

              {/*
                Het gespreksdoel is het verschil tussen een lijstje en een voorbereiding.
                Niet wát er ontbreekt — dat staat erboven — maar wat je er in dit
                telefoontje mee doet, in de volgorde waarin je het zegt.
              */}
              <h3 className="blokkop" style={{ marginTop: 18 }}>Wat je wilt bereiken</h3>
              <ol className="uitleg">
                {dossier.gespreksdoel.map((z) => <li key={z}>{z}</li>)}
              </ol>

              <h3 className="blokkop" style={{ marginTop: 18 }}>Waarom deze taak er is</h3>
              <div className="regel">
                <span className="sleutel">
                  {dossier.taak.aanleiding}
                  <div className="mini">
                    Uitgezet door {dossier.taak.aangemaaktDoor} · ligt bij{' '}
                    {dossier.taak.voorNaam.replace(/^De /, 'de ')}
                    {dossier.taak.uiterlijkOp && ` · uiterlijk ${dossier.taak.uiterlijkOp}`}
                  </div>
                </span>
              </div>
              {dossier.laatsteContact && (
                <div className="reden" style={{ marginTop: 6 }}>
                  Laatste contact: {dossier.laatsteContact.datum} ·{' '}
                  {dossier.laatsteContact.soort} · {dossier.laatsteContact.wie}
                </div>
              )}

              {dossier.bereikbaarheid && (
                <>
                  <h3 className="blokkop" style={{ marginTop: 18 }}>Hoe je hem bereikt</h3>
                  <Bereikbaarheidskaart gegevens={dossier.bereikbaarheid} compact />
                </>
              )}
            </>
          )}
        </div>

        <footer className="paneel-voet">
          <div className="knop-rij">
            {dossier?.patientId && dossier.bereikbaarheid && dossier.taak.status !== 'afgerond' && (
              <button className="knop" data-toon="primair" onClick={() => setBellen(true)}>
                <Icoon naam="gesprek" grootte={14} /> Bellen en vastleggen
              </button>
            )}
            {dossier?.patientId && openPatient && (
              <button className="knop" onClick={() => { openPatient(dossier.patientId!); sluit(); }}>
                <Icoon naam="boek" grootte={14} /> Dossier openen
              </button>
            )}
            {dossier && dossier.taak.status !== 'afgerond' && (
              <button className="knop" data-toon="stil" disabled={bezig} onClick={rondAf}>
                <Icoon naam="vink" grootte={14} /> Afronden zonder contact
              </button>
            )}
          </div>
          {open.length > 0 && (
            <span className="mini">
              {open.length} {open.length === 1 ? 'onderdeel' : 'onderdelen'} nog niet binnen.
            </span>
          )}
        </footer>
      </aside>

      {bellen && dossier?.patientId && dossier.bereikbaarheid && (
        <Belvenster patientId={dossier.patientId} naam={dossier.naam}
          gegevens={dossier.bereikbaarheid}
          episodes={dossier.episodes.map((e) => ({ ...e, status: 'active' }))}
          gebruiker={gebruiker} taakId={dossier.taak.id}
          opSluit={() => setBellen(false)}
          opVastgelegd={(m) => { setMelding(m); haal(); setGewijzigd(true); }} />
      )}
    </>
  );
}
