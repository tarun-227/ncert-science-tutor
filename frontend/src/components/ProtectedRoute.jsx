import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Wrap any route with <ProtectedRoute> to redirect unauthenticated users to /auth.
 * Shows a loading state while the auth session is being retrieved (user === undefined).
 */
export default function ProtectedRoute({ children }) {
  const { user } = useAuth()

  if (user === undefined) {
    // Auth state is still loading — show a neutral spinner so there's no flash of wrong content
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--ink3)',
        fontFamily: 'var(--font-ui)', fontSize: 14,
      }}>
        Loading…
      </div>
    )
  }

  if (user === null) {
    return <Navigate to="/auth" replace />
  }

  return children
}
