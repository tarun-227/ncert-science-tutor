import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchUserProfile } from '../lib/userdata'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading; null = logged out; object = logged in
  const [user, setUser]       = useState(undefined)
  const [session, setSession] = useState(null)
  // undefined = not yet resolved; true/false = whether onboarding is complete.
  // The DB profile is authoritative — localStorage is only a cache/fallback.
  const [onboardingDone, setOnboardingDone] = useState(undefined)

  useEffect(() => {
    let resolved = false

    // Hard timeout — if Supabase doesn't respond in 3s, proceed as logged out
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        setUser(null)
      }
    }, 3000)

    const resolve = async (sess) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        // If no session but onboarding is done, sign in anonymously so DB writes work
        if (!sess && localStorage.getItem('onboarding-done')) {
          try {
            const { data, error } = await supabase.auth.signInAnonymously()
            if (!error && data?.session) {
              setSession(data.session)
              setUser(data.session.user)
              return
            }
          } catch { /* anonymous auth not enabled — fall through */ }
        }
        setSession(sess)
        setUser(sess?.user ?? null)
      }
    }

    // Try getting session
    try {
      supabase.auth.getSession()
        .then(({ data: { session } }) => resolve(session))
        .catch(() => resolve(null))
    } catch {
      resolve(null)
    }

    // Listen for auth changes (login/logout/refresh)
    let subscription
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
      })
      subscription = data.subscription
    } catch {
      // Supabase not configured — ignore
    }

    return () => {
      clearTimeout(timeout)
      subscription?.unsubscribe?.()
    }
  }, [])

  // Resolve onboarding status whenever the signed-in account changes.
  // For a real (non-anonymous) user the DB profile decides — so an existing
  // account that already onboarded is never asked to onboard again, and a
  // brand-new account always is. localStorage is only a fast fallback.
  const userKey = user === undefined ? '__loading__' : user === null ? '__none__' : user.id
  useEffect(() => {
    if (user === undefined) return // auth still resolving
    if (user === null) {
      setOnboardingDone(!!localStorage.getItem('onboarding-done'))
      return
    }
    if (user.is_anonymous) {
      setOnboardingDone(!!localStorage.getItem('onboarding-done'))
      return
    }
    let cancelled = false
    setOnboardingDone(undefined) // show loading until the DB answers
    fetchUserProfile()
      .then(p => {
        if (cancelled) return
        const done = !!(p && p.onboardingDone)
        setOnboardingDone(done)
        if (done) localStorage.setItem('onboarding-done', 'true')
        else localStorage.removeItem('onboarding-done')
      })
      .catch(() => { if (!cancelled) setOnboardingDone(!!localStorage.getItem('onboarding-done')) })
    return () => { cancelled = true }
  }, [userKey])

  // Called by the onboarding wizard on completion so the gate opens immediately.
  const markOnboardingDone = () => {
    localStorage.setItem('onboarding-done', 'true')
    setOnboardingDone(true)
  }

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: 'select_account' },
      },
    })

  const signInWithLinkedin = () =>
    supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: `${window.location.origin}/` },
    })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, session, onboardingDone, markOnboardingDone, signInWithGoogle, signInWithLinkedin, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
