'use client'

/**
 * VerificationScore — GenAI vs Python confidence gauge
 * SVG arc gauge (180° sweep) with color-coded needle + match/mismatch label
 *
 * Props:
 *   matchStatus      (boolean)  — whether GenAI and Python outputs agree
 *   confidenceScore  (number)   — 0–100 confidence value (derived from match_status if not provided)
 *   size             (number)   — gauge width in px (default 120)
 */
export default function VerificationScore({ matchStatus, confidenceScore, size = 120 }) {
  // Derive score if not explicitly provided
  const score = confidenceScore != null
    ? Math.max(0, Math.min(100, confidenceScore))
    : matchStatus ? 87 : 38

  // Color zones
  const color = score >= 80 ? 'var(--nw-success)'
              : score >= 60 ? 'var(--nw-warning)'
              : 'var(--nw-danger)'
  const dimColor = score >= 80 ? 'var(--nw-success-dim)'
                 : score >= 60 ? 'var(--nw-warning-dim)'
                 : 'var(--nw-danger-dim)'

  const cx = size / 2
  const cy = size * 0.62
  const r  = size * 0.38

  // Arc from 180° to 0° (left to right), sweep based on score
  const startAngle = Math.PI       // 180°
  const endAngle   = 0             // 0°
  const sweepAngle = startAngle - endAngle  // π radians = full semicircle
  const fillAngle  = startAngle - (sweepAngle * score / 100)

  const arcX  = (a) => cx + r * Math.cos(a)
  const arcY  = (a) => cy + r * Math.sin(a)

  // Background arc path (full 180°)
  const bgPath = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 0 1 ${arcX(endAngle)} ${arcY(endAngle)}`

  // Foreground arc path (score-based fill)
  const fgLargeArc = (startAngle - fillAngle) > Math.PI ? 1 : 0
  const fgPath = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 ${fgLargeArc} 1 ${arcX(fillAngle)} ${arcY(fillAngle)}`

  // Needle tip position
  const needleAngle = fillAngle
  const needleTipX  = arcX(needleAngle)
  const needleTipY  = arcY(needleAngle)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg
        width={size}
        height={size * 0.72}
        viewBox={`0 0 ${size} ${cy + 8}`}
        style={{ overflow: 'visible' }}
      >
        {/* Zone markers (inner arcs for green/yellow/red zones) */}
        {/* Red zone: 0–60 */}
        <path
          d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 0 1 ${arcX(startAngle - sweepAngle * 0.6)} ${arcY(startAngle - sweepAngle * 0.6)}`}
          fill="none" stroke="rgba(193,73,91,0.18)" strokeWidth={size * 0.085} strokeLinecap="butt"
        />
        {/* Yellow zone: 60–80 */}
        <path
          d={`M ${arcX(startAngle - sweepAngle * 0.6)} ${arcY(startAngle - sweepAngle * 0.6)} A ${r} ${r} 0 0 1 ${arcX(startAngle - sweepAngle * 0.8)} ${arcY(startAngle - sweepAngle * 0.8)}`}
          fill="none" stroke="rgba(217,164,65,0.2)" strokeWidth={size * 0.085} strokeLinecap="butt"
        />
        {/* Green zone: 80–100 */}
        <path
          d={`M ${arcX(startAngle - sweepAngle * 0.8)} ${arcY(startAngle - sweepAngle * 0.8)} A ${r} ${r} 0 0 1 ${arcX(endAngle)} ${arcY(endAngle)}`}
          fill="none" stroke="rgba(79,166,137,0.2)" strokeWidth={size * 0.085} strokeLinecap="butt"
        />

        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={size * 0.06}
          strokeLinecap="round"
        />

        {/* Filled score arc */}
        {score > 0 && (
          <path
            d={fgPath}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.06}
            strokeLinecap="round"
            opacity={0.9}
          />
        )}

        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={needleTipX} y2={needleTipY}
          stroke={color} strokeWidth={size * 0.025}
          strokeLinecap="round" opacity={0.85}
        />

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={size * 0.055} fill="var(--nw-elevated)" stroke={color} strokeWidth={size * 0.025} />

        {/* Score text */}
        <text
          x={cx} y={cy - r * 0.35}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="800"
          fontFamily="JetBrains Mono, monospace"
        >
          {score}
        </text>
        <text
          x={cx} y={cy - r * 0.1}
          textAnchor="middle"
          fill="var(--nw-text-muted)"
          fontSize={size * 0.1}
          fontFamily="Inter, system-ui, sans-serif"
        >
          / 100
        </text>
      </svg>

      {/* Status label */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: dimColor,
        border: `1px solid ${color}40`,
        borderRadius: 99, padding: '4px 12px',
      }}>
        <span style={{ fontSize: 13 }}>{matchStatus ? '✓' : '⚠'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>
          {matchStatus ? 'Verified Match' : 'Mismatch Detected'}
        </span>
      </div>

      {/* Zone legend */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: '≥80 Verified',  color: 'var(--nw-success)' },
          { label: '60–79 Review',  color: 'var(--nw-warning)' },
          { label: '<60 Mismatch',  color: 'var(--nw-danger)'  },
        ].map(z => (
          <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: z.color }} />
            <span style={{ fontSize: 9, color: 'var(--nw-text-muted)' }}>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
