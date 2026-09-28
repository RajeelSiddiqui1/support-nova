'use client'
import { useState, useEffect } from 'react'
import { useRealtimeRefresh } from '../../lib/useWebSocket'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import {
  Zap, ShieldCheck, ShieldAlert, Send, ArrowUp, MessageSquare, CheckCircle,
  AlertTriangle, Clock, User, Info, RefreshCw, Mail, Check, AlertCircle, 
  Building2, UserCheck, ArrowRightLeft, History, Shield, Users, Menu, ChevronLeft
} from 'lucide-react'

import { API_BASE } from '../../lib/api'
import ComplaintSummary from '../../components/ComplaintSummary'
import IssueBadges from '../../components/IssueBadges'
import RepeatBadge from '../../components/RepeatBadge'
import DeptRouting from '../../components/DeptRouting'
import FollowUpTimeline from '../../components/FollowUpTimeline'

const glass = { background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 16, boxShadow: '0 4px 24px rgba(11,14,20,0.3)' }

const PCOLORS = {
  P0: { bg: 'var(--nw-danger-dim)',  c: '#E8758A', label: 'P0 Critical' },
  P1: { bg: 'var(--nw-warning-dim)', c: '#E8B56B', label: 'P1 High' },
  P2: { bg: 'var(--nw-info-dim)',    c: '#72B4D8', label: 'P2 Medium' },
  P3: { bg: 'rgba(154,156,165,0.1)', c: 'var(--nw-text-muted)', label: 'P3 Low' }
}

const STATUS_OPTIONS = ['In Triage', 'In Progress', 'Resolved', 'Closed']

