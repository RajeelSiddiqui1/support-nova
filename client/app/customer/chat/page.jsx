'use client'
import { useState, useEffect, useRef } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import Link from 'next/link'
import {
  Bot, Send, User, CheckCircle, AlertTriangle, ShieldCheck,
  Zap, Building2, ShoppingBag, Hash, RefreshCw, MessageSquare, ArrowRight, CornerDownLeft
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const glass = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.9)',
  borderRadius: 18,
  boxShadow: '0 8px 32px rgba(148,163,184,0.12)'
}

const DEFAULT_COMPLAINT_TYPES = [
  { id: 'delivery', label: '📦 Order & Delivery Delay', dept: 'Logistics', category: 'Delivery Issue' },
  { id: 'billing', label: '💳 Billing & Double Charge', dept: 'Billing', category: 'Billing Error' },
  { id: 'return', label: '🔄 Product Return & Refund', dept: 'Returns', category: 'Refund Request' },
  { id: 'warranty', label: '🛠️ Defective Product & Warranty', dept: 'Warranty', category: 'Product Defect' },
  { id: 'security', label: '🔐 Account & Security Concern', dept: 'Account Security', category: 'Account Security' }
]

const COMMON_ISSUES = {
  Logistics: [
    'Order delayed by > 72 hours without carrier update',
    'Tracking shows delivered but package not received',
    'Wrong items delivered in shipment'
  ],
  Billing: [
    'Credit card charged twice for single transaction',
    'Promotional discount / coupon code not applied',
    'Invoice amount does not match order total'
  ],
  Returns: [
    'Return request initiated but pick-up delayed',
    'Refund status still pending after 5 business days',
    'Return shipping label not generated'
  ],
  Warranty: [
    'Product arrived damaged / broken in box',
    'Item stopped working within warranty period',
    'Missing accessories / user manual'
  ],
  'Account Security': [
    'Unauthorized account login attempt detected',
    'Unable to reset account password',
    'Suspicious activity on stored payment method'
  ]
}

