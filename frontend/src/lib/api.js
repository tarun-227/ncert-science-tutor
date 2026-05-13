/**
 * apiFetch — drop-in replacement for fetch() that automatically attaches
 * the Supabase JWT as an Authorization header.
 *
 * Usage (same as fetch):
 *   const res = await apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({...}) })
 */
import { supabase } from './supabase'

export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  return fetch(path, { ...options, headers })
}
