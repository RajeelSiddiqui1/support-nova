'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { Users, UserCheck, Crown, UserPlus, Search, Filter, Eye, Mail, Phone, Calendar, Ticket, ChevronRight, X, Star, TrendingUp, ShieldCheck, AlertTriangle, Plus, CheckCircle, RefreshCw } from 'lucide-react'

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

const USERS_INIT = [
  { id:'USR-001', user_id:'USR-001', name:'Rajeev Khan',   email:'rajeev@gmail.com',      phone:'+92-300-1234567', type:'Premium Member',   role:'CUSTOMER', joined:'Jan 15, 2026', tickets:12, resolved:10, active:2,  spend:'₹48,200', status:'ACTIVE',   city:'Karachi',   lastSeen:'2h ago',   avatar:'R' },
  { id:'STF-101', user_id:'STF-101', name:'Zara Ahmed',    email:'zara@company.com',      phone:'+92-321-9876543', type:'Logistics Agent',  role:'AGENT',    joined:'Mar 22, 2026', tickets:5,  resolved:4,  active:1,  spend:'—',       status:'ACTIVE',   city:'Lahore',    lastSeen:'1d ago',   avatar:'Z' },
  { id:'STF-102', user_id:'STF-102', name:'Omar Sheikh',   email:'omar@company.com',      phone:'+92-333-5551234', type:'Finance Agent',    role:'AGENT',    joined:'Nov 08, 2025', tickets:34, resolved:32, active:2,  spend:'—',       status:'ACTIVE',   city:'Islamabad', lastSeen:'5m ago',   avatar:'O' },
  { id:'STF-103', user_id:'STF-103', name:'Sana Malik',    email:'sana@company.com',      phone:'+92-311-2233445', type:'Quality Reviewer', role:'REVIEWER', joined:'Jul 01, 2026', tickets:3,  resolved:3,  active:0,  spend:'—',       status:'ACTIVE',   city:'Karachi',   lastSeen:'3d ago',   avatar:'S' },
  { id:'STF-104', user_id:'STF-104', name:'Bilal Rana',    email:'bilal@company.com',     phone:'+92-345-6677889', type:'Operations Mgr',   role:'MANAGER',  joined:'Sep 10, 2025', tickets:67, resolved:65, active:2,  spend:'—',       status:'ACTIVE',   city:'Lahore',    lastSeen:'1h ago',   avatar:'B' },
  { id:'USR-007', user_id:'USR-007', name:'Bilal Cheema',  email:'bilal.c@email.com',     phone:'+92-300-9988776', type:'Regular Customer', role:'CUSTOMER', joined:'Apr 05, 2026', tickets:8,  resolved:7,  active:1,  spend:'₹22,400', status:'INACTIVE', city:'Multan',    lastSeen:'2w ago',   deactivation_reason:'Suspicious login activity', avatar:'B' },
]

const ROLE_BADGES = {
  ADMIN:    { bg: '#FFF1F2', c: '#E11D48', label: 'Admin' },
  MANAGER:  { bg: '#F5F3FF', c: '#7C3AED', label: 'Manager' },
  REVIEWER: { bg: '#FFFBEB', c: '#D97706', label: 'Reviewer' },
  AGENT:    { bg: '#EFF6FF', c: '#2563EB', label: 'Agent' },
  CUSTOMER: { bg: '#F8FAFC', c: '#64748B', label: 'Customer' },
}

const ROLES_LIST = ['AGENT', 'REVIEWER', 'MANAGER', 'ADMIN']
const DEPTS_LIST = ['Logistics', 'Finance', 'Quality', 'Fulfillment', 'Operations', 'Customer Experience']

