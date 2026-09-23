'use client'
import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { Ticket, CheckCircle, AlertTriangle, Clock, Search, Filter, Eye, Zap, ShieldCheck, X, User, Calendar, Building, ChevronRight, MessageSquare, ArrowUpRight } from 'lucide-react'

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
  { id:'CMP-00421', title:'Order delayed by 8 days — no update from delivery partner',        customer:'Rajeev Khan',   dept:'Logistics',   cat:'Delivery Issue',  status:'In Triage', p:'P0', date:'Sep 23, 2026', sla:'1h 20m', risk:88, match:true,  agent:'Zara Ahmed'   },
  { id:'CMP-00420', title:'Double charge for order ORD-72110 on Sep 21',                      customer:'Sara Hussain',  dept:'Finance',     cat:'Billing Error',   status:'In Triage', p:'P1', date:'Sep 23, 2026', sla:'4h 00m', risk:60, match:true,  agent:'Omar Sheikh'  },
  { id:'CMP-00419', title:'Received grey sneakers instead of white — wrong product',           customer:'Ravi Sharma',   dept:'Fulfillment', cat:'Wrong Product',   status:'AI Review',  p:'P2', date:'Sep 22, 2026', sla:'18h',    risk:22, match:false, agent:'Zara Ahmed'   },
  { id:'CMP-00418', title:'Shirt arrived with visible tear and stain on collar',               customer:'Hina Baig',     dept:'Quality',     cat:'Product Defect',  status:'AI Review',  p:'P2', date:'Sep 22, 2026', sla:'14h 30m',risk:30, match:true,  agent:'Hira Qureshi' },
  { id:'CMP-00417', title:'Refund for cancelled order ORD-68992 not credited after 15 days',  customer:'Omar Farooq',   dept:'Finance',     cat:'Refund Request',  status:'In Triage', p:'P1', date:'Sep 22, 2026', sla:'2h 15m', risk:78, match:true,  agent:'Omar Sheikh'  },
  { id:'CMP-00415', title:'GenAI vs Python disagreement — wrong product replacement policy',   customer:'Aisha Malik',   dept:'Fulfillment', cat:'Wrong Product',   status:'Escalated',  p:'P1', date:'Sep 21, 2026', sla:'—',      risk:0,  match:false, agent:'Sana Malik'   },
  { id:'CMP-00413', title:'Prompt injection attempt in complaint text',                        customer:'Unknown',       dept:'Security',    cat:'Security Alert',  status:'Escalated',  p:'P0', date:'Sep 21, 2026', sla:'—',      risk:0,  match:false, agent:'Bilal Rana'   },
  { id:'CMP-00411', title:'GenAI promised 48h delivery that violates DEL-POL-01',             customer:'Ravi Sharma',   dept:'Logistics',   cat:'Delivery Issue',  status:'In Triage', p:'P2', date:'Sep 20, 2026', sla:'5h',     risk:45, match:false, agent:'Zara Ahmed'   },
  { id:'CMP-00410', title:'Product arrived damaged — packaging crushed during delivery',       customer:'Rajeev Khan',   dept:'Quality',     cat:'Product Defect',  status:'Resolved',   p:'P2', date:'Sep 19, 2026', sla:'—',      risk:0,  match:true,  agent:'Hira Qureshi' },
  { id:'CMP-00409', title:'Billing double charge — GenAI vs Python refund amount disagreement',customer:'Sara Hussain',  dept:'Finance',     cat:'Billing Error',   status:'Resolved',   p:'P1', date:'Sep 19, 2026', sla:'—',      risk:0,  match:false, agent:'Omar Sheikh'  },
  { id:'CMP-00405', title:'Requesting refund per policy as item not delivered in guarantee',   customer:'Nadia Iqbal',   dept:'Finance',     cat:'Refund Request',  status:'Closed',     p:'P3', date:'Sep 18, 2026', sla:'—',      risk:0,  match:true,  agent:'Omar Sheikh'  },
  { id:'CMP-00401', title:'App showing error 503 on payment page',                            customer:'Bilal Cheema',  dept:'Tech',        cat:'Technical Issue', status:'Closed',     p:'P2', date:'Sep 15, 2026', sla:'—',      risk:0,  match:true,  agent:'Hira Qureshi' },
]

