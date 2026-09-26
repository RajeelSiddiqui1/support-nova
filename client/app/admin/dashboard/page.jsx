'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { Upload, FileText, CheckCircle, XCircle, Zap, ShieldCheck, Settings, Database, BarChart3, Users, RefreshCw, Plus, Search, X, Ticket, ArrowUpRight, Eye, AlertCircle } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

import { API_BASE } from '../../lib/api'
import { useRealtimeRefresh } from '../../lib/useWebSocket'

const glass = (extra = {}) => ({ background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 16, boxShadow: '0 4px 24px rgba(11,14,20,0.3)', ...extra })

const hoverLift = {
  onMouseEnter: e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(11, 14, 20, 0.4), 0 2px 8px rgba(11, 14, 20, 0.4)' },
  onMouseLeave: e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 28px rgba(11, 14, 20, 0.4), 0 1px 4px rgba(11, 14, 20, 0.4)' },
}

const FALLBACK_VOLUME  = [{ d:'Mon',v:0},{ d:'Tue',v:0},{ d:'Wed',v:0},{ d:'Thu',v:0},{ d:'Fri',v:0},{ d:'Sat',v:0},{ d:'Sun',v:0}]
const FALLBACK_DEPT    = [{ d:'Logistics',v:0},{ d:'Finance',v:0},{ d:'Quality',v:0},{ d:'Fulfillment',v:0},{ d:'Operations',v:0}]
const FALLBACK_PIE     = [{ name:'Match',v:100,count:0,c:'#059669'},{ name:'Mismatch',v:0,count:0,c:'#D97706'},{ name:'Override',v:0,count:0,c:'#7C3AED'}]
const FALLBACK_SLA     = [{ l:'Critical (P0)',v:0,m:10,c:'#E11D48'},{ l:'High (P1)',v:0,m:10,c:'#D97706'},{ l:'Medium (P2)',v:0,m:10,c:'#0891B2'},{ l:'Low (P3)',v:0,m:10,c:'#059669'}]
const FALLBACK_WEEKLY  = [{ d:'Mon',open:0,resolved:0},{ d:'Tue',open:0,resolved:0},{ d:'Wed',open:0,resolved:0},{ d:'Thu',open:0,resolved:0},{ d:'Fri',open:0,resolved:0},{ d:'Sat',open:0,resolved:0},{ d:'Sun',open:0,resolved:0}]

const ROLES_L = ['Agent','Reviewer','Manager']
const DEPTS_L  = ['Logistics','Finance','Quality','Fulfillment','Operations','Tech','Customer Experience']
const CATS_L   = ['Delivery','Refund','Replacement','Warranty','Billing','Quality','General']

const ROLE_COLORS = { Agent:'#0891B2', Reviewer:'#D97706', Manager:'#7C3AED', Admin:'#4F46E5' }

const CustomTip = ({ active, payload, label }) => active && payload?.length ? (
  <div style={{ background: 'var(--nw-elevated)', border:'1px solid var(--nw-border)', borderRadius:10, padding:'8px 13px', boxShadow:'0 8px 20px rgba(11, 14, 20, 0.4)' }}>
    <p style={{ color: 'var(--nw-text-muted)', fontSize:11, marginBottom:4 }}>{label}</p>
    {payload.map(p => <p key={p.dataKey} style={{ color:p.color||'#7C3AED', fontSize:14, fontWeight:700, fontFamily:'monospace' }}>{p.value} <span style={{ color: 'var(--nw-text-muted)', fontSize:10 }}>{p.name}</span></p>)}
  </div>
) : null

const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid var(--nw-border)', background:'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize:13, outline:'none', fontFamily:'Inter,sans-serif', transition:'border-color 0.2s, box-shadow 0.2s' }
const sel = { ...inp, cursor:'pointer' }

