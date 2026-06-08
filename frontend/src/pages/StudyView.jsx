import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import Icon from '../components/Icons'
import {
  getDoneSectionsAsync, markSectionDoneAsync, unmarkSectionDoneAsync,
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

function ReaderBody({ chapter, richData, currentSection, onAskAI }) {
  const sec = richData?.sections?.[currentSection]
  const artRef = useRef(null)
  const [sel, setSel] = useState(null)    // { text, x, top, bottom }

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
        setSel({ text: txt, x: r.left + r.width / 2, top: r.top, bottom: r.bottom })
      }, 10)
    }
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('.rb-sel-pop')) return
      setSel(null)
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('mouseup', onUp); document.removeEventListener('mousedown', onDown) }
  }, [])

  // Reset on section change
  useEffect(() => { setSel(null) }, [currentSection, chapter?.id])

  const handleAskAI = () => {
    if (!sel) return
    const text = sel.text
    setSel(null)
    window.getSelection()?.removeAllRanges()
    onAskAI?.({ text: 'Explain this from the textbook in simple terms: ' + text, id: Date.now() })
  }

  const handleExplain = () => {
    if (!sel) return
    const text = sel.text
    setSel(null)
    window.getSelection()?.removeAllRanges()
    onAskAI?.({ text: 'Give a detailed explanation of: ' + text, id: Date.now() })
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
            <button className="rb-sel-ai" onMouseDown={e => e.preventDefault()} onClick={handleAskAI}><Icon name="sparkles" size={13} /> Ask AI</button>
            <span className="rb-sel-div" />
            <button className="rb-sel-act" onMouseDown={e => e.preventDefault()} onClick={handleExplain}>Explain</button>
            <button className="rb-sel-act" onMouseDown={e => e.preventDefault()} onClick={noteSelection}><Icon name="note" size={12} /> Note</button>
          </div>
        )
      })()}
    </div>
  )
}

function ReaderSide({ chapter, richData, currentSection, triggerQuery }) {
  return <AskPanel chapter={chapter} richData={richData} currentSection={currentSection} variant="book" triggerQuery={triggerQuery} />
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED — Rich tutor answer ("Style F": key terms + vocab highlights + formula
//          chip + key-link callout). Falls back to plain text when no structure.
// ════════════════════════════════════════════════════════════════════════════

const TagIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><circle cx="7" cy="7" r="1.5" fill="currentColor" />
  </svg>
)
const DefIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" /><path d="M19 17H7" />
  </svg>
)
const MistakeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" />
  </svg>
)
const ExamIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />
  </svg>
)

// Typed callout config: definition (blue) · common mistake (amber) · exam tip (green)
const CALLOUT_CFG = {
  definition: { cls: 'def',     label: 'Definition',     Icon: DefIcon },
  mistake:    { cls: 'mistake', label: 'Common mistake', Icon: MistakeIcon },
  exam:       { cls: 'exam',    label: 'Exam tip',       Icon: ExamIcon },
}
const CALLOUT_ORDER = ['definition', 'mistake', 'exam']

function Callout({ type, text }) {
  const cfg = CALLOUT_CFG[type] || CALLOUT_CFG.exam
  const { Icon } = cfg
  return (
    <div className={`tutor-callout tutor-callout-${cfg.cls}`}>
      <span className="tutor-callout-ic"><Icon /></span>
      <span className="tutor-callout-text"><strong>{cfg.label}:</strong> {text}</span>
    </div>
  )
}

// Inline highlighted key term with a hover definition tooltip.
function TermSpan({ term, def }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="tutor-term-wrap">
      <span
        className="tutor-term"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >{term}</span>
      {open && def && (
        <span className="tutor-term-tip">{def}<span className="tutor-term-arrow" /></span>
      )}
    </span>
  )
}

// Split a paragraph into text + <TermSpan> nodes, wrapping every term occurrence.
// Longest terms first so e.g. "aerobic respiration" wins over "respiration".
function renderWithTerms(text, terms, keyPrefix) {
  const keys = Object.keys(terms || {}).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!keys.length) return text
  const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  return text.split(re).map((part, i) => (
    terms[part] !== undefined
      ? <TermSpan key={`${keyPrefix}-${i}`} term={part} def={terms[part]} />
      : <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
  ))
}

