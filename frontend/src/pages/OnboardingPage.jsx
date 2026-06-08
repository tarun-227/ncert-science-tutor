import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { saveUserProfile } from '../lib/userdata'
import Icon from '../components/Icons'
import './OnboardingPage.css'

const SUBJECT_CHIPS = [
  { id: 'science',  name: 'Science',         color: 'sci',  ic: '⚛' },
  { id: 'maths',    name: 'Mathematics',     color: 'math', ic: '∑' },
  { id: 'english',  name: 'English',         color: 'eng',  ic: 'En' },
  { id: 'social',   name: 'Social Science',  color: 'soc',  ic: '⌖' },
  { id: 'hindi',    name: 'Hindi',           color: 'hin',  ic: 'हि' },
  { id: 'sanskrit', name: 'Sanskrit',        color: 'san',  ic: 'सं' },
]

const MARKS_SUBJECTS = SUBJECT_CHIPS.slice(0, 5)

const STEPS = [
  { id: 'welcome',  label: 'Welcome' },
  { id: 'basics',   label: 'About you' },
  { id: 'history',  label: 'Self-rating' },
  { id: 'assess',   label: 'Tough subjects' },
  { id: 'pace',     label: 'Learning pace' },
  { id: 'done',     label: 'All set' },
]

const PACES = [
  { id: 'steady',   title: 'Steady & thorough', desc: 'I like to take my time and really understand things before moving on.', meta: 'Best for deep retention', icon: '🐢' },
  { id: 'balanced', title: 'Balanced',          desc: 'A bit of both — solid pace, but I do slow down on tricky parts.',       meta: 'Most students pick this',  icon: '🦊' },
  { id: 'fast',     title: 'Fast & focused',    desc: 'I pick things up quickly and prefer to keep moving forward.',             meta: 'Best for revision sprints', icon: '🐇' },
]

const RATING_LABELS = ['', 'Just starting', 'Still learning', 'Doing okay', 'Pretty confident', 'I’ve got this']

// ── Brand + Progress ────────────────────────────────────────
const Brand = () => (
  <div className="ob-brand">
    <span className="ob-mark">M</span>
    <span>Master<span className="ob-brand-dot">.</span>AI</span>
  </div>
)

const Progress = ({ step }) => (
  <>
    <div className="ob-prog">
      {STEPS.map((s, i) => (
        <div key={s.id}
          className={`ob-prog-pip ${i < step ? 'done' : i === step ? 'current' : ''}`} />
      ))}
    </div>
    <div className="ob-prog-label">
      Step <b>{Math.min(step + 1, STEPS.length)}</b> of <b>{STEPS.length}</b> &middot; {STEPS[step]?.label}
    </div>
  </>
)

