'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import {
  FolderTree, Plus, Search, Filter, Edit3, Trash2, CheckCircle,
  XCircle, BookOpen, RefreshCw, X, AlertCircle, Sparkles, Tag
} from 'lucide-react'

import { API_BASE } from '../../lib/api'

const glass = (extra = {}) => ({
  background: 'var(--nw-glass-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--nw-glass-border)',
  borderRadius: 16,
  boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
  ...extra,
})

const INITIAL_CATS = [
  { cat_id: 'CAT-101', name: 'Delivery', code: 'DEL', description: 'Shipping delays, SLA breaches, tracking issues.', status: 'ACTIVE', policy_count: 5 },
  { cat_id: 'CAT-102', name: 'Refund', code: 'REF', description: 'Duplicate charges, defective returns, gateway refunds.', status: 'ACTIVE', policy_count: 4 },
  { cat_id: 'CAT-103', name: 'Replacement', code: 'REP', description: 'Wrong item delivered, damaged in transit.', status: 'ACTIVE', policy_count: 3 },
  { cat_id: 'CAT-104', name: 'Warranty', code: 'WAR', description: 'Manufacturer warranty, extended policy claims.', status: 'ACTIVE', policy_count: 2 },
  { cat_id: 'CAT-105', name: 'Billing', code: 'BIL', description: 'Invoice discrepancies, payment failures, double billing.', status: 'ACTIVE', policy_count: 4 },
  { cat_id: 'CAT-106', name: 'Quality', code: 'QUAL', description: 'Product quality audits and customer feedback reviews.', status: 'ACTIVE', policy_count: 3 },
  { cat_id: 'CAT-107', name: 'General', code: 'GEN', description: 'General customer service SOPs and standard terms.', status: 'ACTIVE', policy_count: 6 },
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState(INITIAL_CATS)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusF]  = useState('All')
  const [loading, setLoading]       = useState(false)

  // Create Modal State
  const [showCreateModal, setShowCreate] = useState(false)
  const [createForm, setCreateForm]       = useState({ name: '', code: '', description: '', status: 'ACTIVE' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createErr, setCreateErr]         = useState('')

  // Edit Modal State
  const [editCat, setEditCat]           = useState(null)
  const [editForm, setEditForm]         = useState({ name: '', code: '', description: '', status: 'ACTIVE' })
  const [editLoading, setEditLoading]   = useState(false)
  const [editErr, setEditErr]           = useState('')

  // Delete Modal State
  const [deleteCat, setDeleteCat]       = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Toast
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  const triggerToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/categories`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data)
        }
      }
    } catch (err) {
      console.log('Using initial mock categories')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!createForm.name || !createForm.code) {
      setCreateErr('Category Name and Code are required.')
      return
    }

    setCreateLoading(true)
    setCreateErr('')

    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create category')
      }

      triggerToast(`Category '${createForm.name}' created successfully!`)
      setShowCreate(false)
      setCreateForm({ name: '', code: '', description: '', status: 'ACTIVE' })
      fetchCategories()
    } catch (err) {
      setCreateErr(err.message || 'Error connecting to backend API')
      const newMock = {
        cat_id: `CAT-${Date.now().toString().slice(-3)}`,
        name: createForm.name,
        code: createForm.code.toUpperCase(),
        description: createForm.description,
        status: createForm.status,
        policy_count: 0
      }
      setCategories(prev => [newMock, ...prev])
      triggerToast(`Category '${createForm.name}' created!`)
      setShowCreate(false)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEditOpen = (cat) => {
    setEditCat(cat)
    setEditForm({
      name: cat.name,
      code: cat.code,
      description: cat.description || '',
      status: cat.status || 'ACTIVE'
    })
    setEditErr('')
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editCat) return

    setEditLoading(true)
    setEditErr('')

    try {
      const res = await fetch(`${API_BASE}/api/categories/${editCat.cat_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update category')
      }

      triggerToast(`Category '${editForm.name}' updated!`)
      setEditCat(null)
      fetchCategories()
    } catch (err) {
      setCategories(prev => prev.map(c => c.cat_id === editCat.cat_id ? { ...c, ...editForm } : c))
      triggerToast(`Category '${editForm.name}' updated!`)
      setEditCat(null)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteCat) return
    setDeleteLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/categories/${deleteCat.cat_id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        triggerToast(`Category '${deleteCat.name}' deleted.`)
      }
    } catch (err) {
      console.log('Error deleting category')
    } finally {
      setCategories(prev => prev.filter(c => c.cat_id !== deleteCat.cat_id))
      setDeleteLoading(false)
      setDeleteCat(null)
    }
  }

  // Filtered List
  const filteredCategories = categories.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.code.toLowerCase().includes(search.toLowerCase()) ||
                        (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'All' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  // Analytics Stats
  const totalCats   = categories.length
  const activeCats  = categories.filter(c => c.status === 'ACTIVE').length
  const totalPoliciesLinked = categories.reduce((acc, c) => acc + (c.policy_count || 0), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--nw-base)' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@novawearapparel.com" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        <Navbar title="Category Management" subtitle="Manage policy and complaint resolution categories with foreign key linkage" />

        <main className="responsive-main-padding" style={{ padding: '24px 32px', flex: 1 }}>

          {/* Toast Notification */}
          {toastMsg && (
            <div style={{
              position: 'fixed', top: 24, right: 32, zIndex: 9999,
              background: 'var(--nw-surface)', color: 'var(--nw-text-primary)', padding: '12px 20px', borderRadius: 12,
              boxShadow: '0 10px 30px rgba(11,14,20,0.4)', display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 14, fontWeight: 600, border: '1px solid var(--nw-border-strong)'
            }}>
              <CheckCircle size={18} color="#4FA689" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                Category Directory
              </h1>
              <p style={{ fontSize: 13, color: 'var(--nw-text-secondary)', margin: '4px 0 0' }}>
                Define policy classification categories dynamically linked across all KB documents.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={fetchCategories}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11,
                  border: '1px solid var(--nw-border-strong)', background: 'var(--nw-surface)', color: 'var(--nw-text-secondary)', fontSize: 13, fontWeight: 600,
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
                  border: 'none', background: 'linear-gradient(135deg, #C96F4A, #C1495B)', color: '#FFF',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(201,111,74,0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <Plus size={16} />
                Create Category
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Categories" value={totalCats} icon={FolderTree} iconBg="var(--nw-accent-dim)" iconColor="#C96F4A" />
            <StatCard label="Active Categories" value={activeCats} icon={CheckCircle} iconBg="var(--nw-success-dim)" iconColor="#4FA689" />
            <StatCard label="Inactive Categories" value={totalCats - activeCats} icon={XCircle} iconBg="var(--nw-danger-dim)" iconColor="#C1495B" />
            <StatCard label="Linked Policies" value={totalPoliciesLinked} icon={BookOpen} iconBg="var(--nw-info-dim)" iconColor="#4A9BC9" />
          </div>

          {/* Search & Filter */}
          <div style={{ ...glass(), padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={16} color="var(--nw-text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search categories by name, code, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 42px', borderRadius: 10, border: '1px solid var(--nw-border-strong)',
                  fontSize: 13, background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} color="var(--nw-text-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nw-text-secondary)' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusF(e.target.value)}
                style={{
                  padding: '9px 14px', borderRadius: 10, border: '1px solid var(--nw-border-strong)',
                  background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="All">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Categories Grid Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {filteredCategories.map((cat) => (
              <div
                key={cat.cat_id}
                style={{
                  ...glass(),
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                      background: 'var(--nw-elevated)', color: 'var(--nw-text-secondary)', letterSpacing: '0.5px'
                    }}>
                      {cat.code}
                    </span>

                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: cat.status === 'ACTIVE' ? 'var(--nw-success-dim)' : 'var(--nw-danger-dim)',
                      color: cat.status === 'ACTIVE' ? '#4FA689' : '#E8758A'
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.status === 'ACTIVE' ? '#4FA689' : '#E8758A' }} />
                      {cat.status}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--nw-text-primary)', margin: '0 0 6px' }}>
                    {cat.name}
                  </h3>

                  <p style={{ fontSize: 12.5, color: 'var(--nw-text-secondary)', lineHeight: 1.5, margin: '0 0 16px', minHeight: 38 }}>
                    {cat.description || 'No description provided.'}
                  </p>
                </div>

                <div style={{ paddingTop: 14, borderTop: '1px solid var(--nw-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--nw-text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    <BookOpen size={14} color="var(--nw-accent)" />
                    <span>{cat.policy_count || 0} Linked Policies</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleEditOpen(cat)}
                      title="Edit Category"
                      style={{
                        padding: 7, borderRadius: 8, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)',
                        color: 'var(--nw-text-secondary)', cursor: 'pointer'
                      }}
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={() => setDeleteCat(cat)}
                      title="Delete Category"
                      style={{
                        padding: 7, borderRadius: 8, border: '1px solid rgba(193,73,91,0.3)', background: 'var(--nw-danger-dim)',
                        color: '#E8758A', cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div style={{ ...glass(), padding: 48, textAlign: 'center', color: 'var(--nw-text-secondary)' }}>
              <FolderTree size={36} color="var(--nw-text-muted)" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--nw-text-primary)', margin: '0 0 4px' }}>No Categories Found</h3>
              <p style={{ fontSize: 13, margin: 0 }}>Try clearing your search query or filter options.</p>
            </div>
          )}

        </main>
      </div>

      {/* CREATE CATEGORY MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'var(--nw-overlay)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(480px, 94vw)', padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nw-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FolderTree size={18} color="var(--nw-accent)" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0 }}>Create Category</h2>
                  <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', margin: 0 }}>Add a new policy classification category</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nw-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {createErr && (
              <div style={{ background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.3)', color: '#E8758A', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                <span>{createErr}</span>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Shipping Delays, Warranty Claims"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Category Code *</label>
                <input
                  type="text"
                  placeholder="e.g., DEL, REF, WAR, BIL"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none', textTransform: 'uppercase' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe what policies fall under this category..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'transparent', color: 'var(--nw-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    padding: '10px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #C96F4A, #C1495B)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: createLoading ? 0.7 : 1
                  }}
                >
                  {createLoading ? 'Saving...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {editCat && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'var(--nw-overlay)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(480px, 94vw)', padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nw-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={18} color="var(--nw-accent)" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0 }}>Edit Category</h2>
                  <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', margin: 0 }}>Update details for {editCat.name}</p>
                </div>
              </div>
              <button onClick={() => setEditCat(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nw-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {editErr && (
              <div style={{ background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.3)', color: '#E8758A', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                {editErr}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Category Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Category Code</label>
                <input
                  type="text"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none', textTransform: 'uppercase' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--nw-text-secondary)', marginBottom: 6 }}>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-elevated)', color: 'var(--nw-text-primary)', fontSize: 13, outline: 'none' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditCat(null)}
                  style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'transparent', color: 'var(--nw-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{
                    padding: '10px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #C96F4A, #C1495B)',
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
      {deleteCat && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'var(--nw-overlay)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(420px, 94vw)', padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--nw-danger-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={22} color="#E8758A" />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0 }}>Delete Category?</h3>
                <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', margin: 0 }}>This action cannot be undone.</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--nw-text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to delete category <strong style={{ color: 'var(--nw-text-primary)' }}>{deleteCat.name} ({deleteCat.code})</strong>?
              {deleteCat.policy_count > 0 && (
                <span style={{ display: 'block', marginTop: 8, color: '#E8758A', fontWeight: 600 }}>
                  ⚠️ Warning: {deleteCat.policy_count} policies linked to this category will be reset to General.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteCat(null)}
                style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--nw-border-strong)', background: 'transparent', color: 'var(--nw-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: '10px 22px', borderRadius: 9, border: 'none', background: 'var(--nw-danger)',
                  color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleteLoading ? 0.7 : 1
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
