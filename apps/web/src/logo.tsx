/**
 * Het merkteken van Cadans.
 *
 * Vier stippen op een boog, met oplopende tussenruimte. Dat is letterlijk waar de naam
 * over gaat: een ritme dat niet vast staat maar zich voegt naar de mens. De laatste stip
 * is open — het beloop is niet af.
 *
 * Eén vorm, leesbaar vanaf 18 pixels, en hij werkt in één kleur.
 */
export function Logo({ grootte = 26, kleur = 'currentColor' }: { grootte?: number; kleur?: string }) {
  return (
    <svg width={grootte} height={grootte} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* De boog: het protocol als vertrekpunt. */}
      <path
        d="M26.5 8.2A12.5 12.5 0 1 0 26.5 23.8"
        stroke={kleur} strokeWidth="2.4" strokeLinecap="round" opacity=".28"
      />
      {/* Vier momenten, met oplopende afstand: het interval past zich aan. */}
      <circle cx="16" cy="3.6" r="2.5" fill={kleur} />
      <circle cx="5.9" cy="10.4" r="2.2" fill={kleur} opacity=".82" />
      <circle cx="4.4" cy="22.6" r="1.9" fill={kleur} opacity=".6" />
      <circle cx="14.2" cy="28.2" r="2.6" fill="none" stroke={kleur} strokeWidth="2.1" />
    </svg>
  );
}

/** Naam plus merkteken, voor koppen en het aanmeldscherm. */
export function Woordmerk({ grootte = 26, subtitel }: { grootte?: number; subtitel?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Logo grootte={grootte} />
      <span>
        <strong style={{
          fontSize: grootte * 0.72, fontWeight: 650, letterSpacing: '-.02em', display: 'block', lineHeight: 1.1,
        }}>
          Cadans
        </strong>
        {subtitel && (
          <small style={{ fontSize: 11, opacity: .72, fontWeight: 400, display: 'block' }}>{subtitel}</small>
        )}
      </span>
    </span>
  );
}
