/**
 * NovaWear API Client — centralized typed fetch module
 * All new pages/components should import from here.
 * Existing pages may continue using API_BASE + fetch directly.
 */

export { API_BASE } from './api'

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '')
const isLocal = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(configuredApiUrl)

const BASE = configuredApiUrl && !(process.env.NODE_ENV === 'production' && isLocal)
  ? configuredApiUrl
  : process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : ''

/** Internal fetch wrapper with error handling */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try { const j = await res.json(); detail = j.detail || detail } catch {}
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

/** Download helper — returns a Blob for file export */
async function apiDownload(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    let detail = `Download failed: HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j.detail) detail = j.detail
    } catch {}
    throw new Error(detail)
  }
  return res.blob()
}

// ─── Admin Analytics ─────────────────────────────────────────────────────────

/**
 * @param {'7d'|'30d'|'90d'} range
 * @returns {Promise<AnalyticsTrends>}
 */
export const getAnalyticsTrends = (range = '30d') =>
  apiFetch(`/api/admin/analytics/trends?range=${range}`)

/**
 * Summary analytics (already implemented in admin/dashboard)
 * @returns {Promise<AnalyticsSummary>}
 */
export const getAnalyticsSummary = () =>
  apiFetch('/api/admin/analytics')

// ─── Admin Reports ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ReportFilters
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [from_date]
 * @property {string} [to_date]
 * @property {string} [status]
 * @property {string} [department]
 * @property {string} [category]
 * @property {string} [priority]
 * @property {number} [limit]
 */

/**
 * @param {ReportFilters} filters
 * @returns {Promise<{tickets: Ticket[], total: number}>}
 */
export const getReportPreview = (filters = {}) => {
  const cleanFilters = { ...filters }
  if (cleanFilters.from && !cleanFilters.from_date) cleanFilters.from_date = cleanFilters.from
  if (cleanFilters.to && !cleanFilters.to_date) cleanFilters.to_date = cleanFilters.to

  const params = new URLSearchParams()
  Object.entries(cleanFilters).forEach(([k, v]) => { if (v) params.set(k, String(v)) })
  return apiFetch(`/api/admin/reports/preview?${params}`)
}

/**
 * Export report — client-side CSV fallback if backend endpoint unavailable
 * @param {'csv'|'xlsx'|'pdf'} format
 * @param {ReportFilters} filters
 * @param {Ticket[]} [fallbackRows] — used for client-side CSV if backend returns 404/500
 */
export async function exportReport(format, filters = {}, fallbackRows = []) {
  const cleanFilters = { ...filters }
  if (cleanFilters.from && !cleanFilters.from_date) cleanFilters.from_date = cleanFilters.from
  if (cleanFilters.to && !cleanFilters.to_date) cleanFilters.to_date = cleanFilters.to

  const params = new URLSearchParams({ format, ...cleanFilters })
  try {
    const blob = await apiDownload(`/api/admin/reports/export?${params}`)
    const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
    triggerDownload(blob, `novawear-complaints-report-${Date.now()}.${ext}`)
  } catch (err) {
    // Fallback: client-side CSV generation
    if (format === 'csv' && fallbackRows.length) {
      clientCsvExport(fallbackRows)
    } else {
      throw err
    }
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function clientCsvExport(rows) {
  if (!rows.length) return
  const cols = [
    { key: 'ticket_id', label: 'Ticket ID' },
    { key: 'created_at', label: 'Date Created' },
    { key: 'customer_name', label: 'Customer Name' },
    { key: 'customer_email', label: 'Customer Email' },
    { key: 'order_id', label: 'Order ID' },
    { key: 'channel', label: 'Channel' },
    { key: 'title', label: 'Complaint Title' },
    { key: 'description', label: 'Complaint Description' },
    { key: 'customer_department', label: 'Customer Department' },
    { key: 'department', label: 'Active Department' },
    { key: 'category', label: 'Issue Category' },
    { key: 'sub_category', label: 'Subcategory' },
    { key: 'priority', label: 'Priority' },
    { key: 'urgency', label: 'Urgency' },
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'status', label: 'Ticket Status' },
    { key: 'match_status', label: 'Policy / Dept Match' },
    { key: 'assigned_agent', label: 'Assigned Agent' },
    { key: 'assigned_agent_email', label: 'Agent Email' },
    { key: 'policy_id', label: 'Policy Reference' },
    { key: 'sla_breach', label: 'SLA Breached' },
    { key: 'agent_notes', label: 'Agent Resolution Notes' },
    { key: 'draft_response', label: 'AI Recommended Response' },
  ]
  const header = cols.map(c => `"${c.label}"`).join(',')
  const lines = rows.map(r =>
    cols.map(c => {
      let val = r[c.key]
      if (val === undefined || val === null) val = ''
      if (typeof val === 'boolean') val = val ? 'Yes' : 'No'
      if (typeof val === 'object') val = JSON.stringify(val)
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `novawear-complaints-report-${Date.now()}.csv`)
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

/** @param {string} ticketId @param {string} reply */
export const submitClarificationReply = (ticketId, reply) =>
  apiFetch(`/api/tickets/${ticketId}/clarification-reply`, {
    method: 'POST',
    body: JSON.stringify({ reply }),
  })

/** @param {string} ticketId */
export const getTicketDetail = (ticketId) =>
  apiFetch(`/api/tickets/${ticketId}`)

/**
 * @param {{ customerId?: string, customerEmail?: string }} opts
 */
export const getCustomerTickets = ({ customerId, customerEmail } = {}) => {
  const p = new URLSearchParams()
  if (customerId)    p.set('customer_id', customerId)
  if (customerEmail) p.set('customer_email', customerEmail)
  return apiFetch(`/api/tickets?${p}`)
}

// ─── Admin Resources ──────────────────────────────────────────────────────────

export const getAdminUsers    = () => apiFetch('/api/admin/users')
export const getPolicies      = () => apiFetch('/api/policies')
export const getRules         = () => apiFetch('/api/admin/rules')
export const getDepartments   = () => apiFetch('/api/departments')
export const getCategories    = () => apiFetch('/api/categories')

/**
 * @param {{ rule_id: string, condition: string, action: string, priority: string }} rule
 */
export const createRule = (rule) =>
  apiFetch('/api/admin/rules', { method: 'POST', body: JSON.stringify(rule) })

/** @param {string} ruleId */
export const deleteRule = (ruleId) =>
  apiFetch(`/api/admin/rules/${ruleId}`, { method: 'DELETE' })
