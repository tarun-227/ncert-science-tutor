import { useState } from 'react'

/**
 * RichContent — renders typed-block structured chapter data with the
 * v3 Friendly Purple design language.
 *
 * CSS custom properties expected on an ancestor:
 *   --subj-text, --subj-bg, --subj-border
 */

// ── Highlightable Paragraph ─────────────────────────────────────────────────

function HP({ id, highlighted, onToggle, children }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{ position: 'relative', marginBottom: 14 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <p
        className={highlighted ? 'hl' : ''}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--body-size)',
          lineHeight: 'var(--body-line-height)',
          color: 'var(--ink)',
          textWrap: 'pretty',
          padding: '2px 6px 2px 2px',
          borderRadius: 4,
          cursor: 'text',
          margin: 0,
        }}
      >
        {children}
      </p>
      {hov && (
        <button
          onClick={onToggle}
          style={{
            position: 'absolute', top: 2, right: -28,
            width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: highlighted ? 'rgba(255,234,0,0.5)' : 'var(--bg3)',
            fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          title={highlighted ? 'Remove highlight' : 'Highlight'}
        >
          {highlighted ? '✕' : '✦'}
        </button>
      )}
    </div>
  )
}

// ── Callout types: fun | definition | keypoint | caution ────────────────────

const CALLOUT_CFG = {
  fun:        { border: 'var(--purple)',  bg: 'var(--purple-light)', label: '✦ Did You Know',  labelColor: 'var(--purple)' },
  definition: { border: 'var(--teal)',    bg: 'var(--teal-light)',   label: '📖 Definition',   labelColor: 'var(--teal)' },
  keypoint:   { border: 'var(--green)',   bg: 'var(--green-light)',  label: '⭐ Key Point',    labelColor: 'var(--green)' },
  caution:    { border: 'var(--orange)',  bg: 'var(--orange-light)', label: '⚠️ Caution',     labelColor: 'var(--orange)' },
}

function Callout({ type = 'keypoint', children, text }) {
  const cfg = CALLOUT_CFG[type] || CALLOUT_CFG.keypoint
  return (
    <div style={{
      margin: '20px 0 28px', padding: '14px 18px',
      borderLeft: `3px solid ${cfg.border}`, background: cfg.bg,
      borderRadius: '0 var(--radius-lg) var(--radius-lg) 0',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: cfg.labelColor, marginBottom: 6,
      }}>
        {cfg.label}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.75,
        color: 'var(--ink2)', textWrap: 'pretty', margin: 0,
      }}>
        {text || children}
      </div>
    </div>
  )
}

// ── Block renderers ─────────────────────────────────────────────────────────

function Paragraph({ block, highlights, onToggleHL }) {
  const pid = block._pid
  if (pid && highlights && onToggleHL) {
    return (
      <HP
        id={pid}
        highlighted={!!highlights[pid]}
        onToggle={() => onToggleHL(pid)}
      >
        {block.text}
      </HP>
    )
  }
  return (
    <p style={{
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--body-size)',
      lineHeight: 'var(--body-line-height)',
      color: 'var(--ink)',
      margin: '0 0 16px 0',
      textWrap: 'pretty',
    }}>
      {block.text}
    </p>
  )
}

// Render ASCII arrows as proper → and fix common chemical notation
function renderEq(body) {
  if (!body) return '—'
  return body
    .replace(/->/g, ' → ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function Equation({ block }) {
  const [copied, setCopied] = useState(false)
  if (!block.body || block.body === '→ →' || block.body === '→') return null
  return (
    <div style={{
      margin: '20px 0',
      borderRadius: 'var(--radius-lg)',
      border: '1.5px solid var(--subj-border)',
      background: 'var(--subj-bg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 500,
          color: 'var(--subj-text)', letterSpacing: '0.02em', flex: 1,
          wordBreak: 'break-word',
        }}>
          {renderEq(block.body)}
        </span>
        <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--subj-text)', opacity: 0.6,
            padding: '2px 8px', borderRadius: 5,
            border: '1px solid var(--subj-border)',
            background: 'rgba(255,255,255,0.5)',
          }}>
            ({block.num})
          </span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(block.body)
              setCopied(true)
              setTimeout(() => setCopied(false), 1400)
            }}
            style={{
              width: 26, height: 26, borderRadius: 6,
              border: '1.5px solid var(--subj-border)',
              background: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontSize: 11, color: 'var(--subj-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {copied ? '✓' : '⎘'}
          </button>
        </div>
      </div>
      {block.label && (
        <div style={{
          padding: '7px 20px',
          borderTop: '1px solid var(--subj-border)',
          fontSize: 11, color: 'var(--subj-text)', opacity: 0.75,
          fontFamily: 'var(--font-ui)',
        }}>
          {block.label}
        </div>
      )}
    </div>
  )
}

