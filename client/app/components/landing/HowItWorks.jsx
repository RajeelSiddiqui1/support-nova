'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Timeline } from '../ui/Timeline'

const STEPS = [
  {
    icon: '📥',
    title: 'Intake & Validation',
    tag: 'Step 1',
    description:
      'Customer submits a complaint via web form, live chat, or email. Input is sanitised, de-duplicated, and saved to MongoDB Atlas. Attachments upload to AWS S3.',
  },
  {
    icon: '🤖',
    title: 'Pipeline 1 — GenAI Extraction (Groq LLM)',
    tag: 'Step 2',
    description:
      'Groq LLM extracts: primary/secondary issues, sentiment score, urgency level, department routing, escalation recommendation, clarification needs, and a human-readable summary. Qdrant RAG retrieves relevant policy context.',
  },
  {
    icon: '🐍',
    title: 'Pipeline 2 — Python Ground-Truth Validation',
    tag: 'Step 3',
    description:
      'A deterministic Python engine independently derives the same fields using rule matrices and keyword scoring — with no LLM involvement. Output is a structured validation object with confidence scores per field.',
  },
  {
    icon: '⚖️',
    title: 'Reconciliation & Comparison Engine',
    tag: 'Step 4',
    description:
      'Both pipeline outputs are compared field-by-field. Agreement → high verification score. Disagreement → manual review flag. Hallucination and unauthorized-promise checks run at this stage.',
  },
  {
    icon: '🧑‍💼',
    title: 'Reviewer Queue or Agent Workspace',
    tag: 'Step 5',
    description:
      'High-score tickets route to the Agent workspace for resolution. Low-score or escalated tickets enter the Reviewer queue. Managers can override and annotate decisions with full audit records.',
  },
  {
    icon: '📤',
    title: 'Follow-Up & Reporting',
    tag: 'Step 6',
    description:
      'Automated follow-ups keep customers informed. After resolution, tickets are archived and exportable as CSV/XLSX/PDF. Admins view analytics dashboards and run 7 report templates.',
  },
]

export default function HowItWorks() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      id="how-it-works"
      className="max-w-4xl mx-auto px-4 sm:px-6 py-20"
      aria-labelledby="hiw-heading"
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="text-center mb-14"
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--nw-accent)' }}>
          Process
        </p>
        <h2 id="hiw-heading" className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
          How It Works
        </h2>
        <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
          Six deterministic stages from raw complaint to verified resolution — every step logged and auditable.
        </p>
      </motion.div>

      <Timeline items={STEPS} />
    </section>
  )
}
