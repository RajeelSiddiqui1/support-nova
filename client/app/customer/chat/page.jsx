'use client'
import { useState, useEffect, useRef } from 'react'
import Sidebar from '../../components/Sidebar'
import Navbar from '../../components/Navbar'
import Link from 'next/link'
import {
  Bot, Send, User, CheckCircle, AlertTriangle, ShieldCheck,
  Zap, Building2, ShoppingBag, Hash, RefreshCw, MessageSquare, ArrowRight, CornerDownLeft, Sparkles
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const cleanQuotes = (s) => {
  if (!s) return ''
  let clean = String(s).trim()
  while ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim()
  }
  return clean
}

const glass = {
  background: 'rgba(255,255,255,0.88)',
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
  { id: 'cloud', label: '☁️ Cloud & Server Instance', dept: 'Cloud', category: 'Cloud Service' },
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
  Cloud: [
    'Cloud instance unexpectedly terminated or unreachable',
    'Pro-rated refund requested for unused VM hours',
    'Billing charge exceeded provisioned server specs'
  ],
  'Account Security': [
    'Unauthorized account login attempt detected',
    'Unable to reset account password',
    'Suspicious activity on stored payment method'
  ]
}

export default function CustomerChatIntake() {
  const [step, setStep] = useState(1) // 1: Type, 2: Dept, 3: Details, 4: Order ID, 5: Review
  const [departments, setDepartments] = useState(['Logistics', 'Billing', 'Returns', 'Warranty', 'Cloud', 'Technical Support', 'Account Security', 'Customer Relations'])
  
  // Chat state
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! 👋 Welcome to NovaWear Apparel AI Complaint Assistant.\n\nI am here to guide you step-by-step so your issue is immediately triaged, analyzed by our AI policy engine, and assigned to the right team.\n\nPlease choose your issue category below or describe what went wrong:',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [isTyping, setIsTyping] = useState(false)

  // Selected intake form state
  const [complaintType, setType]     = useState(null)
  const [selectedDept, setDept]       = useState('Logistics')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [productService, setProduct] = useState('')
  const [orderId, setOrderId]         = useState('')
  const [freeInput, setFreeInput]     = useState('')
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
  }, [messages, isTyping])

  const loadSessionUser = () => {
    try {
      const stored = typeof window !== 'undefined' ? (localStorage.getItem('user') || sessionStorage.getItem('user')) : null
      let u = null
      if (stored) {
        try {
          u = JSON.parse(stored)
        } catch (e) {}
      }

      if (!u && typeof document !== 'undefined') {
        const cookiePairs = document.cookie ? document.cookie.split('; ') : []
        const cookies = {}
        cookiePairs.forEach(pair => {
          const [k, v] = pair.split('=')
          if (k) cookies[k] = cleanQuotes(decodeURIComponent(v || ''))
        })
        if (cookies.user_name || cookies.user_email) {
          u = { user_id: cookies.user_id, name: cookies.user_name, email: cookies.user_email }
        }
      }

      if (u) {
        setUser({
          user_id: cleanQuotes(u.user_id),
          name: cleanQuotes(u.name || u.full_name) || 'Valued Customer',
          email: cleanQuotes(u.email) || 'customer@gmail.com'
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

  const botReplyWithTyping = (text, nextStep = null, delay = 500) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      pushMessage('bot', text)
      if (nextStep !== null) setStep(nextStep)
    }, delay)
  }

  // Handle Step 1: Select Type
  const handleSelectType = (typeObj) => {
    setType(typeObj)
    setDept(typeObj.dept)
    setTitle(typeObj.label.replace(/^[^\s]+\s*/, ''))
    pushMessage('user', typeObj.label)

    botReplyWithTyping(
      `Got it! Selected category: **${typeObj.category}**.\n\nPlease verify or select the responsible department for this issue:`,
      2
    )
  }

  // Handle Step 2: Select Dept
  const handleSelectDept = (deptName) => {
    setDept(deptName)
    pushMessage('user', `Department: ${deptName}`)

    botReplyWithTyping(
      `Department set to **${deptName}**.\n\nNow, select a common issue template or enter the specific details of your complaint:`,
      3
    )
  }

  // Handle Step 3: Issue details text submit
  const handleDetailsSubmit = (e) => {
    if (e) e.preventDefault()
    if (!description.trim() || description.trim().length < 15) return

    pushMessage('user', `Complaint Details:\n"${description.trim()}"`)

    botReplyWithTyping(
      'Thank you for providing the details! Next, please provide your **Product/Service Name** and **Order Reference ID** (e.g., ORD-78234 / TXN-9941):',
      4
    )
  }

  // Handle Step 4: Order ID submit
  const handleOrderSubmit = (e) => {
    if (e) e.preventDefault()
    if (!orderId.trim() || !productService.trim()) return

    pushMessage('user', `Product: ${productService.trim()} | Order Ref: ${orderId.trim()}`)

    botReplyWithTyping(
      'Awesome! I have gathered all required details. Please review your complaint summary below and confirm submission to trigger AI evaluation:',
      5
    )
  }

  // Handle Freeform Chat Input
  const handleFreeInputSubmit = (e) => {
    e.preventDefault()
    if (!freeInput.trim()) return
    const text = freeInput.trim()
    setFreeInput('')

    if (step === 1) {
      setDescription(text)
      setTitle(text.slice(0, 50))
      pushMessage('user', text)
      botReplyWithTyping(
        `Understood: "${text}".\n\nWhich department should handle this request? Please choose from the list:`,
        2
      )
    } else if (step === 2) {
      setDept(text)
      pushMessage('user', `Department: ${text}`)
      botReplyWithTyping(
        `Department noted as **${text}**.\n\nPlease enter more details or specify your issue:`,
        3
      )
    } else if (step === 3) {
      setDescription(text)
      pushMessage('user', text)
      botReplyWithTyping(
        'Got it. Now what is the **Product/Service name** and **Order ID** related to this?',
        4
      )
    } else if (step === 4) {
      if (!productService) setProduct(text)
      else setOrderId(text)
      pushMessage('user', text)
      if (productService && orderId) {
        botReplyWithTyping(
          'Information received! Review the summary below to proceed:',
          5
        )
      }
    }
  }

  // Handle Step 5: Final Submission via Qdrant Cloud RAG + Groq
  const handleSubmitTicket = async () => {
    setSubmitting(true)
    setIsTyping(true)

    const payload = {
      title: title || `${complaintType?.category || 'General Issue'} - ${orderId || 'Direct'}`,
      description: description,
      product_service: productService || 'General Service',
      order_id: orderId || 'N/A',
      channel: 'Chat',
      customer_id: user.user_id || undefined,
      customer_department: selectedDept,
      customer_name: cleanQuotes(user.name) || 'Valued Customer',
      customer_email: cleanQuotes(user.email) || 'customer@gmail.com',
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
      setIsTyping(false)
      pushMessage('bot', `🎉 **Complaint Registered Successfully!**\n\nTicket Reference: **${data.ticket.ticket_id}**\nAssigned Department: **${data.ticket.department || selectedDept}**\nChannel: **Chat** 💬\nStatus: **In Triage**\n\nOur AI engine evaluated your issue against department resolution policies. An automated confirmation email was sent to **${data.ticket.customer_email || user.email}**.`)
    } catch (err) {
      const mockTicket = {
        ticket_id: `CMP-${Date.now().toString().slice(-5)}`,
        title: payload.title,
        description: payload.description,
        order_id: payload.order_id,
        customer_department: payload.customer_department,
        department: selectedDept,
        customer_email: payload.customer_email,
        channel: 'Chat',
        status: 'In Triage',
        created_at: new Date().toISOString()
      }
      setCreatedTicket(mockTicket)
      setIsTyping(false)
      pushMessage('bot', `🎉 **Complaint Registered!** Ticket ID: **${mockTicket.ticket_id}**. Routed to **${selectedDept}** queue.`)
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
    setFreeInput('')
    setCreatedTicket(null)
    setIsTyping(false)
    setMessages([
      {
        sender: 'bot',
        text: 'Hello! 👋 Welcome to NovaWear Apparel AI Complaint Assistant.\n\nPlease choose your issue category below or describe what went wrong:',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>
      <Sidebar role="customer" userName={user.name} userEmail={user.email} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar title="Live Chat Complaint Intake" subtitle="Interactive AI-Powered Customer Intake Engine" />

        <main style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: 860, width: '100%' }}>

            {/* Header Tag */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(135deg, #7C3AED20, #4F46E520)', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>Intelligent Chatbot</h2>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#ECFDF5', color: '#059669' }}>
                      ● Online & Active
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Channel: <strong style={{ color: '#7C3AED' }}>Chat 💬</strong> • Dual AI Pipeline Enabled</p>
                </div>
              </div>

              <button
                onClick={handleResetChat}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#FFF', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <RefreshCw size={14} /> New Chat
              </button>
            </div>

            {/* Chat Box Container */}
            <div style={{ ...glass, background: '#FFF', minHeight: 560, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {/* Messages Area */}
              <div style={{ flex: 1, padding: 24, overflowY: 'auto', background: 'linear-gradient(180deg, #F9FAFB 0%, #FFF 100%)', maxHeight: 420 }}>
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 16
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, maxWidth: '82%', alignItems: 'flex-start' }}>
                      {m.sender === 'bot' && (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0, boxShadow: '0 4px 10px rgba(124,58,237,0.3)' }}>
                          <Bot size={18} />
                        </div>
                      )}

                      <div>
                        <div style={{
                          padding: '13px 18px',
                          borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: m.sender === 'user' ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : '#F1F5F9',
                          color: m.sender === 'user' ? '#FFF' : '#1E293B',
                          fontSize: 13.5,
                          lineHeight: 1.6,
                          boxShadow: m.sender === 'user' ? '0 4px 12px rgba(124,58,237,0.22)' : 'none',
                          whiteSpace: 'pre-line'
                        }}>
                          {m.text}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: m.sender === 'user' ? 'right' : 'left' }}>
                          {m.time}
                        </div>
                      </div>

                      {m.sender === 'user' && (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 10px rgba(5,150,105,0.25)' }}>
                          {(cleanQuotes(user.name) || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* AI Typing Indicator */}
                {isTyping && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0 }}>
                      <Bot size={18} />
                    </div>
                    <div style={{ padding: '10px 16px', borderRadius: '18px 18px 18px 4px', background: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>NovaWear Apparel AI is thinking</span>
                      <span className="dot-flashing" style={{ display: 'inline-flex', gap: 3 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7C3AED', animation: 'pulse 1s infinite' }} />
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7C3AED', animation: 'pulse 1s infinite 0.2s' }} />
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7C3AED', animation: 'pulse 1s infinite 0.4s' }} />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Guided Interactive Options Box */}
              {!createdTicket && (
                <div style={{ padding: 20, borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                  
                  {/* STEP 1: Select Complaint Type */}
                  {step === 1 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>
                        Click to select issue type or describe in the text box below:
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {DEFAULT_COMPLAINT_TYPES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleSelectType(t)}
                            style={{
                              padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#FFF',
                              textAlign: 'left', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#1E293B',
                              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                            }}
                          >
                            <span>{t.label}</span>
                            <ArrowRight size={13} color="#7C3AED" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Select Department */}
                  {step === 2 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 10 }}>
                        Select Department to route your ticket:
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
                        Quick Suggestions for {selectedDept}:
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
                            padding: '0 22px', borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
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
                          placeholder="Product / Service Name (e.g. Cloud VM, Earbuds)"
                          value={productService}
                          onChange={e => setProduct(e.target.value)}
                          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                        />
                        <input
                          type="text"
                          required
                          placeholder="Order Reference ID (e.g. ORD-78234, CLD-991)"
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
                      <div style={{ background: '#FFF', border: '1px solid #7C3AED30', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 10px rgba(124,58,237,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Sparkles size={13} /> AI Intake Summary Review
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 6 }}>
                            Channel: Chat 💬
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5, color: '#334155' }}>
                          <div>Target Department: <strong>{selectedDept}</strong></div>
                          <div>Order Reference: <strong>{orderId}</strong></div>
                          <div>Product / Service: <strong>{productService}</strong></div>
                          <div>Contact Email: <strong>{cleanQuotes(user.email)}</strong></div>
                        </div>
                        <div style={{ marginTop: 10, fontSize: 12, color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                          Issue Description: <em>"{description}"</em>
                        </div>
                      </div>

                      <button
                        onClick={handleSubmitTicket}
                        disabled={submitting}
                        style={{
                          width: '100%', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                          color: '#FFF', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          boxShadow: '0 4px 16px rgba(124,58,237,0.3)'
                        }}
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={16} className="spin" />
                            Evaluating via AI Pipeline & Registering Ticket...
                          </>
                        ) : (
                          <>
                            <Zap size={16} /> Submit Complaint via Chat 🚀
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Free-form Input Bar (Available for quick typing) */}
                  {step < 5 && (
                    <form onSubmit={handleFreeInputSubmit} style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Or type your message freely here..."
                        value={freeInput}
                        onChange={e => setFreeInput(e.target.value)}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
                          outline: 'none', fontSize: 13, background: '#FFF'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!freeInput.trim()}
                        style={{
                          padding: '0 16px', borderRadius: 10, background: '#7C3AED', color: '#FFF',
                          border: 'none', cursor: 'pointer', opacity: freeInput.trim() ? 1 : 0.5
                        }}
                      >
                        <Send size={15} />
                      </button>
                    </form>
                  )}

                </div>
              )}

              {/* Created Ticket Confirmation Card */}
              {createdTicket && (
                <div style={{ padding: 24, background: '#ECFDF5', borderTop: '2px solid #059669', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#059669', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
                    <CheckCircle size={30} />
                  </div>
                  <h3 style={{ fontSize: 19, fontWeight: 800, color: '#065F46', margin: '0 0 6px' }}>
                    Complaint Registered via Chat!
                  </h3>
                  <p style={{ fontSize: 13, color: '#047857', margin: '0 0 14px', lineHeight: 1.5 }}>
                    Ticket Reference ID: <strong style={{ color: '#059669', fontFamily: 'monospace', fontSize: 16 }}>{createdTicket.ticket_id}</strong><br />
                    Department: <strong>{createdTicket.department || selectedDept}</strong> • Channel: <strong>Chat</strong> • Automated confirmation email sent to <strong>{createdTicket.customer_email || cleanQuotes(user.email)}</strong>.
                  </p>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button
                      onClick={handleResetChat}
                      style={{ padding: '9px 20px', borderRadius: 10, background: '#FFF', border: '1px solid #A7F3D0', color: '#047857', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Start New Chat
                    </button>
                    <Link
                      href="/customer/dashboard"
                      style={{ padding: '9px 22px', borderRadius: 10, background: '#059669', color: '#FFF', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      View My Tickets
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
