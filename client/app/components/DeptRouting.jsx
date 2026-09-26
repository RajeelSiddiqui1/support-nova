'use client'
import { Building2, Plus } from 'lucide-react'

/**
 * DeptRouting — Multi-department routing display
 *
 * Props:
 *   primaryDept      (string)    — main assigned department
 *   supportingDepts  (string[])  — additional departments involved
 *   accentColor      (string)    — CSS color for the primary badge (defaults to accent)
 */
export default function DeptRouting({
  primaryDept,
  supportingDepts = [],
  accentColor = 'var(--nw-accent)',
}) {
  if (!primaryDept) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
      {/* Primary dept */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'var(--nw-accent-dim)',
        border: `1px solid rgba(201,111,74,0.3)`,
        borderRadius: 99, padding: '4px 10px',
        flexShrink: 0,
      }}>
        <Building2 size={10} color={accentColor} />
        <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>
          {primaryDept}
        </span>
      </div>

      {/* Supporting depts */}
      {supportingDepts.map((dept, i) => (
        <div key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'var(--nw-elevated)',
          border: '1px solid var(--nw-border-strong)',
          borderRadius: 99, padding: '4px 10px',
          flexShrink: 0,
        }}>
          <Plus size={9} color="var(--nw-text-muted)" />
          <Building2 size={10} color="var(--nw-text-muted)" />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--nw-text-secondary)' }}>
            {dept}
          </span>
        </div>
      ))}
    </div>
  )
}
