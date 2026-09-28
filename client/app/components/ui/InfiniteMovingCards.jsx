'use client'
import { useRef, useEffect } from 'react'

/**
 * Infinite Moving Cards (Marquee) — Aceternity UI (NW theme)
 * Scrolls items horizontally in a continuous loop.
 * Props:
 *   items      — array of { label, icon?, bg? }
 *   speed      — 'fast'|'normal'|'slow' (default 'normal')
 *   direction  — 'left'|'right' (default 'left')
 */
export function InfiniteMovingCards({ items, speed = 'normal', direction = 'left' }) {
  const containerRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (!listRef.current || !containerRef.current) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    // Clone children for seamless loop
    const children = Array.from(listRef.current.children)
    children.forEach(child => {
      const clone = child.cloneNode(true)
      clone.setAttribute('aria-hidden', 'true')
      listRef.current.appendChild(clone)
    })

    const durations = { fast: '20s', normal: '35s', slow: '55s' }
    const dur = durations[speed] || '35s'

    containerRef.current.style.setProperty('--anim-duration', dur)
    containerRef.current.style.setProperty('--anim-direction', direction === 'right' ? 'reverse' : 'normal')
    containerRef.current.setAttribute('data-animated', 'true')
  }, [speed, direction])

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
    >
      <ul
        ref={listRef}
        className="flex gap-4 py-3"
        style={{
          animation: 'scrollX var(--anim-duration, 35s) linear var(--anim-direction, normal) infinite',
          width: 'max-content',
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{
              background: item.bg || 'var(--nw-elevated)',
              border: '1px solid var(--nw-border-strong)',
              boxShadow: '0 2px 8px rgba(11,14,20,0.2)',
            }}
          >
            {item.icon && (
              <span style={{ fontSize: 18 }} aria-hidden="true">{item.icon}</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nw-text-primary)', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <style>{`
        @keyframes scrollX {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          ul { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
