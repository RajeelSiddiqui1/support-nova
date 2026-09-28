'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Logo from '../Logo'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pipelines',    href: '#pipelines' },
  { label: 'Escalation',   href: '#escalation' },
  { label: 'Team',         href: '#team' },
]

/**
 * Landing Navbar — floating glass bar.
 * Reads user from localStorage; if present routes CTA to role dashboard.
 */
export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [dashboardHref, setDashboardHref] = useState(null)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user')
      if (raw) {
        const user = JSON.parse(raw)
        const role = (user?.role || '').toUpperCase()
        setUserRole(role)
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

  const ctaHref  = dashboardHref || '/login'
  const ctaLabel = dashboardHref ? 'Go to Dashboard' : 'Staff Login'

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'var(--nw-glass-bg)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--nw-glass-border)' : 'none',
        boxShadow: scrolled ? '0 4px 24px rgba(11,14,20,0.4)' : 'none',
      }}
    >
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between"
        style={{ height: 64 }}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link href="/" aria-label="SupportNova home">
          <Logo size={36} variant="full" />
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_LINKS.map(l => (
            <li key={l.href}>
              <a
                href={l.href}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none"
                style={{ color: 'var(--nw-text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--nw-text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--nw-text-secondary)'}
                onFocus={e => { e.currentTarget.style.color = 'var(--nw-text-primary)'; e.currentTarget.style.outline = '2px solid var(--nw-focus-ring)' }}
                onBlur={e => { e.currentTarget.style.color = 'var(--nw-text-secondary)'; e.currentTarget.style.outline = 'none' }}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/customer/submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-150"
            style={{
              background: 'var(--nw-elevated)',
              border: '1px solid var(--nw-border-strong)',
              color: 'var(--nw-text-primary)',
            }}
          >
            Submit Complaint
          </Link>
          <Link
            href={ctaHref}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150"
            style={{
              background: 'var(--nw-accent)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(201,111,74,0.35)',
            }}
          >
            {ctaLabel}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg"
          style={{ color: 'var(--nw-text-primary)', background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)' }}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden"
            style={{
              background: 'var(--nw-glass-bg)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--nw-border)',
            }}
          >
            <div className="px-4 pb-4 pt-2 flex flex-col gap-1">
              {NAV_LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-medium"
                  style={{ color: 'var(--nw-text-secondary)' }}
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2">
                <Link
                  href="/customer/submit"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-semibold text-center"
                  style={{ background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)', color: 'var(--nw-text-primary)' }}
                >
                  Submit Complaint
                </Link>
                <Link
                  href={ctaHref}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-bold text-center"
                  style={{ background: 'var(--nw-accent)', color: 'white' }}
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
