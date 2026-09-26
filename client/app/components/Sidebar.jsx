'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap, LayoutDashboard, PlusCircle, MessageSquare, Ticket,
  Settings, LogOut, Database, BarChart3, Users,
  Scale, ShieldCheck, FileText, UserCheck, Eye, Building2, FolderTree
} from 'lucide-react'

const NAV = {
  customer: [
    { icon: LayoutDashboard, label: 'Dashboard',         href: '/customer/dashboard' },
    { icon: PlusCircle,      label: 'Submit Webform',     href: '/customer/submit'    },
    { icon: MessageSquare,   label: 'Guided Chat Intake', href: '/customer/chat'      },
    { icon: Ticket,          label: 'My Tickets',         href: '/customer/dashboard' },
  ],
  agent: [
    { icon: LayoutDashboard, label: 'Workspace',          href: '/agent/workspace' },
    { icon: MessageSquare,   label: 'Chat Queue',         href: '/agent/chat-tickets' },
    { icon: Ticket,          label: 'Ticket Queue',        href: '/agent/workspace' },
    { icon: Zap,             label: 'AI Pipeline',         href: '/agent/workspace' },
  ],
  reviewer: [
    { icon: LayoutDashboard, label: 'Review Queue',        href: '/reviewer/queue' },
    { icon: Scale,           label: 'Mismatch Audit',      href: '/reviewer/queue' },
    { icon: ShieldCheck,     label: 'Audit Log',           href: '/reviewer/queue' },
  ],
  admin: [
    { icon: BarChart3,   label: 'Analytics',        href: '/admin/dashboard',  section: 'OVERVIEW'    },
    { icon: FileText,    label: 'All Tickets',       href: '/admin/tickets',    section: 'TICKETS'     },
    { icon: Users,       label: 'Users',             href: '/admin/users',      section: 'PEOPLE'      },
    { icon: Building2,   label: 'Departments',       href: '/admin/departments', section: 'PEOPLE'     },
    { icon: FolderTree,  label: 'Categories',        href: '/admin/categories', section: 'PEOPLE'      },
    { icon: UserCheck,   label: 'Staff Management',  href: '/admin/dashboard',  section: 'PEOPLE'      },
    { icon: Database,    label: 'Knowledge Base',    href: '/admin/policies',   section: 'SYSTEM'      },
    { icon: Settings,    label: 'Rule Matrix',       href: '/admin/dashboard',  section: 'SYSTEM'      },
  ],
}

const ROLE_META = {
  customer: { label: 'Customer Portal',    color: '#7C3AED', bg: '#F5F3FF', emoji: '👤' },
  agent:    { label: 'Agent Workspace',    color: '#059669', bg: '#ECFDF5', emoji: '🎧' },
  reviewer: { label: 'Manager / Reviewer', color: '#D97706', bg: '#FFFBEB', emoji: '⚖️' },
  admin:    { label: 'Admin Center',       color: '#E11D48', bg: '#FFF1F2', emoji: '⚙️' },
}

import { useState, useEffect } from 'react'

