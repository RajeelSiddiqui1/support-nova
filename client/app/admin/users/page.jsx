'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { 
  Users, UserCheck, Crown, UserPlus, Search, Filter, Eye, Mail, 
  Phone, Calendar, Ticket, ChevronRight, X, Star, TrendingUp, 
  ShieldCheck, AlertTriangle, Plus, CheckCircle, RefreshCw, Edit3, User
} from 'lucide-react'

import { API_BASE } from '../../lib/api'

const glass = (extra = {}) => ({
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.95)',
  borderRadius: 16,
  boxShadow: '0 4px 28px rgba(148,163,184,0.1), 0 1px 4px rgba(148,163,184,0.06)',
  ...extra,
})

const ROLE_BADGES = {
  ADMIN:    { bg: '#FFF1F2', c: '#E11D48', label: 'Admin' },
  MANAGER:  { bg: '#F5F3FF', c: '#7C3AED', label: 'Manager' },
  REVIEWER: { bg: '#FFFBEB', c: '#D97706', label: 'Reviewer' },
  AGENT:    { bg: '#EFF6FF', c: '#2563EB', label: 'Agent' },
  CUSTOMER: { bg: '#F8FAFC', c: '#64748B', label: 'Customer' },
}

const ROLES_LIST = ['AGENT', 'REVIEWER', 'MANAGER', 'ADMIN']
const DEPTS_LIST = ['Ebook', 'Cloud', 'Logistics', 'Finance', 'Quality', 'Operations']

