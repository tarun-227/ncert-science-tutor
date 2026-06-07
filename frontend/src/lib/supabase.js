import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:   true,  // stores session in localStorage automatically
    autoRefreshToken: true,
  },
})

// Last time we minted a fresh token, in *local* monotonic-ish ms.
let lastRefreshAt = 0
const REFRESH_EVERY_MS = 5 * 60 * 1000 // 5 min ≪ the 60-min server token lifetime

/**
 * Resolve the current authed user resiliently.
 *
 * Prefer `getSession()` (reads the locally-stored session) over `getUser()`
 * (a network call to /auth/v1/user that 403s once the access token expires and
 * does NOT auto-refresh).
 *
 * Crucially, we refresh based on *elapsed local time* rather than the token's
 * absolute `expires_at`. Some devices have a skewed clock (observed ~2.5h
 * behind the auth server) — supabase-js then believes the token is still valid
 * and never refreshes, while the server rejects it as expired ("JWT expired").
 * Comparing `Date.now()` deltas cancels any constant offset, so we re-mint the
 * token at least every 5 minutes of activity, well within its 60-minute life.
 *
 * Returns the user object, or null if there's no usable session.
 */
export async function getCurrentUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    if (Date.now() - lastRefreshAt > REFRESH_EVERY_MS) {
      const { data, error } = await supabase.auth.refreshSession()
      lastRefreshAt = Date.now()
      if (!error && data?.session) return data.session.user
    }
    return session.user || null
  } catch {
    return null
  }
}
