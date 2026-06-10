/**
 * userdata.js — all Supabase student-data helpers.
 * Pure Supabase — no localStorage reads or writes for user data.
 */
import { supabase, getCurrentUser } from './supabase'

// ── Read Progress ─────────────────────────────────────────────────────────────

export async function fetchReadSections(chapterId) {
  try {
    const { data, error } = await supabase
      .from('read_progress')
      .select('section_id')
      .eq('chapter_id', chapterId)
    if (error) throw error
    return new Set(data.map(r => r.section_id))
  } catch {
    return new Set()
  }
}

export async function toggleReadSection(chapterId, sectionId, isRead) {
  try {
    const user = await getCurrentUser()
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
  } catch { /* silent */ }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function fetchNotes(chapterId) {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('section_id, content')
      .eq('chapter_id', chapterId)
    if (error) throw error
    return Object.fromEntries(data.map(r => [r.section_id, r.content]))
  } catch {
    return {}
  }
}

export async function saveNote(chapterId, sectionId, content) {
  try {
    const user = await getCurrentUser()
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
    return Object.fromEntries(data.map(r => [r.paragraph_id, true]))
  } catch {
    return {}
  }
}

export async function toggleHighlight(chapterId, paragraphId, isHighlighted) {
  try {
    const user = await getCurrentUser()
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
    return counts
  } catch { return {} }
}

// ── Tutor saved notes (array of snippets per section) ────────────────────────

export async function fetchTutorNotes(chapterId, sectionId) {
  const tSectionId = `_t:${sectionId}`
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('content')
      .eq('chapter_id', chapterId)
      .eq('section_id', tSectionId)
      .maybeSingle()
    if (error || !data) return []
    const arr = JSON.parse(data.content)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export async function saveTutorNotes(chapterId, sectionId, notesArray) {
  const tSectionId = `_t:${sectionId}`
  const json = JSON.stringify(notesArray)
  try {
    const user = await getCurrentUser()
    if (!user) return
    await supabase.from('notes').upsert(
      { user_id: user.id, chapter_id: chapterId, section_id: tSectionId, content: json },
      { onConflict: 'user_id,chapter_id,section_id' }
    )
  } catch { /* silent */ }
}

// ── Profile analytics ─────────────────────────────────────────────────────────

export async function fetchProfileData() {
  try {
    const user = await getCurrentUser()
    if (!user) return { completions: [], notes: [] }
    const [comp, notes] = await Promise.all([
      supabase.from('section_completion')
        .select('chapter_id, section_index, created_at:completed_at')
        .eq('user_id', user.id),
      supabase.from('notes')
        .select('section_id, content, created_at')
        .eq('user_id', user.id)
        .not('section_id', 'like', '_t:%'),
    ])
    return { completions: comp.data || [], notes: notes.data || [] }
  } catch {
    return { completions: [], notes: [] }
  }
}

// ── User Profile (onboarding data) ───────────────────────────────────────────

export async function saveUserProfile(profileData) {
  // Always keep onboarding-data in localStorage as a fast-load cache for the topbar
  localStorage.setItem('onboarding-data', JSON.stringify(profileData))
  localStorage.setItem('onboarding-done', 'true')
  try {
    const user = await getCurrentUser()
    if (!user) return
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
  } catch { /* silent — local cache already saved */ }
}

export async function fetchUserProfile() {
  try {
    const user = await getCurrentUser()
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

// ── One-time migration: localStorage → Supabase ───────────────────────────────
// Runs once per session. Pushes any old localStorage data to Supabase then
// removes those keys so it never migrates the same data twice.

let _migrationDone = false

export async function migrateLocalDataToSupabase() {
  if (_migrationDone) return
  _migrationDone = true

  const user = await getCurrentUser()
  if (!user) return

  for (let chId = 1; chId <= 35; chId++) {
    // Notes
    try {
      const raw = localStorage.getItem(`notes-ch-${chId}`)
      if (raw) {
        const notes = JSON.parse(raw)
        for (const [sectionId, content] of Object.entries(notes)) {
          if (content) await saveNote(chId, sectionId, content)
        }
        localStorage.removeItem(`notes-ch-${chId}`)
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
        localStorage.removeItem(`ch-${chId}-readSections`)
      }
    } catch { /* skip */ }

    // Highlights
    try {
      const raw = localStorage.getItem(`st3_hl_${chId}`)
      if (raw) {
        const hl = JSON.parse(raw)
        for (const paragraphId of Object.keys(hl)) {
          if (hl[paragraphId]) await toggleHighlight(chId, paragraphId, true)
        }
        localStorage.removeItem(`st3_hl_${chId}`)
      }
    } catch { /* skip */ }

    // Tutor notes (tnotes-{chId}-{sectionId})
    try {
      const tKeys = Object.keys(localStorage).filter(k => k.startsWith(`tnotes-${chId}-`))
      for (const key of tKeys) {
        const sectionId = key.replace(`tnotes-${chId}-`, '')
        const raw = localStorage.getItem(key)
        if (raw) {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr) && arr.length) await saveTutorNotes(chId, sectionId, arr)
          localStorage.removeItem(key)
        }
      }
    } catch { /* skip */ }
  }
}
