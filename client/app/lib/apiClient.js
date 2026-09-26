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
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
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
 * @param {ReportFilters} filters
 * @returns {Promise<{tickets: Ticket[], total: number}>}
 */
export const getReportPreview = (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)) })
  return apiFetch(`/api/admin/reports/preview?${params}`)
}

/**
 * Export report — client-side CSV fallback if backend endpoint unavailable
 * @param {'csv'|'xlsx'|'pdf'} format
 * @param {ReportFilters} filters
 * @param {Ticket[]} [fallbackRows] — used for client-side CSV if backend returns 404/500
 */
export async function exportReport(format, filters = {}, fallbackRows = []) {
  const params = new URLSearchParams({ format, ...filters })
  try {
    const blob = await apiDownload(`/api/admin/reports/export?${params}`)
    triggerDownload(blob, `novawear-report.${format}`)
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
  const keys = ['ticket_id', 'title', 'status', 'priority', 'category', 'department', 'customer_name', 'created_at', 'sla_breach']
  const header = keys.join(',')
  const lines = rows.map(r =>
    keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  triggerDownload(blob, `novawear-report-${Date.now()}.csv`)
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
