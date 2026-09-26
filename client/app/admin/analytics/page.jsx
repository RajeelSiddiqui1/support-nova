'use client'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import { TrendingUp, RefreshCw, Calendar, BarChart3, Activity, ShieldAlert } from 'lucide-react'
import { getAnalyticsTrends } from '../../lib/apiClient'

/* ── Chart palette (hex strings for Recharts) ── */
const C = ['#C96F4A','#C9A227','#4FA689','#4A9BC9','#9B7EDE','#D9A441','#C1495B']

/* ── Shared dark chart styles ── */
const TOOLTIP_STYLE = {
  background: '#1D2230',
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 10,
  padding: '8px 12px',
  color: '#F2EFEA',
  fontSize: 12,
}
const AXIS_STYLE = { fontSize: 10, fill: '#9A9CA5' }
const GRID_PROPS = { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '3 3' }
const card = {
  background: '#151922',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: '20px 22px',
}

const RANGES = ['7d', '30d', '90d']

/* ── Placeholder shape for graceful empty state ── */
const EMPTY = {
  summary: { total: 0, open: 0, resolved: 0, breach_rate: 0 },
  volume_by_day: [],
  by_category: [],
  by_sentiment: { positive: 0, neutral: 0, negative: 0, urgent: 0 },
  escalation_by_day: [],
  sla_by_day: [],
  repeat_by_week: [],
  ai_accuracy_by_day: [],
}

/* ── Custom Tooltips ── */
const Tip = ({ active, payload, label, unit = '' }) =>
  active && payload?.length ? (
    <div style={TOOLTIP_STYLE}>
      <p style={{ color: '#9A9CA5', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#F2EFEA', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
          {p.name}: {p.value}{unit}
        </p>
      ))}
    </div>
  ) : null

