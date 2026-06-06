import { useState, useEffect, useRef, useMemo } from 'react'
import Icon from '../components/Icons'
import {
  getDoneSections, getDoneSectionsAsync, markSectionDone, syncPlanCompletions,
  getCachedSummary, saveSummaryCache,
} from '../lib/studyPlanStore'
import { fetchTutorNotes, saveTutorNotes } from '../lib/userdata'
import { apiFetch } from '../lib/api'
import './StudyView.css'

// ─── Markdown-ish → blocks parser (for AI summaries) ──────────────────────────
function parseBlocks(text) {
  if (!text) return []
  const lines = text.split('\n')
  const blocks = []
  let listBuf = []
  const flushList = () => {
    if (listBuf.length) { blocks.push({ kind: 'list', items: listBuf }); listBuf = [] }
  }
  for (const raw of lines) {
    const t = raw.trim()
    if (!t) { flushList(); continue }
    if (/^#{1,4}\s/.test(t)) { flushList(); blocks.push({ kind: 'h', text: t.replace(/^#{1,4}\s+/, '') }); continue }
    if (/^[-*•]\s/.test(t)) { listBuf.push(t.replace(/^[-*•]\s+/, '')); continue }
    flushList()
    blocks.push({ kind: 'p', text: t })
  }
  flushList()
  return blocks
}

// inline **bold** / *italic*
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>
    if (p.startsWith('*') && p.endsWith('*')) return <i key={i}>{p.slice(1, -1)}</i>
    return p
  })
}

// ─── Textbook block renderer (Book mode) ──────────────────────────────────────
function BookBlocks({ blocks }) {
  if (!blocks || !blocks.length) return <p className="rb-p muted">No content for this section.</p>
  return blocks.map((block, i) => {
    switch (block.type) {
      case 'paragraph': return <p key={i} className="rb-p">{block.text}</p>
      case 'subsection':
        return (
          <div key={i}>
            <h2 className="rb-h2">{block.title}</h2>
            {block.blocks && <BookBlocks blocks={block.blocks} />}
          </div>
        )
      case 'equation':
        return <div key={i} className="rb-eq"><code>{block.body || block.text}</code></div>
      case 'figure':
        return (
          <figure key={i} className="rb-fig">
            {block.image && <img src={`/figures/${block.image}`} alt={block.caption || ''} />}
            {block.caption && <figcaption>Figure {block.num} — {block.caption}</figcaption>}
          </figure>
        )
      case 'callout': case 'do_you_know': case 'keyconcept':
        return (
          <div key={i} className="rb-callout">
            {block.title && <b>{block.title}</b>} {block.body || block.text}
          </div>
        )
      case 'activity':
        return (
          <div key={i} className="rb-activity">
            <div className="rb-activity-h">Activity {block.num}</div>
            {block.steps?.map((s, si) => <div key={si} className="rb-step">{si + 1}. {s}</div>)}
          </div>
        )
      case 'in_text_questions':
        return (
          <div key={i} className="rb-itq">
            <div className="rb-itq-h">Check your understanding</div>
            {block.items?.map((q, qi) => <div key={qi} className="rb-itq-q">{qi + 1}. {q.text || q}</div>)}
          </div>
        )
      case 'poem':
        return (
          <div key={i} className="rb-poem">
            {(block.content || block.text || '').split('\n').map((line, li) =>
              line.trim() === ''
                ? <div key={li} className="rb-poem-gap" />
                : <div key={li} className="rb-poem-line">{line}</div>
            )}
          </div>
        )
      case 'text':
        return (block.content || block.text || '').split('\n\n').map((para, pi) =>
          para.trim() ? <p key={`${i}-${pi}`} className="rb-p">{para.trim()}</p> : null
        )
      default:
        return block.text ? <p key={i} className="rb-p">{block.text}</p>
             : block.content ? block.content.split('\n\n').map((para, pi) =>
                 para.trim() ? <p key={`${i}-${pi}`} className="rb-p">{para.trim()}</p> : null
               )
             : null
    }
  })
}

// ════════════════════════════════════════════════════════════════════════════
// BOOK MODE — 3-column reader
// ════════════════════════════════════════════════════════════════════════════

