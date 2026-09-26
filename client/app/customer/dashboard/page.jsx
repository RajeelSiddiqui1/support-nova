'use client'
import { useState, useEffect } from 'react'
import { useRealtimeRefresh } from '../../lib/useWebSocket'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import Link from 'next/link'
import { Ticket, CheckCircle, Clock, PlusCircle, Star, ChevronRight, AlertCircle, X, Zap, Building2, User } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const CHART = [
  { month: 'Apr', v: 4 }, { month: 'May', v: 7 }, { month: 'Jun', v: 3 },
  { month: 'Jul', v: 9 }, { month: 'Aug', v: 5 }, { month: 'Sep', v: 2 },
]

const TIMELINE = [
  { label: 'Complaint Submitted',  done: true,  active: false, date: 'Sep 23, 11:42 AM' },
  { label: 'AI Pipeline Analysis', done: true,  active: false, date: 'Sep 23, 11:42 AM', tag: '⚡ 1.4s' },
  { label: 'Agent Assigned',       done: true,  active: false, date: 'Sep 23, 12:05 PM' },
  { label: 'Awaiting Resolution',  done: false, active: true,  date: 'In Progress…' },
  { label: 'Resolved & Closed',    done: false, active: false, date: '—' },
]

const STATUS_COLORS = {
  'In Triage': { bg: '#FFFBEB', color: '#D97706', border: 'rgba(217,119,6,0.25)' },
  'In Progress': { bg: '#EFF6FF', color: '#2563EB', border: 'rgba(37,99,235,0.25)' },
  'Escalated': { bg: '#FFF1F2', color: '#E11D48', border: 'rgba(225,29,72,0.25)' },
  'AI Review': { bg: '#F5F3FF', color: '#7C3AED', border: 'rgba(124,58,237,0.25)' },
  'Resolved':  { bg: '#ECFDF5', color: '#059669', border: 'rgba(5,150,105,0.25)'  },
  'Closed':    { bg: '#F8FAFC', color: '#64748B', border: 'rgba(100,116,139,0.2)' },
}

const P_COLORS = {
  P0: { bg: '#FFF1F2', color: '#E11D48' },
  P1: { bg: '#FFFBEB', color: '#D97706' },
  P2: { bg: '#EFF6FF', color: '#2563EB' },
  P3: { bg: '#F8FAFC', color: '#64748B' },
}

const glass = { background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 16, boxShadow: '0 4px 24px rgba(148,163,184,0.1)' }

