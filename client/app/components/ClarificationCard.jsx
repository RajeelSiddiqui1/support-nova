'use client'
import { MessageSquare, Send, CheckCircle, Clock } from 'lucide-react'
import { useState } from 'react'

/**
 * ClarificationCard — shown when ticket.clarification_needed === true
 *
 * Props:
 *   ticket    — full ticket object
 *   onSubmit  — optional callback after successful submission
 */
export default function ClarificationCard({ ticket, onSubmit }) {
  const [answers, setAnswers]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [submitted, setSubmit]  = useState(false)
  const [error, setError]       = useState('')

  if (!ticket?.clarification_needed) return null

  const questions = Array.isArray(ticket.clarification_questions)
    ? ticket.clarification_questions
    : ticket.clarification_questions
      ? [ticket.clarification_questions]
      : ['Please provide additional details about your complaint.']

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!answers.trim()) return
    setLoading(true)
    setError('')
    try {
      const { API_BASE } = await import('../lib/api')
      const res = await fetch(`${API_BASE}/api/tickets/${ticket.ticket_id}/clarification-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: answers.trim() }),
      })
      if (!res.ok) throw new Error('Failed to submit. Please try again.')
      setSubmit(true)
      if (onSubmit) onSubmit()
    } catch (err) {
      setError(err.message || 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{
        background: 'var(--nw-success-dim)',
        border: '1px solid rgba(79,166,137,0.3)',
        borderRadius: 14, padding: '16px 18px',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <CheckCircle size={20} color="var(--nw-success)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--nw-success)', marginBottom: 4 }}>
            Response Submitted
          </p>
          <p style={{ fontSize: 12, color: 'var(--nw-text-secondary)', lineHeight: 1.5 }}>
            Thank you. Our team has received your clarification and will update your ticket shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--nw-gold-dim)',
      border: '1px solid rgba(201,162,39,0.28)',
      borderRadius: 14, padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'rgba(201,162,39,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <MessageSquare size={15} color="var(--nw-gold)" />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--nw-gold)' }}>
            Clarification Needed
          </p>
          <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', marginTop: 1 }}>
            <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
            Your response will expedite processing
          </p>
        </div>
      </div>

      {/* Questions */}
      <div style={{ marginBottom: 14 }}>
        {questions.map((q, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, marginBottom: i < questions.length - 1 ? 8 : 0
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--nw-gold)',
              background: 'rgba(201,162,39,0.18)', borderRadius: '50%',
              width: 20, height: 20, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </span>
            <p style={{ fontSize: 13, color: 'var(--nw-text-primary)', lineHeight: 1.55 }}>{q}</p>
          </div>
        ))}
      </div>

      {/* Reply form */}
      <form onSubmit={handleSubmit}>
        <textarea
          value={answers}
          onChange={e => setAnswers(e.target.value)}
          placeholder="Type your answers here…"
          rows={3}
          style={{
            width: '100%', borderRadius: 10, resize: 'vertical', outline: 'none',
            background: 'var(--nw-elevated)', border: '1px solid var(--nw-border-strong)',
            color: 'var(--nw-text-primary)', fontSize: 13, padding: '10px 12px',
            fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.55,
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--nw-gold)' }}
          onBlur={e  => { e.target.style.borderColor = 'var(--nw-border-strong)' }}
        />
        {error && (
          <p style={{ fontSize: 11, color: 'var(--nw-danger)', marginTop: 6 }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !answers.trim()}
          style={{
            marginTop: 10, width: '100%',
            background: loading || !answers.trim() ? 'rgba(201,162,39,0.3)' : 'var(--nw-gold)',
            color: 'var(--nw-text-inverse)', border: 'none', borderRadius: 9,
            padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'all 0.2s',
          }}
        >
          <Send size={13} />
          {loading ? 'Submitting…' : 'Submit Response'}
        </button>
      </form>
    </div>
  )
}
