import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ChatSidebar from '../components/ChatSidebar'
import ExerciseSection from '../components/ExerciseSection'
import RichContent, { countBlocks } from '../components/RichContent'
import SubtopicBlock from '../components/SubtopicBlock'

const SUBJECT_STYLES = {
  Physics:                  { bg: 'var(--physics-bg)',    border: 'var(--physics-border)',    color: 'var(--physics-text)'    },
  Chemistry:                { bg: 'var(--chemistry-bg)',  border: 'var(--chemistry-border)',  color: 'var(--chemistry-text)'  },
  Biology:                  { bg: 'var(--biology-bg)',    border: 'var(--biology-border)',    color: 'var(--biology-text)'    },
  'Environmental Science':  { bg: 'var(--env-bg)',        border: 'var(--env-border)',        color: 'var(--env-text)'        },
}

function subjectVars(subject) {
  const s = SUBJECT_STYLES[subject] || SUBJECT_STYLES.Physics
  return { '--subj-text': s.color, '--subj-bg': s.bg, '--subj-border': s.border }
}

const MIN_W = 260, MAX_W = 620, DEF_W = 360

// ─── Notes panel ────────────────────────────────────────────────────────────

function NotesPanel({ sections, chapterId }) {
  const [activeSec, setActiveSec] = useState(sections?.[0]?.id || '')
  const noteKey = `notes-${chapterId}-${activeSec}`
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`notes-ch-${chapterId}`) || '{}') } catch { return {} }
  })
  const [draft, setDraft] = useState(notes[activeSec] || '')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setDraft(notes[activeSec] || '') }, [activeSec])

  const doSave = () => {
    const updated = { ...notes, [activeSec]: draft }
    setNotes(updated)
    try { localStorage.setItem(`notes-ch-${chapterId}`, JSON.stringify(updated)) } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bg3)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>Section</div>
        <select value={activeSec} onChange={e => setActiveSec(e.target.value)} style={{
          width: '100%', padding: '7px 10px', borderRadius: 'var(--radius)',
          border: '1.5px solid var(--bg3)', background: 'var(--bg2)',
          fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-ui)',
          cursor: 'pointer', outline: 'none',
        }}>
          {(sections || []).map(s => <option key={s.id} value={s.id}>{s.id} — {s.title}</option>)}
        </select>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 14px', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
          <span>Your notes</span>
          {saved && <span style={{ color: 'var(--green)', fontWeight: 700, animation: 'popIn 0.2s ease' }}>✓ Saved!</span>}
        </div>
        <textarea
          value={draft} onChange={e => setDraft(e.target.value)}
          placeholder={`Write notes for §${activeSec} here…\n\nTip: use your own words — it sticks better! 💡`}
          style={{
            flex: 1, resize: 'none',
            border: '1.5px solid var(--bg3)', borderRadius: 'var(--radius-lg)',
            padding: '12px 14px',
            fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.75,
            color: 'var(--ink)', background: 'var(--bg)', outline: 'none',
          }}
          onBlur={doSave}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--ink4)' }}>Auto-saves on blur</span>
          <button onClick={doSave} style={{
            padding: '6px 16px', borderRadius: 'var(--radius)',
            background: 'var(--purple)', color: 'white', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700,
          }}>Save</button>
        </div>
        {sections?.some(s => notes[s.id]) && (
          <div style={{ borderTop: '1px solid var(--bg3)', paddingTop: 10, overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink4)', marginBottom: 8 }}>All notes</div>
            {sections.filter(s => notes[s.id]).map(s => (
              <button key={s.id} onClick={() => setActiveSec(s.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 'var(--radius)', marginBottom: 4,
                background: activeSec === s.id ? 'var(--purple-light)' : 'var(--bg2)',
                border: `1.5px solid ${activeSec === s.id ? 'var(--purple-border)' : 'transparent'}`,
                cursor: 'pointer',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--purple)', marginBottom: 2 }}>{s.id}</div>
                <div style={{ fontSize: 11, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {notes[s.id]?.slice(0, 55)}{(notes[s.id]?.length || 0) > 55 ? '…' : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TOC panel ──────────────────────────────────────────────────────────────

function TOCPanel({ sections, readSections, onToggleRead, sc }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '12px 0 16px' }}>
      <div style={{ padding: '0 14px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Sections</div>
      {(sections || []).map(s => {
        const isRead = readSections?.has(s.id)
        return (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', cursor: 'pointer',
            transition: 'all 0.14s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink4)', minWidth: 26 }}>{s.id}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink2)', flex: 1, lineHeight: 1.45 }}>{s.title}</span>
            {isRead && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill={sc.bg} />
                <path d="M4 7l2.5 2.5L10 4.5" stroke={sc.color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        )
      })}

      <div style={{ margin: '14px 14px 0', padding: '12px 0', borderTop: '1px solid var(--bg3)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink4)', marginBottom: 8 }}>Mark read</div>
        {(sections || []).map(s => {
          const isRead = readSections?.has(s.id)
          return (
            <button key={s.id} onClick={() => onToggleRead(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '5px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                background: isRead ? sc.color : 'transparent',
                border: `2px solid ${isRead ? sc.color : 'var(--bg3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {isRead && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{s.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main ChapterPage ───────────────────────────────────────────────────────

// ─── Sample MCQ bank for "Check Yourself" ────────────────────────────────────
const MCQ_BANK = [
  { q: 'Which of the following is a combination reaction?', opts: ['CaCO₃ → CaO + CO₂', '2Mg + O₂ → 2MgO', 'Zn + H₂SO₄ → ZnSO₄ + H₂', 'Fe + CuSO₄ → FeSO₄ + Cu'], ans: 1, exp: '2Mg + O₂ → 2MgO is a combination reaction — two substances combine into one.' },
  { q: 'Why must chemical equations be balanced?', opts: ['For neatness', 'To satisfy conservation of mass', 'Products are always more', 'To make them shorter'], ans: 1, exp: 'Atoms are never created or destroyed — this is the Law of Conservation of Mass.' },
  { q: 'What does a catalyst do in a reaction?', opts: ['Provides energy', 'Gets consumed', 'Speeds up without being consumed', 'Slows the reaction'], ans: 2, exp: 'A catalyst speeds up the reaction without itself being consumed in the process.' },
]

export default function ChapterPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [chapter, setChapter] = useState(null)
  const [richChapter, setRichChapter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [currentSubtopic, setCurrentSubtopic] = useState(null)

  // Highlights (click-to-highlight paragraphs, persisted)
  const hlKey = `st3_hl_${id}`
  const [highlights, setHighlights] = useState(() => {
    try { return JSON.parse(localStorage.getItem(hlKey) || '{}') } catch { return {} }
  })
  const toggleHL = (pid) => {
    setHighlights(prev => {
      const next = { ...prev }
      if (next[pid]) delete next[pid]; else next[pid] = true
      try { localStorage.setItem(hlKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Tab nav (rich mode) — content | activities | exercises
  const tabKey = `ch-${id}-activeTab`
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem(tabKey) || 'content' } catch { return 'content' }
  })
  useEffect(() => { try { localStorage.setItem(tabKey, activeTab) } catch {} }, [activeTab, tabKey])

  // Read-progress per section
  const readKey = `ch-${id}-readSections`
  const [readSections, setReadSections] = useState(() => {
    try {
      const raw = localStorage.getItem(readKey)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })
  const toggleSectionRead = (sectionId) => {
    setReadSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId)
      try { localStorage.setItem(readKey, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // Sidebar state
  const [sideTab, setSideTab] = useState('toc')
  const [sideW, setSideW] = useState(() => {
    const s = parseInt(localStorage.getItem('st3_sw') || '0')
    return s >= MIN_W && s <= MAX_W ? s : DEF_W
  })
  const containerRef = useRef(null)
  const dragging = useRef(false)

  const startDrag = useCallback((e) => {
    dragging.current = true
    e.preventDefault()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    function onMove(e2) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const nw = Math.max(MIN_W, Math.min(MAX_W, rect.right - e2.clientX))
      setSideW(nw)
      localStorage.setItem('st3_sw', String(nw))
    }
    function onUp() {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const scrollRef = useRef(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [activeTab])

  const chatRef = useRef(null)

  // Load chapter + session
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const sRes = await fetch('/api/session/new', { method: 'POST' })
        const sData = await sRes.json()
        if (cancelled) return
        setSessionId(sData.session_id)

        const cRes = await fetch(`/api/chapters/${id}`)
        if (!cRes.ok) throw new Error('Chapter not found')
        const cData = await cRes.json()
        if (cancelled) return
        cData.sections?.forEach(sec => sec.subtopics?.forEach(sub => { sub._chapterId = cData.id }))
        setChapter(cData)

        try {
          const rRes = await fetch(`/api/chapters/${id}/rich`)
          if (rRes.ok) { const rData = await rRes.json(); if (!cancelled) setRichChapter(rData) }
        } catch {}

        setLoading(false)
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    }
    init()
    return () => { cancelled = true }
  }, [id])

  // Action handlers
  const handleAction = (action, subtopic) => {
    setCurrentSubtopic(subtopic)
    setSideTab('chat')
    if (action && chatRef.current?.sendAction) chatRef.current.sendAction(action, subtopic)
  }
  const handleRichAction = (action, context) => {
    handleAction(action, {
      id: context.id || 'rich', title: context.title,
      content: context.content || '', _chapterId: chapter.id,
    })
  }

  // "Check Yourself" — fire a random MCQ in the Tutor tab
  const handleCheckYourself = (sectionTitle) => {
    setSideTab('chat')
    const mcq = MCQ_BANK[Math.floor(Math.random() * MCQ_BANK.length)]
    if (chatRef.current?.showMCQ) chatRef.current.showMCQ(mcq)
  }

  // Quick-ask prompt from section footer
  const handleAsk = (prompt) => {
    setSideTab('chat')
    if (chatRef.current?.sendMessage) chatRef.current.sendMessage(prompt)
  }

  const handleAskInChat = (exercise) => {
    const sub = {
      id: exercise.id,
      title: `Exercise: ${exercise.question.slice(0, 60)}…`,
      content: exercise.question, _chapterId: chapter.id,
    }
    setCurrentSubtopic(sub)
    setSideTab('chat')
    if (chatRef.current?.sendMessage) {
      chatRef.current.sendMessage(`Please solve this NCERT exercise step-by-step:\n\n${exercise.question}`)
    }
  }

  // Loading / error
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--ink3)' }}>
      Loading chapter…
    </div>
  )
  if (error || !chapter) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: 'var(--danger)' }}>⚠️ {error || 'Chapter not found'}</div>
      <button onClick={() => navigate('/')} style={{ background: 'var(--purple)', color: 'white', padding: '8px 16px', borderRadius: 8, fontWeight: 700 }}>← Back to chapters</button>
    </div>
  )

  const sc = SUBJECT_STYLES[chapter.subject] || SUBJECT_STYLES.Physics
  const subjVars = subjectVars(chapter.subject)
  const secs = richChapter?.sections || chapter.sections || []
  const totalSections = secs.length
  const readCount = [...readSections].filter(sid => secs.some(s => s.id === sid)).length
  const readTime = Math.round((chapter.subtopic_count || secs.length || 5) * 2.5)

  // Chat unread badge
  const chatHasMessages = sessionId != null

  return (
    <div ref={containerRef} style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', overflow: 'hidden', ...subjVars,
    }}>
      {/* ── Topbar ── */}
      <div style={{
        height: 52, flexShrink: 0, background: 'var(--surface)',
        borderBottom: '1px solid var(--bg3)',
        display: 'flex', alignItems: 'center', gap: 0, zIndex: 30,
      }}>
        <button onClick={() => navigate('/')} style={{
          height: '100%', padding: '0 20px', border: 'none', background: 'none',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink3)',
          display: 'flex', alignItems: 'center', gap: 6,
          borderRight: '1px solid var(--bg3)', flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--bg2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink3)'; e.currentTarget.style.background = 'none' }}
        >← Chapters</button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', overflow: 'hidden' }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '3px 11px', borderRadius: 100, flexShrink: 0,
            background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}`,
          }}>{chapter.subject}</span>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
            color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>Ch.{chapter.id} — {chapter.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderLeft: '1px solid var(--bg3)', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ink3)' }}>⏱ <b style={{ color: 'var(--ink2)' }}>{readTime}m</b></span>
          {totalSections > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 56, height: 4, borderRadius: 3, background: 'var(--bg2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${readCount / totalSections * 100}%`, background: sc.color, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{readCount}/{totalSections}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 300, display: 'flex', flexDirection: 'column' }}>
          {/* Tab nav — rich mode */}
          {richChapter && (() => {
            const counts = countBlocks(richChapter)
            const exerciseCount = richChapter.exercises?.length || 0
            const tabs = [
              { key: 'content', label: 'Content', count: null },
              { key: 'activities', label: 'Activities', count: counts.activities },
              { key: 'exercises', label: 'Exercises', count: counts.inTextQs + exerciseCount },
            ]
            return (
              <div style={{
                borderBottom: '1px solid var(--bg3)', background: 'var(--surface)',
                display: 'flex', padding: '0 20px', flexShrink: 0,
              }}>
                {tabs.map(t => {
                  const active = activeTab === t.key
                  return (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                      padding: '12px 4px', marginRight: 24,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-ui)', fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? sc.color : 'var(--ink3)',
                      borderBottom: `2.5px solid ${active ? sc.color : 'transparent'}`,
                      marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7,
                    }}>
                      {t.label}
                      {t.count !== null && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 18, height: 18, borderRadius: 9,
                          background: active ? sc.bg : 'var(--bg2)',
                          color: active ? sc.color : 'var(--ink3)',
                          border: `1px solid ${active ? sc.border : 'var(--bg3)'}`,
                          fontSize: 10, fontWeight: 600, padding: '0 5px',
                        }}>{t.count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })()}

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            {richChapter ? (
              <div style={{ maxWidth: 700, margin: '0 auto', padding: '44px 40px 80px' }}>
                <RichContent
                  chapter={richChapter}
                  onAction={handleRichAction}
                  tab={activeTab}
                  readSections={readSections}
                  onToggleRead={toggleSectionRead}
                  highlights={highlights}
                  onToggleHL={toggleHL}
                  onCheckYourself={handleCheckYourself}
                  onAsk={handleAsk}
                />
                {activeTab === 'exercises' && (
                  <ExerciseSection
                    exercises={richChapter.exercises?.map(e => ({
                      id: `ex-${chapter.id}-${e.num}`, type: e.type,
                      question: e.question, options: e.options,
                    })) || chapter.exercises}
                    chapterId={chapter.id}
                    onAskInChat={handleAskInChat}
                  />
                )}
              </div>
            ) : (
              <div style={{ maxWidth: 700, margin: '0 auto', padding: '44px 40px 80px' }}>
                {chapter.intro && (
                  <div style={{
                    background: 'var(--surface)', border: '1.5px solid var(--bg3)',
                    borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 20,
                    boxShadow: 'var(--shadow)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>Introduction</div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.85, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{chapter.intro}</p>
                  </div>
                )}
                {chapter.sections?.map(section => (
                  <div key={section.id} style={{ marginBottom: 20 }}>
                    <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 21, fontWeight: 800, color: 'var(--ink)', marginBottom: 12, borderLeft: `4px solid ${sc.color}`, paddingLeft: 12 }}>
                      {section.id} · {section.title}
                    </h2>
                    {section.subtopics?.map(sub => (
                      <SubtopicBlock key={sub.id} subtopic={sub} sectionTitle={section.title} onAction={handleAction} />
                    ))}
                  </div>
                ))}
                {chapter.summary?.length > 0 && (
                  <div style={{ background: 'var(--purple-light)', border: `1.5px solid var(--purple-border)`, borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 800, color: 'var(--purple)', marginBottom: 10 }}>📌 What you have learnt</h3>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      {chapter.summary.map((line, i) => (
                        <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.85, color: 'var(--ink2)', marginBottom: 6 }}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <ExerciseSection exercises={chapter.exercises} chapterId={chapter.id} onAskInChat={handleAskInChat} />
              </div>
            )}
          </div>
        </div>

        {/* Drag divider */}
        <div className="divider" onMouseDown={startDrag} />

        {/* Sidebar */}
        <div style={{
          width: sideW, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderLeft: '1px solid var(--bg3)', overflow: 'hidden',
        }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderBottom: '1px solid var(--bg3)', flexShrink: 0 }}>
            {[
              { id: 'toc', label: '📋 Contents' },
              { id: 'notes', label: '✏️ Notes' },
              { id: 'chat', label: '🤖 Tutor' },
            ].map(tb => (
              <button key={tb.id} onClick={() => setSideTab(tb.id)} style={{
                flex: 1, padding: '11px 4px 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: sideTab === tb.id ? 800 : 500,
                color: sideTab === tb.id ? 'var(--ink)' : 'var(--ink3)',
                borderBottom: sideTab === tb.id ? '2.5px solid var(--purple)' : '2.5px solid transparent',
                position: 'relative',
              }}>
                {tb.label}
                {tb.id === 'chat' && sideTab !== 'chat' && chatHasMessages && (
                  <span style={{
                    position: 'absolute', top: 9, right: 14,
                    width: 7, height: 7, borderRadius: '50%', background: 'var(--orange)',
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {sideTab === 'toc' && <TOCPanel sections={secs} readSections={readSections} onToggleRead={toggleSectionRead} sc={sc} />}
            {sideTab === 'notes' && <NotesPanel sections={secs} chapterId={chapter.id} />}
            {sideTab === 'chat' && sessionId && (
              <ChatSidebar
                ref={chatRef}
                sessionId={sessionId}
                chapterId={chapter.id}
                currentSubtopic={currentSubtopic}
                onClear={() => setCurrentSubtopic(null)}
              />
            )}
          </div>

          {/* Resize hint */}
          <div style={{
            padding: '4px 12px', borderTop: '1px solid var(--bg3)',
            display: 'flex', justifyContent: 'space-between',
            background: 'var(--bg2)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, color: 'var(--ink4)', fontFamily: 'var(--font-mono)' }}>← drag to resize · {sideW}px</span>
            <button onClick={() => { setSideW(DEF_W); localStorage.setItem('st3_sw', String(DEF_W)) }} style={{
              fontSize: 9, color: 'var(--ink4)', background: 'none', border: 'none', cursor: 'pointer',
            }}>reset</button>
          </div>
        </div>
      </div>
    </div>
  )
}
