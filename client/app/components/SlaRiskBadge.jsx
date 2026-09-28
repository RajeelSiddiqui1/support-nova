'use client'

/**
 * SlaRiskBadge — small badge showing SLA risk level
 * Props: risk ('CRITICAL'|'HIGH'|'MEDIUM'|'LOW'), size ('sm'|'md')
 */
export default function SlaRiskBadge({ risk, size = 'sm' }) {
  if (!risk || risk === 'LOW' || risk === 'SAFE') return null

  const styles = {
    CRITICAL: { bg: 'var(--nw-danger-dim)', c: '#E8758A', border: 'rgba(193,73,91,0.35)', label: 'SLA CRITICAL' },
    HIGH:     { bg: 'var(--nw-warning-dim)', c: '#E8B56B', border: 'rgba(217,164,65,0.35)', label: 'SLA AT RISK' },
    MEDIUM:   { bg: 'var(--nw-info-dim)', c: '#72B4D8', border: 'rgba(74,155,201,0.25)', label: 'SLA MEDIUM' },
  }
  const s = styles[risk] || styles.MEDIUM
  const fontSize = size === 'sm' ? 9.5 : 11

  return (
    <span style={{
      fontSize,
      fontWeight: 800,
      padding: size === 'sm' ? '1px 7px' : '3px 10px',
      borderRadius: 5,
      background: s.bg,
      color: s.c,
      border: `1px solid ${s.border}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      letterSpacing: '0.03em',
    }}>
      ⏱ {s.label}
    </span>
  )
}
