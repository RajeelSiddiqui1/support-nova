'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import {
  Scale, ShieldAlert, CheckCircle, AlertTriangle, Zap, XCircle,
  User, UserX, UserCheck, ArrowRightLeft, RefreshCw, FileText, Mail, History,
  Clock, ExternalLink, Eye, ShieldCheck, Check, AlertCircle, Info, X, Radio,
  Menu, ChevronLeft
} from 'lucide-react'
import { useRealtimeRefresh } from '../../lib/useWebSocket'

import { API_BASE } from '../../lib/api'
import VerificationScore from '../../components/VerificationScore'
import ComplaintSummary from '../../components/ComplaintSummary'
import IssueBadges from '../../components/IssueBadges'
import RepeatBadge from '../../components/RepeatBadge'
import DeptRouting from '../../components/DeptRouting'

const glass = { background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 16, boxShadow: '0 4px 24px rgba(11,14,20,0.3)' }

const P_COLORS = {
  P0: { bg: 'var(--nw-danger-dim)',  c: '#E8758A', label: 'P0 Critical' },
  P1: { bg: 'var(--nw-warning-dim)', c: '#E8B56B', label: 'P1 High' },
  P2: { bg: 'var(--nw-info-dim)',    c: '#72B4D8', label: 'P2 Medium' },
  P3: { bg: 'rgba(154,156,165,0.1)', c: 'var(--nw-text-muted)', label: 'P3 Low' },
}


