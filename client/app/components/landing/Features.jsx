'use client'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { BentoGrid, BentoGridItem } from '../ui/BentoGrid'
import {
  Inbox, BarChart2, Building2, AlertTriangle, ShieldAlert,
  Activity, Clock, Bell, FileDown, PieChart, MessageSquare, ArrowUpRight,
} from 'lucide-react'

const FEATURES = [
  {
    icon: <Inbox size={16} />,
    title: 'Multi-Channel Intake',
    description: 'Accepts complaints via web form, live chat, and email ingestion — all unified into a single structured pipeline.',
  },
  {
    icon: <BarChart2 size={16} />,
    title: 'Sentiment vs Urgency Separation',
    description: 'GenAI independently scores emotional sentiment and operational urgency, preventing one from biasing the other.',
  },
  {
    icon: <Building2 size={16} />,
    title: 'Multi-Department Routing',
    description: 'Rule-matrix driven deterministic routing sends tickets to the correct department with zero human intervention.',
  },
  {
    icon: <AlertTriangle size={16} />,
    title: '6-Tier Escalation Engine',
    description: 'Tickets are automatically elevated through 6 escalation tiers based on severity, SLA risk, and department policy.',
  },
  {
    icon: <ShieldAlert size={16} />,
    title: 'Hallucination & Promise Detection',
    description: 'Python validator catches LLM hallucinations and unauthorized promises (refunds, replacements) before any agent action.',
  },
  {
    icon: <Activity size={16} />,
    title: 'Verification Score',
    description: 'Every ticket gets a 0–100 confidence score comparing GenAI output vs Python ground-truth — reviewers see the delta.',
  },
  {
    icon: <Clock size={16} />,
    title: 'SLA Risk Tracking',
    description: 'Real-time SLA countdown with risk classification (CRITICAL / HIGH / MEDIUM). Breaches trigger automated escalation.',
  },
  {
    icon: <Bell size={16} />,
    title: 'Follow-Up Automation',
    description: 'Scheduled follow-ups remind agents and customers of pending clarifications, reducing resolution time.',
  },
  {
    icon: <FileDown size={16} />,
    title: 'Report Export (7 types)',
    description: 'Download complaint reports as CSV, XLSX, or PDF. 7 report templates including per-department and SLA breach views.',
  },
  {
    icon: <PieChart size={16} />,
    title: 'Analytics Dashboard',
    description: 'Managers and Admins see real-time charts: volume trends, pipeline match rates, department load, and SLA performance.',
  },
  {
    icon: <MessageSquare size={16} />,
    title: 'Clarification Requests',
    description: 'Agents can request missing information from customers in-app. Responses auto-update the ticket and re-trigger analysis.',
  },
  {
    icon: <ArrowUpRight size={16} />,
    title: 'Reviewer Override Workflow',
    description: 'Reviewers override GenAI decisions with documented justification — every override creates a permanent audit record.',
  },
]

export default function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      id="features"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-20"
      aria-labelledby="features-heading"
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="text-center mb-12"
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--nw-accent)' }}>
          Capabilities
        </p>
        <h2 id="features-heading" className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
          Everything Your Support Team Needs
        </h2>
        <p className="mt-3 text-sm max-w-2xl mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
          SupportNova handles the full complaint lifecycle — from intake to resolution — with GenAI intelligence verified by deterministic rules.
        </p>
      </motion.div>

      <BentoGrid>
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: i * 0.04 }}
          >
            <BentoGridItem
              icon={f.icon}
              title={f.title}
              description={f.description}
            />
          </motion.div>
        ))}
      </BentoGrid>
    </section>
  )
}
