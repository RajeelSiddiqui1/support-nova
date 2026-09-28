import { Suspense } from 'react'
import LandingNavbar    from './components/landing/Navbar'
import Hero             from './components/landing/Hero'
import ProblemVsSolution from './components/landing/ProblemVsSolution'
import Features         from './components/landing/Features'
import HowItWorks       from './components/landing/HowItWorks'
import Pipelines        from './components/landing/Pipelines'
import Escalation       from './components/landing/Escalation'
import Roles            from './components/landing/Roles'
import DemoCard         from './components/landing/DemoCard'
import TechStrip        from './components/landing/TechStrip'
import TeamSection      from './components/landing/TeamSection'
import Footer           from './components/landing/Footer'

export const metadata = {
  title: 'SupportNova — AI Complaint Intelligence Platform | NovaWear Apparel',
  description:
    'Dual-pipeline complaint resolution: Groq LLM extraction verified by deterministic Python rules. 6-tier escalation, 5 roles, full audit trail. Built for Aptech TechWiz 7.',
  openGraph: {
    title: 'SupportNova — AI Complaint Intelligence Platform',
    description:
      'GenAI suggests. Python verifies. Humans decide. Enterprise complaint resolution for NovaWear Apparel.',
    type: 'website',
  },
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--nw-base)', color: 'var(--nw-text-primary)', overflowX: 'hidden' }}>
      {/* Navbar — client component */}
      <LandingNavbar />

      {/* Main content */}
      <main id="main-content">
        {/* 1. Hero */}
        <Hero />

        {/* 2. Problem vs Solution */}
        <ProblemVsSolution />

        {/* 3. Features (Bento Grid) */}
        <Features />

        {/* 4. How It Works (Timeline) */}
        <HowItWorks />

        {/* 5. Two Pipelines */}
        <Pipelines />

        {/* 6. Escalation tiers */}
        <Escalation />

        {/* 7. Roles */}
        <Roles />

        {/* 8. Sample analysis card */}
        <DemoCard />

        {/* 9. Tech Stack strip */}
        <TechStrip />

        {/* 10. Team & Submission */}
        <TeamSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
