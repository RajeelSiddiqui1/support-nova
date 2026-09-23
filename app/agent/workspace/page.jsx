'use client'
import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import StatCard from '../../components/StatCard'
import { Zap, ShieldCheck, Send, ArrowUp, MessageSquare, CheckCircle, AlertTriangle, Clock, User, Info, Ticket } from 'lucide-react'

const glass = { background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 14, boxShadow: '0 4px 20px rgba(148,163,184,0.1)' }

const QUEUE = [
  { id: 'CMP-00421', cat: 'Delivery Issue',   p: 'P0', dept: 'Logistics',   sla: '1h 20m', risk: 88, status: 'In Triage' },
  { id: 'CMP-00420', cat: 'Billing Error',     p: 'P1', dept: 'Finance',     sla: '4h 00m', risk: 60, status: 'In Triage' },
  { id: 'CMP-00419', cat: 'Wrong Product',     p: 'P2', dept: 'Fulfillment', sla: '18h',    risk: 22, status: 'AI Review' },
  { id: 'CMP-00418', cat: 'Product Defect',    p: 'P2', dept: 'Quality',     sla: '14h 30m',risk: 30, status: 'AI Review' },
  { id: 'CMP-00417', cat: 'Refund Request',    p: 'P1', dept: 'Finance',     sla: '2h 15m', risk: 78, status: 'In Triage' },
]

const TICKET = {
  id: 'CMP-00421', title: 'Order delayed by 8 days — no update from delivery partner',
  customer: 'Rajeev Khan', type: 'Premium Member', orderId: 'ORD-78234',
  desc: 'I placed an order on September 15th with estimated delivery of September 17th. It has now been 8 days and I have received no update from the delivery partner. The tracking shows "Out for Delivery" since Sep 18. I have called customer service 3 times with no resolution. I need either immediate delivery or a full refund as per your delivery guarantee policy.',
  genai: {
    issue: 'Significant Delivery Delay (8 days)',
    sentiment: 'Very Frustrated / Angry 😠',
    priority: 'P0 — Critical',
    dept: 'Logistics & Customer Experience',
    steps: ['Acknowledge delay with sincere apology', 'Investigate with Logistics (Ref: ORD-78234)', 'Offer: Full Refund OR Express Re-shipment', 'Apply 15% loyalty coupon as goodwill gesture'],
    draft: 'Dear Rajeev, we sincerely apologize for the unacceptable delay with your order ORD-78234. This falls far short of our standards. We are immediately escalating this to our logistics team. You may choose a full refund or priority re-shipment. As a goodwill gesture, a 15% coupon has been applied to your account.',
  },
  python: {
    rule: 'DEL-POL-04: Delivery Guarantee Breach (>72h)',
    escalationRequired: true,
    refundEligible: true,
    prohibited: ['Promise delivery date without confirmation', 'Offer discount > 20%'],
    mandatory: ['Escalate to Logistics within 2h', 'Document in SLA breach log'],
    policy: 'Customer Delivery Guarantee Policy v2.1 §4.3',
    score: 94,
  },
  match: true,
}

const TONES   = ['Empathetic', 'Professional', 'Concise', 'Formal']
const PCOLORS = { P0: { bg: '#FFF1F2', c: '#E11D48' }, P1: { bg: '#FFFBEB', c: '#D97706' }, P2: { bg: '#EFF6FF', c: '#2563EB' }, P3: { bg: '#F8FAFC', c: '#64748B' } }

