import { useEffect, useRef, useState } from 'react'
import './Loading.css'

const MESSAGES = [
  'Loading your books…',
  'Syncing study plans…',
  'Preparing chapters…',
  'Setting up your AI tutor…',
  'Almost ready…',
  'Welcome back!',
]

// Six orbiting subject marks (English, Maths, Science, Social, Hindi, Sanskrit)
const ORBIT_DOTS = ['En', '∑', '⚛', '⌖', 'हि', 'सं']

/**
 * Full-screen branded loading splash.
 * Ported from the Master.AI "Loading.html" design.
 * Shown while auth/session and initial data resolve.
 */
export default function Loading() {
  const [step, setStep] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    // Begin cycling status messages + filling segments after the brand rises in
    const start = setTimeout(function advance() {
      setStep(prev => {
        const next = prev + 1
        if (next < MESSAGES.length) {
          timerRef.current = setTimeout(advance, 600)
        }
        return next
      })
    }, 1900)
    return () => { clearTimeout(start); clearTimeout(timerRef.current) }
  }, [])

  const msg = MESSAGES[Math.min(step, MESSAGES.length - 1)] || MESSAGES[0]

  return (
    <div className="ld-stage">
      <div className="ld-grid-bg" />

      <div className="ld-orbit-wrap">
        <div className="ld-orbit-ring" />
        {ORBIT_DOTS.map((d, i) => (
          <div className="ld-dot-orb" key={i}><span>{d}</span></div>
        ))}

        {/* M mark that draws itself at the center */}
        <div className="ld-m-wrap">
          <div className="ld-m-bg" />
          <svg className="ld-m-svg" width="72" height="60" viewBox="0 0 72 60" aria-label="M">
            <path className="ld-m-path" d="M 10 50 L 10 10 L 36 40 L 62 10 L 62 50" />
          </svg>
        </div>
      </div>

      <div className="ld-brand">
        <div className="ld-brand-name">Master<span className="ld-brand-dot">.</span>AI</div>
        <div className="ld-brand-sub">Your personal study companion</div>
      </div>

      <div className="ld-status-wrap">
        <div className="ld-status-msgs">{msg}</div>
      </div>

      <div className="ld-seg-bar">
        {MESSAGES.map((_, i) => (
          <div className={`ld-seg${i < step ? ' fill' : ''}`} key={i} />
        ))}
      </div>

      <div className="ld-corner">v2.1 · Class X CBSE</div>
    </div>
  )
}
