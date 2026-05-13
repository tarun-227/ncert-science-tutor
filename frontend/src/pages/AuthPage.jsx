import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { migrateLocalDataToSupabase } from '../lib/userdata'

export default function AuthPage() {
  const { signIn, signUp, signInMagicLink } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode]         = useState('login')  // 'login' | 'signup' | 'magic'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'magic') {
        const { error } = await signInMagicLink(email)
        if (error) throw error
        setSent(true)
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSent(true)  // "check your email" screen
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        // Offer to migrate localStorage data silently — fire and forget
        migrateLocalDataToSupabase().catch(() => {})
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Sent confirmation screen ─────────────────────────────────────────────
  if (sent) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', fontFamily: 'var(--font-ui)',
      }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--bg3)', padding: '40px 48px', maxWidth: 400,
          textAlign: 'center', boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 800,
            color: 'var(--ink)', marginBottom: 10,
          }}>
            Check your inbox
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 20 }}>
            {mode === 'signup'
              ? 'We sent a confirmation link to '
              : 'We sent a magic sign-in link to '}
            <strong>{email}</strong>. Click the link to continue.
          </p>
          <button
            onClick={() => { setSent(false); setMode('login') }}
            style={{
              padding: '8px 20px', borderRadius: 100,
              background: 'transparent', border: '1.5px solid var(--bg3)',
              color: 'var(--ink2)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
            }}
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Auth form ────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', fontFamily: 'var(--font-ui)',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1.5px solid var(--bg3)', padding: '40px 48px', width: '100%', maxWidth: 400,
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Logo / title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 800,
            color: 'var(--ink)', letterSpacing: '-0.02em',
          }}>
            Science Tutor
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>
            Class 10 NCERT · AI-powered
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{
          display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden',
          border: '1.5px solid var(--bg3)', marginBottom: 24,
        }}>
          {[['login', 'Log In'], ['signup', 'Sign Up'], ['magic', '✉ Magic Link']].map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: mode === m ? 700 : 500,
                background: mode === m ? 'var(--purple)' : 'transparent',
                color:      mode === m ? 'white' : 'var(--ink3)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email"
              style={{
                display: 'block', width: '100%', marginTop: 4,
                padding: '10px 12px', borderRadius: 'var(--radius)',
                border: '1.5px solid var(--bg3)', background: 'var(--bg)',
                fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {mode !== 'magic' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required={mode !== 'magic'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{
                  display: 'block', width: '100%', marginTop: 4,
                  padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1.5px solid var(--bg3)', background: 'var(--bg)',
                  fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: '9px 12px', borderRadius: 'var(--radius)',
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
              color: 'var(--danger)', fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              padding: '11px', borderRadius: 100, border: 'none',
              background: 'var(--purple)', color: 'white', cursor: loading ? 'default' : 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700,
              opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
              boxShadow: '0 2px 8px rgba(108,92,231,0.3)', marginTop: 4,
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink4)', marginTop: 20, lineHeight: 1.6 }}>
          By signing in you agree to our terms of service.
          <br />Your data is private and only visible to you.
        </p>
      </div>
    </div>
  )
}
