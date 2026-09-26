'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRealtimeRefresh } from '../../../lib/useWebSocket'
import Sidebar from '../../../components/Sidebar'
import {
  Ticket, ArrowLeft, CheckCircle, AlertTriangle, ShieldCheck, Scale,
  User, Building, Clock, Mail, MessageSquare, Zap, RefreshCw,
  ArrowRightLeft, AlertCircle, Calendar, Hash, FileText, Check, X,
  Shield, UserCheck, UserX, ExternalLink, HelpCircle
} from 'lucide-react'

import { API_BASE } from '../../../lib/api'

const glass = {
  background: 'rgba(255, 255, 255, 0.88)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.95)',
  borderRadius: 16,
  boxShadow: '0 4px 24px rgba(148, 163, 184, 0.1)',
}

const P_COLORS = {
  P0: { bg: '#FFF1F2', c: '#E11D48', label: 'P0 Critical' },
  P1: { bg: '#FFFBEB', c: '#D97706', label: 'P1 High' },
  P2: { bg: '#EFF6FF', c: '#2563EB', label: 'P2 Medium' },
  P3: { bg: '#F8FAFC', c: '#64748B', label: 'P3 Low' },
}

const STATUS_COLORS = {
  'In Triage':   { bg: '#FFFBEB', c: '#D97706', border: '#FDE68A' },
  'In Progress': { bg: '#EFF6FF', c: '#2563EB', border: '#BFDBFE' },
  'AI Review':   { bg: '#F5F3FF', c: '#7C3AED', border: '#DDD6FE' },
  'Resolved':    { bg: '#ECFDF5', c: '#059669', border: '#A7F3D0' },
  'Escalated':   { bg: '#FFF1F2', c: '#E11D48', border: '#FECDD3' },
  'Closed':      { bg: '#F8FAFC', c: '#64748B', border: '#E2E8F0' },
}

