'use client'
import { useState, useEffect } from 'react'
import { useRealtimeRefresh } from '../../lib/useWebSocket'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import ClarificationCard from '../../components/ClarificationCard'
import ComplaintSummary from '../../components/ComplaintSummary'
import FollowUpTimeline from '../../components/FollowUpTimeline'
import IssueBadges from '../../components/IssueBadges'
import RepeatBadge from '../../components/RepeatBadge'
import DeptRouting from '../../components/DeptRouting'
import Link from 'next/link'
import { Ticket, CheckCircle, Clock, PlusCircle, Star, ChevronRight, AlertCircle, X, Zap, Building2, User } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

import { API_BASE } from '../../lib/api'

const CHART = [
  { month: 'Apr', v: 4 }, { month: 'May', v: 7 }, { month: 'Jun', v: 3 },
  { month: 'Jul', v: 9 }, { month: 'Aug', v: 5 }, { month: 'Sep', v: 2 },
]

const STATUS_COLORS = {
  'In Triage':   { bg: 'var(--nw-warning-dim)', color: 'var(--nw-warning)', border: 'rgba(217,164,65,0.3)' },
  'In Progress': { bg: 'var(--nw-info-dim)',    color: 'var(--nw-info)',    border: 'rgba(74,155,201,0.3)' },
  'Escalated':   { bg: 'var(--nw-danger-dim)',  color: 'var(--nw-danger)',  border: 'rgba(193,73,91,0.3)' },
  'AI Review':   { bg: 'var(--nw-accent-dim)',  color: 'var(--nw-accent)',  border: 'rgba(201,111,74,0.3)' },
  'Resolved':    { bg: 'var(--nw-success-dim)', color: 'var(--nw-success)', border: 'rgba(79,166,137,0.3)' },
  'Closed':      { bg: 'rgba(154,156,165,0.1)', color: 'var(--nw-text-muted)', border: 'var(--nw-border)' },
}

const P_COLORS = {
  P0: { bg: 'var(--nw-danger-dim)',  color: '#E8758A' },
  P1: { bg: 'var(--nw-warning-dim)', color: '#E8B56B' },
  P2: { bg: 'var(--nw-info-dim)',    color: '#72B4D8' },
  P3: { bg: 'rgba(154,156,165,0.1)', color: 'var(--nw-text-muted)' },
}

const glass = {
  background: 'var(--nw-surface)',
  border: '1px solid var(--nw-border)',
  borderRadius: 16,
  boxShadow: '0 4px 24px rgba(11,14,20,0.3)'
}

