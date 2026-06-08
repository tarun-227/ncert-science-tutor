// Study plan store — Supabase only, no localStorage
import { supabase, getCurrentUser } from './supabase'

async function getUserId() {
  const user = await getCurrentUser()
  return user?.id || null
}

// ── One-time migration of old localStorage section completion data ─────────────
// Runs once per session (guarded by a module-level flag). Reads any
// ch-{N}-doneSections keys left by the old code, upserts them into Supabase,
// then removes the localStorage keys so they don't migrate again.
let _migrationDone = false
export async function migrateOldSectionCompletion() {
  if (_migrationDone) return
  _migrationDone = true
  try {
    const userId = await getUserId()
    if (!userId) return
    const keysToMigrate = Object.keys(localStorage).filter(k => /^ch-\d+-doneSections$/.test(k))
    if (!keysToMigrate.length) return
    for (const key of keysToMigrate) {
      const chapterId = parseInt(key.match(/ch-(\d+)-doneSections/)[1])
      const raw = localStorage.getItem(key)
      const indices = raw ? JSON.parse(raw) : []
      if (!Array.isArray(indices) || !indices.length) { localStorage.removeItem(key); continue }
      const rows = indices.map(i => ({ user_id: userId, chapter_id: chapterId, section_index: i }))
      await supabase.from('section_completion').upsert(rows, { onConflict: 'user_id,chapter_id,section_index' })
      localStorage.removeItem(key)
    }
  } catch { /* silent — stale local data isn't critical */ }
}

// ═══════════════════════════════════════════════════════════
// STUDY PLANS
// ═══════════════════════════════════════════════════════════

export async function loadPlansAsync() {
  try {
    const userId = await getUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('study_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      selections: row.selections,
      hoursPerDay: row.hours_per_day,
      target: row.target_date,
      createdAt: row.created_at?.slice(0, 10),
    }))
  } catch {
    return []
  }
}

export async function upsertPlanAsync(plan) {
  try {
    const userId = await getUserId()
    if (!userId) return []

    await supabase.from('study_plans').upsert({
      id: plan.id,
      user_id: userId,
      name: plan.name,
      selections: plan.selections,
      hours_per_day: plan.hoursPerDay,
      target_date: plan.target,
    }, { onConflict: 'id' })
  } catch (e) {
    console.warn('[plans] DB upsert failed:', e)
  }
  return loadPlansAsync()
}

export async function deletePlanAsync(planId) {
  try {
    await supabase.from('study_plans').delete().eq('id', planId)
  } catch (e) {
    console.warn('[plans] DB delete failed:', e)
  }
  return loadPlansAsync()
}


// ═══════════════════════════════════════════════════════════
// SECTION COMPLETION
// ═══════════════════════════════════════════════════════════

export async function getDoneSectionsAsync(chapterId) {
  try {
    const userId = await getUserId()
    if (!userId) return []

    const { data, error } = await supabase
      .from('section_completion')
      .select('section_index')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)

    if (error) throw error
    return (data || []).map(r => r.section_index)
  } catch {
    return []
  }
}

// Fetch done section indices for multiple chapters in one query (used by PlanCard)
export async function getDoneSectionsForChapters(chapterIds) {
  if (!chapterIds.length) return {}
  try {
    const userId = await getUserId()
    if (!userId) return {}

    const { data, error } = await supabase
      .from('section_completion')
      .select('chapter_id, section_index')
      .eq('user_id', userId)
      .in('chapter_id', chapterIds)

    if (error) throw error
    const result = {}
    for (const r of (data || [])) {
      if (!result[r.chapter_id]) result[r.chapter_id] = []
      result[r.chapter_id].push(r.section_index)
    }
    return result
  } catch {
    return {}
  }
}

export async function markSectionDoneAsync(chapterId, sectionIndex) {
  try {
    const userId = await getUserId()
    if (!userId) return []
    await supabase.from('section_completion').upsert({
      user_id: userId,
      chapter_id: chapterId,
      section_index: sectionIndex,
    }, { onConflict: 'user_id,chapter_id,section_index' })
  } catch (e) {
    console.warn('[completion] DB upsert failed:', e)
  }
  return getDoneSectionsAsync(chapterId)
}

export async function unmarkSectionDoneAsync(chapterId, sectionIndex) {
  try {
    const userId = await getUserId()
    if (!userId) return []
    await supabase.from('section_completion')
      .delete()
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .eq('section_index', sectionIndex)
  } catch (e) {
    console.warn('[completion] DB delete failed:', e)
  }
  return getDoneSectionsAsync(chapterId)
}


// ═══════════════════════════════════════════════════════════
// TUTOR SUMMARY CACHE
// ═══════════════════════════════════════════════════════════

export async function getCachedSummary(chapterId, sectionId, depth) {
  try {
    const { data, error } = await supabase
      .from('tutor_summaries')
      .select('summary')
      .eq('chapter_id', chapterId)
      .eq('section_id', sectionId)
      .eq('depth', depth)
      .maybeSingle()
    if (error || !data) return null
    return data.summary
  } catch { return null }
}

export async function saveSummaryCache(chapterId, sectionId, depth, summary) {
  try {
    await supabase.from('tutor_summaries').upsert({
      chapter_id: chapterId,
      section_id: sectionId,
      depth,
      summary,
    }, { onConflict: 'chapter_id,section_id,depth' })
  } catch {}
}


// ═══════════════════════════════════════════════════════════
// TIME ESTIMATION
// ═══════════════════════════════════════════════════════════

const SECTION_MINUTES = {
  Chemistry: 8, Physics: 8, Biology: 7, 'Environmental Science': 6, English: 5,
}

export function chapterMinutes(chapter) {
  const perSection = SECTION_MINUTES[chapter.subject] || 6
  return (chapter.subtopic_count || 4) * perSection
}
