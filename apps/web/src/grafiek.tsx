import { useId, useState } from 'react';

/**
 * Beloop van één meetwaarde in de tijd.
 *
 * Eén reeks, dus geen legenda: de titel noemt waar het over gaat. De streefwaarde ligt
 * er als stippellijn onder, want een getal zonder norm zegt niets — dat is precies wat
 * een kolom cijfers in een dossier zo onbruikbaar maakt.
 *
 * Bewust géén tweede y-as en geen tweede reeks: twee grootheden met verschillende schaal
 * horen in twee grafieken.
 */
export interface Punt { op: string; waarde: number }

export function Trendgrafiek({ punten, eenheid, streef, kleur = 'var(--merk)', hoogte = 190 }: {
  punten: Punt[];
  eenheid?: string;
  streef?: { onder?: number; boven?: number; label: string };
  kleur?: string;
  hoogte?: number;
}) {
  const id = useId();
  const [actief, setActief] = useState<number | undefined>();

  if (punten.length < 2) {
    return <div className="leeg">Te weinig metingen voor een beloop.</div>;
  }

  const B = 640;
  const H = hoogte;
  const marge = { boven: 16, rechts: 14, onder: 30, links: 46 };
  const breedte = B - marge.links - marge.rechts;
  const binnen = H - marge.boven - marge.onder;

  const waarden = punten.map((p) => p.waarde);
  const grenzen = [
    ...waarden,
    ...(streef?.boven !== undefined ? [streef.boven] : []),
    ...(streef?.onder !== undefined ? [streef.onder] : []),
  ];
  const ruwMin = Math.min(...grenzen);
  const ruwMax = Math.max(...grenzen);
  const marge2 = Math.max((ruwMax - ruwMin) * 0.15, Math.abs(ruwMax) * 0.05, 0.5);
  const min = ruwMin - marge2;
  const max = ruwMax + marge2;

  const tijden = punten.map((p) => new Date(p.op).getTime());
  const t0 = tijden[0];
  const t1 = tijden.at(-1)!;
  const spanne = Math.max(t1 - t0, 1);

  const x = (t: number) => marge.links + ((t - t0) / spanne) * breedte;
  const y = (w: number) => marge.boven + (1 - (w - min) / (max - min)) * binnen;

  const lijn = punten.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(tijden[i]).toFixed(1)} ${y(p.waarde).toFixed(1)}`).join(' ');
  const vlak = `${lijn} L ${x(t1).toFixed(1)} ${(marge.boven + binnen).toFixed(1)} L ${x(t0).toFixed(1)} ${(marge.boven + binnen).toFixed(1)} Z`;

  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];
  const decimalen = max - min < 12 ? 1 : 0;
  const datum = (ms: number) =>
    new Date(ms).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });

  const dichtstbij = (verhouding: number) => {
    const doel = t0 + verhouding * spanne;
    let beste = 0;
    for (let i = 1; i < tijden.length; i++) {
      if (Math.abs(tijden[i] - doel) < Math.abs(tijden[beste] - doel)) beste = i;
    }
    return beste;
  };

  const getoond = actief ?? punten.length - 1;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${B} ${H}`} width="100%" height={H} role="img"
        style={{ display: 'block', touchAction: 'none' }}
        onMouseLeave={() => setActief(undefined)}
        onMouseMove={(e) => {
          const doos = e.currentTarget.getBoundingClientRect();
          const verhouding = ((e.clientX - doos.left) / doos.width * B - marge.links) / breedte;
          setActief(dichtstbij(Math.min(1, Math.max(0, verhouding))));
        }}>
        <defs>
          <linearGradient id={`vul-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={kleur} stopOpacity=".16" />
            <stop offset="100%" stopColor={kleur} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Terughoudend raster: oriëntatie, geen decoratie. */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={marge.links} x2={B - marge.rechts} y1={y(t)} y2={y(t)}
              stroke="var(--line-zacht)" strokeWidth="1" />
            <text x={marge.links - 8} y={y(t) + 4} textAnchor="end"
              fill="var(--ink-3)" fontSize="11" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t.toFixed(decimalen)}
            </text>
          </g>
        ))}

        {streef?.boven !== undefined && streef.boven > min && streef.boven < max && (
          <g>
            <line x1={marge.links} x2={B - marge.rechts} y1={y(streef.boven)} y2={y(streef.boven)}
              stroke="var(--ok)" strokeWidth="1.5" strokeDasharray="5 4" opacity=".7" />
            <text x={B - marge.rechts} y={y(streef.boven) - 6} textAnchor="end"
              fill="var(--ok)" fontSize="10.5">{streef.label}</text>
          </g>
        )}
        {streef?.onder !== undefined && streef.onder > min && streef.onder < max && (
          <g>
            <line x1={marge.links} x2={B - marge.rechts} y1={y(streef.onder)} y2={y(streef.onder)}
              stroke="var(--aandacht)" strokeWidth="1.5" strokeDasharray="5 4" opacity=".7" />
            <text x={B - marge.rechts} y={y(streef.onder) - 6} textAnchor="end"
              fill="var(--aandacht)" fontSize="10.5">{streef.label}</text>
          </g>
        )}

        <path d={vlak} fill={`url(#vul-${id})`} />
        <path d={lijn} fill="none" stroke={kleur} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />

        {punten.map((p, i) => (
          <circle key={p.op + i} cx={x(tijden[i])} cy={y(p.waarde)} r={i === getoond ? 5 : 3}
            fill={i === getoond ? kleur : 'var(--vlak)'} stroke={kleur} strokeWidth="2" />
        ))}

        {actief !== undefined && (
          <line x1={x(tijden[actief])} x2={x(tijden[actief])} y1={marge.boven} y2={marge.boven + binnen}
            stroke={kleur} strokeWidth="1" opacity=".3" />
        )}

        <text x={marge.links} y={H - 9} fill="var(--ink-3)" fontSize="11">{datum(t0)}</text>
        <text x={B - marge.rechts} y={H - 9} textAnchor="end" fill="var(--ink-3)" fontSize="11">
          {datum(t1)}
        </text>
      </svg>

      <figcaption style={{
        display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 4,
        fontSize: 12.5, color: 'var(--ink-2)',
      }}>
        <strong style={{ fontSize: 15, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          {punten[getoond].waarde}{eenheid ? ` ${eenheid}` : ''}
        </strong>
        <span>
          op {new Date(punten[getoond].op).toLocaleDateString('nl-NL', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </span>
        <span className="mini" style={{ marginLeft: 'auto' }}>
          {punten.length} metingen · beweeg over de grafiek
        </span>
      </figcaption>
    </figure>
  );
}
