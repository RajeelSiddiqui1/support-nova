'use client'

/**
 * NovaWear Apparel — Logo Component
 * Concept A: Stitched N Monogram with circuit-spark tip
 *
 * Props:
 *   size     (number)           — icon container size in px. Default: 32
 *   variant  ('icon' | 'full')  — 'icon': glyph only; 'full': glyph + wordmark
 *   className (string)          — optional extra class
 */
export default function Logo({ size = 32, variant = 'icon', className = '' }) {
  const scale = size / 40          // design is based on 40×40 artboard
  const wordmarkGap = Math.round(size * 0.35)

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: wordmarkGap,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* ── Icon Container ─────────────────────────────────── */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          background: 'linear-gradient(145deg, #1D2230 0%, #151922 100%)',
          border: '1px solid rgba(201,111,74,0.3)',
          boxShadow: `0 0 ${Math.round(size * 0.45)}px rgba(201,111,74,0.18), 0 ${Math.round(size * 0.1)}px ${Math.round(size * 0.5)}px rgba(11,14,20,0.4)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.66)}
          viewBox="0 0 25 27"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="nw-n-grad" x1="0" y1="0" x2="25" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C9A227" />
              <stop offset="100%" stopColor="#C96F4A" />
            </linearGradient>
          </defs>

          {/* Left vertical bar */}
          <rect x="0" y="0" width="4.5" height="27" rx="1.5" fill="url(#nw-n-grad)" />

          {/* Right vertical bar */}
          <rect x="20.5" y="0" width="4.5" height="27" rx="1.5" fill="url(#nw-n-grad)" />

          {/* Stitched diagonal stroke (the thread) */}
          <line
            x1="4.5"
            y1="1"
            x2="20.5"
            y2="26"
            stroke="url(#nw-n-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="4.2 2.8"
            opacity="0.95"
          />

          {/* Circuit spark at bottom-right tip */}
          <polyline
            points="21,24 24.5,26.5 24.5,22"
            stroke="#C96F4A"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.85"
          />
          <circle cx="24.5" cy="26.5" r="1.1" fill="#C9A227" opacity="0.9" />
        </svg>
      </div>

      {/* ── Wordmark (only in 'full' variant) ──────────────── */}
      {variant === 'full' && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              fontSize: Math.round(size * 0.38),
              fontWeight: 800,
              color: 'var(--nw-text-primary)',
              letterSpacing: '-0.4px',
              lineHeight: 1.15,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            NovaWear
          </div>
          <div
            style={{
              fontSize: Math.round(size * 0.22),
              fontWeight: 500,
              color: 'var(--nw-text-muted)',
              letterSpacing: '0.06em',
              lineHeight: 1,
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
            }}
          >
            Apparel AI
          </div>
        </div>
      )}
    </div>
  )
}
