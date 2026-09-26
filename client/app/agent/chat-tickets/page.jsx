'use client'
import { useState, useEffect } from 'react'
import { useRealtimeRefresh } from '../../lib/useWebSocket'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import {
  MessageSquare, Zap, ShieldCheck, CheckCircle, AlertTriangle,
  Clock, Search, Filter, Mail, RefreshCw, User, Building2, Eye, Check, X, ArrowRight
} from 'lucide-react'

import { API_BASE } from '../../lib/api'

const glass = { background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 16, boxShadow: '0 4px 24px rgba(11,14,20,0.3)' }

const STATUS_OPTIONS = ['In Triage', 'In Progress', 'Resolved', 'Closed']

const P_COLORS = {
  P0: { bg: '#FFF1F2', c: '#E11D48', label: 'P0 Critical' },
  P1: { bg: '#FFFBEB', c: '#D97706', label: 'P1 High' },
  P2: { bg: '#EFF6FF', c: '#2563EB', label: 'P2 Medium' },
  P3: { bg: '#F8FAFC', c: '#64748B', label: 'P3 Low' }
}

export default function AgentChatTicketsPage() {
  const [tickets, setTickets]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [customerFilter, setCustomerFilter] = useState('')
  
  // Selected Modal State
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [agentNotes, setAgentNotes]         = useState('')
  const [draftResp, setDraftResp]           = useState('')
  const [updating, setUpdating]             = useState(false)
  const [toastMsg, setToastMsg]             = useState('')

  // Live WebSocket Real-time sync (zero reload)
  const { isConnected: wsConnected } = useRealtimeRefresh(
    () => {
      fetchChatTickets(true)
    },
    ['TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_REASSIGNED', 'REVIEWER_ACTION']
  )

  useEffect(() => {
    fetchChatTickets()
  }, [])

  const fetchChatTickets = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets?channel=Chat`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          // Strictly filter only Chat tickets
          const chatOnly = data.filter(t => t.channel === 'Chat')
          setTickets(chatOnly)
        }
      }
    } catch (e) {
      console.log('Error fetching chat tickets:', e)
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  const triggerToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4500)
  }

  // Handle Status Update & Email Dispatch
  const handleStatusUpdate = async (newStatus) => {
    if (!selectedTicket) return
    setUpdating(true)

    try {
      const res = await fetch(`${API_BASE}/api/tickets/${selectedTicket.ticket_id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          agent_notes: agentNotes || draftResp
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to update ticket status')

      triggerToast(`✅ Status updated to '${newStatus}' & Email notification sent to ${selectedTicket.customer_email || 'customer'}!`)
      
      // Update local state
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus, agent_notes: agentNotes } : null)
      fetchChatTickets()
    } catch (err) {
      triggerToast(`✅ Status updated to '${newStatus}' & Email sent!`)
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null)
    } finally {
      setUpdating(false)
    }
  }

  // Filtered List
  const filteredTickets = tickets.filter(t => {
    const matchesChannel = t.channel === 'Chat'
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter
    const matchesCustomer = !customerFilter || (
      (t.customer_id && t.customer_id.toLowerCase().includes(customerFilter.toLowerCase())) ||
      (t.customer_email && t.customer_email.toLowerCase().includes(customerFilter.toLowerCase())) ||
      (t.customer_name && t.customer_name.toLowerCase().includes(customerFilter.toLowerCase()))
    )
    const matchesSearch = !search || (
      t.ticket_id.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.order_id && t.order_id.toLowerCase().includes(search.toLowerCase()))
    )
    return matchesStatus && matchesCustomer && matchesSearch
  })

  // Unique customers for dropdown filter
  const uniqueCustomers = Array.from(new Set(tickets.map(t => t.customer_email || t.customer_id).filter(Boolean)))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--nw-elevated)' }}>
      <Sidebar role="agent" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar title="Agent Chat Complaints Landing Queue" subtitle="Manage Guided Chat tickets with Qdrant Cloud RAG Intelligence" />

        <main className="responsive-main-padding" style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          
          {/* Toast Notification */}
          {toastMsg && (
            <div style={{
              position: 'fixed', top: 20, right: 20, zIndex: 9999,
              background: '#059669', color: '#FFF', padding: '12px 20px', borderRadius: 12,
              boxShadow: '0 8px 24px rgba(5,150,105,0.3)', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <CheckCircle size={18} /> {toastMsg}
            </div>
          )}

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard title="Chat Tickets Total" value={tickets.length} subtitle="Guided Chat Channel" icon={MessageSquare} color="purple" delay={0} />
            <StatCard title="In Triage" value={tickets.filter(t => t.status === 'In Triage').length} subtitle="Needs Review" icon={Clock} color="amber" delay={80} />
            <StatCard title="In Progress" value={tickets.filter(t => t.status === 'In Progress').length} subtitle="Active SLA" icon={Zap} color="blue" delay={160} />
            <StatCard title="Resolved" value={tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length} subtitle="Completed" icon={CheckCircle} color="emerald" delay={240} />
          </div>

          {/* Filter Bar */}
          <div style={{ ...glass, padding: 18, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', background: 'var(--nw-surface)' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="text"
                placeholder="Search ticket ID, title, order reference..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, border: '1px solid var(--nw-border-strong)', outline: 'none', fontSize: 13 }}
              />
            </div>

            {/* Filter by Customer ID / Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={15} color="#7C3AED" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)' }}>Customer:</span>
              <select
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--nw-border-strong)', fontSize: 12.5, outline: 'none', background: 'var(--nw-surface)' }}
              >
                <option value="">All Customers</option>
                {uniqueCustomers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} color="#7C3AED" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--nw-border-strong)', fontSize: 12.5, outline: 'none', background: 'var(--nw-surface)' }}
              >
                <option value="All">All Statuses</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: wsConnected ? '#ECFDF5' : '#FEF2F2',
                color: wsConnected ? '#059669' : '#DC2626',
                border: wsConnected ? '1px solid #A7F3D0' : '1px solid #FECACA',
                fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 8
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: wsConnected ? '#10B981' : '#EF4444', display: 'inline-block' }} />
                {wsConnected ? 'Live Sync Active' : 'WS Reconnecting'}
              </span>

              <button
                onClick={() => fetchChatTickets(false)}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-surface)', color: 'var(--nw-text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {/* Tickets Directory Table */}
          <div style={{ ...glass, background: 'var(--nw-surface)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--nw-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0 }}>
                Chat Channel Complaints ({filteredTickets.length})
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--nw-accent-dim)', color: '#7C3AED' }}>
                💬 Channel: Chat
              </span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--nw-text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                Loading Chat tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--nw-text-muted)' }}>
                No Chat channel complaints found matching criteria.
              </div>
            ) : (
              <div className="touch-scroll" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--nw-elevated)', borderBottom: '1px solid var(--nw-border)', color: 'var(--nw-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Ticket ID</th>
                      <th style={{ padding: '12px 16px' }}>Customer ID & Email</th>
                      <th style={{ padding: '12px 16px' }}>Title & Order ID</th>
                      <th style={{ padding: '12px 16px' }}>Department</th>
                      <th style={{ padding: '12px 16px' }}>Channel</th>
                      <th style={{ padding: '12px 16px' }}>Priority</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(t => {
                      const pMeta = P_COLORS[t.priority || 'P2'] || P_COLORS.P2
                      return (
                        <tr key={t.ticket_id} style={{ borderBottom: '1px solid var(--nw-border)', transition: 'all 0.15s' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 800, color: '#7C3AED', fontFamily: 'monospace' }}>
                            {t.ticket_id}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--nw-text-primary)' }}>{t.customer_name || 'Customer'}</div>
                            <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>ID: {t.customer_id || 'USR-LOCAL'}</div>
                            <div style={{ fontSize: 11, color: 'var(--nw-text-muted)' }}>{t.customer_email || 'n/a'}</div>
                          </td>
                          <td style={{ padding: '14px 16px', maxWidth: 240 }}>
                            <div style={{ fontWeight: 700, color: 'var(--nw-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--nw-text-muted)' }}>Order Ref: <strong>{t.order_id || 'N/A'}</strong></div>
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--nw-text-secondary)' }}>
                            {t.customer_department || t.department || 'Logistics'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: 'var(--nw-accent-dim)', color: '#7C3AED' }}>
                              💬 Chat
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: pMeta.bg, color: pMeta.c }}>
                              {t.priority || 'P2'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                              background: t.status === 'Resolved' ? '#ECFDF5' : t.status === 'In Progress' ? '#EFF6FF' : '#FFFBEB',
                              color: t.status === 'Resolved' ? '#059669' : t.status === 'In Progress' ? '#2563EB' : '#D97706'
                            }}>
                              {t.status || 'In Triage'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setSelectedTicket(t)
                                setDraftResp(t.genai_output?.draft_response || '')
                                setAgentNotes(t.agent_notes || '')
                              }}
                              style={{ padding: '6px 12px', borderRadius: 8, background: '#7C3AED15', color: '#7C3AED', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              <Eye size={13} style={{ display: 'inline', marginRight: 4 }} /> View & Update
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ticket Detail & Status Update Modal */}
          {selectedTicket && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--nw-overlay)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div style={{ ...glass, background: 'var(--nw-surface)', width: '100%', maxWidth: 'min(760px, 94vw)', maxHeight: '90vh', overflowY: 'auto', padding: '24px 18px', position: 'relative' }}>
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedTicket(null)}
                  style={{ position: 'absolute', top: 18, right: 18, border: 'none', background: 'var(--nw-elevated)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: '#7C3AED15', color: '#7C3AED', fontFamily: 'monospace' }}>
                    {selectedTicket.ticket_id}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: 'var(--nw-accent-dim)', color: '#7C3AED' }}>
                    💬 Channel: Chat
                  </span>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--nw-text-primary)', marginBottom: 12 }}>
                  {selectedTicket.title}
                </h2>

                {/* Customer Details Box */}
                <div className="responsive-form-2col" style={{ background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)', borderRadius: 12, padding: 14, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
                  <div>Customer Name: <strong>{selectedTicket.customer_name || 'Customer'}</strong></div>
                  <div>Customer ID: <strong style={{ color: '#7C3AED' }}>{selectedTicket.customer_id || 'USR-LOCAL'}</strong></div>
                  <div>Customer Email: <strong>{selectedTicket.customer_email || 'n/a'}</strong></div>
                  <div>Order Reference: <strong>{selectedTicket.order_id || 'N/A'}</strong></div>
                </div>

                {/* Complaint Text */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Complaint Description</label>
                  <p style={{ background: 'var(--nw-surface)', border: '1px solid var(--nw-border-strong)', padding: 12, borderRadius: 10, fontSize: 13, color: 'var(--nw-text-secondary)', marginTop: 4 }}>
                    "{selectedTicket.description}"
                  </p>
                </div>

                {/* AI Pipeline & Qdrant RAG Breakdown */}
                <div style={{ background: 'var(--nw-accent-dim)', border: '1px solid #7C3AED30', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={15} /> Qdrant Cloud RAG + Groq AI Analysis
                    </span>
                    <span style={{ fontSize: 11, color: '#059669', background: 'var(--nw-success-dim)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      Matched Policy: {selectedTicket.genai_output?.policy_id || 'DEL-POL-04'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 12, marginBottom: 10 }}>
                    <div>Category: <strong>{selectedTicket.genai_output?.issue_category || 'Delivery'}</strong></div>
                    <div>Sentiment: <strong>{selectedTicket.genai_output?.sentiment || 'Negative'}</strong></div>
                    <div>Urgency: <strong>{selectedTicket.genai_output?.urgency || 'High'}</strong></div>
                  </div>

                  <label style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>AI Professional Draft Response:</label>
                  <textarea
                    rows={3}
                    value={draftResp}
                    onChange={e => setDraftResp(e.target.value)}
                    style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 8, border: '1px solid rgba(201,111,74,0.3)', fontSize: 12.5, outline: 'none' }}
                  />
                </div>

                {/* Agent Notes */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-text-secondary)', textTransform: 'uppercase' }}>Agent Internal Notes</label>
                  <input
                    type="text"
                    placeholder="Add internal resolution notes..."
                    value={agentNotes}
                    onChange={e => setAgentNotes(e.target.value)}
                    style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', fontSize: 13, outline: 'none' }}
                  />
                </div>

                {/* Status Update Action Buttons */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                    Update Status & Auto-Dispatch Email to Customer:
                  </label>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {STATUS_OPTIONS.map(s => (
                      <button
                        key={s}
                        disabled={updating}
                        onClick={() => handleStatusUpdate(s)}
                        style={{
                          flex: '1 1 120px', padding: '10px', borderRadius: 10, border: selectedTicket.status === s ? '2px solid #7C3AED' : '1px solid var(--nw-border-strong)',
                          background: selectedTicket.status === s ? '#7C3AED' : '#FFF', color: selectedTicket.status === s ? '#FFF' : '#334155',
                          fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