// ── Step 0 — Welcome ────────────────────────────────────────
function StepWelcome({ onGoogle }) {
  return (
    <div className="welcome">
      <div className="welcome-mark">M</div>
      <h1>Hi! Let's set up <em>your study companion</em>.</h1>
      <p>
        Master.AI learns the way you study — your pace, your strong subjects,
        and the chapters that need more love — and quietly builds your daily plan.
      </p>
      <div className="welcome-cta">
        <button className="google-btn" onClick={onGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.3c-2 1.5-4.5 2.6-7.3 2.6-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.2 5.3C40.4 36.4 44 30.7 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
        <div className="welcome-perks">
          <span className="welcome-perk"><Icon name="check-circle" size={12} /> Takes 2 minutes</span>
          <span className="welcome-perk"><Icon name="check-circle" size={12} /> Personal study plan</span>
          <span className="welcome-perk"><Icon name="check-circle" size={12} /> Free to start</span>
        </div>
        <p className="welcome-fine">
          By continuing you agree to our <a href="#">terms</a> and <a href="#">privacy policy</a>.
        </p>
      </div>
    </div>
  )
}

// ── Step 1 — Basics ─────────────────────────────────────────
function StepBasics({ data, set }) {
  return (
    <>
      <div className="ob-eyebrow">Step 2 of 6 &middot; About you</div>
      <h2 className="ob-title">Tell us who you are.</h2>
      <p className="ob-sub">A few quick details so we can address you properly and tailor the content.</p>
      <div className="ob-form" style={{ marginTop: 22 }}>
        <div className="ob-field">
          <label>Full name</label>
          <input className="ob-input" type="text" placeholder="e.g. Aanya Sharma"
            value={data.name || ''} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="ob-row2">
          <div className="ob-field">
            <label>Class</label>
            <select className="ob-select" value={data.cls || 'X'} onChange={e => set('cls', e.target.value)}>
              {['VI','VII','VIII','IX','X','XI','XII'].map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div className="ob-field">
            <label>Board</label>
            <select className="ob-select" value={data.board || 'CBSE'} onChange={e => set('board', e.target.value)}>
              {['CBSE','ICSE','State Board','IB','Cambridge'].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="ob-field">
          <label>School (optional)</label>
          <input className="ob-input" type="text" placeholder="e.g. DPS R.K. Puram"
            value={data.school || ''} onChange={e => set('school', e.target.value)} />
        </div>
      </div>
    </>
  )
}

// ── Step 2 — Self-rating (stars) ────────────────────────────
function StepHistory({ data, set }) {
  const ratings = data.ratings || {}
  const setRating = (id, v) => set('ratings', { ...ratings, [id]: v })

  return (
    <>
      <div className="ob-eyebrow">Step 3 of 6 &middot; Self-rating</div>
      <h2 className="ob-title">Rate yourself in each subject.</h2>
      <p className="ob-sub">
        Be honest — this is just for Master.AI to know where to start. A low score means
        we'll explain things more gently; a high score lets us skip the basics.
      </p>
      <div className="marks-grid" style={{ marginTop: 22 }}>
        {MARKS_SUBJECTS.map(s => {
          const v = ratings[s.id] ?? 3
          return (
            <div className="rating-row" key={s.id}>
              <div className="marks-name">
                <span className="marks-ic" data-c={s.color}>{s.ic}</span>
                {s.name}
              </div>
              <div className="stars">
                {[1,2,3,4,5].map(i => (
                  <button key={i} type="button" className={`star ${i <= v ? 'on' : ''}`}
                    onClick={() => setRating(s.id, i)} aria-label={`${i} of 5`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3 6.6 7.2.7-5.5 4.9 1.6 7-6.3-3.8L5.7 21.2l1.6-7L1.8 9.3l7.2-.7L12 2z"/>
                    </svg>
                  </button>
                ))}
              </div>
              <div className="rating-label">{RATING_LABELS[v]}</div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Step 3 — Tough subjects ─────────────────────────────────
function StepAssess({ data, set }) {
  const tough = data.tough || []
  const toggle = id => set('tough', tough.includes(id) ? tough.filter(x => x !== id) : [...tough, id])

  return (
    <>
      <div className="ob-eyebrow">Step 4 of 6 &middot; Self-assessment</div>
      <h2 className="ob-title">Which subjects feel hard?</h2>
      <p className="ob-sub">
        Pick everything that gives you trouble. We'll give those chapters extra attention
        in your daily plan.
      </p>
      <div className="chip-grid-h" style={{ marginTop: 22 }}>Tap any that apply — pick as many as you like.</div>
      <div className="chip-grid">
        {SUBJECT_CHIPS.map(s => {
          const on = tough.includes(s.id)
          return (
            <button key={s.id} className={`chip ${on ? 'on' : ''}`} onClick={() => toggle(s.id)}>
              <span className="chip-mark">{on ? <Icon name="check" size={12} /> : null}</span>
              <span className="marks-ic" data-c={s.color}>{s.ic}</span>
              <span>{s.name}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── Step 4 — Learning pace ──────────────────────────────────
function StepPace({ data, set }) {
  const pace = data.pace || 'balanced'
  return (
    <>
      <div className="ob-eyebrow">Step 5 of 6 &middot; Learning pace</div>
      <h2 className="ob-title">How fast do you usually learn?</h2>
      <p className="ob-sub">
        We'll calibrate explanations, recap frequency, and daily reading load to match.
        Change it anytime later.
      </p>
      <div className="pace-grid" style={{ marginTop: 22 }}>
        {PACES.map(p => {
          const on = pace === p.id
          return (
            <button key={p.id} className={`pace-card ${on ? 'on' : ''}`} onClick={() => set('pace', p.id)}>
              <div className="pace-card-top">
                <span className="pace-ic">{p.icon}</span>
                <span className="chip-mark" style={on ? { background: 'var(--green)', borderColor: 'var(--green)', color: 'white' } : {}}>
                  {on ? <Icon name="check" size={12} /> : null}
                </span>
              </div>
              <div className="pace-title">{p.title}</div>
              <div className="pace-desc">{p.desc}</div>
              <div className="pace-meta">{p.meta}</div>
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── Step 5 — Done ───────────────────────────────────────────
function StepDone({ data, onFinish, onRestart }) {
  const toughChips = (data.tough || []).map(id => SUBJECT_CHIPS.find(s => s.id === id)?.name).filter(Boolean)
  const avgRating = (() => {
    const vals = Object.values(data.ratings || {})
    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  })()

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="done-mark"><Icon name="check" size={32} /></div>
      <h1 className="ob-title" style={{ textAlign: 'center' }}>
        You're all set, {(data.name || 'Student').split(' ')[0]}!
      </h1>
      <p className="ob-sub" style={{ textAlign: 'center', margin: '8px auto 0' }}>
        Your personalized dashboard is ready. Let's start with today's plan.
      </p>

      <div className="summary">
        <div className="summary-row">
          <span className="summary-label">Profile</span>
          <span className="summary-val">
            <b>{data.name || 'Student'}</b><br/>
            Class {data.cls || 'X'} &middot; {data.board || 'CBSE'}{data.school ? ` · ${data.school}` : ''}
          </span>
        </div>
        {avgRating !== null && (
          <div className="summary-row">
            <span className="summary-label">Self-rating avg</span>
            <span className="summary-val">
              <b>{avgRating}/5</b>
              <span style={{ color: 'var(--ink-3)', marginLeft: 4 }}>across 5 subjects</span>
            </span>
          </div>
        )}
        {toughChips.length > 0 && (
          <div className="summary-row">
            <span className="summary-label">Focus areas</span>
            <span className="summary-val">
              <span className="summary-chips">
                {toughChips.map(t => <span key={t} className="summary-chip">{t}</span>)}
              </span>
            </span>
          </div>
        )}
        {data.pace && (
          <div className="summary-row">
            <span className="summary-label">Learning pace</span>
            <span className="summary-val"><b>{PACES.find(p => p.id === data.pace)?.title}</b></span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <button className="ob-btn primary big" onClick={onFinish}>
          Go to dashboard <Icon name="arrow-right" size={14} />
        </button>
        <button className="ob-btn ghost" onClick={onRestart}>Restart tour</button>
      </div>
    </div>
  )
}

// ── Wizard host ─────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, signInWithGoogle, markOnboardingDone } = useAuth()
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    cls: 'X', board: 'CBSE',
    ratings: { science: 4, maths: 3, english: 5, social: 3, hindi: 4 },
    pace: 'balanced',
  })

  // If user is already authenticated (came back from OAuth redirect),
  // skip welcome and go to step 1 (basics), pre-fill name from auth
  useEffect(() => {
    if (user && step === 0) {
      const name = user.user_metadata?.full_name || user.user_metadata?.name || ''
      setData(d => ({ ...d, name, google: true }))
      setStep(1)
    }
  }, [user])

  const set = (k, v) => setData(d => ({ ...d, [k]: v }))
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))
  const restart = () => setStep(0)

  const finish = async () => {
    await saveUserProfile(data)  // saves to Supabase + localStorage
    markOnboardingDone()         // open the gate immediately (avoids redirect loop)
    navigate('/')
  }

  const handleGoogle = () => {
    signInWithGoogle()
    // After Google OAuth redirect, user will land back here and the useEffect above handles it
  }

  const renderStep = () => {
    switch (step) {
      case 0: return <StepWelcome onGoogle={handleGoogle} />
      case 1: return <StepBasics data={data} set={set} />
      case 2: return <StepHistory data={data} set={set} />
      case 3: return <StepAssess data={data} set={set} />
      case 4: return <StepPace data={data} set={set} />
      case 5: return <StepDone data={data} onFinish={finish} onRestart={restart} />
      default: return null
    }
  }

  const showFooter = step > 0 && step < STEPS.length - 1
  const isLastInput = step === STEPS.length - 2

  return (
    <div className="ob-page">
      <div className="ob">
        {step !== STEPS.length - 1 && (
          <div className="ob-head">
            <Brand />
            {step > 0 && <Progress step={step} />}
          </div>
        )}

        <div className="ob-body">
          {renderStep()}
        </div>

        {showFooter && (
          <div className="ob-foot">
            <button className="ob-btn text" onClick={back}>
              <Icon name="arrow-right" size={13} style={{ transform: 'rotate(180deg)' }} /> Back
            </button>
            <div className="ob-foot-meta">Step {step + 1} of {STEPS.length - 1}</div>
            <button className="ob-btn primary" onClick={next}>
              {isLastInput ? 'Finish setup' : 'Continue'} <Icon name="arrow-right" size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
