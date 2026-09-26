'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import {
  Building2, Plus, Search, Filter, Edit3, Trash2, CheckCircle,
  XCircle, Users, RefreshCw, X, ShieldCheck, AlertCircle, Sparkles
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

const INITIAL_DEPTS = [
  { dept_id: 'DEP-101', name: 'Logistics', code: 'LOG', description: 'Handles shipping, tracking, delivery delays, and warehouse ops.', status: 'ACTIVE', member_count: 5 },
  { dept_id: 'DEP-102', name: 'Finance', code: 'FIN', description: 'Handles refunds, billing disputes, payments, and invoices.', status: 'ACTIVE', member_count: 4 },
  { dept_id: 'DEP-103', name: 'Quality', code: 'QUAL', description: 'Audit, quality assurance, compliance, and resolution reviews.', status: 'ACTIVE', member_count: 2 },
  { dept_id: 'DEP-104', name: 'Fulfillment', code: 'FUL', description: 'Order packing, wrong item shipments, and inventory control.', status: 'ACTIVE', member_count: 3 },
  { dept_id: 'DEP-105', name: 'Operations', code: 'OPS', description: 'Overall service operations and process optimization.', status: 'ACTIVE', member_count: 4 },
  { dept_id: 'DEP-106', name: 'Customer Experience', code: 'CX', description: 'Direct customer support and SLA satisfaction team.', status: 'ACTIVE', member_count: 6 },
]

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState(INITIAL_DEPTS)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading]           = useState(false)

  // Create Modal State
  const [showCreateModal, setShowCreate] = useState(false)
  const [createForm, setCreateForm]       = useState({ name: '', code: '', description: '', status: 'ACTIVE' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createErr, setCreateErr]         = useState('')

  // Edit Modal State
  const [editDept, setEditDept]         = useState(null)
  const [editForm, setEditForm]         = useState({ name: '', code: '', description: '', status: 'ACTIVE' })
  const [editLoading, setEditLoading]   = useState(false)
  const [editErr, setEditErr]           = useState('')

  // Delete Modal State
  const [deleteDept, setDeleteDept]     = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Success Toast state
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    fetchDepartments()
  }, [])

  const triggerToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/departments`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setDepartments(data)
        }
      }
    } catch (err) {
      console.log('Using default mock departments (backend API unreachable)')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!createForm.name || !createForm.code) {
      setCreateErr('Department Name and Code are required.')
      return
    }

    setCreateLoading(true)
    setCreateErr('')

    try {
      const res = await fetch(`${API_BASE}/api/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create department')
      }

      triggerToast(`Department '${createForm.name}' created successfully!`)
      setShowCreate(false)
      setCreateForm({ name: '', code: '', description: '', status: 'ACTIVE' })
      fetchDepartments()
    } catch (err) {
      // Fallback for offline UI testing
      setCreateErr(err.message || 'Error connecting to backend API')
      const newMock = {
        dept_id: `DEP-${Date.now().toString().slice(-3)}`,
        name: createForm.name,
        code: createForm.code.toUpperCase(),
        description: createForm.description,
        status: createForm.status,
        member_count: 0
      }
      setDepartments(prev => [newMock, ...prev])
      triggerToast(`Department '${createForm.name}' created successfully!`)
      setShowCreate(false)
      setCreateForm({ name: '', code: '', description: '', status: 'ACTIVE' })
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEditOpen = (dept) => {
    setEditDept(dept)
    setEditForm({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      status: dept.status || 'ACTIVE'
    })
    setEditErr('')
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editDept) return

    setEditLoading(true)
    setEditErr('')

    try {
      const res = await fetch(`${API_BASE}/api/departments/${editDept.dept_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update department')
      }

      triggerToast(`Department '${editForm.name}' updated!`)
      setEditDept(null)
      fetchDepartments()
    } catch (err) {
      // Fallback for offline update
      setDepartments(prev => prev.map(d => d.dept_id === editDept.dept_id ? { ...d, ...editForm } : d))
      triggerToast(`Department '${editForm.name}' updated!`)
      setEditDept(null)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDept) return
    setDeleteLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/departments/${deleteDept.dept_id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        triggerToast(`Department '${deleteDept.name}' deleted.`)
      }
    } catch (err) {
      console.log('API call failed, deleting locally')
    } finally {
      setDepartments(prev => prev.filter(d => d.dept_id !== deleteDept.dept_id))
      setDeleteLoading(false)
      setDeleteDept(null)
    }
  }

  // Filtered List
  const filteredDepartments = departments.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
                        d.code.toLowerCase().includes(search.toLowerCase()) ||
                        (d.description && d.description.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'All' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  // Analytics Stats
  const totalDepts  = departments.length
  const activeDepts = departments.filter(d => d.status === 'ACTIVE').length
  const totalMembers = departments.reduce((acc, d) => acc + (d.member_count || 0), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@novawearapparel.com" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        <Navbar title="Department Management" subtitle="Create, edit, and organize system departments & user assignments" />

        <main style={{ padding: '24px 32px', flex: 1 }}>

          {/* Toast Notification */}
          {toastMsg && (
            <div style={{
              position: 'fixed', top: 24, right: 32, zIndex: 9999,
              background: '#0F172A', color: '#FFF', padding: '12px 20px', borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 14, fontWeight: 600
            }}>
              <CheckCircle size={18} color="#10B981" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
                Departments Directory
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
                Manage organizational departments and link assigned staff members.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={fetchDepartments}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11,
                  border: '1px solid #E2E8F0', background: '#FFF', color: '#475569', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                Refresh
              </button>

              <button
                onClick={() => { setShowCreate(true); setCreateErr(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 11,
                  border: 'none', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', color: '#FFF',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <Plus size={16} />
                Create Department
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Departments" value={totalDepts} icon={Building2} iconBg="#F5F3FF" iconColor="#7C3AED" />
            <StatCard label="Active Departments" value={activeDepts} icon={CheckCircle} iconBg="#ECFDF5" iconColor="#059669" />
            <StatCard label="Inactive / Suspended" value={totalDepts - activeDepts} icon={XCircle} iconBg="#FEF2F2" iconColor="#EF4444" />
            <StatCard label="Total Staff Assigned" value={totalMembers} icon={Users} iconBg="#EFF6FF" iconColor="#2563EB" />
          </div>

          {/* Search & Filter */}
          <div style={{ ...glass(), padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search departments by name, code, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 42px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, background: '#FFF', outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} color="#64748B" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '9px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                  background: '#FFF', fontSize: 13, fontWeight: 600, color: '#1E293B', outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="All">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Departments Grid Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {filteredDepartments.map((dept) => (
              <div
                key={dept.dept_id}
                style={{
                  ...glass(),
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                      background: '#F1F5F9', color: '#475569', letterSpacing: '0.5px'
                    }}>
                      {dept.code}
                    </span>

                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: dept.status === 'ACTIVE' ? '#ECFDF5' : '#FEF2F2',
                      color: dept.status === 'ACTIVE' ? '#059669' : '#EF4444'
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dept.status === 'ACTIVE' ? '#10B981' : '#EF4444' }} />
                      {dept.status}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
                    {dept.name}
                  </h3>

                  <p style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.5, margin: '0 0 16px', minHeight: 38 }}>
                    {dept.description || 'No description provided.'}
                  </p>
                </div>

                <div style={{ paddingTop: 14, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12, fontWeight: 600 }}>
                    <Users size={14} color="#7C3AED" />
                    <span>{dept.member_count || 0} Staff Assigned</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleEditOpen(dept)}
                      title="Edit Department"
                      style={{
                        padding: 7, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF',
                        color: '#475569', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={() => setDeleteDept(dept)}
                      title="Delete Department"
                      style={{
                        padding: 7, borderRadius: 8, border: '1px solid #FEE2E2', background: '#FEF2F2',
                        color: '#EF4444', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredDepartments.length === 0 && (
            <div style={{ ...glass(), padding: 48, textAlign: 'center', color: '#64748B' }}>
              <Building2 size={36} color="#CBD5E1" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: '0 0 4px' }}>No Departments Found</h3>
              <p style={{ fontSize: 13, margin: 0 }}>Try clearing your search query or filter options.</p>
            </div>
          )}

        </main>
      </div>

      {/* CREATE DEPARTMENT MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 480, padding: 28, background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} color="#7C3AED" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Create Department</h2>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Add a new organizational unit to the system</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {createErr && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                <span>{createErr}</span>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Department Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Customer Support, Billing & Refunds"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Department Code *</label>
                <input
                  type="text"
                  placeholder="e.g., LOG, FIN, SUP"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', textTransform: 'uppercase' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe the functions of this department..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Initial Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#FFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    padding: '10px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: createLoading ? 0.7 : 1
                  }}
                >
                  {createLoading ? 'Saving...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DEPARTMENT MODAL */}
      {editDept && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 480, padding: 28, background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={18} color="#7C3AED" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Edit Department</h2>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Update details for {editDept.name}</p>
                </div>
              </div>
              <button onClick={() => setEditDept(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {editErr && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                {editErr}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Department Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Department Code</label>
                <input
                  type="text"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', textTransform: 'uppercase' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditDept(null)}
                  style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#FFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{
                    padding: '10px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: editLoading ? 0.7 : 1
                  }}
                >
                  {editLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteDept && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 420, padding: 28, background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={22} color="#EF4444" />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>Delete Department?</h3>
                <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>This action cannot be undone.</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to delete <strong>{deleteDept.name} ({deleteDept.code})</strong>?
              {deleteDept.member_count > 0 && (
                <span style={{ display: 'block', marginTop: 8, color: '#DC2626', fontWeight: 600 }}>
                  ⚠️ Warning: {deleteDept.member_count} staff members assigned to this department will be set to unassigned.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteDept(null)}
                style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#FFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: '10px 22px', borderRadius: 9, border: 'none', background: '#DC2626',
                  color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleteLoading ? 0.7 : 1
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Department'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
