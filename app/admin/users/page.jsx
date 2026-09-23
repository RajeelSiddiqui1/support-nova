'use client'
import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { Users, UserCheck, Crown, UserPlus, Search, Filter, Eye, Mail, Phone, Calendar, Ticket, ChevronRight, X, Star, TrendingUp, ShieldCheck } from 'lucide-react'

const glass = (extra = {}) => ({
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.95)',
  borderRadius: 16,
  boxShadow: '0 4px 28px rgba(148,163,184,0.1), 0 1px 4px rgba(148,163,184,0.06)',
  ...extra,
})

const USERS = [
  { id:'USR-001', name:'Rajeev Khan',   email:'rajeev@gmail.com',      phone:'+92-300-1234567', type:'Premium Member',   joined:'Jan 15, 2026', tickets:12, resolved:10, active:2,  spend:'₹48,200', status:'Active',   city:'Karachi',   lastSeen:'2h ago',   avatar:'R' },
  { id:'USR-002', name:'Aisha Malik',   email:'aisha.m@outlook.com',   phone:'+92-321-9876543', type:'Regular Customer', joined:'Mar 22, 2026', tickets:5,  resolved:4,  active:1,  spend:'₹12,800', status:'Active',   city:'Lahore',    lastSeen:'1d ago',   avatar:'A' },
  { id:'USR-003', name:'Ravi Sharma',   email:'ravi.sharma@yahoo.com', phone:'+92-333-5551234', type:'Business Account', joined:'Nov 08, 2025', tickets:34, resolved:32, active:2,  spend:'₹2,40,000',status:'Active',   city:'Islamabad', lastSeen:'5m ago',   avatar:'R' },
  { id:'USR-004', name:'Sara Hussain',  email:'sara.h@gmail.com',      phone:'+92-311-2233445', type:'Regular Customer', joined:'Jul 01, 2026', tickets:3,  resolved:3,  active:0,  spend:'₹8,500',  status:'Active',   city:'Karachi',   lastSeen:'3d ago',   avatar:'S' },
  { id:'USR-005', name:'Omar Farooq',   email:'omar.f@company.com',    phone:'+92-345-6677889', type:'Business Account', joined:'Sep 10, 2025', tickets:67, resolved:65, active:2,  spend:'₹6,80,000',status:'Active',   city:'Lahore',    lastSeen:'1h ago',   avatar:'O' },
  { id:'USR-006', name:'Nadia Iqbal',   email:'nadia.iq@gmail.com',    phone:'+92-312-4455667', type:'First-Time Buyer', joined:'Sep 20, 2026', tickets:1,  resolved:0,  active:1,  spend:'₹3,200',  status:'Active',   city:'Peshawar',  lastSeen:'4h ago',   avatar:'N' },
  { id:'USR-007', name:'Bilal Cheema',  email:'bilal.c@email.com',     phone:'+92-300-9988776', type:'Regular Customer', joined:'Apr 05, 2026', tickets:8,  resolved:7,  active:1,  spend:'₹22,400', status:'Inactive', city:'Multan',    lastSeen:'2w ago',   avatar:'B' },
  { id:'USR-008', name:'Hina Baig',     email:'hina.b@outlook.com',    phone:'+92-322-3344556', type:'Premium Member',   joined:'Feb 14, 2026', tickets:19, resolved:18, active:1,  spend:'₹95,600', status:'Active',   city:'Karachi',   lastSeen:'30m ago',  avatar:'H' },
]

const USER_TICKETS = {
  'USR-001': [
    { id:'CMP-00421', cat:'Delivery Issue',  status:'In Triage', p:'P1', date:'Sep 23, 2026' },
    { id:'CMP-00416', cat:'Billing Error',   status:'Resolved',  p:'P1', date:'Sep 21, 2026' },
    { id:'CMP-00410', cat:'Product Defect',  status:'Resolved',  p:'P2', date:'Sep 19, 2026' },
  ],
  'USR-003': [
    { id:'CMP-00419', cat:'Wrong Product',   status:'AI Review',  p:'P2', date:'Sep 22, 2026' },
    { id:'CMP-00411', cat:'Unsupported Prom',status:'In Triage',  p:'P1', date:'Sep 20, 2026' },
  ],
}

