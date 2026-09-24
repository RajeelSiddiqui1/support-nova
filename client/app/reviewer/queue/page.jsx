'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import {
  Scale, ShieldAlert, CheckCircle, AlertTriangle, Zap, XCircle,
  User, UserX, UserCheck, ArrowRightLeft, RefreshCw, FileText, Mail, History,
  Clock, ExternalLink, Eye, ShieldCheck, Check, AlertCircle, Info, X
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const glass = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.9)',
  borderRadius: 14,
  boxShadow: '0 4px 20px rgba(148,163,184,0.1)'
}

const P_COLORS = {
  P0: { bg: '#FFF1F2', c: '#E11D48', label: 'P0 Critical' },
  P1: { bg: '#FFFBEB', c: '#D97706', label: 'P1 High' },
  P2: { bg: '#EFF6FF', c: '#2563EB', label: 'P2 Medium' },
  P3: { bg: '#F8FAFC', c: '#64748B', label: 'P3 Low' },
}

const FILTERS = ['All', 'Violations', 'Warnings', 'Compliant', 'Active Queue', 'Unassigned']

export default function ReviewerQueue() {
  const [managers, setManagers]           = useState([])
  const [currentManager, setCurrManager] = useState(null)
  const [filter, setFilter]               = useState('All')
  const [tickets, setTickets]             = useState([])
  const [selectedTicket, setSelected]     = useState(null)
  const [loading, setLoading]             = useState(true)
  const [agentWorkload, setWorkload]      = useState([])
  const [totalViolations, setViolations]  = useState(0)
  const [totalWarnings, setWarnings]      = useState(0)

  // Revoke & Reassign Modal State
  const [showRevokeModal, setShowRevoke]   = useState(false)
  const [deptAgents, setDeptAgents]       = useState([])
  const [newAgentId, setNewAgentId]       = useState('')
  const [revokeReason, setRevokeReason]   = useState('')
  const [revokeLoading, setRevokeLoad]   = useState(false)
  const [actionAlert, setActionAlert]     = useState('')

  useEffect(() => {
    fetchManagers()
  }, [])

  useEffect(() => {
    if (currentManager) {
      fetchDepartmentActivity()
    }
  }, [currentManager])

  const fetchManagers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/managers`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setManagers(data)

          // Resolve logged-in manager from Cookie -> LocalStorage -> SessionStorage
          let loggedIn = null

          // 1. Check cookies
          if (typeof document !== 'undefined') {
            const cookiePairs = document.cookie ? document.cookie.split('; ') : []
            const cookies = {}
            const clean = s => (s || '').replace(/^["']|["']$/g, '').trim()
            cookiePairs.forEach(pair => {
              const [k, v] = pair.split('=')
              if (k) cookies[k] = clean(decodeURIComponent(v || ''))
            })

            if (cookies.user_email || cookies.user_name || cookies.user_id) {
              loggedIn = {
                user_id: cookies.user_id,
                name: cookies.user_name,
                email: cookies.user_email,
                role: cookies.user_role || 'MANAGER'
              }
            }
          }

          // 2. Check localStorage / sessionStorage
          if (!loggedIn && typeof window !== 'undefined') {
            const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
            if (stored) {
              try { loggedIn = JSON.parse(stored) } catch (e) {}
            }
          }

          // 3. Match against managers list by user_id, email, or department
          let activeMgr = null
          if (loggedIn) {
            activeMgr = data.find(m =>
              (loggedIn.user_id && m.user_id === loggedIn.user_id) ||
              (loggedIn.email && m.email?.toLowerCase() === loggedIn.email?.toLowerCase()) ||
              (loggedIn.department && m.department?.toLowerCase() === loggedIn.department?.toLowerCase())
            )
            if (!activeMgr) {
              activeMgr = loggedIn
            }
          }

          // Fallback if not logged in
          if (!activeMgr) {
            activeMgr = data.find(m => m.department === 'Ebook' || m.department === 'Cloud') || data[0]
          }

          setCurrManager(activeMgr)
        }
      }
    } catch (e) {}
  }

  const fetchDepartmentActivity = async () => {
    if (!currentManager) return
    setLoading(true)
    try {
      const q = currentManager.department_id 
        ? `department_id=${encodeURIComponent(currentManager.department_id)}`
        : `department=${encodeURIComponent(currentManager.department || '')}`
      
      const res = await fetch(`${API_BASE}/api/tickets/department/agent-activity?${q}`)
      if (res.ok) {
        const data = await res.json()
        const tList = data.tickets || []
        setTickets(tList)
        setWorkload(data.agent_workload || [])
        setViolations(data.total_violations || 0)
        setWarnings(data.total_warnings || 0)
        
        if (tList.length > 0) {
          setSelected(prev => (prev && tList.some(t => t.ticket_id === prev.ticket_id)) ? prev : tList[0])
        } else {
          setSelected(null)
        }
      }
    } catch (e) {
    } finally {
      setLoading(false)
    }
  }

  const openRevokeModal = async () => {
    if (!selectedTicket || !currentManager) return
    setShowRevoke(true)
    setRevokeReason('')
    setNewAgentId('')
    try {
      const q = currentManager.department_id
        ? `department_id=${encodeURIComponent(currentManager.department_id)}`
        : `department=${encodeURIComponent(currentManager.department || '')}`
      const res = await fetch(`${API_BASE}/api/admin/department-agents?${q}`)
      if (res.ok) {
        const data = await res.json()
        setDeptAgents(data)
        // Select an agent other than currently assigned
        const others = data.filter(a => a.user_id !== selectedTicket.assigned_agent_id)
        if (others.length > 0) setNewAgentId(others[0].user_id)
      }
    } catch (e) {}
  }

  const handleRevokeSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !newAgentId || !revokeReason.trim()) {
      alert('Please fill out all required fields, including the mandatory removal reason.')
      return
    }

    setRevokeLoad(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${selectedTicket.ticket_id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_agent_id: newAgentId,
          reassigned_by_id: currentManager.user_id,
          reassigned_by_name: currentManager.name,
          reassigned_by_role: 'MANAGER',
          reason: revokeReason.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Failed to revoke and reassign ticket.')
        setRevokeLoad(false)
        return
      }

      setShowRevoke(false)
      setActionAlert(`✅ Access Revoked from ${selectedTicket.assigned_agent || 'previous agent'} & Reassigned! Notification emails dispatched to both agents.`)
      fetchDepartmentActivity()
    } catch (err) {
      alert('Error communicating with backend.')
    } finally {
      setRevokeLoad(false)
      setTimeout(() => setActionAlert(''), 7000)
    }
  }

  // Filtered Tickets
  const filteredTickets = tickets.filter(t => {
    const compStatus = t.policy_compliance?.status || 'COMPLIANT'
    if (filter === 'Violations') return compStatus === 'VIOLATION'
    if (filter === 'Warnings') return compStatus === 'RISK_WARNING'
    if (filter === 'Compliant') return compStatus === 'COMPLIANT'
    if (filter === 'Active Queue') return t.status === 'In Progress' || t.status === 'In Triage'
    if (filter === 'Unassigned') return !t.assigned_agent_id
    return true
  })

  const history = selectedTicket?.assigned_agent_history || selectedTicket?.assignedAgentHistory || []
  const revokedAgents = selectedTicket?.revoked_agents || []
  const compliance = selectedTicket?.policy_compliance || { status: 'COMPLIANT', violations: [], warnings: [] }
  const pythonRule = selectedTicket?.python_rule_output || {}

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="reviewer" userName={currentManager?.name || 'Department Manager'} userEmail={currentManager?.email || 'manager@company.com'} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        
        {/* Top Navbar & Supervisor Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#FFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Manager Audit & Policy Enforcement Workbench</h1>
            <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>Real-time agent monitoring, policy violation audit, and access revocation</p>
          </div>

          {/* Logged-In Manager Profile Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', padding: '6px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0' }}>
            <UserCheck size={16} color="#7C3AED" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                {currentManager?.name || 'Department Manager'}
              </span>
              <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
                {currentManager?.email || 'manager@company.com'} · {currentManager?.role || 'MANAGER'}
              </span>
            </div>
            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 6, background: '#EFF6FF', color: '#2563EB', fontWeight: 800, marginLeft: 6 }}>
              Dept: {currentManager?.department || 'Department'}
            </span>
          </div>
        </div>

        {/* Action Confirmation Banner */}
        {actionAlert && (
          <div style={{ background: '#0F172A', color: '#FFF', padding: '10px 24px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={16} color="#10B981" />
            <span>{actionAlert}</span>
          </div>
        )}

        {/* Revoke Access & Reassign Modal */}
        {showRevokeModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="animate-scale-in" style={{ ...glass, maxWidth: 520, width: '100%', padding: 24, background: '#FFF' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                    <UserX size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>Revoke Access & Reassign Ticket</h3>
                    <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>Ticket: <strong>[{selectedTicket?.ticket_id}]</strong></p>
                  </div>
                </div>
                <button onClick={() => setShowRevoke(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Notice of Removal */}
              <div style={{ background: '#FEF2F2', borderLeft: '4px solid #EF4444', padding: '10px 14px', borderRadius: 6, marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#991B1B' }}>
                  Agent to be Removed: {selectedTicket?.assigned_agent || 'Unassigned'} ({selectedTicket?.assigned_agent_email || 'No email'})
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#B91C1C' }}>
                  ⚠️ This agent's edit & reply access to this ticket will be strictly terminated. The ticket will remain in their read-only audit archive.
                </p>
              </div>

              <form onSubmit={handleRevokeSubmit}>
                {/* Replacement Agent Selection */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 5 }}>
                    Select Replacement Agent in {currentManager?.department} *
                  </label>
                  <select
                    required
                    value={newAgentId}
                    onChange={e => setNewAgentId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12.5, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">-- Choose New Assignee --</option>
                    {deptAgents.filter(a => a.user_id !== selectedTicket?.assigned_agent_id).map(a => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.name} ({a.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mandatory Reason for Revocation */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: 5 }}>
                    Mandatory Reason for Revocation & Removal *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={revokeReason}
                    onChange={e => setRevokeReason(e.target.value)}
                    placeholder="e.g. Non-compliance with Policy DEL-POL-04: Issued unverified discount exceeding 10% limit. Escalation required."
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FFF8F8', fontSize: 12, outline: 'none', resize: 'vertical' }}
                  />
                  <p style={{ fontSize: 10.5, color: '#64748B', margin: '4px 0 0' }}>
                    This explicit reason will be sent directly via email to the removed agent and permanently stamped in the audit trail.
                  </p>
                </div>

                {/* Email dispatch notice */}
                <div style={{ background: '#EFF6FF', padding: 10, borderRadius: 8, fontSize: 11, color: '#1E40AF', marginBottom: 16 }}>
                  📧 <strong>Automated Dual Emails:</strong> Both the removed agent and the newly appointed agent will receive immediate email notifications.
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowRevoke(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'transparent', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={revokeLoading} style={{ padding: '8px 18px', borderRadius: 8, background: '#DC2626', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {revokeLoading ? <RefreshCw size={13} className="spin" /> : 'Confirm Revocation & Reassign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: '16px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Top Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
            <StatCard title="Department Tickets" value={tickets.length} subtitle={`${currentManager?.department || 'Dept'} queue`} icon={FileText} color="violet" delay={0} />
            <StatCard title="Policy Violations"   value={totalViolations} subtitle="Requires intervention" icon={AlertCircle} color="rose" delay={80} />
            <StatCard title="Policy Warnings"     value={totalWarnings} subtitle="Missing documentation" icon={AlertTriangle} color="amber" delay={160} />
            <StatCard title="Active Department Agents" value={agentWorkload.length} subtitle="Frontline staff" icon={User} color="emerald" delay={240} />
          </div>

          {/* Department Workload Summary Bar */}
          {agentWorkload.length > 0 && (
            <div style={{ ...glass, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, overflowX: 'auto' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Agent Workload:</span>
              {agentWorkload.map(a => (
                <div key={a.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{a.agent_name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB' }}>{a.ticket_count} tickets</span>
                  {a.violations > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626' }}>{a.violations} violations</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Two-Column Audit Workbench: Left Tickets List, Right Detail Audit */}
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
            
            {/* ── LEFT: Department Ticket Queue ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: filter === f ? '1.5px solid #7C3AED' : '1px solid #CBD5E1',
                      background: filter === f ? '#F5F3FF' : '#FFF',
                      color: filter === f ? '#7C3AED' : '#64748B',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Tickets List */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8' }}>
                  <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12 }}>Loading department tickets...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div style={{ ...glass, padding: 30, textAlign: 'center', color: '#94A3B8' }}>
                  <CheckCircle size={28} color="#10B981" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, fontWeight: 700 }}>No tickets matching {filter} filter.</p>
                </div>
              ) : (
                filteredTickets.map(t => {
                  const compStatus = t.policy_compliance?.status || 'COMPLIANT'
                  const isViolation = compStatus === 'VIOLATION'
                  const isWarning = compStatus === 'RISK_WARNING'
                  const isSel = selectedTicket?.ticket_id === t.ticket_id

                  return (
                    <div
                      key={t.ticket_id}
                      onClick={() => setSelected(t)}
                      style={{
                        ...glass, padding: 13, cursor: 'pointer',
                        border: isSel ? '2px solid #7C3AED' : isViolation ? '1.5px solid #FCA5A5' : '1px solid #E2E8F0',
                        background: isSel ? '#F5F3FF' : isViolation ? '#FFF5F5' : '#FFF',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED', fontWeight: 800 }}>{t.ticket_id}</span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: P_COLORS[t.priority]?.bg, color: P_COLORS[t.priority]?.c }}>
                            {t.priority}
                          </span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                            background: isViolation ? '#FEE2E2' : isWarning ? '#FEF3C7' : '#DCFCE7',
                            color: isViolation ? '#DC2626' : isWarning ? '#D97706' : '#15803D'
                          }}>
                            {isViolation ? '🚨 VIOLATION' : isWarning ? '⚠️ POLICY RISK' : '✓ COMPLIANT'}
                          </span>
                        </div>
                      </div>

                      <h4 style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </h4>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5 }}>
                        <span style={{ color: t.assigned_agent_id ? '#059669' : '#D97706', fontWeight: 700 }}>
                          👤 {t.assigned_agent || '⚡ Unassigned Pool'}
                        </span>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>{t.status}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ── RIGHT: Supervisor Detail & Compliance Workbench ── */}
            {selectedTicket ? (
              <div style={{ ...glass, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Header Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, paddingBottom: 14, borderBottom: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#7C3AED' }}>{selectedTicket.ticket_id}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: P_COLORS[selectedTicket.priority]?.bg, color: P_COLORS[selectedTicket.priority]?.c }}>
                        {selectedTicket.priority}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#F1F5F9', color: '#475569' }}>
                        Channel: {selectedTicket.channel || 'Web Form'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#ECFDF5', color: '#059669' }}>
                        Dept: {selectedTicket.department}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>{selectedTicket.title}</h3>
                    <p style={{ fontSize: 11.5, color: '#64748B', margin: '3px 0 0' }}>Customer: <strong>{selectedTicket.customer_name || 'Customer'}</strong> ({selectedTicket.customer_email || '—'})</p>
                  </div>

                  {/* Revoke & Reassign Action Button */}
                  <button
                    onClick={openRevokeModal}
                    style={{
                      padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      background: '#DC2626', color: '#FFF', border: 'none', display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 2px 10px rgba(220,38,38,0.25)'
                    }}
                  >
                    <UserX size={14} /> Revoke Access & Reassign
                  </button>
                </div>

                {/* 1. AGENT WORKING ACTIVITY & ACTIONS TAKEN */}
                <div style={{ padding: 14, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={15} color="#2563EB" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>Assigned Agent Activity</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#EFF6FF', color: '#2563EB' }}>
                      Status: {selectedTicket.status}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: '#334155', margin: '0 0 8px' }}>
                    Agent: <strong>{selectedTicket.assigned_agent || 'Unassigned'}</strong> {selectedTicket.assigned_agent_email ? `(${selectedTicket.assigned_agent_email})` : ''}
                  </p>

                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Agent Resolution Notes:</span>
                    <div style={{ background: '#FFF', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, color: '#0F172A', marginTop: 4, minHeight: 36 }}>
                      {selectedTicket.agent_notes || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No notes logged yet by agent.</span>}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Drafted / Sent Customer Reply:</span>
                    <div style={{ background: '#FFF', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12, color: '#334155', marginTop: 4, lineHeight: 1.5, maxHeight: 110, overflowY: 'auto' }}>
                      {selectedTicket.draft_response || selectedTicket.genai_output?.draft_response || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No draft reply generated.</span>}
                    </div>
                  </div>
                </div>

                {/* 2. POLICY COMPLIANCE MATRIX */}
                <div style={{ padding: 14, borderRadius: 10, background: compliance.status === 'VIOLATION' ? '#FFF5F5' : compliance.status === 'RISK_WARNING' ? '#FFFBEB' : '#F0FDF4', border: compliance.status === 'VIOLATION' ? '1.5px solid #FCA5A5' : compliance.status === 'RISK_WARNING' ? '1.5px solid #FDE68A' : '1px solid #BBF7D0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Scale size={15} color={compliance.status === 'VIOLATION' ? '#DC2626' : compliance.status === 'RISK_WARNING' ? '#D97706' : '#15803D'} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: compliance.status === 'VIOLATION' ? '#DC2626' : compliance.status === 'RISK_WARNING' ? '#D97706' : '#15803D', textTransform: 'uppercase' }}>
                        Policy Rule Verification & Compliance Status
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: compliance.status === 'VIOLATION' ? '#FEE2E2' : '#DCFCE7', color: compliance.status === 'VIOLATION' ? '#DC2626' : '#15803D' }}>
                      {compliance.status}
                    </span>
                  </div>

                  {/* Violations / Warnings Display */}
                  {compliance.violations && compliance.violations.length > 0 && (
                    <div style={{ background: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 10, border: '1px solid #F87171' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#991B1B' }}>🚨 Policy Violations Detected:</p>
                      {compliance.violations.map((v, i) => (
                        <p key={i} style={{ margin: '2px 0', fontSize: 11.5, color: '#7F1D1D', fontWeight: 600 }}>• {v}</p>
                      ))}
                    </div>
                  )}

                  {compliance.warnings && compliance.warnings.length > 0 && (
                    <div style={{ background: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 10, border: '1px solid #FCD34D' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#92400E' }}>⚠️ Compliance Warnings:</p>
                      {compliance.warnings.map((w, i) => (
                        <p key={i} style={{ margin: '2px 0', fontSize: 11.5, color: '#78350F' }}>• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Deterministic Rule Breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11.5 }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Matched Rule:</span>
                      <p style={{ margin: '2px 0 6px', fontWeight: 700, color: '#0F172A' }}>{pythonRule.matched_rule_id || 'DEL-POL-04: General Policy Verification'}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Refund Eligibility:</span>
                      <p style={{ margin: '2px 0', fontWeight: 700, color: pythonRule.refund_eligible ? '#059669' : '#DC2626' }}>
                        {pythonRule.refund_eligible ? '✓ Refund Permitted' : '✗ Strictly Non-Refundable'}
                      </p>
                    </div>

                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Policy Reference:</span>
                      <p style={{ margin: '2px 0 6px', color: '#475569' }}>{pythonRule.policy_reference || 'Resolution Standard Operating Procedure v1.0'}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Escalation Required:</span>
                      <p style={{ margin: '2px 0', fontWeight: 700, color: pythonRule.escalation_required ? '#DC2626' : '#64748B' }}>
                        {pythonRule.escalation_required ? '⚠️ Mandatory Manager Escalation' : 'Standard Agent Resolution'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. REVOCATION & ASSIGNMENT AUDIT TRAIL */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <History size={15} color="#7C3AED" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Ticket Assignment & Revocation Audit History</span>
                  </div>

                  {revokedAgents.length > 0 && (
                    <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', padding: '10px 14px', borderRadius: 8, marginBottom: 10 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#BE123C' }}>⛔ Revoked Agent Archive (Access Terminated):</p>
                      {revokedAgents.map((r, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#9F1239', borderBottom: i < revokedAgents.length - 1 ? '1px solid #FFE4E6' : 'none', padding: '4px 0' }}>
                          <strong>{r.name || r.agent_id}</strong> removed by <strong>{r.revoked_by_name || 'Manager'}</strong> on {r.revoked_at ? r.revoked_at.slice(0, 16) : 'recently'}.<br />
                          <span style={{ color: '#881337', fontStyle: 'italic' }}>Reason: "{r.reason}"</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                    {history.length === 0 ? (
                      <p style={{ fontSize: 11.5, color: '#94A3B8', fontStyle: 'italic' }}>No reassignment or claiming events logged yet.</p>
                    ) : (
                      history.slice().reverse().map((h, i) => (
                        <div key={i} style={{ padding: '6px 10px', borderRadius: 6, background: h.action === 'REVOKED_AND_REASSIGNED' ? '#FEF2F2' : '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 11 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, color: h.action === 'REVOKED_AND_REASSIGNED' ? '#DC2626' : '#7C3AED' }}>
                              {h.action === 'REVOKED_AND_REASSIGNED' ? '⛔ ACCESS REVOKED & REASSIGNED' : h.action}
                            </span>
                            <span style={{ color: '#94A3B8', fontSize: 10 }}>{h.timestamp ? h.timestamp.slice(0, 16) : ''}</span>
                          </div>
                          <p style={{ margin: '2px 0 0', color: '#334155' }}>
                            {h.previous_agent_name && (
                              <span>From <strong>{h.previous_agent_name}</strong> ➔ </span>
                            )}
                            Assigned to: <strong>{h.agent_name || h.agent_id}</strong>
                            {h.reassigned_by_name && ` by ${h.reassigned_by_name}`}
                          </p>
                          {h.reason && (
                            <p style={{ margin: '2px 0 0', color: '#DC2626', fontStyle: 'italic' }}>Reason: {h.reason}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div style={{ ...glass, padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <Eye size={32} style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, fontWeight: 600 }}>Select a ticket from the department queue to audit agent activity and verify policy compliance.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
