import { useState } from 'react';
import { api, type Gebruiker } from '../api';
import { Icoon } from '../iconen';
import { Logo } from '../logo';

const DEMO = [
  { gebruikersnaam: 'sanne', naam: 'Sanne Bakker', functie: 'POH-Somatiek' },
  { gebruikersnaam: 'ilse', naam: 'Ilse Hendriks', functie: 'Doktersassistent' },
  { gebruikersnaam: 'daan', naam: 'Daan Verhoeven', functie: 'Huisarts' },
  { gebruikersnaam: 'mirjam', naam: 'Mirjam de Groot', functie: 'Praktijkmanager' },
];

/**
 * Aanmelden met gebruikersnaam, wachtwoord en een tweede factor.
 *
 * ⚠️ Demo. De wachtwoorden staan in de broncode en de code is vast. Het toont de
 * inrichting — welke rollen bestaan, wat elke rol te zien krijgt — niet de beveiliging.
 * In productie loopt dit via UZI-pas of een gecertificeerde IdP met MFA (docs/07 §2).
 */
export function Inloggen({ opAangemeld }: { opAangemeld: (gebruiker: Gebruiker) => void }) {
  const [stap, setStap] = useState<'gegevens' | 'tweefactor'>('gegevens');
  const [gebruikersnaam, setGebruikersnaam] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [code, setCode] = useState('');
  const [gebruiker, setGebruiker] = useState<Gebruiker | undefined>();
  const [fout, setFout] = useState<string | undefined>();
  const [bezig, setBezig] = useState(false);

  const stuurGegevens = async (e: React.FormEvent) => {
    e.preventDefault();
    setBezig(true); setFout(undefined);
    try {
      const uitkomst = await api.aanmelden(gebruikersnaam, wachtwoord);
      setGebruiker(uitkomst.gebruiker);
      setStap('tweefactor');
      setCode('');
    } catch (err) {
      setFout((err as Error).message.includes('401')
        ? 'Gebruikersnaam of wachtwoord klopt niet.'
        : (err as Error).message);
    } finally { setBezig(false); }
  };

  const stuurCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBezig(true); setFout(undefined);
    try {
      await api.tweefactor(code);
      if (gebruiker) opAangemeld(gebruiker);
    } catch {
      setFout('De code klopt niet. Probeer het opnieuw.');
    } finally { setBezig(false); }
  };

  const vulIn = (naam: string) => {
    setGebruikersnaam(naam);
    setWachtwoord('cadans');
    setFout(undefined);
  };

  return (
    <div className="aanmelden">
      <section className="merkpaneel">
        <div className="ritme"><Logo grootte={420} kleur="#ffffff" /></div>
        <div>
          <Logo grootte={44} kleur="#ffffff" />
          <h1>Cadans</h1>
          <p>
            Eén dossier voor het hele team, met één geïntegreerd protocol in plaats van een
            zorgprogramma per aandoening. Het ritme van de zorg volgt de mens — zijn toestand
            én zijn zelfredzaamheid — niet het ziektelabel.
          </p>
          <div className="punt">
            <Icoon naam="doel" grootte={15} />
            <span>Acht aandachtsgebieden in plaats van losse zorgpaden</span>
          </div>
          <div className="punt">
            <Icoon naam="bliksem" grootte={15} />
            <span>Logistiek werk draait automatisch, klinische beslissingen blijven bij jou</span>
          </div>
          <div className="punt">
            <Icoon naam="boek" grootte={15} />
            <span>Elk advies wijst naar de richtlijn waarop het berust</span>
          </div>
        </div>
        <div className="voetnoot">
          Demo-omgeving met 48 synthetische patiënten. Geen echte zorggegevens.<br />
          De aanmelding is nagebootst; in productie loopt dit via UZI of een gecertificeerde
          identity provider.
        </div>
      </section>

      <section className="formulier">
        <div className="binnen">
          {stap === 'gegevens' ? (
            <form onSubmit={stuurGegevens}>
              <h2>Aanmelden</h2>
              <div className="onder">Huisartsenpraktijk De Linde</div>

              {fout && <div className="melding">{fout}</div>}

              <div className="veldrij">
                <label className="veld" htmlFor="gebruikersnaam">Gebruikersnaam</label>
                <input id="gebruikersnaam" type="text" autoComplete="username" autoFocus
                  value={gebruikersnaam} onChange={(e) => setGebruikersnaam(e.target.value)} />
              </div>
              <div className="veldrij">
                <label className="veld" htmlFor="wachtwoord">Wachtwoord</label>
                <input id="wachtwoord" type="password" autoComplete="current-password"
                  value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} />
              </div>

              <button className="knop" data-toon="primair" type="submit" disabled={bezig}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                {bezig ? 'Bezig…' : 'Volgende'} <Icoon naam="pijl" grootte={14} />
              </button>

              <div className="demo">
                <strong>Demo-accounts</strong> — wachtwoord voor alle vier: <code>cadans</code>
                <table>
                  <tbody>
                    {DEMO.map((d) => (
                      <tr key={d.gebruikersnaam}>
                        <td style={{ width: 90 }}><button type="button" onClick={() => vulIn(d.gebruikersnaam)}>{d.gebruikersnaam}</button></td>
                        <td>{d.naam}</td>
                        <td style={{ color: 'var(--ink-3)' }}>{d.functie}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </form>
          ) : (
            <form onSubmit={stuurCode}>
              <h2>Verificatiecode</h2>
              <div className="onder">
                Welkom {gebruiker?.naam.split(' ')[0]}. Voer de zescijferige code in
                van je authenticator.
              </div>

              {fout && <div className="melding">{fout}</div>}

              <div className="veldrij">
                <label className="veld" htmlFor="code">Code</label>
                <input id="code" className="code-invoer" type="text" inputMode="numeric"
                  maxLength={6} autoFocus autoComplete="one-time-code"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </div>

              <button className="knop" data-toon="primair" type="submit"
                disabled={bezig || code.length < 6}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                {bezig ? 'Bezig…' : 'Aanmelden'} <Icoon naam="vink" grootte={14} />
              </button>

              <button className="knop" data-toon="stil" type="button"
                style={{ marginTop: 10 }} onClick={() => { setStap('gegevens'); setFout(undefined); }}>
                Terug
              </button>

              <div className="demo">
                <strong>Demo</strong> — de code is <code>123456</code>.
                <div style={{ marginTop: 6 }}>
                  <button type="button" onClick={() => setCode('123456')}>Code invullen</button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