export default function UsersPage() {
  const [users, setUsers]         = useState([])
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleF]    = useState('All')
  const [loading, setLoading]     = useState(false)

  // Create Staff Modal State
  const [showCreateModal, setShowCreate] = useState(false)
  const [staffForm, setStaffForm]         = useState({ 
    name: '', email: '', role: 'AGENT', department: 'Ebook', department_id: '', reporting_manager_id: '' 
  })
  const [deptsList, setDeptsList]         = useState([])
  const [managersList, setManagersList]   = useState([])
  const [createLoading, setCreateLoad]    = useState(false)
  const [createSuccessMsg, setSuccessMsg] = useState('')
  const [createdTempPwd, setCreatedTemp]  = useState('')

  // Edit Staff Modal State
  const [editModalUser, setEditModalUser] = useState(null)
  const [editForm, setEditForm]           = useState({ 
    user_id: '', name: '', email: '', role: 'AGENT', department: '', department_id: '', reporting_manager_id: '' 
  })
  const [editManagersList, setEditMgrs]   = useState([])
  const [editLoading, setEditLoading]     = useState(false)

  // Deactivation Modal State
  const [deactModalUser, setDeactModal]   = useState(null)
  const [deactReason, setReason]         = useState('')
  const [reasonErr, setReasonErr]       = useState('')

  useEffect(() => {
    fetchUsers()
    fetchDepartmentsList()
  }, [])

  const fetchDepartmentsList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/departments`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setDeptsList(data)
          const activeDepts = data.filter(d => d.status === 'ACTIVE')
          const first = activeDepts[0] || data[0]
          if (first) {
            setStaffForm(prev => ({ ...prev, department: first.name, department_id: first.dept_id }))
            fetchManagersForDept(first.dept_id, first.name, setManagersList)
          }
        }
      }
    } catch (e) {}
  }

  const fetchManagersForDept = async (deptId, deptName, setter = setManagersList) => {
    try {
      const q = deptId ? `department_id=${encodeURIComponent(deptId)}` : `department=${encodeURIComponent(deptName)}`
      const res = await fetch(`${API_BASE}/api/admin/managers?${q}`)
      if (res.ok) {
        const data = await res.json()
        setter(data)
        return data
      }
    } catch (e) {}
    setter([])
    return []
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const mapped = data.map(u => ({
            id: u.user_id || u._id,
            user_id: u.user_id || u._id,
            name: u.name,
            email: u.email,
            phone: u.phone || '—',
            department: u.department || 'General',
            department_id: u.department_id || null,
            reporting_manager_id: u.reporting_manager_id || null,
            reporting_manager_name: u.reporting_manager_name || null,
            type: u.department || u.role,
            role: (u.role || 'CUSTOMER').toUpperCase(),
            joined: u.created_at ? u.created_at.slice(0, 10) : 'Sep 2026',
            status: u.status || 'ACTIVE',
            deactivation_reason: u.deactivation_reason,
            avatar: (u.name || 'U').charAt(0).toUpperCase()
          }))
          setUsers(mapped)
        }
      }
    } catch (e) {
    } finally {
      setLoading(false)
    }
  }

  // Handle department change in Create Staff form
  const handleCreateDeptChange = (val) => {
    const found = deptsList.find(d => d.dept_id === val || d.name === val)
    const newDeptName = found ? found.name : val
    const newDeptId = found ? found.dept_id : ''
    setStaffForm(prev => ({
      ...prev,
      department: newDeptName,
      department_id: newDeptId,
      reporting_manager_id: ''
    }))
    fetchManagersForDept(newDeptId, newDeptName, setManagersList)
  }

  // Handle department change in Edit Staff form
  const handleEditDeptChange = (val) => {
    const found = deptsList.find(d => d.dept_id === val || d.name === val)
    const newDeptName = found ? found.name : val
    const newDeptId = found ? found.dept_id : ''
    setEditForm(prev => ({
      ...prev,
      department: newDeptName,
      department_id: newDeptId,
      reporting_manager_id: ''
    }))
    fetchManagersForDept(newDeptId, newDeptName, setEditMgrs)
  }

  // Open Edit Modal
  const openEditModal = (u) => {
    setEditModalUser(u)
    setEditForm({
      user_id: u.user_id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      department_id: u.department_id || '',
      reporting_manager_id: u.reporting_manager_id || ''
    })
    fetchManagersForDept(u.department_id, u.department, setEditMgrs)
  }

  // Create Staff Handler connecting with Backend API
  const handleCreateStaff = async (e) => {
    e.preventDefault()
    if (!staffForm.name || !staffForm.email || !staffForm.department) return

    if (staffForm.role === 'AGENT' && !staffForm.reporting_manager_id) {
      alert(`Reporting Manager is required for AGENT role. Please select an active Manager from ${staffForm.department}.`)
      return
    }

    setCreateLoad(true)
    setSuccessMsg('')
    setCreatedTemp('')

    try {
      const payload = { ...staffForm }
      if (payload.role === 'REVIEWER') {
        payload.department = payload.department || 'All Departments'
        payload.department_id = payload.department_id || 'DEP-ALL'
        payload.reporting_manager_id = ''
      }

      const res = await fetch(`${API_BASE}/api/admin/create-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || 'Failed to create staff member.')
        setCreateLoad(false)
        return
      }

      setCreatedTemp(data.temp_password)
      setSuccessMsg(`Staff ${staffForm.name} created successfully! Temporary credentials emailed.`)
      fetchUsers()
    } catch (err) {
      alert('Error connecting to backend server.')
    } finally {
      setCreateLoad(false)
    }
  }

  // Update Staff Handler
  const handleUpdateStaff = async (e) => {
    e.preventDefault()
    if (!editForm.name || !editForm.email) return

    if (editForm.role === 'AGENT' && !editForm.reporting_manager_id) {
      alert(`Reporting Manager is required for AGENT role.`)
      return
    }

    setEditLoading(true)
    try {
      const payload = { ...editForm }
      if (payload.role === 'REVIEWER') {
        payload.department = payload.department || 'All Departments'
        payload.department_id = payload.department_id || 'DEP-ALL'
        payload.reporting_manager_id = ''
      }

      const res = await fetch(`${API_BASE}/api/admin/users/${editModalUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || 'Failed to update staff member.')
        setEditLoading(false)
        return
      }

      alert(`Staff member ${editForm.name} updated successfully!`)
      setEditModalUser(null)
      fetchUsers()
    } catch (err) {
      alert('Error updating user.')
    } finally {
      setEditLoading(false)
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
      fetchUsers()
    } catch {}
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
      fetchUsers()
    } catch {}
    setDeactModal(null)
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                         u.email.toLowerCase().includes(search.toLowerCase()) ||
                         (u.department && u.department.toLowerCase().includes(search.toLowerCase()))
    const matchRole   = roleFilter === 'All' || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@company.com" />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar title="User & Staff Hierarchy Management" subtitle="Dynamic role hierarchy, department routing, and manager assignment" />

        <main style={{ flex:1, padding:22, overflowY:'auto', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Stats Bar */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:13 }}>
            <StatCard title="Total Staff"       value={users.filter(u => u.role !== 'CUSTOMER').length} subtitle="Staff accounts"   icon={Users}       color="violet"  delay={0}   />
            <StatCard title="Active Managers"   value={users.filter(u => u.role === 'MANAGER' && u.status === 'ACTIVE').length} subtitle="Supervising depts" icon={Crown} color="amber"   delay={60}  />
            <StatCard title="Support Agents"    value={users.filter(u => u.role === 'AGENT').length} subtitle="Frontline claimers" icon={UserCheck}   color="emerald" delay={120} />
            <StatCard title="Reviewers"         value={users.filter(u => u.role === 'REVIEWER').length} subtitle="Quality audit"      icon={ShieldCheck} color="rose"    delay={180} />
          </div>

          {/* Create Staff Modal */}
          {showCreateModal && (
            <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
              <div className="animate-scale-in" style={{ ...glass(), maxWidth:500, width:'100%', padding:26 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
                      <UserPlus size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize:16, fontWeight:700, color:'#0F172A' }}>Add Staff Member</h3>
                      <p style={{ fontSize:11, color:'#94A3B8' }}>Enforces department hierarchy & credentials email</p>
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
                        <input required value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="e.g. Tariq Khan" style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Email Address *</label>
                        <input required type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} placeholder="tariq@company.com" style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Role *</label>
                        <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none', cursor:'pointer' }}>
                          {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Department *</label>
                        <select
                          value={staffForm.department_id || staffForm.department}
                          onChange={e => handleCreateDeptChange(e.target.value)}
                          style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none', cursor:'pointer' }}
                        >
                          {staffForm.role === 'REVIEWER' && (
                            <option value="All Departments">🌐 All Departments (Cross-Department)</option>
                          )}
                          {deptsList.length > 0 ? (
                            deptsList.map(d => (
                              <option key={d.dept_id || d.name} value={d.dept_id || d.name}>
                                {d.name} ({d.code || 'DEP'})
                              </option>
                            ))
                          ) : (
                            DEPTS_LIST.map(d => <option key={d} value={d}>{d}</option>)
                          )}
                        </select>
                      </div>

                      {/* Reviewer Cross-Department Notice */}
                      {staffForm.role === 'REVIEWER' && (
                        <div style={{ gridColumn: 'span 2', marginTop: 4, background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 14px', borderRadius: 10, fontSize: 12, color: '#B45309', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 18 }}>⚖️</span>
                          <div>
                            <strong style={{ display: 'block', marginBottom: 2 }}>Independent Reviewer (Global Cross-Department Access)</strong>
                            <span>Reviewers operate across all departments and complaint queues with direct administrative audit capability. Not assigned under any department manager.</span>
                          </div>
                        </div>
                      )}

                      {/* Dynamic Reporting Manager Field for Agent Only */}
                      {staffForm.role === 'AGENT' && (
                        <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
                          <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
                            Reporting Manager (Filtered to {staffForm.department || 'Department'}) *
                          </label>
                          <select
                            required
                            value={staffForm.reporting_manager_id || ''}
                            onChange={e => setStaffForm({ ...staffForm, reporting_manager_id: e.target.value })}
                            style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #C4B5FD', background:'#FAF5FF', fontSize:13, outline:'none', cursor:'pointer' }}
                          >
                            <option value="">-- Select Active Department Manager --</option>
                            {managersList.map(m => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.name} ({m.email})
                              </option>
                            ))}
                          </select>
                          {managersList.length === 0 && (
                            <p style={{ fontSize:11, color:'#DC2626', margin:'5px 0 0' }}>
                              ⚠️ No active Managers exist in {staffForm.department}. Please create a Manager for this department first!
                            </p>
                          )}
                        </div>
                      )}
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

          {/* Edit Staff Modal */}
          {editModalUser && (
            <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
              <div className="animate-scale-in" style={{ ...glass(), maxWidth:500, width:'100%', padding:26 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#2563EB,#1D4ED8)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
                      <Edit3 size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize:16, fontWeight:700, color:'#0F172A' }}>Edit Staff Member</h3>
                      <p style={{ fontSize:11, color:'#94A3B8' }}>Update role hierarchy, department & reporting supervisor</p>
                    </div>
                  </div>
                  <button onClick={() => setEditModalUser(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8' }}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleUpdateStaff}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Full Name *</label>
                      <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none' }} />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Email Address *</label>
                      <input required type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none' }} />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Role *</label>
                      <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none', cursor:'pointer' }}>
                        {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Department *</label>
                      <select
                        value={editForm.department_id || editForm.department}
                        onChange={e => handleEditDeptChange(e.target.value)}
                        style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none', cursor:'pointer' }}
                      >
                        {editForm.role === 'REVIEWER' && (
                          <option value="All Departments">🌐 All Departments (Cross-Department)</option>
                        )}
                        {deptsList.length > 0 ? (
                          deptsList.map(d => (
                            <option key={d.dept_id || d.name} value={d.dept_id || d.name}>
                              {d.name} ({d.code || 'DEP'})
                            </option>
                          ))
                        ) : (
                          DEPTS_LIST.map(d => <option key={d} value={d}>{d}</option>)
                        )}
                      </select>
                    </div>

                    {/* Reviewer Cross-Department Notice */}
                    {editForm.role === 'REVIEWER' && (
                      <div style={{ gridColumn: 'span 2', marginTop: 4, background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 14px', borderRadius: 10, fontSize: 12, color: '#B45309', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>⚖️</span>
                        <div>
                          <strong style={{ display: 'block', marginBottom: 2 }}>Independent Reviewer (Global Cross-Department Access)</strong>
                          <span>Reviewers operate across all departments with direct administrative audit capability. Not bound to any department manager.</span>
                        </div>
                      </div>
                    )}

                    {/* Dynamic Reporting Manager for Agent Only */}
                    {editForm.role === 'AGENT' && (
                      <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
                        <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
                          Reporting Manager (Filtered to {editForm.department || 'Department'}) *
                        </label>
                        <select
                          required
                          value={editForm.reporting_manager_id || ''}
                          onChange={e => setEditForm({ ...editForm, reporting_manager_id: e.target.value })}
                          style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #C4B5FD', background:'#FAF5FF', fontSize:13, outline:'none', cursor:'pointer' }}
                        >
                          <option value="">-- Select Active Department Manager --</option>
                          {editManagersList.map(m => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.name} ({m.email})
                            </option>
                          ))}
                        </select>
                        {editManagersList.length === 0 && (
                          <p style={{ fontSize:11, color:'#DC2626', margin:'5px 0 0' }}>
                            ⚠️ No active Managers found for {editForm.department}. Please assign or create a Manager for this department!
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop: 16 }}>
                    <button type="button" onClick={() => setEditModalUser(null)} style={{ padding:'9px 16px', borderRadius:10, border:'1.5px solid rgba(226,232,240,0.8)', background:'transparent', color:'#64748B', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={editLoading} style={{ padding:'9px 20px', borderRadius:10, background:'linear-gradient(135deg,#2563EB,#1D4ED8)', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                      {editLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Save Changes'}
                    </button>
                  </div>
                </form>
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

                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#E11D48', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
                    Deactivation Reason (Mandatory) *
                  </label>
                  <textarea
                    rows={3}
                    value={deactReason}
                    onChange={e => { setReason(e.target.value); setReasonErr('') }}
                    placeholder="Enter official reason for revoking portal access..."
                    style={{ width:'100%', padding:'9px 12px', borderRadius:10, border: reasonErr ? '1.5px solid #E11D48' : '1.5px solid rgba(226,232,240,0.8)', background:'rgba(248,250,252,0.9)', fontSize:13, outline:'none' }}
                  />
                  {reasonErr && <p style={{ fontSize:11, color:'#E11D48', margin:'4px 0 0' }}>{reasonErr}</p>}
                </div>

                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button onClick={() => setDeactModal(null)} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid #CBD5E1', background:'transparent', color:'#64748B', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={confirmDeactivation} style={{ padding:'8px 18px', borderRadius:10, background:'#E11D48', color:'white', border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    Confirm Deactivation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User Table Card */}
          <div style={{ ...glass(), padding:22 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
              <div>
                <h3 style={{ fontSize:16, fontWeight:700, color:'#0F172A' }}>All Users & Staff Members</h3>
                <p style={{ fontSize:12, color:'#94A3B8' }}>Showing {filtered.length} registered accounts across departments</p>
              </div>

              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(248,250,252,0.8)', border:'1.5px solid rgba(226,232,240,0.8)', borderRadius:10, padding:'6px 12px' }}>
                  <Search size={14} color="#94A3B8" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, dept…" style={{ background:'none', border:'none', outline:'none', color:'#0F172A', fontSize:13, width:170 }} />
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
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
                <thead>
                  <tr style={{ background:'rgba(248,250,252,0.8)' }}>
                    {['User','Role','Department','Reporting Manager','Joined','Status','Actions'].map(h => (
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
                              <div style={{ fontSize:11, color:'#94A3B8' }}>{u.email} <span style={{ fontFamily:'monospace', color:'#7C3AED' }}>({u.user_id})</span></div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:6, background:rb.bg, color:rb.c, fontWeight:700, border:`1px solid ${rb.c}25` }}>{rb.label}</span>
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12, color:'#334155', fontWeight:500 }}>
                          {u.department} {u.department_id ? <span style={{ fontFamily:'monospace', fontSize:10, color:'#059669', background:'#ECFDF5', padding:'1px 5px', borderRadius:4 }}>{u.department_id}</span> : null}
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:12 }}>
                          {u.role === 'AGENT' || u.role === 'REVIEWER' ? (
                            u.reporting_manager_name ? (
                              <span style={{ fontSize:11, color:'#7C3AED', fontWeight:600, background:'#F5F3FF', padding:'3px 8px', borderRadius:6, border:'1px solid #DDD6FE' }}>
                                👤 {u.reporting_manager_name}
                              </span>
                            ) : (
                              <span style={{ fontSize:11, color:'#DC2626', fontWeight:600, background:'#FEF2F2', padding:'3px 8px', borderRadius:6, border:'1px solid #FECACA' }}>
                                ⚠️ Needs Manager
                              </span>
                            )
                          ) : u.role === 'MANAGER' ? (
                            <span style={{ fontSize:11, color:'#059669', fontWeight:600, background:'#ECFDF5', padding:'3px 8px', borderRadius:6, border:'1px solid #A7F3D0' }}>
                              ⭐ Department Head
                            </span>
                          ) : (
                            <span style={{ color:'#94A3B8', fontSize:12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)', fontSize:11, color:'#94A3B8' }}>{u.joined}</td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background: isActive ? '#ECFDF5' : '#FFF1F2', color: isActive ? '#059669' : '#E11D48', border:`1px solid ${isActive ? 'rgba(5,150,105,0.25)' : 'rgba(225,29,72,0.25)'}` }}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ padding:'13px 14px', borderBottom:'1px solid rgba(226,232,240,0.3)' }}>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <button
                              onClick={() => openEditModal(u)}
                              style={{
                                padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
                                background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                                display:'inline-flex', alignItems:'center', gap:4
                              }}
                            >
                              <Edit3 size={11} /> Edit
                            </button>

                            <button
                              onClick={() => handleToggleStatus(u, isActive ? 'INACTIVE' : 'ACTIVE')}
                              style={{
                                padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer',
                                background: isActive ? 'rgba(225,29,72,0.08)' : 'rgba(5,150,105,0.08)',
                                color: isActive ? '#E11D48' : '#059669',
                                border: `1px solid ${isActive ? 'rgba(225,29,72,0.2)' : 'rgba(5,150,105,0.2)'}`,
                              }}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
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
        </main>
      </div>
    </div>
  )
}
