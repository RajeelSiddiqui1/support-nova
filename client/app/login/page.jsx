'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Zap, ShieldCheck, ArrowRight, Lock, Mail, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'

const ROLES = [
  { key: 'customer',  emoji: '👤', label: 'Customer Portal',    href: '/customer/dashboard', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'agent',     emoji: '🎧', label: 'Agent Workspace',    href: '/agent/workspace',    color: '#059669', bg: '#ECFDF5' },
  { key: 'reviewer',  emoji: '⚖️', label: 'Manager / Reviewer', href: '/reviewer/queue',     color: '#D97706', bg: '#FFFBEB' },
  { key: 'admin',     emoji: '⚙️', label: 'Admin Center',       href: '/admin/dashboard',    color: '#E11D48', bg: '#FFF1F2' },
]

export default function LoginPage() {
  const [step, setStep]           = useState(1) // 1: Email, 2: Password
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [userInfo, setUserInfo]   = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [googleLoading, setGoogle]= useState(false)

  // Step 1: Check Email Status
  const handleCheckEmail = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('http://localhost:8000/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.detail || 'Email not found. Please try again.')
        setLoading(false)
        return
      }

      setUserInfo(data)

      document.cookie = `user_role=${data.role}; path=/`
      document.cookie = `user_status=${data.status}; path=/`

      if (data.status === 'INACTIVE') {
        setErrorMsg(`Account Suspended: ${data.deactivation_reason || 'Deactivated by Administrator.'}`)
        setLoading(false)
        return
      }

      if (data.must_change_password) {
        window.location.href = `/auth/change-password?email=${encodeURIComponent(email)}`
        return
      }

      setStep(2)
    } catch (err) {
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Validate Password
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.detail || 'Invalid email or password.')
        setLoading(false)
        return
      }

      if (data.must_change_password) {
        window.location.href = `/auth/change-password?email=${encodeURIComponent(email)}`
        return
      }

      const role = data.user?.role || 'CUSTOMER'
      const loggedInUser = data.user || { email, role }
      localStorage.setItem('user', JSON.stringify(loggedInUser))
      sessionStorage.setItem('user', JSON.stringify(loggedInUser))
      if (loggedInUser.user_id) document.cookie = `user_id=${encodeURIComponent(loggedInUser.user_id)}; path=/`
      if (loggedInUser.email) document.cookie = `user_email=${encodeURIComponent(loggedInUser.email)}; path=/`
      if (loggedInUser.name) document.cookie = `user_name=${encodeURIComponent(loggedInUser.name)}; path=/`
      document.cookie = `user_role=${role}; path=/`
      document.cookie = `user_status=ACTIVE; path=/`

      const redirects = {
        CUSTOMER: '/customer/dashboard',
        AGENT: '/agent/workspace',
        REVIEWER: '/reviewer/queue',
        MANAGER: '/reviewer/queue',
        ADMIN: '/admin/dashboard',
      }

      window.location.href = redirects[role] || '/customer/dashboard'
    } catch (err) {
      window.location.href = '/admin/dashboard'
    } finally {
      setLoading(false)
    }
  }

  // Customer Google Login via Backend Redirect
  const handleGoogle = () => {
    setGoogle(true)
    window.location.href = 'http://localhost:8000/api/auth/google'
  }

  const pageBg = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 55%, #F0FDF4 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px 16px', position: 'relative', overflow: 'hidden',
  }

  return (
    <div style={pageBg}>
      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="animate-fade-up" style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 58, height: 58, borderRadius: 18, marginBottom: 12,
            background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
            boxShadow: '0 8px 28px rgba(124,58,237,0.35)',
          }} className="animate-float">
            <Zap size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>SupportNova</h1>
          <p style={{ color: '#64748B', fontSize: 13 }}>AWS-Style Secure Complaint Intelligence Portal</p>
        </div>

        {/* Main Card */}
        <div className="animate-fade-up d100" style={{
          background: 'rgba(255,255,255,0.86)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.95)',
          borderRadius: 20, padding: 28,
          boxShadow: '0 8px 40px rgba(148,163,184,0.15)',
        }}>

          {/* Deactivation Alert */}
          {errorMsg && (
            <div className="animate-shake" style={{
              marginBottom: 18, padding: '12px 14px', borderRadius: 12,
              background: '#FFF1F2', border: '1px solid rgba(225,29,72,0.25)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} color="#E11D48" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#E11D48', marginBottom: 2 }}>Authentication Notice</p>
                <p style={{ fontSize: 12, color: '#9F1239', lineHeight: 1.5 }}>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 1: Enter Email & Google Login */}
          {step === 1 && (
            <div className="animate-fade-in">
              <form onSubmit={handleCheckEmail}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Sign in to SupportNova
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(226,232,240,0.9)', background: 'rgba(248,250,252,0.9)' }}>
                    <Mail size={16} color="#94A3B8" />
                    <input
                      type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address…"
                      style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, color: '#0F172A', width: '100%' }}
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                    color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(124,58,237,0.35)', transition: 'all 0.2s', marginBottom: 16
                  }}
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <>Next <ArrowRight size={15} /></>}
                </button>
              </form>

              {/* Google OAuth Divider & Button on Step 1 for Customer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(226,232,240,0.8)' }} />
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>or Customer Google Sign-In</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(226,232,240,0.8)' }} />
              </div>

              <button
                type="button" onClick={handleGoogle} disabled={googleLoading}
                style={{
                  width: '100%', padding: '11px 18px', borderRadius: 11,
                  border: '1.5px solid rgba(226,232,240,0.9)', background: 'rgba(255,255,255,0.95)',
                  color: '#0F172A', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  boxShadow: '0 2px 10px rgba(148,163,184,0.08)', transition: 'all 0.2s',
                }}
              >
                {googleLoading ? <RefreshCw size={14} className="animate-spin" /> : (
                  <svg width="16" height="16" viewBox="0 0 18 18">
                    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </button>
            </div>
          )}

          {/* STEP 2: Password */}
          {step === 2 && (
            <form onSubmit={handleLoginSubmit} className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '8px 12px', borderRadius: 10, background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(226,232,240,0.8)' }}>
                <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{email}</span>
                <button type="button" onClick={() => { setStep(1); setErrorMsg('') }} style={{ background: 'none', border: 'none', color: '#7C3AED', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Change</button>
              </div>

              {/* Password Input */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
                  <Link href={`/auth/forgot-password?email=${encodeURIComponent(email)}`} style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(226,232,240,0.9)', background: 'rgba(248,250,252,0.9)' }}>
                  <Lock size={16} color="#94A3B8" />
                  <input
                    type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password…"
                    style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, color: '#0F172A', width: '100%' }}
                  />
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                  color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(124,58,237,0.35)', transition: 'all 0.2s'
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Sign In'}
              </button>
            </form>
          )}

          {/* Quick Staff Switcher for Preview */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(226,232,240,0.6)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'center' }}>
              Direct Preview Links
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {ROLES.map(r => (
                <Link key={r.key} href={r.href || '/login'} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: r.bg, border: `1px solid ${r.color}25`, fontSize: 11, fontWeight: 600, color: r.color, textAlign: 'center' }}>
                    {r.emoji} {r.label}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
