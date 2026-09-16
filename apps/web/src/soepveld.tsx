import { useEffect, useRef, useState } from 'react';
import { Icoon } from './iconen';

/**
 * Afkortingen die een zin afmaken.
 *
 * Een huisarts of POH typt de hele dag dezelfde twintig zinnen. Dat is geen gebrek aan
 * taalgevoel maar efficiëntie: "controle over drie maanden" betekent precies wat het
 * zegt en hoeft niet elke keer opnieuw bedacht te worden. Een systeem dat dat weet,
 * scheelt per consult een halve minuut — en dat is per dag een consult.
 *
 * Bewust géén vrije autocompletie op alles wat je typt: dan begin je te schrijven wat het
 * systeem voorstelt in plaats van wat je bedoelt. Alleen expliciete afkortingen, alleen
 * aan het begin van een woord, en je kiest zelf of je hem neemt.
 */
export const AFKORTINGEN: { kort: string; volledig: string; letters?: string[] }[] = [
  { kort: 'con', volledig: 'Controle over 3 maanden', letters: ['P'] },
  { kort: 'con6', volledig: 'Controle over 6 weken', letters: ['P'] },
  { kort: 'conj', volledig: 'Jaarcontrole ingepland', letters: ['P'] },
  { kort: 'gb', volledig: 'Geen bijzonderheden' },
  { kort: 'lo', volledig: 'Lichamelijk onderzoek: ', letters: ['O'] },
  { kort: 'gafw', volledig: 'Geen afwijkingen bij onderzoek', letters: ['O'] },
  { kort: 'rr', volledig: 'Bloeddruk gemeten: ', letters: ['O'] },
  { kort: 'uitl', volledig: 'Uitleg gegeven, informatie meegegeven via het portaal', letters: ['P'] },
  { kort: 'zn', volledig: 'Zo nodig contact opnemen bij verergering', letters: ['P'] },
  { kort: 'med', volledig: 'Medicatie ongewijzigd voortgezet', letters: ['P', 'E'] },
  { kort: 'lab', volledig: 'Lab aangevraagd, uitslag bespreken bij de controle', letters: ['P'] },
  { kort: 'lst', volledig: 'Leefstijl besproken: voeding, bewegen en roken', letters: ['P'] },
  { kort: 'smr', volledig: 'Stoppen met roken besproken, patiënt is gemotiveerd', letters: ['P'] },
  { kort: 'ovl', volledig: 'In overleg met de huisarts', letters: ['P', 'E'] },
  { kort: 'vw', volledig: 'Verwijzing gemaakt naar ', letters: ['P'] },
  { kort: 'thm', volledig: 'Thuismeetreeks van 7 dagen afgesproken', letters: ['P'] },
  { kort: 'tel', volledig: 'Telefonisch contact gehad met de patiënt', letters: ['S'] },
  { kort: 'stab', volledig: 'Stabiel beeld, streefwaarden gehaald', letters: ['E'] },
  { kort: 'ther', volledig: 'Therapietrouw lijkt goed', letters: ['E', 'S'] },
  { kort: 'ntr', volledig: 'Behandelgrenzen besproken en vastgelegd', letters: ['P'] },
];

/** Herkenning is per browser anders beschikbaar; dit is de veilige vorm. */
type Herkenner = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function maakHerkenner(): Herkenner | undefined {
  const venster = window as unknown as {
    SpeechRecognition?: new () => Herkenner;
    webkitSpeechRecognition?: new () => Herkenner;
  };
  const Klasse = venster.SpeechRecognition ?? venster.webkitSpeechRecognition;
  if (!Klasse) return undefined;
  const herkenner = new Klasse();
  herkenner.lang = 'nl-NL';
  herkenner.continuous = true;
  herkenner.interimResults = false;
  return herkenner;
}

/**
 * Eén SOEP-veld: typen, afkorten of inspreken.
 *
 * Dicteren is in de spreekkamer geen luxe maar de enige manier om tijdens het gesprek te
 * registreren in plaats van erna. Wat hier draait is de spraakherkenning van de browser
 * zelf — genoeg om het werkproces te laten zien, niet genoeg voor de spreekkamer. Een
 * medische dicteeroplossing herkent vaktermen, medicatienamen en getallen, en verwerkt
 * de spraak binnen de eigen omgeving; dat laatste is een AVG-eis en geen detail.
 */
