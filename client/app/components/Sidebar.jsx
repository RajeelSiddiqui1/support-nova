'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap, LayoutDashboard, PlusCircle, MessageSquare, Ticket,
  Settings, LogOut, Database, BarChart3, Users,
  Scale, ShieldCheck, FileText, UserCheck, Eye, Building2, FolderTree,
  TrendingUp, ClipboardList
} from 'lucide-react'
import Logo from './Logo'

const NAV = {
  customer: [
    { icon: LayoutDashboard, label: 'Dashboard',         href: '/customer/dashboard' },
    { icon: PlusCircle,      label: 'Submit Webform',     href: '/customer/submit'    },
    { icon: MessageSquare,   label: 'Guided Chat Intake', href: '/customer/chat'      },
    { icon: Ticket,          label: 'My Tickets',         href: '/customer/dashboard' },
  ],
  agent: [
    { icon: LayoutDashboard, label: 'Workspace',          href: '/agent/workspace'    },
    { icon: MessageSquare,   label: 'Chat Queue',         href: '/agent/chat-tickets' },
    { icon: Ticket,          label: 'Ticket Queue',        href: '/agent/workspace'    },
    { icon: Zap,             label: 'AI Pipeline',         href: '/agent/workspace'    },
  ],
  reviewer: [
    { icon: LayoutDashboard, label: 'Review Queue',        href: '/reviewer/queue' },
    { icon: Scale,           label: 'Mismatch Audit',      href: '/reviewer/queue' },
    { icon: ShieldCheck,     label: 'Audit Log',           href: '/reviewer/queue' },
  ],
  admin: [
    { icon: BarChart3,      label: 'Dashboard',        href: '/admin/dashboard',   section: 'OVERVIEW' },
    { icon: TrendingUp,     label: 'Analytics',        href: '/admin/analytics',   section: 'OVERVIEW' },
    { icon: FileText,       label: 'All Tickets',      href: '/admin/tickets',     section: 'TICKETS'  },
    { icon: Users,          label: 'Users',            href: '/admin/users',       section: 'PEOPLE'   },
    { icon: Building2,      label: 'Departments',      href: '/admin/departments', section: 'PEOPLE'   },
    { icon: FolderTree,     label: 'Categories',       href: '/admin/categories',  section: 'PEOPLE'   },
    { icon: UserCheck,      label: 'Staff Management', href: '/admin/dashboard',   section: 'PEOPLE'   },
    { icon: Database,       label: 'Knowledge Base',   href: '/admin/policies',    section: 'SYSTEM'   },
    { icon: Settings,       label: 'Rule Matrix',      href: '/admin/dashboard',   section: 'SYSTEM'   },
    { icon: ClipboardList,  label: 'Reports',          href: '/admin/reports',     section: 'SYSTEM'   },
  ],
}

/* Per-role accent colors using brand tokens */
const ROLE_META = {
  customer: { label: 'Customer Portal',    accent: '#C96F4A', accentDim: 'rgba(201,111,74,0.15)',   emoji: '👤' },
  agent:    { label: 'Agent Workspace',    accent: '#4FA689', accentDim: 'rgba(79,166,137,0.14)',   emoji: '🎧' },
  reviewer: { label: 'Manager / Reviewer', accent: '#C9A227', accentDim: 'rgba(201,162,39,0.13)',   emoji: '⚖️' },
  admin:    { label: 'Admin Center',       accent: '#C1495B', accentDim: 'rgba(193,73,91,0.14)',    emoji: '⚙️' },
}

import { useState, useEffect } from 'react'

