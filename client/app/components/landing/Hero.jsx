'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BackgroundBeams } from '../ui/BackgroundBeams'
import { TextGenerateEffect } from '../ui/TextGenerateEffect'
import { Shield, GitBranch, FileCheck } from 'lucide-react'

const BADGES = [
  { label: 'Dual Pipeline',              icon: <GitBranch size={12} />, color: 'var(--nw-accent)' },
  { label: 'Prompt-Injection Protected', icon: <Shield     size={12} />, color: 'var(--nw-success)' },
  { label: 'Full Audit Trail',           icon: <FileCheck  size={12} />, color: 'var(--nw-info)' },
]

export default function Hero() {
  const [dashboardHref, setDashboardHref] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user')
      if (raw) {
        const user = JSON.parse(raw)
        const role = (user?.role || '').toUpperCase()
        const map = {
          CUSTOMER: '/customer/dashboard',
          AGENT:    '/agent/workspace',
          REVIEWER: '/reviewer/queue',
          MANAGER:  '/reviewer/queue',
          ADMIN:    '/admin/dashboard',
        }
        setDashboardHref(map[role] || '/login')
      }
    } catch {}
  }, [])

  return (
    <section
      className="relative flex flex-col items-center justify-center text-center overflow-hidden"
      style={{ minHeight: '100vh', paddingTop: 120, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}
      aria-label="Hero"
    >
      <BackgroundBeams />

      {/* Glow blob */}
      <div
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 600, height: 600, top: '20%', left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse, rgba(201,111,74,0.1) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Event badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full"
          style={{
            background: 'var(--nw-gold-dim)',
            border: '1px solid rgba(201,162,39,0.3)',
          }}
        >
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-gold)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Aptech TechWiz 7 · Generative AI PowerPlay · ResponseX Intelligence
          </span>
        </motion.div>

        {/* Headline */}
        <h1
          className="font-extrabold leading-tight tracking-tight mb-4"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--nw-text-primary)' }}
        >
          <TextGenerateEffect words="AI-Powered Complaint Resolution" />
          <span
            className="block mt-1"
            style={{ background: 'linear-gradient(90deg, var(--nw-accent), var(--nw-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Verified by Deterministic Rules
          </span>
        </h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mb-8 font-mono"
          style={{ fontSize: 'clamp(0.9rem, 2vw, 1.15rem)', color: 'var(--nw-text-secondary)', letterSpacing: '0.04em' }}
        >
          GenAI suggests.{' '}
          <span style={{ color: 'var(--nw-accent)' }}>Python verifies.</span>{' '}
          Humans decide.
        </motion.p>

        {/* Badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {BADGES.map(b => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: 'var(--nw-elevated)',
                border: `1px solid ${b.color}40`,
                color: b.color,
              }}
            >
              {b.icon}
              {b.label}
            </span>
          ))}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/customer/submit"
            className="px-8 py-3.5 rounded-xl font-bold text-sm transition-all duration-200"
            style={{
              background: 'var(--nw-accent)',
              color: 'white',
              boxShadow: '0 4px 20px rgba(201,111,74,0.4)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--nw-accent-hover)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(201,111,74,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--nw-accent)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,111,74,0.4)' }}
          >
            Submit a Complaint
          </Link>
          <Link
            href={dashboardHref || '/login'}
            className="px-8 py-3.5 rounded-xl font-bold text-sm transition-all duration-200"
            style={{
              background: 'var(--nw-elevated)',
              border: '1.5px solid var(--nw-border-strong)',
              color: 'var(--nw-text-primary)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,111,74,0.5)'; e.currentTarget.style.color = 'var(--nw-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--nw-border-strong)'; e.currentTarget.style.color = 'var(--nw-text-primary)' }}
          >
            {dashboardHref ? 'Go to Dashboard' : 'Staff Login'}
          </Link>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.6 }}
          className="mt-16 flex flex-col items-center gap-2"
          aria-hidden="true"
        >
          <span style={{ fontSize: 11, color: 'var(--nw-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Scroll to explore</span>
          <div
            className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
            style={{ borderColor: 'var(--nw-border-strong)' }}
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--nw-accent)' }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
