import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading; null = logged out; object = logged in
  const [user, setUser]       = useState(undefined)
  const [session, setSession] = useState(null)

  useEffect(() => {
    let resolved = false

    // Hard timeout — if Supabase doesn't respond in 2s, proceed as logged out
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        setUser(null)
      }
    }, 2000)

    const resolve = (sess) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
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
