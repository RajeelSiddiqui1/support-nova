'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

export default function Pipelines() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      id="pipelines"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-20"
      aria-labelledby="pipelines-heading"
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="text-center mb-12"
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--nw-accent)' }}>
          Dual Pipeline Architecture
        </p>
        <h2 id="pipelines-heading" className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
          Two Pipelines. One Truth.
        </h2>
        <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
          GenAI and deterministic Python run independently. Agreement earns high confidence. Disagreement triggers human review — never silent failure.
        </p>
      </motion.div>

      {/* Pipeline diagram */}
      <div className="relative">
        {/* Connector line (desktop) */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-px"
          style={{ background: 'linear-gradient(90deg, var(--nw-accent), var(--nw-gold))' }}
        />

        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          {/* Pipeline 1 */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl p-6"
            style={{
              background: 'var(--nw-surface)',
              border: '1px solid rgba(201,111,74,0.3)',
              boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span
                className="px-2 py-1 rounded-md text-xs font-mono font-bold"
                style={{ background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)' }}
              >
                Pipeline 1
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--nw-text-primary)' }}>GenAI Extraction</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl" aria-hidden="true">🤖</span>
              <span className="text-lg font-bold" style={{ color: 'var(--nw-text-primary)' }}>Groq LLM + Qdrant RAG</span>
            </div>
            <ul className="flex flex-col gap-2">
              {[
                'Natural-language complaint understanding',
                'Policy-aware context retrieval via RAG',
                'Sentiment, urgency, department routing',
                'Hallucination risk — needs verification',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span style={{ color: 'var(--nw-accent)', fontSize: 14, flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.55 }}>{item}</span>
                </li>
              ))}
            </ul>
            <div
              className="mt-4 px-3 py-2 rounded-lg text-center text-xs font-bold"
              style={{ background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)', border: '1px solid rgba(201,111,74,0.25)' }}
            >
              Output: Structured JSON with confidence fields
            </div>
          </motion.div>

          {/* Comparison Engine */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex flex-col items-center gap-2 py-4"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--nw-elevated)',
                border: '2px solid var(--nw-gold)',
                boxShadow: '0 0 20px rgba(201,162,39,0.2)',
              }}
            >
              <span className="text-xl" aria-hidden="true">⚖️</span>
            </div>
            <span
              className="text-xs font-bold text-center"
              style={{ color: 'var(--nw-gold)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              Comparison<br />Engine
            </span>
          </motion.div>

          {/* Pipeline 2 */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl p-6"
            style={{
              background: 'var(--nw-surface)',
              border: '1px solid rgba(79,166,137,0.3)',
              boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span
                className="px-2 py-1 rounded-md text-xs font-mono font-bold"
                style={{ background: 'var(--nw-success-dim)', color: 'var(--nw-success)' }}
              >
                Pipeline 2
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--nw-text-primary)' }}>Python Validation</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl" aria-hidden="true">🐍</span>
              <span className="text-lg font-bold" style={{ color: 'var(--nw-text-primary)' }}>Deterministic Rule Engine</span>
            </div>
            <ul className="flex flex-col gap-2">
              {[
                'Rule matrix + keyword scoring',
                'No LLM — 100% deterministic output',
                'Unauthorized-promise detection',
                'Ground-truth for reconciliation',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span style={{ color: 'var(--nw-success)', fontSize: 14, flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.55 }}>{item}</span>
                </li>
              ))}
            </ul>
            <div
              className="mt-4 px-3 py-2 rounded-lg text-center text-xs font-bold"
              style={{ background: 'var(--nw-success-dim)', color: 'var(--nw-success)', border: '1px solid rgba(79,166,137,0.25)' }}
            >
              Output: Validated fields + match_status boolean
            </div>
          </motion.div>
        </div>

        {/* Outcomes */}
        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          {[
            { icon: '✅', label: 'High Score → Verified', color: 'var(--nw-success)', dim: 'var(--nw-success-dim)', desc: 'Both pipelines agree. Ticket proceeds to agent workspace.' },
            { icon: '⚠️', label: 'Low Score → Manual Review', color: 'var(--nw-warning)', dim: 'var(--nw-warning-dim)', desc: 'Disagreement detected. Reviewer queue with delta explanation.' },
          ].map(o => (
            <motion.div
              key={o.label}
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: o.dim, border: `1px solid ${o.color}40` }}
            >
              <span className="text-xl" aria-hidden="true">{o.icon}</span>
              <div>
                <div className="text-sm font-bold" style={{ color: o.color }}>{o.label}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--nw-text-secondary)', lineHeight: 1.55 }}>{o.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
