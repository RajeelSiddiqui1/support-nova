'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap, ShieldCheck, ArrowRight, Lock, Mail, AlertTriangle, CheckCircle, RefreshCw, UserCheck, ShieldAlert } from 'lucide-react'
import Logo from '../components/Logo'

const ROLES = [
  { key: 'customer',  emoji: '👤', label: 'Customer Portal',    href: '/customer/dashboard', color: '#C96F4A', bg: 'rgba(201,111,74,0.15)' },
  { key: 'agent',     emoji: '🎧', label: 'Agent Workspace',    href: '/agent/workspace',    color: '#4FA689', bg: 'rgba(79,166,137,0.14)' },
  { key: 'reviewer',  emoji: '⚖️', label: 'Manager / Reviewer', href: '/reviewer/queue',     color: '#C9A227', bg: 'rgba(201,162,39,0.13)' },
  { key: 'admin',     emoji: '⚙️', label: 'Admin Center',       href: '/admin/dashboard',    color: '#C1495B', bg: 'rgba(193,73,91,0.14)' },
]

import { API_BASE } from '../lib/api'

export default function LoginPage() {
  const [step, setStep]           = useState(1) // 1: Email, 2: Password
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [userInfo, setUserInfo]   = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [googleLoading, setGoogle]= useState(false)

  // Detect URL errors from backend redirects (e.g. Staff blocked from Google login)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      const reason = params.get('reason')
      const role = params.get('role')

      if (error === 'staff_google_denied') {
        const roleLabel = role ? role.toUpperCase() : 'Staff'
        setErrorMsg(
          reason
            ? decodeURIComponent(reason)
            : `Access Denied: ${roleLabel} accounts cannot log in via Google. Please use your staff Email & Password.`
        )
      } else if (error === 'account_deactivated') {
        setErrorMsg(
          reason
            ? decodeURIComponent(reason)
            : 'Account Suspended: Deactivated by Administrator.'
        )
      } else if (error === 'google_access_denied') {
        setErrorMsg('Google Sign-In was cancelled or failed. Please try again.')
      } else if (error === 'customer_login_required') {
        setErrorMsg('Please sign in with Google to access the customer portal or submit a complaint.')
      }
    }
  }, [])

  // Step 1: Check Email Status
  const handleCheckEmail = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch(`${API_BASE}/api/auth/check-email`, {
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
      const res = await fetch(`${API_BASE}/api/auth/login`, {
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

      const role = String(data.user?.role || userInfo?.role || 'CUSTOMER').toUpperCase()
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

      const params = new URLSearchParams(window.location.search)
      const redirectParam = params.get('redirect')
      let targetUrl = redirects[role] || '/customer/dashboard'
      if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('/login')) {
        targetUrl = redirectParam
      }

      window.location.href = targetUrl
    } catch (err) {
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  // Customer Google Login via Backend Redirect
  const handleGoogle = () => {
    setGoogle(true)
    window.location.href = `${API_BASE}/api/auth/google`
  }

  const pageBg = {
    minHeight: '100vh',
    background: 'var(--nw-base)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px 16px', position: 'relative', overflow: 'hidden',
  }

  return (
    <div style={pageBg}>
      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="animate-fade-up" style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo size={56} variant="full" />
        </div>

        {/* Main Card */}
        <div className="animate-fade-up d100" style={{
          background: 'var(--nw-surface)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--nw-border)',
          borderRadius: 20, padding: 28,
          boxShadow: '0 8px 40px rgba(11,14,20,0.4)',
        }}>

          {/* Deactivation Alert */}
          {errorMsg && (
            <div className="animate-shake" style={{
              marginBottom: 18, padding: '12px 14px', borderRadius: 12,
              background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.35)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} color="var(--nw-danger)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-danger)', marginBottom: 2 }}>Authentication Notice</p>
                <p style={{ fontSize: 12, color: '#E8758A', lineHeight: 1.5 }}>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 1: Enter Email & Google Login */}
          {step === 1 && (
            <div className="animate-fade-in">
              <form onSubmit={handleCheckEmail}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Staff Login (Email &amp; Password)
                    </label>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#4FA689', background: 'rgba(79,166,137,0.14)', padding: '2px 6px', borderRadius: 4 }}>
                      Staff Only
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--nw-text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>
                    Admin, Manager, Reviewer, and Agents must sign in with their staff email &amp; password.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--nw-border-strong)', background: 'var(--nw-elevated)' }}>
                    <Mail size={16} color="var(--nw-text-muted)" />
                    <input
                      type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter staff email address…"
                      style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, color: 'var(--nw-text-primary)', width: '100%' }}
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                    background: 'var(--nw-accent)',
                    color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(201,111,74,0.35)', transition: 'all 0.2s', marginBottom: 16
                  }}
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <>Continue with Email <ArrowRight size={15} /></>}
                </button>
              </form>

              {/* Google OAuth Divider & Button on Step 1 for Customer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--nw-border)' }} />
                <span style={{ fontSize: 11, color: 'var(--nw-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer Portal</span>
                <div style={{ flex: 1, height: 1, background: 'var(--nw-border)' }} />
              </div>

              <div style={{ marginBottom: 10, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--nw-text-secondary)', lineHeight: 1.4, margin: '0 0 10px 0' }}>
                  Customers must log in exclusively using Google. (Email &amp; password login is prohibited for customers).
                </p>
              </div>

              <button
                type="button" onClick={handleGoogle} disabled={googleLoading}
                style={{
                  width: '100%', padding: '11px 18px', borderRadius: 11,
                  border: '1.5px solid rgba(201,111,74,0.3)', background: 'var(--nw-elevated)',
                  color: 'var(--nw-text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  boxShadow: '0 2px 10px rgba(11,14,20,0.3)', transition: 'all 0.2s',
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
                Customer Sign In with Google
              </button>
            </div>
          )}

          {/* STEP 2: Password */}
          {step === 2 && (
            <form onSubmit={handleLoginSubmit} className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '8px 12px', borderRadius: 10, background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--nw-text-primary)', fontWeight: 600 }}>{email}</span>
                <button type="button" onClick={() => { setStep(1); setErrorMsg('') }} style={{ background: 'none', border: 'none', color: 'var(--nw-accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Change</button>
              </div>

              {/* Password Input */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
                  <Link href={`/auth/forgot-password?email=${encodeURIComponent(email)}`} style={{ fontSize: 11, color: 'var(--nw-accent)', fontWeight: 600, textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--nw-border-strong)', background: 'var(--nw-elevated)' }}>
                  <Lock size={16} color="var(--nw-text-muted)" />
                  <input
                    type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password…"
                    style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, color: 'var(--nw-text-primary)', width: '100%' }}
                  />
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                  background: 'var(--nw-accent)',
                  color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(201,111,74,0.35)', transition: 'all 0.2s'
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Sign In'}
              </button>
            </form>
          )}

          {/* Quick Staff Switcher for Preview */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--nw-border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'center' }}>
              Direct Preview Links
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {ROLES.map(r => (
                <Link key={r.key} href={r.href || '/login'} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '6px 8px', borderRadius: 8, background: r.bg, border: `1px solid ${r.color}40`, fontSize: 11, fontWeight: 600, color: r.color, textAlign: 'center' }}>
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