export default function AdminDashboard() {
  const [tab, setTab]         = useState('analytics')
  const [drag, setDrag]       = useState(false)
  const [uploads, setUploads] = useState([])
  const [ruleQ, setRuleQ]     = useState('')
  
  // Real DB state
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [rules, setRules]     = useState([])
  const [rulesLoading, setRulesLoading] = useState(true)

  const [kbDocs, setKbDocs]   = useState([])
  const [kbLoading, setKbLoading] = useState(true)

  const [staff, setStaff]     = useState([])
  const [staffLoading, setStaffLoading] = useState(true)

  // Forms
  const [newForm, setNewForm]   = useState({ name:'', role:'Agent', dept:'', email:'' })
  const [showAdd, setShowAdd]   = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editForm, setEditForm] = useState({})

  // Rule Form
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRuleForm, setNewRuleForm] = useState({
    rule_id: '',
    category: 'Delivery',
    condition: '',
    department: 'Logistics',
    mandatory_actions: '',
    prohibited_actions: '',
    policy_reference: ''
  })
  const [ruleSubmitting, setRuleSubmitting] = useState(false)

  const [createdTempPwd, setTempPwd] = useState('')
  const [createdEmail, setCreatedEmail] = useState('')
  const [apiSuccessMsg, setApiSuccess] = useState('')

  const TABS = [
    { k:'analytics', label:'📊 Analytics'        },
    { k:'kb',        label:'📚 Knowledge Base'   },
    { k:'rules',     label:'⚙️ Rule Matrix'       },
    { k:'staff',     label:'👥 Staff Management'  },
  ]

  // ── 1. Fetch Real Analytics from MongoDB ──
  const fetchAnalytics = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/analytics`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
        setAnalyticsError(null)
      } else {
        setAnalyticsError('Unable to load live database analytics.')
      }
    } catch (err) {
      console.error('Error fetching admin analytics:', err)
      setAnalyticsError('Network error connecting to backend API.')
    } finally {
      setAnalyticsLoading(false)
      if (manual) setTimeout(() => setIsRefreshing(false), 500)
    }
  }, [])

  // ── 2. Fetch Rules from MongoDB ──
  const fetchRules = useCallback(async () => {
    try {
      setRulesLoading(true)
      const res = await fetch(`${API_BASE}/api/admin/rules`)
      if (res.ok) {
        const data = await res.json()
        setRules(data.map(r => ({
          id: r.rule_id,
          cat: r.category,
          cond: r.condition,
          dept: r.department,
          must: (r.mandatory_actions && r.mandatory_actions.length > 0) ? r.mandatory_actions.join(', ') : 'Standard verification',
          no: (r.prohibited_actions && r.prohibited_actions.length > 0) ? r.prohibited_actions.join(', ') : 'None',
          refund_eligible: r.refund_eligible,
          escalation_required: r.escalation_required,
          policy_reference: r.policy_reference
        })))
      }
    } catch (err) {
      console.error('Error fetching rule matrix:', err)
    } finally {
      setRulesLoading(false)
    }
  }, [])

  // ── 3. Fetch Knowledge Base Documents from MongoDB ──
  const fetchKbDocs = useCallback(async () => {
    try {
      setKbLoading(true)
      const res = await fetch(`${API_BASE}/api/policies`)
      if (res.ok) {
        const data = await res.json()
        setKbDocs(data.map(d => ({
          id: d.doc_id,
          name: d.title,
          chunks: d.chunk_count || (d.chunks ? d.chunks.length : 0),
          ver: d.version || 'v1.0',
          status: d.status || 'Active',
          size: d.file_size_kb ? `${d.file_size_kb} KB` : '120 KB',
          date: d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'
        })))
      }
    } catch (err) {
      console.error('Error fetching policies:', err)
    } finally {
      setKbLoading(false)
    }
  }, [])

  // ── 4. Fetch Staff from MongoDB Users ──
  const fetchStaff = useCallback(async () => {
    try {
      setStaffLoading(true)
      const res = await fetch(`${API_BASE}/api/admin/users`)
      if (res.ok) {
        const users = await res.json()
        const staffOnly = users.filter(u => ['AGENT', 'REVIEWER', 'MANAGER', 'ADMIN'].includes(u.role?.toUpperCase()))
        setStaff(staffOnly.map(u => ({
          id: u.user_id || u._id,
          name: u.name,
          role: u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1).toLowerCase()) : 'Agent',
          dept: u.department || 'General',
          email: u.email,
          status: u.status === 'ACTIVE' ? 'Active' : 'Inactive'
        })))
      }
    } catch (err) {
      console.error('Error fetching staff members:', err)
    } finally {
      setStaffLoading(false)
    }
  }, [])

  // Load live data on mount
  useEffect(() => {
    fetchAnalytics()
    fetchRules()
    fetchKbDocs()
    fetchStaff()
  }, [fetchAnalytics, fetchRules, fetchKbDocs, fetchStaff])

  // Real-time zero-reload sync via WebSocket
  useRealtimeRefresh(() => {
    fetchAnalytics()
  })

  // Staff creation
  const addStaff = async () => {
    if (!newForm.name || !newForm.dept || !newForm.email) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/create-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      })
      const data = await res.json()

      if (res.ok && data.temp_password) {
        setTempPwd(data.temp_password)
        setCreatedEmail(newForm.email)
        setApiSuccess(`Staff ${newForm.name} created! Temporary credentials sent to ${newForm.email}`)
      } else if (res.ok) {
        setApiSuccess(`Staff ${newForm.name} created successfully!`)
      } else {
        setApiSuccess(`Error: ${data.detail || 'Could not create staff member.'}`)
      }
      fetchStaff()
      fetchAnalytics()
    } catch {
      setApiSuccess(`Staff creation request submitted.`)
      fetchStaff()
    }

    setNewForm({ name: '', role: 'Agent', dept: '', email: '' })
    setShowAdd(false)
  }

  // Rule creation
  const handleCreateRule = async () => {
    if (!newRuleForm.rule_id || !newRuleForm.condition) return
    setRuleSubmitting(true)
    try {
      const payload = {
        rule_id: newRuleForm.rule_id.trim().toUpperCase(),
        category: newRuleForm.category,
        condition: newRuleForm.condition,
        department: newRuleForm.department,
        mandatory_actions: newRuleForm.mandatory_actions ? newRuleForm.mandatory_actions.split(',').map(s => s.trim()).filter(Boolean) : [],
        prohibited_actions: newRuleForm.prohibited_actions ? newRuleForm.prohibited_actions.split(',').map(s => s.trim()).filter(Boolean) : [],
        policy_reference: newRuleForm.policy_reference || 'SOP Policy Guidelines'
      }
      const res = await fetch(`${API_BASE}/api/admin/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setShowAddRule(false)
        setNewRuleForm({ rule_id: '', category: 'Delivery', condition: '', department: 'Logistics', mandatory_actions: '', prohibited_actions: '', policy_reference: '' })
        fetchRules()
        fetchAnalytics()
      }
    } catch (err) {
      console.error('Failed to create rule:', err)
    } finally {
      setRuleSubmitting(false)
    }
  }

  // Delete rule
  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm(`Delete rule ${ruleId} from Rule Matrix?`)) return
    try {
      const res = await fetch(`${API_BASE}/api/admin/rules/${ruleId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchRules()
        fetchAnalytics()
      }
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  const filteredRules = ruleQ 
    ? rules.filter(r => r.id?.toLowerCase().includes(ruleQ.toLowerCase()) || r.cat?.toLowerCase().includes(ruleQ.toLowerCase()) || r.dept?.toLowerCase().includes(ruleQ.toLowerCase()))
    : rules

  // Dynamic Chart Datasets
  const volumeData = analytics?.volume && analytics.volume.length > 0 ? analytics.volume : FALLBACK_VOLUME
  const deptData   = analytics?.department_workload && analytics.department_workload.length > 0 ? analytics.department_workload : FALLBACK_DEPT
  const pieData    = analytics?.ai_pipeline_accuracy && analytics.ai_pipeline_accuracy.length > 0 ? analytics.ai_pipeline_accuracy : FALLBACK_PIE
  const slaData    = analytics?.sla_risk && analytics.sla_risk.length > 0 ? analytics.sla_risk : FALLBACK_SLA
  const weeklyData = analytics?.weekly_trend && analytics.weekly_trend.length > 0 ? analytics.weekly_trend : FALLBACK_WEEKLY

  return (
    <div style={{ display:'flex', minHeight:'100vh', background: 'var(--nw-base)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@company.com" />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar title="Admin Command Center" subtitle="Real-Time Analytics, Knowledge Base, Rule Matrix & Staff Management" />

        <main className="responsive-main-padding" style={{ flex:1, padding:22, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Quick Access Cards */}
          <div className="animate-fade-up" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))', gap:12 }}>
            {[
              { href:'/admin/tickets',  icon:'🎫', title:'All Tickets',     sub:`${analytics?.summary?.total_tickets ?? 0} total · ${analytics?.summary?.open_tickets ?? 0} open`, c:'#7C3AED', bg:'#F5F3FF' },
              { href:'/admin/users',    icon:'👥', title:'User Management', sub:`${analytics?.summary?.total_customers ?? 0} customers registered`, c:'#059669', bg:'#ECFDF5' },
              { href:'/reviewer/queue', icon:'⚖️', title:'Review Queue',    sub:`${analytics?.summary?.review_queue_count ?? 0} pending review`, c:'#D97706', bg:'#FFFBEB' },
              { href:'/agent/workspace',icon:'🎧', title:'Agent Workspace', sub:`${analytics?.summary?.agent_queue_count ?? 0} tickets in queue`, c:'#0891B2', bg:'#EFF6FF' },
            ].map(card => (
              <Link key={card.href} href={card.href || '/admin/dashboard'} style={{ textDecoration:'none' }}>
                <div style={{ ...glass(), padding:'14px 16px', display:'flex', alignItems:'center', gap:11, transition:'all 0.2s', cursor:'pointer' }} {...hoverLift}>
                  <div style={{ width:38, height:38, borderRadius:12, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, boxShadow:`0 4px 12px ${card.c}20` }}>
                    {card.icon}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:700, color: 'var(--nw-text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{card.title}</p>
                    <p style={{ fontSize:10.5, color: 'var(--nw-text-muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{card.sub}</p>
                  </div>
                  <ArrowUpRight size={13} color="#94A3B8" style={{ marginLeft:'auto', flexShrink:0 }}/>
                </div>
              </Link>
            ))}
          </div>

          {/* Real-time Stats Cards directly from Live Database */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
            <StatCard 
              title="Total Tickets"  
              value={analyticsLoading ? "..." : String(analytics?.summary?.total_tickets ?? 0)} 
              subtitle={analytics?.summary ? `${analytics.summary.open_tickets} active open` : "Live from DB"} 
              icon={BarChart3} 
              color="violet"  
              trend="up"   
              trendValue="Live DB" 
              delay={0}   
            />
            <StatCard 
              title="AI Match Rate"  
              value={analyticsLoading ? "..." : `${analytics?.summary?.ai_match_rate ?? 0}%`} 
              subtitle="GenAI vs Python"   
              icon={Zap}       
              color="emerald" 
              trend={(analytics?.summary?.ai_match_rate ?? 0) >= 70 ? "up" : "down"}   
              trendValue={analytics?.summary ? `${analytics.summary.ai_match_rate}%` : undefined}  
              delay={70}  
            />
            <StatCard 
              title="SLA Breach"     
              value={analyticsLoading ? "..." : `${analytics?.summary?.sla_breach_rate ?? 0}%`} 
              subtitle={analytics?.summary ? `${analytics.summary.sla_breach_count} breached tickets` : "Needs attention"}  
              icon={Settings}  
              color="amber"   
              trend={(analytics?.summary?.sla_breach_count ?? 0) > 0 ? "down" : "up"} 
              trendValue={analytics?.summary ? `${analytics.summary.sla_breach_count} alerts` : undefined}  
              delay={140} 
            />
            <StatCard 
              title="KB Documents"   
              value={analyticsLoading ? "..." : String(analytics?.summary?.kb_docs_count ?? 0)}   
              subtitle={analytics?.summary ? `${analytics.summary.active_kb_docs_count} active in DB` : "Knowledge base"}          
              icon={Database}  
              color="cyan"                                  
              delay={210} 
            />
            <StatCard 
              title="Active Rules"   
              value={analyticsLoading ? "..." : String(analytics?.summary?.active_rules_count ?? 0)} 
              subtitle="Rule matrix rules"        
              icon={Settings}  
              color="violet"                                
              delay={280} 
            />
          </div>

          {/* Tab Nav & Live Sync Indicator */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
            <div className="no-scrollbar touch-scroll" style={{ display:'flex', gap:4, padding:4, background:'var(--nw-border)', borderRadius:13, border:'1px solid var(--nw-border)', width:'fit-content', maxWidth:'100%', overflowX:'auto', backdropFilter:'blur(8px)', WebkitOverflowScrolling:'touch' }}>
              {TABS.map(t => (
                <button key={t.k} onClick={() => setTab(t.k)} style={{
                  padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer',
                  fontSize:12.5, fontWeight:600, whiteSpace:'nowrap', flexShrink:0,
                  background: tab===t.k ? 'var(--nw-surface)' : 'transparent',
                  color: tab===t.k ? '#0F172A' : '#64748B',
                  boxShadow: tab===t.k ? '0 2px 10px rgba(11, 14, 20, 0.4)' : 'none',
                  transition:'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                  transform: tab===t.k ? 'none' : 'scale(0.97)',
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:'rgba(5,150,105,0.08)', border:'1px solid rgba(5,150,105,0.2)' }}>
                <span className="pulse-dot" style={{ width:6, height:6, borderRadius:'50%', background:'#059669' }}/>
                <span style={{ fontSize:11.5, fontWeight:600, color:'#059669' }}>Live MongoDB Atlas Sync</span>
              </div>
              <button 
                onClick={() => fetchAnalytics(true)}
                disabled={isRefreshing}
                title="Refresh Live Database Analytics"
                style={{ padding:'7px 12px', borderRadius:10, border:'1px solid var(--nw-border)', background: 'var(--nw-elevated)', color: 'var(--nw-text-muted)', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 2px 6px rgba(0,0,0,0.04)', transition:'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='#7C3AED'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--nw-border)'}
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} color={isRefreshing ? '#7C3AED' : '#64748B'}/>
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* ── ANALYTICS TAB (POWERED BY REAL MONGODB DATA) ── */}
          {tab === 'analytics' && (
            <div className="admin-analytics-grid" style={{ gap:16 }}>

              {/* Volume Area Chart (Live 7-Day Complaint Volume) */}
              <div className="animate-fade-up" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize:14, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:2 }}>Complaint Volume</h3>
                    <p style={{ fontSize:11, color: 'var(--nw-text-muted)', marginBottom:18 }}>Real-time 7-day intake from database</p>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'#7C3AED', background:'rgba(124,58,237,0.1)', padding:'2px 8px', borderRadius:6 }}>
                    {analytics?.summary?.total_tickets ?? 0} total
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={volumeData}>
                    <defs>
                      <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Area type="monotone" dataKey="v" name="tickets" stroke="#7C3AED" strokeWidth={2.5} fill="url(#gv)" dot={{ fill:'#7C3AED', r:4, strokeWidth:2, stroke:'white' }} activeDot={{ r:6, fill:'#7C3AED', stroke:'white', strokeWidth:2 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Dept Bar (Live Active Tickets by Department) */}
              <div className="animate-fade-up d100" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize:14, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:2 }}>Department Workload</h3>
                    <p style={{ fontSize:11, color: 'var(--nw-text-muted)', marginBottom:18 }}>Active tickets per department</p>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'#059669', background:'rgba(5,150,105,0.1)', padding:'2px 8px', borderRadius:6 }}>
                    {analytics?.summary?.open_tickets ?? 0} active
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={deptData} layout="vertical">
                    <XAxis type="number" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <YAxis dataKey="d" type="category" tick={{ fill:'#64748B', fontSize:11 }} axisLine={false} tickLine={false} width={90}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Bar dataKey="v" name="active tickets" fill="#7C3AED" radius={[0,7,7,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* AI Pie Chart (Live GenAI vs Python Match Rate) */}
              <div className="animate-fade-up d200" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <h3 style={{ fontSize:14, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:2 }}>AI Pipeline Accuracy</h3>
                <p style={{ fontSize:11, color: 'var(--nw-text-muted)', marginBottom:16 }}>GenAI vs Python Rule Engine match verification</p>
                <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={pieData} innerRadius={44} outerRadius={68} dataKey="v" paddingAngle={3} stroke="none">
                        {pieData.map((e,i) => <Cell key={i} fill={e.c}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1 }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', borderRadius:10, background:`${d.c}09`, border:`1px solid ${d.c}20`, transition:'transform 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.transform='translateX(3px)'}
                        onMouseLeave={e => e.currentTarget.style.transform='none'}
                      >
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:10, height:10, borderRadius:'50%', background:d.c, flexShrink:0, boxShadow:`0 2px 8px ${d.c}40` }}/>
                          <p style={{ fontSize:12, color: 'var(--nw-text-secondary)', fontWeight:600 }}>{d.name}</p>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontSize:15, fontWeight:800, color:d.c, fontFamily:'monospace' }}>{d.v}%</p>
                          {d.count !== undefined && <p style={{ fontSize:10, color: 'var(--nw-text-muted)' }}>{d.count} tickets</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SLA Risk Monitor (Live P0-P3 tickets from DB) */}
              <div className="animate-fade-up d300" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <h3 style={{ fontSize:14, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:2 }}>SLA Risk Monitor</h3>
                <p style={{ fontSize:11, color: 'var(--nw-text-muted)', marginBottom:20 }}>Active tickets by priority level</p>
                {slaData.map((item, i) => {
                  const maxCap = item.m || 10
                  const pct = Math.min(100, Math.round((item.v / maxCap) * 100))
                  return (
                    <div key={item.l} className="animate-fade-up" style={{ marginBottom:16, animationDelay:`${i*80}ms` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                        <span style={{ fontSize:12, color: 'var(--nw-text-muted)', fontWeight:500 }}>{item.l}</span>
                        <span style={{ fontSize:14, fontWeight:800, color:item.c, fontFamily:'monospace' }}>{item.v}</span>
                      </div>
                      <div style={{ height:6, borderRadius:99, background:'var(--nw-border)', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:99, background:`linear-gradient(90deg,${item.c},${item.c}80)`, width:`${pct}%`, transition:'width 0.8s cubic-bezier(0.22,1,0.36,1)', boxShadow:`0 0 10px ${item.c}40` }}/>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Weekly Open vs Resolved (Live Throughput from DB) */}
              <div className="animate-fade-up d400" style={{ ...glass(), padding:22, gridColumn:'1/-1', transition:'all 0.2s' }} {...hoverLift}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10, marginBottom:18 }}>
                  <div>
                    <h3 style={{ fontSize:14, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:2 }}>Open vs Resolved — Weekly Trend</h3>
                    <p style={{ fontSize:11, color: 'var(--nw-text-muted)' }}>Complaint resolution throughput calculated from MongoDB</p>
                  </div>
                  <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:'#E11D48' }}/>
                      <span style={{ fontSize:12, color: 'var(--nw-text-muted)', fontWeight:500 }}>Open</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:'#059669' }}/>
                      <span style={{ fontSize:12, color: 'var(--nw-text-muted)', fontWeight:500 }}>Resolved</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="go" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#E11D48" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#E11D48" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#059669" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Area type="monotone" dataKey="open"     name="Open"     stroke="#E11D48" strokeWidth={2} fill="url(#go)" dot={false}/>
                    <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#059669" strokeWidth={2} fill="url(#gr)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── KNOWLEDGE BASE TAB (FETCHED FROM /api/policies) ── */}
          {tab === 'kb' && (
            <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ ...glass(), padding:22 }}>
                <h3 style={{ fontSize:14, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:14 }}>Upload Policy Documents</h3>
                <div
                  onDragOver={e => { e.preventDefault(); setDrag(true) }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); setUploads(p => [...p, ...Array.from(e.dataTransfer.files)]) }}
                  onClick={() => document.getElementById('kb-fi').click()}
                  style={{ padding:38, textAlign:'center', borderRadius:14, cursor:'pointer', border:drag?'2px dashed #7C3AED':'2px dashed rgba(124,58,237,0.28)', background:drag?'rgba(124,58,237,0.05)':'var(--nw-elevated)', transition:'all 0.25s' }}
                >
                  <Upload size={28} color="#7C3AED" style={{ margin:'0 auto 12px', display:'block' }}/>
                  <p style={{ fontSize:13, color: 'var(--nw-text-muted)', marginBottom:3 }}>Drop PDF / DOCX or <span style={{ color:'#7C3AED', fontWeight:600 }}>browse</span></p>
                  <p style={{ fontSize:11, color: 'var(--nw-text-muted)' }}>Files are parsed, chunked and embedded into MongoDB Atlas Knowledge Base</p>
                  <input id="kb-fi" type="file" multiple accept=".pdf,.docx" style={{ display:'none' }} onChange={e => setUploads(p => [...p, ...Array.from(e.target.files)])}/>
                </div>
                {uploads.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    {uploads.map((f,i) => (
                      <div key={i} className="animate-fade-up" style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 13px', marginTop:7, borderRadius:10, background:'rgba(5,150,105,0.06)', border:'1px solid rgba(5,150,105,0.18)' }}>
                        <FileText size={14} color="#059669"/>
                        <span style={{ flex:1, fontSize:12, color: 'var(--nw-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                        <RefreshCw size={12} color="#059669" className="animate-spin"/>
                        <span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>Processing…</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ ...glass(), padding:22 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                  <div>
                    <h3 style={{ fontSize:14, fontWeight:700, color: 'var(--nw-text-primary)' }}>Active Knowledge Base Documents</h3>
                    <p style={{ fontSize:11, color: 'var(--nw-text-muted)', marginTop:2 }}>{kbDocs.length} policy documents registered in database</p>
                  </div>
                  <Link href="/admin/policies" style={{ fontSize:12, fontWeight:600, color:'#7C3AED', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                    Manage in Policy Center <ArrowUpRight size={13}/>
                  </Link>
                </div>

                <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid var(--nw-border)' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
                    <thead>
                      <tr style={{ background:'var(--nw-elevated)' }}>
                        {['Doc ID','Document Name','Chunks','Version','Uploaded','Size','Status',''].map(h => (
                          <th key={h} style={{ padding:'11px 13px', textAlign:'left', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--nw-border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kbLoading ? (
                        <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color: 'var(--nw-text-muted)', fontSize:12 }}>Loading documents from database...</td></tr>
                      ) : kbDocs.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color: 'var(--nw-text-muted)', fontSize:12 }}>No KB documents found. Upload above to create.</td></tr>
                      ) : kbDocs.map((d,i) => (
                        <tr key={d.id} className="animate-fade-up" style={{ animationDelay:`${i*50}ms`, transition:'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.025)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        >
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)', fontFamily:'monospace', fontSize:11, color:'#7C3AED', fontWeight:600 }}>{d.id}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <FileText size={13} color="#7C3AED"/>
                              <span style={{ fontSize:13, color: 'var(--nw-text-primary)', fontWeight:500 }}>{d.name}</span>
                            </div>
                          </td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)', fontFamily:'monospace', color:'#0891B2', fontSize:14, fontWeight:700 }}>{d.chunks}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                            <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:600, padding:'2px 8px', borderRadius:6, background:'rgba(79,70,229,0.1)', color:'#4F46E5' }}>{d.ver}</span>
                          </td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)', fontSize:11, color: 'var(--nw-text-muted)' }}>{d.date}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)', fontSize:11, color: 'var(--nw-text-muted)' }}>{d.size}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                            <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:d.status==='Active'?'#ECFDF5':'#F8FAFC', color:d.status==='Active'?'#059669':'#64748B', border:`1px solid ${d.status==='Active'?'rgba(5,150,105,0.25)':'rgba(100,116,139,0.2)'}` }}>
                              {d.status==='Active' && <span className="pulse-dot" style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:'#059669', marginRight:5, verticalAlign:'middle' }}/>}
                              {d.status}
                            </span>
                          </td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                            <Link href="/admin/policies" style={{ padding:'5px 11px', borderRadius:8, border:'1px solid rgba(124,58,237,0.2)', background:'rgba(124,58,237,0.07)', color:'#7C3AED', fontSize:11, cursor:'pointer', fontWeight:600, textDecoration:'none', display:'inline-block' }}>
                              Inspect
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RULE MATRIX TAB (FETCHED FROM REAL MONGODB) ── */}
          {tab === 'rules' && (
            <div className="animate-fade-in" style={{ ...glass(), padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:700, color: 'var(--nw-text-primary)' }}>Complaint Resolution Rule Matrix</h3>
                  <p style={{ fontSize:11, color: 'var(--nw-text-muted)', marginTop:2 }}>{rules.length} active rules synchronized from database</p>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 13px', borderRadius:10, border:'1.5px solid var(--nw-border)', background:'var(--nw-elevated)' }}>
                    <Search size={13} color="#94A3B8"/>
                    <input value={ruleQ} onChange={e => setRuleQ(e.target.value)} placeholder="Search rules…"
                      style={{ background:'none', border:'none', outline:'none', color: 'var(--nw-text-primary)', fontSize:13, width:140 }}/>
                  </div>
                  <button onClick={() => setShowAddRule(!showAddRule)} style={{ padding:'9px 16px', borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'white', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(124,58,237,0.25)', transition:'all 0.2s' }}>
                    <Plus size={14}/> {showAddRule ? 'Close' : 'Add Rule'}
                  </button>
                </div>
              </div>

              {/* Inline Add Rule Form */}
              {showAddRule && (
                <div className="animate-scale-in" style={{ padding:20, borderRadius:13, background:'linear-gradient(135deg,rgba(124,58,237,0.06),var(--nw-elevated))', border:'1px solid rgba(124,58,237,0.2)', marginBottom:20 }}>
                  <h4 style={{ fontSize:13, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:14 }}>➕ Add New Rule to Matrix</h4>
                  <div className="responsive-form-2col" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:14 }}>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>Rule ID *</label>
                      <input placeholder="e.g. DEL-POL-08" value={newRuleForm.rule_id} onChange={e => setNewRuleForm({...newRuleForm, rule_id:e.target.value})} style={inp}/>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>Category *</label>
                      <select value={newRuleForm.category} onChange={e => setNewRuleForm({...newRuleForm, category:e.target.value})} style={sel}>
                        {CATS_L.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>Department *</label>
                      <select value={newRuleForm.department} onChange={e => setNewRuleForm({...newRuleForm, department:e.target.value})} style={sel}>
                        {DEPTS_L.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>Condition / Trigger *</label>
                      <input placeholder="e.g. Package delay > 72h" value={newRuleForm.condition} onChange={e => setNewRuleForm({...newRuleForm, condition:e.target.value})} style={inp}/>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>Mandatory Action</label>
                      <input placeholder="e.g. Escalate within 2h, Issue tracking update" value={newRuleForm.mandatory_actions} onChange={e => setNewRuleForm({...newRuleForm, mandatory_actions:e.target.value})} style={inp}/>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', marginBottom:5 }}>Prohibited Action</label>
                      <input placeholder="e.g. Promise date without carrier scan" value={newRuleForm.prohibited_actions} onChange={e => setNewRuleForm({...newRuleForm, prohibited_actions:e.target.value})} style={inp}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={handleCreateRule} disabled={ruleSubmitting} style={{ padding:'9px 18px', borderRadius:10, background:'linear-gradient(135deg,#059669,#047857)', color:'white', border:'none', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      {ruleSubmitting ? 'Saving...' : 'Save Rule to DB'}
                    </button>
                    <button onClick={() => setShowAddRule(false)} style={{ padding:'9px 15px', borderRadius:10, border:'1.5px solid var(--nw-border)', background:'transparent', color: 'var(--nw-text-muted)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid var(--nw-border)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
                  <thead>
                    <tr style={{ background:'var(--nw-elevated)' }}>
                      {['Rule ID','Category','Condition','Department','Mandatory Action','Prohibited Action','Actions'].map(h => (
                        <th key={h} style={{ padding:'11px 13px', textAlign:'left', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--nw-border)', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rulesLoading ? (
                      <tr><td colSpan={7} style={{ padding:20, textAlign:'center', color: 'var(--nw-text-muted)', fontSize:12 }}>Loading rule matrix from database...</td></tr>
                    ) : filteredRules.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding:20, textAlign:'center', color: 'var(--nw-text-muted)', fontSize:12 }}>No matching rules found in database.</td></tr>
                    ) : filteredRules.map((r,i) => (
                      <tr key={r.id} className="animate-fade-up" style={{ animationDelay:`${i*50}ms`, transition:'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.025)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                      >
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)', fontFamily:'monospace', fontSize:11, color:'#7C3AED', fontWeight:700 }}>{r.id}</td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                          <span style={{ fontSize:11, color: 'var(--nw-text-muted)', background:'var(--nw-elevated)', padding:'3px 9px', borderRadius:7, border:'1px solid var(--nw-border)', fontWeight:500 }}>{r.cat}</span>
                        </td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)', fontSize:12, color: 'var(--nw-text-secondary)', maxWidth:170 }}>{r.cond}</td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)', fontSize:12, color: 'var(--nw-text-muted)' }}>{r.dept}</td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                            <CheckCircle size={12} color="#059669" style={{ marginTop:1, flexShrink:0 }}/>
                            <span style={{ fontSize:11, color: 'var(--nw-text-secondary)' }}>{r.must}</span>
                          </div>
                        </td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                            <XCircle size={12} color="#E11D48" style={{ marginTop:1, flexShrink:0 }}/>
                            <span style={{ fontSize:11, color: 'var(--nw-text-secondary)' }}>{r.no}</span>
                          </div>
                        </td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid var(--nw-border)' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => handleDeleteRule(r.id)} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid rgba(225,29,72,0.2)', background:'rgba(225,29,72,0.06)', color:'#E11D48', fontSize:11, cursor:'pointer', fontWeight:600, transition:'all 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background='rgba(225,29,72,0.12)'}
                              onMouseLeave={e => e.currentTarget.style.background='rgba(225,29,72,0.06)'}
                            >Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:14, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                <p style={{ fontSize:11, color: 'var(--nw-text-muted)' }}>Showing {filteredRules.length} of {rules.length} live rules</p>
              </div>
            </div>
          )}

          {/* ── STAFF MANAGEMENT (FETCHED FROM REAL MONGODB) ── */}
          {tab === 'staff' && (
            <div className="animate-fade-in" style={{ ...glass(), padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:700, color: 'var(--nw-text-primary)' }}>Staff Management</h3>
                  <p style={{ fontSize:11, color: 'var(--nw-text-muted)', marginTop:2 }}>{staff.length} staff members fetched directly from database</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} style={{ padding:'10px 18px', borderRadius:11, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'white', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 16px rgba(124,58,237,0.28)', transition:'all 0.2s' }}>
                  <Plus size={14}/> Add Staff Member
                </button>
              </div>

              {apiSuccessMsg && (
                <div className="animate-fade-in" style={{ padding:'10px 14px', borderRadius:10, background:'rgba(5,150,105,0.08)', border:'1px solid rgba(5,150,105,0.25)', color:'#059669', fontSize:12, fontWeight:600, marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>{apiSuccessMsg}</span>
                  <button onClick={() => setApiSuccess('')} style={{ background:'none', border:'none', color:'#059669', cursor:'pointer' }}><X size={14}/></button>
                </div>
              )}

              {showAdd && (
                <div className="animate-scale-in" style={{ padding:20, borderRadius:13, background:'linear-gradient(135deg,rgba(124,58,237,0.06),var(--nw-elevated))', border:'1px solid rgba(124,58,237,0.2)', marginBottom:20 }}>
                  <h4 style={{ fontSize:13, fontWeight:700, color: 'var(--nw-text-primary)', marginBottom:16 }}>➕ New Staff Member</h4>
                  <div className="responsive-form-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13, marginBottom:14 }}>
                    {[['Full Name *','name','text','e.g. Ali Hassan'],['Email *','email','email','ali@company.com']].map(([l,k,t,ph]) => (
                      <div key={k}>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{l}</label>
                        <input type={t} value={newForm[k]} onChange={e => setNewForm({...newForm,[k]:e.target.value})} placeholder={ph} style={inp}/>
                      </div>
                    ))}
                    {[['Role *','role',ROLES_L],['Department *','dept',DEPTS_L]].map(([l,k,opts]) => (
                      <div key={k}>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{l}</label>
                        <select value={newForm[k]} onChange={e => setNewForm({...newForm,[k]:e.target.value})} style={sel}>
                          {k==='dept'&&<option value="">Select department…</option>}
                          {opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <button onClick={addStaff} style={{ padding:'10px 20px', borderRadius:10, background:'linear-gradient(135deg,#059669,#047857)', color:'white', border:'none', fontSize:13, fontWeight:700, cursor:'pointer' }}>Create Member</button>
                    <button onClick={() => setShowAdd(false)} style={{ padding:'10px 16px', borderRadius:10, border:'1.5px solid var(--nw-border)', background:'transparent', color: 'var(--nw-text-muted)', fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="touch-scroll" style={{ overflowX:'auto', borderRadius:12, border:'1px solid var(--nw-border)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
                  <thead>
                    <tr style={{ background:'var(--nw-elevated)' }}>
                      {['Name','Role','Department','Email','Status'].map(h => (
                        <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:700, color: 'var(--nw-text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--nw-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffLoading ? (
                      <tr><td colSpan={5} style={{ padding:20, textAlign:'center', color: 'var(--nw-text-muted)', fontSize:12 }}>Loading staff from database...</td></tr>
                    ) : staff.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding:20, textAlign:'center', color: 'var(--nw-text-muted)', fontSize:12 }}>No staff registered. Add above to create.</td></tr>
                    ) : staff.map((m, i) => {
                      const rc = ROLE_COLORS[m.role] || '#64748B'
                      return (
                        <tr key={m.id || i} className="animate-fade-up" style={{ animationDelay:`${i*40}ms`, transition:'background 0.15s' }}>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid var(--nw-border)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                              <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${rc},${rc}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0, boxShadow:`0 3px 10px ${rc}35` }}>
                                {m.name?.charAt(0) || 'U'}
                              </div>
                              <span style={{ fontSize:13, fontWeight:600, color: 'var(--nw-text-primary)' }}>{m.name}</span>
                            </div>
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid var(--nw-border)' }}>
                            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:7, background:`${rc}14`, color:rc, border:`1px solid ${rc}28` }}>{m.role}</span>
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid var(--nw-border)', fontSize:12, color: 'var(--nw-text-muted)' }}>
                            {m.dept}
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid var(--nw-border)', fontSize:12, color: 'var(--nw-text-muted)' }}>{m.email}</td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid var(--nw-border)' }}>
                            <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:m.status==='Active'?'#ECFDF5':'#F8FAFC', color:m.status==='Active'?'#059669':'#64748B', border:`1px solid ${m.status==='Active'?'rgba(5,150,105,0.25)':'rgba(100,116,139,0.2)'}`, display:'inline-flex', alignItems:'center', gap:5 }}>
                              {m.status==='Active' && <span className="pulse-dot" style={{ width:5, height:5, borderRadius:'50%', background:'#059669' }}/>}
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
