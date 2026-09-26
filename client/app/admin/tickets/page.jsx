'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { 
  Ticket, CheckCircle, AlertTriangle, Clock, Search, Filter, Eye, Zap, 
  ShieldCheck, X, User, Calendar, Building, ChevronRight, MessageSquare, 
  ArrowUpRight, ArrowRightLeft, RefreshCw, History, UserCheck, Shield,
  Users, ExternalLink
} from 'lucide-react'

const glass = (extra = {}) => ({
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.95)',
  borderRadius: 16,
  boxShadow: '0 4px 28px rgba(148,163,184,0.1), 0 1px 4px rgba(148,163,184,0.06)',
  ...extra,
})

const ALL_TICKETS = [
  { id:'CMP-00421', ticket_id:'CMP-00421', title:'Order delayed by 8 days — no update from delivery partner',        customer:'Rajeev Khan',   dept:'Logistics',   cat:'Delivery Issue',  status:'In Triage', p:'P0', date:'Sep 23, 2026', sla:'1h 20m', risk:88, match:true,  agent:'Zara Ahmed'   },
  { id:'CMP-00420', ticket_id:'CMP-00420', title:'Double charge for order ORD-72110 on Sep 21',                      customer:'Sara Hussain',  dept:'Finance',     cat:'Billing Error',   status:'In Triage', p:'P1', date:'Sep 23, 2026', sla:'4h 00m', risk:60, match:true,  agent:'Omar Sheikh'  },
  { id:'CMP-00419', ticket_id:'CMP-00419', title:'Received grey sneakers instead of white — wrong product',           customer:'Ravi Sharma',   dept:'Fulfillment', cat:'Wrong Product',   status:'AI Review',  p:'P2', date:'Sep 22, 2026', sla:'18h',    risk:22, match:false, agent:'Zara Ahmed'   },
]

const PIPELINE_DATA = {
  'CMP-00421': {
    genai: { issue:'Significant Delivery Delay (8 days)', sentiment:'Very Frustrated 😠', priority:'P0', dept:'Logistics', draft:'We sincerely apologize for the unacceptable delay with your order ORD-78234. We are immediately escalating to our logistics team and can offer a full refund or priority re-shipment with a 15% goodwill coupon.' },
    python: { rule:'DEL-POL-04: Delivery Guarantee Breach (>72h)', refund:true, escalation:true, policy:'Customer Delivery Policy v2.1 §4.3', score:94 },
    match: true,
  },
}

const STATUS_COLORS = {
  'In Triage': { bg:'#FFFBEB', c:'#D97706', border:'rgba(217,119,6,0.22)', dot:'#D97706' },
  'In Progress':{ bg:'#EFF6FF', c:'#2563EB', border:'rgba(37,99,235,0.22)', dot:'#2563EB' },
  'AI Review':  { bg:'#F5F3FF', c:'#7C3AED', border:'rgba(124,58,237,0.22)', dot:'#7C3AED' },
  'Resolved':   { bg:'#ECFDF5', c:'#059669', border:'rgba(5,150,105,0.22)',  dot:'#059669' },
  'Escalated':  { bg:'#FFF1F2', c:'#E11D48', border:'rgba(225,29,72,0.22)',  dot:'#E11D48' },
  'Closed':     { bg:'#F8FAFC', c:'#94A3B8', border:'rgba(148,163,184,0.2)', dot:'#CBD5E1' },
}
const P_COLORS = { P0:{bg:'#FFF1F2',c:'#E11D48'}, P1:{bg:'#FFFBEB',c:'#D97706'}, P2:{bg:'#EFF6FF',c:'#2563EB'}, P3:{bg:'#F8FAFC',c:'#64748B'} }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const STATUSES = ['All','In Triage','In Progress','AI Review','Escalated','Resolved','Closed']
const CHANNELS = ['All', 'Web Form', 'Chat', 'Email']