export function Soepveld({ letter, uitleg, waarde, opWijzig }: {
  letter: 'S' | 'O' | 'E' | 'P';
  uitleg: string;
  waarde: string;
  opWijzig: (nieuw: string) => void;
}) {
  const veld = useRef<HTMLTextAreaElement>(null);
  const herkenner = useRef<Herkenner | undefined>(undefined);
  const [luistert, setLuistert] = useState(false);
  const [suggesties, setSuggesties] = useState<typeof AFKORTINGEN>([]);
  const kanSpraak = typeof window !== 'undefined'
    && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => () => { herkenner.current?.stop(); }, []);

  /** Het woord waar de cursor in staat; alleen dat woord wordt als afkorting gelezen. */
  const huidigWoord = (tekst: string, positie: number) => {
    const voor = tekst.slice(0, positie);
    const grens = Math.max(voor.lastIndexOf(' '), voor.lastIndexOf('\n'));
    return { woord: voor.slice(grens + 1), begin: grens + 1 };
  };

  const bijTypen = (tekst: string, positie: number) => {
    opWijzig(tekst);
    const { woord } = huidigWoord(tekst, positie);
    if (woord.length < 2) { setSuggesties([]); return; }
    const treffers = AFKORTINGEN.filter((a) =>
      a.kort.startsWith(woord.toLowerCase())
      && (!a.letters || a.letters.includes(letter)));
    setSuggesties(treffers.slice(0, 4));
  };

  const neemOver = (volledig: string) => {
    const element = veld.current;
    const positie = element?.selectionStart ?? waarde.length;
    const { begin } = huidigWoord(waarde, positie);
    const nieuw = waarde.slice(0, begin) + volledig + waarde.slice(positie);
    opWijzig(nieuw);
    setSuggesties([]);
    requestAnimationFrame(() => {
      element?.focus();
      const eind = begin + volledig.length;
      element?.setSelectionRange(eind, eind);
    });
  };

  const schakelSpraak = () => {
    if (luistert) { herkenner.current?.stop(); setLuistert(false); return; }
    const nieuw = maakHerkenner();
    if (!nieuw) return;
    herkenner.current = nieuw;
    nieuw.onresult = (e) => {
      const laatste = e.results[e.results.length - 1];
      const tekst = laatste?.[0]?.transcript?.trim();
      if (tekst) opWijzig([waarde, tekst].filter(Boolean).join(' '));
    };
    nieuw.onerror = () => setLuistert(false);
    nieuw.onend = () => setLuistert(false);
    nieuw.start();
    setLuistert(true);
  };

  return (
    <div className="soepveld">
      <span className="soepletter" data-letter={letter}>{letter}</span>
      <div className="invoer">
        <textarea ref={veld} rows={waarde.length > 120 ? 4 : 1} placeholder={uitleg} value={waarde}
          onChange={(e) => bijTypen(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && suggesties.length > 0) {
              e.preventDefault();
              neemOver(suggesties[0].volledig);
            }
            if (e.key === 'Escape') setSuggesties([]);
          }}
          onBlur={() => setTimeout(() => setSuggesties([]), 150)} />

        {suggesties.length > 0 && (
          <div className="afkortingen">
            <span className="mini">bedoel je</span>
            {suggesties.map((a, i) => (
              <button key={a.kort} className="filterchip" onMouseDown={(e) => e.preventDefault()}
                onClick={() => neemOver(a.volledig)}>
                <strong>{a.kort}</strong> {a.volledig}
                {i === 0 && <span className="mini"> · Tab</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="dicteerknop" data-aan={luistert} onClick={schakelSpraak}
        disabled={!kanSpraak}
        title={kanSpraak
          ? (luistert ? 'Stop met dicteren' : 'Dicteren in dit veld')
          : 'Deze browser heeft geen spraakherkenning. In productie hoort hier een medische dicteeroplossing.'}>
        <Icoon naam="microfoon" grootte={14} />
      </button>
    </div>
  );
}
