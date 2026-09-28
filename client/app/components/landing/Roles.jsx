'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const ROLES = [
  {
    key: 'CUSTOMER',
    emoji: '👤',
    label: 'Customer',
    color: '#C96F4A',
    bg: 'rgba(201,111,74,0.15)',
    border: 'rgba(201,111,74,0.3)',
    capabilities: [
      'Submit complaints (web, chat)',
      'Track complaint status in real-time',
      'Receive follow-up notifications',
      'Download complaint history',
    ],
  },
  {
    key: 'AGENT',
    emoji: '🎧',
    label: 'Agent',
    color: '#4FA689',
    bg: 'rgba(79,166,137,0.14)',
    border: 'rgba(79,166,137,0.3)',
    capabilities: [
      'View and manage assigned tickets',
      'Request customer clarifications',
      'Resolve complaints with notes',
      'Access live chat workspace',
    ],
  },
  {
    key: 'REVIEWER',
    emoji: '⚖️',
    label: 'Reviewer',
    color: '#C9A227',
    bg: 'rgba(201,162,39,0.13)',
    border: 'rgba(201,162,39,0.3)',
    capabilities: [
      'Review GenAI vs Python discrepancies',
      'Override pipeline decisions with reason',
      'Approve or reject escalations',
      'Full audit trail per ticket',
    ],
  },
  {
    key: 'MANAGER',
    emoji: '📊',
    label: 'Manager',
    color: '#9B7EDE',
    bg: 'rgba(155,126,222,0.13)',
    border: 'rgba(155,126,222,0.3)',
    capabilities: [
      'All Reviewer capabilities',
      'Team performance analytics',
      'SLA breach monitoring',
      'Export reports (7 formats)',
    ],
  },
  {
    key: 'ADMIN',
    emoji: '⚙️',
    label: 'Admin',
    color: '#C1495B',
    bg: 'rgba(193,73,91,0.14)',
    border: 'rgba(193,73,91,0.3)',
    capabilities: [
      'User management (all 5 roles)',
      'Department & category configuration',
      'Rule matrix uploads',
      'Knowledge-base document management',
    ],
  },
]

export default function Roles() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 py-20"
      aria-labelledby="roles-heading"
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="text-center mb-12"
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--nw-accent)' }}>
          Access Control
        </p>
        <h2 id="roles-heading" className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
          5 Roles, Zero Permission Overlap
        </h2>
        <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
          Every user in the system has a precisely scoped role. RBAC middleware enforces routes — no customer can access agent workspaces, and vice versa.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {ROLES.map((r, i) => (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="rounded-2xl p-5"
            style={{
              background: 'var(--nw-surface)',
              border: `1px solid ${r.border}`,
              boxShadow: '0 4px 20px rgba(11,14,20,0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: r.bg }}
                aria-hidden="true"
              >
                {r.emoji}
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: r.color }}>{r.label}</div>
                <div className="text-xs" style={{ color: 'var(--nw-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{r.key}</div>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {r.capabilities.map((c, ci) => (
                <li key={ci} className="flex items-start gap-1.5">
                  <span style={{ color: r.color, fontSize: 10, marginTop: 3, flexShrink: 0 }}>●</span>
                  <span style={{ fontSize: 11, color: 'var(--nw-text-secondary)', lineHeight: 1.5 }}>{c}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
