'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { InfiniteMovingCards } from '../ui/InfiniteMovingCards'

const TECH_ITEMS = [
  { label: 'Next.js 14',       icon: '▲',  bg: 'rgba(255,255,255,0.04)' },
  { label: 'FastAPI',          icon: '⚡', bg: 'rgba(79,166,137,0.08)'  },
  { label: 'MongoDB Atlas',    icon: '🍃', bg: 'rgba(79,166,137,0.08)'  },
  { label: 'Qdrant Vector DB', icon: '🔴', bg: 'rgba(193,73,91,0.08)'   },
  { label: 'Groq LLM',        icon: '🤖', bg: 'rgba(201,111,74,0.08)'  },
  { label: 'AWS S3',           icon: '☁️', bg: 'rgba(74,155,201,0.08)'  },
  { label: 'Pydantic v2',      icon: '✅', bg: 'rgba(79,166,137,0.08)'  },
  { label: 'Pytest (39 tests)',icon: '🧪', bg: 'rgba(201,162,39,0.08)'  },
  { label: 'React 18',         icon: '⚛️', bg: 'rgba(74,155,201,0.08)'  },
  { label: 'Tailwind CSS',     icon: '🎨', bg: 'rgba(74,155,201,0.08)'  },
  { label: 'Recharts',         icon: '📊', bg: 'rgba(201,162,39,0.08)'  },
  { label: 'Next Auth',        icon: '🔐', bg: 'rgba(155,126,222,0.08)' },
]

export default function TechStrip() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      className="py-16"
      aria-labelledby="tech-heading"
      style={{ borderTop: '1px solid var(--nw-border)', borderBottom: '1px solid var(--nw-border)' }}
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--nw-text-muted)' }}>
          Built With
        </p>
        <h2 id="tech-heading" className="sr-only">Technology Stack</h2>
      </motion.div>

      <InfiniteMovingCards items={TECH_ITEMS} speed="normal" />
    </section>
  )
}
