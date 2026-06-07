import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading; null = logged out; object = logged in
  const [user, setUser]       = useState(undefined)
  const [session, setSession] = useState(null)

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

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })

  const signInWithLinkedin = () =>
    supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: `${window.location.origin}/` },
    })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, session, signInWithGoogle, signInWithLinkedin, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