function ReaderContents({ chapters, chapter, richData, currentSection, setCurrentSection, onChapterChange, collapsed, onToggle, doneSections }) {
  const [openCh, setOpenCh] = useState(true)

  if (collapsed) {
    return (
      <div className="rc rc-collapsed">
        <button className="rc-toggle" onClick={onToggle} title="Open contents"><Icon name="list" size={15} /></button>
        <div className="rc-heatmap">
          {richData?.sections?.map((_, si) => (
            <div key={si}
              className={`rc-hm-cell ${si === currentSection ? 'current' : doneSections.includes(si) ? 'read' : ''}`}
              title={richData.sections[si].title}
              onClick={() => { setCurrentSection(si); onToggle() }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rc">
      <div className="rc-head">
        <div>
          <div className="rc-eyebrow">Contents</div>
          <div className="rc-book">{chapter?.title} · {chapter?.subject}</div>
        </div>
        <button className="tb-icon" onClick={onToggle} title="Collapse"><Icon name="side-toggle" size={14} /></button>
      </div>
      <div className="rc-list scroll">
        <div className="rc-unit">
          <button className="rc-unit-h" onClick={() => setOpenCh(o => !o)}>
            <span>Sections</span>
            <Icon name="chev-down" size={14} style={{ transform: openCh ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
          </button>
          {openCh && (
            <div className="rc-chapters">
              {richData?.sections?.map((sec, si) => {
                const isDone = doneSections.includes(si)
                const isCur = si === currentSection
                return (
                  <div key={sec.id} className={`rc-item ${isCur ? 'on' : ''} ${isDone ? 'read' : ''}`} onClick={() => setCurrentSection(si)}>
                    {isCur && <span className="rc-dot" />}
                    {!isCur && isDone && <Icon name="check" size={11} className="rc-check" />}
                    {!isCur && !isDone && <span className="rc-empty" />}
                    <span className="rc-title">{sec.title}</span>
                    <span className="rc-num">{si + 1}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {/* Other chapters */}
        <div className="rc-other-h">Other chapters</div>
        {chapters.filter(c => c.id !== chapter?.id).map(c => (
          <div key={c.id} className="rc-item" onClick={() => onChapterChange(c.id)}>
            <span className="rc-empty" />
            <span className="rc-title">{c.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReaderBody({ chapter, richData, currentSection }) {
  const sec = richData?.sections?.[currentSection]
  const artRef = useRef(null)
  const [sel, setSel] = useState(null)    // { text, x, top, bottom }
  const [card, setCard] = useState(null)  // { text, answer, loading, x, top, bottom }
  const [noted, setNoted] = useState(false)
  const sessionRef = useRef(`book-${Date.now()}`)

  // Text-selection detection
  useEffect(() => {
    const onUp = () => {
      setTimeout(() => {
        const s = window.getSelection()
        const txt = s && s.toString().trim()
        if (!txt || !artRef.current) return
        const range = s.rangeCount ? s.getRangeAt(0) : null
        if (!range || !artRef.current.contains(range.commonAncestorContainer)) return
        const r = range.getBoundingClientRect()
        if (!r || (r.width === 0 && r.height === 0)) return
        setCard(null)
        setSel({ text: txt, x: r.left + r.width / 2, top: r.top, bottom: r.bottom })
      }, 10)
    }
    const onDown = (e) => {
      if (e.target.closest && (e.target.closest('.rb-sel-pop') || e.target.closest('.rb-sel-card'))) return
      setSel(null); setCard(null)
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('mouseup', onUp); document.removeEventListener('mousedown', onDown) }
  }, [])

  // Reset on section change
  useEffect(() => { setSel(null); setCard(null) }, [currentSection, chapter?.id])

  const askAI = async () => {
    if (!sel) return
    const text = sel.text
    setCard({ text, answer: '', loading: true, x: sel.x, top: sel.top, bottom: sel.bottom })
    setSel(null); setNoted(false)
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionRef.current, chapter_id: chapter.id, subtopic_id: sec?.id || '',
          message: `Explain this excerpt from the textbook in simple terms: "${text}"`, history: [],
        }),
      })
      const data = await res.json()
      setCard(c => c ? { ...c, answer: data.reply || data.response || 'No response.', loading: false } : c)
    } catch {
      setCard(c => c ? { ...c, answer: 'Could not reach the tutor.', loading: false } : c)
    }
  }

  const noteSelection = async () => {
    if (!sel || !chapter || !sec) return
    const text = sel.text
    const existing = await fetchTutorNotes(chapter.id, sec.id)
    if (!existing.some(n => n.text === text)) {
      await saveTutorNotes(chapter.id, sec.id, [...existing, { id: Date.now() + Math.random(), text }])
    }
    setSel(null)
  }

  const addCardNote = async () => {
    if (!card || !chapter || !sec) return
    const existing = await fetchTutorNotes(chapter.id, sec.id)
    if (!existing.some(n => n.text === card.text)) {
      await saveTutorNotes(chapter.id, sec.id, [...existing, { id: Date.now() + Math.random(), text: card.text }])
    }
    setNoted(true)
  }

  if (!sec) return <div className="rb"><p className="muted" style={{ padding: 40 }}>Select a section.</p></div>

  return (
    <div className="rb scroll">
      <div className="rb-headblk">
        <h1>{sec.title}</h1>
        <div className="rb-meta">
          <div className="rb-avatar">{chapter?.subject?.charAt(0) || 'N'}</div>
          <div>
            <div className="rb-author">{chapter?.title}</div>
            <div className="muted small">NCERT · Class X {chapter?.subject}</div>
          </div>
        </div>
      </div>
      <article className="rb-text" ref={artRef}>
        <BookBlocks blocks={sec.blocks || []} />
      </article>

      {/* Floating Ask-AI selection toolbar */}
      {sel && (() => {
        const below = sel.top < 80
        return (
          <div className={`rb-sel-pop ${below ? 'below' : ''}`} style={{ left: sel.x, top: below ? sel.bottom : sel.top }}>
            <button className="rb-sel-ai" onMouseDown={e => e.preventDefault()} onClick={askAI}><Icon name="sparkles" size={13} /> Ask AI</button>
            <span className="rb-sel-div" />
            <button className="rb-sel-act" onMouseDown={e => e.preventDefault()} onClick={askAI}>Explain</button>
            <button className="rb-sel-act" onMouseDown={e => e.preventDefault()} onClick={noteSelection}><Icon name="note" size={12} /> Note</button>
          </div>
        )
      })()}

      {/* Answer card anchored to selection */}
      {card && (() => {
        const below = card.top < 280
        return (
          <div className={`rb-sel-card ${below ? 'below' : ''}`} style={{ left: card.x, top: below ? card.bottom : card.top }}>
            <div className="rb-sel-card-q">
              <span className="rb-ai-sparkle"><Icon name="sparkles" size={11} /></span>
              <span className="rb-sel-card-quote">“{card.text.length > 90 ? card.text.slice(0, 90) + '…' : card.text}”</span>
              <button className="rb-sel-card-x" onClick={() => setCard(null)}><Icon name="x" size={13} /></button>
            </div>
            {card.loading ? (
              <div className="rb-sel-card-loading">
                <span className="tutor-dot" /><span className="tutor-dot" /><span className="tutor-dot" />
                <span className="muted small" style={{ marginLeft: 4 }}>AI is thinking…</span>
              </div>
            ) : (
              <>
                <p className="rb-sel-card-a">{card.answer}</p>
                <div className="rb-sel-card-foot">
                  <button className="rb-sel-card-note" onClick={addCardNote}>
                    <Icon name={noted ? 'check' : 'plus'} size={12} /> {noted ? 'Saved' : 'Add note'}
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function ReaderSide({ chapter, richData, currentSection }) {
  return <AskPanel chapter={chapter} richData={richData} currentSection={currentSection} variant="book" />
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED — Ask the tutor panel
// ════════════════════════════════════════════════════════════════════════════

function AskPanel({ chapter, richData, currentSection, variant }) {
  const [answers, setAnswers] = useState([])
  const [draft, setDraft] = useState('')
  const [sessionId] = useState(() => `sv-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const bodyRef = useRef(null)
  const sec = richData?.sections?.[currentSection]

  useEffect(() => { setAnswers([]) }, [currentSection, chapter?.id])
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }) }, [answers])

  const ask = async () => {
    const q = draft.trim()
    if (!q) return
    const id = Date.now() + Math.random()
    setAnswers(a => [...a, { id, q, a: '', loading: true }])
    setDraft('')
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, chapter_id: chapter.id, subtopic_id: sec?.id || '', message: q, history: [] }),
      })
      const data = await res.json()
      const reply = data.reply || data.response || 'No response.'
      setAnswers(a => a.map(x => x.id === id ? { ...x, a: reply, loading: false } : x))
    } catch {
      setAnswers(a => a.map(x => x.id === id ? { ...x, a: 'Could not reach the tutor. Make sure the backend is running.', loading: false } : x))
    }
  }

  const dismiss = (id) => setAnswers(a => a.filter(x => x.id !== id))

  return (
    <aside className="tutor-side">
      <div className="tutor-side-head">
        <span className="tutor-eyebrow"><Icon name="sparkles" size={13} /> Ask the tutor</span>
      </div>
      <div className="tutor-side-body scroll" ref={bodyRef}>
        {answers.length === 0 ? (
          <div className="tutor-side-empty">
            <span className="tutor-empty-ic"><Icon name="sparkles" size={18} /></span>
            <div className="tutor-empty-t">Ask anything</div>
            <div className="tutor-empty-d">Get instant explanations, examples and summaries for this chapter.</div>
          </div>
        ) : (
          <div className="tutor-answers">
            {answers.map(ans => (
              <div key={ans.id} className="tutor-ans">
                <div className="tutor-ans-q">
                  <span className="tutor-ans-qmark"><Icon name="sparkles" size={12} /></span>
                  <span className="tutor-ans-qtext">{ans.q}</span>
                  <button className="tutor-ans-x" onClick={() => dismiss(ans.id)} title="Dismiss"><Icon name="x" size={14} /></button>
                </div>
                {ans.loading ? (
                  <div className="tutor-ans-loading">
                    <span className="tutor-dot" /><span className="tutor-dot" /><span className="tutor-dot" />
                    <span className="tutor-ans-thinking">Tutor is thinking…</span>
                  </div>
                ) : (
                  <div className="tutor-ans-body"><p className="tutor-p">{ans.a}</p></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="tutor-ask-wrap">
        <div className="tutor-ask">
          <span className="tutor-ask-sparkle"><Icon name="sparkles" size={13} /></span>
          <input placeholder="Ask the tutor anything…" value={draft}
            onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask() }} />
          <button onClick={ask}><Icon name="arrow-up" size={14} /></button>
        </div>
      </div>
    </aside>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TUTOR MODE — 2-column with breadcrumb navigation
// ════════════════════════════════════════════════════════════════════════════

function TutorBreadcrumb({ chapters, chapter, richData, currentSection, setCurrentSection, onChapterChange, prev, next, doneSections }) {
  const [open, setOpen] = useState(null) // 'ch' | 'sec' | null
  const sec = richData?.sections?.[currentSection]

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])
  const stop = e => e.stopPropagation()

  return (
    <div className="tutor-bc" onClick={stop}>
      <span className="tutor-bc-root">Class X {chapter?.subject}</span>
      <Icon name="chev" size={13} className="tutor-bc-sep" />

      <div className="tutor-bc-pick">
        <button className={`tutor-bc-btn ${open === 'ch' ? 'open' : ''}`} onClick={() => setOpen(open === 'ch' ? null : 'ch')}>
          <span className="tutor-bc-k">Ch {chapters.findIndex(c => c.id === chapter?.id) + 1}</span>
          <span className="tutor-bc-title">{chapter?.title}</span>
          <Icon name="chev-down" size={13} />
        </button>
        {open === 'ch' && (
          <div className="tutor-bc-menu scroll">
            <div className="tutor-bc-menu-lbl">All chapters</div>
            {chapters.map((c, ci) => (
              <button key={c.id} className={`tutor-bc-item ${c.id === chapter?.id ? 'on' : ''}`} onClick={() => { onChapterChange(c.id); setOpen(null) }}>
                <span className="tutor-bc-badge">{ci + 1}</span>
                <span className="tutor-bc-t">{c.title}</span>
                <span className="tutor-bc-count">{c.subtopic_count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Icon name="chev" size={13} className="tutor-bc-sep" />

      <div className="tutor-bc-pick">
        <button className={`tutor-bc-btn strong ${open === 'sec' ? 'open' : ''}`} onClick={() => setOpen(open === 'sec' ? null : 'sec')}>
          <span className="tutor-bc-k">§{sec?.id}</span>
          <span className="tutor-bc-title">{sec?.title}</span>
          <Icon name="chev-down" size={13} />
        </button>
        {open === 'sec' && (
          <div className="tutor-bc-menu scroll">
            <div className="tutor-bc-menu-lbl">Sections in {chapter?.title}</div>
            {richData?.sections?.map((s, si) => (
              <button key={s.id} className={`tutor-bc-item ${si === currentSection ? 'on' : ''}`} onClick={() => { setCurrentSection(si); setOpen(null) }}>
                <span className="tutor-bc-mark">
                  {si === currentSection ? <span className="tutor-bc-dot" />
                    : doneSections.includes(si) ? <span className="tutor-bc-dot done" />
                    : <span className="tutor-bc-ring" />}
                </span>
                <span className="tutor-bc-k mono">§{s.id}</span>
                <span className="tutor-bc-t">{s.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="tutor-bc-navs">
        <button className="tutor-bc-nav" onClick={prev.go} disabled={prev.disabled} title="Previous section">
          <Icon name="chev" size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button className="tutor-bc-nav" onClick={next.go} disabled={next.disabled} title="Next section">
          <Icon name="chev" size={16} />
        </button>
      </span>
    </div>
  )
}

const AddNoteBtn = ({ added, onClick }) => (
  <button className={`tutor-add ${added ? 'added' : ''}`} onClick={onClick}>
    {added ? <><Icon name="check" size={13} /> Saved</> : <><Icon name="plus" size={13} /> Add note</>}
  </button>
)

function TutorMode({ chapters, chapter, richData, currentSection, setCurrentSection, onChapterChange, doneSections, onMarkDone, prev, next }) {
  const sec = richData?.sections?.[currentSection]
  const [mode, setMode] = useState('medium')       // short | medium | long | notes
  const [cache, setCache] = useState({})            // key -> text
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState([])            // [{id, text}]
  const mainRef = useRef(null)

  const cacheKey = `${chapter?.id}-${currentSection}-${mode}`
  const cached = cache[cacheKey]
  const READ = { short: '1 min', medium: '3 min', long: '6 min', notes: 'Key points' }

  // Load saved notes for this section
  useEffect(() => {
    if (!chapter || !sec) return
    fetchTutorNotes(chapter.id, sec.id).then(setSaved)
  }, [chapter?.id, sec?.id])

  // Fetch AI content for current depth (skip if already cached)
  useEffect(() => {
    if (cached || !chapter || !sec) return
    setLoading(true)
    const sId = sec.id || String(currentSection)
    getCachedSummary(chapter.id, sId, mode).then(db => {
      if (db) { setCache(p => ({ ...p, [cacheKey]: db })); setLoading(false); return }
      fetch('/api/tutor-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_id: chapter.id, subtopic_id: sId, depth: mode }),
      })
        .then(r => { if (!r.ok) throw new Error('e'); return r.json() })
        .then(d => { const s = d.summary || ''; setCache(p => ({ ...p, [cacheKey]: s })); setLoading(false); saveSummaryCache(chapter.id, sId, mode, s) })
        .catch(() => { setCache(p => ({ ...p, [cacheKey]: `**${sec.title}** — summary unavailable. Switch to Book mode to read the textbook.` })); setLoading(false) })
    })
  }, [chapter?.id, currentSection, mode, cached])

  // Reset scroll on section change
  useEffect(() => { mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }, [currentSection, chapter?.id])

  const isSaved = (text) => saved.some(n => n.text === text)
  const toggleNote = (text) => {
    setSaved(s => {
      const nx = s.some(n => n.text === text) ? s.filter(n => n.text !== text) : [...s, { id: Date.now() + Math.random(), text }]
      if (chapter && sec) saveTutorNotes(chapter.id, sec.id, nx)
      return nx
    })
  }
  const removeNote = (id) => setSaved(s => {
    const nx = s.filter(n => n.id !== id)
    if (chapter && sec) saveTutorNotes(chapter.id, sec.id, nx)
    return nx
  })

  const isDone = doneSections.includes(currentSection)
  const blocks = useMemo(() => parseBlocks(cached || ''), [cached])

  // Notes view: parse grouped key points from cached notes-depth text
  const noteGroups = useMemo(() => {
    if (mode !== 'notes') return []
    const groups = []
    let cur = null
    for (const b of parseBlocks(cached || '')) {
      if (b.kind === 'h') { cur = { h: b.text, items: [] }; groups.push(cur) }
      else if (b.kind === 'list') { if (!cur) { cur = { h: 'Key points', items: [] }; groups.push(cur) } cur.items.push(...b.items) }
      else if (b.kind === 'p') { if (!cur) { cur = { h: 'Key points', items: [] }; groups.push(cur) } cur.items.push(b.text) }
    }
    return groups
  }, [cached, mode])

  return (
    <div className="tutor">
      <div className="tutor-main scroll" ref={mainRef}>
        <TutorBreadcrumb
          chapters={chapters} chapter={chapter} richData={richData}
          currentSection={currentSection} setCurrentSection={setCurrentSection}
          onChapterChange={onChapterChange} prev={prev} next={next} doneSections={doneSections}
        />

        <div className="tutor-col">
          <header className="tutor-head"><h1>{sec?.title}</h1></header>

          <div className="tutor-controls">
            <div className="tutor-seg">
              {['short', 'medium', 'long'].map(l => (
                <button key={l} className={mode === l ? 'on' : ''} onClick={() => setMode(l)}>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
            <button className={`tutor-notes-btn ${mode === 'notes' ? 'on' : ''}`} onClick={() => setMode('notes')}>
              <Icon name="note" size={13} /> Notes
              {saved.length > 0 && <span className="tutor-notes-count">{saved.length}</span>}
            </button>
            <span className="tb-spacer" />
            <div className="tutor-controls-end">
              <span className="tutor-readtime"><Icon name="clock" size={12} /> {READ[mode]}</span>
            </div>
          </div>

          <div key={`${chapter?.id}-${currentSection}-${mode}`} className="tutor-fade">
            {loading ? (
              <div className="tutor-ans-loading" style={{ padding: '20px 0' }}>
                <span className="tutor-dot" /><span className="tutor-dot" /><span className="tutor-dot" />
                <span className="tutor-ans-thinking">Tutor is preparing this…</span>
              </div>
            ) : mode === 'notes' ? (
              <div className="tutor-notes">
                <div className="tutor-note-grp">
                  <div className="tutor-note-h">My notes{saved.length ? ` · ${saved.length}` : ''}</div>
                  {saved.length === 0 ? (
                    <div className="tutor-empty">
                      <span className="tutor-empty-ic"><Icon name="note" size={20} /></span>
                      <div className="tutor-empty-t">No saved notes yet</div>
                      <div className="tutor-empty-d">While reading an explanation, hover a paragraph and hit <b>Add note</b> — it'll be saved here.</div>
                    </div>
                  ) : (
                    <div className="tutor-saved-list">
                      {saved.map(n => (
                        <div key={n.id} className="tutor-saved-item">
                          <p>{n.text}</p>
                          <button className="tutor-saved-x" onClick={() => removeNote(n.id)} title="Remove note"><Icon name="trash" size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="tutor-note-divider" />
                {noteGroups.map((g, i) => (
                  <div key={i} className="tutor-note-grp">
                    <div className="tutor-note-h">{g.h}</div>
                    <ul>{g.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>
                  </div>
                ))}
              </div>
            ) : (
              <article className="tutor-article">
                {blocks.map((b, i) => {
                  if (b.kind === 'h') return <h2 key={i} className="tutor-h2">{b.text}</h2>
                  if (b.kind === 'list') return (
                    <ul key={i} className="tutor-deflist">
                      {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
                    </ul>
                  )
                  return (
                    <div key={i} className="tutor-block">
                      <p className="tutor-p"><Inline text={b.text} /></p>
                      <AddNoteBtn added={isSaved(b.text)} onClick={() => toggleNote(b.text)} />
                    </div>
                  )
                })}
              </article>
            )}
          </div>
        </div>
      </div>

      {/* Floating advance panel */}
      {next && !next.disabled && (
        <div className={`tutor-advance-float ${isDone ? 'is-done' : ''}`} aria-label="Finish section">
          {isDone ? (
            <>
              <button className="tutor-advance-status" onClick={() => onMarkDone(currentSection, true)} title="Undo">
                <span className="tutor-advance-status-ic"><Icon name="check" size={11} /></span> Completed
              </button>
              <button className="tutor-advance-done" onClick={() => next.go()} title="Next section">
                <span>Move next</span><Icon name="arrow-right" size={13} />
              </button>
            </>
          ) : (
            <>
              <button className="tutor-advance-skip" onClick={() => next.go()} title="Skip">Move next</button>
              <button className="tutor-advance-done" onClick={() => { onMarkDone(currentSection); next.go() }} title="Mark complete & move next">
                <span className="tutor-advance-done-ic"><Icon name="check" size={11} /></span>
                <span>Mark Completed &amp; Move next</span>
              </button>
            </>
          )}
        </div>
      )}

      <AskPanel chapter={chapter} richData={richData} currentSection={currentSection} variant="tutor" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

export default function StudyView({ studyMode, chapterId, setChapterId }) {
  const [chapters, setChapters] = useState([])
  const [chapter, setChapter] = useState(null)
  const [richData, setRichData] = useState(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [doneSections, setDoneSections] = useState([])
  const [tocOpen, setTocOpen] = useState(true)
  const [tocHovered, setTocHovered] = useState(false)

  useEffect(() => {
    fetch('/api/chapters').then(r => r.json()).then(data => {
      setChapters(data)
      if (!chapterId && data.length) setChapterId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!chapterId) return
    setCurrentSection(0); setRichData(null); setChapter(null)
    setDoneSections(getDoneSections(chapterId))
    getDoneSectionsAsync(chapterId).then(setDoneSections)
    Promise.all([
      fetch(`/api/chapters/${chapterId}`).then(r => r.json()),
      fetch(`/api/chapters/${chapterId}/rich`).then(r => r.json()),
    ]).then(([ch, rich]) => {
      setChapter(ch); setRichData(rich)
      if (rich?.sections?.length) syncPlanCompletions(chapterId, rich.sections.length)
    }).catch(() => {})
  }, [chapterId])

  const handleMarkDone = (sectionIndex, undo = false) => {
    if (undo) {
      const next = doneSections.filter(s => s !== sectionIndex)
      setDoneSections(next)
      localStorage.setItem(`ch-${chapterId}-doneSections`, JSON.stringify(next))
      return
    }
    const updated = markSectionDone(chapterId, sectionIndex)
    setDoneSections([...updated])
    syncPlanCompletions(chapterId, richData?.sections?.length || 0)
  }

  const onChapterChange = (id) => setChapterId(id)

  // prev/next nav across sections (and chapters at boundaries)
  const sections = richData?.sections || []
  const chIdx = chapters.findIndex(c => c.id === chapter?.id)
  const prevChapter = chapters[chIdx - 1]
  const nextChapter = chapters[chIdx + 1]
  const prev = {
    disabled: currentSection === 0 && !prevChapter,
    go: () => { if (currentSection > 0) setCurrentSection(s => s - 1); else if (prevChapter) onChapterChange(prevChapter.id) },
  }
  const next = {
    disabled: currentSection >= sections.length - 1 && !nextChapter,
    go: () => { if (currentSection < sections.length - 1) setCurrentSection(s => s + 1); else if (nextChapter) onChapterChange(nextChapter.id) },
  }

  if (!chapter || !richData) {
    return <div className="study-loading">Loading chapter…</div>
  }

  // ─── BOOK MODE ───
  if (studyMode === 'book') {
    const isExpanded = tocOpen || tocHovered
    return (
      <div className={`reader ${isExpanded ? '' : 'reader-collapsed-toc'}`}>
        <div onMouseEnter={() => setTocHovered(true)} onMouseLeave={() => setTocHovered(false)}>
          <ReaderContents
            chapters={chapters} chapter={chapter} richData={richData}
            currentSection={currentSection} setCurrentSection={setCurrentSection}
            onChapterChange={onChapterChange}
            collapsed={!isExpanded} onToggle={() => setTocOpen(o => !o)} doneSections={doneSections}
          />
        </div>
        <ReaderBody chapter={chapter} richData={richData} currentSection={currentSection} />
        <ReaderSide chapter={chapter} richData={richData} currentSection={currentSection} />
      </div>
    )
  }

  // ─── TUTOR MODE ───
  return (
    <TutorMode
      chapters={chapters} chapter={chapter} richData={richData}
      currentSection={currentSection} setCurrentSection={setCurrentSection}
      onChapterChange={onChapterChange} doneSections={doneSections} onMarkDone={handleMarkDone}
      prev={prev} next={next}
    />
  )
}