// One interactive MCQ: click an option → correct turns green, wrong turns red
// and the correct one is revealed, with an explanation below.
function QuizQuestion({ q, index }) {
  const [picked, setPicked] = useState(null)
  const answered = picked !== null
  const correct = answered && picked === q.answer

  return (
    <div className="tutor-quiz">
      <div className="tutor-quiz-q"><span className="tutor-quiz-num">Q{index + 1}</span> {q.question}</div>
      <div className="tutor-quiz-opts">
        {q.options.map((opt, oi) => {
          let state = ''
          if (answered) {
            if (oi === q.answer) state = ' correct'
            else if (oi === picked) state = ' wrong'
            else state = ' dim'
          }
          return (
            <button
              key={oi}
              className={`tutor-quiz-opt${state}`}
              disabled={answered}
              onClick={() => setPicked(oi)}
            >
              <span className="tutor-quiz-letter">{String.fromCharCode(65 + oi)}</span>
              <span className="tutor-quiz-opt-text">{opt}</span>
              {answered && oi === q.answer && <span className="tutor-quiz-mark"><Icon name="check" size={13} /></span>}
              {answered && oi === picked && oi !== q.answer && <span className="tutor-quiz-mark"><Icon name="x" size={13} /></span>}
            </button>
          )
        })}
      </div>
      {answered && (
        <div className={`tutor-quiz-fb ${correct ? 'right' : 'wrong'}`}>
          <strong>{correct ? 'Correct! ' : `Correct answer: ${String.fromCharCode(65 + q.answer)}. `}</strong>
          {q.explanation}
        </div>
      )}
    </div>
  )
}

