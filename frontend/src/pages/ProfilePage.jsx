import { useState, useEffect } from 'react'
import Icon from '../components/Icons'
import { fetchProfileData } from '../lib/userdata'
import './ProfilePage.css'

const PACE_LABEL = { relaxed: 'Relaxed', balanced: 'Balanced', intense: 'Intense' }

// The app's two top-level subjects. "Science" spans the granular science subjects.
const SCIENCE_SUBJECTS = new Set(['Chemistry', 'Physics', 'Biology', 'Environmental Science'])

// Average minutes spent per completed section (used to estimate study time)
const MIN_PER_SECTION = 7

// Consecutive-day streak ending today (or yesterday) from activity timestamps.
function computeStreak(isoStrings) {
  const days = new Set(isoStrings.map(s => (s || '').slice(0, 10)).filter(Boolean))
  if (!days.size) return 0
  const fmt = d => d.toISOString().slice(0, 10)
  const cur = new Date()
  if (!days.has(fmt(cur))) {
    cur.setDate(cur.getDate() - 1)
    if (!days.has(fmt(cur))) return 0
  }
  let streak = 0
  while (days.has(fmt(cur))) { streak++; cur.setDate(cur.getDate() - 1) }
  return streak
}

/**
 * Full profile view — opened from the top-right name dropdown.
 * Identity + About fields come from the real Supabase `user_profiles` row
 * (collected during onboarding); edits persist via onSaveProfile.
 * Stats + per-subject progress are computed live from section_completion + notes.
 */