export default function AdminAnalyticsPage() {
  const [range, setRange]   = useState('30d')
  const [data, setData]     = useState(EMPTY)
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState('')
  const [lastRefresh, setLast] = useState(null)

  const load = useCallback(async (r) => {
    setLoad(true)
    setError('')
    try {
      const res = await getAnalyticsTrends(r)
      setData(res || EMPTY)
      setLast(new Date())
    } catch (e) {
      setError(e.message || 'Failed to load analytics trends.')
      setData(EMPTY)
    } finally {
      setLoad(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  const sentimentData = [
    { name: 'Positive', value: data.by_sentiment?.positive || 0, color: C[2] },
    { name: 'Neutral',  value: data.by_sentiment?.neutral  || 0, color: '#9A9CA5' },
    { name: 'Negative', value: data.by_sentiment?.negative || 0, color: C[5] },
    { name: 'Urgent',   value: data.by_sentiment?.urgent   || 0, color: C[6] },
  ]

  const sidebarUser = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {}

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--nw-base)' }}>
      <Sidebar role="admin" userName={sidebarUser.name} userEmail={sidebarUser.email} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar
          title="Analytics & Trends"
          subtitle="Deep time-series complaint intelligence"
        />

        <main style={{ flex: 1, overflowY: 'auto', padding: '22px' }} className="responsive-main-padding">

          {/* ── Header row ─────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--nw-text-primary)', marginBottom: 4 }}>
                Complaint Intelligence
              </h2>
              <p style={{ fontSize: 12, color: 'var(--nw-text-muted)' }}>
                Live aggregated data from MongoDB Atlas
                {lastRefresh && ` · Last refreshed ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Range selector */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 10, padding: 3 }}>
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    style={{
                      padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      background: range === r ? 'var(--nw-accent)' : 'transparent',
                      color: range === r ? 'var(--nw-text-inverse)' : 'var(--nw-text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Refresh */}
              <button
                onClick={() => load(range)}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--nw-elevated)', border: '1px solid var(--nw-border-strong)',
                  borderRadius: 9, padding: '7px 14px', cursor: loading ? 'not-allowed' : 'pointer',
                  color: 'var(--nw-text-secondary)', fontSize: 12, fontWeight: 600,
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Error ─────────────────────────────── */}
          {error && (
            <div style={{
              background: 'var(--nw-danger-dim)', border: '1px solid rgba(193,73,91,0.3)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 20,
              color: 'var(--nw-danger)', fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* ── Summary KPI row ───────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total Complaints',  val: data.summary?.total      ?? 0,       color: '#C96F4A' },
              { label: 'Open Tickets',      val: data.summary?.open        ?? 0,       color: '#D9A441' },
              { label: 'Resolved',          val: data.summary?.resolved    ?? 0,       color: '#4FA689' },
              { label: 'SLA Breach Rate',   val: `${(data.summary?.breach_rate ?? 0).toFixed(1)}%`, color: '#C1495B' },
            ].map(k => (
              <div key={k.label} style={{ ...card, padding: '14px 16px' }}>
                <p style={{ fontSize: 10, color: 'var(--nw-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  {k.label}
                </p>
                <p style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                  {loading ? '—' : k.val}
                </p>
              </div>
            ))}
          </div>

          {/* ── Chart grid ───────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>

            {/* 1. Complaint Volume Over Time */}
            <div style={{ ...card, gridColumn: '1 / -1' }}>
              <ChartHeader icon={<Activity size={15} color="#C96F4A" />} title="Complaint Volume Over Time" subtitle={`Daily totals · last ${range}`} />
              {loading ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.volume_by_day || []}>
                    <defs>
                      <linearGradient id="vol-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#C96F4A" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#C96F4A" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="count" name="Complaints" stroke="#C96F4A" fill="url(#vol-grad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 2. Category Distribution */}
            <div style={card}>
              <ChartHeader icon={<BarChart3 size={15} color="#C9A227" />} title="Category Distribution" />
              {loading ? <ChartSkeleton h={220} /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.by_category || []} layout="vertical">
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis type="number" tick={AXIS_STYLE} />
                    <YAxis type="category" dataKey="category" tick={AXIS_STYLE} width={90} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="count" name="Tickets" radius={[0,5,5,0]}>
                      {(data.by_category || []).map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 3. Sentiment Distribution */}
            <div style={card}>
              <ChartHeader icon={<span style={{ fontSize: 14 }}>😊</span>} title="Sentiment Distribution" />
              {loading ? <ChartSkeleton h={220} /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sentimentData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={75} innerRadius={40}
                      paddingAngle={3}
                    >
                      {sentimentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#9A9CA5' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 4. Escalation Trend */}
            <div style={card}>
              <ChartHeader icon={<ShieldAlert size={15} color="#C1495B" />} title="Escalation Trend" subtitle={`Escalated tickets per day · ${range}`} />
              {loading ? <ChartSkeleton h={180} /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.escalation_by_day || []}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Line type="monotone" dataKey="count" name="Escalated" stroke="#C1495B" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 5. SLA Risk Trend */}
            <div style={card}>
              <ChartHeader icon={<span style={{ fontSize: 14 }}>⏱</span>} title="SLA Risk Trend" />
              {loading ? <ChartSkeleton h={180} /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.sla_by_day || []}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                    <Tooltip content={<Tip />} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="breached"  name="Breached"  stackId="sla" fill="#C1495B" />
                    <Bar dataKey="at_risk"   name="At Risk"   stackId="sla" fill="#D9A441" />
                    <Bar dataKey="safe"      name="Safe"      stackId="sla" fill="#4FA689" radius={[4,4,0,0]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#9A9CA5' }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 6. Repeat Complaint Trend */}
            <div style={card}>
              <ChartHeader icon={<span style={{ fontSize: 14 }}>🔁</span>} title="Repeat Complaint Trend" subtitle="% of weekly complaints that are repeats" />
              {loading ? <ChartSkeleton h={180} /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.repeat_by_week || []}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="week" tick={AXIS_STYLE} />
                    <YAxis tick={AXIS_STYLE} unit="%" />
                    <Tooltip content={<Tip unit="%" />} />
                    <Line type="monotone" dataKey="repeat_pct" name="Repeat %" stroke="#C9A227" strokeWidth={2} dot={{ r: 3, fill: '#C9A227' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 7. AI Accuracy Trend */}
            <div style={card}>
              <ChartHeader icon={<span style={{ fontSize: 14 }}>🤖</span>} title="AI Pipeline Accuracy" subtitle="GenAI vs Python match rate over time" />
              {loading ? <ChartSkeleton h={180} /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.ai_accuracy_by_day || []}>
                    <defs>
                      <linearGradient id="ai-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4FA689" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4FA689" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={AXIS_STYLE} unit="%" domain={[0, 100]} />
                    <Tooltip content={<Tip unit="%" />} />
                    <Area type="monotone" dataKey="match_pct" name="Match Rate" stroke="#4FA689" fill="url(#ai-grad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

          </div>{/* end chart grid */}
        </main>
      </div>
    </div>
  )
}

/* ── Sub-components ── */
function ChartHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: subtitle ? 3 : 0 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nw-text-primary)' }}>{title}</span>
      </div>
      {subtitle && <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', marginLeft: 22 }}>{subtitle}</p>}
    </div>
  )
}

function ChartSkeleton({ h = 200 }) {
  return (
    <div style={{
      height: h, borderRadius: 10,
      background: 'linear-gradient(90deg, var(--nw-elevated) 25%, rgba(29,34,48,0.6) 50%, var(--nw-elevated) 75%)',
      backgroundSize: '400% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}
