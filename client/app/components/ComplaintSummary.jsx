'use client'
import { FileText, Zap, User, Tag, Clock, AlertTriangle, ShieldCheck } from 'lucide-react'

/**
 * ComplaintSummary — Complaint summary card
 *
 * Props:
 *   ticket   — full ticket object
 *   variant  — 'customer' | 'agent'  (agent shows more technical fields)
 */
export default function ComplaintSummary({ ticket, variant = 'customer' }) {
  if (!ticket) return null

  const STATUS_PILL = {
    'In Triage':   { bg: 'var(--nw-warning-dim)',  border: 'rgba(217,164,65,0.3)',  color: 'var(--nw-warning)' },
    'In Progress': { bg: 'var(--nw-info-dim)',      border: 'rgba(74,155,201,0.3)',  color: 'var(--nw-info)'    },
    'Escalated':   { bg: 'var(--nw-danger-dim)',    border: 'rgba(193,73,91,0.3)',   color: 'var(--nw-danger)'  },
    'AI Review':   { bg: 'var(--nw-accent-dim)',    border: 'rgba(201,111,74,0.3)',  color: 'var(--nw-accent)'  },
    'Resolved':    { bg: 'var(--nw-success-dim)',   border: 'rgba(79,166,137,0.3)',  color: 'var(--nw-success)' },
    'Closed':      { bg: 'rgba(154,156,165,0.1)',   border: 'var(--nw-border)',      color: 'var(--nw-text-muted)' },
  }

  const P_PILL = {
    P0: { bg: 'var(--nw-danger-dim)',  color: '#E8758A' },
    P1: { bg: 'var(--nw-warning-dim)', color: '#E8B56B' },
    P2: { bg: 'var(--nw-info-dim)',    color: '#72B4D8' },
    P3: { bg: 'rgba(154,156,165,0.1)', color: 'var(--nw-text-muted)' },
  }

  const SENTIMENT_PILL = {
    positive: { emoji: '😊', color: 'var(--nw-success)', bg: 'var(--nw-success-dim)' },
    neutral:  { emoji: '😐', color: 'var(--nw-text-muted)', bg: 'rgba(154,156,165,0.1)' },
    negative: { emoji: '😠', color: 'var(--nw-warning)', bg: 'var(--nw-warning-dim)' },
    urgent:   { emoji: '🚨', color: 'var(--nw-danger)',  bg: 'var(--nw-danger-dim)'  },
  }

  const st  = STATUS_PILL[ticket.status] || STATUS_PILL['Closed']
  const pp  = P_PILL[ticket.priority] || P_PILL.P3
  const sen = SENTIMENT_PILL[(ticket.genai_output?.sentiment || 'neutral').toLowerCase()] || SENTIMENT_PILL.neutral

  const createdDate = ticket.created_at
    ? new Date(ticket.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const pill = (label, style) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
      border: `1px solid ${style.border || style.bg}`,
      ...style,
    }}>
      {label}
    </span>
  )

  return (
    <div style={{
      background: 'var(--nw-surface)',
      border: '1px solid var(--nw-border-strong)',
      borderRadius: 14, padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'var(--nw-accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={15} color="var(--nw-accent)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--nw-text-primary)', lineHeight: 1.35 }}>
            {ticket.title || 'Complaint'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', marginTop: 2 }}>
            {ticket.ticket_id} · {createdDate}
          </p>
        </div>
      </div>

      {/* Pills row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {pill(ticket.status, { background: st.bg, color: st.color, border: st.border })}
        {pill(ticket.priority, { background: pp.bg, color: pp.color })}
        {ticket.category && pill(ticket.category, { background: 'var(--nw-elevated)', color: 'var(--nw-text-secondary)', border: 'var(--nw-border-strong)' })}
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
          background: sen.bg, color: sen.color, border: `1px solid ${sen.bg}`,
        }}>
          {sen.emoji} {(ticket.genai_output?.sentiment || 'Neutral')}
        </span>
      </div>

      {/* Description preview */}
      {ticket.description && (
        <p style={{
          fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.6,
          marginBottom: 12,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {ticket.description}
        </p>
      )}

      {/* Customer variant: ETA/channel */}
      {variant === 'customer' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <User size={11} color="var(--nw-text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--nw-text-muted)' }}>
              {ticket.channel || 'Webform'}
            </span>
          </div>
          {ticket.department && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Tag size={11} color="var(--nw-text-muted)" />
              <span style={{ fontSize: 11, color: 'var(--nw-text-muted)' }}>{ticket.department}</span>
            </div>
          )}
          {ticket.sla_hours_remaining != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={11} color={ticket.sla_breach ? 'var(--nw-danger)' : 'var(--nw-text-muted)'} />
              <span style={{
                fontSize: 11,
                color: ticket.sla_breach ? 'var(--nw-danger)' : 'var(--nw-text-muted)'
              }}>
                {ticket.sla_breach ? 'SLA Breached' : `${ticket.sla_hours_remaining}h remaining`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Agent/Admin variant: AI pipeline details */}
      {variant === 'agent' && (
        <div style={{
          marginTop: 4, borderTop: '1px solid var(--nw-border)', paddingTop: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {ticket.genai_output?.issue_category && (
            <Row icon={<Zap size={11} color="var(--nw-accent)" />} label="AI Category">
              {ticket.genai_output.issue_category}
              {ticket.genai_output.subcategory && ` / ${ticket.genai_output.subcategory}`}
            </Row>
          )}
          {ticket.genai_output?.urgency && (
            <Row icon={<AlertTriangle size={11} color="var(--nw-warning)" />} label="Urgency">
              {ticket.genai_output.urgency}
            </Row>
          )}
          {ticket.python_rule_output?.matched_rule_id && (
            <Row icon={<ShieldCheck size={11} color="var(--nw-success)" />} label="Matched Rule">
              {ticket.python_rule_output.matched_rule_id}
            </Row>
          )}
          {ticket.genai_output?.draft_response && (
            <div>
              <p style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                AI Draft Response
              </p>
              <p style={{
                fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.55,
                background: 'var(--nw-elevated)', borderRadius: 8, padding: '8px 10px',
                border: '1px solid var(--nw-border)',
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {ticket.genai_output.draft_response}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--nw-text-muted)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {icon}{label}:
      </span>
      <span style={{ fontSize: 12, color: 'var(--nw-text-secondary)' }}>{children}</span>
    </div>
  )
}
