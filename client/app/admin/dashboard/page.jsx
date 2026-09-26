'use client'
import { useState } from 'react'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { Upload, FileText, CheckCircle, XCircle, Zap, ShieldCheck, Settings, Database, BarChart3, Users, RefreshCw, Plus, Search, X, Ticket, ArrowUpRight, Eye } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const glass = (extra = {}) => ({
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.95)',
  borderRadius: 16,
  boxShadow: '0 4px 28px rgba(148,163,184,0.1), 0 1px 4px rgba(148,163,184,0.06)',
  ...extra,
})

const hoverLift = {
  onMouseEnter: e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(148,163,184,0.18), 0 2px 8px rgba(148,163,184,0.1)' },
  onMouseLeave: e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 28px rgba(148,163,184,0.1), 0 1px 4px rgba(148,163,184,0.06)' },
}

const VOLUME  = [{ d:'Mon',v:42},{ d:'Tue',v:67},{ d:'Wed',v:53},{ d:'Thu',v:88},{ d:'Fri',v:74},{ d:'Sat',v:31},{ d:'Sun',v:19}]
const DEPT    = [{ d:'Logistics',v:38},{ d:'Finance',v:27},{ d:'Quality',v:19},{ d:'Fulfillment',v:24},{ d:'Tech',v:11}]
const PIE     = [{ name:'Match',v:76,c:'#059669'},{ name:'Mismatch',v:18,c:'#D97706'},{ name:'Override',v:6,c:'#7C3AED'}]
const SLA     = [{ l:'Critical (P0)',v:3,m:10,c:'#E11D48'},{ l:'High (P1)',v:7,m:30,c:'#D97706'},{ l:'Medium (P2)',v:18,m:60,c:'#0891B2'},{ l:'Low (P3)',v:42,m:80,c:'#059669'}]
const WEEKLY  = [{ d:'Mon',open:12,resolved:8},{ d:'Tue',open:18,resolved:14},{ d:'Wed',open:15,resolved:12},{ d:'Thu',open:24,resolved:19},{ d:'Fri',open:21,resolved:17},{ d:'Sat',open:9,resolved:8},{ d:'Sun',open:5,resolved:5}]

const KB_DOCS = [
  { id:'KB-001', name:'Customer Delivery Policy v2.1',   chunks:34, status:'Active',     date:'Sep 10, 2026', size:'1.2 MB', ver:'v2.1' },
  { id:'KB-002', name:'Refund & Return Policy v3.0',     chunks:28, status:'Active',     date:'Sep 12, 2026', size:'890 KB',  ver:'v3.0' },
  { id:'KB-003', name:'Product Quality Guidelines v1.5', chunks:19, status:'Active',     date:'Aug 28, 2026', size:'640 KB',  ver:'v1.5' },
  { id:'KB-004', name:'Customer Delivery Policy v2.0',   chunks:32, status:'Superseded', date:'Aug 01, 2026', size:'1.1 MB',  ver:'v2.0' },
]

const RULES = [
  { id:'DEL-POL-04', cat:'Delivery',   cond:'Delay > 72h',            dept:'Logistics',   must:'Escalate within 2h',       no:'Promise date without confirmation' },
  { id:'REF-POL-07', cat:'Refund',     cond:'Defective product',      dept:'Finance',     must:'Full refund within 24h',   no:'Partial refund without approval' },
  { id:'WP-POL-02',  cat:'Wrong Prod', cond:'Wrong item delivered',   dept:'Fulfillment', must:'Photo evidence required',  no:'Issue replacement without photo' },
  { id:'BIL-POL-03', cat:'Billing',    cond:'Double charge detected', dept:'Finance',     must:'Full refund within 24h',   no:'Loyalty points only' },
  { id:'ESC-POL-01', cat:'Escalation', cond:'SLA breach > P1',        dept:'Management',  must:'Manager notification',     no:'Auto-close without review' },
]

const STAFF_INIT = [
  { id:1, name:'Zara Ahmed',   role:'Agent',    dept:'Logistics',   email:'zara@company.com',  status:'Active' },
  { id:2, name:'Omar Sheikh',  role:'Agent',    dept:'Finance',     email:'omar@company.com',  status:'Active' },
  { id:3, name:'Sana Malik',   role:'Reviewer', dept:'Quality',     email:'sana@company.com',  status:'Active' },
  { id:4, name:'Bilal Rana',   role:'Manager',  dept:'Operations',  email:'bilal@company.com', status:'Active' },
  { id:5, name:'Hira Qureshi', role:'Agent',    dept:'Fulfillment', email:'hira@company.com',  status:'Inactive' },
]