function Figure({ block }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <>
      <div
        onClick={() => setZoomed(true)}
        style={{
          margin: '20px 0',
          border: '1.5px solid var(--bg3)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', cursor: 'zoom-in',
        }}
      >
        <div style={{
          background: 'var(--bg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', minHeight: 80,
        }}>
          {block.image ? (
            <img
              src={`/figures/${block.image}`}
              alt={block.caption}
              style={{
                maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto',
                maxHeight: 320,
              }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
          ) : null}
          <div style={{
            display: block.image ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            minHeight: 80, width: '100%',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink3)' }}>
              [ Figure {block.num} ]
            </span>
          </div>
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid var(--bg3)',
            borderRadius: 4, padding: '2px 7px',
            fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--ink3)',
          }}>
            zoom ⤢
          </div>
        </div>
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--bg3)',
          fontFamily: 'var(--font-ui)',
          fontSize: 11, fontStyle: 'italic', color: 'var(--ink3)', lineHeight: 1.5,
        }}>
          <span style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--subj-text)', marginRight: 6 }}>
            Figure {block.num}
          </span>
          {block.caption && <>— {block.caption}</>}
        </div>
      </div>
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(30,27,46,0.8)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 'var(--radius-xl)',
              padding: 28, maxWidth: 540, width: '90%',
              boxShadow: 'var(--shadow-lg)', animation: 'popIn 0.2s ease',
            }}
          >
            <div style={{
              background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
              marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 120,
            }}>
              {block.image ? (
                <img
                  src={`/figures/${block.image}`}
                  alt={block.caption}
                  style={{ maxWidth: '100%', maxHeight: '65vh', height: 'auto', display: 'block', margin: '0 auto', borderRadius: 'var(--radius-lg)' }}
                />
              ) : (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink3)' }}>
                  [ Figure {block.num} enlarged ]
                </span>
              )}
            </div>
            <p style={{
              fontSize: 13, fontStyle: 'italic', color: 'var(--ink3)',
              textAlign: 'center', lineHeight: 1.6, margin: 0,
            }}>
              {block.caption}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// ── Activity (lab report) ───────────────────────────────────────────────────

function LabSection({ label, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
        color: 'var(--subj-text)', textTransform: 'uppercase',
        marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 15, lineHeight: 1.7,
        color: 'var(--ink2)',
      }}>
        {children}
      </div>
    </div>
  )
}

