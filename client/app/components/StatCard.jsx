'use client'
import { TrendingUp, TrendingDown } from 'lucide-react'

const PALETTES = {
  violet:  { bg: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(79,70,229,0.05))', border: 'rgba(124,58,237,0.18)', iconBg: 'rgba(124,58,237,0.1)', iconColor: '#7C3AED', val: '#7C3AED' },
  emerald: { bg: 'linear-gradient(135deg,rgba(5,150,105,0.08),rgba(8,145,178,0.05))',   border: 'rgba(5,150,105,0.18)',   iconBg: 'rgba(5,150,105,0.1)',   iconColor: '#059669',  val: '#059669' },
  amber:   { bg: 'linear-gradient(135deg,rgba(217,119,6,0.08),rgba(239,68,68,0.04))',   border: 'rgba(217,119,6,0.18)',   iconBg: 'rgba(217,119,6,0.1)',   iconColor: '#D97706',  val: '#D97706' },
  rose:    { bg: 'linear-gradient(135deg,rgba(225,29,72,0.08),rgba(217,119,6,0.04))',   border: 'rgba(225,29,72,0.18)',   iconBg: 'rgba(225,29,72,0.1)',   iconColor: '#E11D48',  val: '#E11D48' },
  cyan:    { bg: 'linear-gradient(135deg,rgba(8,145,178,0.08),rgba(5,150,105,0.04))',   border: 'rgba(8,145,178,0.18)',   iconBg: 'rgba(8,145,178,0.1)',   iconColor: '#0891B2',  val: '#0891B2' },
}

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'violet', trend, trendValue, delay = 0 }) {
  const p = PALETTES[color] || PALETTES.violet
  return (
    <div
      className="animate-fade-up"
      style={{
        background: p.bg, border: `1px solid ${p.border}`,
        borderRadius: 16, padding: '18px 20px',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        cursor: 'default', animationDelay: `${delay}ms`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 12px rgba(148,163,184,0.08)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${p.border}` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(148,163,184,0.08)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            {title}
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: p.val, lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>
            {value}
          </p>
          {subtitle && <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>{subtitle}</p>}
          {trendValue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 7 }}>
              {trend === 'up' ? <TrendingUp size={11} color="#059669" /> : <TrendingDown size={11} color="#E11D48" />}
              <span style={{ fontSize: 11, color: trend === 'up' ? '#059669' : '#E11D48', fontWeight: 600 }}>
                {trend === 'up' ? '+' : ''}{trendValue} vs last week
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div style={{ width: 40, height: 40, borderRadius: 12, background: p.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} color={p.iconColor} />
          </div>
        )}
      </div>
    </div>
  )
}
