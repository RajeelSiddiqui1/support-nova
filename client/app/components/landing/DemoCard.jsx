'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import VerificationScore from '../VerificationScore'
import IssueBadges from '../IssueBadges'
import SlaRiskBadge from '../SlaRiskBadge'

// Static mock — clearly labeled SAMPLE, no API calls
const MOCK_TICKET = {
  ticket_id: 'TKT-DEMO-001',
  status: 'In Triage',
  primary_issue: 'Delayed Delivery',
  secondary_issues: ['Tracking Not Updated', 'Customer Notification Failure'],
  department: 'Logistics',
  sentiment_score: 72,
  urgency: 'HIGH',
  escalation_required: false,
  escalation_tier: null,
  match_status: true,
  verification_score: 84,
  sla_risk: 'HIGH',
  ai_summary:
    'Customer reports a delivery delay of 8 days beyond the expected date. Tracking portal has not updated in 4 days. No proactive notification was sent by the logistics team.',
  unauthorized_promise: false,
  hallucination_detected: false,
}

export default function DemoCard() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  const statusColors = {
    'In Triage': { bg: 'var(--nw-warning-dim)', color: 'var(--nw-warning)', border: 'rgba(217,164,65,0.3)' },
    Resolved:    { bg: 'var(--nw-success-dim)', color: 'var(--nw-success)', border: 'rgba(79,166,137,0.3)' },
  }
  const sc = statusColors[MOCK_TICKET.status] || statusColors['In Triage']

  return (
    <section
      className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20"
      aria-labelledby="demo-heading"
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="text-center mb-8 sm:mb-10"
      >
        <span
          className="inline-block text-xs font-bold uppercase tracking-widest mb-3 px-3 py-1 rounded-full"
          style={{ background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)', border: '1px solid rgba(201,111,74,0.3)' }}
        >
          Live Interactive Preview
        </span>
        <h2 id="demo-heading" className="text-2xl sm:text-4xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
          Sample Ticket Analysis
        </h2>
        <p className="mt-3 text-xs sm:text-sm max-w-xl mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
          This is a static demonstration — no API calls. Real tickets include full pipeline comparison and reviewer audit.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        whileHover={{ y: -4, transition: { duration: 0.25 } }}
        transition={{ duration: 0.55, delay: 0.1 }}
        className="rounded-2xl overflow-hidden transition-all duration-300"
        style={{
          background: 'var(--nw-surface)',
          border: '1px solid var(--nw-border-strong)',
          boxShadow: '0 12px 40px rgba(11,14,20,0.5)',
        }}
      >
        {/* Header Bar */}
        <div
          className="px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3"
          style={{
            background: 'var(--nw-elevated)',
            borderBottom: '1px solid var(--nw-border)',
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span
              className="px-3 py-1 rounded-full text-xs font-mono font-bold"
              style={{ background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)', border: '1px solid rgba(201,111,74,0.3)' }}
            >
              {MOCK_TICKET.ticket_id}
            </span>
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
            >
              {MOCK_TICKET.status}
            </span>
            <SlaRiskBadge risk={MOCK_TICKET.sla_risk} />
          </div>

          {/* SAMPLE watermark badge */}
          <span
            className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase"
            style={{ background: 'rgba(154,156,165,0.12)', color: 'var(--nw-text-muted)', border: '1px solid var(--nw-border)' }}
          >
            📋 SAMPLE DATA
          </span>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-6 lg:items-start">
          {/* Left: Ticket Details */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Issue badges */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--nw-text-muted)' }}>Issue Classification</div>
              <IssueBadges primaryIssue={MOCK_TICKET.primary_issue} secondaryIssues={MOCK_TICKET.secondary_issues} />
            </div>

            {/* AI Summary */}
            <div className="rounded-xl p-3.5" style={{ background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--nw-accent)' }}>GenAI Summary</div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--nw-text-primary)' }}>{MOCK_TICKET.ai_summary}</p>
            </div>

            {/* Metadata row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Department', value: MOCK_TICKET.department },
                { label: 'Urgency',    value: MOCK_TICKET.urgency,   color: 'var(--nw-danger)' },
                { label: 'Sentiment',  value: `${MOCK_TICKET.sentiment_score}/100` },
                { label: 'Hallucination', value: MOCK_TICKET.hallucination_detected ? 'Detected' : 'None', color: MOCK_TICKET.hallucination_detected ? 'var(--nw-danger)' : 'var(--nw-success)' },
              ].map(m => (
                <div
                  key={m.label}
                  className="rounded-xl p-2.5 sm:p-3"
                  style={{ background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)' }}
                >
                  <div className="text-[10px] sm:text-xs" style={{ color: 'var(--nw-text-muted)', marginBottom: 2 }}>{m.label}</div>
                  <div className="text-xs sm:text-sm font-bold truncate" style={{ color: m.color || 'var(--nw-text-primary)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Security checks */}
            <div className="flex gap-2 sm:gap-2.5 flex-wrap pt-1">
              {[
                { label: 'No Hallucination', ok: !MOCK_TICKET.hallucination_detected },
                { label: 'No Unauthorized Promise', ok: !MOCK_TICKET.unauthorized_promise },
                { label: 'Prompt-Injection Safe', ok: true },
              ].map(c => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: c.ok ? 'var(--nw-success-dim)' : 'var(--nw-danger-dim)',
                    color: c.ok ? 'var(--nw-success)' : 'var(--nw-danger)',
                    border: `1px solid ${c.ok ? 'rgba(79,166,137,0.3)' : 'rgba(193,73,91,0.3)'}`,
                  }}
                >
                  {c.ok ? '✓' : '✕'} {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Verification gauge panel */}
          <div
            className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl self-center lg:self-stretch w-full lg:w-auto min-w-[200px]"
            style={{ background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)' }}
          >
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-center" style={{ color: 'var(--nw-text-muted)' }}>
              Verification Score
            </div>
            <VerificationScore
              matchStatus={MOCK_TICKET.match_status}
              confidenceScore={MOCK_TICKET.verification_score}
              size={150}
            />
          </div>
        </div>
      </motion.div>
    </section>
  )
}
