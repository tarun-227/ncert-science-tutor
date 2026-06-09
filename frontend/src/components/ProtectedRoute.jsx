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

  // Local-dev convenience: skip the auth/onboarding gate so the UI can be
  // previewed on `npm run dev` without signing in. import.meta.env.DEV is
  // false in production builds, so Railway still enforces onboarding fully.
  if (import.meta.env.DEV) {
    return children
  }

  // Still resolving auth state or the DB onboarding check
  if (user === undefined || onboardingDone === undefined) {
    return <Loading />
  }

  if (!onboardingDone) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
