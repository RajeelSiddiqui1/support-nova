'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../../lib/utils'

/**
 * Text Generate Effect — Aceternity UI (NW theme)
 * Animates each word fading in sequentially.
 */
export function TextGenerateEffect({ words, className = '' }) {
  const wordArr = words.split(' ')
  const [rendered, setRendered] = useState([])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      setRendered(wordArr.map((_, i) => i))
      return
    }
    let i = 0
    const id = setInterval(() => {
      setRendered(prev => [...prev, i])
      i++
      if (i >= wordArr.length) clearInterval(id)
    }, 60)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  return (
    <span className={className}>
      {wordArr.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={rendered.includes(i) ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="inline-block mr-[0.3em]"
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}
