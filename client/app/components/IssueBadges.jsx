'use client'

/**
 * IssueBadges — Primary + Secondary issue badges
 *
 * Props:
 *   primaryIssue      (string)   — main issue / category
 *   secondaryIssues   (string[]) — additional tags / subcategories
 *   max               (number)   — max secondary badges to show before "+N more" (default 3)
 */
export default function IssueBadges({ primaryIssue, secondaryIssues = [], max = 3 }) {
  if (!primaryIssue && !secondaryIssues.length) return null

  const shown   = secondaryIssues.slice(0, max)
  const overflow = secondaryIssues.length - shown.length

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
      {/* Primary */}
      {primaryIssue && (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
          padding: '3px 9px', borderRadius: 99,
          background: 'var(--nw-accent)', color: 'var(--nw-text-inverse)',
          boxShadow: '0 2px 6px rgba(201,111,74,0.35)',
          flexShrink: 0,
        }}>
          {primaryIssue}
        </span>
      )}

      {/* Secondary */}
      {shown.map((tag, i) => (
        <span key={i} style={{
          fontSize: 10, fontWeight: 500,
          padding: '3px 9px', borderRadius: 99,
          background: 'var(--nw-elevated)',
          color: 'var(--nw-text-secondary)',
          border: '1px solid var(--nw-border-strong)',
          flexShrink: 0,
        }}>
          {tag}
        </span>
      ))}

      {/* Overflow */}
      {overflow > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          padding: '3px 8px', borderRadius: 99,
          background: 'var(--nw-elevated)',
          color: 'var(--nw-text-muted)',
          border: '1px solid var(--nw-border)',
          flexShrink: 0,
        }}>
          +{overflow} more
        </span>
      )}
    </div>
  )
}
