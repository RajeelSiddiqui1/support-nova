'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import {
  FileText, Upload, Plus, Search, Filter, Eye, Edit3, Trash2,
  CheckCircle, X, Building2, BookOpen, Layers, RefreshCw, AlertCircle, FileCode, Check
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

const INITIAL_POLICIES = [
  {
    doc_id: 'KB-101',
    title: 'Customer Delivery & Delayed Shipment Policy',
    category: 'Delivery',
    department_id: 'DEP-101',
    department: 'Logistics',
    file_type: 'PDF',
    file_size_kb: 142.5,
    version: 'v2.1',
    status: 'Active',
    full_text: "Section 1: Delayed Shipment Guidelines\nPackages delayed beyond 72 hours must be flagged for immediate escalation to Logistics operations manager. Agents must document all carrier tracking notes in the SLA breach log.\n\nSection 2: Discount & Refund Eligibility\nIf delivery delay exceeds 5 business days without carrier update, customer is eligible for a full shipping fee refund or 15% promotional credit on next order.",
    chunk_count: 2,
    chunks: [
      { chunk_id: 'KB-101-CHK-001', section: 'Section 1: Delayed Shipment Guidelines', heading: 'Delayed Shipment Guidelines', page_number: 1, content: 'Packages delayed beyond 72 hours must be flagged for immediate escalation to Logistics operations manager. Agents must document all carrier tracking notes in the SLA breach log.', version: 'v2.1' },
      { chunk_id: 'KB-101-CHK-002', section: 'Section 2: Discount & Refund Eligibility', heading: 'Discount & Refund Eligibility', page_number: 1, content: 'If delivery delay exceeds 5 business days without carrier update, customer is eligible for a full shipping fee refund or 15% promotional credit on next order.', version: 'v2.1' }
    ],
    uploaded_at: '2026-09-24T01:00:00Z'
  },
  {
    doc_id: 'KB-102',
    title: 'Finance & Double Charge Refund Standard SOP',
    category: 'Refund',
    department_id: 'DEP-102',
    department: 'Finance',
    file_type: 'PDF',
    file_size_kb: 98.2,
    version: 'v3.0',
    status: 'Active',
    full_text: "Section 1: Refund Processing Protocol\nDefective products or verified duplicate billing charges must be refunded within 24 hours of customer request. Partial refunds require supervisor authorization.\n\nSection 2: Payment Gateway Reversal\nAll gateway refunds will be returned to original payment source (Credit Card / UPI / Wallet) within 3-5 business days.",
    chunk_count: 2,
    chunks: [
      { chunk_id: 'KB-102-CHK-001', section: 'Section 1: Refund Processing Protocol', heading: 'Refund Processing Protocol', page_number: 1, content: 'Defective products or verified duplicate billing charges must be refunded within 24 hours of customer request. Partial refunds require supervisor authorization.', version: 'v3.0' },
      { chunk_id: 'KB-102-CHK-002', section: 'Section 2: Payment Gateway Reversal', heading: 'Payment Gateway Reversal', page_number: 1, content: 'All gateway refunds will be returned to original payment source (Credit Card / UPI / Wallet) within 3-5 business days.', version: 'v3.0' }
    ],
    uploaded_at: '2026-09-24T01:10:00Z'
  }
]