function RichAnswer({ data }) {
  const { paragraphs = [], points = [], terms = {}, formula, steps, callouts, keyLink, quiz } = data || {}
  const termKeys = Object.keys(terms || {})

  // Interactive quiz answer
  if (Array.isArray(quiz) && quiz.length > 0) {
    return (
      <div className="tutor-rich">
        <div className="tutor-rich-body">
          {paragraphs.map((p, i) => (
            <p className="tutor-rich-p tutor-rich-intro" key={i}>{p}</p>
          ))}
          <div className="tutor-quiz-list">
            {quiz.map((q, i) => <QuizQuestion key={i} index={i} q={q} />)}
          </div>
        </div>
      </div>
    )
  }

  // Typed callouts (definition → mistake → exam). Fall back to a legacy keyLink.
  let calloutList = Array.isArray(callouts) ? callouts.slice() : []
  if (!calloutList.length && keyLink) calloutList = [{ type: 'exam', text: keyLink }]
  calloutList.sort((a, b) => CALLOUT_ORDER.indexOf(a.type) - CALLOUT_ORDER.indexOf(b.type))

  return (
    <div className="tutor-rich">
      {termKeys.length > 0 && (
        <div className="tutor-terms-row">
          <span className="tutor-terms-label">Key terms</span>
          {termKeys.map(t => (
            <span className="tutor-term-chip" key={t}><TagIcon />{t}</span>
          ))}
        </div>
      )}

      <div className="tutor-rich-body">
        {paragraphs.map((p, i) => (
          <p className="tutor-rich-p tutor-rich-intro" key={`p${i}`}>{renderWithTerms(p, terms, `p${i}`)}</p>
        ))}

        {points.length > 0 && (
          <ul className="tutor-points">
            {points.map((pt, i) => (
              <li className="tutor-point" key={i}>{renderWithTerms(pt, terms, `pt${i}`)}</li>
            ))}
          </ul>
        )}

        {formula && (
          <div className="tutor-formula-line">
            <span className="tutor-formula-chip">{formula}</span>
          </div>
        )}

        {Array.isArray(steps) && steps.length > 0 && (
          <div className="tutor-steps">
            {steps.map((s, i) => (
              <div className="tutor-step" key={i}>
                <span className="tutor-step-n">{i + 1}</span>
                <div className="tutor-step-body">
                  <span className="tutor-step-text">{s.text}</span>
                  {s.formula && <span className="tutor-formula-chip tutor-step-formula">{s.formula}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {calloutList.map((c, i) => (
          <Callout key={i} type={c.type} text={c.text} />
        ))}
      </div>
    </div>
  )
}

// One-tap follow-ups shown under each answer. `make` builds the next question,
// referencing the original so it works regardless of chat-history ordering.
const FOLLOWUPS = [
  { label: 'Explain simpler', make: q => `Regarding "${q}" — explain it again in a simpler way, using an everyday analogy a 15-year-old would get.` },
  { label: 'Give an example', make: q => `Give me one concrete real-world example related to: "${q}".` },
  { label: 'Quiz me',         action: 'quiz', make: q => `Quiz me on: "${q}"` },
  { label: 'Why it matters',  make: q => `Why does this matter and where is it used in real life or asked in exams, regarding "${q}"?` },
]

// ════════════════════════════════════════════════════════════════════════════
// SHARED — Ask the tutor panel
// ════════════════════════════════════════════════════════════════════════════

function AskPanel({ chapter, richData, currentSection, variant, triggerQuery }) {
  const [answers, setAnswers] = useState([])
  const [draft, setDraft] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [sessionId] = useState(() => `sv-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const bodyRef = useRef(null)
  const lastTriggerIdRef = useRef(null)
  const sec = richData?.sections?.[currentSection]

  const copyAnswer = async (ans) => {
    try { await navigator.clipboard.writeText(ans.a || '') } catch {}
    setCopiedId(ans.id)
    setTimeout(() => setCopiedId(c => (c === ans.id ? null : c)), 1500)
  }

  useEffect(() => { setAnswers([]) }, [currentSection, chapter?.id])
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }) }, [answers])

  const [flashing, setFlashing] = useState(false)

  // Fire query triggered from Ask AI / Explain buttons in Book mode
  useEffect(() => {
    if (!triggerQuery || triggerQuery.id === lastTriggerIdRef.current) return
    lastTriggerIdRef.current = triggerQuery.id
    setFlashing(true)
    setTimeout(() => setFlashing(false), 800)
    askQuestion(triggerQuery.text)
  }, [triggerQuery])

  const askQuestion = async (q, action = null) => {
    if (!q || !q.trim() || !chapter) return
    const id = Date.now() + Math.random()
    setAnswers(a => [...a, { id, q, a: '', loading: true }])
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, chapter_id: chapter.id, subtopic_id: sec?.id || '', message: q, action, history: [] }),
      })
      const data = await res.json()
      const reply = data.reply || data.response || 'No response.'
      const structured = data.structured || null
      setAnswers(a => a.map(x => x.id === id ? { ...x, a: reply, structured, loading: false } : x))
    } catch {
      setAnswers(a => a.map(x => x.id === id ? { ...x, a: 'Could not reach the tutor. Make sure the backend is running.', structured: null, loading: false } : x))
    }
  }

  const ask = async () => {
    const q = draft.trim()
    if (!q) return
    setDraft('')
    await askQuestion(q)
  }

  const dismiss = (id) => setAnswers(a => a.filter(x => x.id !== id))

  return (
    <aside className={`tutor-side${flashing ? ' tutor-side-flash' : ''}`}>
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
                  <>
                    <div className="tutor-ans-body">
                      {ans.structured
                        ? <RichAnswer data={ans.structured} />
                        : <p className="tutor-p">{ans.a}</p>}
                    </div>
                    <div className="tutor-ans-actions">
                      {FOLLOWUPS.map(f => (
                        <button key={f.label} className="tutor-chip" onClick={() => askQuestion(f.make(ans.q), f.action || null)}>
                          {f.label}
                        </button>
                      ))}
                      <button
                        className="tutor-chip tutor-chip-icon"
                        onClick={() => copyAnswer(ans)}
                        title="Copy answer"
                      >
                        <Icon name={copiedId === ans.id ? 'check' : 'note'} size={12} />
                        {copiedId === ans.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </>
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
// BOOK MODE WRAPPER — keeps triggerQuery state local so Ask AI / Explain
// in the body can fire into the right-side AskPanel
// ════════════════════════════════════════════════════════════════════════════

function BookModeWrapper({ chapters, chapter, richData, currentSection, setCurrentSection, onChapterChange, doneSections, tocOpen, setTocOpen, tocHovered, setTocHovered, isExpanded }) {
  const [triggerQuery, setTriggerQuery] = useState(null)

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
      <ReaderBody
        chapter={chapter} richData={richData} currentSection={currentSection}
        onAskAI={setTriggerQuery}
      />
      <ReaderSide
        chapter={chapter} richData={richData} currentSection={currentSection}
        triggerQuery={triggerQuery}
      />
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
    getDoneSectionsAsync(chapterId).then(setDoneSections)
    Promise.all([
      fetch(`/api/chapters/${chapterId}`).then(r => r.json()),
      fetch(`/api/chapters/${chapterId}/rich`).then(r => r.json()),
    ]).then(([ch, rich]) => {
      setChapter(ch); setRichData(rich)
    }).catch(() => {})
  }, [chapterId])

  const handleMarkDone = (sectionIndex, undo = false) => {
    if (undo) {
      setDoneSections(prev => prev.filter(s => s !== sectionIndex))
      unmarkSectionDoneAsync(chapterId, sectionIndex)
      return
    }
    setDoneSections(prev => prev.includes(sectionIndex) ? prev : [...prev, sectionIndex])
    markSectionDoneAsync(chapterId, sectionIndex)
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
      <BookModeWrapper
        chapters={chapters} chapter={chapter} richData={richData}
        currentSection={currentSection} setCurrentSection={setCurrentSection}
        onChapterChange={onChapterChange} doneSections={doneSections}
        tocOpen={tocOpen} setTocOpen={setTocOpen}
        tocHovered={tocHovered} setTocHovered={setTocHovered}
        isExpanded={isExpanded}
      />
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