export default function AgentWorkspace() {
  const [sel, setSel]       = useState(QUEUE[0].id)
  const [tone, setTone]     = useState('Empathetic')
  const [resp, setResp]     = useState(TICKET.genai.draft)
  const [tab, setTab]       = useState('pipeline')
  const [approved, setApp]  = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'linear-gradient(135deg,#F8FAFC 0%,#EEF2FF 60%,#F0FDF4 100%)' }}>
      <Sidebar role="agent" userName="Support Agent" userEmail="agent@company.com" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Navbar title="Agent Workspace" subtitle="Dual-Pipeline Ticket Workbench" />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT: Queue ── */}
          <div style={{ width: 260, borderRight: '1px solid rgba(226,232,240,0.5)', overflowY: 'auto', background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Queue (5)</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {['All','P0','P1','P2'].map(f => (
                  <button key={f} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid rgba(226,232,240,0.7)', background: f === 'All' ? 'rgba(124,58,237,0.1)' : 'transparent', color: f === 'All' ? '#7C3AED' : '#64748B', cursor: 'pointer' }}>{f}</button>
                ))}
              </div>
            </div>
            {QUEUE.map(t => {
              const pc = PCOLORS[t.p] || PCOLORS.P3
              const active = sel === t.id
              return (
                <div key={t.id} onClick={() => setSel(t.id)} style={{
                  padding: '12px 12px', borderBottom: '1px solid rgba(226,232,240,0.3)', cursor: 'pointer',
                  background: active ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderLeft: active ? '2px solid #7C3AED' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>{t.id}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: pc.bg, color: pc.c }}>{t.p}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#334155', fontWeight: active ? 600 : 400, marginBottom: 5 }}>{t.cat}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{t.dept}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: t.risk > 70 ? '#E11D48' : t.risk > 40 ? '#D97706' : '#059669', fontFamily: 'monospace' }}>⏱ {t.sla}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── CENTER: Pipeline ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            {/* Ticket Header */}
            <div style={{ ...glass }}>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>{TICKET.id}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#FFF1F2', color: '#E11D48' }}>P0 Critical</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#F5F3FF', color: '#7C3AED' }}>Premium Member</span>
                  </div>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.4, marginBottom: 10 }}>{TICKET.title}</h3>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {[[User, TICKET.customer], [Clock, '8 days delayed'], [Info, TICKET.orderId]].map(([Icon, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon size={11} color="#94A3B8" />
                      <span style={{ fontSize: 11, color: '#64748B' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Match Banner */}
            <div style={{
              padding: '11px 16px', borderRadius: 11, display: 'flex', alignItems: 'center', gap: 9,
              background: TICKET.match ? 'rgba(5,150,105,0.07)' : 'rgba(217,119,6,0.07)',
              border: `1px solid ${TICKET.match ? 'rgba(5,150,105,0.25)' : 'rgba(217,119,6,0.25)'}`,
            }}>
              {TICKET.match ? <CheckCircle size={15} color="#059669" /> : <AlertTriangle size={15} color="#D97706" />}
              <span style={{ fontWeight: 700, color: TICKET.match ? '#059669' : '#D97706', fontSize: 13 }}>
                {TICKET.match ? '✅ VERIFIED MATCH' : '⚠ MISMATCH DETECTED'}
              </span>
              <span style={{ fontSize: 12, color: '#64748B' }}>— {TICKET.match ? 'GenAI & Python Rule Engine agree. Safe to approve.' : 'Escalate to Reviewer Queue.'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>Score: {TICKET.python.score}%</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'rgba(226,232,240,0.3)', borderRadius: 10, border: '1px solid rgba(226,232,240,0.5)', width: 'fit-content' }}>
              {[['pipeline', '🔬 Dual Pipeline'], ['desc', '📄 Description']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: tab === k ? 'white' : 'transparent',
                  color: tab === k ? '#0F172A' : '#64748B',
                  boxShadow: tab === k ? '0 1px 4px rgba(148,163,184,0.15)' : 'none',
                  transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>

            {tab === 'desc' && (
              <div style={{ ...glass, padding: 18 }}>
                <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.8 }}>{TICKET.desc}</p>
              </div>
            )}

            {tab === 'pipeline' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                {/* GenAI */}
                <div style={{ ...glass, padding: 18, background: 'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(255,255,255,0.85))', border: '1px solid rgba(124,58,237,0.18)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={13} color="#7C3AED" /></div>
                    <div><p style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED' }}>PIPELINE 1</p><p style={{ fontSize: 10, color: '#94A3B8' }}>GenAI Intelligence</p></div>
                  </div>
                  {[['Primary Issue', TICKET.genai.issue], ['Sentiment', TICKET.genai.sentiment], ['Priority', TICKET.genai.priority], ['Department', TICKET.genai.dept]].map(([k, v]) => (
                    <div key={k} style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k}</p>
                      <p style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>{v}</p>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(124,58,237,0.08)' }}>
                    <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Resolution Steps</p>
                    {TICKET.genai.steps.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 6, alignItems: 'flex-start' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(124,58,237,0.15)', color: '#7C3AED', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i+1}</div>
                        <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Python GT */}
                <div style={{ ...glass, padding: 18, background: 'linear-gradient(135deg,rgba(5,150,105,0.06),rgba(255,255,255,0.85))', border: '1px solid rgba(5,150,105,0.18)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(5,150,105,0.1)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(5,150,105,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={13} color="#059669" /></div>
                    <div><p style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>PIPELINE 2</p><p style={{ fontSize: 10, color: '#94A3B8' }}>Python Ground-Truth</p></div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Rule Match</p>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#059669', background: 'rgba(5,150,105,0.08)', padding: '3px 8px', borderRadius: 6 }}>{TICKET.python.rule}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[['🚨 Escalation Required', '#E11D48'], ['✓ Refund Eligible', '#059669']].map(([label, c]) => (
                      <span key={label} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${c}12`, color: c, border: `1px solid ${c}28` }}>{label}</span>
                    ))}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Mandatory Actions</p>
                    {TICKET.python.mandatory.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                        <CheckCircle size={11} color="#059669" />
                        <p style={{ fontSize: 11, color: '#64748B' }}>{a}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Prohibited Actions</p>
                    {TICKET.python.prohibited.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                        <AlertTriangle size={11} color="#E11D48" />
                        <p style={{ fontSize: 11, color: '#64748B' }}>{a}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 10 }}>Ref: {TICKET.python.policy}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Copilot ── */}
          <div style={{ width: 270, borderLeft: '1px solid rgba(226,232,240,0.5)', overflowY: 'auto', padding: 14, background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 }}>
            {/* Tone */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Response Tone</p>
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)} style={{
                  display: 'block', width: '100%', padding: '8px 11px', marginBottom: 5, borderRadius: 8, textAlign: 'left',
                  border: tone === t ? '1.5px solid rgba(124,58,237,0.35)' : '1px solid rgba(226,232,240,0.7)',
                  background: tone === t ? 'rgba(124,58,237,0.08)' : 'rgba(248,250,252,0.7)',
                  color: tone === t ? '#7C3AED' : '#64748B',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}>{tone === t ? '✓ ' : ''}{t}</button>
              ))}
            </div>

            {/* Response */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Draft Response</p>
              <textarea value={resp} onChange={e => setResp(e.target.value)} rows={10}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid rgba(226,232,240,0.8)', background: 'rgba(248,250,252,0.8)', color: '#0F172A', fontSize: 11, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
            </div>

            {/* Citations */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Insert Policy Cite</p>
              {['DEL-POL-04 §4.3', 'REF-POL-07 §2.1', 'ESC-POL-01 §1.5'].map(ref => (
                <button key={ref} onClick={() => setResp(r => r + ` [${ref}]`)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 6, padding: '7px 10px', marginBottom: 4, borderRadius: 7, border: '1px solid rgba(226,232,240,0.7)', background: 'rgba(248,250,252,0.7)', color: '#64748B', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}>
                  + {ref}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button onClick={() => setApp(true)} style={{
                width: '100%', padding: 11, borderRadius: 10, border: 'none',
                background: approved ? '#059669' : 'linear-gradient(135deg,#059669,#047857)',
                color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: '0 4px 14px rgba(5,150,105,0.3)', transition: 'all 0.2s',
              }}>
                {approved ? <><CheckCircle size={14} /> Approved & Sent!</> : <><Send size={14} /> Approve & Send</>}
              </button>
              <button style={{ width: '100%', padding: 9, borderRadius: 10, border: '1.5px solid rgba(225,29,72,0.25)', background: 'rgba(225,29,72,0.06)', color: '#E11D48', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ArrowUp size={13} /> Escalate to Manager
              </button>
              <button style={{ width: '100%', padding: 9, borderRadius: 10, border: '1px solid rgba(226,232,240,0.7)', background: 'rgba(248,250,252,0.7)', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <MessageSquare size={13} /> Request Clarification
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