export default function Sidebar({ role = 'customer', userName, userEmail }) {
  const pathname = usePathname()
  const rKey  = (role || 'customer').toLowerCase()
  const items = NAV[rKey] || NAV.customer
  const meta  = ROLE_META[rKey] || ROLE_META.customer

  const [profile, setProfile] = useState({
    name:  userName  || 'User',
    email: userEmail || 'user@company.com'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      let resolvedUser = null

      // 1. Check URL query string for auth_user parameter (from Google OAuth redirect)
      const params = new URLSearchParams(window.location.search)
      const authUserParam = params.get('auth_user')
      if (authUserParam) {
        try {
          const decoded = JSON.parse(decodeURIComponent(authUserParam))
          if (decoded && (decoded.email || decoded.name)) {
            resolvedUser = decoded
            localStorage.setItem('user', JSON.stringify(decoded))
            const cleanUrl = window.location.pathname
            window.history.replaceState({}, document.title, cleanUrl)
          }
        } catch (err) {
          console.log('Error parsing auth_user:', err)
        }
      }

      // 2. Check cookies
      if (!resolvedUser) {
        const cookiePairs = document.cookie ? document.cookie.split('; ') : []
        const cookies = {}
        const clean = (s) => (s || '').replace(/^[\"']|[\"']$/g, '').trim()
        cookiePairs.forEach(pair => {
          const [k, v] = pair.split('=')
          if (k) cookies[k] = clean(decodeURIComponent(v || ''))
        })
        if (cookies.user_email || cookies.user_name) {
          resolvedUser = {
            name:   cookies.user_name,
            email:  cookies.user_email,
            role:   cookies.user_role   || 'CUSTOMER',
            status: cookies.user_status || 'ACTIVE'
          }
          localStorage.setItem('user', JSON.stringify(resolvedUser))
        }
      }

      // 3. Check localStorage / sessionStorage
      if (!resolvedUser) {
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
        if (stored) resolvedUser = JSON.parse(stored)
      }

      const cleanName = (s) => (s || '').replace(/^[\"']|[\"']$/g, '').trim()
      if (resolvedUser) {
        setProfile({
          name:  cleanName(resolvedUser.name || resolvedUser.full_name) || userName  || 'User',
          email: cleanName(resolvedUser.email)                          || userEmail || 'user@company.com'
        })
      } else if (userName && userEmail) {
        setProfile({ name: cleanName(userName), email: cleanName(userEmail) })
      }
    } catch (e) {
      console.log('Sidebar session error:', e)
    }
  }, [userName, userEmail])

  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleToggle = () => setMobileOpen(prev => !prev)
    const handleOpen   = () => setMobileOpen(true)
    const handleClose  = () => setMobileOpen(false)
    const handleKey    = (e) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('toggle-supportnova-sidebar', handleToggle)
    window.addEventListener('open-supportnova-sidebar',   handleOpen)
    window.addEventListener('close-supportnova-sidebar',  handleClose)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('toggle-supportnova-sidebar', handleToggle)
      window.removeEventListener('open-supportnova-sidebar',   handleOpen)
      window.removeEventListener('close-supportnova-sidebar',  handleClose)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (mobileOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { if (typeof document !== 'undefined') document.body.style.overflow = '' }
  }, [mobileOpen])

  const sections = rKey === 'admin'
    ? [...new Set(items.map(i => i.section).filter(Boolean))]
    : null

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="sidebar-backdrop"
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(11,14,20,0.72)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 90,
            transition: 'opacity 0.25s ease',
          }}
        />
      )}

      <aside
        className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          background: 'var(--nw-surface)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid var(--nw-border)',
          boxShadow: '4px 0 32px rgba(11,14,20,0.4)',
          width: 250,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo & Mobile Dismiss Header */}
        <div style={{
          padding: '16px 18px 14px',
          borderBottom: '1px solid var(--nw-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Logo size={36} variant="full" />

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="sidebar-mobile-close"
            aria-label="Close menu"
            style={{
              background: 'var(--nw-elevated)',
              border: '1px solid var(--nw-border-strong)',
              borderRadius: 8,
              width: 30, height: 30,
              cursor: 'pointer',
              color: 'var(--nw-text-muted)',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 'bold' }}>✕</span>
          </button>
        </div>

        {/* Role Badge */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--nw-border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10,
            background: meta.accentDim,
            border: `1px solid ${meta.accent}30`,
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: 15 }}>{meta.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: meta.accent }}>{meta.label}</span>
            <div className="pulse-dot" style={{
              marginLeft: 'auto', width: 7, height: 7,
              borderRadius: '50%', background: meta.accent,
            }} />
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {rKey === 'admin' && sections && sections.length > 0 ? (
            sections.map(section => (
              <div key={section} style={{ marginBottom: 6 }}>
                <div style={{
                  fontSize: 9, color: 'var(--nw-text-muted)',
                  letterSpacing: '0.1em', fontWeight: 700,
                  padding: '6px 8px 3px', textTransform: 'uppercase'
                }}>
                  {section}
                </div>
                {items.filter(i => i.section === section).map(item => {
                  const active = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '8px 10px', borderRadius: 9, marginBottom: 1,
                        textDecoration: 'none',
                        background: active ? meta.accentDim : 'transparent',
                        borderLeft: active ? `2.5px solid ${meta.accent}` : '2.5px solid transparent',
                        color: active ? meta.accent : 'var(--nw-text-muted)',
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        transition: 'all 0.15s ease',
                        boxShadow: active ? `0 2px 12px ${meta.accent}18` : 'none',
                      }}
                    >
                      <Icon size={14} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            ))
          ) : (
            <>
              <div style={{
                fontSize: 9, color: 'var(--nw-text-muted)',
                letterSpacing: '0.1em', fontWeight: 700,
                padding: '4px 8px 6px', textTransform: 'uppercase'
              }}>
                NAVIGATION
              </div>
              {items.map(item => {
                const active = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', borderRadius: 9, marginBottom: 2,
                      textDecoration: 'none',
                      background: active ? meta.accentDim : 'transparent',
                      borderLeft: active ? `2.5px solid ${meta.accent}` : '2.5px solid transparent',
                      color: active ? meta.accent : 'var(--nw-text-muted)',
                      fontSize: 13, fontWeight: active ? 600 : 400,
                      transition: 'all 0.15s ease',
                      boxShadow: active ? `0 2px 12px ${meta.accent}18` : 'none',
                    }}
                  >
                    <Icon size={14} />
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* User Footer */}
        <div style={{ padding: 12, borderTop: '1px solid var(--nw-border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 11px', borderRadius: 11,
            background: 'var(--nw-elevated)', border: '1px solid var(--nw-border-strong)',
            transition: 'all 0.2s',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${meta.accent}, ${meta.accent}99)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'var(--nw-text-inverse)',
              boxShadow: `0 4px 10px ${meta.accent}40`,
            }}>
              {(profile.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--nw-text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {profile.name}
              </div>
              <div style={{
                fontSize: 10, color: 'var(--nw-text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {profile.email}
              </div>
            </div>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              style={{
                color: 'var(--nw-text-muted)', display: 'flex',
                padding: 4, borderRadius: 6, transition: 'all 0.15s'
              }}
            >
              <LogOut size={13} />
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
