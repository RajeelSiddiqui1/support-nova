'use client'
import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Github, Linkedin, ExternalLink, CheckCircle2, Circle, Sparkles, User } from 'lucide-react'
import { ThreeDCard, ThreeDCardBody } from '../ui/ThreeDCard'
import { AnimatedTooltip } from '../ui/AnimatedTooltip'
import { teamInfo, members, submissionLinks, checklist } from '../../data/teamData'

const LINK_CONFIG = [
  { key: 'githubRepo',    label: 'GitHub Repository',  icon: '📁' },
  { key: 'liveApp',       label: 'Live Application',    icon: '🌐' },
  { key: 'demoVideo',     label: 'Demo Video',          icon: '🎬' },
  { key: 'technicalBlog', label: 'Technical Blog',      icon: '📝' },
  { key: 'projectReport', label: 'Project Report',      icon: '📄' },
  { key: 'aiUsage',       label: 'AI Usage Declaration',icon: '🤖' },
]

function isValidLink(href) {
  return href && href !== '#' && href.trim().length > 0
}

export default function TeamSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const [imgErrors, setImgErrors] = useState({})

  const tooltipItems = members.map((m, i) => ({
    id: i,
    name: m.name,
    designation: m.role,
    image: imgErrors[i] ? null : m.photo,
  }))

  return (
    <section
      id="team"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24"
      aria-labelledby="team-heading"
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="text-center mb-12 sm:mb-16"
      >
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-3 px-3.5 py-1 rounded-full"
          style={{ background: 'var(--nw-gold-dim)', color: 'var(--nw-gold)', border: '1px solid rgba(201,162,39,0.3)' }}
        >
          <Sparkles size={13} /> {teamInfo.event} · {teamInfo.category}
        </span>
        <h2 id="team-heading" className="text-3xl sm:text-5xl font-extrabold" style={{ color: 'var(--nw-text-primary)' }}>
          Meet {teamInfo.teamName}
        </h2>
        <p className="mt-3 text-xs sm:text-sm max-w-lg mx-auto" style={{ color: 'var(--nw-text-secondary)' }}>
          Built for <span style={{ color: 'var(--nw-gold)', fontWeight: 600 }}>{teamInfo.event}</span> · Theme:{' '}
          <span style={{ color: 'var(--nw-accent)', fontWeight: 600 }}>{teamInfo.theme}</span>
        </p>

        {/* Animated avatar row */}
        <div className="mt-6 flex justify-center">
          <AnimatedTooltip items={tooltipItems} />
        </div>
      </motion.div>

      {/* Member cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16 sm:mb-20">
        {members.map((member, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="h-full"
          >
            <ThreeDCard className="h-full">
              <ThreeDCardBody className="h-full">
                <div
                  className="rounded-2xl p-6 h-full flex flex-col justify-between transition-all duration-300 group"
                  style={{
                    background: 'var(--nw-surface)',
                    border: '1px solid var(--nw-border-strong)',
                    boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(201,111,74,0.4)'
                    e.currentTarget.style.boxShadow = '0 12px 36px rgba(201,111,74,0.15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--nw-border-strong)'
                    e.currentTarget.style.boxShadow = '0 4px 24px rgba(11,14,20,0.3)'
                  }}
                >
                  <div>
                    {/* Header: Photo + Info */}
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                        style={{
                          border: '2px solid var(--nw-accent)',
                          boxShadow: '0 4px 14px rgba(201,111,74,0.25)',
                        }}
                      >
                        {member.photo && !imgErrors[i] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.photo}
                            alt={member.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            onError={() => setImgErrors(prev => ({ ...prev, [i]: true }))}
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-xl font-extrabold"
                            style={{ background: 'linear-gradient(135deg, var(--nw-accent), var(--nw-gold))', color: 'white' }}
                          >
                            {member.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base truncate" style={{ color: 'var(--nw-text-primary)' }}>
                          {member.name}
                        </h3>
                        <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--nw-accent)' }}>
                          {member.role}
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-2 mt-2">
                          <a
                            href={member.github && member.github !== '#' ? member.github : '#'}
                            target={member.github && member.github !== '#' ? '_blank' : '_self'}
                            rel="noopener noreferrer"
                            aria-label={`${member.name} GitHub`}
                            className="p-1.5 rounded-lg transition-all duration-200"
                            style={{
                              background: 'var(--nw-elevated)',
                              color: member.github && member.github !== '#' ? 'var(--nw-text-primary)' : 'var(--nw-text-muted)',
                              border: '1px solid var(--nw-border)',
                              opacity: member.github && member.github !== '#' ? 1 : 0.5,
                            }}
                          >
                            <Github size={14} />
                          </a>
                          <a
                            href={member.linkedin && member.linkedin !== '#' ? member.linkedin : '#'}
                            target={member.linkedin && member.linkedin !== '#' ? '_blank' : '_self'}
                            rel="noopener noreferrer"
                            aria-label={`${member.name} LinkedIn`}
                            className="p-1.5 rounded-lg transition-all duration-200"
                            style={{
                              background: 'var(--nw-elevated)',
                              color: member.linkedin && member.linkedin !== '#' ? 'var(--nw-text-primary)' : 'var(--nw-text-muted)',
                              border: '1px solid var(--nw-border)',
                              opacity: member.linkedin && member.linkedin !== '#' ? 1 : 0.5,
                            }}
                          >
                            <Linkedin size={14} />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Contribution text */}
                    <p className="text-xs sm:text-sm leading-relaxed mb-4" style={{ color: 'var(--nw-text-secondary)' }}>
                      {member.contribution}
                    </p>
                  </div>

                  {/* Skills tags */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {member.skills.map(s => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          background: 'var(--nw-elevated)',
                          border: '1px solid var(--nw-border-strong)',
                          color: 'var(--nw-text-secondary)',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </ThreeDCardBody>
            </ThreeDCard>
          </motion.div>
        ))}
      </div>

      {/* Submission Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Links Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl p-6 sm:p-7"
          style={{
            background: 'var(--nw-surface)',
            border: '1px solid var(--nw-border-strong)',
            boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
          }}
        >
          <h3 className="text-base sm:text-lg font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--nw-text-primary)' }}>
            <span className="text-xl">🏆</span> Project Deliverables & Links
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LINK_CONFIG.map(({ key, label, icon }) => {
              const href = submissionLinks[key]
              const valid = isValidLink(href)
              return valid ? (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group"
                  style={{
                    background: 'var(--nw-elevated)',
                    border: '1px solid var(--nw-border)',
                    color: 'var(--nw-text-primary)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(201,111,74,0.4)'
                    e.currentTarget.style.background = 'var(--nw-accent-dim)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--nw-border)'
                    e.currentTarget.style.background = 'var(--nw-elevated)'
                  }}
                >
                  <span className="text-lg">{icon}</span>
                  <span className="flex-1 text-xs font-semibold truncate">{label}</span>
                  <ExternalLink size={13} style={{ color: 'var(--nw-accent)' }} />
                </a>
              ) : (
                <div
                  key={key}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl opacity-60"
                  style={{
                    background: 'var(--nw-elevated)',
                    border: '1px solid var(--nw-border)',
                    cursor: 'not-allowed',
                  }}
                >
                  <span className="text-lg">{icon}</span>
                  <span className="flex-1 text-xs font-semibold truncate" style={{ color: 'var(--nw-text-muted)' }}>{label}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--nw-text-muted)' }}
                  >
                    Coming soon
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Submission Checklist Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl p-6 sm:p-7 flex flex-col justify-between"
          style={{
            background: 'var(--nw-surface)',
            border: '1px solid var(--nw-border-strong)',
            boxShadow: '0 4px 24px rgba(11,14,20,0.3)',
          }}
        >
          <div>
            <h3 className="text-base sm:text-lg font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--nw-text-primary)' }}>
              <span className="text-xl">✅</span> Official Submission Checklist
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {checklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 p-2 rounded-lg"
                  style={{ background: item.done ? 'var(--nw-success-dim)' : 'transparent' }}
                >
                  {item.done ? (
                    <CheckCircle2 size={16} style={{ color: 'var(--nw-success)', flexShrink: 0 }} />
                  ) : (
                    <Circle size={16} style={{ color: 'var(--nw-text-muted)', flexShrink: 0 }} />
                  )}
                  <span
                    className="text-xs font-medium leading-tight"
                    style={{ color: item.done ? 'var(--nw-text-primary)' : 'var(--nw-text-muted)' }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--nw-border)' }}>
            <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--nw-text-muted)' }}>
              <span className="font-semibold">Submission Completion</span>
              <span style={{ color: 'var(--nw-success)', fontWeight: 700 }}>
                {checklist.filter(c => c.done).length}/{checklist.length} Completed ({Math.round((checklist.filter(c => c.done).length / checklist.length) * 100)}%)
              </span>
            </div>
            <div className="rounded-full h-2 overflow-hidden" style={{ background: 'var(--nw-elevated)' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={isInView ? { width: `${(checklist.filter(c => c.done).length / checklist.length) * 100}%` } : {}}
                transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                style={{
                  background: 'linear-gradient(90deg, var(--nw-success), var(--nw-gold))',
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
