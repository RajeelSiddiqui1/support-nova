'use client'
import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import Link from 'next/link'
import { Ticket, CheckCircle, Clock, PlusCircle, Star, ChevronRight, AlertCircle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const TICKETS = [
  { id: 'CMP-00421', category: 'Delivery Issue',  sub: 'Late Delivery',       date: 'Sep 23, 2026', dept: 'Logistics',   status: 'In Triage', p: 'P1', sla: '4h 20m', risk: 65 },
  { id: 'CMP-00419', category: 'Wrong Product',    sub: 'Item Mismatch',       date: 'Sep 22, 2026', dept: 'Fulfillment', status: 'AI Review',  p: 'P2', sla: '18h',    risk: 22 },
  { id: 'CMP-00416', category: 'Billing Error',    sub: 'Double Charge',       date: 'Sep 21, 2026', dept: 'Finance',     status: 'Resolved',  p: 'P1', sla: '—',       risk: 0  },
  { id: 'CMP-00410', category: 'Product Defect',   sub: 'Damaged on Arrival',  date: 'Sep 19, 2026', dept: 'Quality',     status: 'Resolved',  p: 'P2', sla: '—',       risk: 0  },
  { id: 'CMP-00405', category: 'Refund Request',   sub: 'Policy Refund',       date: 'Sep 18, 2026', dept: 'Finance',     status: 'Closed',    p: 'P3', sla: '—',       risk: 0  },
]

const CHART = [
  { month: 'Apr', v: 4 }, { month: 'May', v: 7 }, { month: 'Jun', v: 3 },
  { month: 'Jul', v: 9 }, { month: 'Aug', v: 5 }, { month: 'Sep', v: 2 },
]

const TIMELINE = [
  { label: 'Complaint Submitted',  done: true,  active: false, date: 'Sep 23, 11:42 AM' },
  { label: 'AI Pipeline Analysis', done: true,  active: false, date: 'Sep 23, 11:42 AM', tag: '⚡ 1.4s' },
  { label: 'Agent Assigned',       done: true,  active: false, date: 'Sep 23, 12:05 PM' },
  { label: 'Awaiting Resolution',  done: false, active: true,  date: 'In Progress…' },
  { label: 'Resolved & Closed',    done: false, active: false, date: '—' },
]

const STATUS_COLORS = {
  'In Triage': { bg: '#FFFBEB', color: '#D97706', border: 'rgba(217,119,6,0.25)' },
  'AI Review': { bg: '#F5F3FF', color: '#7C3AED', border: 'rgba(124,58,237,0.25)' },
  'Resolved':  { bg: '#ECFDF5', color: '#059669', border: 'rgba(5,150,105,0.25)'  },
  'Closed':    { bg: '#F8FAFC', color: '#64748B', border: 'rgba(100,116,139,0.2)' },
}

const P_COLORS = {
  P0: { bg: '#FFF1F2', color: '#E11D48' },
  P1: { bg: '#FFFBEB', color: '#D97706' },
  P2: { bg: '#EFF6FF', color: '#2563EB' },
  P3: { bg: '#F8FAFC', color: '#64748B' },
}

const glass = { background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 16, boxShadow: '0 4px 24px rgba(148,163,184,0.1)' }

const CustomTip = ({ active, payload, label }) => active && payload?.length ? (
  <div style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 8px 24px rgba(148,163,184,0.15)' }}>
    <p style={{ color: '#94A3B8', fontSize: 11 }}>{label}</p>
    <p style={{ color: '#7C3AED', fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{payload[0].value} tickets</p>
  </div>
) : null

export default function CustomerDashboard() {
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? TICKETS : TICKETS.filter(t => t.status === filter)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <div style={{ display: 'none' }} id="sb-desktop" className="md:block">
        <Sidebar role="customer" userName="Rajeev Khan" userEmail="rajeev@gmail.com" />
      </div>
      <div style={{ display: 'flex' }}>
        <Sidebar role="customer" userName="Rajeev Khan" userEmail="rajeev@gmail.com" />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Navbar title="Customer Portal" subtitle="Manage and track your complaints" />

        <main style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Welcome Banner */}
          <div className="animate-fade-up" style={{
            ...glass,
            padding: '22px 26px',
            background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(79,70,229,0.04))',
            border: '1px solid rgba(124,58,237,0.15)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
          }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: '#0F172A', marginBottom: 5 }}>Welcome back, Rajeev 👋</h2>
              <p style={{ color: '#64748B', fontSize: 13 }}>
                You have <span style={{ color: '#D97706', fontWeight: 600 }}>2 active tickets</span> — one is in AI triage.
              </p>
            </div>
            <Link href="/customer/submit" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', borderRadius: 11, textDecoration: 'none',
              background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
              color: 'white', fontSize: 13, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
              transition: 'all 0.2s',
            }}>
              <PlusCircle size={14} /> Submit Complaint
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            <StatCard title="Total Submitted" value="12" subtitle="All time" icon={Ticket}       color="violet"  trend="up"   trendValue="3"  delay={0}   />
            <StatCard title="Active Tickets"  value="2"  subtitle="Pending"  icon={Clock}        color="amber"   trend="down" trendValue="1"  delay={80}  />
            <StatCard title="Resolved"        value="9"  subtitle="Closed"   icon={CheckCircle}  color="emerald" trend="up"   trendValue="2"  delay={160} />
            <StatCard title="Avg Resolution"  value="18h" subtitle="Turn-around" icon={Star}     color="cyan"                                delay={240} />
          </div>

          {/* Table + Sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

            {/* Ticket Table */}
            <div className="animate-fade-up d200" style={{ ...glass, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>My Complaint History</h3>
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>5 total complaints</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['All', 'In Triage', 'Resolved', 'AI Review'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: filter === f ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(226,232,240,0.7)',
                        background: filter === f ? 'rgba(124,58,237,0.08)' : 'rgba(248,250,252,0.7)',
                        color: filter === f ? '#7C3AED' : '#64748B',
                      }}
                    >{f}</button>
                  ))}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr>
                      {['Ticket ID', 'Category', 'Date', 'Dept', 'Priority', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(226,232,240,0.6)', background: 'rgba(248,250,252,0.6)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => {
                      const s = STATUS_COLORS[t.status] || STATUS_COLORS['Closed']
                      const pc = P_COLORS[t.p] || P_COLORS.P3
                      return (
                        <tr key={t.id} style={{ transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#7C3AED', fontWeight: 600 }}>{t.id}</td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{t.category}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{t.sub}</div>
                          </td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)', fontSize: 11, color: '#94A3B8' }}>{t.date}</td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)', fontSize: 11, color: '#64748B', background: 'rgba(248,250,252,0.5)', borderRadius: 6 }}>{t.dept}</td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: pc.bg, color: pc.color, fontFamily: 'monospace' }}>{t.p}</span>
                          </td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{t.status}</span>
                          </td>
                          <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
                            <Link href="/customer/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#7C3AED', textDecoration: 'none', background: 'rgba(124,58,237,0.07)', padding: '4px 9px', borderRadius: 7, border: '1px solid rgba(124,58,237,0.15)' }}>
                              View <ChevronRight size={10} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Col */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Chart */}
              <div className="animate-fade-up d300" style={{ ...glass, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Complaint Trend</h3>
                <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 14 }}>Last 6 months</p>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={CHART}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTip />} />
                    <Area type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={2} fill="url(#g1)" dot={{ fill: '#7C3AED', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Timeline */}
              <div className="animate-fade-up d400" style={{ ...glass, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>Active Ticket</h3>
                <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED', fontWeight: 600, marginBottom: 14 }}>CMP-00421</p>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 1, background: 'rgba(226,232,240,0.8)' }} />
                  {TIMELINE.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 11, marginBottom: 13, alignItems: 'flex-start', position: 'relative' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                        background: s.done ? '#059669' : s.active ? '#7C3AED' : '#E2E8F0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: s.active ? '0 0 0 4px rgba(124,58,237,0.15)' : 'none',
                      }}>
                        {s.done && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        {s.active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: s.active ? 600 : 400, color: s.done || s.active ? '#0F172A' : '#94A3B8' }}>{s.label}</p>
                        <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                          {s.date} {s.tag && <span style={{ color: '#059669', fontFamily: 'monospace' }}>{s.tag}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