const TYPE_COLORS = {
  'Premium Member':   { bg:'#F5F3FF', c:'#7C3AED', icon:'👑' },
  'Business Account': { bg:'#EFF6FF', c:'#2563EB', icon:'🏢' },
  'Regular Customer': { bg:'#F8FAFC', c:'#64748B', icon:'👤' },
  'First-Time Buyer': { bg:'#ECFDF5', c:'#059669', icon:'🌟' },
}

const STATUS_PILL = (s) => s === 'Active'
  ? { bg:'#ECFDF5', c:'#059669', border:'rgba(5,150,105,0.2)' }
  : { bg:'#F8FAFC',  c:'#94A3B8', border:'rgba(148,163,184,0.2)' }

const P_COLORS = { P0:{bg:'#FFF1F2',c:'#E11D48'}, P1:{bg:'#FFFBEB',c:'#D97706'}, P2:{bg:'#EFF6FF',c:'#2563EB'}, P3:{bg:'#F8FAFC',c:'#64748B'} }
const S_COLORS = { 'In Triage':{bg:'#FFFBEB',c:'#D97706'}, 'AI Review':{bg:'#F5F3FF',c:'#7C3AED'}, Resolved:{bg:'#ECFDF5',c:'#059669'}, Closed:{bg:'#F8FAFC',c:'#64748B'} }

const avatarColors = ['#7C3AED','#059669','#D97706','#E11D48','#0891B2','#4F46E5','#DB2777','#065F46']

