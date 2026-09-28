'use client'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { X, CheckCircle } from 'lucide-react'

const BEFORE = [
  'Agents manually read every complaint',
  'No sentiment or urgency scoring',
  'Departments re-assign tickets by email',
  'No duplicate detection — same issue filed 3×',
  'Escalation policy lives in a spreadsheet',
  'Zero auditability of AI decisions',
]

const AFTER = [
  'Multi-channel intake with structured extraction',
  'Separate sentiment score & urgency class via LLM',
  'Deterministic department routing via rule matrix',
  'Deduplication engine flags repeat submissions',
  '6-tier escalation with automated notifications',
  'Every pipeline decision logged & reviewer-auditable',
]

function FadeSection({ children, delay = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export default function ProblemVsSolution() {
  return (
    <section
      className="max-w-6xl mx-auto px-4 sm:px-6 py-20"
      aria-labelledby="pvs-heading"
    >
      <FadeSection>
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--nw-accent)' }}>
            The Problem
          </p>
          <h2 id="pvs-heading" className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
            Manual Triage vs SupportNova
          </h2>
          <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
            Traditional support workflows leave accuracy and speed on the table. SupportNova replaces guesswork with dual-pipeline verification.
          </p>
        </div>
      </FadeSection>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Before */}
        <FadeSection delay={0.1}>
          <div
            className="rounded-2xl p-6 h-full"
            style={{
              background: 'var(--nw-surface)',
              border: '1px solid rgba(193,73,91,0.25)',
              boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl" aria-hidden="true">🔴</span>
              <h3 className="text-base font-bold" style={{ color: 'var(--nw-danger)' }}>Manual Triage</h3>
            </div>
            <ul className="flex flex-col gap-3">
              {BEFORE.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <X size={14} style={{ color: 'var(--nw-danger)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--nw-text-secondary)', lineHeight: 1.55 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeSection>

        {/* After */}
        <FadeSection delay={0.2}>
          <div
            className="rounded-2xl p-6 h-full"
            style={{
              background: 'var(--nw-surface)',
              border: '1px solid rgba(79,166,137,0.28)',
              boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl" aria-hidden="true">✅</span>
              <h3 className="text-base font-bold" style={{ color: 'var(--nw-success)' }}>SupportNova</h3>
            </div>
            <ul className="flex flex-col gap-3">
              {AFTER.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle size={14} style={{ color: 'var(--nw-success)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--nw-text-secondary)', lineHeight: 1.55 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeSection>
      </div>
    </section>
  )
}