const CustomTip = ({ active, payload, label }) => active && payload?.length ? (
  <div style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 8px 24px rgba(148,163,184,0.15)' }}>
    <p style={{ color: '#94A3B8', fontSize: 11 }}>{label}</p>
    <p style={{ color: '#7C3AED', fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{payload[0].value} tickets</p>
  </div>
) : null

const cleanStr = (val) => {
  if (!val) return ''
  return String(val).replace(/^["']|["']$/g, '').trim()
}

export default function CustomerDashboard() {
  const [filter, setFilter] = useState('All')
  const [user, setUser] = useState({ name: 'Valued Customer', email: '' })
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  // Selected Detail View Modal State
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Live WebSocket Real-time sync (zero reload)
  const { isConnected: wsConnected } = useRealtimeRefresh(
    () => {
      const uId = user?.user_id || user?.id
      const uEmail = user?.email
      if (uId || uEmail) {
        fetchCustomerTickets(uId, uEmail, true)
      }
      if (selectedTicket?.ticket_id) {
        openTicketDetail(selectedTicket.ticket_id, tickets, true)
      }
    },
    ['TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_REASSIGNED', 'REVIEWER_ACTION']
  )

  const fetchCustomerTickets = async (userId, email, isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const cId = cleanStr(userId)
      const cEmail = cleanStr(email)
      const params = new URLSearchParams()
      if (cId) params.set('customer_id', cId)
      if (cEmail) params.set('customer_email', cEmail)

      const res = await fetch(`${API_BASE}/api/tickets?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load tickets')
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setTickets(list)

      // Auto-open ticket if specified in URL query
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const ticketParam = urlParams.get('ticket')
        if (ticketParam) {
          openTicketDetail(ticketParam, list)
        }
      }
    } catch (e) {
      if (!isBackground) setTickets([])
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  const openTicketDetail = async (ticketId, ticketList = tickets) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedTicket(data)
      } else {
        const match = ticketList.find(t => t.ticket_id === ticketId)
        if (match) setSelectedTicket(match)
      }
    } catch (e) {
      const match = ticketList.find(t => t.ticket_id === ticketId)
      if (match) setSelectedTicket(match)
    } finally {
      setLoadingDetail(false)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('ticket', ticketId)
        window.history.pushState(null, '', url.pathname + url.search)
      }
    }
  }

  const closeTicketDetail = () => {
    setSelectedTicket(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('ticket')
      window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''))
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      let resolvedUser = null

      // 1. Check URL query string for auth_user (Google OAuth redirect)
      const params = new URLSearchParams(window.location.search)
      const authUserParam = params.get('auth_user')

      if (authUserParam) {
        try {
          const decoded = JSON.parse(decodeURIComponent(authUserParam))
          if (decoded && (decoded.name || decoded.email)) {
            resolvedUser = decoded
            localStorage.setItem('user', JSON.stringify(decoded))
          }
        } catch (e) {}
      }

      // 2. Check cookies
      if (!resolvedUser) {
        const cookiePairs = document.cookie ? document.cookie.split('; ') : []
        const cookies = {}
        cookiePairs.forEach(pair => {
          const [k, v] = pair.split('=')
          if (k) cookies[k] = cleanStr(decodeURIComponent(v || ''))
        })

        if (cookies.user_email || cookies.user_id) {
          resolvedUser = {
            user_id: cookies.user_id,
            name: cookies.user_name,
            email: cookies.user_email,
            role: cookies.user_role || 'CUSTOMER'
          }
          localStorage.setItem('user', JSON.stringify(resolvedUser))
        }
      }

      // 3. Fallback to localStorage
      if (!resolvedUser) {
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
        if (stored) resolvedUser = JSON.parse(stored)
      }

      const userIdCookie = document.cookie
        .split('; ')
        .find(cookie => cookie.startsWith('user_id='))
        ?.slice('user_id='.length)

      if (resolvedUser && !resolvedUser.user_id && userIdCookie) {
        resolvedUser = { ...resolvedUser, user_id: cleanStr(decodeURIComponent(userIdCookie)) }
        localStorage.setItem('user', JSON.stringify(resolvedUser))
      }

      if (resolvedUser) {
        const currentUser = {
          user_id: cleanStr(resolvedUser.user_id),
          name: cleanStr(resolvedUser.name || resolvedUser.full_name) || 'Valued Customer',
          email: cleanStr(resolvedUser.email)
        }
        setUser(currentUser)
        if (currentUser.user_id || currentUser.email) fetchCustomerTickets(currentUser.user_id, currentUser.email)
        else setLoading(false)
      } else {
        setLoading(false)
      }
    } catch (e) {
      console.log('Session read error:', e)
      setLoading(false)
    }
  }, [])

  const activeTickets = tickets.filter(t => !['Resolved', 'Closed'].includes(t.status)).length
  const resolvedTickets = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length
  const filtered = filter === 'All' ? tickets : tickets.filter(t => t.status === filter)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="customer" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Navbar title="Customer Portal" subtitle="Manage and track your complaints" />

        <main style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Welcome Banner */}
          <div className="animate-fade-up" style={{
            ...glass,
            padding: '22px 26px',
            background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(79,70,229,0.04))',
            border: '1px solid rgba(124,58,237,0.15)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 19, fontWeight: 700, color: '#0F172A', margin: 0 }}>Welcome back, {user.name} 👋</h2>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: wsConnected ? '#ECFDF5' : '#FEF2F2',
                  color: wsConnected ? '#059669' : '#DC2626',
                  border: wsConnected ? '1px solid #A7F3D0' : '1px solid #FECACA',
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: wsConnected ? '#10B981' : '#EF4444', display: 'inline-block' }} />
                  {wsConnected ? 'Live Updates Active' : 'WS Reconnecting'}
                </span>
              </div>
              <p style={{ color: '#64748B', fontSize: 13, margin: '5px 0 0' }}>
                You have <span style={{ color: '#D97706', fontWeight: 600 }}>{activeTickets} active tickets</span>.
              </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/customer/chat" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', borderRadius: 11, textDecoration: 'none',
                background: 'linear-gradient(135deg,#059669,#10B981)',
                color: 'white', fontSize: 13, fontWeight: 600,
                boxShadow: '0 4px 16px rgba(5,150,105,0.25)',
                transition: 'all 0.2s',
              }}>
                💬 Guided Chat Intake
              </Link>

              <Link href="/customer/submit" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', borderRadius: 11, textDecoration: 'none',
                background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                color: 'white', fontSize: 13, fontWeight: 600,
                boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                transition: 'all 0.2s',
              }}>
                <PlusCircle size={14} /> Submit Webform
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            <StatCard title="Total Submitted" value={tickets.length} subtitle="All time" icon={Ticket} color="violet" delay={0} />
            <StatCard title="Active Tickets"  value={activeTickets} subtitle="Pending" icon={Clock} color="amber" delay={80} />
            <StatCard title="Resolved" value={resolvedTickets} subtitle="Closed" icon={CheckCircle} color="emerald" delay={160} />
            <StatCard title="Avg Resolution"  value="18h" subtitle="Turn-around" icon={Star}     color="cyan"                                delay={240} />
          </div>

          {/* Table + Sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

            {/* Ticket Table */}
            <div className="animate-fade-up d200" style={{ ...glass, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>My Complaint History</h3>
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{tickets.length} total complaints</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['All', 'In Triage', 'In Progress', 'Resolved'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: filter === f ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(226,232,240,0.7)',
                        background: filter === f ? 'rgba(124,58,237,0.08)' : 'rgba(248,250,252,0.7)',
                        color: filter === f ? '#7C3AED' : '#64748B',
                      }}
                    >{f}</button>
                  ))}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr>
                      {['Ticket ID', 'Category', 'Date', 'Dept', 'Priority', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(226,232,240,0.6)', background: 'rgba(248,250,252,0.6)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Loading complaints...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>No complaints found.</td></tr>
                    ) : filtered.map((t) => {
                      const s = STATUS_COLORS[t.status] || STATUS_COLORS['Closed']
                      const pc = P_COLORS[t.priority] || P_COLORS.P3
                      return (
                        <tr key={t.ticket_id} style={{ transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td
                            onClick={() => openTicketDetail(t.ticket_id)}
                            style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#7C3AED', fontWeight: 600, cursor: 'pointer' }}
                          >
                            {t.ticket_id}
                          </td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{t.category || 'General'}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{t.sub_category || 'General Inquiry'}</div>
                          </td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)', fontSize: 11, color: '#94A3B8' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)', fontSize: 11, color: '#64748B', background: 'rgba(248,250,252,0.5)', borderRadius: 6 }}>{t.customer_department || t.department || '—'}</td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: pc.bg, color: pc.color, fontFamily: 'monospace' }}>{t.priority || 'P3'}</span>
                          </td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{t.status}</span>
                          </td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <button
                              onClick={() => openTicketDetail(t.ticket_id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#7C3AED', background: 'rgba(124,58,237,0.07)', padding: '4px 9px', borderRadius: 7, border: '1px solid rgba(124,58,237,0.15)', cursor: 'pointer' }}
                            >
                              View <ChevronRight size={10} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Col */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Chart */}
              <div className="animate-fade-up d300" style={{ ...glass, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Complaint Trend</h3>
                <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 14 }}>Last 6 months</p>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={CHART}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTip />} />
                    <Area type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={2} fill="url(#g1)" dot={{ fill: '#7C3AED', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Timeline */}
              <div className="animate-fade-up d400" style={{ ...glass, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>Active Ticket</h3>
                <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED', fontWeight: 600, marginBottom: 14 }}>
                  {tickets.length > 0 ? tickets[0].ticket_id : 'CMP-00421'}
                </p>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 1, background: 'rgba(226,232,240,0.8)' }} />
                  {TIMELINE.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 11, marginBottom: 13, alignItems: 'flex-start', position: 'relative' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                        background: s.done ? '#059669' : s.active ? '#7C3AED' : '#E2E8F0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: s.active ? '0 0 0 4px rgba(124,58,237,0.15)' : 'none',
                      }}>
                        {s.done && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        {s.active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: s.active ? 600 : 400, color: s.done || s.active ? '#0F172A' : '#94A3B8' }}>{s.label}</p>
                        <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                          {s.date} {s.tag && <span style={{ color: '#059669', fontFamily: 'monospace' }}>{s.tag}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Customer Ticket Detail Modal */}
        {selectedTicket && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <div style={{
              ...glass, background: '#FFFFFF', width: '100%', maxWidth: 720,
              maxHeight: '90vh', overflowY: 'auto', padding: 26, position: 'relative',
              borderRadius: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#7C3AED15', color: '#7C3AED', fontFamily: 'monospace' }}>
                      {selectedTicket.ticket_id}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: selectedTicket.channel === 'Chat' ? '#F5F3FF' : '#EFF6FF', color: selectedTicket.channel === 'Chat' ? '#7C3AED' : '#2563EB', border: '1px solid rgba(124,58,237,0.2)' }}>
                      {selectedTicket.channel === 'Chat' ? '💬 Channel: Guided Chat' : '📄 Channel: Web Form'}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: (STATUS_COLORS[selectedTicket.status] || STATUS_COLORS['Closed']).bg, color: (STATUS_COLORS[selectedTicket.status] || STATUS_COLORS['Closed']).color }}>
                      {selectedTicket.status}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{selectedTicket.title}</h2>
                </div>
                
                <button
                  onClick={closeTicketDetail}
                  style={{ border: 'none', background: '#F1F5F9', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Grid Meta Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: '#F8FAFC', padding: 14, borderRadius: 14, border: '1px solid #E2E8F0', marginBottom: 18, fontSize: 12.5 }}>
                <div><span style={{ color: '#64748B' }}>Category:</span> <strong style={{ color: '#0F172A' }}>{selectedTicket.category || 'General'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Sub-Category:</span> <strong style={{ color: '#0F172A' }}>{selectedTicket.sub_category || 'General Inquiry'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Department:</span> <strong style={{ color: '#7C3AED' }}>{selectedTicket.customer_department || selectedTicket.department || 'Support'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Order ID:</span> <strong style={{ fontFamily: 'monospace', color: '#0F172A' }}>{selectedTicket.order_id || 'N/A'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Product/Service:</span> <strong style={{ color: '#0F172A' }}>{selectedTicket.product_service || 'N/A'}</strong></div>
                <div><span style={{ color: '#64748B' }}>Date Submitted:</span> <strong style={{ color: '#0F172A' }}>{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : 'N/A'}</strong></div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 18 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Complaint Description
                </h4>
                <div style={{ background: '#FFF', border: '1px solid #CBD5E1', padding: 14, borderRadius: 12, fontSize: 13, color: '#1E293B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  "{selectedTicket.description}"
                </div>
              </div>

              {/* AI Resolution Status & Agent Notes */}
              <div style={{ background: 'linear-gradient(135deg,#F5F3FF 0%,#EEF2FF 100%)', border: '1px solid rgba(124,58,237,0.2)', padding: 16, borderRadius: 14, marginBottom: 18 }}>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={15} /> AI Pipeline & Support Status Breakdown
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                  <div>AI Issue Priority: <strong style={{ color: (P_COLORS[selectedTicket.priority] || P_COLORS.P3).color }}>{selectedTicket.priority || 'P2'}</strong></div>
                  <div>Department Routing: <strong>{selectedTicket.department || 'Customer Support'}</strong></div>
                  {selectedTicket.genai_output?.policy_id && (
                    <div>Matched Policy ID: <strong style={{ color: '#7C3AED', fontFamily: 'monospace' }}>{selectedTicket.genai_output.policy_id}</strong></div>
                  )}
                  {selectedTicket.genai_output?.sentiment && (
                    <div>Sentiment Analysis: <strong>{selectedTicket.genai_output.sentiment}</strong></div>
                  )}
                </div>

                {selectedTicket.agent_notes && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(124,58,237,0.15)' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4338CA' }}>Agent Resolution Note:</span>
                    <p style={{ fontSize: 12.5, color: '#1E1B4B', marginTop: 3, fontStyle: 'italic', background: '#FFF', padding: 8, borderRadius: 8, border: '1px solid rgba(124,58,237,0.15)' }}>
                      "{selectedTicket.agent_notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeTicketDetail}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#7C3AED', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Close Detail View
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
