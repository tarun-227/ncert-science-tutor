import { useState } from 'react'
import PracticePanel from './PracticePanel'

const ACTION_CONFIGS = {
  explain:  { label: 'Explain',       icon: '💡', color: '#4f46e5', bg: '#eef2ff' },
  simplify: { label: 'Simplify',      icon: '🧩', color: '#059669', bg: '#f0fdf4' },
  example:  { label: 'Give Example',  icon: '🌍', color: '#d97706', bg: '#fff7ed' },
  test:     { label: 'Test Me',       icon: '📝', color: '#7c3aed', bg: '#faf5ff' },
}

function ActionButton({ type, onClick, disabled }) {
  const cfg = ACTION_CONFIGS[type]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}22`,
        padding: '7px 14px', borderRadius: 20,
        fontSize: 13, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = cfg.color + '33')}
      onMouseLeave={e => !disabled && (e.currentTarget.style.background = cfg.bg)}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </button>
  )
}

export default function SubtopicBlock({ subtopic, sectionTitle, onAction }) {
  const [practiceData, setPracticeData] = useState(null)
  const [practiceLoading, setPracticeLoading] = useState(false)

  const handleTestMe = async () => {
    onAction(null, subtopic)  // update current subtopic context
    setPracticeLoading(true)
    try {
      const res = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_id: subtopic._chapterId, subtopic_id: subtopic.id }),
      })
      const data = await res.json()
      setPracticeData(data)
    } catch (e) {
      alert('Could not generate practice questions: ' + e.message)
    } finally {
      setPracticeLoading(false)
    }
  }

  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 16,
      boxShadow: 'var(--shadow)',
    }}>
      {/* Subtopic header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>
          {subtopic.id} · {sectionTitle}
        </div>
        <h3 style={{ fontSize: 19, fontWeight: 700, color: '#1a202c', lineHeight: 1.3 }}>
          {subtopic.title}
        </h3>
      </div>

      {/* Content */}
      {subtopic.content && (
        <p style={{
          fontSize: 15, lineHeight: 1.7, color: '#334155',
          marginBottom: 16, whiteSpace: 'pre-wrap',
        }}>
          {subtopic.content}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton type="explain"  onClick={() => onAction('explain',  subtopic)} />
        <ActionButton type="simplify" onClick={() => onAction('simplify', subtopic)} />
        <ActionButton type="example"  onClick={() => onAction('example',  subtopic)} />
        <ActionButton type="test"     onClick={handleTestMe} disabled={practiceLoading} />
        {practiceLoading && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
            Generating practice...
          </span>
        )}
      </div>

      {/* Practice panel appears inline */}
      {practiceData && (
        <PracticePanel
          data={practiceData}
          subtopicTitle={subtopic.title}
          onClose={() => setPracticeData(null)}
        />
      )}
    </div>
  )
}
