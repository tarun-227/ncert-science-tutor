import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchAllChapterProgress } from '../lib/userdata'

const SUBJECT_VARS = {
  Physics:                  { text: 'var(--physics-text)',    bg: 'var(--physics-bg)',    border: 'var(--physics-border)'    },
  Chemistry:                { text: 'var(--chemistry-text)',  bg: 'var(--chemistry-bg)',  border: 'var(--chemistry-border)'  },
  Biology:                  { text: 'var(--biology-text)',    bg: 'var(--biology-bg)',    border: 'var(--biology-border)'    },
  'Environmental Science':  { text: 'var(--env-text)',        bg: 'var(--env-bg)',        border: 'var(--env-border)'        },
}

const SUBJECT_ORDER = ['Chemistry', 'Physics', 'Biology', 'Environmental Science']

function readSectionCountLocal(chapterId) {
  // Local fallback used until Supabase data loads
  try {
    const raw = localStorage.getItem(`ch-${chapterId}-readSections`)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch { return 0 }
}

function ProgressArc({ value, size = 38 }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * value
  const col = value >= 1 ? 'var(--subj-text)' : 'var(--purple)'
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg3)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={col} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 600, fill: 'var(--ink3)' }}>
        {Math.round(value * 100)}%
      </text>
    </svg>
  )
}