export default function UsersPage() {
  const [search, setSearch]   = useState('')
  const [typeFilter, setType] = useState('All')
  const [selUser, setSel]     = useState(null)

  const filtered = USERS.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilter === 'All' || u.type === typeFilter
    return matchSearch && matchType
  })

  const userTickets = selUser ? (USER_TICKETS[selUser.id] || []) : []

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@company.com" />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar title="User Management" subtitle="All registered customers and accounts" />

        <main style={{ flex:1, padding:22, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:13 }}>
            <StatCard title="Total Users"    value="8"   subtitle="Registered accounts" icon={Users}     color="violet"  delay={0}   />
            <StatCard title="Active Users"   value="7"   subtitle="Last 30 days"        icon={UserCheck} color="emerald" trend="up" trendValue="2" delay={80}  />
            <StatCard title="Premium Members"value="2"   subtitle="Subscribed plan"     icon={Crown}     color="amber"   delay={160} />
            <StatCard title="New This Month" value="3"   subtitle="Sep 2026"            icon={UserPlus}  color="cyan"    trend="up" trendValue="1" delay={240} />
          </div>

          {/* Main Grid — Table + Detail */}
          <div style={{ display:'grid', gridTemplateColumns: selUser ? '1fr 340px' : '1fr', gap:16, transition:'all 0.3s ease' }}>

            {/* Table */}
            <div className="animate-fade-up d100" style={glass({ padding:22 })}>
              {/* Toolbar */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A', marginBottom:2 }}>All Users</h3>
                  <p style={{ fontSize:11, color:'#94A3B8' }}>{filtered.length} users found</p>
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {/* Search */}
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 13px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)', transition:'all 0.2s' }}
                    onFocus={e => e.currentTarget.style.borderColor='rgba(124,58,237,0.4)'}
                    onBlur={e => e.currentTarget.style.borderColor='rgba(226,232,240,0.8)'}
                  >
                    <Search size={13} color="#94A3B8" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                      style={{ background:'none', border:'none', outline:'none', color:'#0F172A', fontSize:13, width:160 }} />
                  </div>
                  {/* Type Filter */}
                  <select value={typeFilter} onChange={e => setType(e.target.value)}
                    style={{ padding:'8px 13px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)', color:'#0F172A', fontSize:12, outline:'none', cursor:'pointer' }}>
                    <option>All</option>
                    <option>Premium Member</option>
                    <option>Business Account</option>
                    <option>Regular Customer</option>
                    <option>First-Time Buyer</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid rgba(226,232,240,0.5)' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                  <thead>
                    <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                      {['User','Type','City','Joined','Tickets','Spend','Status',''].map(h => (
                        <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid rgba(226,232,240,0.5)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => {
                      const tc = TYPE_COLORS[u.type] || TYPE_COLORS['Regular Customer']
                      const sc = STATUS_PILL(u.status)
                      const acColor = avatarColors[i % avatarColors.length]
                      const isSelected = selUser?.id === u.id
                      return (
                        <tr key={u.id}
                          className="animate-fade-up"
                          style={{ animationDelay:`${i*40}ms`, cursor:'pointer', transition:'background 0.15s', background: isSelected ? 'rgba(124,58,237,0.04)' : 'transparent' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(124,58,237,0.025)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                          onClick={() => setSel(isSelected ? null : u)}
                        >
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${acColor},${acColor}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0, boxShadow:`0 3px 10px ${acColor}35`, transition:'transform 0.2s', }}
                                onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
                                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                              >
                                {u.avatar}
                              </div>
                              <div>
                                <div style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>{u.name}</div>
                                <div style={{ fontSize:11, color:'#94A3B8' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:tc.bg, color:tc.c, fontWeight:600, border:`1px solid ${tc.c}20` }}>{tc.icon} {u.type}</span>
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#64748B' }}>{u.city}</td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:11, color:'#94A3B8' }}>{u.joined}</td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#7C3AED' }}>{u.tickets}</span>
                              {u.active > 0 && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'#FFFBEB', color:'#D97706', border:'1px solid rgba(217,119,6,0.2)', fontWeight:600 }}>{u.active} open</span>}
                            </div>
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontFamily:'monospace', fontSize:12, fontWeight:600, color:'#059669' }}>{u.spend}</td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:sc.bg, color:sc.c, border:`1px solid ${sc.border}` }}>{u.status}</span>
                          </td>
                          <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                            <button style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color: isSelected ? '#7C3AED' : '#94A3B8', background: isSelected ? 'rgba(124,58,237,0.1)' : 'rgba(248,250,252,0.8)', padding:'5px 10px', borderRadius:8, border:'1px solid rgba(226,232,240,0.7)', cursor:'pointer', transition:'all 0.15s' }}>
                              <Eye size={11} /> {isSelected ? 'Close' : 'View'}
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
            {selUser && (
              <div className="animate-slide-left" style={glass({ padding:0, alignSelf:'flex-start', position:'sticky', top:22, overflow:'hidden' })}>
                {/* Header */}
                <div style={{ padding:'20px', background:'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(79,70,229,0.04))', borderBottom:'1px solid rgba(226,232,240,0.5)', position:'relative' }}>
                  <button onClick={() => setSel(null)} style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,0.8)', border:'1px solid rgba(226,232,240,0.6)', borderRadius:8, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748B', transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='#FFF1F2'; e.currentTarget.style.color='#E11D48'; e.currentTarget.style.borderColor='rgba(225,29,72,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.8)'; e.currentTarget.style.color='#64748B'; e.currentTarget.style.borderColor='rgba(226,232,240,0.6)' }}
                  >
                    <X size={13} />
                  </button>
                  <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ width:52, height:52, borderRadius:'50%', background:`linear-gradient(135deg,#7C3AED,#4F46E5)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'white', boxShadow:'0 6px 20px rgba(124,58,237,0.35)', flexShrink:0 }}>
                      {selUser.avatar}
                    </div>
                    <div>
                      <h3 style={{ fontSize:15, fontWeight:800, color:'#0F172A', marginBottom:3 }}>{selUser.name}</h3>
                      <div style={{ fontSize:10, fontWeight:700, color:'#7C3AED', background:'#F5F3FF', padding:'2px 9px', borderRadius:6, border:'1px solid rgba(124,58,237,0.2)', display:'inline-block' }}>{selUser.type}</div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(226,232,240,0.4)' }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Contact Info</p>
                  {[
                    [Mail, selUser.email], [Phone, selUser.phone],
                    [Calendar, `Joined ${selUser.joined}`], [Users, selUser.city],
                  ].map(([Icon, v]) => (
                    <div key={v} style={{ display:'flex', gap:9, marginBottom:9, alignItems:'center' }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:'rgba(124,58,237,0.07)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Icon size={12} color="#7C3AED" />
                      </div>
                      <span style={{ fontSize:12, color:'#334155' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Stats Row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'14px 20px', gap:10, borderBottom:'1px solid rgba(226,232,240,0.4)' }}>
                  {[
                    { l:'Total', v:selUser.tickets, c:'#7C3AED' },
                    { l:'Resolved', v:selUser.resolved, c:'#059669' },
                    { l:'Active', v:selUser.active, c:'#D97706' },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign:'center', padding:'10px 6px', borderRadius:10, background:`${s.c}08`, border:`1px solid ${s.c}18`, transition:'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 16px ${s.c}20` }}
                      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}
                    >
                      <div style={{ fontSize:20, fontWeight:800, color:s.c, fontFamily:'monospace' }}>{s.v}</div>
                      <div style={{ fontSize:10, color:'#94A3B8', marginTop:2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Spend */}
                <div style={{ padding:'12px 20px', borderBottom:'1px solid rgba(226,232,240,0.4)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:10, background:'rgba(5,150,105,0.06)', border:'1px solid rgba(5,150,105,0.15)' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <TrendingUp size={14} color="#059669" />
                      <span style={{ fontSize:12, color:'#64748B', fontWeight:500 }}>Total Spend</span>
                    </div>
                    <span style={{ fontSize:16, fontWeight:800, color:'#059669', fontFamily:'monospace' }}>{selUser.spend}</span>
                  </div>
                </div>

                {/* Tickets */}
                <div style={{ padding:'14px 20px' }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:11 }}>Recent Tickets</p>
                  {userTickets.length > 0 ? userTickets.map(t => {
                    const pc = P_COLORS[t.p] || P_COLORS.P3
                    const sc = S_COLORS[t.status] || S_COLORS['Closed']
                    return (
                      <div key={t.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 11px', borderRadius:10, border:'1px solid rgba(226,232,240,0.5)', marginBottom:7, background:'rgba(248,250,252,0.6)', transition:'all 0.15s', cursor:'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(124,58,237,0.25)'; e.currentTarget.style.background='rgba(124,58,237,0.03)'; e.currentTarget.style.transform='translateX(3px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(226,232,240,0.5)'; e.currentTarget.style.background='rgba(248,250,252,0.6)'; e.currentTarget.style.transform='none' }}
                      >
                        <Ticket size={12} color="#7C3AED" />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, fontFamily:'monospace', fontWeight:600, color:'#7C3AED' }}>{t.id}</div>
                          <div style={{ fontSize:11, color:'#94A3B8', marginTop:1 }}>{t.cat}</div>
                        </div>
                        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:5, background:pc.bg, color:pc.c }}>{t.p}</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:sc.bg, color:sc.c, fontWeight:600 }}>{t.status}</span>
                        </div>
                      </div>
                    )
                  }) : (
                    <div style={{ textAlign:'center', padding:'20px', color:'#94A3B8', fontSize:12 }}>
                      No recent tickets
                    </div>
                  )}
                  <button style={{ width:'100%', padding:'9px', borderRadius:10, border:'1.5px solid rgba(124,58,237,0.2)', background:'rgba(124,58,237,0.06)', color:'#7C3AED', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:4, transition:'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(124,58,237,0.12)'; e.currentTarget.style.transform='translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(124,58,237,0.06)'; e.currentTarget.style.transform='none' }}
                  >
                    <Eye size={13} /> View All Tickets <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