const CustomTip = ({ active, payload, label }) => active && payload?.length ? (
  <div style={{ background: 'var(--nw-elevated)', border: '1px solid var(--nw-border-strong)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 8px 24px rgba(11,14,20,0.5)' }}>
    <p style={{ color: 'var(--nw-text-muted)', fontSize: 11 }}>{label}</p>
    <p style={{ color: 'var(--nw-accent)', fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{payload[0].value} tickets</p>
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
    } catch (err) {
      console.error('Error fetching customer tickets:', err)
      setTickets([])
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  // Load User profile & their tickets
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      let resolvedUser = null
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      if (stored) resolvedUser = JSON.parse(stored)

      if (resolvedUser) {
        const name = cleanStr(resolvedUser.name || resolvedUser.full_name) || 'Valued Customer'
        const email = cleanStr(resolvedUser.email) || ''
        const uId = cleanStr(resolvedUser.user_id || resolvedUser.id)
        setUser({ ...resolvedUser, name, email, user_id: uId })
        fetchCustomerTickets(uId, email)
      } else {
        // Strict guard: unauthenticated users redirect to /login
        window.location.href = '/login?error=customer_login_required'
      }
    } catch (e) {
      console.error('Customer dashboard session error:', e)
      window.location.href = '/login?error=customer_login_required'
    }
  }, [])

  // Open & Fetch latest ticket details for the modal
  const openTicketDetail = async (ticketId, currentList = tickets, silent = false) => {
    if (!silent) setLoadingDetail(true)
    const fallback = currentList.find(t => t.ticket_id === ticketId)
    if (fallback && !silent) setSelectedTicket(fallback)

    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketId}`)
      if (res.ok) {
        const fullDetail = await res.json()
        setSelectedTicket(fullDetail)
      }
    } catch (err) {
      console.error('Error loading full ticket detail:', err)
    } finally {
      if (!silent) setLoadingDetail(false)
    }
  }

  const closeTicketDetail = () => {
    setSelectedTicket(null)
    if (typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, document.title, cleanUrl)
    }
  }

  const filtered = tickets.filter(t => filter === 'All' ? true : t.status === filter)
  const openCount = tickets.filter(t => ['In Triage', 'In Progress', 'AI Review', 'Escalated'].includes(t.status)).length
  const resolvedCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--nw-base)' }}>
      <Sidebar role="customer" userName={user.name} userEmail={user.email} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar
          title="Customer Portal"
          subtitle={`Welcome back, ${user.name} — NovaWear Support`}
        />

        <main style={{ flex: 1, overflowY: 'auto', padding: 22 }} className="responsive-main-padding">

          {/* Top Banner */}
          <div className="animate-fade-up" style={{
            background: 'linear-gradient(135deg, rgba(201,111,74,0.18) 0%, rgba(201,162,39,0.12) 100%)',
            border: '1px solid rgba(201,111,74,0.3)',
            borderRadius: 18, padding: '22px 26px', marginBottom: 22,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
            boxShadow: '0 8px 32px rgba(11,14,20,0.4)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>👕</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  NovaWear Apparel Care
                </span>
                <span style={{ fontSize: 10, background: 'var(--nw-elevated)', color: 'var(--nw-text-secondary)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--nw-border-strong)' }}>
                  Customer Support Intelligence
                </span>
                {wsConnected && (
                  <span style={{ fontSize: 10, background: 'var(--nw-success-dim)', color: 'var(--nw-success)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(79,166,137,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nw-success)' }} /> Live Sync
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--nw-text-primary)', letterSpacing: '-0.3px' }}>
                Need help with your order or clothing item?
              </h2>
              <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', marginTop: 4 }}>
                Track existing complaints, submit evidence, or open a live resolution request.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Link href="/customer/chat" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', borderRadius: 11,
                background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)',
                border: '1px solid var(--nw-border-strong)', textDecoration: 'none',
                fontSize: 12.5, fontWeight: 600,
              }}>
                💬 Guided AI Intake
              </Link>
              <Link href="/customer/submit" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', borderRadius: 11,
                background: 'var(--nw-accent)', color: 'var(--nw-text-inverse)',
                textDecoration: 'none', fontSize: 12.5, fontWeight: 700,
                boxShadow: '0 4px 15px rgba(201,111,74,0.4)',
              }}>
                <PlusCircle size={15} /> New Webform
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
            <StatCard title="Total Filed" value={tickets.length} subtitle="Lifetime complaints" color="terracotta" icon={Ticket} delay={0} />
            <StatCard title="Under Triage" value={openCount} subtitle="Active pipeline" color="gold" icon={Clock} delay={80} />
            <StatCard title="Resolved" value={resolvedCount} subtitle="Closed satisfactorily" color="teal" icon={CheckCircle} delay={160} />
            <StatCard title="Resolution Rate" value={tickets.length > 0 ? `${Math.round((resolvedCount / tickets.length) * 100)}%` : '100%'} subtitle="Resolution efficiency" color="info" icon={Star} delay={240} />
          </div>

          {/* Main 2-Col Split */}
          <div className="customer-dashboard-split" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18 }}>

            {/* Complaints List */}
            <div className="animate-fade-up d200" style={{ ...glass, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--nw-text-primary)' }}>Your Complaints History</h3>
                  <p style={{ fontSize: 11, color: 'var(--nw-text-muted)' }}>Real-time status updates synced with MongoDB Atlas</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['All', 'In Triage', 'In Progress', 'Resolved'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: filter === f ? '1px solid var(--nw-accent)' : '1px solid var(--nw-border-strong)',
                        background: filter === f ? 'var(--nw-accent-dim)' : 'var(--nw-elevated)',
                        color: filter === f ? 'var(--nw-accent)' : 'var(--nw-text-muted)',
                      }}
                    >{f}</button>
                  ))}
                </div>
              </div>

              <div className="touch-scroll" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr>
                      {['Ticket ID', 'Category & Issues', 'Date', 'Dept', 'Priority', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--nw-border)', background: 'var(--nw-elevated)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: 'var(--nw-text-muted)', fontSize: 12 }}>Loading complaints...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: 'var(--nw-text-muted)', fontSize: 12 }}>No complaints found.</td></tr>
                    ) : filtered.map((t) => {
                      const s = STATUS_COLORS[t.status] || STATUS_COLORS['Closed']
                      const pc = P_COLORS[t.priority] || P_COLORS.P3
                      return (
                        <tr key={t.ticket_id} style={{ transition: 'background 0.1s', borderBottom: '1px solid var(--nw-border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td
                            onClick={() => openTicketDetail(t.ticket_id)}
                            style={{ padding: '12px 12px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--nw-accent)', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <div>{t.ticket_id}</div>
                            {t.is_repeat && <RepeatBadge priorCount={1} />}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ fontSize: 13, color: 'var(--nw-text-primary)', fontWeight: 600, marginBottom: 4 }}>{t.title || t.category || 'General'}</div>
                            <IssueBadges primaryIssue={t.category} secondaryIssues={t.secondary_issues?.map(si => si.category) || []} max={2} />
                          </td>
                          <td style={{ padding: '12px 12px', fontSize: 11, color: 'var(--nw-text-muted)' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '12px 12px', fontSize: 11 }}>
                            <DeptRouting primaryDept={t.department || t.customer_department} supportingDepts={t.supporting_departments || []} />
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: pc.bg, color: pc.color, fontFamily: 'monospace' }}>{t.priority || 'P3'}</span>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{t.status}</span>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <button
                              onClick={() => openTicketDetail(t.ticket_id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--nw-accent)', background: 'var(--nw-accent-dim)', padding: '4px 9px', borderRadius: 7, border: '1px solid rgba(201,111,74,0.3)', cursor: 'pointer' }}
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
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--nw-text-primary)', marginBottom: 2 }}>Complaint Trend</h3>
                <p style={{ fontSize: 10, color: 'var(--nw-text-muted)', marginBottom: 14 }}>Last 6 months</p>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={CHART}>
                    <defs>
                      <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C96F4A" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C96F4A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9A9CA5' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTip />} />
                    <Area type="monotone" dataKey="v" stroke="#C96F4A" strokeWidth={2} fill="url(#cGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Lifecycle info banner */}
              <div className="animate-fade-up d400" style={{ ...glass, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <Zap size={15} color="var(--nw-accent)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-text-primary)' }}>Dual Pipeline Resolution</span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--nw-text-secondary)', lineHeight: 1.5 }}>
                  Every NovaWear complaint is analyzed through both Groq GenAI and deterministic policy validation to ensure accurate, fair outcomes within our SLA timeframe.
                </p>
              </div>

            </div>
          </div>
        </main>

        {/* Customer Ticket Detail Modal */}
        {selectedTicket && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--nw-overlay)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}>
            <div style={{
              background: 'var(--nw-surface)', border: '1px solid var(--nw-border-strong)',
              width: 'min(760px, 94vw)', maxHeight: '90vh', overflowY: 'auto', padding: '22px 20px',
              position: 'relative', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: 16
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)', fontFamily: 'monospace' }}>
                      {selectedTicket.ticket_id}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--nw-elevated)', color: 'var(--nw-text-secondary)', border: '1px solid var(--nw-border-strong)' }}>
                      {selectedTicket.channel === 'Chat' ? '💬 Guided Chat' : '📄 Web Form'}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: (STATUS_COLORS[selectedTicket.status] || STATUS_COLORS['Closed']).bg, color: (STATUS_COLORS[selectedTicket.status] || STATUS_COLORS['Closed']).color }}>
                      {selectedTicket.status}
                    </span>
                    {selectedTicket.is_repeat && <RepeatBadge priorCount={1} />}
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--nw-text-primary)' }}>{selectedTicket.title}</h2>
                </div>
                
                <button
                  onClick={closeTicketDetail}
                  style={{ border: 'none', background: 'var(--nw-elevated)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nw-text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Feature 2: Clarification Card if clarification needed */}
              {selectedTicket.clarification_status === 'pending' && (
                <ClarificationCard ticket={selectedTicket} onSubmit={() => openTicketDetail(selectedTicket.ticket_id, tickets, true)} />
              )}

              {/* Feature 3: Complaint Summary */}
              <ComplaintSummary ticket={selectedTicket} variant="customer" />

              {/* Feature 1: Follow-Up Resolution Timeline */}
              <FollowUpTimeline ticket={selectedTicket} />

              {/* Action Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
                <button
                  onClick={closeTicketDetail}
                  style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--nw-accent)', color: 'var(--nw-text-inverse)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
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
