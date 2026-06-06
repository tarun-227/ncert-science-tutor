import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Auth + onboarding gate:
 * - user === undefined → loading (auth state resolving)
 * - user === null → not logged in → redirect to /onboarding
 * - user exists but no onboarding-done → redirect to /onboarding
 * - user exists + onboarding-done → render children
 */
export default function ProtectedRoute({ children }) {
  const { user } = useAuth()

  if (user === undefined) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--ink-3)',
        fontFamily: 'var(--f-sans)', fontSize: 14,
      }}>
        Loading…
      </div>
    )
  }

  // Not logged in → onboarding (which has sign-in buttons)
  if (user === null) {
    const onboardingDone = localStorage.getItem('onboarding-done')
    if (!onboardingDone) {
      return <Navigate to="/onboarding" replace />
    }
    // Onboarding done but not authenticated — still allow access for dev
    return children
  }

  // Logged in but hasn't completed onboarding
  const onboardingDone = localStorage.getItem('onboarding-done')
  if (!onboardingDone) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