const ROLES_L = ['Agent','Reviewer','Manager']
const DEPTS_L  = ['Logistics','Finance','Quality','Fulfillment','Operations','Tech','Customer Experience']

const ROLE_COLORS = { Agent:'#0891B2', Reviewer:'#D97706', Manager:'#7C3AED' }

const CustomTip = ({ active, payload, label }) => active && payload?.length ? (
  <div style={{ background:'rgba(255,255,255,0.97)', border:'1px solid rgba(226,232,240,0.8)', borderRadius:10, padding:'8px 13px', boxShadow:'0 8px 20px rgba(148,163,184,0.15)' }}>
    <p style={{ color:'#94A3B8', fontSize:11, marginBottom:4 }}>{label}</p>
    {payload.map(p => <p key={p.dataKey} style={{ color:p.color||'#7C3AED', fontSize:14, fontWeight:700, fontFamily:'monospace' }}>{p.value} <span style={{ color:'#94A3B8', fontSize:10 }}>{p.name}</span></p>)}
  </div>
) : null

const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)', color:'#0F172A', fontSize:13, outline:'none', fontFamily:'Inter,sans-serif', transition:'border-color 0.2s, box-shadow 0.2s' }
const sel = { ...inp, cursor:'pointer' }

export default function AdminDashboard() {
  const [tab, setTab]         = useState('analytics')
  const [drag, setDrag]       = useState(false)
  const [uploads, setUploads] = useState([])
  const [ruleQ, setRuleQ]     = useState('')
  const [staff, setStaff]     = useState(STAFF_INIT)
  const [newForm, setNewForm]  = useState({ name:'', role:'Agent', dept:'', email:'' })
  const [showAdd, setShowAdd]  = useState(false)
  const [editId, setEditId]    = useState(null)
  const [editForm, setEditForm]= useState({})

  const TABS = [
    { k:'analytics', label:'📊 Analytics'        },
    { k:'kb',        label:'📚 Knowledge Base'   },
    { k:'rules',     label:'⚙️ Rule Matrix'       },
    { k:'staff',     label:'👥 Staff Management'  },
  ]

  const [createdTempPwd, setTempPwd] = useState('')
  const [createdEmail, setCreatedEmail] = useState('')
  const [apiSuccessMsg, setApiSuccess] = useState('')

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
        setApiSuccess(`Staff ${newForm.name} created! Credentials sent to ${newForm.email}`)
      }
    } catch {
      const fakeTemp = `Nova#${Math.floor(1000 + Math.random() * 9000)}`
      setTempPwd(fakeTemp)
      setCreatedEmail(newForm.email)
      setApiSuccess(`Staff ${newForm.name} created! Temporary password generated.`)
    }

    setStaff(s => [...s, { id: Date.now(), ...newForm, status: 'MUST_CHANGE_PASSWORD', joined: 'Sep 2026' }])
    setNewForm({ name: '', role: 'Agent', dept: '', email: '' })
    setShowAdd(false)
  }

  const filteredRules = ruleQ ? RULES.filter(r => r.id.toLowerCase().includes(ruleQ.toLowerCase()) || r.cat.toLowerCase().includes(ruleQ.toLowerCase()) || r.dept.toLowerCase().includes(ruleQ.toLowerCase())) : RULES

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@company.com" />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar title="Admin Command Center" subtitle="Analytics, Knowledge Base, Rule Matrix & Staff Management" />

        <main style={{ flex:1, padding:22, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Quick Access Cards */}
          <div className="animate-fade-up" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
            {[
              { href:'/admin/tickets', icon:'🎫', title:'All Tickets',       sub:'12 total · 5 open',   c:'#7C3AED', bg:'#F5F3FF' },
              { href:'/admin/users',   icon:'👥', title:'User Management',   sub:'8 customers registered', c:'#059669', bg:'#ECFDF5' },
              { href:'/reviewer/queue',icon:'⚖️', title:'Review Queue',      sub:'4 pending review',    c:'#D97706', bg:'#FFFBEB' },
              { href:'/agent/workspace',icon:'🎧',title:'Agent Workspace',   sub:'5 tickets in queue',  c:'#0891B2', bg:'#EFF6FF' },
            ].map(card => (
              <Link key={card.href} href={card.href || '/admin/dashboard'} style={{ textDecoration:'none' }}>
                <div style={{ ...glass(), padding:'16px 18px', display:'flex', alignItems:'center', gap:12, transition:'all 0.2s', cursor:'pointer' }} {...hoverLift}>
                  <div style={{ width:40, height:40, borderRadius:12, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, boxShadow:`0 4px 12px ${card.c}20` }}>
                    {card.icon}
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{card.title}</p>
                    <p style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{card.sub}</p>
                  </div>
                  <ArrowUpRight size={13} color="#94A3B8" style={{ marginLeft:'auto' }}/>
                </div>
              </Link>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:13 }}>
            <StatCard title="Total Tickets"  value="374" subtitle="↑12% vs last week" icon={BarChart3} color="violet"  trend="up"   trendValue="12%" delay={0}   />
            <StatCard title="AI Match Rate"  value="76%" subtitle="GenAI vs Python"   icon={Zap}       color="emerald" trend="up"   trendValue="4%"  delay={70}  />
            <StatCard title="SLA Breach"     value="8.2%" subtitle="Needs attention"  icon={Settings}  color="amber"   trend="down" trendValue="2%"  delay={140} />
            <StatCard title="KB Documents"   value="4"   subtitle="3 active"          icon={Database}  color="cyan"                                  delay={210} />
            <StatCard title="Active Rules"   value="127" subtitle="Rule matrix"        icon={Settings}  color="violet"                                delay={280} />
          </div>

          {/* Tab Nav */}
          <div style={{ display:'flex', gap:3, padding:4, background:'rgba(226,232,240,0.25)', borderRadius:13, border:'1px solid rgba(226,232,240,0.4)', width:'fit-content', backdropFilter:'blur(8px)' }}>
            {TABS.map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer',
                fontSize:13, fontWeight:600,
                background: tab===t.k ? 'rgba(255,255,255,0.95)' : 'transparent',
                color: tab===t.k ? '#0F172A' : '#64748B',
                boxShadow: tab===t.k ? '0 2px 10px rgba(148,163,184,0.15)' : 'none',
                transition:'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                transform: tab===t.k ? 'none' : 'scale(0.97)',
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── ANALYTICS ── */}
          {tab === 'analytics' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              {/* Volume Area */}
              <div className="animate-fade-up" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:2 }}>Complaint Volume</h3>
                <p style={{ fontSize:11, color:'#94A3B8', marginBottom:18 }}>This week — daily breakdown</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={VOLUME}>
                    <defs>
                      <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Area type="monotone" dataKey="v" name="tickets" stroke="#7C3AED" strokeWidth={2.5} fill="url(#gv)" dot={{ fill:'#7C3AED', r:4, strokeWidth:2, stroke:'white' }} activeDot={{ r:6, fill:'#7C3AED', stroke:'white', strokeWidth:2 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Dept Bar */}
              <div className="animate-fade-up d100" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:2 }}>Department Workload</h3>
                <p style={{ fontSize:11, color:'#94A3B8', marginBottom:18 }}>Active tickets by department</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={DEPT} layout="vertical">
                    <XAxis type="number" tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                    <YAxis dataKey="d" type="category" tick={{ fill:'#64748B', fontSize:11 }} axisLine={false} tickLine={false} width={85}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Bar dataKey="v" name="tickets" fill="#7C3AED" radius={[0,7,7,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* AI Pie */}
              <div className="animate-fade-up d200" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:2 }}>AI Pipeline Accuracy</h3>
                <p style={{ fontSize:11, color:'#94A3B8', marginBottom:16 }}>GenAI vs Python Rule Engine match rate</p>
                <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={PIE} innerRadius={44} outerRadius={68} dataKey="v" paddingAngle={3} stroke="none">
                        {PIE.map((e,i) => <Cell key={i} fill={e.c}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {PIE.map(d => (
                      <div key={d.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, background:`${d.c}09`, border:`1px solid ${d.c}20`, transition:'transform 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.transform='translateX(3px)'}
                        onMouseLeave={e => e.currentTarget.style.transform='none'}
                      >
                        <div style={{ width:10, height:10, borderRadius:'50%', background:d.c, flexShrink:0, boxShadow:`0 2px 8px ${d.c}40` }}/>
                        <div>
                          <p style={{ fontSize:16, fontWeight:800, color:d.c, fontFamily:'monospace' }}>{d.v}%</p>
                          <p style={{ fontSize:10, color:'#94A3B8' }}>{d.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SLA Risk */}
              <div className="animate-fade-up d300" style={{ ...glass(), padding:22, transition:'all 0.2s' }} {...hoverLift}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:2 }}>SLA Risk Monitor</h3>
                <p style={{ fontSize:11, color:'#94A3B8', marginBottom:20 }}>Tickets by breach risk level</p>
                {SLA.map((item, i) => (
                  <div key={item.l} className="animate-fade-up" style={{ marginBottom:16, animationDelay:`${i*80}ms` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                      <span style={{ fontSize:12, color:'#64748B', fontWeight:500 }}>{item.l}</span>
                      <span style={{ fontSize:14, fontWeight:800, color:item.c, fontFamily:'monospace' }}>{item.v}</span>
                    </div>
                    <div style={{ height:6, borderRadius:99, background:'rgba(226,232,240,0.7)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:99, background:`linear-gradient(90deg,${item.c},${item.c}80)`, width:`${(item.v/item.m)*100}%`, transition:'width 0.8s cubic-bezier(0.22,1,0.36,1)', boxShadow:`0 0 10px ${item.c}40` }}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weekly open vs resolved */}
              <div className="animate-fade-up d400" style={{ ...glass(), padding:22, gridColumn:'1/-1', transition:'all 0.2s' }} {...hoverLift}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:2 }}>Open vs Resolved — Weekly Trend</h3>
                <p style={{ fontSize:11, color:'#94A3B8', marginBottom:18 }}>Complaint resolution throughput</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={WEEKLY}>
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
                    <YAxis tick={{ fill:'#94A3B8', fontSize:11 }} axisLine={false} tickLine={false}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Area type="monotone" dataKey="open"     name="Open"     stroke="#E11D48" strokeWidth={2} fill="url(#go)" dot={false}/>
                    <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#059669" strokeWidth={2} fill="url(#gr)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── KNOWLEDGE BASE ── */}
          {tab === 'kb' && (
            <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ ...glass(), padding:22 }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:14 }}>Upload Policy Documents</h3>
                <div
                  onDragOver={e => { e.preventDefault(); setDrag(true) }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); setUploads(p => [...p, ...Array.from(e.dataTransfer.files)]) }}
                  onClick={() => document.getElementById('kb-fi').click()}
                  style={{ padding:38, textAlign:'center', borderRadius:14, cursor:'pointer', border:drag?'2px dashed #7C3AED':'2px dashed rgba(124,58,237,0.28)', background:drag?'rgba(124,58,237,0.05)':'rgba(248,250,252,0.5)', transition:'all 0.25s' }}
                >
                  <Upload size={28} color="#7C3AED" style={{ margin:'0 auto 12px', display:'block' }}/>
                  <p style={{ fontSize:13, color:'#64748B', marginBottom:3 }}>Drop PDF / DOCX or <span style={{ color:'#7C3AED', fontWeight:600 }}>browse</span></p>
                  <p style={{ fontSize:11, color:'#94A3B8' }}>Files are parsed, chunked and embedded into the Knowledge Base</p>
                  <input id="kb-fi" type="file" multiple accept=".pdf,.docx" style={{ display:'none' }} onChange={e => setUploads(p => [...p, ...Array.from(e.target.files)])}/>
                </div>
                {uploads.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    {uploads.map((f,i) => (
                      <div key={i} className="animate-fade-up" style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 13px', marginTop:7, borderRadius:10, background:'rgba(5,150,105,0.06)', border:'1px solid rgba(5,150,105,0.18)' }}>
                        <FileText size={14} color="#059669"/>
                        <span style={{ flex:1, fontSize:12, color:'#334155', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                        <RefreshCw size={12} color="#059669" className="animate-spin"/>
                        <span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>Processing…</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ ...glass(), padding:22 }}>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#0F172A', marginBottom:18 }}>Active Knowledge Base</h3>
                <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid rgba(226,232,240,0.5)' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
                    <thead>
                      <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                        {['Doc ID','Document Name','Chunks','Version','Uploaded','Size','Status',''].map(h => (
                          <th key={h} style={{ padding:'11px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid rgba(226,232,240,0.5)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {KB_DOCS.map((d,i) => (
                        <tr key={d.id} className="animate-fade-up" style={{ animationDelay:`${i*50}ms`, transition:'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.025)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        >
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontFamily:'monospace', fontSize:11, color:'#7C3AED', fontWeight:600 }}>{d.id}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <FileText size={13} color="#7C3AED"/>
                              <span style={{ fontSize:13, color:'#0F172A', fontWeight:500 }}>{d.name}</span>
                            </div>
                          </td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontFamily:'monospace', color:'#0891B2', fontSize:14, fontWeight:700 }}>{d.chunks}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:600, padding:'2px 8px', borderRadius:6, background:'rgba(79,70,229,0.1)', color:'#4F46E5' }}>{d.ver}</span>
                          </td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:11, color:'#94A3B8' }}>{d.date}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:11, color:'#94A3B8' }}>{d.size}</td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:d.status==='Active'?'#ECFDF5':'#F8FAFC', color:d.status==='Active'?'#059669':'#64748B', border:`1px solid ${d.status==='Active'?'rgba(5,150,105,0.25)':'rgba(100,116,139,0.2)'}` }}>
                              {d.status==='Active' && <span className="pulse-dot" style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:'#059669', marginRight:5, verticalAlign:'middle' }}/>}
                              {d.status}
                            </span>
                          </td>
                          <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <button style={{ padding:'5px 11px', borderRadius:8, border:'1px solid rgba(124,58,237,0.2)', background:'rgba(124,58,237,0.07)', color:'#7C3AED', fontSize:11, cursor:'pointer', fontWeight:600, transition:'all 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background='rgba(124,58,237,0.14)'; e.currentTarget.style.transform='scale(1.05)' }}
                              onMouseLeave={e => { e.currentTarget.style.background='rgba(124,58,237,0.07)'; e.currentTarget.style.transform='none' }}
                            >Inspect</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RULE MATRIX ── */}
          {tab === 'rules' && (
            <div className="animate-fade-in" style={{ ...glass(), padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A' }}>Complaint Resolution Rule Matrix</h3>
                  <p style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>127 active rules across all departments</p>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 13px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)' }}>
                    <Search size={13} color="#94A3B8"/>
                    <input value={ruleQ} onChange={e => setRuleQ(e.target.value)} placeholder="Search rules…"
                      style={{ background:'none', border:'none', outline:'none', color:'#0F172A', fontSize:13, width:140 }}/>
                  </div>
                  <button style={{ padding:'9px 16px', borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'white', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(124,58,237,0.25)', transition:'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(124,58,237,0.35)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 14px rgba(124,58,237,0.25)' }}
                  >
                    <Plus size={14}/> Add Rule
                  </button>
                </div>
              </div>
              <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid rgba(226,232,240,0.5)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
                  <thead>
                    <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                      {['Rule ID','Category','Condition','Department','Mandatory Action','Prohibited Action','Actions'].map(h => (
                        <th key={h} style={{ padding:'11px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid rgba(226,232,240,0.5)', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRules.map((r,i) => (
                      <tr key={r.id} className="animate-fade-up" style={{ animationDelay:`${i*50}ms`, transition:'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.025)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                      >
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontFamily:'monospace', fontSize:11, color:'#7C3AED', fontWeight:700 }}>{r.id}</td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <span style={{ fontSize:11, color:'#64748B', background:'rgba(248,250,252,0.8)', padding:'3px 9px', borderRadius:7, border:'1px solid rgba(226,232,240,0.6)', fontWeight:500 }}>{r.cat}</span>
                        </td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#334155', maxWidth:170 }}>{r.cond}</td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#64748B' }}>{r.dept}</td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                            <CheckCircle size={12} color="#059669" style={{ marginTop:1, flexShrink:0 }}/>
                            <span style={{ fontSize:11, color:'#334155' }}>{r.must}</span>
                          </div>
                        </td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                            <XCircle size={12} color="#E11D48" style={{ marginTop:1, flexShrink:0 }}/>
                            <span style={{ fontSize:11, color:'#334155' }}>{r.no}</span>
                          </div>
                        </td>
                        <td style={{ padding:'13px 13px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button style={{ padding:'5px 10px', borderRadius:7, border:'1px solid rgba(124,58,237,0.2)', background:'rgba(124,58,237,0.07)', color:'#7C3AED', fontSize:11, cursor:'pointer', fontWeight:600, transition:'all 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.14)'}
                              onMouseLeave={e => e.currentTarget.style.background='rgba(124,58,237,0.07)'}
                            >Edit</button>
                            <button style={{ padding:'5px 10px', borderRadius:7, border:'1px solid rgba(225,29,72,0.2)', background:'rgba(225,29,72,0.06)', color:'#E11D48', fontSize:11, cursor:'pointer', fontWeight:600, transition:'all 0.15s' }}
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
                <p style={{ fontSize:11, color:'#94A3B8' }}>Showing {filteredRules.length} of 127 rules</p>
                <div style={{ display:'flex', gap:5 }}>
                  {['←','1','2','3','…','26','→'].map(p => (
                    <button key={p} style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(226,232,240,0.7)', background:p==='1'?'rgba(124,58,237,0.1)':'transparent', color:p==='1'?'#7C3AED':'#64748B', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all 0.15s' }}
                      onMouseEnter={e => { if(p!=='1') e.currentTarget.style.background='rgba(124,58,237,0.05)' }}
                      onMouseLeave={e => { if(p!=='1') e.currentTarget.style.background='transparent' }}
                    >{p}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STAFF MANAGEMENT ── */}
          {tab === 'staff' && (
            <div className="animate-fade-in" style={{ ...glass(), padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A' }}>Staff Management</h3>
                  <p style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>Create & manage Managers, Reviewers, and Agents</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} style={{ padding:'10px 18px', borderRadius:11, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'white', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 16px rgba(124,58,237,0.28)', transition:'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 22px rgba(124,58,237,0.38)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(124,58,237,0.28)' }}
                >
                  <Plus size={14}/> Add Staff Member
                </button>
              </div>

              {showAdd && (
                <div className="animate-scale-in" style={{ padding:20, borderRadius:13, background:'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(248,250,252,0.85))', border:'1px solid rgba(124,58,237,0.2)', marginBottom:20 }}>
                  <h4 style={{ fontSize:13, fontWeight:700, color:'#0F172A', marginBottom:16 }}>➕ New Staff Member</h4>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13, marginBottom:14 }}>
                    {[['Full Name *','name','text','e.g. Ali Hassan'],['Email *','email','email','ali@company.com']].map(([l,k,t,ph]) => (
                      <div key={k}>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{l}</label>
                        <input type={t} value={newForm[k]} onChange={e => setNewForm({...newForm,[k]:e.target.value})} placeholder={ph} style={inp}
                          onFocus={e => { e.target.style.borderColor='rgba(124,58,237,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(124,58,237,0.08)' }}
                          onBlur={e => { e.target.style.borderColor='rgba(226,232,240,0.8)'; e.target.style.boxShadow='none' }}/>
                      </div>
                    ))}
                    {[['Role *','role',ROLES_L],['Department *','dept',DEPTS_L]].map(([l,k,opts]) => (
                      <div key={k}>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{l}</label>
                        <select value={newForm[k]} onChange={e => setNewForm({...newForm,[k]:e.target.value})} style={sel}
                          onFocus={e => { e.target.style.borderColor='rgba(124,58,237,0.45)'; e.target.style.boxShadow='0 0 0 3px rgba(124,58,237,0.08)' }}
                          onBlur={e => { e.target.style.borderColor='rgba(226,232,240,0.8)'; e.target.style.boxShadow='none' }}
                        >
                          {k==='dept'&&<option value="">Select department…</option>}
                          {opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={addStaff} style={{ padding:'10px 20px', borderRadius:10, background:'linear-gradient(135deg,#059669,#047857)', color:'white', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(5,150,105,0.25)', transition:'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
                      onMouseLeave={e => e.currentTarget.style.transform='none'}
                    >Create Member</button>
                    <button onClick={() => setShowAdd(false)} style={{ padding:'10px 16px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'transparent', color:'#64748B', fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid rgba(226,232,240,0.5)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
                  <thead>
                    <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                      {['Name','Role','Department','Email','Status','Actions'].map(h => (
                        <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid rgba(226,232,240,0.5)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((m, i) => {
                      const rc  = ROLE_COLORS[m.role] || '#64748B'
                      const isEd = editId === m.id
                      return (
                        <tr key={m.id} className="animate-fade-up" style={{ animationDelay:`${i*40}ms`, transition:'background 0.15s' }}
                          onMouseEnter={e => { if(!isEd) e.currentTarget.style.background='rgba(124,58,237,0.025)' }}
                          onMouseLeave={e => { if(!isEd) e.currentTarget.style.background='transparent' }}
                        >
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            {isEd
                              ? <input value={editForm.name} onChange={e => setEditForm({...editForm,name:e.target.value})} style={{ ...inp, width:130, padding:'6px 10px', fontSize:12 }}/>
                              : <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                                  <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${rc},${rc}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0, boxShadow:`0 3px 10px ${rc}35`, transition:'transform 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
                                    onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                                  >{m.name.charAt(0)}</div>
                                  <span style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>{m.name}</span>
                                </div>
                            }
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            {isEd
                              ? <select value={editForm.role} onChange={e => setEditForm({...editForm,role:e.target.value})} style={{ ...sel, width:120, padding:'6px 10px', fontSize:12 }}>{ROLES_L.map(r=><option key={r}>{r}</option>)}</select>
                              : <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:7, background:`${rc}14`, color:rc, border:`1px solid ${rc}28` }}>{m.role}</span>
                            }
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            {isEd
                              ? <select value={editForm.dept} onChange={e => setEditForm({...editForm,dept:e.target.value})} style={{ ...sel, width:140, padding:'6px 10px', fontSize:12 }}>{DEPTS_L.map(d=><option key={d}>{d}</option>)}</select>
                              : <span style={{ fontSize:12, color:'#64748B' }}>{m.dept}</span>
                            }
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#94A3B8' }}>{m.email}</td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:m.status==='Active'?'#ECFDF5':'#F8FAFC', color:m.status==='Active'?'#059669':'#64748B', border:`1px solid ${m.status==='Active'?'rgba(5,150,105,0.25)':'rgba(100,116,139,0.2)'}`, display:'inline-flex', alignItems:'center', gap:5 }}>
                              {m.status==='Active' && <span className="pulse-dot" style={{ width:5, height:5, borderRadius:'50%', background:'#059669' }}/>}
                              {m.status}
                            </span>
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            {isEd
                              ? <div style={{ display:'flex', gap:6 }}>
                                  <button onClick={() => { setStaff(s => s.map(x => x.id===editId?{...x,...editForm}:x)); setEditId(null) }} style={{ padding:'5px 11px', borderRadius:8, border:'none', background:'#059669', color:'white', fontSize:11, cursor:'pointer', fontWeight:700, boxShadow:'0 2px 8px rgba(5,150,105,0.25)' }}>Save</button>
                                  <button onClick={() => setEditId(null)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(226,232,240,0.8)', background:'transparent', color:'#64748B', fontSize:11, cursor:'pointer' }}>×</button>
                                </div>
                              : <div style={{ display:'flex', gap:6 }}>
                                  <button onClick={() => { setEditId(m.id); setEditForm({ name:m.name, role:m.role, dept:m.dept }) }} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(124,58,237,0.2)', background:'rgba(124,58,237,0.07)', color:'#7C3AED', fontSize:11, cursor:'pointer', fontWeight:600, transition:'all 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.14)'}
                                    onMouseLeave={e => e.currentTarget.style.background='rgba(124,58,237,0.07)'}
                                  >Edit</button>
                                  <button onClick={() => setStaff(s => s.filter(x => x.id!==m.id))} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(225,29,72,0.2)', background:'rgba(225,29,72,0.06)', color:'#E11D48', fontSize:11, cursor:'pointer', fontWeight:600, transition:'all 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background='rgba(225,29,72,0.12)'}
                                    onMouseLeave={e => e.currentTarget.style.background='rgba(225,29,72,0.06)'}
                                  >Remove</button>
                                </div>
                            }
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
