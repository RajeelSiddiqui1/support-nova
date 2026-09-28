'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Hover Effect Cards (Card Stack) — Aceternity UI (NW theme)
 */
export function HoverEffect({ items, className = '' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {items.map((item, i) => (
        <div
          key={i}
          className="relative group"
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {hoveredIdx === i && (
            <motion.div
              className="absolute inset-0 rounded-2xl"
              layoutId="hoverCard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: 'var(--nw-accent-dim)', border: '1px solid rgba(201,111,74,0.25)' }}
              transition={{ duration: 0.2 }}
            />
          )}
          <div
            className="relative z-10 rounded-2xl p-5"
            style={{
              background: 'var(--nw-surface)',
              border: '1px solid var(--nw-border)',
              boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
              transition: 'border-color 0.2s',
              borderColor: hoveredIdx === i ? 'rgba(201,111,74,0.35)' : 'var(--nw-border)',
            }}
          >
            {item.icon && (
              <div className="mb-3 text-2xl">{item.icon}</div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--nw-text-primary)', marginBottom: 6 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.6 }}>
              {item.description}
            </div>
            {item.badge && (
              <div className="mt-3">
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                  background: item.badgeColor?.bg || 'var(--nw-accent-dim)',
                  color: item.badgeColor?.text || 'var(--nw-accent)',
                  border: `1px solid ${item.badgeColor?.border || 'rgba(201,111,74,0.3)'}`,
                }}>
                  {item.badge}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
