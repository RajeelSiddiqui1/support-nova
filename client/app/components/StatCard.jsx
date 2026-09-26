'use client'
import { TrendingUp, TrendingDown } from 'lucide-react'

/* Dark-palette versions of all 5 stat card types */
const PALETTES = {
  terracotta: {
    bg:       'linear-gradient(135deg, rgba(201,111,74,0.12), rgba(201,111,74,0.05))',
    border:   'rgba(201,111,74,0.25)',
    iconBg:   'rgba(201,111,74,0.14)',
    iconColor: 'var(--nw-accent)',
    val:      'var(--nw-accent)',
  },
  gold: {
    bg:       'linear-gradient(135deg, rgba(201,162,39,0.12), rgba(201,162,39,0.05))',
    border:   'rgba(201,162,39,0.25)',
    iconBg:   'rgba(201,162,39,0.13)',
    iconColor: 'var(--nw-gold)',
    val:      'var(--nw-gold)',
  },
  teal: {
    bg:       'linear-gradient(135deg, rgba(79,166,137,0.12), rgba(79,166,137,0.05))',
    border:   'rgba(79,166,137,0.25)',
    iconBg:   'rgba(79,166,137,0.14)',
    iconColor: 'var(--nw-success)',
    val:      'var(--nw-success)',
  },
  crimson: {
    bg:       'linear-gradient(135deg, rgba(193,73,91,0.12), rgba(193,73,91,0.05))',
    border:   'rgba(193,73,91,0.25)',
    iconBg:   'rgba(193,73,91,0.14)',
    iconColor: 'var(--nw-danger)',
    val:      'var(--nw-danger)',
  },
  info: {
    bg:       'linear-gradient(135deg, rgba(74,155,201,0.12), rgba(74,155,201,0.05))',
    border:   'rgba(74,155,201,0.25)',
    iconBg:   'rgba(74,155,201,0.14)',
    iconColor: 'var(--nw-info)',
    val:      'var(--nw-info)',
  },
  /* Legacy aliases so existing pages that pass color='violet'/'emerald'/'amber'/'rose'/'cyan' still work */
  violet:  null,
  emerald: null,
  amber:   null,
  rose:    null,
  cyan:    null,
}
PALETTES.violet  = PALETTES.terracotta
PALETTES.emerald = PALETTES.teal
PALETTES.amber   = PALETTES.gold
PALETTES.rose    = PALETTES.crimson
PALETTES.cyan    = PALETTES.info

export default function StatCard({
  title, value, subtitle, icon: Icon,
  color = 'terracotta', trend, trendValue, delay = 0
}) {
  const p = PALETTES[color] || PALETTES.terracotta
  return (
    <div
      className="animate-fade-up"
      style={{
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: 16, padding: '18px 20px',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        cursor: 'default',
        animationDelay: `${delay}ms`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 12px rgba(11,14,20,0.25)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 28px ${p.border}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(11,14,20,0.25)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{
            fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8
          }}>
            {title}
          </p>
          <p style={{
            fontSize: 28, fontWeight: 800, color: p.val, lineHeight: 1,
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', marginTop: 5 }}>
              {subtitle}
            </p>
          )}
          {trendValue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 7 }}>
              {trend === 'up'
                ? <TrendingUp  size={11} color="var(--nw-success)" />
                : <TrendingDown size={11} color="var(--nw-danger)"  />
              }
              <span style={{
                fontSize: 11,
                color: trend === 'up' ? 'var(--nw-success)' : 'var(--nw-danger)',
                fontWeight: 600
              }}>
                {trend === 'up' ? '+' : ''}{trendValue} vs last week
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: p.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Icon size={18} color={p.iconColor} />
          </div>
        )}
      </div>
    </div>
  )
}
