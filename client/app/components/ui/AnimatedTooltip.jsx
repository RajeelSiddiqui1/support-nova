'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Animated Tooltip — Aceternity UI (NW theme)
 * Wraps children; shows a tooltip card on hover.
 */
export function AnimatedTooltip({ items }) {
  const [hovered, setHovered] = useState(null)
  const [imgErrors, setImgErrors] = useState({})

  return (
    <div className="flex flex-row items-center gap-2 flex-wrap">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative"
          onMouseEnter={() => setHovered(item.id)}
          onMouseLeave={() => setHovered(null)}
        >
          <AnimatePresence>
            {hovered === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.92 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute bottom-full mb-2 left-1/2 z-50"
                style={{ transform: 'translateX(-50%)', minWidth: 120 }}
              >
                <div
                  className="rounded-xl px-3 py-2 text-center"
                  style={{
                    background: 'var(--nw-elevated)',
                    border: '1px solid var(--nw-border-strong)',
                    boxShadow: '0 8px 24px rgba(11,14,20,0.5)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-text-primary)', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--nw-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {item.designation}
                  </div>
                </div>
                {/* Arrow */}
                <div
                  style={{
                    width: 0, height: 0, margin: '0 auto',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '5px solid var(--nw-elevated)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Avatar */}
          <div
            className="relative w-10 h-10 rounded-full overflow-hidden cursor-pointer"
            style={{
              border: '2px solid var(--nw-border-strong)',
              boxShadow: hovered === item.id ? '0 0 12px rgba(201,111,74,0.4)' : 'none',
              transition: 'box-shadow 0.2s',
            }}
          >
            {item.image && !imgErrors[item.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={() => setImgErrors(prev => ({ ...prev, [item.id]: true }))}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--nw-accent), var(--nw-gold))',
                  fontSize: 14, fontWeight: 800, color: 'white',
                }}
              >
                {item.name?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
