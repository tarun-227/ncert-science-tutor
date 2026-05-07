import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_COPY = {
  queued:     'Queued…',
  extracting: 'Extracting text from your PDF',
  solving:    'Solving questions with AI',
  rendering:  'Rendering the answer PDF',
  done:       'Done! Your answer PDF is ready.',
  error:      'Something went wrong.',
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export default function QPaperPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [file, setFile]         = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [job, setJob]           = useState(null)
  const [error, setError]       = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'error') return
    const tick = async () => {
      try {
        const r = await fetch(`/api/qpaper/${job.job_id}`)
        if (!r.ok) return
        const data = await r.json()
        setJob(prev => ({ ...prev, ...data }))
      } catch { /* transient */ }
    }
    const t = setInterval(tick, 1500)
    return () => clearInterval(t)
  }, [job?.job_id, job?.status])

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Please select a PDF file.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('File is too large (max 20 MB).'); return }
    setError(null); setFile(f); setJob(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const r = await fetch('/api/qpaper/upload', { method: 'POST', body })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Upload failed')
      setJob({ job_id: data.job_id, status: 'queued', progress: 0, total: 0 })
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }

  const reset = () => {
    setFile(null); setJob(null); setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const progressPct = job && job.total > 0
    ? Math.min(100, Math.round((job.progress / job.total) * 100))
    : (job?.status === 'done' ? 100 : job?.status === 'extracting' ? 10 : job?.status === 'rendering' ? 95 : 5)

  const isRunning = job && job.status !== 'done' && job.status !== 'error'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(247,246,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--bg3)',
        padding: '0 32px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--purple)'; e.currentTarget.style.color = 'var(--purple)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg3)'; e.currentTarget.style.color = 'var(--ink2)' }}
            style={{
              background: 'transparent',
              border: '1.5px solid var(--bg3)',
              borderRadius: 100, padding: '4px 14px',
              fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
              color: 'var(--ink2)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            ← Chapters
          </button>
          <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 800,
            fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.02em',
          }}>
            Question Paper Solver
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--ink3)' }}>
          Powered by Phi-4 Mini
        </span>
      </div>

      {/* Hero */}
      <div style={{
        background: 'var(--hero-gradient)',
        padding: '44px 48px 36px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'rgba(108,92,231,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -80, right: 180, width: 200, height: 200, borderRadius: '50%', background: 'rgba(9,132,227,0.10)' }} />
        <div style={{ maxWidth: 620, position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 100,
            background: 'var(--hero-badge-bg)',
            border: '1px solid rgba(108,92,231,0.4)',
            marginBottom: 16,
          }}>
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,0.7)',
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              ✦ Experimental Feature
            </span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-body)', fontSize: 32, fontWeight: 800,
            color: '#FFFFFF', lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.025em',
          }}>
            Upload a question paper,<br />get a formatted answer PDF.
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 14,
            color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 520,
          }}>
            Drop a scanned or digital PDF. We extract each question, solve it with the tutor model,
            and hand you back a clean answer document with every Q &amp; A laid out for easy review.
          </p>
        </div>
      </div>

      {/* Main card */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* Dropzone */}
        {!job && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'var(--surface)',
              border: `2px dashed ${dragOver ? 'var(--purple)' : 'var(--bg3)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '48px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.18s',
              boxShadow: dragOver ? 'var(--shadow-md)' : 'var(--shadow)',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
              color: 'var(--ink)', marginBottom: 6,
            }}>
              {file ? file.name : 'Drop a PDF here, or click to choose'}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink3)' }}>
              {file
                ? `${formatBytes(file.size)} · PDF`
                : 'Scanned or digital PDFs up to 20 MB · up to 20 questions'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {/* Upload action */}
        {file && !job && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }}>
            <button
              onClick={reset}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--purple)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg3)' }}
              style={{
                padding: '8px 18px', borderRadius: 100,
                background: 'transparent', border: '1.5px solid var(--bg3)',
                color: 'var(--ink2)',
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              Clear
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{
                padding: '8px 20px', borderRadius: 100,
                background: 'var(--purple)', color: 'white', border: 'none',
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
                cursor: uploading ? 'default' : 'pointer',
                opacity: uploading ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(108,92,231,0.3)',
                transition: 'all 0.15s',
              }}
            >
              {uploading ? 'Uploading…' : 'Solve & generate PDF'}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 16,
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            color: 'var(--danger)',
            fontFamily: 'var(--font-ui)', fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Progress card */}
        {job && (
          <div style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--bg3)',
            borderRadius: 'var(--radius-lg)',
            padding: '22px 24px',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
                  color: 'var(--purple)', letterSpacing: '0.08em',
                  textTransform: 'uppercase', marginBottom: 4,
                }}>
                  {job.status === 'error' ? 'Error' : 'Job'} · {job.job_id}
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 800,
                  color: 'var(--ink)', letterSpacing: '-0.01em',
                }}>
                  {STATUS_COPY[job.status] || job.stage || job.status}
                </div>
              </div>
              {job.status === 'done' && (
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
                  color: 'var(--green)', background: 'var(--green-light)',
                  border: '1.5px solid var(--green-border)',
                  borderRadius: 100, padding: '3px 10px',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  ✓ Complete
                </span>
              )}
            </div>

            {job.status !== 'error' && (
              <>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: 'var(--bg2)',
                  overflow: 'hidden', marginBottom: 10,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, var(--purple), var(--purple-border))`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink3)',
                }}>
                  <span>{job.stage || STATUS_COPY[job.status]}</span>
                  <span>
                    {job.status === 'solving' && job.total > 0
                      ? `Question ${job.progress} of ${job.total}`
                      : `${progressPct}%`}
                  </span>
                </div>
                {job.used_ocr && (
                  <div style={{
                    marginTop: 10,
                    fontFamily: 'var(--font-ui)', fontSize: 11,
                    color: 'var(--ink3)', fontStyle: 'italic',
                  }}>
                    Scanned pages detected — used OCR to read them.
                  </div>
                )}
              </>
            )}

            {job.status === 'error' && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                color: 'var(--danger)',
                fontFamily: 'var(--font-ui)', fontSize: 13,
                marginTop: 6,
              }}>
                {job.error || 'Unknown error'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              {job.status === 'done' && (
                <a
                  href={`/api/qpaper/${job.job_id}/download`}
                  style={{
                    padding: '9px 20px', borderRadius: 100,
                    background: 'var(--purple)', color: 'white', border: 'none',
                    fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 8px rgba(108,92,231,0.3)',
                  }}
                >
                  <span>⬇</span>
                  <span>Download answer PDF</span>
                </a>
              )}
              {!isRunning && (
                <button
                  onClick={reset}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--purple)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg3)' }}
                  style={{
                    padding: '9px 16px', borderRadius: 100,
                    background: 'transparent', border: '1.5px solid var(--bg3)',
                    color: 'var(--ink2)',
                    fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  Upload another
                </button>
              )}
            </div>
          </div>
        )}

        {/* Help note */}
        <div style={{
          marginTop: 24,
          fontFamily: 'var(--font-ui)', fontSize: 12,
          color: 'var(--ink3)', lineHeight: 1.6,
          background: 'var(--bg2)',
          border: '1.5px solid var(--bg3)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
        }}>
          <strong style={{ color: 'var(--ink2)' }}>How this works:</strong>{' '}
          We read the PDF (OCR kicks in for scanned pages), split it into numbered questions,
          send each to the local tutor model, and render a new PDF where every question has a
          matched answer block. Answer quality depends on the model — pipeline-first for now.
        </div>
      </div>
    </div>
  )
}
