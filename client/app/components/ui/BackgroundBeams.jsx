'use client'
import { useEffect, useRef } from 'react'

/**
 * Background Beams — Aceternity UI (restyled for NovaWear dark theme)
 * Draws animated SVG beams radiating from bottom-centre.
 */
export function BackgroundBeams({ className = '' }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 800 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="bg-beam-glow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="rgba(201,111,74,0.18)" />
            <stop offset="50%" stopColor="rgba(201,162,39,0.07)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="beam1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(201,111,74,0.35)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="beam2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(201,162,39,0.28)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="beam3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(74,155,201,0.22)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Radial glow centre */}
        <rect width="800" height="800" fill="url(#bg-beam-glow)" />

        {/* Animated beam lines */}
        {[
          { y: 680, gradient: 'beam1', dur: '3.2s', delay: '0s' },
          { y: 720, gradient: 'beam2', dur: '4.1s', delay: '0.8s' },
          { y: 760, gradient: 'beam3', dur: '3.7s', delay: '1.5s' },
          { y: 640, gradient: 'beam1', dur: '5s',   delay: '2.1s' },
          { y: 700, gradient: 'beam2', dur: '4.5s', delay: '0.4s' },
        ].map((b, i) => (
          <line
            key={i}
            x1="0" y1={b.y} x2="800" y2={b.y}
            stroke={`url(#${b.gradient})`}
            strokeWidth="1"
            style={{
              animation: `beamPulse ${b.dur} ease-in-out ${b.delay} infinite`,
            }}
          />
        ))}

        {/* Corner accent dots */}
        <circle cx="400" cy="800" r="120" fill="rgba(201,111,74,0.04)" />
        <circle cx="400" cy="800" r="60"  fill="rgba(201,111,74,0.06)" />
      </svg>

      <style>{`
        @keyframes beamPulse {
          0%,100% { opacity: 0.3; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bg-beam-line { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
