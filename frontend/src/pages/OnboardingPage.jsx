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
  { id: 'history',  label: 'Recent marks' },
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

// ── Confirm Popup ────────────────────────────────────────────
function ConfirmPopup({ show, title, message, onConfirm, onCancel, confirmText = 'Yes, continue', cancelText = 'Go back & change', singleAction = false }) {
  if (!show) return null
  return (
    <div className="ob-overlay" onClick={singleAction ? onConfirm : onCancel}>
      <div className="ob-popup" onClick={e => e.stopPropagation()}>
        <div className="ob-popup-icon">!</div>
        <h3 className="ob-popup-title">{title}</h3>
        <p className="ob-popup-msg">{message}</p>
        <div className="ob-popup-actions">
          {!singleAction && <button className="ob-btn ghost" onClick={onCancel}>{cancelText}</button>}
          <button className="ob-btn primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

// ── Brand + Progress ────────────────────────────────────────
function Brand() {
  return (
    <div className="ob-brand">
      <span className="ob-mark">M</span>
      <span>Master<span className="ob-brand-dot">.</span>AI</span>
    </div>
  )
}

function Progress({ step }) {
  return (
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
}

// ── Topographic SVG pattern ─────────────────────────────────
function TopoPattern() {
  return (
    <svg className="split-topo" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <style>{`.tl { fill: none; stroke: rgba(255,255,255,.15); stroke-width: 1.5; }`}</style>
      </defs>
      <path className="tl" d="M-20 120Q80 80 200 140T420 100T620 160"/>
      <path className="tl" d="M-20 180Q100 130 220 200T460 150T620 220"/>
      <path className="tl" d="M-20 250Q90 200 180 260T380 230T540 280T620 270"/>
      <path className="tl" d="M-20 320Q120 270 240 330T480 290T620 350"/>
      <path className="tl" d="M-20 380Q80 340 190 400T400 360T620 420"/>
      <path className="tl" d="M-20 440Q130 390 260 460T500 410T620 480"/>
      <path className="tl" d="M-20 510Q90 470 200 520T420 490T620 540"/>
      <path className="tl" d="M-20 570Q110 530 240 590T460 550T620 610"/>
      <path className="tl" d="M-20 640Q80 600 180 650T400 620T620 680"/>
      <path className="tl" d="M-20 700Q120 660 250 720T500 680T620 750"/>
      <ellipse className="tl" cx="300" cy="350" rx="160" ry="80" transform="rotate(-8 300 350)"/>
      <ellipse className="tl" cx="300" cy="350" rx="110" ry="50" transform="rotate(-8 300 350)"/>
      <ellipse className="tl" cx="300" cy="350" rx="55" ry="22" transform="rotate(-8 300 350)"/>
      <ellipse className="tl" cx="160" cy="550" rx="120" ry="60" transform="rotate(12 160 550)"/>
      <ellipse className="tl" cx="160" cy="550" rx="70" ry="30" transform="rotate(12 160 550)"/>
      <ellipse className="tl" cx="460" cy="200" rx="100" ry="50" transform="rotate(-15 460 200)"/>
      <ellipse className="tl" cx="460" cy="200" rx="50" ry="22" transform="rotate(-15 460 200)"/>
      <ellipse className="tl" cx="400" cy="650" rx="90" ry="45" transform="rotate(6 400 650)"/>
    </svg>
  )
}

// ── Step 0 — Welcome (split panel) ─────────────────────────
function StepWelcome({ onGoogle }) {
  return (
    <div className="split-welcome">
      <div className="split-left">
        <TopoPattern />
        <div className="split-left-content">
          <div className="split-left-brand">
            <span className="ob-mark" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 16 }}>M</span>
          </div>
          <div className="split-left-text">
            <h1>Your Personal<br/>Study Companion.</h1>
            <div className="split-left-divider"></div>
            <p className="split-left-feature">AI-Powered Learning</p>
          </div>
        </div>
      </div>

      <div className="split-right">
        <h2 className="split-right-title">Welcome to <span>MasterAI</span></h2>
        <p className="split-right-sub">Sign in to create your own study plan, track your progress, and learn at your pace — all in one place.</p>

        <button className="google-btn-lg" onClick={onGoogle}>
          <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.3c-2 1.5-4.5 2.6-7.3 2.6-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.2 5.3C40.4 36.4 44 30.7 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>
    </div>
  )
}

// ── Step 1 — Basics ─────────────────────────────────────────
function StepBasics({ data, set, nameError }) {
  return (
    <>
      <h2 className="ob-title">Tell us who you are.</h2>
      <p className="ob-sub">A few quick details so we can address you properly and tailor the content.</p>
      <div className="ob-form" style={{ marginTop: 22 }}>
        <div className="ob-field">
          <label>Full name <span className="ob-req">*</span></label>
          <input
            className={`ob-input ${nameError && !(data.name || '').trim() ? 'ob-input-error' : ''}`}
            type="text" placeholder="Full name"
            value={data.name || ''}
            onChange={e => set('name', e.target.value)} />
          {nameError && !(data.name || '').trim() && <span className="ob-error">Please enter your name to continue</span>}
        </div>
        <div className="ob-row2">
          <div className="ob-field">
            <label>Class <span className="ob-req">*</span></label>
            <select className="ob-select" value={data.cls || 'X'} onChange={e => set('cls', e.target.value)}>
              <option value="X">Class X</option>
            </select>
          </div>
          <div className="ob-field">
            <label>Board <span className="ob-req">*</span></label>
            <select className="ob-select" value={data.board || 'CBSE'} onChange={e => set('board', e.target.value)}>
              <option value="CBSE">CBSE</option>
            </select>
          </div>
        </div>
        <div className="ob-field">
          <label>School <span className="ob-req">*</span></label>
          <input
            className={`ob-input ${nameError && !(data.school || '').trim() ? 'ob-input-error' : ''}`}
            type="text" placeholder="School name"
            value={data.school || ''}
            onChange={e => set('school', e.target.value)} />
          {nameError && !(data.school || '').trim() && <span className="ob-error">Please enter your school name</span>}
        </div>
        <div className="ob-field">
          <label>Phone number <span className="ob-req">*</span></label>
          <div className="ob-phone-row">
            <span className="ob-phone-prefix">+91</span>
            <input
              className={`ob-input ob-phone-input ${nameError && (data.phone || '').length !== 10 ? 'ob-input-error' : ''}`}
              type="tel" placeholder="10-digit mobile number"
              maxLength={10}
              value={data.phone || ''}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                set('phone', val)
              }} />
          </div>
          {data.phone && data.phone.length > 0 && data.phone.length < 10 && (
            <span className="ob-error">Enter a valid 10-digit number</span>
          )}
          {nameError && !(data.phone || '').trim() && (
            <span className="ob-error">Please enter your phone number</span>
          )}
        </div>
      </div>
    </>
  )
}

