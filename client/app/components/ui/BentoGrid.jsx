'use client'
import { motion } from 'framer-motion'
import { cn } from '../../../lib/utils'

/**
 * Bento Grid — Aceternity UI (NW theme)
 * Props: className, children
 */
export function BentoGrid({ className = '', children }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * BentoGridItem
 * Props: title, description, header (ReactNode), icon (ReactNode), className, colSpan
 */
export function BentoGridItem({
  title,
  description,
  header,
  icon,
  className = '',
}) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl overflow-hidden cursor-pointer',
        className
      )}
      style={{
        background: 'var(--nw-surface)',
        border: '1px solid var(--nw-border)',
        padding: '20px',
        boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(201,111,74,0.35)'
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(11,14,20,0.5)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--nw-border)'
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(11,14,20,0.3)'
      }}
    >
      {header && (
        <div className="rounded-xl overflow-hidden" style={{ marginBottom: 4 }}>
          {header}
        </div>
      )}
      <div>
        {icon && (
          <div className="mb-2 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)' }}>
            {icon}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--nw-text-primary)', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.55 }}>
          {description}
        </div>
      </div>
    </motion.div>
  )
}