function ChapterCard({ chapter, onClick, readCount }) {
  const [hov, setHov] = useState(false)
  const v = SUBJECT_VARS[chapter.subject] || SUBJECT_VARS.Physics
  const total = chapter.subtopic_count || 1
  const read = readCount ?? readSectionCountLocal(chapter.id)
  const progress = Math.min(1, read / total)
  const done = progress >= 1

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        '--subj-text': v.text, '--subj-bg': v.bg, '--subj-border': v.border,
        background: 'var(--surface)',
        border: `1.5px solid ${hov ? v.border : 'var(--bg3)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        cursor: 'pointer',
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow)',
        transition: 'all 0.18s ease',
        transform: hov ? 'translateY(-2px)' : 'none',
        animation: 'fadeUp 0.3s ease both',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {done && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          padding: '4px 12px',
          background: v.bg, color: v.text,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
          borderBottomLeftRadius: 'var(--radius)',
          border: `1px solid ${v.border}`, borderTop: 'none', borderRight: 'none',
        }}>
          ✓ DONE
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
          color: 'var(--ink3)', background: 'var(--bg2)',
          padding: '2px 7px', borderRadius: 5,
        }}>
          CH.{chapter.id}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
          ~{Math.round((chapter.subtopic_count || 5) * 2.5)} min
        </span>
      </div>

      <h3 style={{
        fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
        lineHeight: 1.4, color: 'var(--ink)', marginBottom: 14,
      }}>
        {chapter.title}
      </h3>

      {progress > 0 && !done && (
        <div style={{ height: 3, borderRadius: 3, background: 'var(--bg2)', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%', width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${v.text}, ${v.border})`,
            borderRadius: 3,
          }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, marginTop: 'auto' }}>
        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
          <b style={{ color: 'var(--ink2)' }}>{chapter.subtopic_count}</b> topics
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
          <b style={{ color: 'var(--ink2)' }}>{chapter.exercise_count}</b> exercises
        </span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [chapters, setChapters]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [allProgress, setAllProgress] = useState({})  // { chapterId: readCount }
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  useEffect(() => {
    fetch('/api/chapters')
      .then(r => r.json())
      .then(data => { setChapters(data); setLoading(false) })
      .catch(() => { setError('Backend not running. Start with: uvicorn backend.main:app --port 8000'); setLoading(false) })
  }, [])

  // Load per-chapter read counts from Supabase (single query)
  useEffect(() => {
    fetchAllChapterProgress().then(counts => {
      if (counts && Object.keys(counts).length > 0) setAllProgress(counts)
    })
  }, [])

  const getRead = (chId) => allProgress[chId] ?? readSectionCountLocal(chId)

  const totalRead = chapters.reduce((n, ch) => {
    const total = ch.subtopic_count || 1
    return n + (getRead(ch.id) >= total ? 1 : 0)
  }, 0)
  const pct = chapters.length
    ? Math.round(chapters.reduce((s, ch) => {
        const total = ch.subtopic_count || 1
        return s + Math.min(1, getRead(ch.id) / total)
      }, 0) / chapters.length * 100)
    : 0

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: 'var(--bg)', fontFamily: 'var(--font-ui)' }}>
      {/* Nav */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(247,246,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--bg3)',
        padding: '0 32px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10,
            background: 'var(--purple)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 16 }}>🔬</span>
          </div>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 800,
            color: 'var(--ink)', letterSpacing: '-0.02em',
          }}>
            ScienceTutor
          </span>
          <span style={{
            fontSize: 11, color: 'var(--ink3)',
            paddingLeft: 10, borderLeft: '1px solid var(--bg3)',
          }}>
            NCERT Class 10
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate('/qpaper')}
            style={{
              background: 'var(--purple-light)',
              border: '1.5px solid var(--purple-border)',
              borderRadius: 100,
              padding: '5px 14px',
              fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
              color: 'var(--purple)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>📄</span>
            <span>Solve a Paper</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, borderLeft: '1px solid var(--bg3)' }}>
            <span style={{ fontSize: 11, color: 'var(--ink3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </span>
            <button
              onClick={signOut}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--purple)'; e.currentTarget.style.color = 'var(--purple)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg3)'; e.currentTarget.style.color = 'var(--ink3)' }}
              style={{
                background: 'transparent', border: '1.5px solid var(--bg3)',
                borderRadius: 100, padding: '4px 12px',
                fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
                color: 'var(--ink3)', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: 'var(--hero-gradient)',
        padding: '56px 48px 52px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'rgba(108,92,231,0.18)' }} />
        <div style={{ position: 'absolute', bottom: -100, right: 200, width: 240, height: 240, borderRadius: '50%', background: 'rgba(9,132,227,0.12)' }} />
        <div style={{ maxWidth: 640, position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 100,
            background: 'var(--hero-badge-bg)',
            border: '1px solid rgba(108,92,231,0.4)',
            marginBottom: 18,
          }}>
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,0.7)',
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              ✦ Class 10 Science · {chapters.length || 13} Chapters
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-body)', fontSize: 44, fontWeight: 800,
            color: '#fff', lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.03em',
          }}>
            Learn smarter,<br /><span style={{ color: 'rgba(196,186,245,0.9)' }}>not harder.</span>
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.7, maxWidth: 440, marginBottom: 32,
            fontFamily: 'var(--font-body)',
          }}>
            Read chapters your way — highlight, take notes, quiz yourself, and chat with your AI tutor. All in one place.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, maxWidth: 220, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                borderRadius: 3, background: 'var(--purple-border)',
                transition: 'width 1s',
              }} />
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {totalRead} of {chapters.length || 13} complete · {pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Chapter grid */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 36px 80px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink3)' }}>Loading chapters…</div>
        )}
        {error && (
          <div style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-lg)', padding: 20, color: 'var(--danger)', fontSize: 14,
          }}>
            ⚠️ {error}
          </div>
        )}
        {!loading && !error && (
          <>
            {SUBJECT_ORDER.map(subj => {
              const chaps = chapters.filter(c => c.subject === subj)
              if (!chaps.length) return null
              const v = SUBJECT_VARS[subj]
              return (
                <div key={subj} style={{ marginBottom: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '4px 12px', borderRadius: 100,
                      background: v.bg, color: v.text, border: `1.5px solid ${v.border}`,
                    }}>
                      {subj}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--bg3)' }} />
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 14,
                  }}>
                    {chaps.map(ch => (
                      <ChapterCard key={ch.id} chapter={ch} onClick={() => navigate(`/chapter/${ch.id}`)} readCount={getRead(ch.id)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