export default function UsersPage() {
  const [users, setUsers]         = useState(USERS_INIT)
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleF]    = useState('All')
  const [loading, setLoading]     = useState(false)

  // Create Staff Modal State
  const [showCreateModal, setShowCreate] = useState(false)
  const [staffForm, setStaffForm]         = useState({ name: '', email: '', role: 'AGENT', department: 'Logistics' })
  const [createLoading, setCreateLoad]    = useState(false)
  const [createSuccessMsg, setSuccessMsg] = useState('')
  const [createdTempPwd, setCreatedTemp]  = useState('')

  // Deactivation Modal State
  const [deactModalUser, setDeactModal]   = useState(null)
  const [deactReason, setReason]         = useState('')
  const [reasonErr, setReasonErr]       = useState('')

  // Fetch users from FastAPI backend API dynamically using env variable
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(u => ({
            id: u.user_id || u._id,
            user_id: u.user_id || u._id,
            name: u.name,
            email: u.email,
            phone: u.phone || '—',
            type: u.department || u.customer_type || u.role,
            role: u.role || 'CUSTOMER',
            joined: u.created_at ? u.created_at.slice(0, 10) : 'Sep 2026',
            tickets: u.tickets || 0,
            resolved: u.resolved || 0,
            active: u.active || 0,
            spend: u.total_spend ? `₹${u.total_spend}` : '—',
            status: u.status || 'ACTIVE',
            city: u.city || 'Karachi',
            deactivation_reason: u.deactivation_reason,
            avatar: u.name.charAt(0).toUpperCase()
          }))
          setUsers(mapped)
        }
      }
    } catch (e) {
      // Keep initial demo data if offline
    }
  }

  // Create Staff Handler connecting with Backend API
  const handleCreateStaff = async (e) => {
    e.preventDefault()
    if (!staffForm.name || !staffForm.email || !staffForm.department) return
    setCreateLoad(true)
    setSuccessMsg('')
    setCreatedTemp('')

    try {
      const res = await fetch(`${API_BASE}/api/admin/create-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || 'Failed to create staff member.')
        setCreateLoad(false)
        return
      }

      setCreatedTemp(data.temp_password)
      setSuccessMsg(`Staff ${staffForm.name} created successfully! Temporary credentials emailed.`)

      const newMember = {
        id: data.user_id,
        user_id: data.user_id,
        name: staffForm.name,
        email: staffForm.email.toLowerCase(),
        phone: '—',
        type: staffForm.department,
        role: staffForm.role,
        joined: 'Just Now',
        tickets: 0,
        resolved: 0,
        active: 0,
        spend: '—',
        status: 'MUST_CHANGE_PASSWORD',
        city: 'Karachi',
        avatar: staffForm.name.charAt(0).toUpperCase()
      }

      setUsers([newMember, ...users])
      setStaffForm({ name: '', email: '', role: 'AGENT', department: 'Logistics' })
    } catch (err) {
      alert('Error connecting to backend server.')
    } finally {
      setCreateLoad(false)
    }
  }

  // Toggle Activate / Deactivate Handler
  const handleToggleStatus = async (user, newStatus) => {
    if (newStatus === 'INACTIVE') {
      setDeactModal(user)
      setReason('')
      setReasonErr('')
      return
    }

    try {
      await fetch(`${API_BASE}/api/admin/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, status: 'ACTIVE' }),
      })
    } catch {}

    setUsers(users.map(u => u.user_id === user.user_id ? { ...u, status: 'ACTIVE', deactivation_reason: null } : u))
  }

  const confirmDeactivation = async () => {
    if (!deactReason.trim()) {
      setReasonErr('Deactivation reason is mandatory.')
      return
    }

    try {
      await fetch(`${API_BASE}/api/admin/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: deactModalUser.user_id, status: 'INACTIVE', deactivation_reason: deactReason }),
      })
    } catch {}

    setUsers(users.map(u => u.user_id === deactModalUser.user_id ? { ...u, status: 'INACTIVE', deactivation_reason: deactReason } : u))
    setDeactModal(null)
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'All' || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@company.com" />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar title="User & Staff Management" subtitle="Create staff, manage roles, activation status & credentials" />

        <main style={{ flex:1, padding:22, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Create Staff Modal */}
          {showCreateModal && (
            <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
              <div className="animate-scale-in" style={{ ...glass(), maxWidth:480, width:'100%', padding:26 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
                      <UserPlus size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize:16, fontWeight:700, color:'#0F172A' }}>Add Staff Member</h3>
                      <p style={{ fontSize:11, color:'#94A3B8' }}>Auto-generates temporary password & emails credentials</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowCreate(false); setSuccessMsg(''); setCreatedTemp('') }} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8' }}>
                    <X size={18} />
                  </button>
                </div>

                {createSuccessMsg ? (
                  <div style={{ padding:20, borderRadius:14, background:'#ECFDF5', border:'1px solid rgba(5,150,105,0.25)', textAlign:'center', marginBottom:16 }}>
                    <CheckCircle size={32} color="#059669" style={{ margin:'0 auto 10px', display:'block' }} />
                    <h4 style={{ fontSize:15, fontWeight:700, color:'#0F172A', marginBottom:6 }}>Staff Account Created!</h4>
                    <p style={{ fontSize:12, color:'#047857', marginBottom:14 }}>{createSuccessMsg}</p>
                    {createdTempPwd && (
                      <div style={{ background:'white', padding:'12px', borderRadius:10, border:'1px solid rgba(5,150,105,0.2)', marginBottom:14 }}>
                        <p style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase' }}>Temporary Password</p>
                        <p style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:'#7C3AED', margin:'4px 0 0 0' }}>{createdTempPwd}</p>
                      </div>
                    )}
                    <button onClick={() => { setShowCreate(false); setSuccessMsg(''); setCreatedTemp('') }} style={{ padding:'9px 20px', borderRadius:10, background:'#059669', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateStaff}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                      <div>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Full Name *</label>
                        <input required value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="e.g. Ali Hassan" style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Email Address *</label>
                        <input required type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} placeholder="ali@company.com" style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Role *</label>
                        <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none', cursor:'pointer' }}>
                          {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Department *</label>
                        <select value={staffForm.department} onChange={e => setStaffForm({ ...staffForm, department: e.target.value })} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none', cursor:'pointer' }}>
                          {DEPTS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ padding:12, borderRadius:10, background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.15)', marginBottom:18, display:'flex', gap:8, alignItems:'center' }}>
                      <Mail size={15} color="#7C3AED" />
                      <p style={{ fontSize:11, color:'#64748B' }}>A temporary login password will be auto-generated and emailed to the user.</p>
                    </div>

                    <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                      <button type="button" onClick={() => setShowCreate(false)} style={{ padding:'9px 16px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'transparent', color:'#64748B', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={createLoading} style={{ padding:'9px 20px', borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(124,58,237,0.3)' }}>
                        {createLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Create Staff Member'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Deactivation Modal */}
          {deactModalUser && (
            <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
              <div className="animate-scale-in" style={{ ...glass(), maxWidth:450, width:'100%', padding:24, border:'1px solid rgba(225,29,72,0.3)' }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:'#FFF1F2', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <AlertTriangle size={20} color="#E11D48" />
                  </div>
                  <div>
                    <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A' }}>Deactivate {deactModalUser.name}</h3>
                    <p style={{ fontSize:11, color:'#94A3B8' }}>{deactModalUser.email}</p>
                  </div>
                </div>

                <p style={{ fontSize:12, color:'#64748B', lineHeight:1.5, marginBottom:14 }}>
                  Deactivating this account will automatically log the user out and block middleware access. You must provide an explicit deactivation reason.
                </p>

                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                    Deactivation Reason *
                  </label>
                  <textarea
                    rows={3} value={deactReason} onChange={e => { setReason(e.target.value); setReasonErr('') }}
                    placeholder="e.g. Terms of Service violation §4.2, suspicious activity…"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:10, border: reasonErr ? '1.5px solid #E11D48' : '1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:12, outline:'none' }}
                  />
                  {reasonErr && <p style={{ fontSize:11, color:'#E11D48', marginTop:4 }}>⚠️ {reasonErr}</p>}
                </div>

                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button onClick={() => setDeactModal(null)} style={{ padding:'9px 16px', borderRadius:9, border:'1.5px solid rgba(226,232,240,0.8)', background:'transparent', color:'#64748B', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={confirmDeactivation} style={{ padding:'9px 18px', borderRadius:9, background:'#E11D48', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(225,29,72,0.3)' }}>
                    Confirm Deactivation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:13 }}>
            <StatCard title="Total Accounts"  value={users.length} subtitle="Registered users & staff" icon={Users}     color="violet"  delay={0}   />
            <StatCard title="Active Users"   value={users.filter(u => u.status === 'ACTIVE').length} subtitle="Authorized access" icon={UserCheck} color="emerald" trend="up" trendValue="2" delay={80}  />
            <StatCard title="Deactivated"    value={users.filter(u => u.status === 'INACTIVE').length} subtitle="Blocked status" icon={AlertTriangle} color="rose" delay={160} />
            <StatCard title="Staff Members"  value={users.filter(u => u.role !== 'CUSTOMER').length} subtitle="Agents, Reviewers, Managers" icon={Crown} color="amber" delay={240} />
          </div>

          {/* Table */}
          <div className="animate-fade-up d100" style={glass({ padding:22 })}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:12 }}>
              <div>
                <h3 style={{ fontSize:15, fontWeight:700, color:'#0F172A' }}>User & Staff Accounts</h3>
                <p style={{ fontSize:11, color:'#94A3B8' }}>{filtered.length} accounts found</p>
              </div>

              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 13px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)' }}>
                  <Search size={13} color="#94A3B8" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" style={{ background:'none', border:'none', outline:'none', color:'#0F172A', fontSize:13, width:150 }} />
                </div>

                <select value={roleFilter} onChange={e => setRoleF(e.target.value)} style={{ padding:'8px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.8)', fontSize:12, outline:'none', cursor:'pointer' }}>
                  <option value="All">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="REVIEWER">Reviewer</option>
                  <option value="AGENT">Agent</option>
                  <option value="CUSTOMER">Customer</option>
                </select>

                <button
                  onClick={() => { setShowCreate(true); setSuccessMsg(''); setCreatedTemp('') }}
                  style={{
                    padding:'9px 16px', borderRadius:10,
                    background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
                    color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6,
                    boxShadow:'0 4px 14px rgba(124,58,237,0.3)',
                  }}
                >
                  <Plus size={14} /> Add Staff Member
                </button>
              </div>
            </div>

            <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid rgba(226,232,240,0.5)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                <thead>
                  <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                    {['User','Role','Department / Type','Joined','Status','Reason / Notes','Toggle Access'].map(h => (
                      <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid rgba(226,232,240,0.5)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const rb = ROLE_BADGES[u.role] || ROLE_BADGES.CUSTOMER
                    const isActive = u.status === 'ACTIVE'
                    return (
                      <tr key={u.user_id} style={{ transition:'background 0.15s' }}>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                            <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${rb.c},${rb.c}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>
                              {u.avatar}
                            </div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>{u.name}</div>
                              <div style={{ fontSize:11, color:'#94A3B8' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:6, background:rb.bg, color:rb.c, fontWeight:700, border:`1px solid ${rb.c}25` }}>{rb.label}</span>
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#64748B' }}>{u.type}</td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:11, color:'#94A3B8' }}>{u.joined}</td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background: isActive ? '#ECFDF5' : '#FFF1F2', color: isActive ? '#059669' : '#E11D48', border:`1px solid ${isActive ? 'rgba(5,150,105,0.25)' : 'rgba(225,29,72,0.25)'}` }}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:11, color:'#64748B', maxWidth:180 }}>
                          {u.deactivation_reason || '—'}
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <button
                            onClick={() => handleToggleStatus(u, isActive ? 'INACTIVE' : 'ACTIVE')}
                            style={{
                              padding:'5px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
                              background: isActive ? 'rgba(225,29,72,0.08)' : 'rgba(5,150,105,0.08)',
                              color: isActive ? '#E11D48' : '#059669',
                              border: `1px solid ${isActive ? 'rgba(225,29,72,0.2)' : 'rgba(5,150,105,0.2)'}`,
                            }}
                          >
                            {isActive ? 'Deactivate' : 'Activate User'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
