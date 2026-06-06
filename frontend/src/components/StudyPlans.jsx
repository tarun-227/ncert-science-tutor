import { useState, useEffect } from 'react'
import Icon from './Icons'
import {
  loadPlansAsync, loadPlansLocal,
  upsertPlanAsync, deletePlanAsync,
  chapterMinutes, getDoneSectionsLocal, isChapterComplete,
} from '../lib/studyPlanStore'
import './StudyPlans.css'

// ─── StartModal — "Where do you want to start?" ──────────────

function StartModal({ plan, chapters, onClose, onStart }) {
  // Group by subject
  const subjectGroups = plan.selections.map(sel => {
    const chaps = sel.chapterIds.map(id => chapters.find(c => c.id === id)).filter(Boolean)
    const done = chaps.filter(c => (plan.doneChapterIds || []).includes(c.id)).length
    return { subject: sel.subject, chapters: chaps, done, total: chaps.length }
  })

  return (
    <div className="start-backdrop" onClick={onClose}>
      <div className="start-modal" onClick={e => e.stopPropagation()}>
        <button className="pm-close" onClick={onClose}>
          <Icon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} />
        </button>
        <div className="start-header">
          <div className="start-eyebrow">{plan.name}</div>
          <h3>Where do you want to start?</h3>
        </div>
        <div className="start-list">
          {subjectGroups.map(sg => (
            <button
              key={sg.subject}
              className="start-subj"
              onClick={() => {
                // Find first incomplete chapter in this subject
                const sel = plan.selections.find(s => s.subject === sg.subject)
                const firstIncomplete = sel.chapterIds.find(id => !(plan.doneChapterIds || []).includes(id))
                onStart(firstIncomplete || sel.chapterIds[0])
                onClose()
              }}
            >
              <span className="start-subj-dot" />
              <div className="start-subj-text">
                <b>{sg.subject}</b>
                <span className="muted small">{sg.done}/{sg.total} chapters done</span>
              </div>
              <span className="start-subj-arr"><Icon name="arrow-right" size={14} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PlanCard — single study plan ────────────────────────────

function PlanCard({ plan, chapters, onDelete, onEdit, onStart }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showStart, setShowStart] = useState(false)

  const allChapterIds = plan.selections.flatMap(s => s.chapterIds)
  const planChapters = allChapterIds.map(id => chapters.find(c => c.id === id)).filter(Boolean)
  const totalChapters = planChapters.length
  const totalMinutes = planChapters.reduce((a, c) => a + chapterMinutes(c), 0)

  // Compute completed chapters live from section_completion (localStorage + Supabase cache)
  const doneIds = planChapters
    .filter(ch => isChapterComplete(ch.id, ch.subtopic_count || 0))
    .map(ch => ch.id)
  const chaptersDone = doneIds.length
  const doneMinutes = planChapters.filter(c => doneIds.includes(c.id)).reduce((a, c) => a + chapterMinutes(c), 0)
  const pendingMinutes = totalMinutes - doneMinutes
  const pctDone = totalMinutes ? Math.round(doneMinutes / totalMinutes * 100) : 0

  // Days math
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(plan.target)
  const created = new Date(plan.createdAt || plan.target)
  const daysTotal = Math.max(1, Math.ceil((target - created) / 86400000))
  const daysLeft = Math.max(0, Math.ceil((target - today) / 86400000))
  const daysIn = Math.max(0, daysTotal - daysLeft)

  // Status
  const expectedPct = daysTotal ? Math.round(daysIn / daysTotal * 100) : 0
  const ratio = expectedPct > 0 ? pctDone / expectedPct : (pctDone > 0 ? 2 : 1)
  const status = pctDone >= 100 ? 'done' : ratio >= 1.0 ? 'ahead' : ratio >= 0.85 ? 'ontrack' : 'behind'

  const dateStr = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const subjects = [...new Set(plan.selections.map(s => s.subject))]

  const cta = chaptersDone === 0
    ? { label: 'Start learning', icon: 'play' }
    : pctDone >= 100
    ? { label: 'Review plan', icon: 'check-circle' }
    : { label: 'Resume learning', icon: 'play' }

  return (
    <div className="splan">
      <div className="splan-stripe">
        {subjects.map(s => <span key={s} className={`splan-stripe-seg`} />)}
      </div>

      <div className="splan-head">
        <div className="splan-title">
          <h4>{plan.name}</h4>
          <div className="muted small">{totalChapters} chapters &middot; {subjects.join(', ')}</div>
        </div>
        <div className="splan-head-actions">
          <button className="splan-edit" onClick={() => onEdit(plan)} title="Edit plan">
            <Icon name="edit-square" size={14} />
          </button>
          <button className="splan-edit" onClick={() => setConfirmDelete(true)} title="Delete plan">
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>

      <div className="splan-stats">
        <div className="splan-stat-item">
          <span className="splan-stat-ic"><Icon name="clock" size={13} /></span>
          <div className="splan-stat-text">
            <b>{(totalMinutes / 60).toFixed(1)}<span className="splan-stat-unit"> Hrs</span></b>
            {doneMinutes > 0 && <span className="muted small">({(pendingMinutes / 60).toFixed(1)}h left)</span>}
          </div>
        </div>
        <div className="splan-stat-item">
          <span className="splan-stat-ic"><Icon name="calendar" size={13} /></span>
          <div className="splan-stat-text">
            <b>{daysLeft}<span className="splan-stat-unit"> days left</span></b>
            <span className="muted small">{dateStr}</span>
          </div>
        </div>
      </div>

      <div className="splan-progress">
        <div className="splan-bar">
          <div className="splan-bar-fill" style={{ width: `${pctDone}%` }} />
        </div>
        <div className="splan-bar-label">
          <span><b>{chaptersDone}</b> of <b>{totalChapters}</b> chapters done</span>
          <span className="muted">{pctDone}%</span>
        </div>
      </div>

      <div className="splan-foot">
        <span className={`splan-status ${status}`}>
          <Icon name={status === 'done' ? 'trophy' : status === 'ahead' ? 'sparkles' : status === 'ontrack' ? 'check-circle' : 'flame'} size={11} />
          {status === 'done' ? 'Completed' : status === 'ahead' ? 'Ahead' : status === 'ontrack' ? 'On track' : 'Behind pace'}
        </span>
        <button className="splan-cta" onClick={() => setShowStart(true)}>
          <Icon name={cta.icon} size={11} /> {cta.label}
        </button>
      </div>

      {showStart && (
        <StartModal
          plan={{ ...plan, doneChapterIds: doneIds }}
          chapters={chapters}
          onClose={() => setShowStart(false)}
          onStart={onStart}
        />
      )}

      {confirmDelete && (
        <div className="del-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="del-modal" onClick={e => e.stopPropagation()}>
            <div className="del-icon"><Icon name="trash" size={20} /></div>
            <h3>Delete this study plan?</h3>
            <p><b>{plan.name}</b> — this can't be undone.</p>
            <div className="del-actions">
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="del-yes" onClick={() => onDelete(plan.id)}>
                <Icon name="trash" size={12} /> Delete plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PlanModal — create / edit ───────────────────────────────

function PlanModal({ onClose, onCreate, initial, chapters, planNumber }) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name || `Plan ${planNumber}`)
  const [selections, setSelections] = useState(initial?.selections || [])
  const [target, setTarget] = useState(() => {
    if (initial?.target) return initial.target
    const d = new Date(); d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  })
  const [hours, setHours] = useState(initial?.hoursPerDay || 1.5)
  const [hoursDirty, setHoursDirty] = useState(!!initial)
  const [expandedSubject, setExpandedSubject] = useState(null)

  // Group chapters by subject
  const subjects = [...new Set(chapters.map(c => c.subject))]

  const toggleChapter = (chId) => {
    const ch = chapters.find(c => c.id === chId)
    if (!ch) return
    setSelections(prev => {
      const sel = prev.find(s => s.subject === ch.subject)
      if (sel) {
        const has = sel.chapterIds.includes(chId)
        const newIds = has ? sel.chapterIds.filter(id => id !== chId) : [...sel.chapterIds, chId]
        if (newIds.length === 0) return prev.filter(s => s.subject !== ch.subject)
        return prev.map(s => s.subject === ch.subject ? { ...s, chapterIds: newIds } : s)
      }
      return [...prev, { subject: ch.subject, chapterIds: [chId] }]
    })
  }

  const selectAllForSubject = (subject) => {
    const subjectChapters = chapters.filter(c => c.subject === subject)
    setSelections(prev => {
      const sel = prev.find(s => s.subject === subject)
      if (sel && sel.chapterIds.length === subjectChapters.length) {
        return prev.filter(s => s.subject !== subject)
      }
      const allIds = subjectChapters.map(c => c.id)
      const existing = prev.filter(s => s.subject !== subject)
      return [...existing, { subject, chapterIds: allIds }]
    })
  }

  const totalChapters = selections.reduce((a, s) => a + s.chapterIds.length, 0)
  const totalMinutes = selections.reduce((a, sel) =>
    a + sel.chapterIds.reduce((b, id) => {
      const ch = chapters.find(c => c.id === id)
      return b + (ch ? chapterMinutes(ch) : 30)
    }, 0), 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(target)
  const daysAvail = Math.max(1, Math.ceil((targetDate - today) / 86400000))
  const hoursNeeded = (totalMinutes / 60 / daysAvail).toFixed(1)

  // Auto-preset hours/day
  useEffect(() => {
    if (hoursDirty || totalChapters === 0) return
    const rounded = Math.max(0.5, Math.ceil(+hoursNeeded * 2) / 2)
    if (rounded !== hours) setHours(rounded)
  }, [totalMinutes, daysAvail, hoursDirty, totalChapters])

  const submit = () => {
    if (!totalChapters) return
    onCreate({
      id: initial?.id || `p${Date.now()}`,
      name: name.trim() || `Plan ${planNumber}`,
      selections,
      hoursPerDay: hours,
      target,
      createdAt: initial?.createdAt || new Date().toISOString().slice(0, 10),
    })
  }

  // Close on Esc
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="pm-backdrop" onClick={onClose}>
      <div className="pm-modal" onClick={e => e.stopPropagation()}>
        <header className="pm-header">
          <div className="pm-header-text">
            <div className="pm-header-meta">Class X &middot; Plan {planNumber}</div>
          </div>
          <div className="pm-header-actions">
            {isEdit && <span className="pm-mode-pill"><Icon name="edit-square" size={11} /> Edit mode</span>}
            <button className="pm-close" onClick={onClose}>
              <Icon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} />
            </button>
          </div>
        </header>

        <div className="pm-body scroll">
          {/* Step 1 — Name */}
          <section className="pm-section">
            <div className="pm-section-h split">
              <div className="pm-section-h-left">
                <span className="pm-step">1</span>
                <div>
                  <h3>Plan Name</h3>
                  <p className="muted small">Ex: Board prep, Term test</p>
                </div>
              </div>
              <div className="pm-name-wrap">
                <input
                  className="pm-name"
                  type="text"
                  value={name}
                  placeholder={`Plan ${planNumber}`}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Step 2 — Choose chapters */}
          <section className="pm-section">
            <div className="pm-section-h">
              <span className="pm-step">2</span>
              <div className="pm-section-h-titles">
                <h3>Choose Chapters</h3>
                <p className="muted small">Tap a subject, then tick the chapters you want to cover.</p>
              </div>
              {totalChapters > 0 && (
                <span className="pm-section-count"><b>{totalChapters}</b> selected</span>
              )}
            </div>

            <div className="pm-chooser">
              <div className="pm-subj-tabs">
                {subjects.map(subj => {
                  const sel = selections.find(s => s.subject === subj)
                  const picked = sel?.chapterIds.length || 0
                  const total = chapters.filter(c => c.subject === subj).length
                  const isActive = expandedSubject === subj
                  return (
                    <button
                      key={subj}
                      className={`pm-tab ${isActive ? 'on' : ''} ${sel ? 'has' : ''}`}
                      onClick={() => setExpandedSubject(subj)}
                    >
                      <span className="pm-tab-name">{subj}</span>
                      <span className={`pm-tab-count ${picked > 0 ? 'on' : ''}`}>{picked}/{total}</span>
                    </button>
                  )
                })}
              </div>

              {expandedSubject && (() => {
                const subjectChapters = chapters.filter(c => c.subject === expandedSubject)
                const sel = selections.find(s => s.subject === expandedSubject) || { chapterIds: [] }
                const allPicked = sel.chapterIds.length === subjectChapters.length
                return (
                  <div className="pm-pane">
                    <div className="pm-pane-head">
                      <div className="pm-pane-title">
                        <b>{expandedSubject}</b>
                        <span className="muted small">&middot; {subjectChapters.length} chapters</span>
                      </div>
                      <button className="pm-pick-all" onClick={() => selectAllForSubject(expandedSubject)}>
                        <span className={`pm-check ${allPicked ? 'on' : ''}`}>
                          {allPicked ? <Icon name="check" size={10} /> : null}
                        </span>
                        <span>{allPicked ? 'Clear all' : 'Select all'}</span>
                      </button>
                    </div>
                    <div className="pm-ch-grid">
                      {subjectChapters.map((ch, i) => {
                        const checked = sel.chapterIds.includes(ch.id)
                        const mins = chapterMinutes(ch)
                        return (
                          <div
                            key={ch.id}
                            className={`pm-ch ${checked ? 'on' : ''}`}
                            onClick={() => toggleChapter(ch.id)}
                          >
                            <span className={`pm-check ${checked ? 'on' : ''}`}>
                              {checked ? <Icon name="check" size={10} /> : null}
                            </span>
                            <span className="pm-ch-num">{String(i + 1).padStart(2, '0')}</span>
                            <span className="pm-ch-name">{ch.title}</span>
                            <span className="pm-ch-mins">~{mins}m</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </section>

          {/* Step 3 — Target date */}
          <section className="pm-section">
            <div className="pm-section-h split">
              <div className="pm-section-h-left middle">
                <span className="pm-step">3</span>
                <div><h3>Set Target</h3></div>
              </div>
              <div className="pm-date-wrap">
                <input
                  type="date"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  className="pm-date"
                />
              </div>
            </div>
          </section>

          {/* Step 4 — Hours per day */}
          <section className="pm-section">
            <div className="pm-section-h split">
              <div className="pm-section-h-left middle">
                <span className="pm-step">4</span>
                <div><h3>Hours per day</h3></div>
              </div>
              <div className="pm-hours-wrap">
                <div className="splan-stepper">
                  <button onClick={() => { setHours(Math.max(0.5, hours - 0.5)); setHoursDirty(true) }}>−</button>
                  <input
                    value={hours}
                    onChange={e => { setHours(+e.target.value || 0.5); setHoursDirty(true) }}
                    type="number" step="0.5" min="0.5"
                  />
                  <span className="splan-stepper-unit">h</span>
                  <button onClick={() => { setHours(hours + 0.5); setHoursDirty(true) }}>+</button>
                </div>
              </div>
            </div>
            {totalChapters > 0 && (
              <div className="pm-reco">
                <Icon name="sparkles" size={13} />
                <div>
                  <b>~{hoursNeeded}h/day recommended</b>
                  <span className="muted small"> to cover {totalChapters} chapters (~{(totalMinutes / 60).toFixed(1)}h) in {daysAvail} days</span>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="pm-footer">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn green" onClick={submit} disabled={!totalChapters}>
            <Icon name={isEdit ? 'check' : 'plus'} size={13} /> {isEdit ? 'Save changes' : 'Create plan'}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ─── StudyPlansSection — dashboard widget ────────────────────

export default function StudyPlansSection({ chapters, onOpenChapter }) {
  const [plans, setPlans] = useState(() => loadPlansLocal())
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  // Load from Supabase on mount
  useEffect(() => {
    loadPlansAsync().then(setPlans)
  }, [])

  const handleCreate = async (plan) => {
    const updated = await upsertPlanAsync(plan)
    setPlans(updated)
    setShowModal(false)
    setEditing(null)
  }

  const handleDelete = async (planId) => {
    const updated = await deletePlanAsync(planId)
    setPlans(updated)
  }

  const handleEdit = (plan) => {
    setEditing(plan)
    setShowModal(true)
  }

  const handleStart = (chapterId) => {
    if (onOpenChapter) onOpenChapter(chapterId)
  }

  return (
    <section className="splans">
      <div className="sec-title">
        <div>
          <h2>Plans</h2>
          <span className="sub">Pick chapters, set a target — stay on pace</span>
        </div>
        <button className="btn green" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Icon name="plus" size={13} /> New plan
        </button>
      </div>

      {plans.length > 0 ? (
        <div className="splans-grid">
          {plans.map(p => (
            <PlanCard
              key={p.id}
              plan={p}
              chapters={chapters}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onStart={handleStart}
            />
          ))}
        </div>
      ) : (
        <div className="splans-empty">
          <Icon name="calendar" size={24} />
          <p>No study plans yet. Create one to track your progress.</p>
        </div>
      )}

      {showModal && (
        <PlanModal
          onClose={() => { setShowModal(false); setEditing(null) }}
          onCreate={handleCreate}
          initial={editing}
          chapters={chapters}
          planNumber={editing ? plans.findIndex(p => p.id === editing.id) + 1 : plans.length + 1}
        />
      )}
    </section>
  )
}
