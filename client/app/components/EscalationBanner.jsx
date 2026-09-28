'use client'

/**
 * EscalationBanner — shows when ticket.escalation_required is true
 * Props: ticket (object)
 */
export default function EscalationBanner({ ticket }) {
  if (!ticket?.escalation_required) return null

  const levelColor = {
    L1: '#E8B56B',
    L2: '#E8758A',
    L3: '#C1495B',
  }[ticket.escalation_level] || '#E8758A'

  return (
    <div style={{
      background: 'var(--nw-danger-dim)',
      border: '1.5px solid rgba(193,73,91,0.4)',
      borderRadius: 12,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: levelColor, marginBottom: 4 }}>
          ESCALATION REQUIRED — Level {ticket.escalation_level || 'L1'}
        </div>
        {ticket.escalation_notes && (
          <div style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.5 }}>
            {ticket.escalation_notes}
          </div>
        )}
      </div>
    </div>
  )
}
