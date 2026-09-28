'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const TIERS = [
  {
    tier: 'T1',
    label: 'Supervisor Review',
    icon: '👤',
    color: 'var(--nw-info)',
    dim: 'var(--nw-info-dim)',
    border: 'rgba(74,155,201,0.3)',
    description: 'Minor complaints routed to team supervisor for quick resolution. SLA: standard business-day window.',
  },
  {
    tier: 'T2',
    label: 'Department Manager',
    icon: '🏢',
    color: 'var(--nw-warning)',
    dim: 'var(--nw-warning-dim)',
    border: 'rgba(217,164,65,0.3)',
    description: 'Repeat issues or unresolved T1 tickets escalate to department manager. Policy enforcement kicks in.',
  },
  {
    tier: 'T3',
    label: 'Specialist Team',
    icon: '⚙️',
    color: 'var(--nw-accent)',
    dim: 'var(--nw-accent-dim)',
    border: 'rgba(201,111,74,0.3)',
    description: 'Complex product/quality issues routed to specialist QA or logistics team with domain expertise.',
  },
  {
    tier: 'T4',
    label: 'Compliance Review',
    icon: '⚖️',
    color: 'var(--nw-gold)',
    dim: 'var(--nw-gold-dim)',
    border: 'rgba(201,162,39,0.3)',
    description: 'Regulatory-risk or financial-impact tickets trigger compliance review before any external communication.',
  },
  {
    tier: 'T5',
    label: 'Critical Management',
    icon: '🚨',
    color: 'var(--nw-danger)',
    dim: 'var(--nw-danger-dim)',
    border: 'rgba(193,73,91,0.3)',
    description: 'High-severity, media-risk, or multi-department issues escalated directly to senior management team.',
  },
  {
    tier: 'T0',
    label: 'Standard Resolution',
    icon: '✅',
    color: 'var(--nw-success)',
    dim: 'var(--nw-success-dim)',
    border: 'rgba(79,166,137,0.3)',
    description: 'No escalation required. Agent resolves within standard SLA. Verification score ≥ 80, no flags raised.',
  },
]

export default function Escalation() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      id="escalation"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-20"
      aria-labelledby="escalation-heading"
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="text-center mb-12"
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--nw-danger)' }}>
          Escalation Hierarchy
        </p>
        <h2 id="escalation-heading" className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
          6-Tier Escalation System
        </h2>
        <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
          Every complaint is automatically classified into one of 6 escalation tiers based on severity, SLA risk, and department policy — no manual sorting.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TIERS.map((t, i) => (
          <motion.div
            key={t.tier}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: i * 0.07 }}
            className="rounded-2xl p-5 group cursor-default"
            style={{
              background: 'var(--nw-surface)',
              border: `1px solid ${t.border}`,
              boxShadow: '0 4px 20px rgba(11,14,20,0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            whileHover={{ y: -4 }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                style={{ background: t.dim }}
                aria-hidden="true"
              >
                {t.icon}
              </div>
              <div>
                <div
                  className="text-xs font-mono font-bold mb-0.5"
                  style={{ color: t.color, letterSpacing: '0.06em' }}
                >
                  Tier {t.tier}
                </div>
                <div className="text-sm font-bold" style={{ color: 'var(--nw-text-primary)' }}>
                  {t.label}
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--nw-text-secondary)' }}>
              {t.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
