'use client'
import { Bell, Search, Menu } from 'lucide-react'
import { useState } from 'react'

const NOTIFS = [
  { msg: 'Ticket CMP-00412 resolved', time: '2m ago', color: '#059669' },
  { msg: 'AI Mismatch on CMP-00408', time: '15m ago', color: '#D97706' },
  { msg: 'SLA breach risk: CMP-00405', time: '1h ago', color: '#E11D48' },
]

export default function Navbar({ title, subtitle, onMenuClick }) {
  const [notifOpen, setNotifOpen] = useState(false)

  const handleToggle = () => {
    if (onMenuClick) onMenuClick()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toggle-supportnova-sidebar'))
    }
  }

  return (
    <header style={{
      height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(226,232,240,0.6)',
      position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
      width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={handleToggle}
          className="sidebar-toggle-btn"
          aria-label="Toggle navigation menu"
          style={{
            background: 'rgba(248,250,252,0.9)',
            border: '1px solid rgba(226,232,240,0.8)',
            cursor: 'pointer',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 7,
            borderRadius: 9,
            flexShrink: 0,
          }}
        >
          <Menu size={18} />
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{
            fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {title}
          </h1>
          {subtitle && (
            <p className="hide-on-mobile" style={{
              fontSize: 11, color: '#94A3B8', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 9,
          background: 'rgba(248,250,252,0.9)', border: '1px solid rgba(226,232,240,0.8)',
          maxWidth: 160,
        }}>
          <Search size={12} color="#94A3B8" style={{ flexShrink: 0 }} />
          <input
            placeholder="Search…"
            style={{
              background: 'none', border: 'none', outline: 'none', color: '#64748B',
              fontSize: 12, width: '100%', minWidth: 50
            }}
          />
        </div>

        {/* Notif */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
            style={{
              width: 34, height: 34, borderRadius: 9, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', position: 'relative',
              background: 'rgba(248,250,252,0.9)', border: '1px solid rgba(226,232,240,0.8)',
              color: '#64748B',
            }}
          >
            <Bell size={14} />
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 7, height: 7, borderRadius: '50%', background: '#E11D48',
              border: '1.5px solid white',
            }} />
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              width: 'min(280px, calc(100vw - 32px))',
              background: 'rgba(255,255,255,0.98)', borderRadius: 14,
              border: '1px solid rgba(226,232,240,0.8)',
              boxShadow: '0 20px 60px rgba(148,163,184,0.2)', zIndex: 200,
              backdropFilter: 'blur(20px)',
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(226,232,240,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Notifications</span>
                <span style={{ fontSize: 10, background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>3 new</span>
              </div>
              {NOTIFS.map((n, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 9, padding: '10px 14px',
                  borderBottom: i < NOTIFS.length - 1 ? '1px solid rgba(226,232,240,0.4)' : 'none',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.color, marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>{n.msg}</p>
                    <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{n.time}</p>
                  </div>
                </div>
              ))}
              <div style={{ padding: '9px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#7C3AED', cursor: 'pointer', fontWeight: 600 }}>View all</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