export default function Sidebar({ role = 'customer', userName, userEmail }) {
  const pathname = usePathname()
  const rKey = (role || 'customer').toLowerCase()
  const items = NAV[rKey] || NAV.customer
  const meta  = ROLE_META[rKey] || ROLE_META.customer

  const [profile, setProfile] = useState({
    name: userName || 'User',
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
            // Clean URL query without page reload
            const cleanUrl = window.location.pathname
            window.history.replaceState({}, document.title, cleanUrl)
          }
        } catch (err) {
          console.log('Error parsing auth_user:', err)
        }
      }

      // 2. Check document cookies
      if (!resolvedUser) {
        const cookiePairs = document.cookie ? document.cookie.split('; ') : []
        const cookies = {}
        const clean = (s) => (s || '').replace(/^["']|["']$/g, '').trim()
        cookiePairs.forEach(pair => {
          const [k, v] = pair.split('=')
          if (k) cookies[k] = clean(decodeURIComponent(v || ''))
        })

        if (cookies.user_email || cookies.user_name) {
          resolvedUser = {
            name: cookies.user_name,
            email: cookies.user_email,
            role: cookies.user_role || 'CUSTOMER',
            status: cookies.user_status || 'ACTIVE'
          }
          localStorage.setItem('user', JSON.stringify(resolvedUser))
        }
      }

      // 3. Check localStorage / sessionStorage
      if (!resolvedUser) {
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
        if (stored) {
          resolvedUser = JSON.parse(stored)
        }
      }

      const cleanName = (s) => (s || '').replace(/^["']|["']$/g, '').trim()
      if (resolvedUser) {
        setProfile({
          name: cleanName(resolvedUser.name || resolvedUser.full_name) || userName || 'User',
          email: cleanName(resolvedUser.email) || userEmail || 'user@company.com'
        })
      } else if (userName && userEmail) {
        setProfile({ name: cleanName(userName), email: cleanName(userEmail) })
      }
    } catch (e) {
      console.log('Sidebar session error:', e)
    }
  }, [userName, userEmail])

  // group admin items by section safely
  const sections = rKey === 'admin'
    ? [...new Set(items.map(i => i.section).filter(Boolean))]
    : null

  return (
    <aside style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(226,232,240,0.7)',
      boxShadow: '4px 0 32px rgba(148,163,184,0.08)',
      width: 248,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(226,232,240,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(124,58,237,0.35)',
          }} className="animate-float">
            <Zap size={17} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>NovaWear Apparel</div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>AI Intelligence v1.0</div>
          </div>
        </div>
      </div>

      {/* Role Badge */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: meta.bg, border: `1px solid ${meta.color}25`,
          transition: 'all 0.2s',
        }}>
          <span style={{ fontSize: 15 }}>{meta.emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          <div className="pulse-dot" style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        {rKey === 'admin' && sections && sections.length > 0 ? (
          sections.map(section => (
            <div key={section} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#CBD5E1', letterSpacing: '0.1em', fontWeight: 700, padding: '6px 8px 3px', textTransform: 'uppercase' }}>
                {section}
              </div>
              {items.filter(i => i.section === section).map(item => {
                const active = pathname === item.href
                const Icon = item.icon
                const targetHref = item.href || '/admin/dashboard'
                return (
                  <Link key={item.label} href={targetHref} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 10px', borderRadius: 9, marginBottom: 1,
                    textDecoration: 'none',
                    background: active ? `${meta.color}12` : 'transparent',
                    borderLeft: active ? `2.5px solid ${meta.color}` : '2.5px solid transparent',
                    color: active ? meta.color : '#64748B',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s ease',
                    boxShadow: active ? `0 2px 12px ${meta.color}15` : 'none',
                  }}>
                    <Icon size={14} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))
        ) : (
          <>
            <div style={{ fontSize: 9, color: '#CBD5E1', letterSpacing: '0.1em', fontWeight: 700, padding: '4px 8px 6px', textTransform: 'uppercase' }}>
              NAVIGATION
            </div>
            {items.map(item => {
              const active = pathname === item.href
              const Icon = item.icon
              const targetHref = item.href || '/customer/dashboard'
              return (
                <Link key={item.label} href={targetHref} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px', borderRadius: 9, marginBottom: 2,
                  textDecoration: 'none',
                  background: active ? `${meta.color}12` : 'transparent',
                  borderLeft: active ? `2.5px solid ${meta.color}` : '2.5px solid transparent',
                  color: active ? meta.color : '#64748B',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}>
                  <Icon size={14} />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}

        {/* Role Switcher */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(226,232,240,0.5)' }}>
          <div style={{ fontSize: 9, color: '#CBD5E1', letterSpacing: '0.1em', fontWeight: 700, padding: '2px 8px 6px', textTransform: 'uppercase' }}>
            SWITCH ROLE
          </div>
          {Object.entries(ROLE_META).map(([r, m]) => {
            const rHref = r === 'customer' ? '/customer/dashboard' : r === 'agent' ? '/agent/workspace' : r === 'reviewer' ? '/reviewer/queue' : '/admin/dashboard'
            return (
              <Link key={r} href={rHref}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8, marginBottom: 1,
                  textDecoration: 'none',
                  background: r === rKey ? `${m.color}10` : 'transparent',
                  color: r === rKey ? m.color : '#94A3B8',
                  fontSize: 12, fontWeight: r === rKey ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <span>{m.emoji}</span> {m.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User */}
      <div style={{ padding: 12, borderTop: '1px solid rgba(226,232,240,0.5)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 11px', borderRadius: 11,
          background: 'rgba(248,250,252,0.9)', border: '1px solid rgba(226,232,240,0.6)',
          transition: 'all 0.2s',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
            boxShadow: '0 4px 10px rgba(124,58,237,0.3)',
          }}>
            {(profile.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</div>
          </div>
          <Link href="/login" style={{ color: '#94A3B8', display: 'flex', padding: 4, borderRadius: 6, transition: 'all 0.15s' }}>
            <LogOut size={13} />
          </Link>
        </div>
      </div>
    </aside>
  )
}