const PIPELINE_DATA = {
  'CMP-00421': {
    genai: { issue:'Significant Delivery Delay (8 days)', sentiment:'Very Frustrated 😠', priority:'P0', dept:'Logistics', draft:'We sincerely apologize for the unacceptable delay with your order ORD-78234. We are immediately escalating to our logistics team and can offer a full refund or priority re-shipment with a 15% goodwill coupon.' },
    python: { rule:'DEL-POL-04: Delivery Guarantee Breach (>72h)', refund:true, escalation:true, policy:'Customer Delivery Policy v2.1 §4.3', score:94 },
    match: true,
  },
  'CMP-00419': {
    genai: { issue:'Wrong product received', sentiment:'Frustrated 😤', priority:'P2', dept:'Fulfillment', draft:'We apologize for shipping the wrong item. We will immediately arrange a replacement.' },
    python: { rule:'WP-POL-02: Wrong Product — Photo Evidence Required', refund:false, escalation:true, policy:'Wrong Product Policy v1.2 §2.1', score:62 },
    match: false,
  },
}

const STATUS_COLORS = {
  'In Triage': { bg:'#FFFBEB', c:'#D97706', border:'rgba(217,119,6,0.22)', dot:'#D97706' },
  'AI Review':  { bg:'#F5F3FF', c:'#7C3AED', border:'rgba(124,58,237,0.22)', dot:'#7C3AED' },
  'Resolved':   { bg:'#ECFDF5', c:'#059669', border:'rgba(5,150,105,0.22)',  dot:'#059669' },
  'Escalated':  { bg:'#FFF1F2', c:'#E11D48', border:'rgba(225,29,72,0.22)',  dot:'#E11D48' },
  'Closed':     { bg:'#F8FAFC', c:'#94A3B8', border:'rgba(148,163,184,0.2)', dot:'#CBD5E1' },
}
const P_COLORS = { P0:{bg:'#FFF1F2',c:'#E11D48'}, P1:{bg:'#FFFBEB',c:'#D97706'}, P2:{bg:'#EFF6FF',c:'#2563EB'}, P3:{bg:'#F8FAFC',c:'#64748B'} }

const STATUSES = ['All','In Triage','AI Review','Escalated','Resolved','Closed']
const DEPTS    = ['All','Logistics','Finance','Fulfillment','Quality','Tech','Security']

