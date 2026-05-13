import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading auth state; null = logged out; object = logged in
  const [user, setUser]       = useState(undefined)
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Retrieve existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    // Listen for sign-in / sign-out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn          = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp          = (email, password) => supabase.auth.signUp({ email, password })
  const signInMagicLink = (email)           => supabase.auth.signInWithOtp({ email })
  const signOut         = ()                => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signInMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
