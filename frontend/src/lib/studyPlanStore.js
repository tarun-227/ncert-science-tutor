// Study plan store — Supabase-backed with localStorage fallback
// ──────────────────────────────────────────────────────────────
import { supabase } from './supabase'

const LS_PLANS = 'study-plans'

// ─── Helper: get current user id ───────────────────────────
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

// ═══════════════════════════════════════════════════════════
// STUDY PLANS
// ═══════════════════════════════════════════════════════════

// Load from Supabase, fall back to localStorage
export async function loadPlansAsync() {
  try {
    const userId = await getUserId()
    if (!userId) return loadPlansLocal()

    const { data, error } = await supabase
      .from('study_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Normalise DB rows → client shape
    const dbPlans = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      selections: row.selections,
      hoursPerDay: row.hours_per_day,
      target: row.target_date,
      createdAt: row.created_at?.slice(0, 10),
    }))

    // Merge: DB is authoritative for plans it knows about, but keep any
    // local-only plans that never made it to DB (e.g. during an RLS error or
    // offline upsert failure). This prevents plans from vanishing when DB
    // returns an empty list due to a write that never persisted.
    const localPlans = loadPlansLocal()
    const dbIds = new Set(dbPlans.map(p => p.id))
    const localOnly = localPlans.filter(p => !dbIds.has(p.id))
    const merged = [...dbPlans, ...localOnly]

    localStorage.setItem(LS_PLANS, JSON.stringify(merged))
    return merged
  } catch {
    return loadPlansLocal()
  }
}

export function loadPlansLocal() {
  try {
    const raw = localStorage.getItem(LS_PLANS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export async function upsertPlanAsync(plan) {
  // Optimistic local update first
  const localPlans = loadPlansLocal()
  const idx = localPlans.findIndex(p => p.id === plan.id)
  if (idx >= 0) localPlans[idx] = plan
  else localPlans.unshift(plan)
  localStorage.setItem(LS_PLANS, JSON.stringify(localPlans))

  // Persist to Supabase
  try {
    const userId = await getUserId()
    if (!userId) return localPlans

    await supabase.from('study_plans').upsert({
      id: plan.id,
      user_id: userId,
      name: plan.name,
      selections: plan.selections,
      hours_per_day: plan.hoursPerDay,
      target_date: plan.target,
    }, { onConflict: 'id' })
  } catch (e) {
    console.warn('[plans] DB upsert failed, kept local:', e)
  }
  return localPlans
}

export async function deletePlanAsync(planId) {
  const localPlans = loadPlansLocal().filter(p => p.id !== planId)
  localStorage.setItem(LS_PLANS, JSON.stringify(localPlans))

  try {
    await supabase.from('study_plans').delete().eq('id', planId)
  } catch (e) {
    console.warn('[plans] DB delete failed:', e)
  }
  return localPlans
}


// ═══════════════════════════════════════════════════════════
// SECTION COMPLETION
// ═══════════════════════════════════════════════════════════

export async function getDoneSectionsAsync(chapterId) {
  try {
    const userId = await getUserId()
    if (!userId) return getDoneSectionsLocal(chapterId)

    const { data, error } = await supabase
      .from('section_completion')
      .select('section_index')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)

    if (error) throw error
    const indices = (data || []).map(r => r.section_index)
    localStorage.setItem(`ch-${chapterId}-doneSections`, JSON.stringify(indices))
    return indices
  } catch {
    return getDoneSectionsLocal(chapterId)
  }
}

export function getDoneSectionsLocal(chapterId) {
  try {
    const raw = localStorage.getItem(`ch-${chapterId}-doneSections`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// Keep sync version for immediate UI updates (writes local, fires DB async)
export function getDoneSections(chapterId) {
  return getDoneSectionsLocal(chapterId)
}

export async function markSectionDoneAsync(chapterId, sectionIndex) {
  // Local first
  const done = getDoneSectionsLocal(chapterId)
  if (!done.includes(sectionIndex)) {
    done.push(sectionIndex)
    localStorage.setItem(`ch-${chapterId}-doneSections`, JSON.stringify(done))
  }

  // DB async
  try {
    const userId = await getUserId()
    if (!userId) return done
    await supabase.from('section_completion').upsert({
      user_id: userId,
      chapter_id: chapterId,
      section_index: sectionIndex,
    }, { onConflict: 'user_id,chapter_id,section_index' })
  } catch (e) {
    console.warn('[completion] DB upsert failed:', e)
  }
  return done
}

// Sync alias used internally
export function markSectionDone(chapterId, sectionIndex) {
  const done = getDoneSectionsLocal(chapterId)
  if (!done.includes(sectionIndex)) {
    done.push(sectionIndex)
    localStorage.setItem(`ch-${chapterId}-doneSections`, JSON.stringify(done))
  }
  // Fire-and-forget DB write
  markSectionDoneAsync(chapterId, sectionIndex)
  return done
}

export function isChapterComplete(chapterId, fallbackTotal) {
  const done = getDoneSectionsLocal(chapterId)
  const stored = parseInt(localStorage.getItem(`ch-${chapterId}-totalSections`) || '0')
  const total = stored > 0 ? stored : fallbackTotal
  return total > 0 && done.length >= total
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
// PLAN SYNC (chapter completion → plan progress)
// ═══════════════════════════════════════════════════════════

// Cache the actual rich-section count so isChapterComplete uses the right threshold.
export function syncPlanCompletions(chapterId, totalSections) {
  if (totalSections > 0) {
    localStorage.setItem(`ch-${chapterId}-totalSections`, String(totalSections))
  }
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