export default function TicketsPage() {
  const [search, setSearch]       = useState('')
  const [statusF, setStatusF]     = useState('All')
  const [deptF, setDeptF]         = useState('All')
  const [selTicket, setSel]       = useState(null)
  const [activeTab, setActiveTab] = useState('pipeline')

  const filtered = ALL_TICKETS.filter(t => {
    const matchS = t.id.toLowerCase().includes(search.toLowerCase()) || t.title.toLowerCase().includes(search.toLowerCase()) || t.customer.toLowerCase().includes(search.toLowerCase())
    const matchSt = statusF === 'All' || t.status === statusF
    const matchD  = deptF   === 'All' || t.dept   === deptF
    return matchS && matchSt && matchD
  })

  const pipeline = selTicket ? PIPELINE_DATA[selTicket.id] : null

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@company.com" />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar title="All Tickets" subtitle="Complete complaint ticket management" />

        <main style={{ flex:1, padding:22, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:13 }}>
            <StatCard title="Total Tickets" value="12"   subtitle="All time"          icon={Ticket}        color="violet"  delay={0}   />
            <StatCard title="In Triage"     value="5"    subtitle="Awaiting response" icon={Clock}         color="amber"   delay={70}  />
            <StatCard title="Escalated"     value="2"    subtitle="Needs manager"     icon={AlertTriangle} color="rose"    delay={140} />
            <StatCard title="Resolved"      value="4"    subtitle="Closed tickets"    icon={CheckCircle}   color="emerald" delay={210} />
          </div>

          {/* Main Content */}
          <div style={{ display:'grid', gridTemplateColumns: selTicket ? '1fr 380px' : '1fr', gap:16, transition:'all 0.3s' }}>

            {/* Table */}
            <div className="animate-fade-up d100" style={glass({ padding:22 })}>
              {/* Toolbar */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A', marginBottom:2 }}>Ticket Registry</h3>
                  <p style={{ fontSize:11, color:'#94A3B8' }}>{filtered.length} of {ALL_TICKETS.length} tickets</p>
                </div>
                <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 13px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)' }}>
                    <Search size={13} color="#94A3B8" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…"
                      style={{ background:'none', border:'none', outline:'none', color:'#0F172A', fontSize:13, width:140 }} />
                  </div>
                  <select value={statusF} onChange={e => setStatusF(e.target.value)}
                    style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)', color:'#0F172A', fontSize:12, outline:'none', cursor:'pointer' }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select value={deptF} onChange={e => setDeptF(e.target.value)}
                    style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)', color:'#0F172A', fontSize:12, outline:'none', cursor:'pointer' }}>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Status Quick Filters */}
              <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
                {STATUSES.map(s => {
                  const sc = STATUS_COLORS[s] || { bg:'#F8FAFC', c:'#64748B', border:'rgba(100,116,139,0.2)', dot:'#94A3B8' }
                  const count = s === 'All' ? ALL_TICKETS.length : ALL_TICKETS.filter(t => t.status === s).length
                  return (
                    <button key={s} onClick={() => setStatusF(s)} style={{
                      padding:'5px 12px', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer',
                      background: statusF === s ? sc.bg : 'transparent',
                      color: statusF === s ? sc.c : '#94A3B8',
                      border: statusF === s ? `1.5px solid ${sc.border}` : '1.5px solid rgba(226,232,240,0.5)',
                      display:'flex', alignItems:'center', gap:5,
                      transition:'all 0.15s',
                    }}>
                      {s !== 'All' && <span style={{ width:6, height:6, borderRadius:'50%', background:statusF===s?sc.dot:'#CBD5E1', display:'inline-block' }} />}
                      {s} <span style={{ fontFamily:'monospace' }}>({count})</span>
                    </button>
                  )
                })}
              </div>

              {/* Table */}
              <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid rgba(226,232,240,0.5)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                  <thead>
                    <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                      {['ID','Complaint','Customer','Dept','Priority','Status','Agent','AI Match',''].map(h => (
                        <th key={h} style={{ padding:'11px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid rgba(226,232,240,0.5)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => {
                      const sc = STATUS_COLORS[t.status] || STATUS_COLORS['Closed']
                      const pc = P_COLORS[t.p] || P_COLORS.P3
                      const isSelected = selTicket?.id === t.id
                      return (
                        <tr key={t.id}
                          className="animate-fade-up"
                          style={{ animationDelay:`${i*30}ms`, cursor:'pointer', transition:'background 0.15s', background: isSelected ? 'rgba(124,58,237,0.04)' : 'transparent' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='rgba(124,58,237,0.02)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='transparent' }}
                          onClick={() => { setSel(isSelected ? null : t); setActiveTab('pipeline') }}
                        >
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontFamily:'monospace', fontSize:11, color:'#7C3AED', fontWeight:700, whiteSpace:'nowrap' }}>{t.id}</td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', maxWidth:220 }}>
                            <div style={{ fontSize:12, fontWeight:500, color:'#0F172A', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize:10, color:'#94A3B8', marginTop:2 }}>{t.cat} · {t.date}</div>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#64748B', whiteSpace:'nowrap' }}>{t.customer}</td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ fontSize:11, color:'#64748B', background:'rgba(248,250,252,0.8)', padding:'2px 8px', borderRadius:6, border:'1px solid rgba(226,232,240,0.6)' }}>{t.dept}</span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:6, background:pc.bg, color:pc.c }}>{t.p}</span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:600, background:sc.bg, color:sc.c, border:`1px solid ${sc.border}`, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                              <span className="pulse-dot" style={{ width:5, height:5, borderRadius:'50%', background:sc.dot, flexShrink:0 }} />
                              {t.status}
                            </span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:11, color:'#64748B', whiteSpace:'nowrap' }}>{t.agent}</td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ padding:'3px 9px', borderRadius:6, fontSize:10, fontWeight:700, background:t.match?'rgba(5,150,105,0.1)':'rgba(217,119,6,0.1)', color:t.match?'#059669':'#D97706', border:`1px solid ${t.match?'rgba(5,150,105,0.2)':'rgba(217,119,6,0.2)'}` }}>
                              {t.match ? '✅ Match' : '⚠ Mismatch'}
                            </span>
                          </td>
                          <td style={{ padding:'12px 12px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <button style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color: isSelected?'#7C3AED':'#94A3B8', background: isSelected?'rgba(124,58,237,0.1)':'rgba(248,250,252,0.8)', padding:'5px 10px', borderRadius:8, border:'1px solid rgba(226,232,240,0.7)', cursor:'pointer', transition:'all 0.15s' }}>
                              <Eye size={11} /> Detail
                            </button>
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
                  <div style={{ display:'flex', gap:7, marginBottom:9, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'monospace', fontSize:12, color:'#7C3AED', fontWeight:700 }}>{selTicket.id}</span>
                    {[P_COLORS[selTicket.p]].map(pc => (
                      <span key="p" style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:pc.bg, color:pc.c }}>{selTicket.p} Critical</span>
                    ))}
                    {[STATUS_COLORS[selTicket.status]||STATUS_COLORS['Closed']].map(sc => (
                      <span key="s" style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:sc.bg, color:sc.c, border:`1px solid ${sc.border}`, fontWeight:600 }}>{selTicket.status}</span>
                    ))}
                  </div>
                  <p style={{ fontSize:13, fontWeight:600, color:'#0F172A', lineHeight:1.4, marginBottom:10 }}>{selTicket.title}</p>
                  <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                    {[[User,selTicket.customer],[Building,selTicket.dept],[Calendar,selTicket.date]].map(([Icon,v]) => (
                      <div key={v} style={{ display:'flex', gap:5, alignItems:'center' }}>
                        <Icon size={11} color="#94A3B8" />
                        <span style={{ fontSize:11, color:'#64748B' }}>{v}</span>
                      </div>
                    ))}
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
                  {[['pipeline','🔬 Pipeline'],['info','📋 Info'],['response','💬 Response']].map(([k,l]) => (
                    <button key={k} onClick={() => setActiveTab(k)} style={{
                      padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                      background: activeTab===k ? 'rgba(124,58,237,0.1)' : 'transparent',
                      color: activeTab===k ? '#7C3AED' : '#64748B',
                      transition:'all 0.15s',
                    }}>{l}</button>
                  ))}
                </div>

                {/* Tab Content */}
                <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>
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
                  {activeTab === 'info' && (
                    <div className="animate-fade-in">
                      {[
                        ['Ticket ID', selTicket.id],
                        ['Category', selTicket.cat],
                        ['Department', selTicket.dept],
                        ['Priority', selTicket.p],
                        ['Status', selTicket.status],
                        ['Assigned Agent', selTicket.agent],
                        ['Submitted', selTicket.date],
                        ['SLA Remaining', selTicket.sla || 'Resolved'],
                        ['Risk Level', `${selTicket.risk}%`],
                      ].map(([k,v]) => (
                        <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(226,232,240,0.4)' }}>
                          <span style={{ fontSize:12, color:'#94A3B8', fontWeight:500 }}>{k}</span>
                          <span style={{ fontSize:12, color:'#0F172A', fontWeight:600, textAlign:'right' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'response' && (
                    <div className="animate-fade-in">
                      <p style={{ fontSize:12, color:'#64748B', lineHeight:1.7, marginBottom:14 }}>
                        {pipeline?.genai.draft || 'No draft response generated yet for this ticket.'}
                      </p>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button style={{ flex:1, padding:'9px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#059669,#047857)', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:'0 4px 14px rgba(5,150,105,0.25)', transition:'all 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform='none'}
                        >
                          <CheckCircle size={13}/> Approve
                        </button>
                        <button style={{ flex:1, padding:'9px', borderRadius:9, border:'1.5px solid rgba(225,29,72,0.25)', background:'rgba(225,29,72,0.06)', color:'#E11D48', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform='none'}
                        >
                          <ArrowUpRight size={13}/> Escalate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