const FILTERS = ['All', 'Mismatches / AI Review', 'Escalation Mismatch', 'Dept Mismatch', 'Violations', 'Warnings', 'Compliant', 'Active Queue', 'Unassigned']

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
  const [mobileTab, setMobileTab]         = useState('queue') // 'queue' or 'workbench' on mobile

  // Revoke & Reassign Modal State
  const [showRevokeModal, setShowRevoke]   = useState(false)
  const [revokeMode, setRevokeMode]       = useState('reassign') // 'reassign' or 'pool'
  const [deptAgents, setDeptAgents]       = useState([])
  const [newAgentId, setNewAgentId]       = useState('')
  const [revokeReason, setRevokeReason]   = useState('')
  const [revokeLoading, setRevokeLoad]   = useState(false)
  const [actionAlert, setActionAlert]     = useState('')

  // Cross-Department & Reviewer Reassignment State
  const [reviewersList, setReviewersList]       = useState([])
  const [departmentsList, setDepartmentsList]   = useState([])
  const [deptFilter, setDeptFilter]             = useState('All')
  const [showAssignRevModal, setShowAssignRev]  = useState(false)
  const [targetReviewerId, setTargetReviewerId] = useState('')
  const [assignRevReason, setAssignRevReason]   = useState('')
  const [assignRevLoading, setAssignRevLoad]   = useState(false)

  useEffect(() => {
    fetchManagers()
    fetchReviewersAndDepts()
  }, [])

  useEffect(() => {
    fetchDepartmentActivity()
  }, [deptFilter, currentManager])

  // Live WebSocket Real-Time Synchronization (Zero-Reload)
  const { isConnected: isLiveWs } = useRealtimeRefresh(() => {
    fetchDepartmentActivity()
  })

  const fetchReviewersAndDepts = async () => {
    try {
      const [rRes, dRes] = await Promise.all([
        fetch(`${API_BASE}/api/reviewer/reviewers`),
        fetch(`${API_BASE}/api/departments`)
      ])
      if (rRes.ok) {
        const rData = await rRes.json()
        setReviewersList(Array.isArray(rData) ? rData : [])
      }
      if (dRes.ok) {
        const dData = await dRes.json()
        setDepartmentsList(Array.isArray(dData) ? dData : [])
      }
    } catch (e) {}
  }

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
                role: cookies.user_role || 'REVIEWER'
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
            activeMgr = data.find(m => m.department === 'Ebook' || m.department === 'Clothes') || data[0]
          }

          setCurrManager(activeMgr)
        }
      }
    } catch (e) {}
  }

  const fetchDepartmentActivity = async () => {
    setLoading(true)
    try {
      const q = deptFilter && deptFilter !== 'All'
        ? `department=${encodeURIComponent(deptFilter)}`
        : 'department=All'
      
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

  const handleClaimReview = async () => {
    if (!selectedTicket) return
    const revId = currentManager?.user_id || 'REV-001'
    const revName = currentManager?.name || 'Reviewer'
    try {
      const res = await fetch(`${API_BASE}/api/reviewer/tickets/${selectedTicket.ticket_id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_id: revId, reviewer_name: revName })
      })
      const data = await res.json()
      if (res.ok) {
        setActionAlert(`⚖️ Ticket ${selectedTicket.ticket_id} claimed by Reviewer ${revName}!`)
        fetchDepartmentActivity()
      } else {
        alert(data.detail || 'Failed to claim review ticket.')
      }
    } catch (err) {
      alert('Error connecting to backend server.')
    }
  }

  const handleAssignReviewerSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !targetReviewerId) return
    setAssignRevLoad(true)
    try {
      const target = reviewersList.find(r => r.user_id === targetReviewerId)
      const res = await fetch(`${API_BASE}/api/reviewer/tickets/${selectedTicket.ticket_id}/assign-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_reviewer_id: targetReviewerId,
          new_reviewer_name: target?.name || 'Reviewer',
          assigned_by_id: currentManager?.user_id,
          assigned_by_name: currentManager?.name,
          reason: assignRevReason.trim() || 'Reviewer workload rebalancing'
        })
      })
      const data = await res.json()
      if (res.ok) {
        setShowAssignRevModal(false)
        setActionAlert(`✅ Review ticket ${selectedTicket.ticket_id} transferred to Reviewer ${target?.name || targetReviewerId}!`)
        fetchDepartmentActivity()
      } else {
        alert(data.detail || 'Failed to assign reviewer.')
      }
    } catch (err) {
      alert('Error connecting to backend.')
    } finally {
      setAssignRevLoad(false)
    }
  }

  const handleReviewerApprove = async () => {
    if (!selectedTicket) return
    try {
      const res = await fetch(`${API_BASE}/api/reviewer/tickets/${selectedTicket.ticket_id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE',
          reviewer_id: currentManager?.user_id || 'REV-001',
          reviewer_name: currentManager?.name || 'Reviewer',
          notes: 'Reviewer validated resolution and approved ticket'
        })
      })
      if (res.ok) {
        setActionAlert(`✅ Ticket ${selectedTicket.ticket_id} approved by Reviewer!`)
        fetchDepartmentActivity()
      } else {
        const data = await res.json()
        alert(data.detail || 'Failed to approve ticket.')
      }
    } catch (err) {
      alert('Error connecting to backend server.')
    }
  }

  const openRevokeModal = async (mode = 'reassign') => {
    if (!selectedTicket || !currentManager) return
    setRevokeMode(mode)
    setShowRevoke(true)
    setRevokeReason(selectedTicket.assigned_agent_id ? '' : 'Assigned by Reviewer after policy and department triage')
    setNewAgentId('')
    try {
      // First try to fetch active agents belonging to ticket's department
      const targetDeptId = selectedTicket.department_id || currentManager.department_id
      const targetDept = selectedTicket.department || currentManager.department
      const q = targetDeptId
        ? `department_id=${encodeURIComponent(targetDeptId)}`
        : (targetDept ? `department=${encodeURIComponent(targetDept)}` : '')
      let res = await fetch(`${API_BASE}/api/admin/department-agents?${q}`)
      let data = res.ok ? await res.json() : []
      if (!Array.isArray(data) || data.length === 0) {
        // Fallback: fetch all active agents across departments so reviewer is never blocked
        res = await fetch(`${API_BASE}/api/admin/department-agents`)
        data = res.ok ? await res.json() : []
      }
      setDeptAgents(data)
      const others = data.filter(a => a.user_id !== selectedTicket.assigned_agent_id)
      if (others.length > 0) setNewAgentId(others[0].user_id)
      else if (data.length > 0) setNewAgentId(data[0].user_id)
    } catch (e) {}
  }

  const handleRevokeSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !revokeReason.trim()) {
      alert('Please provide the assignment or revocation reason.')
      return
    }

    if (revokeMode === 'reassign' && !newAgentId) {
      alert('Please select an agent to assign.')
      return
    }

    setRevokeLoad(true)
    try {
      if (revokeMode === 'pool') {
        const res = await fetch(`${API_BASE}/api/tickets/${selectedTicket.ticket_id}/release-to-pool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manager_id: currentManager.user_id,
            manager_name: currentManager.name,
            manager_role: currentManager.role || 'REVIEWER',
            reason: revokeReason.trim()
          })
        })

        const data = await res.json()
        if (!res.ok) {
          alert(data.detail || 'Failed to release ticket to open pool.')
          setRevokeLoad(false)
          return
        }

        setShowRevoke(false)
        setActionAlert(`⚡ Access Revoked from ${selectedTicket.assigned_agent || 'agent'} & Ticket Released to Open Pool! Agent is permanently blocked from re-claiming.`)
        fetchDepartmentActivity()
      } else {
        const res = await fetch(`${API_BASE}/api/tickets/${selectedTicket.ticket_id}/reassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_agent_id: newAgentId,
            reassigned_by_id: currentManager.user_id,
            reassigned_by_name: currentManager.name,
            reassigned_by_role: currentManager.role || 'REVIEWER',
            reason: revokeReason.trim()
          })
        })

        const data = await res.json()
        if (!res.ok) {
          alert(data.detail || 'Failed to assign / reassign ticket.')
          setRevokeLoad(false)
          return
        }

        setShowRevoke(false)
        const isReassign = Boolean(selectedTicket.assigned_agent_id)
        setActionAlert(isReassign
          ? `✅ Access Revoked from ${selectedTicket.assigned_agent || 'previous agent'} & Reassigned! Notification emails dispatched.`
          : `✅ Ticket assigned to agent successfully! Ticket moved to 'In Progress'.`
        )
        fetchDepartmentActivity()
      }
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
    if (filter === 'Mismatches / AI Review') return t.status === 'AI Review' || t.status === 'NEEDS_REVIEW' || t.department_mismatch || t.match_status === false
    if (filter === 'Escalation Mismatch') return t.mismatch_type === 'ESCALATION_MISMATCH' || (t.department_mismatch && t.escalation_required)
    if (filter === 'Dept Mismatch') return t.department_mismatch === true
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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--nw-base)' }}>
      <Sidebar role="reviewer" userName={currentManager?.name || 'Department Manager'} userEmail={currentManager?.email || 'manager@company.com'} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        
        {/* Top Navbar & Supervisor Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--nw-surface)', borderBottom: '1px solid var(--nw-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-supportnova-sidebar'))}
              className="sidebar-toggle-btn"
              aria-label="Toggle navigation menu"
              style={{
                background: 'var(--nw-elevated)',
                border: '1px solid var(--nw-border)',
                cursor: 'pointer',
                color: 'var(--nw-text-secondary)',
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
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Manager Audit & Reviewer Workbench
              </h1>
              <p className="hide-on-mobile" style={{ fontSize: 11, color: 'var(--nw-text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Real-time agent monitoring, policy violation audit, and access revocation
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Live WebSocket Status Indicator */}
            <div
              className="hide-on-mobile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 99,
                background: isLiveWs ? '#ECFDF5' : '#FFFBEB',
                border: isLiveWs ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                fontSize: 10.5,
                fontWeight: 700,
                color: isLiveWs ? '#059669' : '#D97706',
              }}
              title={isLiveWs ? "Connected to Real-time WebSocket: Updates stream instantly without page reload" : "Reconnecting to WebSocket..."}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isLiveWs ? '#059669' : '#D97706',
                  boxShadow: isLiveWs ? '0 0 8px #10B981' : undefined
                }}
              />
              {isLiveWs ? 'Live Sync' : 'Connecting...'}
            </div>

            {/* Logged-In Manager Profile Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--nw-elevated)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--nw-border-strong)' }}>
              <UserCheck size={16} color="#7C3AED" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--nw-text-primary)' }}>
                  {currentManager?.name || 'Department Manager'}
                </span>
                <span className="hide-on-mobile" style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 600 }}>
                  {currentManager?.email || 'manager@company.com'} · {currentManager?.role || 'MANAGER'}
                </span>
              </div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-info-dim)', color: '#2563EB', fontWeight: 800 }}>
                {currentManager?.department || 'Dept'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar between Queue and Workbench */}
        <div className="show-on-mobile-flex" style={{ display: 'none', background: 'var(--nw-surface)', borderBottom: '1px solid var(--nw-border)', padding: '6px 12px', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setMobileTab('queue')}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: mobileTab === 'queue' ? '#7C3AED' : '#F1F5F9',
              color: mobileTab === 'queue' ? '#FFF' : '#64748B',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s'
            }}
          >
            ⚖️ Queue ({filteredTickets.length})
          </button>
          <button
            onClick={() => setMobileTab('workbench')}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: mobileTab === 'workbench' ? '#7C3AED' : '#F1F5F9',
              color: mobileTab === 'workbench' ? '#FFF' : '#64748B',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s'
            }}
          >
            🛡️ Workbench {selectedTicket ? `[${selectedTicket.ticket_id}]` : ''}
          </button>
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--nw-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="animate-scale-in" style={{ ...glass, maxWidth: 540, width: '100%', padding: 24, background: 'var(--nw-surface)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: revokeMode === 'pool' ? 'var(--nw-warning-dim)' : (!selectedTicket?.assigned_agent_id ? 'var(--nw-accent-dim)' : 'var(--nw-danger-dim)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: revokeMode === 'pool' ? '#E8B56B' : (!selectedTicket?.assigned_agent_id ? 'var(--nw-accent)' : '#E8758A') }}>
                    {revokeMode === 'pool' ? <Zap size={20} /> : (!selectedTicket?.assigned_agent_id ? <UserCheck size={20} /> : <UserX size={20} />)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0 }}>
                      {!selectedTicket?.assigned_agent_id ? 'Assign Ticket to Agent' : (revokeMode === 'pool' ? 'Revoke Access & Release to Open Pool' : 'Revoke Access & Reassign Ticket')}
                    </h3>
                    <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', margin: '2px 0 0' }}>Ticket: <strong>[{selectedTicket?.ticket_id}]</strong></p>
                  </div>
                </div>
                <button onClick={() => setShowRevoke(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nw-text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Mode Switcher Tabs (Only if ticket is already assigned) */}
              {selectedTicket?.assigned_agent_id && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'var(--nw-elevated)', padding: 4, borderRadius: 10 }}>
                  <button
                    type="button"
                    onClick={() => setRevokeMode('reassign')}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      border: 'none',
                      background: revokeMode === 'reassign' ? 'var(--nw-accent)' : 'transparent',
                      color: revokeMode === 'reassign' ? 'var(--nw-text-inverse)' : 'var(--nw-text-secondary)',
                      boxShadow: revokeMode === 'reassign' ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
                    }}
                  >
                    🔄 Reassign to Specific Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevokeMode('pool')}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      border: 'none',
                      background: revokeMode === 'pool' ? 'var(--nw-warning)' : 'transparent',
                      color: revokeMode === 'pool' ? 'var(--nw-text-inverse)' : 'var(--nw-text-secondary)',
                      boxShadow: revokeMode === 'pool' ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
                    }}
                  >
                    ⚡ Release to Open Pool (Remove Agent)
                  </button>
                </div>
              )}

              {/* Notice of Removal (Only if currently assigned) */}
              {selectedTicket?.assigned_agent_id ? (
                <div style={{ background: 'var(--nw-danger-dim)', borderLeft: '4px solid #E8758A', padding: '10px 14px', borderRadius: 6, marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#E8758A' }}>
                    Agent to be Removed: {selectedTicket?.assigned_agent || 'Assigned Agent'} ({selectedTicket?.assigned_agent_email || 'No email'})
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--nw-text-secondary)' }}>
                    ⚠️ This agent's edit & reply access to this ticket will be strictly terminated. They will be permanently barred from claiming or modifying this ticket.
                  </p>
                </div>
              ) : (
                <div style={{ background: 'var(--nw-accent-dim)', borderLeft: '4px solid var(--nw-accent)', padding: '10px 14px', borderRadius: 6, marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--nw-accent)' }}>
                    📋 Reviewer Triage Assignment
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--nw-text-secondary)' }}>
                    Assigning an agent will resolve the department/policy hold, move ticket status to <strong>'In Progress'</strong>, and notify the selected agent.
                  </p>
                </div>
              )}

              {revokeMode === 'pool' && selectedTicket?.assigned_agent_id && (
                <div style={{ background: 'var(--nw-warning-dim)', borderLeft: '4px solid #E8B56B', padding: '10px 14px', borderRadius: 6, marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#E8B56B' }}>
                    ⚡ Open Department Pool (Active Agents Queue):
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--nw-text-secondary)', lineHeight: 1.4 }}>
                    The ticket will return to <strong>'In Triage'</strong> in the unassigned pool. Any other active agent can claim it on first response.
                  </p>
                </div>
              )}

              <form onSubmit={handleRevokeSubmit}>
                {/* Replacement Agent Selection (Only for Reassign mode) */}
                {revokeMode === 'reassign' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>
                      Select Active Agent to Assign *
                    </label>
                    <select
                      required
                      value={newAgentId}
                      onChange={e => setNewAgentId(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 12.5, outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="">-- Choose Assignee --</option>
                      {deptAgents.filter(a => a.user_id !== selectedTicket?.assigned_agent_id).map(a => (
                        <option key={a.user_id} value={a.user_id}>
                          {a.name} ({a.email}) - {a.department || 'General'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Reason for Assignment / Revocation */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: selectedTicket?.assigned_agent_id ? '#E8758A' : 'var(--nw-accent)', textTransform: 'uppercase', marginBottom: 5 }}>
                    {selectedTicket?.assigned_agent_id ? 'Mandatory Reason for Revocation & Removal *' : 'Assignment Notes / Triage Reason *'}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={revokeReason}
                    onChange={e => setRevokeReason(e.target.value)}
                    placeholder={selectedTicket?.assigned_agent_id ? "e.g. Non-compliance with Policy DEL-POL-04: Issued unverified discount exceeding limit." : "e.g. Assigned to Clothes specialist after reviewing item exchange request."}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 12, outline: 'none', resize: 'vertical' }}
                  />
                  <p style={{ fontSize: 10.5, color: 'var(--nw-text-muted)', margin: '4px 0 0' }}>
                    This reason will be recorded in the audit trail and emailed to the assigned agent.
                  </p>
                </div>

                {/* Email dispatch notice */}
                <div style={{ background: 'var(--nw-info-dim)', padding: 10, borderRadius: 8, fontSize: 11, color: 'var(--nw-info)', marginBottom: 16 }}>
                  📧 <strong>Automated Notifications:</strong> {revokeMode === 'pool' ? 'The removed agent will receive an immediate email stating the removal reason.' : 'The assigned agent will receive an immediate email notification with complaint details.'}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowRevoke(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', background: 'transparent', color: 'var(--nw-text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={revokeLoading} style={{ padding: '8px 18px', borderRadius: 8, background: revokeMode === 'pool' ? 'var(--nw-warning)' : (!selectedTicket?.assigned_agent_id ? 'var(--nw-accent)' : 'var(--nw-danger)'), color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {revokeLoading ? <RefreshCw size={13} className="spin" /> : (revokeMode === 'pool' ? 'Confirm Removal & Release to Pool' : (!selectedTicket?.assigned_agent_id ? 'Confirm & Assign to Agent' : 'Confirm Revocation & Reassign'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign to Reviewer Modal (Cross-Department) */}
        {showAssignRevModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--nw-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="animate-scale-in" style={{ ...glass, maxWidth: 500, width: '100%', padding: 24, background: 'var(--nw-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nw-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0 }}>Assign Ticket to Another Reviewer</h3>
                    <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', margin: '2px 0 0' }}>Ticket: <strong>[{selectedTicket?.ticket_id}]</strong></p>
                  </div>
                </div>
                <button onClick={() => setShowAssignRevModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nw-text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAssignReviewerSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--nw-text-secondary)', textTransform: 'uppercase', marginBottom: 5 }}>
                    Select Target Reviewer (Cross-Department) *
                  </label>
                  <select
                    required
                    value={targetReviewerId}
                    onChange={e => setTargetReviewerId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', fontSize: 13, outline: 'none', background: 'var(--nw-elevated)' }}
                  >
                    <option value="">-- Choose Active Reviewer --</option>
                    {reviewersList.map(r => (
                      <option key={r.user_id} value={r.user_id}>
                        {r.name} ({r.email}) - {r.department || 'All Departments'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--nw-text-secondary)', textTransform: 'uppercase', marginBottom: 5 }}>
                    Reassignment Reason (Optional)
                  </label>
                  <input
                    value={assignRevReason}
                    onChange={e => setAssignRevReason(e.target.value)}
                    placeholder="e.g. Workload balancing, specialized product review"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', fontSize: 12.5, outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowAssignRevModal(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', background: 'transparent', color: 'var(--nw-text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={assignRevLoading} style={{ padding: '8px 18px', borderRadius: 8, background: '#7C3AED', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {assignRevLoading ? <RefreshCw size={13} className="spin" /> : 'Confirm Reviewer Assignment'}
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
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--nw-text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Agent Workload:</span>
              {agentWorkload.map(a => (
                <div key={a.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--nw-elevated)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--nw-border)', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-text-primary)' }}>{a.agent_name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'var(--nw-info-dim)', color: '#2563EB' }}>{a.ticket_count} tickets</span>
                  {a.violations > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'var(--nw-danger-dim)', color: '#E8758A' }}>{a.violations} violations</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Two-Column Audit Workbench: Left Tickets List, Right Detail Audit */}
          <div className="responsive-split-stack" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
            
            {/* ── LEFT: Department Ticket Queue ── */}
            <div className={`agent-queue-col ${mobileTab === 'workbench' ? 'hide-on-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              {/* Department Scope Selector */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--nw-surface)', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--nw-border)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--nw-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Department Scope:</span>
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', fontSize: 11.5, fontWeight: 700, outline: 'none', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)' }}
                >
                  <option value="All">🌐 All Departments (Global Review)</option>
                  {departmentsList.map(d => (
                    <option key={d.dept_id || d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: filter === f ? '1.5px solid var(--nw-accent)' : '1px solid var(--nw-border-strong)',
                      background: filter === f ? 'var(--nw-accent-dim)' : 'var(--nw-surface)',
                      color: filter === f ? 'var(--nw-accent)' : 'var(--nw-text-secondary)',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Tickets List */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--nw-text-muted)' }}>
                  <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12 }}>Loading department tickets...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div style={{ ...glass, padding: 30, textAlign: 'center', color: 'var(--nw-text-muted)' }}>
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
                      onClick={() => {
                        setSelected(t)
                        setMobileTab('workbench')
                      }}
                      style={{
                        ...glass, padding: 13, cursor: 'pointer',
                        border: isSel ? '2px solid var(--nw-accent)' : isViolation ? '1.5px solid rgba(232,117,138,0.5)' : '1px solid var(--nw-border)',
                        background: isSel ? 'var(--nw-accent-dim)' : isViolation ? 'var(--nw-danger-dim)' : 'var(--nw-surface)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--nw-accent)', fontWeight: 800 }}>{t.ticket_id}</span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: P_COLORS[t.priority]?.bg, color: P_COLORS[t.priority]?.c }}>
                            {t.priority}
                          </span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                            background: isViolation ? 'var(--nw-danger-dim)' : isWarning ? 'var(--nw-warning-dim)' : 'var(--nw-success-dim)',
                            color: isViolation ? '#E8758A' : isWarning ? '#E8B56B' : '#4FA689'
                          }}>
                            {isViolation ? '🚨 VIOLATION' : isWarning ? '⚠️ POLICY RISK' : '✓ COMPLIANT'}
                          </span>
                        </div>
                      </div>

                      <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--nw-text-primary)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </h4>

                      {/* Issue Badges */}
                      <div style={{ marginBottom: 5 }}>
                        <IssueBadges
                          primaryIssue={t.category || t.primary_issue || ''}
                          secondaryIssues={t.secondary_issues || t.genai_output?.secondary_issues || []}
                        />
                      </div>
                      {(t.is_repeat || t.duplicate_of) && (
                        <div style={{ marginBottom: 4 }}>
                          <RepeatBadge duplicateOf={t.duplicate_of} priorCount={t.repeat_count || 0} />
                        </div>
                      )}
                      {t.department_mismatch && (
                        <span style={{ fontSize: 9.5, fontWeight: 800, padding: '1px 7px', borderRadius: 4, background: 'var(--nw-danger-dim)', color: '#E8758A', border: '1px solid rgba(193,73,91,0.35)' }}>
                          ⚡ {t.mismatch_type || 'MISMATCH'}
                        </span>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5 }}>
                        <span style={{ color: t.assigned_agent_id ? '#059669' : '#D97706', fontWeight: 700 }}>
                          👤 {t.assigned_agent || '⚡ Unassigned Pool'}
                        </span>
                        <span style={{ color: 'var(--nw-text-muted)', fontWeight: 600 }}>{t.status}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginTop: 3 }}>
                        <span style={{ color: t.assigned_reviewer_id ? '#7C3AED' : '#94A3B8', fontWeight: 700 }}>
                          ⚖️ {t.assigned_reviewer_name ? `Rev: ${t.assigned_reviewer_name}` : 'Unclaimed Review'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ── RIGHT: Supervisor Detail & Compliance Workbench ── */}
            {selectedTicket ? (
              <div
                className={`agent-workbench-col ${mobileTab === 'queue' ? 'hide-on-mobile' : ''}`}
                style={{ ...glass, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                {/* Back to Queue Button for Mobile */}
                <button
                  className="show-on-mobile-flex"
                  onClick={() => setMobileTab('queue')}
                  style={{
                    display: 'none', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, background: 'var(--nw-info-dim)',
                    border: '1px solid rgba(74,155,201,0.3)', fontSize: 12, fontWeight: 700,
                    color: '#2563EB', cursor: 'pointer', width: 'fit-content'
                  }}
                >
                  <ChevronLeft size={16} /> Back to Audit Queue
                </button>
                
                {/* Header Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, paddingBottom: 14, borderBottom: '1px solid var(--nw-border)' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#7C3AED' }}>{selectedTicket.ticket_id}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: P_COLORS[selectedTicket.priority]?.bg, color: P_COLORS[selectedTicket.priority]?.c }}>
                        {selectedTicket.priority}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-elevated)', color: 'var(--nw-text-secondary)' }}>
                        Channel: {selectedTicket.channel || 'Web Form'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-success-dim)', color: '#059669' }}>
                        Dept: {selectedTicket.department}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--nw-text-primary)', margin: 0 }}>{selectedTicket.title}</h3>
                    <p style={{ fontSize: 11.5, color: 'var(--nw-text-muted)', margin: '3px 0 0' }}>Customer: <strong>{selectedTicket.customer_name || 'Customer'}</strong> ({selectedTicket.customer_email || '—'})</p>
                  </div>

                  {/* Action Buttons: Release to Open Pool & Revoke/Reassign */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => openRevokeModal('pool')}
                      disabled={!selectedTicket.assigned_agent_id}
                      style={{
                        padding: '8px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                        cursor: selectedTicket.assigned_agent_id ? 'pointer' : 'not-allowed',
                        background: selectedTicket.assigned_agent_id ? 'var(--nw-warning-dim)' : 'var(--nw-elevated)',
                        color: selectedTicket.assigned_agent_id ? '#E8B56B' : 'var(--nw-text-muted)',
                        border: selectedTicket.assigned_agent_id ? '1px solid rgba(232,181,107,0.3)' : '1px solid var(--nw-border-strong)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        opacity: selectedTicket.assigned_agent_id ? 1 : 0.6
                      }}
                      title={selectedTicket.assigned_agent_id ? "Remove agent and return ticket to open department pool" : "Ticket is already unassigned"}
                    >
                      <Zap size={14} /> Release to Open Pool
                    </button>

                    <button
                      onClick={() => openRevokeModal('reassign')}
                      style={{
                        padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        background: selectedTicket.assigned_agent_id ? 'var(--nw-danger)' : 'var(--nw-accent)',
                        color: 'var(--nw-text-inverse)', border: 'none', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: selectedTicket.assigned_agent_id ? '0 2px 10px rgba(193,73,91,0.25)' : '0 2px 10px rgba(201,111,74,0.25)'
                      }}
                    >
                      {selectedTicket.assigned_agent_id ? <UserX size={14} /> : <UserCheck size={14} />}
                      {selectedTicket.assigned_agent_id ? 'Revoke & Reassign' : 'Assign to Agent'}
                    </button>
                  </div>
                </div>

                {/* ── Complaint Summary ── */}
                <ComplaintSummary ticket={selectedTicket} variant="agent" />

                {/* ── Dept Routing ── */}
                {(selectedTicket.primary_department || selectedTicket.department) && (
                  <DeptRouting
                    primaryDept={selectedTicket.primary_department || selectedTicket.department}
                    supportingDepts={selectedTicket.supporting_departments || []}
                  />
                )}

                {/* ── AI Verification Score ── */}
                <VerificationScore
                  matchStatus={selectedTicket.routing_match !== false && !selectedTicket.department_mismatch}
                  confidenceScore={selectedTicket.verification_score}
                />

                {/* ── Side-by-side GenAI vs Python Comparison ── */}
                {(selectedTicket.genai_output || selectedTicket.python_output) && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}>
                    {/* GenAI Output */}
                    <div style={{
                      background: 'var(--nw-elevated)',
                      border: '1px solid rgba(74,155,201,0.25)',
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#72B4D8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.06em' }}>
                        🤖 GenAI Pipeline 1
                      </div>
                      {[
                        ['Category', selectedTicket.genai_output?.issue_category || selectedTicket.category],
                        ['Department', selectedTicket.genai_output?.department || selectedTicket.department],
                        ['Priority', selectedTicket.genai_output?.priority || selectedTicket.priority],
                        ['Sentiment', selectedTicket.genai_output?.sentiment || selectedTicket.sentiment],
                        ['Urgency', selectedTicket.genai_output?.urgency || selectedTicket.urgency],
                        ['Policy ID', selectedTicket.genai_output?.policy_id || selectedTicket.policy_id],
                      ].map(([label, value]) => value ? (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                          <span style={{ color: 'var(--nw-text-muted)' }}>{label}</span>
                          <span style={{ color: 'var(--nw-text-primary)', fontWeight: 600 }}>{value}</span>
                        </div>
                      ) : null)}
                    </div>

                    {/* Python Deterministic Output */}
                    <div style={{
                      background: 'var(--nw-elevated)',
                      border: `1px solid ${selectedTicket.department_mismatch ? 'rgba(193,73,91,0.35)' : 'rgba(79,166,137,0.25)'}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: selectedTicket.department_mismatch ? '#E8758A' : '#4FA689', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.06em' }}>
                        🐍 Python Pipeline 2 {selectedTicket.department_mismatch ? '⚡ MISMATCH' : '✓ Match'}
                      </div>
                      {[
                        ['Department', selectedTicket.python_output?.department || selectedTicket.primary_department],
                        ['Priority', selectedTicket.python_output?.priority],
                        ['Escalation', selectedTicket.escalation_required ? `Required (${selectedTicket.escalation_level || 'L1'})` : 'Not Required'],
                        ['Mismatch Type', selectedTicket.mismatch_type],
                        ['Routing Match', selectedTicket.routing_match === false ? '❌ No' : '✓ Yes'],
                        ['SLA Risk', selectedTicket.sla_risk],
                      ].map(([label, value]) => value ? (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                          <span style={{ color: 'var(--nw-text-muted)' }}>{label}</span>
                          <span style={{
                            color: (label === 'Mismatch Type' || (label === 'Routing Match' && value.includes('❌'))) ? '#E8758A' : 'var(--nw-text-primary)',
                            fontWeight: 600
                          }}>{value}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}

                {/* ── Hallucination Flags ── */}
                {(selectedTicket.hallucination_flags?.length > 0) && (
                  <div style={{
                    background: 'rgba(193,73,91,0.1)',
                    border: '1.5px solid rgba(193,73,91,0.45)',
                    borderRadius: 10,
                    padding: '12px 16px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#E8758A', marginBottom: 8 }}>⚠️ Hallucination Flags</div>
                    {selectedTicket.hallucination_flags.map((f, i) => (
                      <div key={i} style={{ fontSize: 11.5, color: 'var(--nw-text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(193,73,91,0.4)' }}>
                        <strong style={{ color: '#E8758A' }}>{f.type}</strong>: {f.description}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Policy Applicability Chips ── */}
                {selectedTicket.policy_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Policy:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6, background: 'var(--nw-info-dim)', color: '#72B4D8', border: '1px solid rgba(74,155,201,0.3)' }}>
                      {selectedTicket.policy_id}
                    </span>
                  </div>
                )}

                {/* ── Escalation Notes Panel ── */}
                {selectedTicket.escalation_required && selectedTicket.escalation_notes && (
                  <div style={{
                    background: 'var(--nw-danger-dim)',
                    border: '1px solid rgba(193,73,91,0.35)',
                    borderRadius: 10,
                    padding: '12px 16px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#E8758A', marginBottom: 6 }}>🚨 Escalation Notes</div>
                    <div style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.6 }}>{selectedTicket.escalation_notes}</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--nw-text-muted)' }}>Level: <strong style={{ color: '#E8758A' }}>{selectedTicket.escalation_level}</strong></div>
                  </div>
                )}

                {/* 0. REVIEWER WORKSPACE ACTIONS & OWNERSHIP */}

                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--nw-accent-dim)', border: '1px solid rgba(201,111,74,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--nw-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nw-text-inverse)', flexShrink: 0 }}>
                      <Scale size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--nw-accent)', textTransform: 'uppercase' }}>Reviewer Ownership</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--nw-text-secondary)' }}>
                        {selectedTicket.assigned_reviewer_name ? (
                          <span>Assigned Reviewer: <strong style={{ color: 'var(--nw-accent)' }}>{selectedTicket.assigned_reviewer_name}</strong></span>
                        ) : (
                          <span style={{ color: 'var(--nw-warning)' }}>⚠️ Unclaimed Ticket — Open for any Reviewer</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleClaimReview}
                      style={{
                        padding: '7px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
                        background: 'var(--nw-accent)', color: 'var(--nw-text-inverse)', border: 'none', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 2px 8px rgba(201,111,74,0.25)'
                      }}
                      title="Claim this review ticket for yourself"
                    >
                      <UserCheck size={14} /> Claim Review
                    </button>

                    <button
                      onClick={() => setShowAssignRevModal(true)}
                      style={{
                        padding: '7px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                        background: 'var(--nw-surface)', color: 'var(--nw-accent)', border: '1.5px solid var(--nw-accent)', display: 'flex', alignItems: 'center', gap: 6
                      }}
                      title="Transfer ticket to another active reviewer"
                    >
                      <ArrowRightLeft size={14} /> Transfer Reviewer
                    </button>

                    <button
                      onClick={handleReviewerApprove}
                      disabled={selectedTicket.status === 'Resolved'}
                      style={{
                        padding: '7px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 800,
                        cursor: selectedTicket.status === 'Resolved' ? 'not-allowed' : 'pointer',
                        background: selectedTicket.status === 'Resolved' ? 'var(--nw-elevated)' : 'var(--nw-success)',
                        color: selectedTicket.status === 'Resolved' ? 'var(--nw-text-muted)' : 'var(--nw-text-inverse)',
                        border: 'none', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: selectedTicket.status === 'Resolved' ? 'none' : '0 2px 8px rgba(79,166,137,0.25)'
                      }}
                    >
                      <CheckCircle size={14} /> Approve & Finalize
                    </button>
                  </div>
                </div>

                {/* 1. AGENT WORKING ACTIVITY & ACTIONS TAKEN */}
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={15} color="#2563EB" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--nw-info)', textTransform: 'uppercase' }}>Assigned Agent Activity</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-info-dim)', color: '#2563EB' }}>
                      Status: {selectedTicket.status}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', margin: '0 0 8px' }}>
                    Agent: <strong>{selectedTicket.assigned_agent || 'Unassigned'}</strong> {selectedTicket.assigned_agent_email ? `(${selectedTicket.assigned_agent_email})` : ''}
                  </p>

                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Agent Resolution Notes:</span>
                    <div style={{ background: 'var(--nw-surface)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--nw-border-strong)', fontSize: 12, color: 'var(--nw-text-primary)', marginTop: 4, minHeight: 36 }}>
                      {selectedTicket.agent_notes || <span style={{ color: 'var(--nw-text-muted)', fontStyle: 'italic' }}>No notes logged yet by agent.</span>}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Drafted / Sent Customer Reply:</span>
                    <div style={{ background: 'var(--nw-surface)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--nw-border-strong)', fontSize: 12, color: 'var(--nw-text-secondary)', marginTop: 4, lineHeight: 1.5, maxHeight: 110, overflowY: 'auto' }}>
                      {selectedTicket.draft_response || selectedTicket.genai_output?.draft_response || <span style={{ color: 'var(--nw-text-muted)', fontStyle: 'italic' }}>No draft reply generated.</span>}
                    </div>
                  </div>
                </div>

                {/* 2. POLICY COMPLIANCE MATRIX */}
                <div style={{ padding: 14, borderRadius: 10, background: compliance.status === 'VIOLATION' ? 'var(--nw-danger-dim)' : compliance.status === 'RISK_WARNING' ? 'var(--nw-warning-dim)' : 'var(--nw-surface)', border: compliance.status === 'VIOLATION' ? '1.5px solid rgba(232,117,138,0.4)' : compliance.status === 'RISK_WARNING' ? '1.5px solid rgba(232,181,107,0.4)' : '1px solid var(--nw-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Scale size={15} color={compliance.status === 'VIOLATION' ? '#E8758A' : compliance.status === 'RISK_WARNING' ? '#E8B56B' : '#4FA689'} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: compliance.status === 'VIOLATION' ? '#E8758A' : compliance.status === 'RISK_WARNING' ? '#E8B56B' : '#4FA689', textTransform: 'uppercase' }}>
                        Policy Rule Verification & Compliance Status
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: compliance.status === 'VIOLATION' ? 'var(--nw-danger-dim)' : 'var(--nw-success-dim)', color: compliance.status === 'VIOLATION' ? '#E8758A' : '#4FA689', border: '1px solid var(--nw-border)' }}>
                      {compliance.status}
                    </span>
                  </div>

                  {/* Violations / Warnings Display */}
                  {compliance.violations && compliance.violations.length > 0 && (
                    <div style={{ background: 'var(--nw-danger-dim)', padding: 10, borderRadius: 8, marginBottom: 10, border: '1px solid rgba(193,73,91,0.3)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#991B1B' }}>🚨 Policy Violations Detected:</p>
                      {compliance.violations.map((v, i) => (
                        <p key={i} style={{ margin: '2px 0', fontSize: 11.5, color: '#7F1D1D', fontWeight: 600 }}>• {v}</p>
                      ))}
                    </div>
                  )}

                  {compliance.warnings && compliance.warnings.length > 0 && (
                    <div style={{ background: 'var(--nw-warning-dim)', padding: 10, borderRadius: 8, marginBottom: 10, border: '1px solid rgba(217,164,65,0.3)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#92400E' }}>⚠️ Compliance Warnings:</p>
                      {compliance.warnings.map((w, i) => (
                        <p key={i} style={{ margin: '2px 0', fontSize: 11.5, color: '#78350F' }}>• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Deterministic Rule Breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11.5 }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Matched Rule:</span>
                      <p style={{ margin: '2px 0 6px', fontWeight: 700, color: 'var(--nw-text-primary)' }}>{pythonRule.matched_rule_id || 'DEL-POL-04: General Policy Verification'}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Refund Eligibility:</span>
                      <p style={{ margin: '2px 0', fontWeight: 700, color: pythonRule.refund_eligible ? '#059669' : '#DC2626' }}>
                        {pythonRule.refund_eligible ? '✓ Refund Permitted' : '✗ Strictly Non-Refundable'}
                      </p>
                    </div>

                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Policy Reference:</span>
                      <p style={{ margin: '2px 0 6px', color: 'var(--nw-text-secondary)' }}>{pythonRule.policy_reference || 'Resolution Standard Operating Procedure v1.0'}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Escalation Required:</span>
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
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--nw-text-secondary)', textTransform: 'uppercase' }}>Ticket Assignment & Revocation Audit History</span>
                  </div>

                  {revokedAgents.length > 0 && (
                    <div style={{ background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.3)', padding: '10px 14px', borderRadius: 8, marginBottom: 10 }}>
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
                      <p style={{ fontSize: 11.5, color: 'var(--nw-text-muted)', fontStyle: 'italic' }}>No reassignment or claiming events logged yet.</p>
                    ) : (
                      history.slice().reverse().map((h, i) => (
                        <div key={i} style={{ padding: '6px 10px', borderRadius: 6, background: h.action === 'REVOKED_AND_REASSIGNED' ? 'var(--nw-danger-dim)' : 'var(--nw-elevated)', border: '1px solid var(--nw-border)', fontSize: 11 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, color: h.action === 'REVOKED_AND_REASSIGNED' ? '#E8758A' : 'var(--nw-accent)' }}>
                              {h.action === 'REVOKED_AND_REASSIGNED' ? '⛔ ACCESS REVOKED & REASSIGNED' : h.action}
                            </span>
                            <span style={{ color: 'var(--nw-text-muted)', fontSize: 10 }}>{h.timestamp ? h.timestamp.slice(0, 16) : ''}</span>
                          </div>
                          <p style={{ margin: '2px 0 0', color: 'var(--nw-text-secondary)' }}>
                            {h.previous_agent_name && (
                              <span>From <strong>{h.previous_agent_name}</strong> ➔ </span>
                            )}
                            Assigned to: <strong>{h.agent_name || h.agent_id}</strong>
                            {h.reassigned_by_name && ` by ${h.reassigned_by_name}`}
                          </p>
                          {h.reason && (
                            <p style={{ margin: '2px 0 0', color: '#E8758A', fontStyle: 'italic' }}>Reason: {h.reason}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div style={{ ...glass, padding: 40, textAlign: 'center', color: 'var(--nw-text-muted)' }}>
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