function ActivityCard({ block }) {
  const [open, setOpen] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const lr = block.lab_report
  const hasLabReport = lr && typeof lr === 'object'

  return (
    <div style={{
      marginBottom: 18,
      border: '1.5px solid var(--bg3)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
      background: 'var(--surface)',
    }}>
      {block.cautions?.length > 0 && (
        <div style={{
          padding: '8px 16px',
          background: 'var(--orange-light)',
          borderBottom: '1px solid var(--orange-border)',
          fontFamily: 'var(--font-ui)',
          fontSize: 12, fontWeight: 600,
          color: 'var(--orange)',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span>⚠</span> CAUTION — {block.cautions.join(' ')}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 18px', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 11, fontWeight: 700,
            color: 'var(--subj-text)', letterSpacing: '.06em',
            marginBottom: 3,
          }}>
            ACTIVITY {block.num}
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15.5, fontWeight: 600, color: 'var(--ink)',
            lineHeight: 1.4,
          }}>
            {hasLabReport ? lr.aim : (block.title || 'Lab activity')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasLabReport && open && (
            <span
              onClick={(e) => { e.stopPropagation(); setShowRaw(v => !v) }}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 10, fontWeight: 600,
                padding: '3px 9px', borderRadius: 100,
                background: 'var(--bg2)',
                color: 'var(--ink3)',
                border: '1px solid var(--bg3)',
              }}
            >
              {showRaw ? 'LAB REPORT' : 'RAW STEPS'}
            </span>
          )}
          <span style={{
            color: 'var(--ink4)', fontSize: 14,
            transform: open ? 'rotate(0)' : 'rotate(-90deg)',
            transition: 'transform 0.2s',
          }}>▾</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--bg3)' }}>
          {hasLabReport && !showRaw ? (
            <>
              <LabSection label="Aim">{lr.aim}</LabSection>
              {Array.isArray(lr.materials) && lr.materials.length > 0 && (
                <LabSection label="Materials Required">{lr.materials.join(', ')}</LabSection>
              )}
              {Array.isArray(lr.procedure) && lr.procedure.length > 0 && (
                <LabSection label="Procedure">
                  <ol style={{ paddingLeft: 22, margin: 0 }}>
                    {lr.procedure.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                  </ol>
                </LabSection>
              )}
              {lr.observation && <LabSection label="Observation">{lr.observation}</LabSection>}
              {lr.conclusion && <LabSection label="Conclusion">{lr.conclusion}</LabSection>}
            </>
          ) : (
            <LabSection label="Steps">
              <ol style={{ paddingLeft: 22, margin: 0 }}>
                {block.steps?.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
              </ol>
            </LabSection>
          )}
        </div>
      )}
    </div>
  )
}

// ── Do You Know → mapped to "fun" callout ─────────────────────────────────

function DoYouKnow({ block }) {
  return <Callout type="fun" text={block.text} />
}

function InTextQuestions({ block }) {
  return (
    <div style={{
      margin: '20px 0',
      background: 'var(--surface)',
      border: '1.5px solid var(--bg3)',
      borderLeft: '3px solid var(--subj-text)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 18px',
    }}>
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
        color: 'var(--subj-text)', textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        Check Your Understanding
      </div>
      <ol style={{ margin: 0, paddingLeft: 24 }}>
        {block.items.map((item, i) => (
          <li key={i} style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15, lineHeight: 1.7,
            color: 'var(--ink)',
            marginBottom: 8, textWrap: 'pretty',
          }}>
            {item.text}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Step({ block }) {
  return (
    <div style={{
      display: 'flex', gap: 12, margin: '10px 0', padding: '10px 14px',
      background: 'var(--bg2)', borderLeft: '3px solid var(--ink4)',
      borderRadius: 'var(--radius)',
    }}>
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontWeight: 700, color: 'var(--ink2)', fontSize: 12,
        minWidth: 64, flexShrink: 0, letterSpacing: '.05em',
        textTransform: 'uppercase',
      }}>
        {block.label}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 15, lineHeight: 1.7, color: 'var(--ink2)',
      }}>
        {block.text}
      </div>
    </div>
  )
}

// ── Section footer: Check Yourself + quick-ask prompts ──────────────────────

