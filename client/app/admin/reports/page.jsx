'use client'
import { useState, useCallback, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import { Download, Filter, RefreshCw, FileText, FileSpreadsheet, File, ChevronDown, X } from 'lucide-react'
import { getReportPreview, exportReport } from '../../lib/apiClient'

/* ── Styles ── */
const card = {
  background: 'var(--nw-surface)',
  border: '1px solid var(--nw-border)',
  borderRadius: 16,
  padding: '20px 22px',
}

const INPUT_STYLE = {
  background: 'var(--nw-elevated)', border: '1px solid var(--nw-border-strong)',
  borderRadius: 9, padding: '8px 12px', fontSize: 13,
  color: 'var(--nw-text-primary)', outline: 'none', width: '100%',
  fontFamily: 'Inter, system-ui, sans-serif',
}

const STATUS_OPTIONS  = ['', 'In Triage', 'In Progress', 'Escalated', 'AI Review', 'Resolved', 'Closed']
const PRIORITY_OPTIONS = ['', 'P0', 'P1', 'P2', 'P3']

const P_COLOR = {
  P0: '#E8758A', P1: '#E8B56B', P2: '#72B4D8', P3: '#9A9CA5'
}

const STATUS_COLOR = {
  'In Triage':   '#D9A441',
  'In Progress': '#4A9BC9',
  'Escalated':   '#C1495B',
  'AI Review':   '#C96F4A',
  'Resolved':    '#4FA689',
  'Closed':      '#9A9CA5',
}

const REPORT_TYPE_OPTIONS = [
  { value: 'complaint_analysis', label: '📊 Complaint Analysis (34 Cols)' },
  { value: 'genai_python_comparison', label: '🤖 GenAI vs Python Comparison' },
  { value: 'escalations', label: '🚨 Safety & Legal Escalations' },
  { value: 'sla_status', label: '⏱ SLA Status & Breach Risk' },
  { value: 'policy_usage', label: '📜 Policy Usage & Citations' },
  { value: 'resolution_compliance', label: '✅ Resolution Compliance' },
  { value: 'manual_reviews', label: '🛡️ Manual Reviews & Overrides' },
]

function Pill({ label, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>
      {label}
    </span>
  )
}

export default function AdminReportsPage() {
  const [filters, setFilters] = useState({
    report_type: 'complaint_analysis',
    from: '', to: '', status: '', department: '', category: '', priority: '', limit: '50'
  })
  const [preview, setPreview]       = useState([])
  const [total, setTotal]           = useState(0)
  const [loadingPreview, setLoadPrev] = useState(false)
  const [loadingExport, setLoadExp]   = useState({})
  const [previewError, setPreviewErr] = useState('')
  const [exportError, setExportErr]   = useState('')
  const [hasQueried, setQueried]      = useState(false)

  const sidebarUser = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
    : {}

  const handleFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const runPreview = useCallback(async () => {
    setLoadPrev(true)
    setPreviewErr('')
    setQueried(true)
    try {
      const res = await getReportPreview(Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '')
      ))
      if (Array.isArray(res)) {
        setPreview(res)
        setTotal(res.length)
      } else {
        setPreview(res.tickets || [])
        setTotal(res.total ?? (res.tickets?.length ?? 0))
      }
    } catch (e) {
      setPreviewErr(e.message || 'Failed to load preview.')
      setPreview([])
      setTotal(0)
    } finally {
      setLoadPrev(false)
    }
  }, [filters])

  const handleExport = async (format) => {
    setLoadExp(prev => ({ ...prev, [format]: true }))
    setExportErr('')
    try {
      await exportReport(
        format,
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
        preview   // fallback for client-side CSV
      )
    } catch (e) {
      setExportErr(e.message || `Export as ${format.toUpperCase()} failed.`)
    } finally {
      setLoadExp(prev => ({ ...prev, [format]: false }))
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--nw-base)' }}>
      <Sidebar role="admin" userName={sidebarUser.name} userEmail={sidebarUser.email} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar title="Reports & Export" subtitle="Generate and download complaint reports" />

        <main style={{ flex: 1, overflowY: 'auto', padding: '22px' }} className="responsive-main-padding">

          {/* ── Page header ─── */}
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--nw-text-primary)', marginBottom: 4 }}>
              Report Builder
            </h2>
            <p style={{ fontSize: 12, color: 'var(--nw-text-muted)' }}>
              Filter tickets and export as CSV, Excel, or PDF
            </p>
          </div>

          {/* ── Filter panel ─── */}
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Filter size={15} color="var(--nw-accent)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nw-text-primary)' }}>
                Filters
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {/* Report Type */}
              <div style={{ gridColumn: 'span 2' }}>
                <Label>Report Type</Label>
                <select
                  value={filters.report_type}
                  onChange={e => handleFilter('report_type', e.target.value)}
                  style={{ ...INPUT_STYLE, fontWeight: 700, borderColor: 'var(--nw-accent)' }}
                >
                  {REPORT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div>
                <Label>From Date</Label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={e => handleFilter('from', e.target.value)}
                  style={INPUT_STYLE}
                />
              </div>

              {/* Date to */}
              <div>
                <Label>To Date</Label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={e => handleFilter('to', e.target.value)}
                  style={INPUT_STYLE}
                />
              </div>

              {/* Status */}
              <div>
                <Label>Status</Label>
                <select value={filters.status} onChange={e => handleFilter('status', e.target.value)} style={INPUT_STYLE}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
                </select>
              </div>

              {/* Priority */}
              <div>
                <Label>Priority</Label>
                <select value={filters.priority} onChange={e => handleFilter('priority', e.target.value)} style={INPUT_STYLE}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p || 'All Priorities'}</option>)}
                </select>
              </div>

              {/* Department */}
              <div>
                <Label>Department</Label>
                <input
                  value={filters.department}
                  onChange={e => handleFilter('department', e.target.value)}
                  placeholder="e.g. Logistics"
                  style={INPUT_STYLE}
                />
              </div>

              {/* Category */}
              <div>
                <Label>Category</Label>
                <input
                  value={filters.category}
                  onChange={e => handleFilter('category', e.target.value)}
                  placeholder="e.g. Delivery"
                  style={INPUT_STYLE}
                />
              </div>

              {/* Row limit */}
              <div>
                <Label>Max Rows</Label>
                <select value={filters.limit} onChange={e => handleFilter('limit', e.target.value)} style={INPUT_STYLE}>
                  {['20','50','100','250','500'].map(n => <option key={n} value={n}>{n} rows</option>)}
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                onClick={runPreview}
                disabled={loadingPreview}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--nw-accent)', color: 'var(--nw-text-inverse)',
                  border: 'none', borderRadius: 9, padding: '9px 18px',
                  fontSize: 13, fontWeight: 600, cursor: loadingPreview ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={13} className={loadingPreview ? 'animate-spin' : ''} />
                {loadingPreview ? 'Loading…' : 'Run Report'}
              </button>

              {/* Clear filters */}
              <button
                onClick={() => { setFilters({ from:'',to:'',status:'',department:'',category:'',priority:'',limit:'50' }); setPreview([]); setQueried(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--nw-elevated)', border: '1px solid var(--nw-border-strong)',
                  borderRadius: 9, padding: '9px 14px', cursor: 'pointer',
                  color: 'var(--nw-text-muted)', fontSize: 12, fontWeight: 600,
                }}
              >
                <X size={12} /> Clear
              </button>
            </div>
          </div>

          {/* ── Export row ─── */}
          {hasQueried && preview.length > 0 && (
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Download size={15} color="var(--nw-success)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nw-text-primary)' }}>
                  Export — {total} ticket{total !== 1 ? 's' : ''} matched
                </span>
              </div>

              {exportError && (
                <p style={{ fontSize: 12, color: 'var(--nw-danger)', marginBottom: 10 }}>⚠ {exportError}</p>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { fmt: 'csv',  icon: <FileText size={14} />,        label: 'Export CSV',   color: '#4FA689' },
                  { fmt: 'xlsx', icon: <FileSpreadsheet size={14} />, label: 'Export Excel', color: '#4A9BC9' },
                  { fmt: 'pdf',  icon: <File size={14} />,            label: 'Export PDF',   color: '#C96F4A' },
                ].map(({ fmt, icon, label, color }) => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    disabled={!!loadingExport[fmt]}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      background: `${color}14`, border: `1px solid ${color}40`,
                      borderRadius: 9, padding: '9px 16px', cursor: loadingExport[fmt] ? 'not-allowed' : 'pointer',
                      color, fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                    }}
                  >
                    {loadingExport[fmt] ? <RefreshCw size={13} className="animate-spin" /> : icon}
                    {loadingExport[fmt] ? 'Downloading…' : label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: 'var(--nw-text-muted)', marginTop: 10 }}>
                💡 CSV export works offline via client-side generation if backend endpoint is unavailable.
              </p>
            </div>
          )}

          {/* ── Preview error ─── */}
          {previewError && (
            <div style={{
              background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.3)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 18,
              color: 'var(--nw-danger)', fontSize: 13,
            }}>
              ⚠ {previewError}
            </div>
          )}

          {/* ── Preview table ─── */}
          {hasQueried && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nw-text-primary)' }}>
                  Preview
                </span>
                {!loadingPreview && (
                  <span style={{ fontSize: 11, color: 'var(--nw-text-muted)' }}>
                    Showing {preview.length} of {total} tickets
                  </span>
                )}
              </div>

              {loadingPreview ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={20} className="animate-spin" color="var(--nw-accent)" />
                </div>
              ) : preview.length === 0 ? (
                <div style={{
                  height: 160, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <FileText size={32} color="var(--nw-border-strong)" />
                  <p style={{ fontSize: 13, color: 'var(--nw-text-muted)' }}>
                    No tickets found for the selected filters.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }} className="touch-scroll">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--nw-elevated)' }}>
                        {['ID', 'Title', 'Status', 'Priority', 'Category', 'Department', 'Customer', 'Created'].map(h => (
                          <th key={h} style={{
                            padding: '9px 12px', textAlign: 'left',
                            color: 'var(--nw-text-muted)', fontWeight: 700,
                            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                            borderBottom: '1px solid var(--nw-border)',
                            whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((t, i) => (
                        <tr
                          key={t.ticket_id || i}
                          style={{
                            borderBottom: '1px solid var(--nw-border)',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '9px 12px', color: 'var(--nw-text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {t.ticket_id || '—'}
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--nw-text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.title || '—'}
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            <Pill label={t.status || '—'} color={STATUS_COLOR[t.status] || '#9A9CA5'} />
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            <Pill label={t.priority || '—'} color={P_COLOR[t.priority] || '#9A9CA5'} />
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--nw-text-secondary)', whiteSpace: 'nowrap' }}>
                            {t.category || '—'}
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--nw-text-secondary)', whiteSpace: 'nowrap' }}>
                            {t.department || '—'}
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--nw-text-secondary)', whiteSpace: 'nowrap' }}>
                            {t.customer_name || '—'}
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--nw-text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                            {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Empty state (first load) ─── */}
          {!hasQueried && (
            <div style={{
              ...card,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: '60px 22px',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'var(--nw-accent-dim)', border: '1px solid rgba(201,111,74,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Filter size={28} color="var(--nw-accent)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--nw-text-primary)', marginBottom: 6 }}>
                  Configure Filters & Run Report
                </p>
                <p style={{ fontSize: 12, color: 'var(--nw-text-muted)', maxWidth: 360 }}>
                  Use the filter panel above to select date ranges, status, department, and more —
                  then click <strong style={{ color: 'var(--nw-accent)' }}>Run Report</strong> to preview matching tickets.
                </p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: 'var(--nw-text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
    }}>
      {children}
    </p>
  )
}