export default function ProfilePage({ profile, onSaveProfile }) {
  const name  = profile?.name  || 'Student'
  const cls   = profile?.cls   || 'X'
  const board = profile?.board || 'CBSE'
  const school = profile?.school || ''
  const pace  = profile?.pace  || 'balanced'

  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [draft, setDraft]     = useState({})

  // Live analytics
  const [loaded, setLoaded]   = useState(false)
  const [stats, setStats]     = useState({ streak: 0, sectionsDone: 0, studyHours: '0h', notesTaken: 0 })
  const [subjects, setSubjects] = useState([])

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/chapters').then(r => r.json()).catch(() => []),
      fetchProfileData(),
    ]).then(([chapters, { completions, notes }]) => {
      if (!alive) return

      // ── Stats ──
      const sectionsDone = completions.length
      let notesTaken = 0
      for (const n of notes) {
        if (typeof n.section_id === 'string' && n.section_id.startsWith('_t:')) {
          try { const arr = JSON.parse(n.content); if (Array.isArray(arr)) notesTaken += arr.length } catch {}
        } else if (n.content && String(n.content).trim()) {
          notesTaken += 1
        }
      }
      const minutes = sectionsDone * MIN_PER_SECTION
      const studyHours = minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${minutes}m`
      const streak = computeStreak([
        ...completions.map(c => c.created_at),
        ...notes.map(n => n.created_at),
      ])
      setStats({ streak, sectionsDone, studyHours, notesTaken })

      // ── Per-subject progress (chapters done / total) ──
      const doneByChapter = {}
      for (const c of completions) doneByChapter[c.chapter_id] = (doneByChapter[c.chapter_id] || 0) + 1
      const totalFor = (chId, apiCount) => {
        const stored = parseInt(localStorage.getItem(`ch-${chId}-totalSections`) || '0', 10)
        return stored > 0 ? stored : apiCount
      }
      const chapterDone = (ch) => {
        const done = doneByChapter[ch.id] || 0
        const total = totalFor(ch.id, ch.section_count)
        return total > 0 && done >= total
      }
      const groups = [
        { id: 'sci', label: 'Science', color: 'var(--sci)', list: chapters.filter(c => SCIENCE_SUBJECTS.has(c.subject)) },
        { id: 'eng', label: 'English', color: 'var(--eng)', list: chapters.filter(c => c.subject === 'English') },
      ]
      setSubjects(groups.map(g => {
        const total = g.list.length
        const done = g.list.filter(chapterDone).length
        return { id: g.id, label: g.label, color: g.color, total, done, pct: total ? Math.round(done / total * 100) : 0 }
      }))

      setLoaded(true)
    })
    return () => { alive = false }
  }, [])

  const startEdit = () => { setDraft({ name, cls, board, school, pace }); setEditing(true) }
  const cancelEdit = () => setEditing(false)
  const saveEdit = async () => {
    setSaving(true)
    const next = {
      ...profile,
      name:  draft.name?.trim()  || name,
      cls:   draft.cls?.trim()   || cls,
      board: draft.board?.trim() || board,
      school: draft.school?.trim() ?? school,
      pace:  draft.pace || pace,
    }
    try { await onSaveProfile?.(next) } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const initial = name.charAt(0).toUpperCase()
  const dash = (v) => loaded ? v : '—'

  const STAT_CARDS = [
    { label: 'Day streak',    value: dash(stats.streak),       color: 'var(--green)', icon: 'flame' },
    { label: 'Sections done', value: dash(stats.sectionsDone), color: 'var(--eng)',   icon: 'check' },
    { label: 'Study time',    value: dash(stats.studyHours),   color: 'var(--math)',  icon: 'clock' },
    { label: 'Notes taken',   value: dash(stats.notesTaken),   color: 'var(--soc)',   icon: 'note' },
  ]

  const fields = [
    { label: 'Full name',  key: 'name',   value: name },
    { label: 'Class',      key: 'cls',    value: `Class ${cls}` },
    { label: 'Board',      key: 'board',  value: board },
    { label: 'School',     key: 'school', value: school || '—' },
    { label: 'Study pace', key: 'pace',   value: PACE_LABEL[pace] || pace, options: ['relaxed', 'balanced', 'intense'] },
  ]

  return (
    <div className="profile-page scroll">
      {/* ── Header ── */}
      <div className="pp-header">
        <div className="pp-avatar-wrap">
          <div className="pp-avatar">{initial}</div>
          <div className="pp-avatar-ring" />
        </div>
        <div className="pp-identity">
          <h1 className="pp-name">{name}</h1>
          <p className="pp-meta">Class {cls} · {board}{school ? ` · ${school}` : ''}</p>
        </div>
        <div className="pp-header-actions">
          {editing ? (
            <>
              <button className="pp-btn-ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button className="pp-btn-primary" onClick={saveEdit} disabled={saving}>
                <Icon name="check" size={13} /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <button className="pp-btn-secondary" onClick={startEdit}>
              <Icon name="pencil" size={13} /> Edit profile
            </button>
          )}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="pp-stats">
        {STAT_CARDS.map(s => (
          <div className="pp-stat" key={s.label}>
            <div className="pp-stat-icon" style={{ background: `color-mix(in oklab, ${s.color} 14%, var(--card))`, color: s.color }}>
              <Icon name={s.icon} size={16} />
            </div>
            <div className="pp-stat-body">
              <div className="pp-stat-val">{s.value}</div>
              <div className="pp-stat-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="pp-body">
        {/* ── About ── */}
        <section className="pp-card">
          <div className="pp-card-head"><h2>About</h2></div>
          <div className="pp-fields">
            {fields.map(f => (
              <div className="pp-field" key={f.key}>
                <label className="pp-field-label">{f.label}</label>
                {editing ? (
                  f.options ? (
                    <select
                      className="pp-field-input"
                      value={draft[f.key] ?? ''}
                      onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                    >
                      {f.options.map(o => <option key={o} value={o}>{PACE_LABEL[o] || o}</option>)}
                    </select>
                  ) : (
                    <input
                      className="pp-field-input"
                      value={draft[f.key] ?? ''}
                      onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )
                ) : (
                  <div className="pp-field-value">{f.value}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Subjects ── */}
        <section className="pp-card">
          <div className="pp-card-head"><h2>Enrolled subjects</h2></div>
          <div className="pp-subjects">
            {!loaded && <div className="pp-subj-empty">Loading progress…</div>}
            {loaded && subjects.map(s => (
              <div className="pp-subj" key={s.id}>
                <div className="pp-subj-dot" style={{ background: s.color }} />
                <div className="pp-subj-body">
                  <div className="pp-subj-top">
                    <span className="pp-subj-name">{s.label}</span>
                    <span className="pp-subj-pct" style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                  <div className="pp-subj-bar-track">
                    <div className="pp-subj-bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                  <div className="pp-subj-cap">{s.done} of {s.total} chapters done</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