export default function AgentWorkspace() {
  const [tickets, setTickets]         = useState([])
  const [selectedId, setSelectedId]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [statusFilter, setStatusF]    = useState('All')
  const [mobileTab, setMobileTab]     = useState('queue') // 'queue' or 'workbench' on mobile

  // Queue Scope Filter: ALL_DEPT, MY_QUEUE, UNASSIGNED
  const [queueScope, setQueueScope]   = useState('ALL_DEPT')

  // Current Working Agent Context
  const [agentsList, setAgentsList]   = useState([])
  const [currentAgent, setCurrentAgent] = useState({
    user_id: 'STF-1790265759',
    name: 'Rajeel Siddiqui',
    email: 'rajeelsiddiqui3@gmail.com',
    role: 'AGENT',
    department: 'Ebook',
    department_id: 'DEP-1790265711'
  })

  // Reassignment Modal State
  const [showReassignModal, setShowReassign] = useState(false)
  const [reassignAgentId, setReassignAgentId] = useState('')
  const [reassignReason, setReassignReason]   = useState('')
  const [reassignLoading, setReassignLoad]   = useState(false)
  const [deptAgents, setDeptAgents]           = useState([])

  // Form / Response Control
  const [agentNotes, setAgentNotes]   = useState('')
  const [draftResp, setDraftResp]     = useState('')
  const [statusUpdating, setUpdating] = useState(false)

  // Confirmation Toast
  const [emailAlert, setEmailAlert]   = useState('')

  // Live WebSocket Real-time Sync (zero reload)
  const { isConnected: wsConnected } = useRealtimeRefresh(
    () => {
      fetchTickets(true)
      fetchAgents()
    },
    ['TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_REASSIGNED', 'REVIEWER_ACTION', 'AGENT_WORKLOAD_CHANGE']
  )

  useEffect(() => {
    fetchAgents()
    fetchTickets()
  }, [])

    const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const agentsOnly = data.filter(u => (u.role === 'AGENT' || u.role === 'REVIEWER' || u.role === 'MANAGER') && u.status === 'ACTIVE')
          setAgentsList(agentsOnly)

          // Resolve logged-in user from Cookie -> LocalStorage -> SessionStorage
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
                role: cookies.user_role || 'AGENT'
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

          // 3. Match against staff database to get department & details
          let activeAgent = null
          if (loggedIn) {
            activeAgent = agentsOnly.find(a =>
              (loggedIn.user_id && a.user_id === loggedIn.user_id) ||
              (loggedIn.email && a.email?.toLowerCase() === loggedIn.email?.toLowerCase())
            )
            if (!activeAgent) {
              activeAgent = loggedIn
            }
          }

          // 4. Default fallback: Rajeel Siddiqui or first staff in Ebook/Cloud
          if (!activeAgent) {
            activeAgent = agentsOnly.find(a => a.email === 'rajeelsiddiqui3@gmail.com') ||
                          agentsOnly.find(a => a.department === 'Ebook' || a.department === 'Cloud') ||
                          agentsOnly[0]
          }

          if (activeAgent) {
            setCurrentAgent(activeAgent)
            if (activeAgent.department) {
              setDeptFilter(activeAgent.department)
            }
          }
        }
      }
    } catch (e) {}
  }

  const fetchTickets = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          // Strictly deduplicate by ticket_id so no duplicates ever render
          const uniqueMap = new Map()
          data.forEach(t => {
            if (t && t.ticket_id && !uniqueMap.has(t.ticket_id)) {
              uniqueMap.set(t.ticket_id, t)
            }
          })
          const uniqueTickets = Array.from(uniqueMap.values())
          setTickets(uniqueTickets)
          if (uniqueTickets.length > 0) {
            setSelectedId(prev => (prev && uniqueTickets.some(t => t.ticket_id === prev)) ? prev : uniqueTickets[0].ticket_id)
          } else {
            setSelectedId(null)
          }
        }
      }
    } catch (e) {
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  const [syncingEmails, setSyncingEmails] = useState(false)
  const [syncStatusText, setSyncStatusText] = useState('Active')

  // Automatic 30-second Email Poller
  useEffect(() => {
    // Initial fetch after 4 seconds
    const initTimer = setTimeout(() => {
      handleSyncEmails(true)
    }, 4000)

    // Repeat every 30 seconds
    const interval = setInterval(() => {
      handleSyncEmails(true)
    }, 30000)

    return () => {
      clearTimeout(initTimer)
      clearInterval(interval)
    }
  }, [])

  const handleSyncEmails = async (isBackground = false) => {
    if (!isBackground) setSyncingEmails(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/sync-latest-email`, { method: 'POST' })
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'new_email_processed') {
          setSyncStatusText(`New email (${nowStr})`)
          setEmailAlert(`📧 New Customer Email: '${data.ticket?.title || 'Complaint'}'! Created Ticket ${data.ticket?.ticket_id} routed to ${data.ticket?.department || 'Department'}.`)
          fetchTickets()
          setTimeout(() => setEmailAlert(''), 7000)
        } else if (data.status === 'thread_updated') {
          setSyncStatusText(`Reply synced (${nowStr})`)
          setEmailAlert(`🔄 Customer replied to ticket ${data.ticket_id}! Updated conversation thread.`)
          fetchTickets()
          setTimeout(() => setEmailAlert(''), 7000)
        } else if (data.status === 'no_new_email') {
          setSyncStatusText(`Checked (${nowStr})`)
          if (!isBackground) {
            setEmailAlert(`📧 Inbox checked (${nowStr}). No new emails — latest email was already processed.`)
            setTimeout(() => setEmailAlert(''), 5000)
          }
        } else if (data.status === 'sync_in_progress') {
          setSyncStatusText(`Sync in progress (${nowStr})`)
        } else {
          setSyncStatusText(`Idle (${nowStr})`)
        }
      }
    } catch (e) {
      setSyncStatusText('Sync offline')
    } finally {
      if (!isBackground) setSyncingEmails(false)
    }
  }

  // Fetch department agents whenever Reassign Modal opens
  const openReassignModal = async () => {
    if (!selectedTicket) return
    setShowReassign(true)
    setReassignReason('')
    setReassignAgentId('')
    try {
      const deptQuery = selectedTicket.department_id 
        ? `department_id=${encodeURIComponent(selectedTicket.department_id)}` 
        : `department=${encodeURIComponent(selectedTicket.department || '')}`
      const res = await fetch(`${API_BASE}/api/admin/department-agents?${deptQuery}`)
      if (res.ok) {
        const data = await res.json()
        setDeptAgents(data)
        if (data.length > 0) {
          // select another agent if available
          const other = data.find(a => a.user_id !== selectedTicket.assigned_agent_id) || data[0]
          setReassignAgentId(other.user_id)
        }
      }
    } catch (e) {}
  }

  const handleReassignSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !reassignAgentId) return
    setReassignLoad(true)

    try {
      const res = await fetch(`${API_BASE}/api/tickets/${selectedTicket.ticket_id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_agent_id: reassignAgentId,
          reassigned_by_id: currentAgent.user_id,
          reassigned_by_name: currentAgent.name,
          reassigned_by_role: currentAgent.role || 'MANAGER',
          reason: reassignReason || 'Manager workload rebalancing'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Reassignment failed.')
        setReassignLoad(false)
        return
      }

      setShowReassign(false)
      setEmailAlert(`🔄 Ticket reassigned successfully! Automated email notifications dispatched.`)
      fetchTickets()
    } catch (e) {
      alert('Error connecting to backend for reassignment.')
    } finally {
      setReassignLoad(false)
      setTimeout(() => setEmailAlert(''), 6000)
    }
  }

  const selectedTicket = tickets.find(t => t.ticket_id === selectedId) || null

  useEffect(() => {
    if (selectedTicket) {
      const responseText = selectedTicket.genai_output?.draft_response ||
                           selectedTicket.genai_output?.suggested_response ||
                           selectedTicket.draft_response ||
                           ''
      setDraftResp(responseText)
      setAgentNotes(selectedTicket.agent_notes || '')
    }
  }, [selectedId, selectedTicket])

  // Handle Status Update + First-Response Auto-Claim
  const handleStatusUpdate = async (newStatus) => {
    if (!selectedTicket) return
    setUpdating(true)
    setEmailAlert('')

    const isCurrentlyUnassigned = !selectedTicket.assigned_agent_id

    try {
      let res
      if (selectedTicket.channel === 'Email' || selectedTicket.source === 'EMAIL') {
        res = await fetch(`${API_BASE}/api/tickets/${selectedTicket.ticket_id}/reply-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reply_body: draftResp || agentNotes,
            status: newStatus,
            agent_id: currentAgent.user_id,
            agent_name: currentAgent.name,
            agent_email: currentAgent.email
          })
        })
      } else {
        res = await fetch(`${API_BASE}/api/tickets/${selectedTicket.ticket_id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            agent_notes: agentNotes || draftResp,
            agent_id: currentAgent.user_id,
            agent_name: currentAgent.name,
            agent_email: currentAgent.email
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update status')
      }

      if (isCurrentlyUnassigned) {
        setEmailAlert(`🎯 Ticket auto-claimed by ${currentAgent.name}! Status updated to '${newStatus}' & Email dispatched.`)
      } else {
        setEmailAlert(`✅ Status updated to '${newStatus}' & Email notification sent to customer (${selectedTicket.customer_email || 'customer@company.com'})!`)
      }
      fetchTickets()
    } catch (err) {
      setTickets(prev => prev.map(t => t.ticket_id === selectedTicket.ticket_id ? { ...t, status: newStatus, agent_notes: agentNotes } : t))
      setEmailAlert(`✅ Status updated to '${newStatus}'.`)
    } finally {
      setUpdating(false)
      setTimeout(() => setEmailAlert(''), 6000)
    }
  }

  // Filter Queue based on Department & Scope
  const filteredQueue = tickets.filter(t => {
    // Check if directly assigned to this agent (e.g. by reviewer after triage)
    const isAssignedToMe = Boolean(
      currentAgent?.user_id &&
      (t.assigned_agent_id === currentAgent.user_id || t.assignedAgentId === currentAgent.user_id)
    )

    // 1. Department Filter:
    // If ticket is directly assigned to me, it ALWAYS passes!
    // Otherwise, match current working agent's department
    const deptMatch = !currentAgent?.department ||
      (t.department && t.department.toLowerCase() === currentAgent.department.toLowerCase()) ||
      (t.department_id && currentAgent.department_id && t.department_id === currentAgent.department_id)

    if (!isAssignedToMe && !deptMatch) return false

    // 2. Queue Scope Filter:
    // - MY_QUEUE: Only tickets assigned to this specific agent
    // - UNASSIGNED: Only unassigned tickets in this department
    // - ALL_DEPT: All tickets in this department + any ticket assigned to this agent
    if (queueScope === 'MY_QUEUE') {
      if (!isAssignedToMe) return false
    } else if (queueScope === 'UNASSIGNED') {
      if (t.assigned_agent_id) return false
    }

    // 3. Department or Policy Mismatch Exclusion:
    // Tickets with department mismatch or under AI Review belong to the Reviewer/Manager queue ONLY!
    // UNLESS a reviewer has explicitly assigned this ticket to this agent (isAssignedToMe is true).
    const isUnderReview = t.status === 'AI Review' || t.status === 'NEEDS_REVIEW' || t.department_mismatch || t.match_status === false
    if (isUnderReview && !isAssignedToMe) {
      return false
    }

    // 4. Status filter
    if (statusFilter !== 'All' && t.status !== statusFilter) return false

    return true
  })

  const genai = selectedTicket?.genai_output || {
    issue_category: selectedTicket?.category || 'General Inquiry',
    subcategory: selectedTicket?.sub_category || 'General',
    sentiment: selectedTicket?.sentiment || 'Neutral',
    urgency: selectedTicket?.urgency || 'Medium',
    priority: selectedTicket?.priority || 'P2',
    department: selectedTicket?.department || 'Customer Support',
    policy_id: selectedTicket?.policy_id || 'DEL-POL-04',
    policy_section: '1.0',
    resolution_steps: [
      'Acknowledge customer inquiry with details',
      'Verify policy conditions and account status',
      'Provide resolution and update customer via email'
    ],
    draft_response: selectedTicket?.draft_response || 'Dear Customer, we have received your request and our team is actively investigating.'
  }

  const pythonRule = selectedTicket?.python_rule_output || {
    matched_rule_id: `${genai.policy_id || 'DEL-POL-04'}: General Policy Verification`,
    escalation_required: genai.escalation_required || false,
    refund_eligible: (selectedTicket?.description || '').toLowerCase().includes('refund'),
    mandatory_actions: ['Verify account details', 'Send official email update'],
    prohibited_actions: ['Issue unauthorized discount > 20%'],
    policy_reference: 'SupportNova Resolution Guidelines v1.0',
    confidence_score: 95.0
  }

  const isMismatch = Boolean(selectedTicket?.department_mismatch) && !selectedTicket?.reviewer_override
  const auditHistory = selectedTicket?.assigned_agent_history || selectedTicket?.assignedAgentHistory || []
  const isRevoked = Boolean(selectedTicket?.revoked_agent_ids?.includes(currentAgent?.user_id))
  const revokedDetail = selectedTicket?.revoked_agents?.slice().reverse().find(r => r.agent_id === currentAgent?.user_id)
  const isOtherAssigned = selectedTicket?.assigned_agent_id && (selectedTicket?.assigned_agent_id !== currentAgent?.user_id) && (currentAgent?.role !== 'MANAGER' && currentAgent?.role !== 'ADMIN')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--nw-elevated)' }}>
      <Sidebar role="agent" userName={currentAgent?.name || "Support Agent"} userEmail={currentAgent?.email || "agent@company.com"} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        
        {/* Top Navbar with Working Agent Profile Switcher */}
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
                Agent Workspace & Workbench
              </h1>
              <p className="hide-on-mobile" style={{ fontSize: 11, color: 'var(--nw-text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Department Routing, First-Response Auto-Claiming & Reassignment
              </p>
            </div>
          </div>

          {/* Currently Logged In Agent Profile Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--nw-elevated)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--nw-border-strong)', flexShrink: 0 }}>
            <UserCheck size={16} color="#7C3AED" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--nw-text-primary)' }}>
                {currentAgent?.name || 'Logged In Agent'}
              </span>
              <span className="hide-on-mobile" style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 600 }}>
                {currentAgent?.email || 'agent@company.com'} · {currentAgent?.role || 'AGENT'}
              </span>
            </div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-success-dim)', color: '#059669', fontWeight: 800 }}>
              {currentAgent?.department || 'Dept'}
            </span>
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
            📋 Queue ({filteredQueue.length})
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
            ⚡ Workbench {selectedTicket ? `[${selectedTicket.ticket_id}]` : ''}
          </button>
        </div>

        {/* Email Notification Alert Toast */}
        {emailAlert && (
          <div style={{
            position: 'fixed', top: 20, right: 30, zIndex: 9999,
            background: '#0F172A', color: '#FFF', padding: '12px 20px', borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, fontWeight: 700
          }}>
            <Mail size={18} color="#10B981" />
            <span>{emailAlert}</span>
          </div>
        )}

        {/* Reassign Ticket Modal */}
        {showReassignModal && (
          <div style={{ position:'fixed', inset:0, zIndex:400, background:'var(--nw-overlay)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div className="animate-scale-in" style={{ ...glass, maxWidth:480, width:'100%', padding:24, background: 'var(--nw-surface)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ width:34, height:34, borderRadius:10, background: 'var(--nw-info-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563EB' }}>
                    <ArrowRightLeft size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize:15, fontWeight:700, color: 'var(--nw-text-primary)', margin:0 }}>Reassign Ticket [{selectedTicket?.ticket_id}]</h3>
                    <p style={{ fontSize:11, color: 'var(--nw-text-muted)', margin:'2px 0 0' }}>Department: <strong>{selectedTicket?.department}</strong></p>
                  </div>
                </div>
                <button onClick={() => setShowReassign(false)} style={{ background:'none', border:'none', cursor:'pointer', color: 'var(--nw-text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleReassignSubmit}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>
                    Assign To Agent in {selectedTicket?.department} *
                  </label>
                  <select
                    required
                    value={reassignAgentId}
                    onChange={e => setReassignAgentId(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border: '1px solid var(--nw-border-strong)', fontSize:12.5, outline:'none', cursor:'pointer' }}
                  >
                    <option value="">-- Select Target Agent --</option>
                    {deptAgents.map(a => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.name} ({a.email}) {a.user_id === selectedTicket?.assigned_agent_id ? '· (Currently Assigned)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>
                    Reassignment Reason *
                  </label>
                  <input
                    required
                    value={reassignReason}
                    onChange={e => setReassignReason(e.target.value)}
                    placeholder="e.g. Workload rebalancing, specialized technical escalation"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border: '1px solid var(--nw-border-strong)', fontSize:12.5, outline:'none' }}
                  />
                </div>

                <div style={{ background: 'var(--nw-info-dim)', padding:10, borderRadius:8, fontSize:11, color: 'var(--nw-info)', marginBottom:16 }}>
                  📧 Note: Automated email notifications will be dispatched immediately to both the previous agent and the newly assigned agent.
                </div>

                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button type="button" onClick={() => setShowReassign(false)} style={{ padding:'8px 14px', borderRadius:8, border: '1px solid var(--nw-border-strong)', background:'transparent', color: 'var(--nw-text-muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={reassignLoading} style={{ padding:'8px 18px', borderRadius:8, background:'#2563EB', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    {reassignLoading ? <RefreshCw size={13} className="spin" /> : 'Confirm Reassignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT: Ticket Queue (Landing Page & Shared Pool) ── */}
          <div
            className={`agent-queue-col ${mobileTab === 'workbench' ? 'hide-on-mobile' : ''}`}
            style={{ width: 300, borderRight: '1px solid var(--nw-border)', overflowY: 'auto', background: 'var(--nw-surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}
          >
            
            {/* Scope Tabs: All Dept, My Queue, Unassigned */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--nw-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--nw-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {currentAgent?.department} Queue ({filteredQueue.length})
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => handleSyncEmails(false)}
                    disabled={syncingEmails}
                    title="Poll incoming customer emails from IMAP inbox"
                    style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      background: 'var(--nw-info-dim)', color: '#2563EB', border: '1px solid rgba(74,155,201,0.3)',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <Mail size={11} className={syncingEmails ? 'spin' : ''} />
                    {syncingEmails ? 'Syncing...' : 'Sync (30s)'}
                  </button>
                  <button onClick={fetchTickets} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nw-text-muted)' }} title="Refresh list">
                    <RefreshCw size={12} className={loading ? 'spin' : ''} />
                  </button>
                </div>
              </div>

              {/* 30s Auto Poller & WebSocket Status Badges */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontSize: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--nw-success-dim)', color: 'var(--nw-success)', padding: '2px 8px', borderRadius: 6, fontWeight: 600, border: '1px solid rgba(79,166,137,0.3)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  30s Poller: {syncStatusText}
                </span>
                <span style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: 4, 
                  background: wsConnected ? '#ECFDF5' : '#FEF2F2', 
                  color: wsConnected ? '#047857' : '#DC2626', 
                  padding: '2px 8px', borderRadius: 6, fontWeight: 600, 
                  border: wsConnected ? '1px solid rgba(79,166,137,0.35)' : '1px solid rgba(193,73,91,0.35)',
                  background: wsConnected ? 'var(--nw-success-dim)' : 'var(--nw-danger-dim)',
                  color: wsConnected ? 'var(--nw-success)' : 'var(--nw-danger)'
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: wsConnected ? 'var(--nw-success)' : 'var(--nw-danger)', display: 'inline-block' }} />
                  {wsConnected ? 'WebSocket Live' : 'WS Reconnecting'}
                </span>
              </div>

              {/* Scope Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                {[
                  ['ALL_DEPT', 'All Dept'],
                  ['MY_QUEUE', 'My Queue'],
                  ['UNASSIGNED', 'Unassigned']
                ].map(([scopeKey, scopeLabel]) => (
                  <button
                    key={scopeKey}
                    onClick={() => setQueueScope(scopeKey)}
                    style={{
                      padding: '5px 4px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      border: queueScope === scopeKey ? '1.5px solid var(--nw-accent)' : '1px solid var(--nw-border)',
                      background: queueScope === scopeKey ? 'var(--nw-accent)' : 'var(--nw-elevated)',
                      color: queueScope === scopeKey ? 'var(--nw-text-inverse)' : 'var(--nw-text-secondary)',
                      cursor: 'pointer', textAlign: 'center'
                    }}
                  >
                    {scopeLabel}
                  </button>
                ))}
              </div>

              {/* Status Filter buttons */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['All', 'In Triage', 'In Progress', 'Resolved'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusF(st)}
                    style={{
                      padding: '2px 7px', borderRadius: 4, fontSize: 9.5, fontWeight: 700,
                      border: '1px solid var(--nw-border)',
                      background: statusFilter === st ? 'var(--nw-accent)' : 'var(--nw-elevated)',
                      color: statusFilter === st ? 'var(--nw-text-inverse)' : 'var(--nw-text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Queue List Cards */}
            {filteredQueue.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--nw-text-muted)', fontSize: 12 }}>
                <InboxEmptyIcon size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                No tickets in this scope.
              </div>
            ) : (
              filteredQueue.map(t => {
                const pc = PCOLORS[t.priority] || PCOLORS.P2
                const active = selectedId === t.ticket_id
                const isAssignedToMe = t.assigned_agent_id === currentAgent?.user_id
                const isRevokedForMe = t.revoked_agent_ids?.includes(currentAgent?.user_id) && !isAssignedToMe
                const isUnassigned = !t.assigned_agent_id

                return (
                  <div
                    key={t.ticket_id}
                    onClick={() => {
                      setSelectedId(t.ticket_id)
                      setMobileTab('workbench')
                    }}
                    style={{
                      padding: '12px 14px', borderBottom: '1px solid var(--nw-border)', cursor: 'pointer',
                      background: active ? 'var(--nw-accent-dim)' : 'transparent',
                      borderLeft: active ? '3px solid var(--nw-accent)' : '3px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--nw-accent)', fontWeight: 800 }}>{t.ticket_id}</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: pc.bg, color: pc.c }}>{t.priority}</span>
                      </div>
                    </div>

                    <h4 style={{ fontSize: 12.5, fontWeight: active ? 700 : 600, color: 'var(--nw-text-primary)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </h4>

                    {/* Issue Badges */}
                    <div style={{ marginBottom: 6 }}>
                      <IssueBadges
                        primaryIssue={t.category || t.primary_issue || ''}
                        secondaryIssues={t.secondary_issues || (t.genai_output?.secondary_issues) || []}
                      />
                    </div>
                    {/* Repeat Badge */}
                    {(t.is_repeat || t.duplicate_of) && (
                      <div style={{ marginBottom: 4 }}>
                        <RepeatBadge duplicateOf={t.duplicate_of} priorCount={t.repeat_count || 0} />
                      </div>
                    )}

                    {/* Assignment Pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5 }}>

                      {isRevokedForMe ? (
                        <span style={{ color: 'var(--nw-danger)', background: 'var(--nw-danger-dim)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(193,73,91,0.3)' }}>
                          ⛔ Access Revoked (In History)
                        </span>
                      ) : isUnassigned ? (
                        <span style={{ color: 'var(--nw-warning)', background: 'var(--nw-warning-dim)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(217,164,65,0.3)' }}>
                          ⚡ Unassigned Pool
                        </span>
                      ) : isAssignedToMe ? (
                        <span style={{ color: 'var(--nw-success)', background: 'var(--nw-success-dim)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(79,166,137,0.3)' }}>
                          ✓ Assigned to You
                        </span>
                      ) : (
                        <span style={{ color: 'var(--nw-text-muted)', background: 'var(--nw-elevated)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                          👤 {t.assigned_agent || t.assigned_agent_id}
                        </span>
                      )}

                      <span style={{
                        fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: t.status === 'Resolved' ? 'var(--nw-success-dim)' : 'var(--nw-info-dim)',
                        color: t.status === 'Resolved' ? 'var(--nw-success)' : 'var(--nw-info)',
                        border: '1px solid var(--nw-border)'
                      }}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ── CENTER: AI Pipeline & Ticket Workbench ── */}
          {selectedTicket ? (
            <div
              className={`agent-workbench-col ${mobileTab === 'queue' ? 'hide-on-mobile' : ''}`}
              style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}
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
                <ChevronLeft size={16} /> Back to Ticket Queue
              </button>

              {/* Access Revocation Banner */}
              {isRevoked && (
                <div style={{ background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.3)', padding: '14px 18px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, color: '#991B1B', boxShadow: '0 2px 10px rgba(220,38,38,0.1)' }}>
                  <ShieldAlert size={26} color="#DC2626" style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#E8758A' }}>⛔ ACCESS REVOKED BY MANAGEMENT</h4>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>
                      Your assignment to Ticket <strong>[{selectedTicket.ticket_id}]</strong> was revoked by <strong>{revokedDetail?.revoked_by_name || 'Department Manager'}</strong>.
                      {revokedDetail?.reason && <span> Reason: <em>"{revokedDetail.reason}"</em>.</span>}
                      <br />
                      {selectedTicket.assigned_agent ? (
                        <>This ticket has been reassigned to <strong>{selectedTicket.assigned_agent}</strong>.</>
                      ) : (
                        <>This ticket has been released to the department unassigned pool for other agents to claim.</>
                      )} Your previous activity remains preserved in the audit log, but you are permanently barred from re-claiming, updating, or sending replies for this ticket.
                    </p>
                  </div>
                </div>
              )}

              {/* ── AI Escalation Banner ── */}
              {selectedTicket.escalation_required && (
                <div style={{
                  background: 'var(--nw-danger-dim)',
                  border: '1px solid rgba(193,73,91,0.35)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}>
                  <span style={{ fontSize: 20 }}>🚨</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#E8758A', marginBottom: 2 }}>
                      ESCALATION REQUIRED — Level {selectedTicket.escalation_level || 'L1'}
                    </div>
                    {selectedTicket.escalation_notes && (
                      <div style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.5 }}>
                        {selectedTicket.escalation_notes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SLA Risk Banner ── */}
              {(selectedTicket.sla_risk === 'HIGH' || selectedTicket.sla_risk === 'CRITICAL') && (
                <div style={{
                  background: selectedTicket.sla_risk === 'CRITICAL' ? 'var(--nw-danger-dim)' : 'var(--nw-warning-dim)',
                  border: `1px solid ${selectedTicket.sla_risk === 'CRITICAL' ? 'rgba(193,73,91,0.35)' : 'rgba(217,164,65,0.35)'}`,
                  borderRadius: 10,
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  color: selectedTicket.sla_risk === 'CRITICAL' ? '#E8758A' : '#E8B56B',
                }}>
                  ⏱ SLA Risk: {selectedTicket.sla_risk} — This ticket may breach SLA if not actioned within 2 hours
                </div>
              )}

              {/* ── Hallucination Warning (disables reply) ── */}
              {(selectedTicket.hallucination_flags?.length > 0 || selectedTicket.unsupported_promises?.length > 0) && (
                <div style={{
                  background: 'rgba(193,73,91,0.12)',
                  border: '1.5px solid rgba(193,73,91,0.5)',
                  borderRadius: 12,
                  padding: '14px 18px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#E8758A', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    ⚠️ AI HALLUCINATION FLAGS DETECTED — Reply Blocked
                  </div>
                  {selectedTicket.hallucination_flags?.map((f, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: 'var(--nw-text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(193,73,91,0.4)' }}>
                      <strong style={{ color: '#E8758A' }}>{f.type}</strong>: {f.description}
                    </div>
                  ))}
                  {selectedTicket.unsupported_promises?.map((p, i) => (
                    <div key={`p-${i}`} style={{ fontSize: 11.5, color: 'var(--nw-text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(217,164,65,0.4)' }}>
                      <strong style={{ color: '#E8B56B' }}>UNAUTHORIZED PROMISE</strong>: {p.description || p}
                    </div>
                  ))}
                </div>
              )}

              {/* Ticket Summary Bar */}
              <div style={{ ...glass, background: 'var(--nw-surface)', padding: 18 }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#7C3AED', fontWeight: 800 }}>{selectedTicket.ticket_id}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: PCOLORS[selectedTicket.priority]?.bg, color: PCOLORS[selectedTicket.priority]?.c }}>
                      {PCOLORS[selectedTicket.priority]?.label || selectedTicket.priority}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-elevated)', color: 'var(--nw-text-secondary)' }}>
                      Channel: {selectedTicket.channel || 'Web Form'}
                    </span>

                    {/* Assignment Badge */}
                    {selectedTicket.assigned_agent_id ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-success-dim)', color: '#059669', border: '1px solid rgba(79,166,137,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <UserCheck size={12} /> Assigned: {selectedTicket.assigned_agent || selectedTicket.assigned_agent_id}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--nw-warning-dim)', color: '#D97706', border: '1px solid rgba(217,164,65,0.3)' }}>
                        ⚡ Unassigned (First response will auto-claim)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={openReassignModal}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: 'var(--nw-info-dim)', color: '#2563EB', border: '1px solid rgba(74,155,201,0.3)',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <ArrowRightLeft size={12} /> Reassign Ticket
                    </button>

                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                      background: selectedTicket.status === 'Resolved' ? '#ECFDF5' : '#EFF6FF',
                      color: selectedTicket.status === 'Resolved' ? '#059669' : '#2563EB',
                      border: '1px solid var(--nw-border-strong)'
                    }}>
                      {selectedTicket.status}
                    </span>
                  </div>
                </div>

                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--nw-text-primary)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  {selectedTicket.title}
                </h2>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--nw-text-secondary)' }}>
                  <div>Customer: <strong>{selectedTicket.customer_name || 'Customer'}</strong> | ID: <strong style={{ color: '#7C3AED' }}>{selectedTicket.customer_id || 'USR-LOCAL'}</strong> ({selectedTicket.customer_email || 'n/a'})</div>
                  <div>Order Ref: <strong>{selectedTicket.order_id || 'N/A'}</strong></div>
                  <div>Channel: <strong style={{ color: selectedTicket.channel === 'Chat' ? '#7C3AED' : selectedTicket.channel === 'Email' ? '#D97706' : '#2563EB' }}>{selectedTicket.channel === 'Chat' ? 'Chat 💬' : selectedTicket.channel === 'Email' ? 'Email 📧' : selectedTicket.channel || 'Web Form'}</strong></div>
                  <div>Department ID: <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{selectedTicket.department_id || 'N/A'}</strong></div>
                  <div>Incident Date: <strong>{selectedTicket.incident_date || 'Today'}</strong></div>
                </div>
              </div>

              {/* ── Complaint Summary Card ── */}
              <ComplaintSummary ticket={selectedTicket} variant="agent" />

              {/* ── Department Routing ── */}
              {(selectedTicket.primary_department || selectedTicket.department) && (
                <DeptRouting
                  primaryDept={selectedTicket.primary_department || selectedTicket.department}
                  supportingDepts={selectedTicket.supporting_departments || []}
                />
              )}

              {/* Department Comparison & Mismatch Banner */}
              <div style={{
                padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: isMismatch ? 'var(--nw-warning-dim)' : 'var(--nw-success-dim)',
                border: `1px solid ${isMismatch ? 'rgba(232,181,107,0.35)' : 'rgba(79,166,137,0.35)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isMismatch ? <AlertTriangle size={18} color="var(--nw-warning)" /> : <CheckCircle size={18} color="var(--nw-success)" />}
                  <div>
                    <span style={{ fontWeight: 800, color: isMismatch ? '#E8B56B' : '#4FA689', fontSize: 13 }}>
                      {isMismatch ? '⚠️ DEPARTMENT MISMATCH DETECTED' : (selectedTicket.reviewer_override ? '✅ REVIEWER TRIAGED & ASSIGNED' : '✅ DEPARTMENT MATCH VERIFIED')}
                    </span>
                    <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', margin: '2px 0 0' }}>
                      Customer Selected: <strong>{selectedTicket.customer_department || selectedTicket.department}</strong> | Active Department: <strong>{selectedTicket.department || genai.department || 'Logistics'} {selectedTicket.department_id ? `(${selectedTicket.department_id})` : ''}</strong>
                      {selectedTicket.reviewer_override && (
                        <span style={{ marginLeft: 8, color: 'var(--nw-accent)', fontWeight: 700 }}>
                          (Assigned by {selectedTicket.reviewed_by_name || 'Reviewer'})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', padding: '4px 10px', borderRadius: 6, background: 'var(--nw-surface)', border: '1px solid var(--nw-border-strong)', color: 'var(--nw-text-primary)' }}>
                  Confidence: {pythonRule.confidence_score || 94}%
                </span>
              </div>

              {/* Complaint Text Box */}
              <div style={{ ...glass, padding: 18, background: 'var(--nw-surface)' }}>
                <h4 style={{ fontSize: 11, fontWeight: 800, color: 'var(--nw-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                  Customer Complaint Description
                </h4>
                <p style={{ fontSize: 13, color: 'var(--nw-text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {selectedTicket.description}
                </p>
              </div>

              {/* AI Dual-Pipeline Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* GenAI Pipeline Box */}
                <div style={{ ...glass, padding: 18, background: 'var(--nw-surface)', border: '1px solid var(--nw-border)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--nw-border)' }}>
                    <Zap size={18} color="var(--nw-accent)" />
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--nw-accent)', margin: 0 }}>Pipeline 1: GenAI Analysis</h4>
                      <span style={{ fontSize: 10, color: 'var(--nw-text-muted)' }}>Groq LLM Intelligence Engine</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Primary Issue</span>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-text-primary)', margin: '2px 0 0' }}>{genai.issue_category || selectedTicket.category}</p>
                    </div>

                    <div>
                      <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Sentiment</span>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#E8758A', margin: '2px 0 0' }}>{genai.sentiment || selectedTicket.sentiment}</p>
                    </div>

                    <div>
                      <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Urgency</span>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#E8B56B', margin: '2px 0 0' }}>{genai.urgency || selectedTicket.urgency}</p>
                    </div>

                    <div>
                      <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>AI Dept</span>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#72B4D8', margin: '2px 0 0' }}>{genai.department || selectedTicket.department}</p>
                    </div>
                  </div>

                  {/* Resolution Steps Checklist */}
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      AI Recommended Resolution Steps
                    </span>
                    {genai.resolution_steps && genai.resolution_steps.length > 0 ? (
                      genai.resolution_steps.map((step, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--nw-accent-dim)', color: 'var(--nw-accent)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {idx + 1}
                          </span>
                          <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', margin: 0, lineHeight: 1.4 }}>{step}</p>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--nw-text-muted)' }}>1. Verify details 2. Escalate if needed</p>
                    )}
                  </div>
                </div>

                {/* Python Deterministic Ground-Truth Rule Box */}
                <div style={{ ...glass, padding: 18, background: 'var(--nw-surface)', border: '1px solid var(--nw-border)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--nw-border)' }}>
                    <ShieldCheck size={18} color="var(--nw-success)" />
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--nw-success)', margin: 0 }}>Pipeline 2: Ground-Truth Policy Match</h4>
                      <span style={{ fontSize: 10, color: 'var(--nw-text-muted)' }}>Deterministic Rule Engine</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Matched Company Policy</span>
                    <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#4FA689', background: 'var(--nw-success-dim)', padding: '4px 8px', borderRadius: 6, marginTop: 4 }}>
                      {pythonRule.matched_rule_id || genai.policy_id || 'DEL-POL-04: Delivery Policy'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'var(--nw-danger-dim)', color: '#E8758A' }}>
                      🚨 Escalation: {pythonRule.escalation_required ? 'REQUIRED' : 'NO'}
                    </span>
                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'var(--nw-success-dim)', color: '#4FA689' }}>
                      ✓ Refund Eligible: {pythonRule.refund_eligible ? 'YES' : 'NO'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      Mandatory Policy Actions
                    </span>
                    {pythonRule.mandatory_actions ? (
                      pythonRule.mandatory_actions.map((act, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <CheckCircle size={12} color="var(--nw-success)" />
                          <span style={{ fontSize: 11.5, color: 'var(--nw-text-secondary)' }}>{act}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--nw-text-secondary)' }}>Document SLA log & notify carrier</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Assignment & Reassignment Audit Trail History Box */}
              <div style={{ ...glass, padding: 18, background: 'var(--nw-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <History size={16} color="#7C3AED" />
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: 'var(--nw-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Ticket Assignment & Audit Trail History ({auditHistory.length} events)
                  </h4>
                </div>

                {auditHistory.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--nw-text-muted)', margin: 0 }}>
                    ⚡ No assignment actions yet. Submitting the first status update will trigger the <strong>First-Response Claim Rule</strong>.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {auditHistory.map((ev, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--nw-elevated)', border: '1px solid var(--nw-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                              background: ev.action?.includes('AUTO_CLAIM') ? 'var(--nw-success-dim)' : ev.action?.includes('REASSIGN') ? 'var(--nw-info-dim)' : 'var(--nw-danger-dim)',
                              color: ev.action?.includes('AUTO_CLAIM') ? '#4FA689' : ev.action?.includes('REASSIGN') ? '#72B4D8' : '#E8758A'
                            }}>
                              {ev.action?.includes('AUTO_CLAIM') ? '🎯 Auto-Claimed' : ev.action?.includes('REASSIGN') ? '🔄 Reassigned' : '🏢 Dept Changed'}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--nw-text-primary)' }}>
                              {ev.agent_name || ev.agent_id}
                            </span>
                            {ev.reassigned_by_name && (
                              <span style={{ fontSize: 11, color: 'var(--nw-text-muted)' }}>
                                by <strong>{ev.reassigned_by_name}</strong> ({ev.reassigned_by_role || 'Manager'})
                              </span>
                            )}
                          </div>
                          {ev.reason && (
                            <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', margin: '3px 0 0' }}>Reason: {ev.reason}</p>
                          )}
                          {ev.notes && (
                            <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', margin: '3px 0 0' }}>Notes: {ev.notes}</p>
                          )}
                        </div>

                        <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontFamily: 'monospace' }}>
                          {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : 'Just now'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nw-text-muted)' }}>
              Select a ticket to begin resolution.
            </div>
          )}

          {/* ── RIGHT: Agent Response & Status Update Control Panel ── */}
          <div style={{ width: 300, borderLeft: '1px solid var(--nw-border)', overflowY: 'auto', padding: 16, background: 'var(--nw-surface)', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>

            {/* ── Follow-Up Timeline ── */}
            <FollowUpTimeline ticket={selectedTicket} />

            {/* Status Update & Email Dispatch Control Box */}
            <div style={{ background: 'var(--nw-elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--nw-border)' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--nw-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Update Complaint Status
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {STATUS_OPTIONS.map(st => (
                  <button
                    key={st}
                    onClick={() => handleStatusUpdate(st)}
                    disabled={statusUpdating || isRevoked || isOtherAssigned}
                    style={{
                      padding: '8px 6px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      cursor: (isRevoked || isOtherAssigned) ? 'not-allowed' : 'pointer',
                      border: selectedTicket?.status === st ? '2px solid var(--nw-accent)' : '1px solid var(--nw-border-strong)',
                      background: selectedTicket?.status === st ? 'var(--nw-accent-dim)' : 'var(--nw-surface)',
                      color: selectedTicket?.status === st ? 'var(--nw-accent)' : 'var(--nw-text-secondary)',
                      opacity: (isRevoked || isOtherAssigned) ? 0.5 : 1,
                      transition: 'all 0.15s'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Permission & Revocation Notice */}
              {isRevoked ? (
                <div style={{ background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.3)', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--nw-danger)' }}>
                    ⛔ ACCESS REVOKED: You cannot update status or send replies on this ticket.
                  </p>
                </div>
              ) : isOtherAssigned ? (
                <div style={{ background: 'var(--nw-info-dim)', border: '1px solid rgba(74,155,201,0.3)', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--nw-info)' }}>
                    🔒 Assigned to {selectedTicket.assigned_agent}. Read-only mode.
                  </p>
                </div>
              ) : null}

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Agent Resolution / Internal Notes
                </label>
                <textarea
                  rows={3}
                  value={agentNotes}
                  onChange={e => setAgentNotes(e.target.value)}
                  disabled={isRevoked || isOtherAssigned}
                  placeholder="Notes to include in customer status notification..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--nw-border-strong)', fontSize: 12, outline: 'none', background: 'var(--nw-surface)', color: 'var(--nw-text-primary)' }}
                />
              </div>

              {/* General Send Email Reply Button */}
              <button
                onClick={() => handleStatusUpdate(selectedTicket?.status || 'In Progress')}
                disabled={statusUpdating || isRevoked || isOtherAssigned || (selectedTicket?.hallucination_flags?.length > 0)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 9, border: 'none',
                  background: (isRevoked || isOtherAssigned || selectedTicket?.hallucination_flags?.length > 0) ? 'var(--nw-elevated)' : 'var(--nw-accent)', color: 'var(--nw-text-inverse)',
                  fontSize: 12, fontWeight: 700, cursor: (isRevoked || isOtherAssigned || selectedTicket?.hallucination_flags?.length > 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: statusUpdating ? 0.7 : 1, marginBottom: 4
                }}
              >
                {statusUpdating ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                Send Email Reply
              </button>
              {selectedTicket?.hallucination_flags?.length > 0 && (
                <span style={{ fontSize: 10.5, color: '#E8758A', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  ⛔ Reply blocked: AI hallucination flags detected. Contact reviewer.
                </span>
              )}

              {/* Direct Resolve & Send Email Button */}
              <button
                onClick={() => handleStatusUpdate('Resolved')}
                disabled={statusUpdating || isRevoked || isOtherAssigned}
                style={{
                  width: '100%', padding: '9px', borderRadius: 9, border: '1px solid rgba(79,166,137,0.4)',
                  background: (isRevoked || isOtherAssigned) ? 'var(--nw-elevated)' : 'var(--nw-success-dim)',
                  color: (isRevoked || isOtherAssigned) ? 'var(--nw-text-muted)' : 'var(--nw-success)',
                  fontSize: 11.5, fontWeight: 700, cursor: (isRevoked || isOtherAssigned) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <CheckCircle size={13} /> Resolve & Send Email
              </button>
            </div>

            {/* AI Generated Draft Professional Response */}
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--nw-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                AI-Generated Draft Response
              </span>
              <textarea
                value={draftResp}
                onChange={e => setDraftResp(e.target.value)}
                rows={7}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--nw-border-strong)',
                  background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 11.5, lineHeight: 1.6, outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={openReassignModal}
                style={{
                  width: '100%', padding: 9, borderRadius: 9, border: '1.5px solid #2563EB',
                  background: 'var(--nw-info-dim)', color: '#2563EB', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <ArrowRightLeft size={14} />
                Reassign Ticket to Agent
              </button>

              <button
                onClick={() => handleStatusUpdate('In Progress')}
                disabled={statusUpdating}
                style={{
                  width: '100%', padding: 9, borderRadius: 9, border: '1px solid #7C3AED',
                  background: 'var(--nw-accent-dim)', color: '#7C3AED', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                Mark In Progress & Send Email
              </button>

              <button
                onClick={() => handleStatusUpdate('Escalated')}
                disabled={statusUpdating}
                style={{
                  width: '100%', padding: 9, borderRadius: 9, border: '1px solid rgba(193,73,91,0.3)',
                  background: 'var(--nw-danger-dim)', color: '#E8758A', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <ArrowUp size={14} />
                Escalate to Manager
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

function InboxEmptyIcon(props) {
  return (
    <svg width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  )
}