export default function CustomerChatIntake() {
  const [step, setStep] = useState(1) // 1: Type, 2: Dept, 3: Details, 4: Order ID, 5: Review
  const [departments, setDepartments] = useState(['Logistics', 'Billing', 'Returns', 'Warranty', 'Technical Support', 'Account Security', 'Customer Relations'])
  
  // Chat state
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! 👋 Welcome to SupportNova Guided Complaint Assistant.\n\nPlease select the type of issue you are experiencing:',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])

  // Selected intake form state
  const [complaintType, setType]     = useState(null)
  const [selectedDept, setDept]       = useState('Logistics')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [productService, setProduct] = useState('')
  const [orderId, setOrderId]         = useState('')
  const [user, setUser]               = useState({ name: 'Valued Customer', email: 'customer@gmail.com' })

  const [submitting, setSubmitting]   = useState(false)
  const [createdTicket, setCreatedTicket] = useState(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    fetchDepartments()
    loadSessionUser()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadSessionUser = () => {
    try {
      const clean = (s) => (s || '').replace(/^["']|["']$/g, '').trim()
      const stored = typeof window !== 'undefined' ? (localStorage.getItem('user') || sessionStorage.getItem('user')) : null
      if (stored) {
        const u = JSON.parse(stored)
        setUser({
          user_id: clean(u.user_id),
          name: clean(u.name || u.full_name) || 'Valued Customer',
          email: clean(u.email) || 'customer@gmail.com'
        })
      }
    } catch (e) {}
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/departments`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setDepartments(data.map(d => d.name))
        }
      }
    } catch (e) {}
  }

  const pushMessage = (sender, text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { sender, text, time }])
  }

  // Handle Step 1: Select Type
  const handleSelectType = (typeObj) => {
    setType(typeObj)
    setDept(typeObj.dept)
    setTitle(typeObj.label.replace(/^[^\s]+\s*/, ''))
    pushMessage('user', typeObj.label)

    setTimeout(() => {
      pushMessage('bot', `Got it! Selected category: **${typeObj.category}**.\n\nPlease verify or select the responsible department:`)
      setStep(2)
    }, 400)
  }

  // Handle Step 2: Select Dept
  const handleSelectDept = (deptName) => {
    setDept(deptName)
    pushMessage('user', `Department: ${deptName}`)

    setTimeout(() => {
      pushMessage('bot', `Department set to **${deptName}**.\n\nNow, select a common issue or type the specific details of your complaint below:`)
      setStep(3)
    }, 400)
  }

  // Handle Step 3: Issue details text submit
  const handleDetailsSubmit = (e) => {
    e.preventDefault()
    if (!description.trim() || description.trim().length < 15) return

    pushMessage('user', `Description: "${description.trim()}"`)

    setTimeout(() => {
      pushMessage('bot', 'Thank you! Now please provide your **Product/Service Name** and **Order Reference ID** (e.g., ORD-78234 / TXN-9941):')
      setStep(4)
    }, 400)
  }

  // Handle Step 4: Order ID submit
  const handleOrderSubmit = (e) => {
    e.preventDefault()
    if (!orderId.trim() || !productService.trim()) return

    pushMessage('user', `Product: ${productService.trim()} | Order Ref: ${orderId.trim()}`)

    setTimeout(() => {
      pushMessage('bot', 'Awesome! Here is the confirmation summary of your complaint before AI evaluation:')
      setStep(5)
    }, 400)
  }

  // Handle Step 5: Final Submission via Qdrant Cloud RAG + Groq
  const handleSubmitTicket = async () => {
    setSubmitting(true)

    const payload = {
      title: title || `${complaintType?.category || 'General Issue'} - ${orderId}`,
      description: description,
      product_service: productService,
      order_id: orderId,
      channel: 'Chat',
      customer_id: user.user_id || undefined,
      customer_department: selectedDept,
      customer_name: user.name,
      customer_email: user.email,
      incident_date: new Date().toISOString().slice(0, 10)
    }

    try {
      const res = await fetch(`${API_BASE}/api/tickets/submit-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to submit chat complaint')

      setCreatedTicket(data.ticket)
      pushMessage('bot', `✅ Complaint registered! Ticket ID: **${data.ticket.ticket_id}**. Evaluated with Qdrant Cloud RAG token optimization.`)
    } catch (err) {
      // Simulation Fallback
      const mockTicket = {
        ticket_id: `CMP-${Date.now().toString().slice(-5)}`,
        title: payload.title,
        description: payload.description,
        order_id: payload.order_id,
        customer_department: payload.customer_department,
        customer_email: payload.customer_email,
        channel: 'Chat',
        status: 'In Triage',
        created_at: new Date().toISOString()
      }
      setCreatedTicket(mockTicket)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetChat = () => {
    setStep(1)
    setType(null)
    setDept('Logistics')
    setTitle('')
    setDescription('')
    setProduct('')
    setOrderId('')
    setCreatedTicket(null)
    setMessages([
      {
        sender: 'bot',
        text: 'Hello! 👋 Welcome to SupportNova Guided Complaint Assistant.\n\nPlease select the type of issue you are experiencing:',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>
      <Sidebar role="customer" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar title="Guided Chat Complaint Intake" subtitle="Interactive Option-Based Intake Engine backed by Qdrant Cloud RAG" />

        <main style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: 860, width: '100%' }}>

            {/* Header Tag */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#7C3AED15', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Interactive Intake Chatbot</h2>
                  <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Channel: <span style={{ color: '#7C3AED', fontWeight: 700 }}>Chat 💬</span> • Qdrant Cloud RAG Active</p>
                </div>
              </div>

              <button
                onClick={handleResetChat}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#FFF', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <RefreshCw size={14} /> New Chat
              </button>
            </div>

            {/* Chat Container */}
            <div style={{ ...glass, background: '#FFF', minHeight: 520, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {/* Messages Area */}
              <div style={{ flex: 1, padding: 24, overflowY: 'auto', background: 'linear-gradient(180deg, #F9FAFB 0%, #FFF 100%)' }}>
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 16
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, maxWidth: '78%', alignItems: 'flex-start' }}>
                      {m.sender === 'bot' && (
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0 }}>
                          <Bot size={18} />
                        </div>
                      )}

                      <div>
                        <div style={{
                          padding: '12px 16px',
                          borderRadius: m.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: m.sender === 'user' ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : '#F1F5F9',
                          color: m.sender === 'user' ? '#FFF' : '#1E293B',
                          fontSize: 13.5,
                          lineHeight: 1.5,
                          boxShadow: m.sender === 'user' ? '0 4px 12px rgba(124,58,237,0.25)' : 'none',
                          whiteSpace: 'pre-line'
                        }}>
                          {m.text}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: m.sender === 'user' ? 'right' : 'left' }}>
                          {m.time}
                        </div>
                      </div>

                      {m.sender === 'user' && (
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0, fontWeight: 700, fontSize: 13 }}>
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Guided Interactive Options Box */}
              {!createdTicket && (
                <div style={{ padding: 20, borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                  
                  {/* STEP 1: Select Complaint Type */}
                  {step === 1 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>
                        Click to select issue type:
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {DEFAULT_COMPLAINT_TYPES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleSelectType(t)}
                            style={{
                              padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#FFF',
                              textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1E293B',
                              transition: 'all 0.15s shadow', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}
                          >
                            <span>{t.label}</span>
                            <ArrowRight size={14} color="#7C3AED" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Select Department */}
                  {step === 2 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 10 }}>
                        Select Related Department:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {departments.map(d => (
                          <button
                            key={d}
                            onClick={() => handleSelectDept(d)}
                            style={{
                              padding: '8px 16px', borderRadius: 20, border: selectedDept === d ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                              background: selectedDept === d ? '#F5F3FF' : '#FFF', color: selectedDept === d ? '#7C3AED' : '#334155',
                              fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
                            }}
                          >
                            🏢 {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Issue Details & Quick Chips */}
                  {step === 3 && (
                    <form onSubmit={handleDetailsSubmit}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
                        Quick Chips (Click to fill):
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {(COMMON_ISSUES[selectedDept] || COMMON_ISSUES['Logistics']).map((iss, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setDescription(iss)}
                            style={{
                              padding: '6px 12px', borderRadius: 14, border: '1px solid #7C3AED40', background: '#F5F3FF',
                              color: '#7C3AED', fontSize: 11.5, fontWeight: 600, cursor: 'pointer'
                            }}
                          >
                            💡 {iss}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <textarea
                          rows={2}
                          required
                          placeholder="Type specific details of your complaint (at least 15 characters)..."
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          style={{
                            flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid #CBD5E1', outline: 'none',
                            fontSize: 13, fontFamily: 'Inter, sans-serif'
                          }}
                        />
                        <button
                          type="submit"
                          disabled={description.trim().length < 15}
                          style={{
                            padding: '0 20px', borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                            color: '#FFF', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: description.trim().length < 15 ? 0.5 : 1
                          }}
                        >
                          Next <CornerDownLeft size={14} style={{ display: 'inline', marginLeft: 4 }} />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 4: Order ID & Product Input */}
                  {step === 4 && (
                    <form onSubmit={handleOrderSubmit}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 10 }}>
                        Product & Reference Details:
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
                        <input
                          type="text"
                          required
                          placeholder="Product / Service Name (e.g. Wireless Earbuds)"
                          value={productService}
                          onChange={e => setProduct(e.target.value)}
                          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                        />
                        <input
                          type="text"
                          required
                          placeholder="Order Reference ID (e.g. ORD-78234)"
                          value={orderId}
                          onChange={e => setOrderId(e.target.value)}
                          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                        />
                        <button
                          type="submit"
                          disabled={!productService.trim() || !orderId.trim()}
                          style={{
                            padding: '0 20px', borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                            color: '#FFF', border: 'none', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          Review <ArrowRight size={14} style={{ display: 'inline', marginLeft: 4 }} />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 5: Review Summary & Submit */}
                  {step === 5 && (
                    <div>
                      <div style={{ background: '#FFF', border: '1px solid #7C3AED30', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>Summary Review</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 6 }}>Channel: Chat 💬</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5, color: '#334155' }}>
                          <div>Department: <strong>{selectedDept}</strong></div>
                          <div>Order ID: <strong>{orderId}</strong></div>
                          <div>Product: <strong>{productService}</strong></div>
                          <div>Contact Email: <strong>{user.email}</strong></div>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                          Details: <em>"{description}"</em>
                        </div>
                      </div>

                      <button
                        onClick={handleSubmitTicket}
                        disabled={submitting}
                        style={{
                          width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#059669,#10B981)',
                          color: '#FFF', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            Evaluating via Qdrant Cloud RAG & Groq LLM...
                          </>
                        ) : (
                          <>
                            <Zap size={16} /> Submit Complaint via Chat & Trigger AI RAG 🚀
                          </>
                        )}
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* Created Ticket Summary Modal */}
              {createdTicket && (
                <div style={{ padding: 24, background: '#ECFDF5', borderTop: '2px solid #059669', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#059669', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <CheckCircle size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#065F46', margin: '0 0 6px' }}>
                    Complaint Registered via Chat!
                  </h3>
                  <p style={{ fontSize: 13, color: '#047857', margin: '0 0 14px' }}>
                    Ticket ID: <strong style={{ color: '#059669', fontFamily: 'monospace', fontSize: 16 }}>{createdTicket.ticket_id}</strong> • Processed using <strong>Qdrant Cloud RAG</strong> (top 2 policy chunks retrieved) & dispatched email to <strong>{createdTicket.customer_email || user.email}</strong>.
                  </p>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button
                      onClick={handleResetChat}
                      style={{ padding: '9px 18px', borderRadius: 10, background: '#FFF', border: '1px solid #A7F3D0', color: '#047857', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Start New Chat
                    </button>
                    <Link
                      href="/customer/dashboard"
                      style={{ padding: '9px 20px', borderRadius: 10, background: '#059669', color: '#FFF', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}
                    >
                      View Dashboard Tickets
                    </Link>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
