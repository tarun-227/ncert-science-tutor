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
    if (isRead) {
      await supabase.from('read_progress').upsert(
        { chapter_id: chapterId, section_id: sectionId },
        { onConflict: 'user_id,chapter_id,section_id' }
      )
    } else {
      await supabase.from('read_progress')
        .delete()
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
    await supabase.from('notes').upsert(
      { chapter_id: chapterId, section_id: sectionId, content },
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
    if (isHighlighted) {
      await supabase.from('highlights').upsert(
        { chapter_id: chapterId, paragraph_id: paragraphId },
        { onConflict: 'user_id,chapter_id,paragraph_id' }
      )
    } else {
      await supabase.from('highlights')
        .delete()
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