export default function TicketsPage() {
  const [viewMode, setViewMode]   = useState('tickets') // 'tickets' or 'agents'
  const [tickets, setTickets]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusF, setStatusF]     = useState('All')
  const [deptF, setDeptF]         = useState('All')
  const [channelF, setChannelF]   = useState('All')
  const [selTicket, setSel]       = useState(null)
  const [activeTab, setActiveTab] = useState('pipeline')

  // Agents Overview State (Live Agent Oversight)
  const [agentsOverview, setAgentsOverview] = useState({
    total_agents: 0, busy_agents: 0, idle_agents: 0, total_active_tickets: 0, total_resolved_tickets: 0, agents: []
  })
  const [agentsLoading, setAgentsLoading]   = useState(false)
  const [agentSearch, setAgentSearch]       = useState('')
  const [agentDeptFilter, setAgentDeptF]    = useState('All')

  // Lists for Admin Overrides
  const [deptsList, setDeptsList] = useState([])
  const [agentsList, setAgentsList] = useState([])

  // Admin Override Modals
  const [showReassignModal, setShowReassign]   = useState(false)
  const [reassignAgentId, setReassignAgentId]   = useState('')
  const [reassignReason, setReassignReason]     = useState('')
  const [reassignLoading, setReassignLoading]   = useState(false)

  const [showChangeDeptModal, setShowChangeDept] = useState(false)
  const [changeDeptId, setChangeDeptId]         = useState('')
  const [changeDeptReason, setChangeDeptReason] = useState('')
  const [changeDeptLoading, setChangeDeptLoad] = useState(false)

  const [actionAlert, setActionAlert]           = useState('')

  useEffect(() => {
    fetchTickets()
    fetchMetadata()
    fetchAgentsOverview()
  }, [])

  const fetchAgentsOverview = async () => {
    setAgentsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/agents-overview`)
      if (res.ok) {
        const data = await res.json()
        setAgentsOverview(data)
      }
    } catch (e) {
    } finally {
      setAgentsLoading(false)
    }
  }

  const fetchMetadata = async () => {
    try {
      const [dRes, uRes] = await Promise.all([
        fetch(`${API_BASE}/api/departments`),
        fetch(`${API_BASE}/api/admin/users`)
      ])
      if (dRes.ok) {
        const dData = await dRes.json()
        if (Array.isArray(dData)) setDeptsList(dData)
      }
      if (uRes.ok) {
        const uData = await uRes.json()
        if (Array.isArray(uData)) {
          setAgentsList(uData.filter(u => (u.role === 'AGENT' || u.role === 'REVIEWER') && u.status === 'ACTIVE'))
        }
      }
    } catch (e) {}
  }

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setTickets(data)
          if (selTicket) {
            const found = data.find(t => t.ticket_id === selTicket.ticket_id)
            if (found) setSel(found)
          }
        } else {
          setTickets(ALL_TICKETS)
        }
      }
    } catch (e) {
      setTickets(ALL_TICKETS)
    } finally {
      setLoading(false)
    }
  }

  // Admin Reassignment Submission
  const handleAdminReassign = async (e) => {
    e.preventDefault()
    if (!selTicket || !reassignAgentId) return
    setReassignLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/tickets/${selTicket.ticket_id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_agent_id: reassignAgentId,
          reassigned_by_id: 'ADM-001',
          reassigned_by_name: 'Admin Nova',
          reassigned_by_role: 'ADMIN',
          reason: reassignReason || 'Admin workload reassignment'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Reassignment failed')
        setReassignLoading(false)
        return
      }

      setShowReassign(false)
      setActionAlert(`✅ Ticket reassigned by Admin! Automated notification emails sent to previous and new agent.`)
      fetchTickets()
    } catch (err) {
      alert('Error connecting to backend')
    } finally {
      setReassignLoading(false)
      setTimeout(() => setActionAlert(''), 6000)
    }
  }

  // Admin Department Change Submission
  const handleAdminChangeDept = async (e) => {
    e.preventDefault()
    if (!selTicket || !changeDeptId) return
    setChangeDeptLoad(true)

    try {
      const res = await fetch(`${API_BASE}/api/tickets/${selTicket.ticket_id}/change-department`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_department_id: changeDeptId,
          admin_id: 'ADM-001',
          admin_name: 'Admin Nova',
          reason: changeDeptReason || 'Incorrect routing - admin override'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || 'Department change failed')
        setChangeDeptLoad(false)
        return
      }

      setShowChangeDept(false)
      setActionAlert(`🏢 Department updated! Agent assignment cleared & Department Manager notified via email.`)
      fetchTickets()
    } catch (err) {
      alert('Error connecting to backend')
    } finally {
      setChangeDeptLoad(false)
      setTimeout(() => setActionAlert(''), 6000)
    }
  }

  const filtered = tickets.filter(t => {
    const tId = t.ticket_id || t.id || ''
    const tTitle = t.title || ''
    const tCust = t.customer_name || t.customer || ''
    const tEmail = t.customer_email || ''

    const matchS = tId.toLowerCase().includes(search.toLowerCase()) ||
                   tTitle.toLowerCase().includes(search.toLowerCase()) ||
                   tCust.toLowerCase().includes(search.toLowerCase()) ||
                   tEmail.toLowerCase().includes(search.toLowerCase())

    const matchSt = statusF === 'All' || t.status === statusF
    const matchD  = deptF === 'All' || (t.customer_department || t.department || t.dept) === deptF
    const matchCh = channelF === 'All' || (t.channel || 'Web Form') === channelF

    return matchS && matchSt && matchD && matchCh
  })

  const pipeline = selTicket ? (
    selTicket.genai_output || selTicket.python_rule_output ? {
      genai: {
        issue: selTicket.genai_output?.issue_category || selTicket.category || 'General',
        sentiment: selTicket.genai_output?.sentiment || selTicket.sentiment || 'Neutral',
        priority: selTicket.genai_output?.priority || selTicket.priority || 'P2',
        dept: selTicket.genai_output?.department || selTicket.department || 'General',
        draft: selTicket.genai_output?.draft_response || selTicket.genai_output?.suggested_response || selTicket.draft_response || 'No draft'
      },
      python: {
        rule: selTicket.python_rule_output?.matched_rule_id || 'DEL-POL-04: General Verification',
        refund: selTicket.python_rule_output?.refund_eligible || false,
        escalation: selTicket.python_rule_output?.escalation_required || false,
        policy: selTicket.python_rule_output?.policy_reference || 'General Policy v1.0',
        score: selTicket.python_rule_output?.confidence_score || 95
      },
      match: selTicket.match_status ?? !selTicket.department_mismatch
    } : (PIPELINE_DATA[selTicket.ticket_id || selTicket.id] || null)
  ) : null

  const auditHistory = selTicket?.assigned_agent_history || selTicket?.assignedAgentHistory || []

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@company.com" />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar title="All Complaint Tickets" subtitle="Ticket routing, role hierarchy overrides & audit trail history" />

        {/* Action Alert Banner */}
        {actionAlert && (
          <div style={{
            position: 'fixed', top: 20, right: 30, zIndex: 9999,
            background: '#0F172A', color: '#FFF', padding: '12px 20px', borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, fontWeight: 700
          }}>
            <CheckCircle size={18} color="#10B981" />
            <span>{actionAlert}</span>
          </div>
        )}

        {/* Admin Reassign Modal */}
        {showReassignModal && (
          <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div className="animate-scale-in" style={{ ...glass(), maxWidth:480, width:'100%', padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563EB' }}>
                    <ArrowRightLeft size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A', margin:0 }}>Admin Reassign Ticket [{selTicket?.ticket_id}]</h3>
                    <p style={{ fontSize:11, color:'#64748B', margin:'2px 0 0' }}>Assign to any agent across departments (Admin Override)</p>
                  </div>
                </div>
                <button onClick={() => setShowReassign(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAdminReassign}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:5 }}>
                    Select Target Agent *
                  </label>
                  <select
                    required
                    value={reassignAgentId}
                    onChange={e => setReassignAgentId(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #CBD5E1', fontSize:12.5, outline:'none', cursor:'pointer' }}
                  >
                    <option value="">-- Choose Agent --</option>
                    {agentsList.map(a => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.name} ({a.department} - {a.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:5 }}>
                    Reassignment Reason *
                  </label>
                  <input
                    required
                    value={reassignReason}
                    onChange={e => setReassignReason(e.target.value)}
                    placeholder="e.g. Admin re-routing, workload balancing"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #CBD5E1', fontSize:12.5, outline:'none' }}
                  />
                </div>

                <div style={{ background:'#EFF6FF', padding:10, borderRadius:8, fontSize:11, color:'#1E40AF', marginBottom:16 }}>
                  📧 Note: Automated email notifications will be sent to both previous and newly assigned agents.
                </div>

                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button type="button" onClick={() => setShowReassign(false)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #CBD5E1', background:'transparent', color:'#64748B', fontSize:12, fontWeight:600, cursor:'pointer' }}>
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

        {/* Admin Change Department Modal */}
        {showChangeDeptModal && (
          <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div className="animate-scale-in" style={{ ...glass(), maxWidth:480, width:'100%', padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'center', color:'#7C3AED' }}>
                    <Building size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A', margin:0 }}>Change Ticket Department [{selTicket?.ticket_id}]</h3>
                    <p style={{ fontSize:11, color:'#64748B', margin:'2px 0 0' }}>Current Dept: <strong>{selTicket?.department}</strong></p>
                  </div>
                </div>
                <button onClick={() => setShowChangeDept(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAdminChangeDept}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:5 }}>
                    New Department *
                  </label>
                  <select
                    required
                    value={changeDeptId}
                    onChange={e => setChangeDeptId(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #CBD5E1', fontSize:12.5, outline:'none', cursor:'pointer' }}
                  >
                    <option value="">-- Select New Department --</option>
                    {deptsList.map(d => (
                      <option key={d.dept_id} value={d.dept_id}>
                        {d.name} ({d.code || 'DEP'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:5 }}>
                    Department Override Reason *
                  </label>
                  <input
                    required
                    value={changeDeptReason}
                    onChange={e => setChangeDeptReason(e.target.value)}
                    placeholder="e.g. AI/Customer mismatch, transferred to engineering"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #CBD5E1', fontSize:12.5, outline:'none' }}
                  />
                </div>

                <div style={{ background:'#FFFBEB', padding:10, borderRadius:8, fontSize:11, color:'#B45309', marginBottom:16 }}>
                  ⚠️ Note: Changing the department resets agent assignment and places the ticket in the new department's shared pool. The relevant Department Manager will be notified via email.
                </div>

                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button type="button" onClick={() => setShowChangeDept(false)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #CBD5E1', background:'transparent', color:'#64748B', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={changeDeptLoading} style={{ padding:'8px 18px', borderRadius:8, background:'#7C3AED', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    {changeDeptLoading ? <RefreshCw size={13} className="spin" /> : 'Apply Department Override'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <main style={{ flex:1, padding:22, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Top View Mode Switcher: All Tickets vs. Agent Live Oversight */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setViewMode('tickets')}
              style={{
                padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                border: viewMode === 'tickets' ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                background: viewMode === 'tickets' ? '#7C3AED' : '#FFF',
                color: viewMode === 'tickets' ? '#FFF' : '#64748B',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: viewMode === 'tickets' ? '0 4px 14px rgba(124,58,237,0.25)' : 'none'
              }}
            >
              <Ticket size={16} /> All Complaint Tickets ({tickets.length})
            </button>

            <button
              onClick={() => { setViewMode('agents'); fetchAgentsOverview(); }}
              style={{
                padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                border: viewMode === 'agents' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                background: viewMode === 'agents' ? '#2563EB' : '#FFF',
                color: viewMode === 'agents' ? '#FFF' : '#64748B',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: viewMode === 'agents' ? '0 4px 14px rgba(37,99,235,0.25)' : 'none'
              }}
            >
              <Users size={16} /> Agent Live Oversight & Workload ("کون کیا کام کر رہا ہے")
              {agentsOverview.total_agents > 0 && (
                <span style={{ fontSize: 10.5, padding: '1px 8px', borderRadius: 99, background: viewMode === 'agents' ? '#FFF' : '#EFF6FF', color: '#2563EB', fontWeight: 800 }}>
                  {agentsOverview.total_agents} Staff
                </span>
              )}
            </button>
          </div>

          {/* ════════════ VIEW 1: ALL COMPLAINT TICKETS QUEUE ════════════ */}
          {viewMode === 'tickets' && (
            <>
              {/* Stats Bar */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:13 }}>
            <StatCard title="Total Tickets" value={tickets.length}   subtitle="All time"          icon={Ticket}        color="violet"  delay={0}   />
            <StatCard title="In Triage"     value={tickets.filter(t => t.status === 'In Triage').length}    subtitle="Awaiting response" icon={Clock}         color="amber"   delay={70}  />
            <StatCard title="Assigned"      value={tickets.filter(t => t.assigned_agent_id).length}     subtitle="Active agent queue" icon={UserCheck} color="emerald"    delay={140} />
            <StatCard title="Unassigned"    value={tickets.filter(t => !t.assigned_agent_id).length}    subtitle="Shared pool"       icon={AlertTriangle} color="rose" delay={210} />
          </div>

          {/* Filter Bar */}
          <div style={{ ...glass(), padding:'14px 18px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', flex:1, minWidth:260 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(248,250,252,0.9)', border:'1px solid rgba(226,232,240,0.8)', borderRadius:10, padding:'6px 12px', flex:1, maxWidth:320 }}>
                <Search size={13} color="#94A3B8"/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID, customer, title…" style={{ background:'none', border:'none', outline:'none', fontSize:12.5, color:'#0F172A', width:'100%' }}/>
              </div>

              <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ padding:'7px 11px', borderRadius:9, border:'1px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:12, outline:'none', cursor:'pointer' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select value={channelF} onChange={e => setChannelF(e.target.value)} style={{ padding:'7px 11px', borderRadius:9, border:'1px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:12, outline:'none', cursor:'pointer' }}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button onClick={fetchTickets} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, border:'1px solid rgba(226,232,240,0.8)', background:'#FFF', fontSize:12, fontWeight:600, color:'#64748B', cursor:'pointer' }}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {/* Main Grid: Table + Detail Panel */}
          <div style={{ display:'grid', gridTemplateColumns: selTicket ? '1fr 440px' : '1fr', gap:16, alignItems:'flex-start' }}>

            {/* Tickets Table Card */}
            <div style={{ ...glass(), padding:18, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                  <thead>
                    <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                      {['ID','Title','Customer','Dept','Assigned Agent','Channel','Priority','Status','Actions'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid rgba(226,232,240,0.5)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => {
                      const sc = STATUS_COLORS[t.status] || STATUS_COLORS['Closed']
                      const pc = P_COLORS[t.priority || t.p] || P_COLORS.P3
                      const tId = t.ticket_id || t.id
                      const tCust = t.customer_name || t.customer || 'Customer'
                      const tChannel = t.channel || 'Web Form'
                      const isSelected = selTicket?.ticket_id === tId || selTicket?.id === tId
                      return (
                        <tr key={tId}
                          className="animate-fade-up"
                          style={{ animationDelay:`${i*30}ms`, cursor:'pointer', transition:'background 0.15s', background: isSelected ? 'rgba(124,58,237,0.04)' : 'transparent' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='rgba(124,58,237,0.02)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='transparent' }}
                          onClick={() => { setSel(isSelected ? null : t); setActiveTab('pipeline') }}
                        >
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontFamily:'monospace', fontSize:11, color:'#7C3AED', fontWeight:700, whiteSpace:'nowrap' }}>{tId}</td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', maxWidth:200 }}>
                            <div style={{ fontSize:12, fontWeight:500, color:'#0F172A', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize:10, color:'#94A3B8', marginTop:2 }}>{t.category || t.cat || 'General'} · Ref: {t.order_id || 'N/A'}</div>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#64748B', whiteSpace:'nowrap' }}>
                            <div style={{ fontWeight:700, color:'#0F172A' }}>{tCust}</div>
                            <div style={{ fontSize:10, color:'#94A3B8' }}>{t.customer_email || ''}</div>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ fontSize:11, color:'#334155', background:'rgba(248,250,252,0.8)', padding:'2px 8px', borderRadius:6, border:'1px solid rgba(226,232,240,0.6)', fontWeight: 600 }}>
                              {t.department || t.customer_department || t.dept || 'Logistics'}
                              {t.department_id ? <span style={{ marginLeft: 4, fontFamily: 'monospace', fontSize: 10, color: '#059669', background: '#ECFDF5', padding: '1px 5px', borderRadius: 4 }}>{t.department_id}</span> : null}
                            </span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            {t.assigned_agent || t.assigned_agent_id ? (
                              <span style={{ fontSize:11, color:'#059669', fontWeight:600, background:'#ECFDF5', padding:'2px 8px', borderRadius:6, border:'1px solid #A7F3D0' }}>
                                👤 {t.assigned_agent || t.assigned_agent_id}
                              </span>
                            ) : (
                              <span style={{ fontSize:10.5, color:'#D97706', fontWeight:700, background:'#FFFBEB', padding:'2px 8px', borderRadius:6, border:'1px solid #FDE68A' }}>
                                ⚡ Unassigned
                              </span>
                            )}
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:12, background: tChannel === 'Chat' ? '#F5F3FF' : tChannel === 'Email' ? '#FEF3C7' : '#EFF6FF', color: tChannel === 'Chat' ? '#7C3AED' : tChannel === 'Email' ? '#D97706' : '#2563EB' }}>
                              {tChannel === 'Chat' ? '💬 Chat' : tChannel === 'Email' ? '📧 Email' : '📄 Web Form'}
                            </span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:6, background:pc.bg, color:pc.c }}>{t.priority || t.p || 'P2'}</span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:600, background:sc.bg, color:sc.c, border:`1px solid ${sc.border}`, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                              <span className="pulse-dot" style={{ width:5, height:5, borderRadius:'50%', background:sc.dot, flexShrink:0 }} />
                              {t.status}
                            </span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Link
                                href={`/admin/tickets/${tId}`}
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700,
                                  color:'#FFF', background:'#7C3AED', padding:'5px 10px', borderRadius:8,
                                  textDecoration: 'none', boxShadow: '0 2px 6px rgba(124,58,237,0.2)'
                                }}
                              >
                                <Eye size={11} /> 360° View
                              </Link>
                              <button
                                onClick={e => { e.stopPropagation(); setSel(isSelected ? null : t); }}
                                style={{
                                  display:'inline-flex', alignItems:'center', gap:3, fontSize:11, fontWeight:600,
                                  color: isSelected?'#7C3AED':'#64748B', background: isSelected?'rgba(124,58,237,0.1)':'#F1F5F9',
                                  padding:'5px 8px', borderRadius:8, border:'1px solid rgba(226,232,240,0.7)', cursor:'pointer'
                                }}
                              >
                                Peek
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail Panel */}
            {selTicket && (
              <div className="animate-slide-left" style={glass({ padding:0, alignSelf:'flex-start', position:'sticky', top:22, maxHeight:'calc(100vh - 120px)', display:'flex', flexDirection:'column', overflow:'hidden' })}>
                {/* Header */}
                <div style={{ padding:'18px 20px', background:'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(79,70,229,0.03))', borderBottom:'1px solid rgba(226,232,240,0.5)', position:'relative', flexShrink:0 }}>
                  <button onClick={() => setSel(null)} style={{ position:'absolute', top:13, right:13, background:'rgba(255,255,255,0.8)', border:'1px solid rgba(226,232,240,0.6)', borderRadius:8, width:26, height:26, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748B', transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='#FFF1F2'; e.currentTarget.style.color='#E11D48' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.8)'; e.currentTarget.style.color='#64748B' }}
                  >
                    <X size={12} />
                  </button>
                  <div style={{ display:'flex', gap:7, marginBottom:9, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ fontFamily:'monospace', fontSize:12, color:'#7C3AED', fontWeight:700 }}>{selTicket.ticket_id || selTicket.id}</span>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:12, background: (selTicket.channel === 'Chat') ? '#F5F3FF' : (selTicket.channel === 'Email') ? '#FEF3C7' : '#EFF6FF', color: (selTicket.channel === 'Chat') ? '#7C3AED' : (selTicket.channel === 'Email') ? '#D97706' : '#2563EB' }}>
                      {(selTicket.channel === 'Chat') ? '💬 Chat' : (selTicket.channel === 'Email') ? '📧 Email' : '📄 Web Form'}
                    </span>
                    {[P_COLORS[selTicket.priority || selTicket.p] || P_COLORS.P2].map(pc => (
                      <span key="p" style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:pc.bg, color:pc.c }}>{selTicket.priority || selTicket.p || 'P2'}</span>
                    ))}
                    {[STATUS_COLORS[selTicket.status]||STATUS_COLORS['Closed']].map(sc => (
                      <span key="s" style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:sc.bg, color:sc.c, border:`1px solid ${sc.border}`, fontWeight:600 }}>{selTicket.status}</span>
                    ))}
                  </div>
                  <p style={{ fontSize:13, fontWeight:600, color:'#0F172A', lineHeight:1.4, marginBottom:10 }}>{selTicket.title}</p>
                  
                  <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, fontSize: 11.5, color: '#334155', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    <div>Customer: <strong>{selTicket.customer_name || selTicket.customer || 'Customer'}</strong></div>
                    <div>Email: <strong>{selTicket.customer_email || 'N/A'}</strong></div>
                    <div>Dept: <strong>{selTicket.department || selTicket.customer_department || selTicket.dept || 'General'}</strong></div>
                    <div>Dept ID: <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{selTicket.department_id || 'N/A'}</strong></div>
                    <div style={{ gridColumn: 'span 2' }}>
                      Assigned Agent: <strong style={{ color: selTicket.assigned_agent_id ? '#059669' : '#D97706' }}>
                        {selTicket.assigned_agent || selTicket.assigned_agent_id || '⚡ Unassigned'}
                      </strong>
                    </div>
                  </div>

                  {/* Admin Override Action Buttons */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <Link
                      href={`/admin/tickets/${selTicket.ticket_id || selTicket.id}`}
                      style={{
                        padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700,
                        background:'#7C3AED', color:'#FFF', border:'none', textDecoration:'none',
                        display:'flex', alignItems:'center', gap:4, boxShadow:'0 2px 6px rgba(124,58,237,0.2)'
                      }}
                    >
                      <ExternalLink size={11} /> Open 360° Page
                    </Link>

                    <button
                      onClick={() => {
                        setShowReassign(true)
                        setReassignReason('')
                        if (agentsList.length > 0) setReassignAgentId(agentsList[0].user_id)
                      }}
                      style={{
                        padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
                        background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE',
                        display:'flex', alignItems:'center', gap:4
                      }}
                    >
                      <ArrowRightLeft size={11} /> Reassign Agent
                    </button>

                    <button
                      onClick={() => {
                        setShowChangeDept(true)
                        setChangeDeptReason('')
                        if (deptsList.length > 0) setChangeDeptId(deptsList[0].dept_id)
                      }}
                      style={{
                        padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
                        background:'#FAF5FF', color:'#7C3AED', border:'1px solid #DDD6FE',
                        display:'flex', alignItems:'center', gap:4
                      }}
                    >
                      <Building size={11} /> Change Department
                    </button>
                  </div>
                </div>

                {/* AI Match Banner */}
                <div style={{ padding:'10px 18px', background: selTicket.match ? 'rgba(5,150,105,0.06)' : 'rgba(217,119,6,0.06)', borderBottom:'1px solid rgba(226,232,240,0.4)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  {selTicket.match
                    ? <><CheckCircle size={14} color="#059669"/><span style={{ fontWeight:700, color:'#059669', fontSize:12 }}>VERIFIED MATCH</span></>
                    : <><AlertTriangle size={14} color="#D97706"/><span style={{ fontWeight:700, color:'#D97706', fontSize:12 }}>MISMATCH DETECTED</span></>
                  }
                </div>

                {/* Tabs */}
                <div style={{ display:'flex', gap:2, padding:'10px 18px', borderBottom:'1px solid rgba(226,232,240,0.4)', flexShrink:0 }}>
                  {[
                    ['pipeline','🔬 Pipeline'],
                    ['audit',`📜 Audit Trail (${auditHistory.length})`],
                    ['info','📋 Info'],
                    ['response','💬 Response']
                  ].map(([k,l]) => (
                    <button key={k} onClick={() => setActiveTab(k)} style={{
                      padding:'6px 10px', borderRadius:8, border:'none', cursor:'pointer', fontSize:11.5, fontWeight:600,
                      background: activeTab===k ? 'rgba(124,58,237,0.1)' : 'transparent',
                      color: activeTab===k ? '#7C3AED' : '#64748B',
                      transition:'all 0.15s',
                    }}>{l}</button>
                  ))}
                </div>

                {/* Tab Content */}
                <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>
                  
                  {/* Pipeline Tab */}
                  {activeTab === 'pipeline' && (
                    pipeline ? (
                      <div className="animate-fade-in">
                        {/* GenAI */}
                        <div style={{ padding:14, borderRadius:12, background:'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(248,250,252,0.8))', border:'1px solid rgba(124,58,237,0.18)', marginBottom:12 }}>
                          <div style={{ display:'flex', gap:7, alignItems:'center', marginBottom:11 }}>
                            <Zap size={13} color="#7C3AED"/>
                            <p style={{ fontSize:10, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.06em' }}>GenAI Pipeline 1</p>
                          </div>
                          {[['Issue',pipeline.genai.issue],['Sentiment',pipeline.genai.sentiment],['Priority',pipeline.genai.priority],['Dept',pipeline.genai.dept]].map(([k,v]) => (
                            <div key={k} style={{ marginBottom:8 }}>
                              <span style={{ fontSize:10, color:'#94A3B8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k}: </span>
                              <span style={{ fontSize:12, color:'#334155', fontWeight:500 }}>{v}</span>
                            </div>
                          ))}
                          <div style={{ marginTop:10, padding:'10px', borderRadius:9, background:'rgba(255,255,255,0.7)', border:'1px solid rgba(124,58,237,0.12)' }}>
                            <p style={{ fontSize:10, color:'#94A3B8', fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>Draft Response</p>
                            <p style={{ fontSize:11, color:'#64748B', lineHeight:1.7 }}>{pipeline.genai.draft}</p>
                          </div>
                        </div>
                        {/* Python GT */}
                        <div style={{ padding:14, borderRadius:12, background:'linear-gradient(135deg,rgba(5,150,105,0.07),rgba(248,250,252,0.8))', border:'1px solid rgba(5,150,105,0.18)' }}>
                          <div style={{ display:'flex', gap:7, alignItems:'center', marginBottom:11 }}>
                            <ShieldCheck size={13} color="#059669"/>
                            <p style={{ fontSize:10, fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:'0.06em' }}>Python Ground-Truth</p>
                            <span style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#059669' }}>{pipeline.python.score}%</span>
                          </div>
                          <div style={{ fontSize:11, fontFamily:'monospace', color:'#059669', background:'rgba(5,150,105,0.1)', padding:'5px 10px', borderRadius:7, marginBottom:10 }}>{pipeline.python.rule}</div>
                          <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:9 }}>
                            {pipeline.python.escalation && <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:6, background:'rgba(225,29,72,0.1)', color:'#E11D48', border:'1px solid rgba(225,29,72,0.2)' }}>🚨 Escalation Required</span>}
                            {pipeline.python.refund && <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:6, background:'rgba(5,150,105,0.1)', color:'#059669', border:'1px solid rgba(5,150,105,0.2)' }}>✓ Refund Eligible</span>}
                          </div>
                          <p style={{ fontSize:10, color:'#94A3B8', fontFamily:'monospace' }}>Ref: {pipeline.python.policy}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign:'center', padding:'30px 16px' }}>
                        <Zap size={28} color="#CBD5E1" style={{ margin:'0 auto 12px', display:'block' }}/>
                        <p style={{ fontSize:13, color:'#94A3B8' }}>Pipeline data not available for this ticket</p>
                      </div>
                    )
                  )}

                  {/* Audit Trail Tab */}
                  {activeTab === 'audit' && (
                    <div className="animate-fade-in">
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                        <History size={14} color="#7C3AED" />
                        <span style={{ fontSize:11, fontWeight:700, color:'#0F172A', textTransform:'uppercase' }}>Audit History Trail</span>
                      </div>

                      {auditHistory.length === 0 ? (
                        <p style={{ fontSize:12, color:'#94A3B8' }}>No assignment actions recorded yet for this ticket.</p>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {auditHistory.map((ev, i) => (
                            <div key={i} style={{ padding:10, borderRadius:8, background:'#F8FAFC', border:'1px solid #E2E8F0', fontSize:11.5 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                                <span style={{
                                  fontSize:10, fontWeight:800, padding:'2px 6px', borderRadius:4,
                                  background: ev.action?.includes('AUTO_CLAIM') ? '#ECFDF5' : ev.action?.includes('REASSIGN') ? '#EFF6FF' : '#FEF2F2',
                                  color: ev.action?.includes('AUTO_CLAIM') ? '#059669' : ev.action?.includes('REASSIGN') ? '#2563EB' : '#DC2626'
                                }}>
                                  {ev.action}
                                </span>
                                <span style={{ fontSize:10, color:'#94A3B8', fontFamily:'monospace' }}>
                                  {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : 'Just now'}
                                </span>
                              </div>
                              <div>Agent: <strong>{ev.agent_name || ev.agent_id || 'N/A'}</strong></div>
                              {ev.reassigned_by_name && (
                                <div style={{ color:'#64748B' }}>By: <strong>{ev.reassigned_by_name}</strong> ({ev.reassigned_by_role})</div>
                              )}
                              {ev.reason && (
                                <div style={{ color:'#64748B', marginTop:2 }}>Reason: {ev.reason}</div>
                              )}
                              {ev.old_department && ev.new_department && (
                                <div style={{ color:'#1E40AF', marginTop:2 }}>Dept: {ev.old_department} ➔ {ev.new_department}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info Tab */}
                  {activeTab === 'info' && (
                    <div className="animate-fade-in">
                      {[
                        ['Ticket ID', selTicket.ticket_id || selTicket.id],
                        ['Category', selTicket.category || selTicket.cat || 'General'],
                        ['Department', selTicket.department || selTicket.customer_department || 'General'],
                        ['Department ID', selTicket.department_id || 'N/A'],
                        ['Priority', selTicket.priority || selTicket.p || 'P2'],
                        ['Status', selTicket.status],
                        ['Assigned Agent', selTicket.assigned_agent || selTicket.assigned_agent_id || 'Unassigned'],
                        ['Submitted', selTicket.incident_date || selTicket.date || 'Today'],
                      ].map(([k,v]) => (
                        <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(226,232,240,0.4)' }}>
                          <span style={{ fontSize:12, color:'#94A3B8', fontWeight:500 }}>{k}</span>
                          <span style={{ fontSize:12, color:'#0F172A', fontWeight:600, textAlign:'right' }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ marginTop:14 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase' }}>Complaint Description:</span>
                        <p style={{ fontSize:12, color:'#334155', lineHeight:1.6, background:'#F8FAFC', padding:10, borderRadius:8, marginTop:4 }}>
                          {selTicket.description || 'No detailed description provided.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Response Tab */}
                  {activeTab === 'response' && (
                    <div className="animate-fade-in">
                      <p style={{ fontSize:12, color:'#64748B', lineHeight:1.7, marginBottom:14 }}>
                        {pipeline?.genai.draft || selTicket.draft_response || 'No draft response generated yet for this ticket.'}
                      </p>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
            </>
          )}

          {/* ════════════ VIEW 2: AGENT LIVE OVERSIGHT & WORKLOAD ("کتنے ایجنٹ ہیں، کیا کام کر رہے ہیں، کس کا کیا کام ہو رہا ہے") ════════════ */}
          {viewMode === 'agents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Agent Oversight KPI Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 13 }}>
                <StatCard
                  title="Total Support Agents"
                  value={agentsOverview.total_agents}
                  subtitle="Registered staff"
                  icon={Users}
                  color="violet"
                  delay={0}
                />
                <StatCard
                  title="Actively Engaged"
                  value={agentsOverview.busy_agents}
                  subtitle="Handling open tickets"
                  icon={Zap}
                  color="emerald"
                  delay={60}
                />
                <StatCard
                  title="Idle / Available"
                  value={agentsOverview.idle_agents}
                  subtitle="Ready for assignment"
                  icon={UserCheck}
                  color="amber"
                  delay={120}
                />
                <StatCard
                  title="Active Workload"
                  value={agentsOverview.total_active_tickets}
                  subtitle="Tickets under work"
                  icon={Ticket}
                  color="indigo"
                  delay={180}
                />
                <StatCard
                  title="Total Resolved"
                  value={agentsOverview.total_resolved_tickets}
                  subtitle="Successfully closed"
                  icon={CheckCircle2}
                  color="emerald"
                  delay={240}
                />
              </div>

              {/* Agent Filter & Controls */}
              <div style={{ ...glass(), padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(248,250,252,0.9)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 10, padding: '6px 12px', flex: 1, maxWidth: 320 }}>
                    <Search size={13} color="#94A3B8" />
                    <input
                      value={agentSearch}
                      onChange={e => setAgentSearch(e.target.value)}
                      placeholder="Search agent name, email, role..."
                      style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12.5, color: '#0F172A', width: '100%' }}
                    />
                  </div>

                  <select
                    value={agentDeptFilter}
                    onChange={e => setAgentDeptFilter(e.target.value)}
                    style={{ padding: '7px 11px', borderRadius: 9, border: '1px solid rgba(226,232,240,0.8)', background: 'rgba(248,250,252,0.9)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="ALL">All Departments</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Billing & Refunds">Billing & Refunds</option>
                    <option value="Quality Assurance">Quality Assurance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={fetchAgentsOverview}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(226,232,240,0.8)', background: '#FFF', fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}
                  >
                    <RefreshCw size={12} className={agentsLoading ? 'spin' : ''} /> Refresh Live Roster
                  </button>
                </div>
              </div>

              {/* Agent Oversight Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {agentsOverview.agents
                  .filter(agent => {
                    const matchSearch = !agentSearch ||
                      agent.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
                      agent.email.toLowerCase().includes(agentSearch.toLowerCase()) ||
                      agent.role.toLowerCase().includes(agentSearch.toLowerCase());
                    const matchDept = agentDeptFilter === 'ALL' ||
                      (agent.department || '').toLowerCase() === agentDeptFilter.toLowerCase();
                    return matchSearch && matchDept;
                  })
                  .map(agent => {
                    const isBusy = agent.active_count > 0;
                    const hasViolations = (agent.violations_count || 0) > 0;

                    return (
                      <div
                        key={agent.agent_id}
                        style={{
                          ...glass(),
                          padding: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                          position: 'relative',
                          border: isBusy ? '1px solid #BFDBFE' : '1px solid rgba(226,232,240,0.8)',
                          boxShadow: isBusy ? '0 4px 16px -2px rgba(37,99,235,0.06)' : undefined,
                        }}
                      >
                        {/* Header: Agent info & Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: isBusy
                                  ? 'linear-gradient(135deg, #2563EB, #1D4ED8)'
                                  : 'linear-gradient(135deg, #64748B, #475569)',
                                color: '#FFF',
                                fontWeight: 800,
                                fontSize: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isBusy ? '0 4px 10px rgba(37,99,235,0.25)' : undefined,
                              }}
                            >
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{agent.name}</span>
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    padding: '1.5px 6px',
                                    borderRadius: 4,
                                    background: '#F1F5F9',
                                    color: '#475569',
                                  }}
                                >
                                  {agent.role}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{agent.email}</div>
                              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>
                                Dept: <strong style={{ color: '#475569' }}>{agent.department || 'General'}</strong>
                                {agent.reporting_manager && (
                                  <span style={{ marginLeft: 6 }}>• Lead: {agent.reporting_manager}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Live Status indicator */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 99,
                                background: isBusy ? '#EFF6FF' : '#F8FAFC',
                                color: isBusy ? '#2563EB' : '#64748B',
                                border: isBusy ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: isBusy ? '#2563EB' : '#94A3B8',
                                  boxShadow: isBusy ? '0 0 6px rgba(37,99,235,0.8)' : undefined,
                                }}
                              />
                              {isBusy ? 'Actively Handling' : 'Idle / Ready'}
                            </span>

                            {hasViolations && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  border: '1px solid #FECACA',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                ⚠️ {agent.violations_count} Reassigned / Flailed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Workload Stats Bar */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                            background: 'rgba(248,250,252,0.9)',
                            border: '1px solid #E2E8F0',
                            borderRadius: 10,
                            padding: '8px 12px',
                            textAlign: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#2563EB' }}>{agent.active_count}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Active</div>
                          </div>
                          <div style={{ borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>{agent.resolved_count}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Resolved</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{agent.total_assigned}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Lifetime</div>
                          </div>
                        </div>

                        {/* Current Work ("کس کا کیا کام ہو رہا ہے") */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Current Workload ({agent.active_tickets.length})
                            </span>
                            {agent.active_tickets.length > 0 && (
                              <span style={{ fontSize: 10, color: '#2563EB', fontWeight: 600 }}>Click to audit 360°</span>
                            )}
                          </div>

                          {agent.active_tickets.length === 0 ? (
                            <div
                              style={{
                                padding: '12px',
                                background: '#F8FAFC',
                                border: '1px dashed #CBD5E1',
                                borderRadius: 8,
                                textAlign: 'center',
                                fontSize: 11.5,
                                color: '#94A3B8',
                              }}
                            >
                              No active tickets assigned right now. Available for new assignments.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                              {agent.active_tickets.map((t) => (
                                <Link
                                  key={t.ticket_id}
                                  href={`/admin/tickets/${t.ticket_id}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '7px 10px',
                                    borderRadius: 7,
                                    background: '#FFF',
                                    border: '1px solid #E2E8F0',
                                    textDecoration: 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                  className="hover:border-blue-400 hover:shadow-xs"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: '#2563EB', flexShrink: 0 }}>
                                      {t.ticket_id}
                                    </span>
                                    <span style={{ fontSize: 11.5, color: '#1E293B', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {t.title || 'Untitled Ticket'}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                    <span
                                      style={{
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        background: t.priority === 'High' ? '#FEF2F2' : '#F1F5F9',
                                        color: t.priority === 'High' ? '#DC2626' : '#475569',
                                      }}
                                    >
                                      {t.priority}
                                    </span>
                                    <ExternalLink size={11} color="#94A3B8" />
                                  </div>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Latest Task / Note snippet if any */}
                        {agent.current_work && agent.current_work.latest_notes && (
                          <div style={{ padding: '8px 10px', background: '#FEF9C3', borderRadius: 7, border: '1px solid #FEF08A', fontSize: 11, color: '#854D0E' }}>
                            <strong style={{ fontWeight: 700 }}>Latest Activity Note:</strong> {agent.current_work.latest_notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {agentsOverview.agents.length === 0 && !agentsLoading && (
                <div style={{ ...glass(), padding: 36, textAlign: 'center', color: '#64748B' }}>
                  <Users size={36} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>No agents found in roster</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Agents created in the system or database will appear here automatically.</div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
