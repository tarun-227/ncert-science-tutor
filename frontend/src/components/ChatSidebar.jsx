import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import ReactMarkdown from 'react-markdown'
import { apiFetch } from '../lib/api'

/* ── Inline MCQ Block (for "Check Yourself" quick checks) ─────────────── */

function MCQBlock({ mcq, onDone }) {
  const [answer, setAnswer] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const reveal = () => {
    setRevealed(true)
    if (onDone) setTimeout(onDone, 300)
  }

  return (
    <div style={{
      background: 'var(--bg2)', border: '1.5px solid var(--bg3)',
      borderRadius: 'var(--radius-lg)', padding: 14,
      animation: 'popIn 0.25s ease',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
        color: 'var(--purple)', textTransform: 'uppercase', marginBottom: 8,
      }}>
        Quick Check ✦
      </div>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.65,
        color: 'var(--ink)', marginBottom: 12,
      }}>
        {mcq.q}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {mcq.opts.map((opt, i) => {
          const sel = answer === i
          const isC = i === mcq.ans
          let bg = 'transparent', border = 'var(--bg3)', col = 'var(--ink2)'
          if (revealed) {
            if (isC) { bg = 'var(--green-light)'; border = 'var(--green-border)'; col = 'var(--green)' }
            else if (sel) { bg = '#FEF2F2'; border = '#FECACA'; col = '#991B1B' }
          } else if (sel) {
            bg = 'var(--purple-light)'; border = 'var(--purple-border)'; col = 'var(--purple)'
          }
          return (
            <button key={i} onClick={() => !revealed && setAnswer(i)} style={{
              padding: '8px 11px', borderRadius: 'var(--radius)',
              border: `1.5px solid ${border}`, background: bg, color: col,
              fontSize: 12, textAlign: 'left', cursor: revealed ? 'default' : 'pointer',
              fontFamily: 'var(--font-ui)', transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${(sel || (revealed && isC)) ? col : 'var(--bg3)'}`,
                background: (sel || (revealed && isC)) ? col : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {(sel || (revealed && isC)) && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
                )}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
      {answer !== null && !revealed && (
        <button onClick={reveal} style={{
          padding: '7px 18px', borderRadius: 'var(--radius)',
          background: 'var(--purple)', color: 'white', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(108,92,231,0.3)',
        }}>
          Check Answer
        </button>
      )}
    </div>
  )
}

/* ── Chat Bubble ──────────────────────────────────────────────────────── */

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      animation: 'fadeUp 0.18s ease',
    }}>
      <div style={{
        maxWidth: '88%',
        padding: '10px 14px',
        borderRadius: isUser
          ? '14px 14px 4px 14px'
          : '14px 14px 14px 4px',
        background: isUser ? 'var(--subj-text, var(--purple))' : 'var(--bg2)',
        border: isUser ? 'none' : '1.5px solid var(--bg3)',
        color: isUser ? 'white' : 'var(--ink)',
        boxShadow: 'var(--shadow)',
      }}>
        {isUser ? (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.72 }}>
            {msg.content}
          </span>
        ) : (
          <ReactMarkdown components={{
            p: ({ children }) => (
              <p style={{
                margin: '0 0 7px', fontFamily: 'var(--font-body)',
                fontSize: 13, lineHeight: 1.72, color: 'inherit',
              }}>
                {children}
              </p>
            ),
            strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
            ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '0 0 7px' }}>{children}</ul>,
            li: ({ children }) => <li style={{ marginBottom: 3, fontSize: 13 }}>{children}</li>,
            code: ({ children }) => (
              <code style={{
                background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4,
                fontSize: 12, fontFamily: 'var(--font-mono)',
              }}>
                {children}
              </code>
            ),
          }}>
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

/* ── Typing indicator (blink dots) ────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        display: 'flex', gap: 4, padding: '10px 14px',
        background: 'var(--bg2)', border: '1.5px solid var(--bg3)',
        borderRadius: '14px 14px 14px 4px', boxShadow: 'var(--shadow)',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--ink3)',
            animation: `blink 1.1s ${i * 0.18}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

/* ── Main ChatSidebar ─────────────────────────────────────────────────── */

const ChatSidebar = forwardRef(function ChatSidebar({ sessionId, chapterId, currentSubtopic, onClear }, ref) {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [mcqActive, setMcqActive] = useState(null)
  const messagesEndRef           = useRef(null)
  const subtopicRef = useRef(currentSubtopic)
  useEffect(() => { subtopicRef.current = currentSubtopic }, [currentSubtopic])

  // Welcome message
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `Hey! 👋 I'm your science tutor. Hit **Check Yourself** at the end of any section to test your knowledge, or just ask me anything!`,
    }])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, mcqActive])

  const sendMessage = async (text, action = null, subtopicOverride = null) => {
    if (!text.trim() && !action) return
    if (!chapterId) return

    const sub = subtopicOverride || subtopicRef.current
    const userMsg = text
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setInput('')
    setLoading(true)

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          session_id:  sessionId,
          message:     userMsg,
          chapter_id:  chapterId,
          subtopic_id: sub?.id || '1.0',
          action:      action,
        }),
      })
      const data = await res.json()
      if (data.detail) throw new Error(data.detail)
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error: ${e.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const actionMessages = {
    explain:  (s) => `Explain: ${s.title}`,
    simplify: (s) => `Simplify: ${s.title}`,
    example:  (s) => `Give a real-world example for: ${s.title}`,
  }

  useImperativeHandle(ref, () => ({
    sendAction: (action, subtopic) => {
      const label = actionMessages[action]?.(subtopic) || subtopic.title
      sendMessage(label, action, subtopic)
    },
    sendMessage: (text) => sendMessage(text),
    showMCQ: (mcq) => setMcqActive(mcq),
  }))

  const handleClear = () => {
    apiFetch(`/api/session/${sessionId}`, { method: 'DELETE' })
    setMessages([{ role: 'assistant', content: 'Chat cleared! Ask me anything about this chapter.' }])
    setMcqActive(null)
    if (onClear) onClear()
  }

  const QUICK = ['What is a catalyst?', 'Explain decomposition', 'Give a real-life example']

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--surface)',
    }}>
      {/* Messages */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {mcqActive && (
          <MCQBlock
            mcq={mcqActive}
            onDone={() => {
              const correct = mcqActive.ans !== undefined
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: mcqActive.exp || 'Great attempt! Keep practising.',
              }])
              setMcqActive(null)
            }}
          />
        )}
        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      <div style={{
        padding: '6px 14px',
        borderTop: '1px solid var(--bg3)',
        display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0,
      }}>
        {QUICK.map(q => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--purple)'
              e.currentTarget.style.color = 'var(--purple)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--bg3)'
              e.currentTarget.style.color = 'var(--ink3)'
            }}
            style={{
              padding: '4px 11px', borderRadius: 100,
              border: '1.5px solid var(--bg3)', background: 'var(--bg)',
              fontSize: 10, fontWeight: 600, color: 'var(--ink3)',
              cursor: 'pointer', transition: 'all 0.14s',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px 12px',
        borderTop: '1px solid var(--bg3)',
        display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault(); sendMessage(input)
            }
          }}
          placeholder="Ask anything… ↵ to send"
          rows={2}
          disabled={loading}
          style={{
            flex: 1, resize: 'none', padding: '9px 12px',
            border: '1.5px solid var(--bg3)', borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6,
            color: 'var(--ink)', background: 'var(--bg)', outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--purple)'}
          onBlur={e => e.target.style.borderColor = 'var(--bg3)'}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          style={{
            width: 38, height: 38, borderRadius: 'var(--radius-lg)', flexShrink: 0,
            background: 'var(--purple)', color: 'white', border: 'none',
            cursor: loading || !input.trim() ? 'default' : 'pointer',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(108,92,231,0.3)',
            opacity: loading || !input.trim() ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  )
})

export default ChatSidebar
