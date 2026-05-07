import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'

function matchAnswerIndex(exercise) {
  if (!exercise.answer || !exercise.options) return -1
  const norm = s => String(s).trim().toLowerCase().replace(/[()\s.]/g, '')
  const answerKey = norm(exercise.answer)
  if (!answerKey) return -1
  for (let i = 0; i < exercise.options.length; i++) {
    const opt = norm(exercise.options[i])
    if (opt.startsWith(answerKey)) return i
  }
  return -1
}

function MCQExercise({ exercise, index, chapterId }) {
  const [selected, setSelected]       = useState(null)
  const [revealed, setRevealed]       = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [loadingEx, setLoadingEx]     = useState(false)

  const correctIdx = useMemo(() => matchAnswerIndex(exercise), [exercise])

  const loadExplanation = async () => {
    if (explanation) return
    setLoadingEx(true)
    try {
      const res = await fetch('/api/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_id: chapterId, ex_id: exercise.id }),
      })
      const data = await res.json()
      setExplanation(data.response || (data.steps || []).join('\n\n') || 'No explanation available.')
    } catch (e) {
      setExplanation('Error loading explanation: ' + e.message)
    } finally {
      setLoadingEx(false)
    }
  }

  const handleReveal = () => {
    setRevealed(true)
    loadExplanation()
  }

  const isCorrect = selected === correctIdx

  return (
    <div style={{
      marginBottom: 20,
      border: '1.5px solid var(--bg3)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
      background: 'var(--surface)',
    }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
          color: 'var(--ink3)', marginBottom: 8, letterSpacing: '0.04em',
        }}>
          Q{index + 1}
        </div>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6,
          color: 'var(--ink)', marginBottom: 14,
        }}>
          {exercise.question}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(exercise.options || []).map((opt, oi) => {
            const isSel = selected === oi
            const isCor = oi === correctIdx
            let bg = 'transparent'
            let border = 'var(--bg3)'
            let color = 'var(--ink2)'
            if (revealed) {
              if (isCor) {
                bg = 'var(--green-light)'; border = 'var(--green-border)'; color = 'var(--green)'
              } else if (isSel && !isCor) {
                bg = '#FEF2F2'; border = '#FECACA'; color = '#991B1B'
              }
            } else if (isSel) {
              bg = 'var(--purple-light)'; border = 'var(--purple-border)'; color = 'var(--purple)'
            }
            const dotActive = isSel || (revealed && isCor)
            return (
              <button
                key={oi}
                onClick={() => !revealed && setSelected(oi)}
                disabled={revealed}
                style={{
                  padding: '9px 14px',
                  border: `1.5px solid ${border}`,
                  borderRadius: 'var(--radius)',
                  background: bg, color,
                  fontFamily: 'var(--font-ui)', fontSize: 13,
                  textAlign: 'left',
                  cursor: revealed ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 9,
                  border: `2px solid ${dotActive ? color : 'var(--bg3)'}`,
                  background: dotActive ? color : 'transparent',
                  flexShrink: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {dotActive && (
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: 'white' }} />
                  )}
                </span>
                <span style={{ flex: 1 }}>{opt}</span>
              </button>
            )
          })}
        </div>

        {selected !== null && !revealed && (
          <button
            onClick={handleReveal}
            style={{
              marginTop: 12, padding: '7px 18px',
              borderRadius: 'var(--radius)',
              background: 'var(--purple)', color: 'white',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(108,92,231,0.3)',
            }}
          >
            Check Answer
          </button>
        )}

        {revealed && (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            borderRadius: 'var(--radius)',
            background: 'var(--bg2)',
            border: '1.5px solid var(--bg3)',
          }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
              color: isCorrect ? 'var(--green)' : 'var(--danger)',
              marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {isCorrect ? '✓ Correct' : '✗ Not quite'}
            </div>
            {correctIdx >= 0 && !isCorrect && (
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: 12,
                color: 'var(--ink2)', marginBottom: 6,
              }}>
                The correct answer is <strong>option {correctIdx + 1}</strong>.
              </div>
            )}
            {loadingEx && (
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: 12,
                color: 'var(--ink3)', fontStyle: 'italic',
              }}>
                Loading explanation…
              </div>
            )}
            {explanation && (
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.65,
                color: 'var(--ink2)',
              }}>
                <ReactMarkdown>{explanation}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ShortExercise({ exercise, index, onAskInChat }) {
  const kind = exercise.type === 'numerical' ? 'Numerical' : 'Short'
  return (
    <div style={{
      marginBottom: 20,
      border: '1.5px solid var(--bg3)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow)',
      background: 'var(--surface)',
      padding: '14px 18px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
          color: 'var(--ink3)', letterSpacing: '0.04em',
        }}>
          Q{index + 1}
        </span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
          color: 'var(--subj-text)',
          background: 'var(--subj-bg)',
          border: '1.5px solid var(--subj-border)',
          borderRadius: 100, padding: '2px 8px',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {kind}
        </span>
      </div>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6,
        color: 'var(--ink)', marginBottom: 12,
      }}>
        {exercise.question}
      </p>
      <button
        onClick={() => onAskInChat(exercise)}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(108,92,231,0.35)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(108,92,231,0.2)'
        }}
        style={{
          padding: '7px 14px', borderRadius: 'var(--radius)',
          background: 'var(--purple)', color: 'white',
          border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: '0 2px 8px rgba(108,92,231,0.2)',
          transition: 'all 0.15s',
        }}
      >
        <span>💬</span>
        <span>Solve with AI Tutor</span>
      </button>
    </div>
  )
}

export default function ExerciseSection({ exercises, chapterId, onAskInChat }) {
  if (!exercises || exercises.length === 0) return null

  const mcqs   = exercises.filter(e => e.type === 'mcq')
  const others = exercises.filter(e => e.type !== 'mcq')

  return (
    <div style={{ padding: '24px 28px 48px' }}>
      <h3 style={{
        fontFamily: 'var(--font-body)', fontSize: 24, fontWeight: 800,
        color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.02em',
      }}>
        Exercises
      </h3>
      <p style={{
        fontFamily: 'var(--font-ui)', fontSize: 13,
        color: 'var(--ink3)', marginBottom: 24,
      }}>
        {exercises.length} NCERT questions · Check your understanding
      </p>

      {mcqs.length > 0 && (
        <>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', color: 'var(--purple)',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            Multiple Choice
          </div>
          {mcqs.map((ex, i) => (
            <MCQExercise key={ex.id || i} exercise={ex} index={i} chapterId={chapterId} />
          ))}
        </>
      )}

      {others.length > 0 && (
        <>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', color: 'var(--purple)',
            textTransform: 'uppercase', margin: '20px 0 14px',
          }}>
            Short & Long Answer
          </div>
          {others.map((ex, i) => (
            <ShortExercise
              key={ex.id || i}
              exercise={ex}
              index={mcqs.length + i}
              onAskInChat={onAskInChat}
            />
          ))}
        </>
      )}
    </div>
  )
}