// ── Step 2 — Self-rating (1–5 stars per subject) ────────────
function StepHistory({ data, set }) {
  const ratings = data.ratings || {}
  const setRating = (id, v) => set('ratings', { ...ratings, [id]: v })

  return (
    <>
      <h2 className="ob-title">Rate yourself in each subject.</h2>
      <p className="ob-sub">Your inputs help us guide you better.</p>
      <div className="marks-grid" style={{ marginTop: 22 }}>
        {MARKS_SUBJECTS.map(s => {
          const v = ratings[s.id] ?? 1
          return (
            <div className="rating-row" key={s.id}>
              <div className="marks-name">
                <span className="marks-ic" data-c={s.color}>{s.ic}</span>
                {s.name}
              </div>
              <div className="stars">
                {[1, 2, 3, 4, 5].map(i => (
                  <button key={i} type="button"
                    className={`star ${i <= v ? 'on' : ''}`}
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
      <h2 className="ob-title">Which subjects feel hard?</h2>
      <p className="ob-sub">Select the subjects you find challenging.</p>
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
      <h2 className="ob-title">How fast do you usually learn?</h2>
      <p className="ob-sub">We'll calibrate explanations, recap frequency, and daily load to match.</p>
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
function StepDone({ data, onFinish }) {
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
        Your dashboard is ready. Let's get started.
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
        {data.google && (
          <div className="summary-row">
            <span className="summary-label">Signed in via</span>
            <span className="summary-val">
              <b>Google</b>
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <button className="ob-btn primary big" onClick={onFinish}>
          Go to dashboard <Icon name="arrow-right" size={14} />
        </button>
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
    ratings: { science: 1, maths: 1, english: 1, social: 1, hindi: 1 },
    pace: 'balanced',
  })
  const [nameError, setNameError] = useState(false)
  const [confirmPopup, setConfirmPopup] = useState(null)

  useEffect(() => {
    if (user && step === 0) {
      setData(d => ({ ...d, google: true }))
      setStep(1)
    }
  }, [user])

  const set = (k, v) => {
    setData(d => ({ ...d, [k]: v }))
    if (k === 'name' || k === 'school' || k === 'phone') setNameError(false)
    if (k === 'ratings') setConfirmPopup(null)
    if (k === 'tough') setConfirmPopup(null)
  }

  const next = () => {
    if (step === 1) {
      const nameMissing = !(data.name || '').trim()
      const schoolMissing = !(data.school || '').trim()
      const phoneMissing = !(data.phone || '').trim()
      const phoneInvalid = (data.phone || '').length !== 10
      if (nameMissing || schoolMissing || phoneMissing || phoneInvalid) {
        setNameError(true)
        return
      }
    }
    if (step === 2) {
      const rats = data.ratings || {}
      const allDefault = Object.values(rats).every(v => v === 1)
      if (allDefault) {
        setConfirmPopup({
          title: 'All ratings are at 1 star',
          message: 'You haven\'t changed any subject ratings. Are you sure you want to continue with the default?',
          onConfirm: () => { setConfirmPopup(null); setStep(s => Math.min(s + 1, STEPS.length - 1)) },
        })
        return
      }
    }
    if (step === 3) {
      if (!(data.tough || []).length) {
        setConfirmPopup({
          title: 'No subjects selected',
          message: 'Please select at least one subject you find challenging before continuing.',
          confirmText: 'OK',
          singleAction: true,
          onConfirm: () => setConfirmPopup(null),
        })
        return
      }
    }
    setNameError(false)
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => setStep(s => Math.max(s - 1, 0))

  const finish = async () => {
    await saveUserProfile(data)
    markOnboardingDone()
    navigate('/')
  }

  const handleGoogle = () => {
    signInWithGoogle()
  }

  const renderStep = () => {
    switch (step) {
      case 0: return <StepWelcome onGoogle={handleGoogle} />
      case 1: return <StepBasics data={data} set={set} nameError={nameError} />
      case 2: return <StepHistory data={data} set={set} />
      case 3: return <StepAssess data={data} set={set} />
      case 4: return <StepPace data={data} set={set} />
      case 5: return <StepDone data={data} onFinish={finish} />
      default: return null
    }
  }

  const showFooter = step > 0 && step < STEPS.length - 1
  const isLastInput = step === STEPS.length - 2
  const isWelcome = step === 0

  return (
    <div className="ob-page" style={isWelcome ? { '--ob-max-width': '860px' } : undefined}>
      <div className={`ob ${isWelcome ? 'ob--welcome' : ''}`}>
        {!isWelcome && step !== STEPS.length - 1 && (
          <div className="ob-head">
            <Brand />
            {step > 0 && <Progress step={step} />}
          </div>
        )}

        {isWelcome ? renderStep() : (
          <div className="ob-body">
            {renderStep()}
          </div>
        )}

        {showFooter && (
          <div className="ob-foot">
            <button className="ob-btn text" onClick={back}>
              <Icon name="arrow-right" size={13} style={{ transform: 'rotate(180deg)' }} /> Back
            </button>
            <div style={{ flex: 1 }}></div>
            <button className="ob-btn primary" onClick={next}>
              {isLastInput ? 'Finish setup' : 'Continue'} <Icon name="arrow-right" size={13} />
            </button>
          </div>
        )}

        <ConfirmPopup
          show={!!confirmPopup}
          title={confirmPopup?.title}
          message={confirmPopup?.message}
          confirmText={confirmPopup?.confirmText}
          singleAction={confirmPopup?.singleAction}
          onConfirm={confirmPopup?.onConfirm}
          onCancel={() => setConfirmPopup(null)}
        />
      </div>
    </div>
  )
}
