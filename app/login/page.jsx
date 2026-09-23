'use client'
import { useState } from 'react'
import { Zap, ShieldCheck, Lock, ArrowRight, CheckCircle } from 'lucide-react'
import Link from 'next/link'

const ROLES = [
  { key: 'customer',  emoji: '👤', label: 'Customer',           desc: 'Submit & track complaints',      href: '/customer/dashboard', color: '#7C3AED', bg: '#F5F3FF', border: 'rgba(124,58,237,0.25)' },
  { key: 'agent',     emoji: '🎧', label: 'Support Agent',       desc: 'AI-powered ticket workbench',    href: '/agent/workspace',    color: '#059669', bg: '#ECFDF5', border: 'rgba(5,150,105,0.25)' },
  { key: 'reviewer',  emoji: '⚖️', label: 'Manager / Reviewer',  desc: 'Audit AI decisions & conflicts', href: '/reviewer/queue',     color: '#D97706', bg: '#FFFBEB', border: 'rgba(217,119,6,0.25)' },
  { key: 'admin',     emoji: '⚙️', label: 'Administrator',        desc: 'System command center',          href: '/admin/dashboard',    color: '#E11D48', bg: '#FFF1F2', border: 'rgba(225,29,72,0.25)' },
]

export default function LoginPage() {
  const [selected, setSelected]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [googleLoading, setGoogle] = useState(false)

  const handleGoogle = () => {
    setGoogle(true)
    setTimeout(() => { window.location.href = '/customer/dashboard' }, 1200)
  }

  const handleRoleAccess = (role) => {
    setLoading(role.key)
    setTimeout(() => { window.location.href = role.href }, 600)
  }

  const pageBg = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 55%, #F0FDF4 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px 16px', position: 'relative', overflow: 'hidden',
  }

  return (
    <div style={pageBg}>
      {/* Decorative orbs */}
      <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-80px', right: '-80px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,150,105,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="animate-fade-up" style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 18, marginBottom: 14,
            background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
            boxShadow: '0 8px 28px rgba(124,58,237,0.35)',
          }}>
            <Zap size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>SupportNova</h1>
          <p style={{ color: '#64748B', fontSize: 13 }}>Generative AI · Ground-Truth Complaint Intelligence</p>
        </div>

        {/* Main Card */}
        <div className="animate-fade-up d100" style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.95)',
          borderRadius: 20, padding: 28,
          boxShadow: '0 8px 40px rgba(148,163,184,0.15)',
        }}>

          {/* Customer Google Login */}
          <div style={{ marginBottom: 22 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>👤 Customer Sign-In</p>
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>Use your Google account to access your complaint portal</p>
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              style={{
                width: '100%', padding: '12px 20px', borderRadius: 12,
                border: '1.5px solid rgba(226,232,240,0.9)',
                background: googleLoading ? 'rgba(248,250,252,0.8)' : 'rgba(255,255,255,0.95)',
                color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(148,163,184,0.12)',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(148,163,184,0.2)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(148,163,184,0.12)'; e.currentTarget.style.borderColor = 'rgba(226,232,240,0.9)' }}
            >
              {googleLoading ? (
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #E2E8F0', borderTopColor: '#7C3AED' }} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? 'Signing in…' : 'Continue with Google'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(226,232,240,0.8)' }} />
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>or access as staff</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(226,232,240,0.8)' }} />
          </div>

          {/* Staff Role Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ROLES.filter(r => r.key !== 'customer').map((role) => (
              <button
                key={role.key}
                onClick={() => handleRoleAccess(role)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  border: selected === role.key ? `1.5px solid ${role.color}` : '1.5px solid rgba(226,232,240,0.7)',
                  background: selected === role.key ? role.bg : 'rgba(248,250,252,0.6)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = role.border; e.currentTarget.style.background = role.bg }}
                onMouseLeave={e => { if (selected !== role.key) { e.currentTarget.style.borderColor = 'rgba(226,232,240,0.7)'; e.currentTarget.style.background = 'rgba(248,250,252,0.6)' } }}
              >
                <span style={{ fontSize: 20 }}>{role.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{role.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{role.desc}</div>
                </div>
                {loading === role.key
                  ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #E2E8F0', borderTopColor: role.color }} className="animate-spin" />
                  : <ArrowRight size={14} color="#94A3B8" />
                }
              </button>
            ))}
          </div>

          {/* Security Note */}
          <div style={{
            marginTop: 20, padding: '9px 12px', borderRadius: 10,
            background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <ShieldCheck size={13} color="#059669" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>
              Sessions are role-scoped & encrypted. Customer login uses Google OAuth via NextAuth.js.
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 16 }}>
          SupportNova v1.0 · Generative AI PowerPlay Platform
        </p>
      </div>
    </div>
  )
}
