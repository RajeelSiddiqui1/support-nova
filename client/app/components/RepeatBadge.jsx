'use client'
import { RefreshCw, ExternalLink } from 'lucide-react'

/**
 * RepeatBadge — Repeat / Duplicate complaint indicator
 *
 * Props:
 *   duplicateOf  (string | null)  — ticket_id this is a duplicate of
 *   priorCount   (number)         — how many previous similar complaints exist
 *   onViewPrior  (fn)             — optional callback to open prior ticket
 */
export default function RepeatBadge({ duplicateOf, priorCount = 0, onViewPrior }) {
  const isRepeat = !!duplicateOf || priorCount > 0
  if (!isRepeat) return null

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--nw-warning-dim)',
      border: '1px solid rgba(217,164,65,0.3)',
      borderRadius: 99, padding: '4px 10px',
      flexShrink: 0,
    }}>
      <RefreshCw size={11} color="var(--nw-warning)" />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--nw-warning)' }}>
        {duplicateOf
          ? `Duplicate of ${duplicateOf}`
          : `Repeat Customer (${priorCount} prior${priorCount > 1 ? 's' : ''})`
        }
      </span>
      {(duplicateOf || onViewPrior) && (
        <button
          onClick={() => onViewPrior && onViewPrior(duplicateOf)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center',
            color: 'var(--nw-warning)',
          }}
          title="View prior ticket"
        >
          <ExternalLink size={10} />
        </button>
      )}
    </div>
  )
}
