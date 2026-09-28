'use client'
import Link from 'next/link'
import Logo from '../Logo'
import { Github, ExternalLink } from 'lucide-react'

const LINKS = {
  Product: [
    { label: 'Features',      href: '#features'      },
    { label: 'How It Works',  href: '#how-it-works'  },
    { label: 'Two Pipelines', href: '#pipelines'     },
    { label: 'Escalation',    href: '#escalation'    },
  ],
  Platform: [
    { label: 'Submit Complaint', href: '/customer/submit' },
    { label: 'Customer Portal',  href: '/customer/dashboard' },
    { label: 'Staff Login',      href: '/login' },
  ],
  Team: [
    { label: 'Our Team',        href: '#team' },
    { label: 'Submission',      href: '#team' },
  ],
}

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      style={{
        background: 'var(--nw-surface)',
        borderTop: '1px solid var(--nw-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 mb-10">
          {/* Brand */}
          <div>
            <Logo size={40} variant="full" />
            <p className="mt-4 text-sm leading-relaxed max-w-xs" style={{ color: 'var(--nw-text-secondary)' }}>
              Enterprise-grade dual-pipeline customer complaint intelligence. GenAI suggests. Python verifies. Humans decide.
            </p>
            <div
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: 'var(--nw-gold-dim)',
                border: '1px solid rgba(201,162,39,0.3)',
                color: 'var(--nw-gold)',
              }}
            >
              🏆 Aptech TechWiz 7 · Generative AI PowerPlay
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <h3
                className="text-xs font-bold uppercase tracking-widest mb-4"
                style={{ color: 'var(--nw-text-muted)' }}
              >
                {group}
              </h3>
              <ul className="flex flex-col gap-2.5" role="list">
                {items.map(l => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm transition-colors duration-150"
                      style={{ color: 'var(--nw-text-secondary)', textDecoration: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--nw-text-primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--nw-text-secondary)'}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
          style={{ borderTop: '1px solid var(--nw-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--nw-text-muted)' }}>
            © {new Date().getFullYear()} NovaWear Apparel · SupportNova. Built for Aptech TechWiz 7, Generative AI PowerPlay.
          </p>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--nw-text-muted)' }}>
            <span>Theme: ResponseX Intelligence</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
