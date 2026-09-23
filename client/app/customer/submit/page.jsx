'use client'
import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import { Upload, X, CheckCircle, AlertTriangle, FileText, Image as Img } from 'lucide-react'

const CATEGORIES   = ['Delivery Issue','Wrong Product','Billing Error','Product Defect','Refund Request','Technical Issue','Other']
const CHANNELS     = ['Online Store','Mobile App','Phone','In-Store','Email']
const CUST_TYPES   = ['Regular Customer','Premium Member','Business Account','First-Time Buyer']

const glass = { background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 16, boxShadow: '0 4px 24px rgba(148,163,184,0.1)' }

const inputStyle = {
  width: '100%', padding: '9px 13px', borderRadius: 10, outline: 'none',
  border: '1.5px solid rgba(226,232,240,0.8)',
  background: 'rgba(248,250,252,0.8)',
  color: '#0F172A', fontSize: 13,
  fontFamily: 'Inter, sans-serif',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#E11D48' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export default function SubmitPage() {
  const [form, setForm] = useState({ type: '', channel: '', title: '', category: '', desc: '', orderId: '' })
  const [files, setFiles]   = useState([])
  const [drag, setDrag]     = useState(false)
  const [done, setDone]     = useState(false)
  const [focused, setFocused] = useState(null)

  const descLen  = form.desc.length
  const hasOrder = form.desc.includes('ORD') || form.orderId.length > 0
  const validLen = descLen >= 80

  const validation = () => {
    if (!form.desc)  return { text: 'Describe your issue in detail to enable AI pre-analysis.', s: 'idle' }
    if (!validLen)   return { text: `Too short — add ${80 - descLen} more characters (80 min)`, s: 'warn' }
    if (!hasOrder)   return { text: 'Tip: Include Order ID (e.g. ORD-12345) for faster resolution.', s: 'warn' }
    return { text: '✓ AI pre-validation ready!', s: 'ok' }
  }
  const v = validation()

  const dropFile = (e) => { e.preventDefault(); setDrag(false); setFiles(p => [...p, ...Array.from(e.dataTransfer.files)].slice(0, 5)) }
  const pickFile = (e)  => setFiles(p => [...p, ...Array.from(e.target.files)].slice(0, 5))
  const submit   = (e)  => { e.preventDefault(); if (form.title && form.category && form.desc) setDone(true) }

  if (done) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="customer" userName="Rajeev Khan" userEmail="rajeev@gmail.com" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Submit Complaint" />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="animate-fade-up" style={{ ...glass, padding: '44px 36px', textAlign: 'center', maxWidth: 420 }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#ECFDF5', border: '2px solid rgba(5,150,105,0.25)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 8px rgba(5,150,105,0.08)' }}>
              <CheckCircle size={30} color="#059669" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Complaint Submitted!</h2>
            <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.7, marginBottom: 22 }}>
              Your complaint is now being analyzed by the <span style={{ color: '#7C3AED', fontWeight: 600 }}>Dual AI Pipeline</span>. You will receive a response within SLA timelines.
            </p>
            <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10, padding: 14, marginBottom: 22 }}>
              <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>Ticket ID</p>
              <p style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#7C3AED' }}>CMP-00422</p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { setDone(false); setForm({ type: '', channel: '', title: '', category: '', desc: '', orderId: '' }); setFiles([]) }}
                style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid rgba(226,232,240,0.8)', background: 'rgba(248,250,252,0.8)', color: '#64748B', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Submit Another
              </button>
              <a href="/customer/dashboard" style={{ padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: 'white', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                View Dashboard
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="customer" userName="Rajeev Khan" userEmail="rajeev@gmail.com" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar title="Submit a Complaint" subtitle="AI-powered complaint intake" />
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Banner */}
            <div className="animate-fade-up" style={{ ...glass, padding: '13px 16px', marginBottom: 18, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                Complaint will be analyzed by the <strong style={{ color: '#7C3AED' }}>Dual AI Pipeline</strong> — GenAI for classification, Python Rule Engine for policy validation.
              </p>
            </div>

            <form onSubmit={submit}>
              <div className="animate-fade-up d100" style={{ ...glass, padding: 26 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid rgba(226,232,240,0.6)' }}>Complaint Details</h3>

                {/* Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <Field label="Customer Type">
                    <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Select…</option>
                      {CUST_TYPES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Purchase Channel">
                    <select value={form.channel} onChange={e => setForm({...form, channel: e.target.value})}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Select…</option>
                      {CHANNELS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Row 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <Field label="Category" required>
                    <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                      style={{ ...inputStyle, cursor: 'pointer', borderColor: !form.category && focused === 'cat' ? '#E11D48' : 'rgba(226,232,240,0.8)' }}
                      onFocus={() => setFocused('cat')} onBlur={() => setFocused(null)}>
                      <option value="">Select category…</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Order / Transaction ID">
                    <input value={form.orderId} onChange={e => setForm({...form, orderId: e.target.value})}
                      placeholder="e.g. ORD-12345"
                      style={{ ...inputStyle, borderColor: focused === 'ord' ? 'rgba(124,58,237,0.5)' : 'rgba(226,232,240,0.8)', boxShadow: focused === 'ord' ? '0 0 0 3px rgba(124,58,237,0.08)' : 'none' }}
                      onFocus={() => setFocused('ord')} onBlur={() => setFocused(null)} />
                  </Field>
                </div>

                {/* Title */}
                <div style={{ marginBottom: 14 }}>
                  <Field label="Complaint Title" required>
                    <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                      placeholder="Brief one-line summary of your issue…"
                      style={{ ...inputStyle, borderColor: focused === 'ttl' ? 'rgba(124,58,237,0.5)' : 'rgba(226,232,240,0.8)', boxShadow: focused === 'ttl' ? '0 0 0 3px rgba(124,58,237,0.08)' : 'none' }}
                      onFocus={() => setFocused('ttl')} onBlur={() => setFocused(null)} />
                  </Field>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description <span style={{ color: '#E11D48' }}>*</span></label>
                    <span style={{ fontSize: 10, color: validLen ? '#059669' : '#94A3B8', fontFamily: 'monospace' }}>{descLen}/80 min</span>
                  </div>
                  <textarea required rows={6} value={form.desc}
                    onChange={e => setForm({...form, desc: e.target.value})}
                    placeholder="Explain in detail: what happened, when, expected outcome. Include Order ID for faster resolution…"
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, borderColor: focused === 'dsc' ? 'rgba(124,58,237,0.5)' : 'rgba(226,232,240,0.8)', boxShadow: focused === 'dsc' ? '0 0 0 3px rgba(124,58,237,0.08)' : 'none' }}
                    onFocus={() => setFocused('dsc')} onBlur={() => setFocused(null)} />
                  {form.desc && (
                    <div style={{
                      marginTop: 6, padding: '6px 11px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7,
                      background: v.s === 'ok' ? 'rgba(5,150,105,0.06)' : v.s === 'warn' ? 'rgba(217,119,6,0.06)' : 'rgba(248,250,252,0.8)',
                      border: v.s === 'ok' ? '1px solid rgba(5,150,105,0.2)' : v.s === 'warn' ? '1px solid rgba(217,119,6,0.2)' : '1px solid rgba(226,232,240,0.6)',
                    }}>
                      {v.s === 'ok'   && <CheckCircle size={12} color="#059669" />}
                      {v.s === 'warn' && <AlertTriangle size={12} color="#D97706" />}
                      <span style={{ fontSize: 11, color: v.s === 'ok' ? '#059669' : v.s === 'warn' ? '#D97706' : '#94A3B8' }}>{v.text}</span>
                    </div>
                  )}
                </div>

                {/* File Upload */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Supporting Documents</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDrag(true) }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={dropFile}
                    onClick={() => document.getElementById('fi').click()}
                    style={{
                      padding: '26px', textAlign: 'center', borderRadius: 12, cursor: 'pointer',
                      border: drag ? '2px dashed #7C3AED' : '2px dashed rgba(124,58,237,0.25)',
                      background: drag ? 'rgba(124,58,237,0.05)' : 'rgba(248,250,252,0.6)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Upload size={22} color="#7C3AED" style={{ margin: '0 auto 9px', display: 'block' }} />
                    <p style={{ fontSize: 13, color: '#64748B', marginBottom: 3 }}>Drop files or <span style={{ color: '#7C3AED', fontWeight: 600 }}>browse</span></p>
                    <p style={{ fontSize: 11, color: '#94A3B8' }}>PDF, JPG, PNG · Max 5 files · 10 MB each</p>
                    <input id="fi" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={pickFile} />
                  </div>
                  {files.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {files.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 9, background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)' }}>
                          {f.type.includes('image') ? <Img size={13} color="#059669" /> : <FileText size={13} color="#7C3AED" />}
                          <span style={{ flex: 1, fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize: 10, color: '#94A3B8' }}>{(f.size / 1024).toFixed(0)} KB</span>
                          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ paddingTop: 18, borderTop: '1px solid rgba(226,232,240,0.6)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <a href="/customer/dashboard" style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid rgba(226,232,240,0.8)', background: 'transparent', color: '#64748B', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                    Cancel
                  </a>
                  <button type="submit" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: 'white', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
                    🤖 Submit & Analyze with AI
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
