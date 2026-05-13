import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      const { error } = await signInWithGoogle()
      if (error) throw error
      // Supabase redirects to Google — nothing more to do here
    } catch (err) {
      setError(err.message || 'Could not open Google sign-in.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: 'var(--font-ui)',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1.5px solid var(--bg3)',
        padding: '48px 52px',
        width: '100%',
        maxWidth: 380,
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔬</div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.025em',
          marginBottom: 6,
        }}>
          Science Tutor
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--ink3)',
          marginBottom: 36,
          lineHeight: 1.6,
        }}>
          NCERT Class 10 · AI-powered tutor<br />
          Your progress syncs across all devices
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 20px',
            borderRadius: 100,
            border: '1.5px solid var(--bg3)',
            background: loading ? 'var(--bg2)' : 'var(--surface)',
            cursor: loading ? 'default' : 'pointer',
            fontFamily: 'var(--font-ui)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            transition: 'all 0.15s',
            boxShadow: loading ? 'none' : 'var(--shadow)',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = 'var(--purple)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg3)' }}
        >
          {/* Google logo SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.84-1.6 2.4v2h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.06-1.12-.15-1.52z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          {loading ? 'Opening Google…' : 'Continue with Google'}
        </button>

        {error && (
          <div style={{
            marginTop: 16,
            padding: '9px 12px',
            borderRadius: 'var(--radius)',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}

        <p style={{
          marginTop: 28,
          fontSize: 11,
          color: 'var(--ink4)',
          lineHeight: 1.7,
        }}>
          By signing in you agree to our terms of service.<br />
          Your data is private and only visible to you.
        </p>
      </div>
    </div>
  )
}
