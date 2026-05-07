import { useState } from 'react'

function MCQQuestion({ mcq, index }) {
  const [selected, setSelected]   = useState(null)
  const [checked, setChecked]     = useState(false)

  const isCorrect = selected === mcq.answer
  return (
    <div style={{
      background: 'white', border: '1px solid var(--border)',
      borderRadius: 10, padding: 16, marginBottom: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
        Q{index + 1}. {mcq.question}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mcq.options.map((opt, i) => {
          const letter = ['a', 'b', 'c', 'd'][i]
          const isThis = selected === letter
          let bg = 'white', border = 'var(--border)', color = 'var(--text)'
          if (checked && isThis && isCorrect)  { bg = '#f0fdf4'; border = '#86efac'; color = '#15803d' }
          if (checked && isThis && !isCorrect) { bg = '#fef2f2'; border = '#fca5a5'; color = '#dc2626' }
          if (checked && letter === mcq.answer && !isCorrect) { bg = '#f0fdf4'; border = '#86efac' }

          return (
            <label key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8, cursor: checked ? 'default' : 'pointer',
              background: bg, border: `1px solid ${border}`, color, fontSize: 14,
              transition: 'all .15s',
            }}>
              <input
                type="radio" name={`mcq-${index}`} value={letter}
                disabled={checked}
                onChange={() => setSelected(letter)}
                style={{ accentColor: 'var(--primary)' }}
              />
              {opt}
            </label>
          )
        })}
      </div>
      {!checked && selected && (
        <button
          onClick={() => setChecked(true)}
          style={{
            marginTop: 10, background: 'var(--primary)', color: 'white',
            padding: '7px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
          }}
        >
          Check Answer
        </button>
      )}
      {checked && (
        <div style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 8,
          background: isCorrect ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${isCorrect ? '#86efac' : '#fca5a5'}`,
          fontSize: 13, color: isCorrect ? '#15803d' : '#dc2626',
        }}>
          {isCorrect ? '✅ Correct! ' : `❌ Incorrect. Correct answer: (${mcq.answer}) · `}
          {mcq.explanation}
        </div>
      )}
    </div>
  )
}

function ShortAnswer({ q, onSubmit, loading }) {
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)

  const handleSubmit = async () => {
    const result = await onSubmit(q.question, answer, q.sample_answer)
    setFeedback(result)
  }

  const ratingColor = { Excellent: '#15803d', Good: '#1d4ed8', 'Needs Improvement': '#d97706' }

  return (
    <div style={{
      background: 'white', border: '1px solid var(--border)',
      borderRadius: 10, padding: 16,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
        Short Answer: {q.question}
      </div>
      {!feedback ? (
        <>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Write your answer here..."
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)', fontSize: 14, resize: 'vertical',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !answer.trim()}
            style={{
              marginTop: 8, background: 'var(--primary)', color: 'white',
              padding: '7px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
              opacity: loading || !answer.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Evaluating...' : 'Submit Answer'}
          </button>
        </>
      ) : (
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: '#f8fafc', border: '1px solid var(--border)', fontSize: 14,
        }}>
          <div style={{
            fontWeight: 700, marginBottom: 6,
            color: ratingColor[feedback.rating] || '#1a202c',
          }}>
            {feedback.rating === 'Excellent' ? '🌟' : feedback.rating === 'Good' ? '👍' : '📚'} {feedback.rating}
          </div>
          <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>{feedback.feedback}</div>
        </div>
      )}
    </div>
  )
}

export default function PracticePanel({ data, subtopicTitle, onClose }) {
  const [evalLoading, setEvalLoading] = useState(false)

  const handleEval = async (question, answer, sampleAnswer) => {
    setEvalLoading(true)
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, student_answer: answer, sample_answer: sampleAnswer }),
      })
      return await res.json()
    } finally {
      setEvalLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--primary-light)', border: '1px solid #c7d2fe',
      borderRadius: 12, padding: 20, marginTop: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>
            🎯 Practice — {subtopicTitle}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            2 MCQs + 1 Short Answer
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: '#e0e7ff', color: 'var(--primary)', padding: '5px 12px', borderRadius: 8, fontSize: 13 }}
        >
          Close
        </button>
      </div>

      {/* MCQs */}
      {data.mcqs?.map((mcq, i) => <MCQQuestion key={i} mcq={mcq} index={i} />)}

      {/* Short Answer */}
      {data.short && (
        <ShortAnswer q={data.short} onSubmit={handleEval} loading={evalLoading} />
      )}
    </div>
  )
}
