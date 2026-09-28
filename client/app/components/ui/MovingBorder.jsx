'use client'
import { useState, useRef, useEffect } from 'react'
import { cn } from '../../../lib/utils'

/**
 * Moving Border Button — Aceternity UI (restyled for NW theme)
 * Animated gradient border that travels around the button perimeter.
 */
export function MovingBorder({
  children,
  className = '',
  containerClassName = '',
  as: Component = 'button',
  duration = 2000,
  rx = '12',
  ry = '12',
  ...props
}) {
  const pathRef = useRef(null)
  const progressRef = useRef(0)
  const frameRef = useRef(null)
  const [pathLength, setPathLength] = useState(0)

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength())
    }
  }, [])

  useEffect(() => {
    if (!pathLength) return
    let start = null

    const animate = (ts) => {
      if (!start) start = ts
      const elapsed = ts - start
      progressRef.current = (elapsed % duration) / duration
      if (pathRef.current) {
        const pt = pathRef.current.getPointAtLength(progressRef.current * pathLength)
        const el = pathRef.current.parentElement?.querySelector('.moving-dot')
        if (el) {
          el.setAttribute('cx', pt.x)
          el.setAttribute('cy', pt.y)
        }
      }
      frameRef.current = requestAnimationFrame(animate)
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!mq.matches) {
      frameRef.current = requestAnimationFrame(animate)
    }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [pathLength, duration])

  return (
    <Component
      className={cn(
        'relative flex items-center justify-center p-[1px] overflow-hidden rounded-xl',
        containerClassName
      )}
      {...props}
    >
      {/* SVG moving dot overlay */}
      <div className="absolute inset-0" style={{ borderRadius: rx }}>
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <rect
            ref={pathRef}
            fill="none"
            width="100%"
            height="100%"
            rx={rx}
            ry={ry}
          />
          <radialGradient id="moving-grad">
            <stop offset="0%"   stopColor="var(--nw-accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--nw-gold)"   stopOpacity="0" />
          </radialGradient>
          <circle className="moving-dot" r="6" fill="url(#moving-grad)" />
        </svg>
      </div>

      {/* Border frame */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{ border: '1px solid rgba(201,111,74,0.3)' }}
      />

      {/* Content */}
      <div className={cn('relative z-10', className)}>
        {children}
      </div>
    </Component>
  )
}