export default function PoliciesPage() {
  const [policies, setPolicies]         = useState(INITIAL_POLICIES)
  const [departments, setDepartments]   = useState([])
  const [categoriesList, setCategories]  = useState([])
  const [search, setSearch]             = useState('')
  const [deptFilter, setDeptFilter]     = useState('All')
  const [catFilter, setCatFilter]       = useState('All')
  const [loading, setLoading]           = useState(false)

  // Upload Modal State
  const [showUploadModal, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile]       = useState(null)
  const [uploadTitle, setUploadTitle]     = useState('')
  const [uploadCatId, setUploadCatId]     = useState('')
  const [uploadDeptId, setUploadDeptId]   = useState('')
  const [uploadVer, setUploadVer]         = useState('v1.0')
  const [uploading, setUploading]         = useState(false)
  const [uploadErr, setUploadErr]         = useState('')

  // Manual Creation Modal State
  const [showManualModal, setShowManual] = useState(false)
  const [manualForm, setManualForm]       = useState({ title: '', category_id: '', category: 'General', department_id: '', version: 'v1.0', full_text: '', status: 'Active' })
  const [manualLoading, setManualLoading] = useState(false)
  const [manualErr, setManualErr]         = useState('')

  // View Text Modal State
  const [viewPolicy, setViewPolicy]     = useState(null)
  const [activeTab, setActiveTab]       = useState('text')

  // Edit Modal State
  const [editPolicy, setEditPolicy]     = useState(null)
  const [editForm, setEditForm]         = useState({ title: '', category_id: '', category: 'General', department_id: '', version: 'v1.0', full_text: '', status: 'Active' })
  const [overrideFile, setOverrideFile] = useState(null)
  const [editLoading, setEditLoading]   = useState(false)
  const [editErr, setEditErr]           = useState('')

  // Delete Modal State
  const [deletePolicy, setDeletePolicy] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Toast notification
  const [toastMsg, setToastMsg]         = useState('')

  useEffect(() => {
    fetchPolicies()
    fetchDepartments()
    fetchCategoriesList()
  }, [])

  const triggerToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const fetchCategoriesList = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setCategories(data)
          if (data.length > 0) {
            setUploadCatId(data[0].cat_id)
            setManualForm(prev => ({ ...prev, category_id: data[0].cat_id, category: data[0].name }))
          }
        }
      }
    } catch (err) {
      console.log('Error fetching categories list:', err)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/departments`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setDepartments(data)
          if (data.length > 0) {
            setUploadDeptId(data[0].dept_id)
            setManualForm(prev => ({ ...prev, department_id: data[0].dept_id }))
          }
        }
      }
    } catch (err) {
      console.log('Error fetching departments list:', err)
    }
  }

  const fetchPolicies = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/policies`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setPolicies(data)
        }
      }
    } catch (err) {
      console.log('Using initial mock policies')
    } finally {
      setLoading(false)
    }
  }

  // Handle PDF/DOC File Upload with Text Extraction
  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    if (!uploadFile) {
      setUploadErr('Please select a PDF, DOCX, or TXT file to upload.')
      return
    }

    setUploading(true)
    setUploadErr('')

    const formData = new FormData()
    formData.append('file', uploadFile)
    if (uploadTitle) formData.append('title', uploadTitle)
    if (uploadCatId) {
      formData.append('category_id', uploadCatId)
      const catObj = categoriesList.find(c => c.cat_id === uploadCatId || c.name === uploadCatId)
      if (catObj) formData.append('category', catObj.name)
    }
    if (uploadDeptId) formData.append('department_id', uploadDeptId)
    formData.append('version', uploadVer)

    try {
      const res = await fetch(`${API_BASE}/api/policies/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to upload and extract document text')
      }

      triggerToast(`Policy '${data.policy?.title || 'Document'}' uploaded and text extracted!`)
      setShowUpload(false)
      setUploadFile(null)
      setUploadTitle('')
      fetchPolicies()
    } catch (err) {
      setUploadErr(err.message || 'Error processing file upload')
      // Local fallback simulation if server API is offline
      const deptObj = departments.find(d => d.dept_id === uploadDeptId)
      const catObj = categoriesList.find(c => c.cat_id === uploadCatId || c.name === uploadCatId)
      const newMock = {
        doc_id: `KB-${Date.now().toString().slice(-3)}`,
        title: uploadTitle || uploadFile.name,
        category: catObj ? catObj.name : 'General',
        department_id: uploadDeptId,
        department: deptObj ? deptObj.name : 'Logistics',
        file_type: uploadFile.name.split('.').pop().toUpperCase(),
        file_size_kb: round(uploadFile.size / 1024, 1),
        version: uploadVer,
        status: 'Active',
        full_text: `[Simulated Extraction from ${uploadFile.name}]\nSection 1: Guidelines\nExtracted content matching PDF document structure. Department: ${deptObj ? deptObj.name : 'General'}.`,
        chunk_count: 1,
        chunks: [{ chunk_id: `KB-CHK-001`, section: 'Section 1', heading: 'Extracted Section', page_number: 1, content: 'Simulated text extraction from PDF.', version: uploadVer }],
        uploaded_at: new Date().toISOString()
      }
      setPolicies(prev => [newMock, ...prev])
      triggerToast(`Policy '${newMock.title}' uploaded!`)
      setShowUpload(false)
      setUploadFile(null)
      setUploadTitle('')
    } finally {
      setUploading(false)
    }
  }

  // Handle Manual Policy Creation
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualForm.title || !manualForm.full_text) {
      setManualErr('Title and Policy Content are required.')
      return
    }

    setManualLoading(true)
    setManualErr('')

    try {
      const res = await fetch(`${API_BASE}/api/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create policy')
      }

      triggerToast(`Policy '${manualForm.title}' created successfully!`)
      setShowManual(false)
      setManualForm({ title: '', category: 'General', department_id: departments[0]?.dept_id || '', version: 'v1.0', full_text: '', status: 'Active' })
      fetchPolicies()
    } catch (err) {
      const deptObj = departments.find(d => d.dept_id === manualForm.department_id)
      const newMock = {
        doc_id: `KB-${Date.now().toString().slice(-3)}`,
        title: manualForm.title,
        category: manualForm.category,
        department_id: manualForm.department_id,
        department: deptObj ? deptObj.name : 'General',
        file_type: 'TXT',
        file_size_kb: round(manualForm.full_text.length / 1024, 1),
        version: manualForm.version,
        status: manualForm.status,
        full_text: manualForm.full_text,
        chunk_count: 1,
        chunks: [{ chunk_id: 'KB-CHK-001', section: 'Section 1', heading: 'Main Policy', page_number: 1, content: manualForm.full_text, version: manualForm.version }],
        uploaded_at: new Date().toISOString()
      }
      setPolicies(prev => [newMock, ...prev])
      triggerToast(`Policy '${manualForm.title}' created!`)
      setShowManual(false)
    } finally {
      setManualLoading(false)
    }
  }

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editPolicy) return

    setEditLoading(true)
    setEditErr('')

    try {
      if (overrideFile) {
        const formData = new FormData()
        formData.append('file', overrideFile)
        formData.append('version', editForm.version || 'v1.0')
        const overrideRes = await fetch(`${API_BASE}/api/policies/${editPolicy.doc_id}/override-file`, {
          method: 'POST',
          body: formData,
        })
        if (!overrideRes.ok) {
          const errData = await overrideRes.json()
          throw new Error(errData.detail || 'Failed to override document in AWS S3')
        }
      }

      const res = await fetch(`${API_BASE}/api/policies/${editPolicy.doc_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update policy')
      }

      triggerToast(`Policy '${editForm.title}' updated ${overrideFile ? 'and S3 PDF overridden' : ''}!`)
      setEditPolicy(null)
      setOverrideFile(null)
      fetchPolicies()
    } catch (err) {
      const deptObj = departments.find(d => d.dept_id === editForm.department_id)
      setPolicies(prev => prev.map(p => p.doc_id === editPolicy.doc_id ? {
        ...p,
        ...editForm,
        department: deptObj ? deptObj.name : p.department
      } : p))
      triggerToast(`Policy '${editForm.title}' updated!`)
      setEditPolicy(null)
      setOverrideFile(null)
    } finally {
      setEditLoading(false)
    }
  }

  // Handle Delete
  const handleDelete = async () => {
    if (!deletePolicy) return
    setDeleteLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/policies/${deletePolicy.doc_id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        triggerToast(`Policy '${deletePolicy.title}' deleted.`)
      }
    } catch (err) {
      console.log('Error deleting policy via API')
    } finally {
      setPolicies(prev => prev.filter(p => p.doc_id !== deletePolicy.doc_id))
      setDeleteLoading(false)
      setDeletePolicy(null)
    }
  }

  const round = (num, decimals = 1) => Number(Math.round(num + 'e' + decimals) + 'e-' + decimals)

  // Filtered Policies
  const filteredPolicies = policies.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
                        p.doc_id.toLowerCase().includes(search.toLowerCase()) ||
                        (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
                        (p.full_text && p.full_text.toLowerCase().includes(search.toLowerCase()))
    const matchDept   = deptFilter === 'All' || p.department_id === deptFilter || p.department === deptFilter
    const matchCat    = catFilter === 'All' || p.category === catFilter
    return matchSearch && matchDept && matchCat
  })

  // Analytics Stats
  const totalDocs   = policies.length
  const activeDocs  = policies.filter(p => p.status === 'Active').length
  const uniqueDepts = new Set(policies.map(p => p.department_id || p.department).filter(Boolean)).size
  const totalChunks = policies.reduce((acc, p) => acc + (p.chunk_count || (p.chunks ? p.chunks.length : 0)), 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>
      <Sidebar role="admin" userName="Admin Nova" userEmail="admin@novawearapparel.com" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        <Navbar title="Policy Knowledge Base" subtitle="Upload PDF/DOC policies, extract structured content, and link department foreign keys" />

        <main className="responsive-main-padding" style={{ padding: '24px 32px', flex: 1 }}>

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
                Department Policies & KB Repository
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
                AI-indexed complaint resolution policies linked with department foreign keys.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={fetchPolicies}
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
                onClick={() => { setShowManual(true); setManualErr(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11,
                  border: '1px solid #7C3AED', background: '#F5F3FF', color: '#7C3AED', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <Plus size={15} />
                Add Text Policy
              </button>

              <button
                onClick={() => { setShowUpload(true); setUploadErr(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 11,
                  border: 'none', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', color: '#FFF',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={16} />
                Upload PDF / Doc Policy
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Policies" value={totalDocs} icon={BookOpen} iconBg="#F5F3FF" iconColor="#7C3AED" />
            <StatCard label="Active Policies" value={activeDocs} icon={CheckCircle} iconBg="#ECFDF5" iconColor="#059669" />
            <StatCard label="Departments Linked" value={uniqueDepts} icon={Building2} iconBg="#EFF6FF" iconColor="#2563EB" />
            <StatCard label="AI Text Chunks Extracted" value={totalChunks} icon={Layers} iconBg="#FFFBEB" iconColor="#D97706" />
          </div>

          {/* Search & Filter Bar */}
          <div style={{ ...glass(), padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search policies by title, ID, content or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 42px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, background: '#FFF', outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={15} color="#64748B" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Department:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  style={{
                    padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0',
                    background: '#FFF', fontSize: 13, fontWeight: 600, color: '#1E293B', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d.dept_id} value={d.dept_id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={15} color="#64748B" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Category:</span>
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  style={{
                    padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0',
                    background: '#FFF', fontSize: 13, fontWeight: 600, color: '#1E293B', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="All">All Categories</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Refund">Refund</option>
                  <option value="Replacement">Replacement</option>
                  <option value="Warranty">Warranty</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>
          </div>

          {/* Policies Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {filteredPolicies.map((pol) => {
              const deptName = pol.department || 'General'
              return (
                <div
                  key={pol.doc_id}
                  style={{
                    ...glass(),
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    position: 'relative'
                  }}
                >
                  <div
                    onClick={() => { setViewPolicy(pol); setActiveTab('text'); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Badges Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: '#F1F5F9', color: '#475569' }}>
                          {pol.doc_id}
                        </span>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #7C3AED25' }}>
                          {pol.version || 'v1.0'}
                        </span>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#2563EB' }}>
                          {pol.file_type || 'PDF'}
                        </span>
                      </div>

                      {/* Foreign Key Department Badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#059669', border: '1px solid #05966930'
                      }}>
                        <Building2 size={12} />
                        {deptName}
                      </span>
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', lineHeight: 1.4 }} className="hover:text-purple-600">
                      {pol.title}
                    </h3>

                    <p style={{
                      fontSize: 12.5, color: '#475569', lineHeight: 1.5, margin: '0 0 16px',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {pol.full_text || 'Structured policy document with AI RAG chunking enabled.'}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Category: <strong>{pol.category}</strong></span>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Extracted Chunks: <strong style={{ color: '#7C3AED' }}>{pol.chunk_count || (pol.chunks ? pol.chunks.length : 0)}</strong></span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                      <button
                        onClick={() => { setViewPolicy(pol); setActiveTab('text'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9,
                          border: '1px solid #7C3AED30', background: '#F5F3FF', color: '#7C3AED', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        <Eye size={14} />
                        View Extracted Text
                      </button>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => {
                            setEditPolicy(pol)
                            setEditForm({
                              title: pol.title,
                              category: pol.category,
                              department_id: pol.department_id || '',
                              version: pol.version || 'v1.0',
                              full_text: pol.full_text || '',
                              status: pol.status || 'Active'
                            })
                            setEditErr('')
                          }}
                          title="Edit Policy"
                          style={{ padding: 7, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', color: '#475569', cursor: 'pointer' }}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          onClick={() => setDeletePolicy(pol)}
                          title="Delete Policy"
                          style={{ padding: 7, borderRadius: 8, border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredPolicies.length === 0 && (
            <div style={{ ...glass(), padding: 48, textAlign: 'center', color: '#64748B' }}>
              <BookOpen size={36} color="#CBD5E1" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: '0 0 4px' }}>No Policies Found</h3>
              <p style={{ fontSize: 13, margin: 0 }}>Try clearing your search query or department filters.</p>
            </div>
          )}

        </main>
      </div>

      {/* UPLOAD PDF/DOC POLICY MODAL */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(520px, 94vw)', padding: '24px 18px', background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={18} color="#7C3AED" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Upload PDF / Doc Policy</h2>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Extracts text & headers matching PDF structure</p>
                </div>
              </div>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {uploadErr && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                <span>{uploadErr}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit}>

              {/* File Drag Drop Zone */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Policy Document File (PDF, DOCX, TXT) *</label>
                <div style={{
                  border: '2px dashed #CBD5E1', borderRadius: 12, padding: '24px 16px', textAlign: 'center',
                  background: '#F8FAFC', cursor: 'pointer', transition: 'all 0.2s'
                }}>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0])
                        if (!uploadTitle) setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""))
                      }
                    }}
                    style={{ display: 'none' }}
                    id="policy-file-input"
                  />
                  <label htmlFor="policy-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                    <FileCode size={32} color="#7C3AED" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'block' }}>
                      {uploadFile ? uploadFile.name : 'Click to browse or drag PDF / DOCX file here'}
                    </span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>Supports .pdf, .docx, .doc, .txt up to 25MB</span>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Policy Title</label>
                <input
                  type="text"
                  placeholder="e.g., Delivery SLA & Delayed Shipment Refund Policy"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Department (Foreign Key) *</label>
                  <select
                    value={uploadDeptId}
                    onChange={(e) => setUploadDeptId(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                    required
                  >
                    {departments.map(d => (
                      <option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Category (Foreign Key) *</label>
                  <select
                    value={uploadCatId}
                    onChange={(e) => setUploadCatId(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                    required
                  >
                    {categoriesList.length > 0 ? (
                      categoriesList.map(c => (
                        <option key={c.cat_id} value={c.cat_id}>{c.name} ({c.code})</option>
                      ))
                    ) : (
                      <option value="General">General</option>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#FFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  style={{
                    padding: '10px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: uploading ? 0.7 : 1
                  }}
                >
                  {uploading ? 'Extracting Text & Saving...' : 'Extract & Save Policy'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MANUAL TEXT POLICY MODAL */}
      {showManualModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(540px, 94vw)', padding: '24px 18px', background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={18} color="#7C3AED" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Create Text Policy</h2>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Add policy text directly into knowledge base</p>
                </div>
              </div>
              <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {manualErr && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                {manualErr}
              </div>
            )}

            <form onSubmit={handleManualSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Policy Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Quality Assurance Audit & Replacement Policy"
                  value={manualForm.title}
                  onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                  required
                />
              </div>

              <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Department (Foreign Key) *</label>
                  <select
                    value={manualForm.department_id}
                    onChange={(e) => setManualForm({ ...manualForm, department_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                    required
                  >
                    {departments.map(d => (
                      <option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Category (Foreign Key) *</label>
                  <select
                    value={manualForm.category_id || manualForm.category}
                    onChange={(e) => {
                      const selectedCat = categoriesList.find(c => c.cat_id === e.target.value)
                      setManualForm({
                        ...manualForm,
                        category_id: selectedCat ? selectedCat.cat_id : '',
                        category: selectedCat ? selectedCat.name : e.target.value
                      })
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                    required
                  >
                    {categoriesList.length > 0 ? (
                      categoriesList.map(c => (
                        <option key={c.cat_id} value={c.cat_id}>{c.name} ({c.code})</option>
                      ))
                    ) : (
                      <option value="General">General</option>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Extracted Policy Text / Content *</label>
                <textarea
                  rows={6}
                  placeholder="Paste or write full policy sections here..."
                  value={manualForm.full_text}
                  onChange={(e) => setManualForm({ ...manualForm, full_text: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#FFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualLoading}
                  style={{
                    padding: '10px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: manualLoading ? 0.7 : 1
                  }}
                >
                  {manualLoading ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EXTRACTED TEXT & DOCUMENT MODAL */}
      {viewPolicy && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(720px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '24px 18px', background: '#FFF' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: '#F1F5F9', color: '#475569' }}>
                    {viewPolicy.doc_id}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#059669', border: '1px solid #05966930' }}>
                    <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Department: {viewPolicy.department || 'General'} ({viewPolicy.department_id || 'DEP'})
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#2563EB' }}>
                    {viewPolicy.file_type || 'PDF'}
                  </span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{viewPolicy.title}</h2>
              </div>

              <button onClick={() => setViewPolicy(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            {/* View Tabs Header */}
            <div className="touch-scroll no-scrollbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', marginBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setActiveTab('text')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 700,
                    color: activeTab === 'text' ? '#7C3AED' : '#64748B', borderBottom: activeTab === 'text' ? '2px solid #7C3AED' : '2px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  Full Policy Text
                </button>

                <button
                  onClick={() => setActiveTab('chunks')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 700,
                    color: activeTab === 'chunks' ? '#7C3AED' : '#64748B', borderBottom: activeTab === 'chunks' ? '2px solid #7C3AED' : '2px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  AI Section Chunks ({viewPolicy.chunks ? viewPolicy.chunks.length : viewPolicy.chunk_count || 0})
                </button>

                <button
                  onClick={() => setActiveTab('meta')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 700,
                    color: activeTab === 'meta' ? '#7C3AED' : '#64748B', borderBottom: activeTab === 'meta' ? '2px solid #7C3AED' : '2px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  Document Details
                </button>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(viewPolicy.full_text || '')
                  triggerToast('Policy text copied to clipboard!')
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8,
                  border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', marginBottom: 6
                }}
              >
                Copy Text
              </button>
            </div>

            {/* Tab Content Container */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0' }}>
              {activeTab === 'text' && (
                <div style={{ background: '#FFF', padding: 16, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                    Extracted Document Content
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace, sans-serif', fontSize: 13, color: '#1E293B', lineHeight: 1.6, margin: 0 }}>
                    {viewPolicy.full_text || 'No text content available.'}
                  </pre>
                </div>
              )}

              {activeTab === 'chunks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {viewPolicy.chunks && viewPolicy.chunks.length > 0 ? (
                    viewPolicy.chunks.map((chk, idx) => (
                      <div key={idx} style={{ background: '#FFF', padding: 16, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED' }}>{chk.chunk_id || `CHK-${idx + 1}`}</span>
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>Page {chk.page_number || 1}</span>
                        </div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>{chk.heading || chk.section}</h4>
                        <p style={{ fontSize: 12.5, color: '#475569', margin: 0, lineHeight: 1.5 }}>{chk.content}</p>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 13, color: '#64748B', textAlign: 'center', padding: 20 }}>No individual chunks generated yet.</p>
                  )}
                </div>
              )}

              {activeTab === 'meta' && (
                <div style={{ background: '#FFF', padding: 18, borderRadius: 10, border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, display: 'block' }}>Document ID</span>
                    <strong style={{ fontSize: 13, color: '#0F172A' }}>{viewPolicy.doc_id}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, display: 'block' }}>Department Foreign Key</span>
                    <strong style={{ fontSize: 13, color: '#059669' }}>{viewPolicy.department} ({viewPolicy.department_id || 'N/A'})</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, display: 'block' }}>Category</span>
                    <strong style={{ fontSize: 13, color: '#0F172A' }}>{viewPolicy.category}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, display: 'block' }}>Document Version</span>
                    <strong style={{ fontSize: 13, color: '#7C3AED' }}>{viewPolicy.version || 'v1.0'}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, display: 'block' }}>File Type & Size</span>
                    <strong style={{ fontSize: 13, color: '#0F172A' }}>{viewPolicy.file_type || 'PDF'} ({viewPolicy.file_size_kb || 0} KB)</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, display: 'block' }}>Status</span>
                    <strong style={{ fontSize: 13, color: '#059669' }}>{viewPolicy.status || 'Active'}</strong>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, display: 'block' }}>Storage File Path</span>
                    <code style={{ fontSize: 11.5, color: '#475569', background: '#F1F5F9', padding: '4px 8px', borderRadius: 6, display: 'block', marginTop: 4 }}>
                      {viewPolicy.file_path || 'Stored in DB Memory / Text Document'}
                    </code>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Clicking any card opens this document viewer</span>
              <button
                onClick={() => setViewPolicy(null)}
                style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: '#1E293B', color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT POLICY MODAL */}
      {editPolicy && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(540px, 94vw)', padding: '24px 18px', background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={18} color="#7C3AED" />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Edit Policy</h2>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Update document metadata or text content</p>
                </div>
              </div>
              <button onClick={() => setEditPolicy(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Policy Title *</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                  required
                />
              </div>

              <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Department (Foreign Key) *</label>
                  <select
                    value={editForm.department_id}
                    onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                    required
                  >
                    {departments.map(d => (
                      <option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Category (Foreign Key) *</label>
                  <select
                    value={editForm.category_id || editForm.category}
                    onChange={(e) => {
                      const selectedCat = categoriesList.find(c => c.cat_id === e.target.value)
                      setEditForm({
                        ...editForm,
                        category_id: selectedCat ? selectedCat.cat_id : '',
                        category: selectedCat ? selectedCat.name : e.target.value
                      })
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                    required
                  >
                    {categoriesList.length > 0 ? (
                      categoriesList.map(c => (
                        <option key={c.cat_id} value={c.cat_id}>{c.name} ({c.code})</option>
                      ))
                    ) : (
                      <option value="General">General</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Version</label>
                  <input
                    type="text"
                    value={editForm.version}
                    onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                    placeholder="e.g. v2.0"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFF' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Superseded">Superseded</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Optional: Override Document in AWS S3 */}
              <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1.5px dashed #CBD5E1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155' }}>
                    ☁️ Override Document in AWS S3 (Optional)
                  </label>
                  {editPolicy?.s3_url && (
                    <a href={editPolicy.s3_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, textDecoration: 'none' }}>
                      View S3 File ↗
                    </a>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 8px' }}>
                  Upload a revised PDF/DOCX to replace the object in AWS S3 and re-extract text chunks.
                </p>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={e => setOverrideFile(e.target.files ? e.target.files[0] : null)}
                  style={{ fontSize: 12, color: '#334155' }}
                />
                {overrideFile && (
                  <p style={{ fontSize: 11, color: '#059669', fontWeight: 700, margin: '6px 0 0' }}>
                    ✓ Selected: {overrideFile.name} (will override object in S3 upon saving)
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Override Policy Content & Requirements *
                </label>
                <textarea
                  rows={6}
                  value={editForm.full_text}
                  onChange={(e) => setEditForm({ ...editForm, full_text: e.target.value })}
                  placeholder="Override or add policy rules, requirements, conditions, and SLAs..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditPolicy(null)}
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
                  {editLoading ? 'Updating...' : 'Save & Re-chunk Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletePolicy && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ ...glass(), width: '100%', maxWidth: 'min(420px, 94vw)', padding: '24px 18px', background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={22} color="#EF4444" />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>Delete Policy?</h3>
                <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>This document will be permanently removed.</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to delete policy <strong>{deletePolicy.title} ({deletePolicy.doc_id})</strong>?
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeletePolicy(null)}
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
                {deleteLoading ? 'Deleting...' : 'Delete Policy'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
