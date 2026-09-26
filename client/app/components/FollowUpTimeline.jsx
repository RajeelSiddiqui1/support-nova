'use client'
import { CheckCircle, Clock, Send, Zap, User, X } from 'lucide-react'

/**
 * FollowUpTimeline — vertical lifecycle timeline derived from ticket fields
 *
 * Props:
 *   ticket  — full ticket object
 */

const STEPS = [
  {
    key:   'submitted',
    label: 'Complaint Submitted',
    icon:  Send,
    getTs: (t) => t.created_at,
    isDone: () => true,
  },
  {
    key:   'ai_complete',
    label: 'AI Pipeline Analysis',
    icon:  Zap,
    getTs: (t) => t.created_at,    // AI runs synchronously at submission
    isDone: (t) => !!t.genai_output,
    tag: '⚡ Instant',
  },
  {
    key:   'assigned',
    label: 'Agent Assigned',
    icon:  User,
    getTs: (t) => t.assigned_at || t.updated_at,
    isDone: (t) => !!t.assigned_agent_id,
  },
  {
    key:   'update',
    label: 'Awaiting Resolution',
    icon:  Clock,
    getTs: (t) => t.updated_at,
    isDone: (t) => ['Resolved', 'Closed'].includes(t.status),
    isActive: (t) => !['Resolved', 'Closed'].includes(t.status) && !!t.assigned_agent_id,
  },
  {
    key:   'resolved',
    label: 'Resolved & Closed',
    icon:  CheckCircle,
    getTs: (t) => ['Resolved', 'Closed'].includes(t.status) ? t.updated_at : null,
    isDone: (t) => ['Resolved', 'Closed'].includes(t.status),
  },
]

function fmt(ts) {
  if (!ts) return null
  try {
    return new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return null }
}

export default function FollowUpTimeline({ ticket }) {
  if (!ticket) return null

  return (
    <div style={{
      background: 'var(--nw-surface)',
      border: '1px solid var(--nw-border-strong)',
      borderRadius: 14, padding: '16px 18px',
    }}>
      <p style={{
        fontSize: 11, fontWeight: 700, color: 'var(--nw-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16,
      }}>
        Resolution Timeline
      </p>

      <div style={{ position: 'relative' }}>
        {/* Vertical connector line */}
        <div style={{
          position: 'absolute', left: 11, top: 12, bottom: 12,
          width: 2, background: 'var(--nw-border)',
          borderRadius: 1, zIndex: 0,
        }} />

        {STEPS.map((step, i) => {
          const done   = step.isDone(ticket)
          const active = step.isActive ? step.isActive(ticket) : false
          const ts     = fmt(step.getTs(ticket))
          const Icon   = step.icon

          let dotColor   = 'var(--nw-border-strong)'
          let dotBg      = 'var(--nw-elevated)'
          let iconColor  = 'var(--nw-text-muted)'
          let labelColor = 'var(--nw-text-muted)'

          if (done) {
            dotColor   = 'var(--nw-success)'
            dotBg      = 'var(--nw-success-dim)'
            iconColor  = 'var(--nw-success)'
            labelColor = 'var(--nw-text-primary)'
          } else if (active) {
            dotColor   = 'var(--nw-gold)'
            dotBg      = 'var(--nw-gold-dim)'
            iconColor  = 'var(--nw-gold)'
            labelColor = 'var(--nw-gold)'
          }

          return (
            <div key={step.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              marginBottom: i < STEPS.length - 1 ? 18 : 0,
              position: 'relative', zIndex: 1,
            }}>
              {/* Dot */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: dotBg, border: `2px solid ${dotColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {active
                  ? <div className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                  : <Icon size={11} color={iconColor} />
                }
              </div>

              {/* Label + time */}
              <div style={{ paddingTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: done || active ? 600 : 400, color: labelColor }}>
                    {step.label}
                  </span>
                  {step.tag && done && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--nw-accent)',
                      background: 'var(--nw-accent-dim)', borderRadius: 99, padding: '1px 7px',
                    }}>
                      {step.tag}
                    </span>
                  )}
                  {active && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--nw-gold)',
                      background: 'var(--nw-gold-dim)', borderRadius: 99, padding: '1px 7px',
                    }}>
                      In Progress…
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', marginTop: 2 }}>
                  {ts || (done ? 'Completed' : active ? 'Ongoing' : '—')}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
