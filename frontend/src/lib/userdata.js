/**
 * userdata.js — all Supabase student-data helpers.
 *
 * Every function follows the same pattern:
 *   1. Try Supabase (authoritative)
 *   2. On success, sync result back to localStorage as a local cache
 *   3. On error, fall back to localStorage so the app still works offline
 */
import { supabase } from './supabase'

// ── Read Progress ─────────────────────────────────────────────────────────────

export async function fetchReadSections(chapterId) {
  try {
    const { data, error } = await supabase
      .from('read_progress')
      .select('section_id')
      .eq('chapter_id', chapterId)
    if (error) throw error
    const result = new Set(data.map(r => r.section_id))
    localStorage.setItem(`ch-${chapterId}-readSections`, JSON.stringify([...result]))
    return result
  } catch {
    try {
      const raw = localStorage.getItem(`ch-${chapterId}-readSections`)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  }
}

export async function toggleReadSection(chapterId, sectionId, isRead) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (isRead) {
      await supabase.from('read_progress').upsert(
        { user_id: user.id, chapter_id: chapterId, section_id: sectionId },
        { onConflict: 'user_id,chapter_id,section_id' }
      )
    } else {
      await supabase.from('read_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('chapter_id', chapterId)
        .eq('section_id', sectionId)
    }
  } catch { /* silent — local state already updated optimistically */ }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function fetchNotes(chapterId) {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('section_id, content')
      .eq('chapter_id', chapterId)
    if (error) throw error
    const result = Object.fromEntries(data.map(r => [r.section_id, r.content]))
    localStorage.setItem(`notes-ch-${chapterId}`, JSON.stringify(result))
    return result
  } catch {
    try {
      const raw = localStorage.getItem(`notes-ch-${chapterId}`)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }
}

export async function saveNote(chapterId, sectionId, content) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notes').upsert(
      { user_id: user.id, chapter_id: chapterId, section_id: sectionId, content },
      { onConflict: 'user_id,chapter_id,section_id' }
    )
  } catch { /* silent */ }
}

// ── Highlights ────────────────────────────────────────────────────────────────

export async function fetchHighlights(chapterId) {
  try {
    const { data, error } = await supabase
      .from('highlights')
      .select('paragraph_id')
      .eq('chapter_id', chapterId)
    if (error) throw error
    const result = Object.fromEntries(data.map(r => [r.paragraph_id, true]))
    localStorage.setItem(`st3_hl_${chapterId}`, JSON.stringify(result))
    return result
  } catch {
    try {
      const raw = localStorage.getItem(`st3_hl_${chapterId}`)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }
}

export async function toggleHighlight(chapterId, paragraphId, isHighlighted) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (isHighlighted) {
      await supabase.from('highlights').upsert(
        { user_id: user.id, chapter_id: chapterId, paragraph_id: paragraphId },
        { onConflict: 'user_id,chapter_id,paragraph_id' }
      )
    } else {
      await supabase.from('highlights')
        .delete()
        .eq('user_id', user.id)
        .eq('chapter_id', chapterId)
        .eq('paragraph_id', paragraphId)
    }
  } catch { /* silent */ }
}

// ── Aggregate progress (all chapters) — for LandingPage ──────────────────────

export async function fetchAllChapterProgress() {
  try {
    const { data, error } = await supabase
      .from('read_progress')
      .select('chapter_id')
    if (error) throw error
    const counts = {}
    data.forEach(r => { counts[r.chapter_id] = (counts[r.chapter_id] || 0) + 1 })
    return counts  // { 3: 4, 5: 2, ... }
  } catch { return {} }
}

// ── Tutor saved notes (array of snippets per section) ────────────────────────
// Stored in the notes table — the array is JSON-serialized into `content`.

export async function fetchTutorNotes(chapterId, sectionId) {
  const tSectionId = `_t:${sectionId}`
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('content')
      .eq('chapter_id', chapterId)
      .eq('section_id', tSectionId)
      .maybeSingle()
    if (error || !data) throw new Error('miss')
    const arr = JSON.parse(data.content)
    localStorage.setItem(`tnotes-${chapterId}-${sectionId}`, data.content)
    return Array.isArray(arr) ? arr : []
  } catch {
    try {
      const raw = localStorage.getItem(`tnotes-${chapterId}-${sectionId}`)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch { return [] }
  }
}

export async function saveTutorNotes(chapterId, sectionId, notesArray) {
  const tSectionId = `_t:${sectionId}`
  const json = JSON.stringify(notesArray)
  localStorage.setItem(`tnotes-${chapterId}-${sectionId}`, json)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notes').upsert(
      { user_id: user.id, chapter_id: chapterId, section_id: tSectionId, content: json },
      { onConflict: 'user_id,chapter_id,section_id' }
    )
  } catch { /* silent */ }
}

// ── User Profile (onboarding data) ───────────────────────────────────────────

export async function saveUserProfile(profileData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      localStorage.setItem('onboarding-data', JSON.stringify(profileData))
      return
    }
    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      name: profileData.name || '',
      class: profileData.cls || 'X',
      board: profileData.board || 'CBSE',
      school: profileData.school || '',
      ratings: profileData.ratings || {},
      tough_subjects: profileData.tough || [],
      pace: profileData.pace || 'balanced',
      onboarding_done: true,
    }, { onConflict: 'user_id' })
    localStorage.setItem('onboarding-data', JSON.stringify(profileData))
    localStorage.setItem('onboarding-done', 'true')
  } catch {
    localStorage.setItem('onboarding-data', JSON.stringify(profileData))
    localStorage.setItem('onboarding-done', 'true')
  }
}

export async function fetchUserProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !data) return null
    return {
      name: data.name,
      cls: data.class,
      board: data.board,
      school: data.school,
      ratings: data.ratings || {},
      tough: data.tough_subjects || [],
      pace: data.pace,
      onboardingDone: data.onboarding_done,
    }
  } catch { return null }
}

// ── Local → Supabase migration (one-time, called from migration banner) ───────

export async function migrateLocalDataToSupabase() {
  for (let chId = 1; chId <= 13; chId++) {
    // Notes
    try {
      const raw = localStorage.getItem(`notes-ch-${chId}`)
      if (raw) {
        const notes = JSON.parse(raw)
        for (const [sectionId, content] of Object.entries(notes)) {
          if (content) await saveNote(chId, sectionId, content)
        }
      }
    } catch { /* skip */ }

    // Read sections
    try {
      const raw = localStorage.getItem(`ch-${chId}-readSections`)
      if (raw) {
        const sections = JSON.parse(raw)
        for (const sectionId of sections) {
          await toggleReadSection(chId, sectionId, true)
        }
      }
    } catch { /* skip */ }

    // Highlights
    try {
      const raw = localStorage.getItem(`st3_hl_${chId}`)
      if (raw) {
        const hl = JSON.parse(raw)
        for (const paragraphId of Object.keys(hl)) {
          await toggleHighlight(chId, paragraphId, true)
        }
      }
    } catch { /* skip */ }
  }
}