export default function TicketDetailPage({ params: propParams }) {
  const router = useRouter()
  const routeParams = useParams()
  const ticketId = routeParams?.id || propParams?.id

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // overview, pipeline, history, overrides

  // Metadata for Overrides
  const [agentsList, setAgentsList] = useState([])
  const [deptsList, setDeptsList] = useState([])

  // Modal States
  const [showReassignModal, setShowReassign] = useState(false)
  const [reassignAgentId, setReassignAgentId] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassignLoading, setReassignLoading] = useState(false)

  const [showPoolModal, setShowPool] = useState(false)
  const [poolReason, setPoolReason] = useState('')
  const [poolLoading, setPoolLoading] = useState(false)

  const [showDeptModal, setShowDept] = useState(false)
  const [newDeptId, setNewDeptId] = useState('')
  const [deptReason, setDeptReason] = useState('')
  const [deptLoading, setDeptLoading] = useState(false)

  const [showStatusModal, setShowStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('In Progress')
  const [statusNotes, setStatusNotes] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)

  const [actionAlert, setActionAlert] = useState('')

  // Real-time WebSocket live updates (zero reload)
  const { isConnected: wsConnected } = useRealtimeRefresh(
    (event) => {
      // Re-fetch ticket details whenever an update or reassignment occurs
      if (!event?.payload?.ticket_id || event.payload.ticket_id === ticketId) {
        fetchTicketDetail(true)
      }
    },
    ['TICKET_UPDATED', 'TICKET_REASSIGNED', 'REVIEWER_ACTION']
  )

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetail()
      fetchMetadata()
    }
  }, [ticketId])

  const fetchTicketDetail = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}`)
      if (!res.ok) {
        throw new Error(`Ticket ${ticketId} not found.`)
      }
      const data = await res.json()
      setTicket(data)
      setNewStatus(data.status || 'In Progress')
    } catch (err) {
      if (!isBackground) setError(err.message || 'Failed to fetch ticket.')
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  const fetchMetadata = async () => {
    try {
      const [uRes, dRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/users`),
        fetch(`${API_BASE}/api/departments`)
      ])
      if (uRes.ok) {
        const uData = await uRes.json()
        if (Array.isArray(uData)) {
          setAgentsList(uData.filter(u => (u.role === 'AGENT' || u.role === 'REVIEWER') && u.status === 'ACTIVE'))
        }
      }
      if (dRes.ok) {
        const dData = await dRes.json()
        if (Array.isArray(dData)) {
          setDeptsList(dData)
        }
      }
    } catch (e) {}
  }

  // Admin Override Handlers
  const handleReassignSubmit = async (e) => {
    e.preventDefault()
    if (!reassignAgentId) return
    setReassignLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_agent_id: reassignAgentId,
          reassigned_by_id: 'ADM-001',
          reassigned_by_name: 'System Admin',
          reassigned_by_role: 'ADMIN',
          reason: reassignReason.trim() || 'Admin supervisor workload reassignment'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Reassignment failed.')
        setReassignLoading(false)
        return
      }
      setShowReassign(false)
      setActionAlert('✅ Ticket successfully reassigned by Admin. Notifications dispatched.')
      fetchTicketDetail()
    } catch (err) {
      alert('Network error connecting to backend.')
    } finally {
      setReassignLoading(false)
      setTimeout(() => setActionAlert(''), 6000)
    }
  }

  const handleReleasePoolSubmit = async (e) => {
    e.preventDefault()
    if (!poolReason.trim()) {
      alert('Please provide a reason for releasing ticket to pool.')
      return
    }
    setPoolLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/release-to-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_id: 'ADM-001',
          manager_name: 'System Admin',
          manager_role: 'ADMIN',
          reason: poolReason.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Failed to release ticket to pool.')
        setPoolLoading(false)
        return
      }
      setShowPool(false)
      setActionAlert('⚡ Agent removed and ticket returned to Open Department Pool!')
      fetchTicketDetail()
    } catch (err) {
      alert('Network error connecting to backend.')
    } finally {
      setPoolLoading(false)
      setTimeout(() => setActionAlert(''), 6000)
    }
  }

  const handleDeptSubmit = async (e) => {
    e.preventDefault()
    if (!newDeptId) return
    setDeptLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/change-department`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_department_id: newDeptId,
          admin_id: 'ADM-001',
          admin_name: 'System Admin',
          reason: deptReason.trim() || 'Admin routing override'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Department change failed.')
        setDeptLoading(false)
        return
      }
      setShowDept(false)
      setActionAlert('🏢 Department override applied and ticket queue reset.')
      fetchTicketDetail()
    } catch (err) {
      alert('Network error connecting to backend.')
    } finally {
      setDeptLoading(false)
      setTimeout(() => setActionAlert(''), 6000)
    }
  }

  const handleStatusSubmit = async (e) => {
    e.preventDefault()
    setStatusLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          agent_notes: statusNotes.trim() ? `[Admin Note]: ${statusNotes.trim()}` : `Admin override to ${newStatus}`,
          agent_id: 'ADM-001',
          agent_name: 'System Admin',
          agent_email: 'admin@novawearapparel.com'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Status update failed.')
        setStatusLoading(false)
        return
      }
      setShowStatus(false)
      setActionAlert(`✅ Ticket status updated to '${newStatus}'.`)
      fetchTicketDetail()
    } catch (err) {
      alert('Network error connecting to backend.')
    } finally {
      setStatusLoading(false)
      setTimeout(() => setActionAlert(''), 6000)
    }
  }

  const pConfig = ticket ? (P_COLORS[ticket.priority] || P_COLORS.P2) : P_COLORS.P2
  const sConfig = ticket ? (STATUS_COLORS[ticket.status] || STATUS_COLORS['Closed']) : STATUS_COLORS['Closed']
  const genai = ticket?.genai_output || {}
  const python = ticket?.python_rule_output || {}
  const comp = ticket?.policy_compliance || { status: 'COMPLIANT', violations: [], warnings: [] }
  const history = ticket?.assigned_agent_history || ticket?.assignedAgentHistory || []
  const revoked = ticket?.revoked_agents || []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="admin" userName="System Administrator" userEmail="admin@novawearapparel.com" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflowY: 'auto' }}>
        
        {/* Top Header Bar */}
        <div style={{ background: '#FFF', borderBottom: '1px solid #E2E8F0', padding: '14px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href="/admin/tickets"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, background: '#F1F5F9',
                color: '#475569', fontSize: 12, fontWeight: 700, textDecoration: 'none'
              }}
            >
              <ArrowLeft size={14} /> Back to All Tickets
            </Link>
            <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Ticket 360° Audit & Investigation Dossier
                </h1>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#7C3AED', fontWeight: 800, background: '#F5F3FF', padding: '2px 8px', borderRadius: 6, border: '1px solid #DDD6FE' }}>
                  {ticketId}
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>
                Complete AI pipeline logs, Ground-Truth rule audit, agent actions, and historical timeline
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: wsConnected ? '#ECFDF5' : '#FEF2F2',
              color: wsConnected ? '#059669' : '#DC2626',
              border: wsConnected ? '1px solid #A7F3D0' : '1px solid #FECACA',
              fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 8
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: wsConnected ? '#10B981' : '#EF4444', display: 'inline-block' }} />
              {wsConnected ? 'Live Sync Active' : 'WS Reconnecting'}
            </span>

            <button
              onClick={() => fetchTicketDetail(false)}
              disabled={loading}
              style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                background: '#FFF', color: '#64748B', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionAlert && (
          <div style={{ background: '#0F172A', color: '#FFF', padding: '12px 26px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={16} color="#10B981" />
            <span>{actionAlert}</span>
          </div>
        )}

        {/* Main Content Area */}
        <main style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
          
          {loading ? (
            <div style={{ ...glass, padding: 60, textAlign: 'center', color: '#94A3B8' }}>
              <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, fontWeight: 600 }}>Loading complaint ticket dossier...</p>
            </div>
          ) : error || !ticket ? (
            <div style={{ ...glass, padding: 40, textAlign: 'center', color: '#DC2626' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Complaint Ticket Not Found</h3>
              <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px' }}>{error || 'Unable to retrieve ticket details.'}</p>
              <Link href="/admin/tickets" style={{ display: 'inline-block', background: '#7C3AED', color: '#FFF', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Return to Tickets Queue
              </Link>
            </div>
          ) : (
            <>
              {/* Top Overview & Admin Command Bar */}
              <div style={{ ...glass, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: '#7C3AED' }}>
                        {ticket.ticket_id}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: pConfig.bg, color: pConfig.c }}>
                        {pConfig.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#F1F5F9', color: '#475569' }}>
                        Channel: {ticket.channel || 'Web Form'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                        Dept: {ticket.department} {ticket.department_id ? `(${ticket.department_id})` : ''}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 99, background: sConfig.bg, color: sConfig.c, border: `1px solid ${sConfig.border}` }}>
                        Status: {ticket.status}
                      </span>
                      {comp.status === 'VIOLATION' && (
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
                          🚨 POLICY VIOLATION
                        </span>
                      )}
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
                      {ticket.title}
                    </h2>
                    <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                      Customer: <strong>{ticket.customer_name || 'Valued Customer'}</strong> ({ticket.customer_email || 'No email'}) · Submitted on: {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'Recent'}
                    </p>
                  </div>

                  {/* Admin Command Buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowStatus(true)}
                      style={{
                        padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Check size={14} /> Update Status
                    </button>

                    <button
                      onClick={() => {
                        setShowPool(true)
                        setPoolReason('')
                      }}
                      disabled={!ticket.assigned_agent_id}
                      style={{
                        padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                        cursor: ticket.assigned_agent_id ? 'pointer' : 'not-allowed',
                        background: ticket.assigned_agent_id ? '#FFFBEB' : '#F1F5F9',
                        color: ticket.assigned_agent_id ? '#D97706' : '#94A3B8',
                        border: '1.5px solid #FCD34D', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: ticket.assigned_agent_id ? 1 : 0.6
                      }}
                    >
                      <Zap size={14} /> Release to Open Pool
                    </button>

                    <button
                      onClick={() => {
                        setShowReassign(true)
                        setReassignReason('')
                        if (agentsList.length > 0) setReassignAgentId(agentsList[0].user_id)
                      }}
                      style={{
                        padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <ArrowRightLeft size={14} /> Reassign Agent
                    </button>

                    <button
                      onClick={() => {
                        setShowDept(true)
                        setDeptReason('')
                        if (deptsList.length > 0) setNewDeptId(deptsList[0].dept_id)
                      }}
                      style={{
                        padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: '#FAF5FF', color: '#7C3AED', border: '1px solid #DDD6FE', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Building size={14} /> Override Dept
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs Navigation */}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                  {[
                    ['overview', '📌 Complaint & Customer'],
                    ['pipeline', '🔬 GenAI & Python Ground-Truth'],
                    ['agent', '👤 Assigned Agent & Work Notes'],
                    ['history', `📜 Audit Trail & History (${history.length})`]
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setActiveTab(k)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: 'none',
                        background: activeTab === k ? '#7C3AED' : '#F1F5F9',
                        color: activeTab === k ? '#FFF' : '#64748B',
                        transition: 'all 0.15s'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TAB 1: OVERVIEW ── */}
              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                  {/* Left Column: Complaint Text & Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ ...glass, padding: 20 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Customer Complaint Description
                      </h3>
                      <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, color: '#1E293B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {ticket.description || 'No complaint text provided.'}
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div style={{ ...glass, padding: 20 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '0 0 12px', textTransform: 'uppercase' }}>
                        Order & Product Information
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 12 }}>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Product / Service:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#0F172A' }}>{ticket.product_service || 'N/A'}</p>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Order Reference ID:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#7C3AED', fontFamily: 'monospace' }}>{ticket.order_id || 'N/A'}</p>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Incident Date:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#334155' }}>{ticket.incident_date || 'N/A'}</p>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Intake Channel:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#2563EB' }}>{ticket.channel || 'Web Form'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Customer & Assignment Card */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ ...glass, padding: 20 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 10px', textTransform: 'uppercase' }}>
                        Customer Profile
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={18} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{ticket.customer_name || 'Customer'}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{ticket.customer_email || '—'}</p>
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#475569', background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                        <div>Selected Dept: <strong>{ticket.customer_department || ticket.department}</strong></div>
                        {ticket.customer_id && <div>Customer ID: <code style={{ color: '#7C3AED' }}>{ticket.customer_id}</code></div>}
                      </div>
                    </div>

                    <div style={{ ...glass, padding: 20 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '0 0 10px', textTransform: 'uppercase' }}>
                        Assigned Agent Status
                      </h3>
                      {ticket.assigned_agent_id ? (
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 12, borderRadius: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <UserCheck size={16} color="#059669" />
                            <strong style={{ fontSize: 13, color: '#065F46' }}>{ticket.assigned_agent}</strong>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#047857' }}>
                            Email: {ticket.assigned_agent_email || '—'}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#047857' }}>
                            Agent ID: <code>{ticket.assigned_agent_id}</code>
                          </p>
                        </div>
                      ) : (
                        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: 12, borderRadius: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309', fontWeight: 700, fontSize: 12.5 }}>
                            <Zap size={15} /> Unassigned Open Pool
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#92400E' }}>
                            This complaint is open in the <strong>{ticket.department}</strong> department pool. Any active agent can auto-claim it on first response.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 2: PIPELINE INTELLIGENCE (GENAI & PYTHON GROUND TRUTH) ── */}
              {activeTab === 'pipeline' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Pipeline 1: GenAI */}
                  <div style={{ ...glass, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Zap size={18} color="#7C3AED" />
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: '#7C3AED', margin: 0, textTransform: 'uppercase' }}>
                        Pipeline 1: GenAI Extraction & Schema Output
                      </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Primary Issue / Category:</span>
                        <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#0F172A' }}>{genai.issue_category || genai.primary_issue || ticket.category || 'General'}</p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Sentiment:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#334155' }}>{genai.sentiment || 'Neutral'}</p>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>AI Urgency:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#7C3AED' }}>{genai.urgency || ticket.priority || 'Medium'}</p>
                        </div>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Recommended Policy ID:</span>
                        <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>{genai.policy_id || 'DEL-POL-04'}</p>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>AI Agent Guidance:</span>
                        <p style={{ margin: '4px 0 0', color: '#334155', lineHeight: 1.5 }}>
                          {genai.agent_guidance || 'Investigate carrier logs, verify tracking, check eligibility, adhere to refund limit.'}
                        </p>
                      </div>

                      <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1.5px solid #DDD6FE' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>Generated Customer Response Draft:</span>
                        <div style={{ margin: '6px 0 0', color: '#1E293B', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto', fontSize: 11.5 }}>
                          {genai.draft_response || genai.customer_response || ticket.draft_response || 'No draft generated.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline 2: Python Ground-Truth */}
                  <div style={{ ...glass, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={18} color="#059669" />
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#059669', margin: 0, textTransform: 'uppercase' }}>
                          Pipeline 2: Python Ground-Truth Matrix
                        </h3>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 6 }}>
                        Score: {python.confidence_score || 95}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: 10, borderRadius: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>Deterministic Rule ID:</span>
                        <p style={{ margin: '2px 0 0', fontWeight: 800, color: '#047857' }}>{python.matched_rule_id || 'DEL-POL-04: Delivery Delay Sovereign Rule'}</p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Refund Eligibility:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 800, color: python.refund_eligible ? '#059669' : '#DC2626' }}>
                            {python.refund_eligible ? '✓ Refund Permitted' : '✗ Non-Refundable'}
                          </p>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Manager Escalation:</span>
                          <p style={{ margin: '2px 0 0', fontWeight: 800, color: python.escalation_required ? '#DC2626' : '#64748B' }}>
                            {python.escalation_required ? '⚠️ Mandatory Escalation' : 'Standard Resolution'}
                          </p>
                        </div>
                      </div>

                      {/* Policy Compliance Matrix */}
                      <div style={{ background: comp.status === 'VIOLATION' ? '#FFF5F5' : '#F0FDF4', border: comp.status === 'VIOLATION' ? '1.5px solid #FCA5A5' : '1px solid #BBF7D0', padding: 12, borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: comp.status === 'VIOLATION' ? '#DC2626' : '#15803D' }}>
                            POLICY COMPLIANCE: {comp.status}
                          </span>
                        </div>
                        {comp.violations?.length > 0 && (
                          <div style={{ margin: '6px 0 0' }}>
                            {comp.violations.map((v, i) => (
                              <p key={i} style={{ margin: '2px 0', fontSize: 11.5, color: '#991B1B', fontWeight: 600 }}>• {v}</p>
                            ))}
                          </div>
                        )}
                        {comp.warnings?.length > 0 && (
                          <div style={{ margin: '6px 0 0' }}>
                            {comp.warnings.map((w, i) => (
                              <p key={i} style={{ margin: '2px 0', fontSize: 11.5, color: '#92400E', fontWeight: 600 }}>• {w}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Policy Source Document:</span>
                        <p style={{ margin: '2px 0 0', color: '#334155', fontFamily: 'monospace', fontSize: 11 }}>
                          {python.policy_reference || 'NovaWear Apparel Customer Resolution Policy v2.1'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 3: ASSIGNED AGENT & WORK ACTIVITY ── */}
              {activeTab === 'agent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ ...glass, padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '0 0 12px', textTransform: 'uppercase' }}>
                      Agent Assignment & Oversight
                    </h3>
                    {ticket.assigned_agent_id ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Assigned Agent:</span>
                          <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{ticket.assigned_agent}</p>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Agent Email:</span>
                          <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: '#2563EB' }}>{ticket.assigned_agent_email || '—'}</p>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Department:</span>
                          <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#059669' }}>{ticket.department}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: 14, borderRadius: 8, marginBottom: 16 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#B45309' }}>⚡ Ticket is Currently Unassigned in Department Pool</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#92400E' }}>No single agent is actively holding this ticket. It will auto-claim on the first response by any agent.</p>
                      </div>
                    )}

                    <div style={{ marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>Agent Working / Resolution Notes:</span>
                      <div style={{ background: '#FFF', border: '1.5px solid #CBD5E1', borderRadius: 8, padding: 12, fontSize: 12.5, color: '#0F172A', marginTop: 6, minHeight: 60 }}>
                        {ticket.agent_notes || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No notes logged yet by the agent.</span>}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>Customer Communication & Outbound Replies:</span>
                      <div style={{ background: '#FFF', border: '1.5px solid #CBD5E1', borderRadius: 8, padding: 12, fontSize: 12.5, color: '#1E293B', marginTop: 6, minHeight: 60, lineHeight: 1.6 }}>
                        {ticket.draft_response || genai.draft_response || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No customer replies dispatched yet.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 4: AUDIT TRAIL & LIFECYCLE HISTORY ── */}
              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Revoked Agents Archive Banner */}
                  {revoked.length > 0 && (
                    <div style={{ ...glass, padding: 18, borderLeft: '4px solid #EF4444', background: '#FFF5F5' }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserX size={16} /> Revoked Agent Archive (Permanently Blocked on this Ticket)
                      </h4>
                      {revoked.map((r, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#991B1B', borderBottom: i < revoked.length - 1 ? '1px solid #FECDD3' : 'none', padding: '6px 0' }}>
                          <strong>{r.agent_name || r.name || r.agent_id}</strong> removed by <strong>{r.revoked_by_name || 'Manager'}</strong> on {r.revoked_at ? new Date(r.revoked_at).toLocaleString() : 'Recent'}.<br />
                          <span style={{ color: '#B91C1C' }}>Reason: <em>"{r.reason}"</em></span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lifecycle Timeline */}
                  <div style={{ ...glass, padding: 22 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '0 0 16px', textTransform: 'uppercase' }}>
                      Complete Lifecycle & Assignment History
                    </h3>

                    {history.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8' }}>
                        <Clock size={24} style={{ margin: '0 auto 8px' }} />
                        <p style={{ fontSize: 12 }}>No reassignment or status history logged yet.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {history.slice().reverse().map((entry, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex', gap: 14, alignItems: 'flex-start',
                              background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0'
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: entry.action?.includes('REVOKE') ? '#FEE2E2' : entry.action?.includes('CLAIM') ? '#ECFDF5' : '#EFF6FF',
                              color: entry.action?.includes('REVOKE') ? '#DC2626' : entry.action?.includes('CLAIM') ? '#059669' : '#2563EB',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              {entry.action?.includes('REVOKE') ? <UserX size={15} /> : <UserCheck size={15} />}
                            </div>

                            <div style={{ flex: 1, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', fontSize: 11.5 }}>
                                  {entry.action || 'ASSIGNMENT_UPDATE'}
                                </span>
                                <span style={{ fontSize: 10.5, color: '#94A3B8' }}>
                                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Recent'}
                                </span>
                              </div>

                              <p style={{ margin: '2px 0 4px', color: '#334155' }}>
                                Agent: <strong>{entry.agent_name || entry.agent_id || 'Unassigned Pool'}</strong>
                                {entry.previous_agent_name && (
                                  <span> (Previous: <em>{entry.previous_agent_name}</em>)</span>
                                )}
                              </p>

                              {entry.reason && (
                                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748B' }}>
                                  Reason: <span style={{ color: '#0F172A', fontWeight: 600 }}>"{entry.reason}"</span>
                                </p>
                              )}

                              {entry.reassigned_by_name && (
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>
                                  Initiated by: {entry.reassigned_by_name} ({entry.reassigned_by_role || 'ADMIN'})
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── MODAL 1: REASSIGN AGENT ── */}
      {showReassignModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...glass, maxWidth: 480, width: '100%', padding: 22, background: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Admin Reassign Ticket [{ticketId}]</h3>
              <button onClick={() => setShowReassign(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleReassignSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>Select Target Agent *</label>
                <select required value={reassignAgentId} onChange={e => setReassignAgentId(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12.5, outline: 'none' }}>
                  <option value="">-- Choose Agent --</option>
                  {agentsList.map(a => (
                    <option key={a.user_id} value={a.user_id}>{a.name} ({a.department} - {a.email})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>Reassignment Reason *</label>
                <input required value={reassignReason} onChange={e => setReassignReason(e.target.value)} placeholder="e.g. Workload balancing, specialized skill requirement" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12.5, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowReassign(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'transparent', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={reassignLoading} style={{ padding: '8px 18px', borderRadius: 8, background: '#2563EB', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {reassignLoading ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: RELEASE TO OPEN POOL ── */}
      {showPoolModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...glass, maxWidth: 480, width: '100%', padding: 22, background: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#D97706', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={18} /> Release to Open Pool (Remove Agent)
              </h3>
              <button onClick={() => setShowPool(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <div style={{ background: '#FFFBEB', borderLeft: '4px solid #F59E0B', padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 12, color: '#92400E' }}>
              Current Agent <strong>({ticket?.assigned_agent || 'Assigned Agent'})</strong> will be removed and permanently blocked. Ticket will return to <strong>'In Triage'</strong> in {ticket?.department} queue for any other agent to claim.
            </div>
            <form onSubmit={handleReleasePoolSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: 5 }}>Mandatory Reason for Removal *</label>
                <textarea required rows={3} value={poolReason} onChange={e => setPoolReason(e.target.value)} placeholder="e.g. Non-responsiveness to SLA, policy non-compliance" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FFF8F8', fontSize: 12, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPool(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'transparent', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={poolLoading} style={{ padding: '8px 18px', borderRadius: 8, background: '#D97706', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {poolLoading ? 'Releasing...' : 'Confirm Release to Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: OVERRIDE DEPARTMENT ── */}
      {showDeptModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...glass, maxWidth: 480, width: '100%', padding: 22, background: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#7C3AED', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building size={18} /> Override Ticket Department
              </h3>
              <button onClick={() => setShowDept(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleDeptSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>Select New Department *</label>
                <select required value={newDeptId} onChange={e => setNewDeptId(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12.5, outline: 'none' }}>
                  <option value="">-- Choose Department --</option>
                  {deptsList.map(d => (
                    <option key={d.dept_id} value={d.dept_id}>{d.name} ({d.dept_id})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>Override Reason *</label>
                <input required value={deptReason} onChange={e => setDeptReason(e.target.value)} placeholder="e.g. Incorrect intake routing" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12.5, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowDept(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'transparent', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={deptLoading} style={{ padding: '8px 18px', borderRadius: 8, background: '#7C3AED', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {deptLoading ? 'Updating...' : 'Apply Department Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: FORCE STATUS UPDATE ── */}
      {showStatusModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...glass, maxWidth: 480, width: '100%', padding: 22, background: '#FFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Force Status Update [{ticketId}]</h3>
              <button onClick={() => setShowStatus(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleStatusSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>Select Target Status *</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12.5, outline: 'none' }}>
                  <option value="In Triage">In Triage</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>Supervisor / Admin Notes</label>
                <textarea rows={3} value={statusNotes} onChange={e => setStatusNotes(e.target.value)} placeholder="Administrative resolution or escalation rationale..." style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowStatus(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'transparent', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={statusLoading} style={{ padding: '8px 18px', borderRadius: 8, background: '#0F172A', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {statusLoading ? 'Updating...' : 'Confirm Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