function SectionFooter({ onCheckYourself, onAsk }) {
  const PROMPTS = ['Explain this', 'Give an example', 'What might be exam-asked?']
  return (
    <div style={{
      marginTop: 24, paddingTop: 16,
      borderTop: '1.5px dashed var(--bg3)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    }}>
      <button
        onClick={onCheckYourself}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(108,92,231,0.4)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(108,92,231,0.3)'
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', borderRadius: 100,
          background: 'var(--purple)', color: 'white', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
          boxShadow: '0 2px 8px rgba(108,92,231,0.3)',
        }}
      >
        ✦ Check Yourself
      </button>
      <div style={{ width: 1, height: 16, background: 'var(--bg3)' }} />
      {PROMPTS.map(p => (
        <button
          key={p}
          onClick={() => onAsk(p)}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--purple)'
            e.currentTarget.style.color = 'var(--purple)'
            e.currentTarget.style.background = 'var(--purple-light)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--bg3)'
            e.currentTarget.style.color = 'var(--ink2)'
            e.currentTarget.style.background = 'transparent'
          }}
          style={{
            padding: '6px 14px', borderRadius: 100,
            border: '1.5px solid var(--bg3)', background: 'transparent',
            color: 'var(--ink2)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.14s',
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

// ── Subsection & action bar ─────────────────────────────────────────────────

function Subsection({ block, onAction, highlights, onToggleHL, onCheckYourself, onAsk }) {
  return (
    <div style={{ margin: '24px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10, fontWeight: 700,
          color: 'var(--subj-text)', background: 'var(--subj-bg)',
          padding: '3px 8px', borderRadius: 6,
          border: '1.5px solid var(--subj-border)', flexShrink: 0,
        }}>
          {block.id}
        </span>
        <h4 style={{
          fontFamily: 'var(--font-body)',
          fontSize: 17, fontWeight: 700, color: 'var(--ink)',
          letterSpacing: '-0.01em', margin: 0,
        }}>
          {block.title}
        </h4>
      </div>
      <div>
        {block.blocks.map((b, i) => (
          <BlockRenderer
            key={i} block={b} onAction={onAction}
            highlights={highlights} onToggleHL={onToggleHL}
            onCheckYourself={onCheckYourself} onAsk={onAsk}
          />
        ))}
        {onAction && (
          <ActionBar
            onAction={onAction}
            context={{ id: block.id, title: block.title, content: extractText(block.blocks) }}
          />
        )}
      </div>
    </div>
  )
}

function ActionBar({ onAction, context }) {
  const ACTIONS = [
    { id: 'explain',  label: 'Explain' },
    { id: 'simplify', label: 'Simplify' },
    { id: 'example',  label: 'Give Example' },
  ]
  return (
    <div style={{
      marginTop: 18, paddingTop: 14,
      borderTop: '1px dashed var(--bg3)',
      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 11, color: 'var(--ink3)', marginRight: 4,
      }}>
        Ask about this section:
      </span>
      {ACTIONS.map(a => (
        <button
          key={a.id}
          onClick={() => onAction(a.id, context)}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--purple)'
            e.currentTarget.style.color = 'var(--purple)'
            e.currentTarget.style.background = 'var(--purple-light)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--bg3)'
            e.currentTarget.style.color = 'var(--ink2)'
            e.currentTarget.style.background = 'transparent'
          }}
          style={{
            padding: '5px 14px', borderRadius: 100,
            border: '1.5px solid var(--bg3)',
            background: 'transparent',
            color: 'var(--ink2)',
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

function extractText(blocks) {
  const parts = []
  for (const b of blocks || []) {
    if (b.type === 'paragraph')        parts.push(b.text)
    else if (b.type === 'equation')    parts.push(b.body)
    else if (b.type === 'subsection')  parts.push(...extractText(b.blocks))
    else if (b.type === 'activity')    parts.push(b.steps?.join(' ') || '')
    else if (b.type === 'do_you_know') parts.push(b.text)
  }
  return parts.join(' ').slice(0, 1500)
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

function BlockRenderer({ block, onAction, highlights, onToggleHL, onCheckYourself, onAsk }) {
  switch (block.type) {
    case 'paragraph':         return <Paragraph block={block} highlights={highlights} onToggleHL={onToggleHL} />
    case 'subsection':        return <Subsection block={block} onAction={onAction} highlights={highlights} onToggleHL={onToggleHL} onCheckYourself={onCheckYourself} onAsk={onAsk} />
    case 'activity':          return <ActivityCard block={block} />
    case 'do_you_know':       return <DoYouKnow block={block} />
    case 'in_text_questions': return <InTextQuestions block={block} />
    case 'equation':          return <Equation block={block} />
    case 'figure':            return <Figure block={block} />
    case 'step':              return <Step block={block} />
    default:                  return null
  }
}

// ── Block-tree helpers ──────────────────────────────────────────────────────

function walkAllBlocks(blocks, out) {
  out = out || []
  for (const b of blocks || []) {
    if (!b || typeof b !== 'object') continue
    out.push(b)
    if (b.type === 'subsection') walkAllBlocks(b.blocks, out)
  }
  return out
}

function stripBlockTypes(blocks, reject) {
  const out = []
  for (const b of blocks || []) {
    if (!b || typeof b !== 'object') continue
    if (reject.has(b.type)) continue
    if (b.type === 'subsection') {
      out.push({ ...b, blocks: stripBlockTypes(b.blocks, reject) })
    } else {
      out.push(b)
    }
  }
  return out
}

function findInTextQuestions(section) {
  const all = walkAllBlocks(section.blocks || [])
  return all.find(b => b.type === 'in_text_questions') || null
}

// ── Section heading with read-tick ──────────────────────────────────────────

function ReadTick({ read, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={read ? 'Mark as unread' : 'Mark as read'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px 3px 8px', borderRadius: 100,
        background: read ? 'var(--subj-bg)' : 'transparent',
        color: read ? 'var(--subj-text)' : 'var(--ink3)',
        border: `1.5px solid ${read ? 'var(--subj-border)' : 'var(--bg3)'}`,
        fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 500,
        cursor: 'pointer', transition: 'all .2s',
      }}
    >
      <span style={{ fontSize: 13 }}>{read ? '✓' : '○'}</span>
      {read ? 'Read' : 'Mark read'}
    </button>
  )
}

function SectionHeading({ section, read, onToggleRead }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16, gap: 12,
    }}>
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          flex: 1, textAlign: 'left', padding: 0,
        }}
      >
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          color: 'var(--subj-text)', background: 'var(--subj-bg)',
          padding: '3px 8px', borderRadius: 6,
          border: '1.5px solid var(--subj-border)', flexShrink: 0,
        }}>
          {section.id}
        </span>
        <h2 style={{
          fontFamily: 'var(--font-body)',
          fontSize: 21, fontWeight: 800, color: 'var(--ink)',
          letterSpacing: '-0.02em', margin: 0, lineHeight: 1.25,
        }}>
          {section.title}
        </h2>
      </button>
      {onToggleRead && <ReadTick read={read} onToggle={() => onToggleRead(section.id)} />}
    </div>
  )
}

// ── Top-level component ─────────────────────────────────────────────────────

export default function RichContent({
  chapter,
  onAction,
  tab = 'content',
  readSections,
  onToggleRead,
  highlights,
  onToggleHL,
  onCheckYourself,
  onAsk,
}) {
  const isRead = (id) => readSections?.has?.(id) || false

  // ── ACTIVITIES tab ─────────────────────────────────────────────────────────
  if (tab === 'activities') {
    const activities = []
    walkAllBlocks(chapter.intro_blocks || []).forEach(b => {
      if (b.type === 'activity') activities.push(b)
    })
    ;(chapter.sections || []).forEach(sec => {
      walkAllBlocks(sec.blocks || []).forEach(b => {
        if (b.type === 'activity') activities.push(b)
      })
    })
    const seen = new Set()
    const uniq = activities.filter(a => {
      if (seen.has(a.num)) return false
      seen.add(a.num); return true
    })
    uniq.sort((a, b) => {
      const pa = String(a.num || '').split('.').map(Number)
      const pb = String(b.num || '').split('.').map(Number)
      return (pa[0] - pb[0]) || (pa[1] - pb[1])
    })

    return (
      <div>
        <h3 style={{
          fontFamily: 'var(--font-body)',
          fontSize: 24, fontWeight: 800, color: 'var(--ink)',
          margin: '0 0 6px 0', letterSpacing: '-0.02em',
        }}>
          Laboratory Activities
        </h3>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 13, color: 'var(--ink3)',
          margin: '0 0 24px 0',
        }}>
          {uniq.length} activities · each rewritten as a lab report
        </p>
        {uniq.map((a, i) => <ActivityCard key={`act-${a.num}-${i}`} block={a} />)}
      </div>
    )
  }

  // ── EXERCISES tab ─────────────────────────────────────────────────────────
  if (tab === 'exercises') {
    const perSection = (chapter.sections || []).map(sec => ({
      section: sec,
      itq: findInTextQuestions(sec),
    })).filter(x => x.itq && x.itq.items?.length)

    return (
      <div>
        <h3 style={{
          fontFamily: 'var(--font-body)',
          fontSize: 24, fontWeight: 800, color: 'var(--ink)',
          margin: '0 0 6px 0', letterSpacing: '-0.02em',
        }}>
          Exercises
        </h3>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 13, color: 'var(--ink3)',
          margin: '0 0 20px 0',
        }}>
          In-text questions & end-of-chapter NCERT exercises
        </p>

        {perSection.length > 0 && (
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
            color: 'var(--subj-text)', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Check Your Understanding
          </div>
        )}

        {perSection.map(({ section, itq }) => (
          <div key={section.id} style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 11, fontWeight: 600,
              color: 'var(--ink3)', letterSpacing: '.04em',
              marginBottom: 6,
            }}>
              {section.id} · {section.title}
            </div>
            <InTextQuestions block={itq} />
          </div>
        ))}
      </div>
    )
  }

  // ── CONTENT tab (default) ─────────────────────────────────────────────────
  const reject = new Set(['activity', 'in_text_questions'])
  const filteredIntroBlocks = stripBlockTypes(chapter.intro_blocks || [], reject)

  return (
    <div>
      {/* Chapter intro */}
      {chapter.intro && (
        <div style={{ marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid var(--bg3)' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--subj-text)',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 5,
              background: 'var(--subj-bg)', border: '1.5px solid var(--subj-border)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
            }}>✦</span>
            Chapter {chapter.id || chapter.num || ''}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-body)',
            fontSize: 32, fontWeight: 800, color: 'var(--ink)',
            lineHeight: 1.2, margin: '0 0 14px 0', letterSpacing: '-0.025em',
          }}>
            {chapter.title}
          </h1>
          <HP
            id={`intro-${chapter.id || 0}`}
            highlighted={!!(highlights && highlights[`intro-${chapter.id || 0}`])}
            onToggle={() => onToggleHL && onToggleHL(`intro-${chapter.id || 0}`)}
          >
            {chapter.intro}
          </HP>
        </div>
      )}

      {/* Intro-level blocks */}
      {filteredIntroBlocks.map((b, i) => (
        <BlockRenderer
          key={`intro-${i}`} block={b} onAction={onAction}
          highlights={highlights} onToggleHL={onToggleHL}
          onCheckYourself={onCheckYourself} onAsk={onAsk}
        />
      ))}

      {/* Sections */}
      {chapter.sections?.map(section => {
        const filtered = stripBlockTypes(section.blocks || [], reject)
        return (
          <section key={section.id} style={{ marginBottom: 44 }}>
            <SectionHeading
              section={section}
              read={isRead(section.id)}
              onToggleRead={onToggleRead}
            />
            <div style={{ animation: 'fadeUp 0.22s ease both' }}>
              {filtered.map((b, i) => (
                <BlockRenderer
                  key={i} block={b} onAction={onAction}
                  highlights={highlights} onToggleHL={onToggleHL}
                  onCheckYourself={onCheckYourself} onAsk={onAsk}
                />
              ))}
              {/* Section footer with Check Yourself + quick prompts */}
              {(onCheckYourself || onAsk) && (
                <SectionFooter
                  onCheckYourself={() => onCheckYourself && onCheckYourself(section.title)}
                  onAsk={q => onAsk && onAsk(q)}
                />
              )}
            </div>
          </section>
        )
      })}

      {/* What you have learnt */}
      {chapter.what_you_have_learnt?.length > 0 && (
        <Callout type="keypoint">
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
            color: 'var(--green)', textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            What you have learnt
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {chapter.what_you_have_learnt.map((line, i) => (
              <li key={i} style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15, lineHeight: 1.75,
                color: 'var(--ink2)',
                marginBottom: 6, textWrap: 'pretty',
              }}>
                {line}
              </li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  )
}

// ── Counters (used by ChapterPage for tab-bar badges) ───────────────────────

export function countBlocks(chapter) {
  if (!chapter) return { activities: 0, inTextQs: 0, sections: 0 }
  const all = []
  walkAllBlocks(chapter.intro_blocks || [], all)
  ;(chapter.sections || []).forEach(sec => walkAllBlocks(sec.blocks || [], all))
  const seenAct = new Set()
  let activities = 0
  let inTextQs = 0
  all.forEach(b => {
    if (b.type === 'activity' && !seenAct.has(b.num)) {
      seenAct.add(b.num); activities++
    }
    if (b.type === 'in_text_questions') inTextQs += (b.items?.length || 0)
  })
  return {
    activities,
    inTextQs,
    sections: chapter.sections?.length || 0,
  }
}
