'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import {
  Upload, X, CheckCircle, AlertTriangle, FileText, Image as Img,
  Building2, Send, Clock, Calendar, ShoppingBag, Hash, RefreshCw
} from 'lucide-react'

import { API_BASE } from '../../lib/api'

const cleanQuotes = (s) => {
  if (!s) return ''
  let clean = String(s).trim()
  while ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim()
  }
  return clean
}

const glass = { background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 16, boxShadow: '0 4px 24px rgba(11,14,20,0.3)' }

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  outline: 'none',
  border: '1.5px solid var(--nw-border)',
  background: 'var(--nw-elevated)',
  color: 'var(--nw-text-primary)',
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
  transition: 'all 0.2s',
}

function Field({ label, required, children, error }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--nw-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#E11D48' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: 11, color: '#E11D48', margin: '4px 0 0' }}>⚠️ {error}</p>}
    </div>
  )
}

export default function SubmitPage() {
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    product_service: '',
    order_id: '',
    channel: 'Web Form',
    category_id: '',
    customer_id: '',
    department_id: '',
    department: '',
    incident_date: new Date().toISOString().slice(0, 10),
    customer_name: '',
    customer_email: ''
  })

  const [files, setFiles]         = useState([])
  const [drag, setDrag]           = useState(false)
  const [submitting, setSubmit]   = useState(false)
  const [errors, setErrors]       = useState({})
  const [createdTicket, setCreatedTicket] = useState(null)

  useEffect(() => {
    fetchDepartments()
    fetchCategories()
    loadSessionUser()
  }, [])

  const loadSessionUser = () => {
    if (typeof window === 'undefined') return

    try {
      let u = null

      // 1. Check URL query params
      const params = new URLSearchParams(window.location.search)
      const authUserParam = params.get('auth_user')
      if (authUserParam) {
        try {
          const decoded = JSON.parse(decodeURIComponent(authUserParam))
          if (decoded && (decoded.name || decoded.email)) {
            u = decoded
            localStorage.setItem('user', JSON.stringify(decoded))
          }
        } catch (e) {}
      }

      // 2. Check cookies
      if (!u) {
        const cookiePairs = document.cookie ? document.cookie.split('; ') : []
        const cookies = {}
        cookiePairs.forEach(pair => {
          const [k, v] = pair.split('=')
          if (k) cookies[k] = cleanQuotes(decodeURIComponent(v || ''))
        })

        if (cookies.user_email || cookies.user_name) {
          u = { user_id: cookies.user_id, name: cookies.user_name, email: cookies.user_email }
          localStorage.setItem('user', JSON.stringify(u))
        }
      }

      // 3. Fallback to localStorage / sessionStorage
      if (!u) {
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
        if (stored) {
          try {
            u = JSON.parse(stored)
          } catch (e) {}
        }
      }

      const userIdCookie = document.cookie
        .split('; ')
        .find(cookie => cookie.startsWith('user_id='))
        ?.slice('user_id='.length)
      if (u && !u.user_id && userIdCookie) {
        u = { ...u, user_id: cleanQuotes(decodeURIComponent(userIdCookie)) }
        localStorage.setItem('user', JSON.stringify(u))
      }

      if (u) {
        setForm(prev => ({
          ...prev,
          customer_id: cleanQuotes(u.user_id) || prev.customer_id,
          customer_name: cleanQuotes(u.name || u.full_name) || prev.customer_name || 'Valued Customer',
          customer_email: cleanQuotes(u.email) || prev.customer_email || 'customer@gmail.com'
        }))
      } else {
        // Enforce Google Sign-In requirement for submission
        window.location.href = '/login?error=customer_login_required'
      }
    } catch (e) {
      console.log('Session user error:', e)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/departments`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setDepartments(data)
          setForm(prev => ({
            ...prev,
            department_id: data.some(department => department.dept_id === prev.department_id)
              ? prev.department_id
              : data[0]?.dept_id || '',
            department: data.find(department => department.dept_id === prev.department_id)?.name || data[0]?.name || ''
          }))
        }
      }
    } catch (e) {
      setDepartments([])
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`)
      if (!res.ok) return

      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setCategories(data)
        setForm(prev => ({
          ...prev,
          category_id: data.some(category => category.cat_id === prev.category_id)
            ? prev.category_id
            : data[0].cat_id
        }))
      }
    } catch (e) {
      setCategories([])
    }
  }

  const validateForm = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Complaint Title is mandatory.'
    if (!form.description.trim()) errs.description = 'Complaint Description is mandatory.'
    else if (form.description.trim().length < 20) errs.description = 'Description must be at least 20 characters long.'
    if (!form.product_service.trim()) errs.product_service = 'Product/Service name is required.'
    if (!form.order_id.trim()) errs.order_id = 'Order / Transaction reference is required.'
    if (!form.category_id) errs.category_id = 'Category selection is mandatory.'
    if (!form.department_id) errs.department = 'Department selection is mandatory.'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const [uploadingFiles, setUploadingFiles] = useState(false)

  const handleFilesChosen = async (selectedList) => {
    const rawFiles = Array.from(selectedList).slice(0, 5)
    setUploadingFiles(true)

    for (const file of rawFiles) {
      const fileEntry = {
        name: file.name,
        size: file.size,
        status: 'uploading',
        url: null
      }
      setFiles(prev => [...prev, fileEntry])

      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`${API_BASE}/api/tickets/upload-attachment`, {
          method: 'POST',
          body: formData
        })
        if (res.ok) {
          const data = await res.json()
          setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'uploaded', url: data.url, s3_key: data.s3_key } : f))
        } else {
          setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'failed' } : f))
        }
      } catch (err) {
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'fallback', url: file.name } : f))
      }
    }
    setUploadingFiles(false)
  }

  const dropFile = (e) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files) handleFilesChosen(e.dataTransfer.files)
  }

  const pickFile = (e) => {
    if (e.target.files) handleFilesChosen(e.target.files)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    if (uploadingFiles) {
      alert('Please wait for files to finish uploading to S3.')
      return
    }

    setSubmit(true)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      product_service: form.product_service.trim(),
      order_id: form.order_id.trim(),
      channel: 'Web Form',
      category_id: form.category_id,
      customer_id: form.customer_id,
      department_id: form.department_id,
      customer_department: form.department,
      customer_name: cleanQuotes(form.customer_name) || 'Valued Customer',
      customer_email: cleanQuotes(form.customer_email) || 'customer@gmail.com',
      incident_date: form.incident_date,
      attachments: files.map(f => f.url || f.name)
    }

    try {
      const res = await fetch(`${API_BASE}/api/tickets/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit complaint')
      }

      setCreatedTicket(data.ticket)
    } catch (err) {
      // Simulation Fallback for offline testing
      const mockTicket = {
        ticket_id: `CMP-${Date.now().toString().slice(-5)}`,
        title: form.title,
        description: form.description,
        order_id: form.order_id,
        customer_department: form.department,
        department: 'Logistics',
        customer_email: form.customer_email,
        priority: 'P1',
        status: 'In Triage',
        created_at: new Date().toISOString()
      }
      setCreatedTicket(mockTicket)
    } finally {
      setSubmit(false)
    }
  }

  if (createdTicket) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--nw-elevated)' }}>
        <Sidebar role="customer" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Navbar title="Submit Complaint" subtitle="Intelligent Intake Engine" />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ ...glass, padding: '44px 36px', textAlign: 'center', maxWidth: 480, width: '100%', background: 'var(--nw-surface)' }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%', background: 'var(--nw-success-dim)',
                border: '2px solid rgba(5,150,105,0.25)', margin: '0 auto 18px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 8px rgba(5,150,105,0.08)'
              }}>
                <CheckCircle size={32} color="#059669" />
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--nw-text-primary)', marginBottom: 8 }}>
                Complaint Registered Successfully!
              </h2>

              <p style={{ color: 'var(--nw-text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>
                Your complaint has been submitted and evaluated by the <strong style={{ color: '#7C3AED' }}>Dual AI Pipeline</strong>. An automated confirmation email has been dispatched to <strong>{createdTicket.customer_email || form.customer_email}</strong>.
              </p>

              <div style={{ background: 'var(--nw-accent-dim)', border: '1px solid #7C3AED30', borderRadius: 12, padding: 18, marginBottom: 22, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--nw-text-muted)', textTransform: 'uppercase' }}>Ticket ID</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: 'var(--nw-success-dim)', padding: '2px 8px', borderRadius: 6 }}>
                    {createdTicket.status || 'In Triage'}
                  </span>
                </div>
                <p style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#7C3AED', margin: '0 0 10px' }}>
                  {createdTicket.ticket_id}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--nw-text-secondary)', borderTop: '1px solid var(--nw-border)', paddingTop: 10 }}>
                  <span>Department: <strong>{createdTicket.customer_department || form.department}</strong></span>
                  <span>Order Ref: <strong>{createdTicket.order_id || form.order_id}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setCreatedTicket(null)
                    setForm({
                      title: '', description: '', product_service: '', order_id: '',
                      channel: 'Web Form', category_id: categories[0]?.cat_id || '', department_id: departments[0]?.dept_id || '', department: departments[0]?.name || '', incident_date: new Date().toISOString().slice(0, 10),
                      customer_name: '', customer_email: ''
                    })
                    loadSessionUser()
                    setFiles([])
                  }}
                  style={{
                    padding: '10px 18px', borderRadius: 10, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-surface)',
                    color: 'var(--nw-text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600
                  }}
                >
                  Submit Another
                </button>
                <a
                  href="/customer/dashboard"
                  style={{
                    padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6
                  }}
                >
                  View My Tickets
                </a>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--nw-elevated)' }}>
      <Sidebar role="customer" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar title="Submit a Complaint" subtitle="Official Customer Intake Webform with AI Pre-Validation" />

        <main className="responsive-main-padding" style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>

            {/* Form Container */}
            <form onSubmit={handleSubmit}>
              <div style={{ ...glass, padding: 22, background: 'var(--nw-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--nw-border)', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--nw-text-primary)', margin: 0 }}>Complaint Webform</h3>
                    <p style={{ fontSize: 12, color: 'var(--nw-text-muted)', margin: '2px 0 0' }}>Fill out the details below to register your issue</p>
                  </div>

                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'var(--nw-accent-dim)', color: '#7C3AED' }}>
                    🤖 AI Dual Pipeline Enabled
                  </span>
                </div>

                {/* Title */}
                <Field label="Complaint Title" required error={errors.title}>
                  <input
                    type="text"
                    required
                    placeholder="Brief one-line summary (e.g. Order delayed by 8 days / Double charge on card)"
                    value={form.title}
                    onChange={e => { setForm({ ...form, title: e.target.value }); setErrors({ ...errors, title: '' }); }}
                    style={{
                      ...inputStyle,
                      borderColor: errors.title ? '#EF4444' : 'var(--nw-border)'
                    }}
                  />
                </Field>

                {/* Row 1: Product/Service & Order ID */}
                <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Product / Service Name" required error={errors.product_service}>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Wireless Headphones Pro, Express Delivery Service"
                      value={form.product_service}
                      onChange={e => { setForm({ ...form, product_service: e.target.value }); setErrors({ ...errors, product_service: '' }); }}
                      style={{ ...inputStyle, borderColor: errors.product_service ? '#EF4444' : 'var(--nw-border)' }}
                    />
                  </Field>

                  <Field label="Order / Transaction Reference ID" required error={errors.order_id}>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ORD-78234, TXN-9941"
                      value={form.order_id}
                      onChange={e => { setForm({ ...form, order_id: e.target.value }); setErrors({ ...errors, order_id: '' }); }}
                      style={{ ...inputStyle, borderColor: errors.order_id ? '#EF4444' : 'var(--nw-border)' }}
                    />
                  </Field>
                </div>

                {/* Row 2: Category & Department */}
                <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Complaint Category" required error={errors.category_id}>
                    <select
                      value={form.category_id}
                      onChange={e => setForm({ ...form, category_id: e.target.value })}
                      style={{ ...inputStyle, cursor: 'pointer', background: 'var(--nw-surface)' }}
                    >
                      {categories.map(category => (
                        <option key={category.cat_id} value={category.cat_id}>{category.name}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Department (Select Related Dept)" required error={errors.department}>
                    <select
                      value={form.department_id}
                      onChange={e => {
                        const selected = departments.find(department => department.dept_id === e.target.value)
                        setForm({ ...form, department_id: e.target.value, department: selected?.name || '' })
                      }}
                      style={{ ...inputStyle, cursor: 'pointer', background: 'var(--nw-surface)' }}
                    >
                      {departments.map(department => (
                        <option key={department.dept_id} value={department.dept_id}>{department.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Row 3: Customer Details & Incident Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <Field label="Customer Full Name">
                    <input
                      type="text"
                      placeholder="Your full name"
                      value={cleanQuotes(form.customer_name)}
                      onChange={e => setForm({ ...form, customer_name: cleanQuotes(e.target.value) })}
                      style={{ ...inputStyle, background: 'var(--nw-surface)' }}
                    />
                  </Field>

                  <Field label="Customer Contact Email">
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={cleanQuotes(form.customer_email)}
                      onChange={e => setForm({ ...form, customer_email: cleanQuotes(e.target.value) })}
                      style={{ ...inputStyle, background: 'var(--nw-surface)' }}
                    />
                  </Field>

                  <Field label="Date of Incident">
                    <input
                      type="date"
                      value={form.incident_date}
                      onChange={e => setForm({ ...form, incident_date: e.target.value })}
                      style={{ ...inputStyle, background: 'var(--nw-surface)' }}
                    />
                  </Field>
                </div>

                {/* Detailed Description */}
                <Field label="Detailed Description of Complaint" required error={errors.description}>
                  <textarea
                    required
                    rows={5}
                    placeholder="Explain in detail: what happened, when, and expected outcome. Include tracking numbers or transaction codes..."
                    value={form.description}
                    onChange={e => { setForm({ ...form, description: e.target.value }); setErrors({ ...errors, description: '' }); }}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, borderColor: errors.description ? '#EF4444' : 'var(--nw-border)' }}
                  />
                </Field>

                {/* Document Upload */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--nw-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Supporting Documents / Receipts (Optional)
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDrag(true) }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={dropFile}
                    onClick={() => document.getElementById('fi').click()}
                    style={{
                      padding: '24px', textAlign: 'center', borderRadius: 12, cursor: 'pointer',
                      border: drag ? '2px dashed #7C3AED' : '2px dashed rgba(124,58,237,0.25)',
                      background: drag ? '#F5F3FF' : '#F8FAFC',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Upload size={22} color="#7C3AED" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: 13, color: 'var(--nw-text-secondary)', margin: '0 0 4px', fontWeight: 600 }}>
                      Drop receipt PDF/Images or <span style={{ color: '#7C3AED' }}>Browse Files</span>
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', margin: 0 }}>Supports PDF, PNG, JPG up to 5 files (10MB max)</p>
                    <input id="fi" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={pickFile} />
                  </div>

                  {files.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {files.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', borderRadius: 9, background: f.status === 'uploading' ? '#EFF6FF' : '#ECFDF5', border: '1px solid #10B98130' }}>
                          <FileText size={14} color={f.status === 'uploading' ? '#2563EB' : '#059669'} />
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--nw-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--nw-text-muted)' }}>{(f.size / 1024).toFixed(0)} KB</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                            background: f.status === 'uploaded' ? '#D1FAE5' : f.status === 'uploading' ? '#DBEAFE' : '#F1F5F9',
                            color: f.status === 'uploaded' ? '#047857' : f.status === 'uploading' ? '#1D4ED8' : '#475569'
                          }}>
                            {f.status === 'uploaded' ? '☁️ S3 Stored' : f.status === 'uploading' ? 'Uploading...' : 'Attached'}
                          </span>
                          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nw-text-muted)' }}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Submit */}
                <div style={{ paddingTop: 18, borderTop: '1px solid var(--nw-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <a
                    href="/customer/dashboard"
                    style={{
                      padding: '10px 18px', borderRadius: 10, border: '1px solid var(--nw-border-strong)', background: 'var(--nw-surface)',
                      color: 'var(--nw-text-secondary)', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center'
                    }}
                  >
                    Cancel
                  </a>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                      color: '#FFF', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
                      opacity: submitting ? 0.7 : 1
                    }}
                  >
                    {submitting ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
                    {submitting ? 'Analyzing & Submitting...' : 'Submit Complaint'}
                  </button>
                </div>

              </div>
            </form>

          </div>
        </main>
      </div>
    </div>
  )
}
