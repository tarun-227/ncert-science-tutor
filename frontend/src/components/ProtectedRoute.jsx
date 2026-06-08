import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Loading from './Loading'

/**
 * Auth + onboarding gate. Onboarding status comes from AuthContext, where the
 * DB profile is authoritative (localStorage is only a fallback), so an existing
 * account that already onboarded is never asked to onboard again on re-login.
 * - user === undefined OR onboardingDone === undefined → loading (resolving)
 * - onboardingDone false → redirect to /onboarding (has sign-in buttons)
 * - onboardingDone true → render children
 */
export default function ProtectedRoute({ children }) {
  const { user, onboardingDone } = useAuth()

  // Still resolving auth state or the DB onboarding check
  if (user === undefined || onboardingDone === undefined) {
    return <Loading />
  }

  if (!onboardingDone) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
