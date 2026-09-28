'use client'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

/**
 * Timeline — Aceternity UI (NW theme)
 * Renders a vertical timeline with animated connector.
 * Props: items — array of { title, description, icon?, tag? }
 */
export function Timeline({ items }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute left-5 top-0 bottom-0 w-[1px]"
        style={{ background: 'linear-gradient(to bottom, var(--nw-accent), var(--nw-gold), rgba(255,255,255,0.04))' }}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-8">
        {items.map((item, i) => (
          <TimelineItem key={i} item={item} index={i} />
        ))}
      </div>
    </div>
  )
}

function TimelineItem({ item, index }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
      className="relative flex gap-6 pl-14"
    >
      {/* Circle node */}
      <div
        className="absolute left-0 top-1 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10"
        style={{
          background: 'var(--nw-elevated)',
          border: '2px solid var(--nw-accent)',
          boxShadow: '0 0 12px rgba(201,111,74,0.25)',
        }}
      >
        {item.icon
          ? <span className="text-sm">{item.icon}</span>
          : <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--nw-accent)', fontFamily: 'JetBrains Mono, monospace' }}>{index + 1}</span>
        }
      </div>

      {/* Content */}
      <div
        className="flex-1 rounded-xl p-4"
        style={{
          background: 'var(--nw-surface)',
          border: '1px solid var(--nw-border)',
          boxShadow: '0 2px 12px rgba(11,14,20,0.25)',
        }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--nw-text-primary)' }}>
            {item.title}
          </div>
          {item.tag && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
              padding: '2px 8px', borderRadius: 99,
              background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)',
              border: '1px solid rgba(201,111,74,0.3)', whiteSpace: 'nowrap',
            }}>
              {item.tag}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.6, marginTop: 4 }}>
          {item.description}
        </div>
      </div>
    </motion.div>
  )
}
