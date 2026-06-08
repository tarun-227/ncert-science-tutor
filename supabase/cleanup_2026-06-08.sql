-- ============================================================================
-- Schema cleanup — 2026-06-08
-- Run in Supabase SQL editor. Review each section before running.
-- Wrapped in a transaction: if anything fails, nothing is applied.
-- ============================================================================
BEGIN;

-- ── Part A: Repoint chat tables from public.profiles → auth.users ────────────
-- These tables are USED by the backend (db_sessions.py). They currently FK to
-- public.profiles, which is never populated, so every insert failed the FK and
-- chat history silently fell back to in-memory (lost on restart).

ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Part B: Drop dead tables (zero references in frontend or backend) ─────────
-- If any of these is a placeholder for a planned feature, comment it out.

DROP TABLE IF EXISTS public.ui_preferences;
DROP TABLE IF EXISTS public.practice_attempts;
DROP TABLE IF EXISTS public.exercise_attempts;
DROP TABLE IF EXISTS public.study_streaks;

-- ── Part C: Drop the redundant profiles table ────────────────────────────────
-- The app uses public.user_profiles for all profile data. public.profiles is
-- unused. After Parts A & B nothing references it, so it can go.
-- (If a handle_new_user trigger populates it, drop that trigger first.)

DROP TABLE IF EXISTS public.profiles;

COMMIT;

-- ============================================================================
-- Part D: VERIFY (run separately, read-only) — confirm the upsert tables have
-- the UNIQUE constraints the app's .upsert(onConflict) calls depend on.
-- Each row below should return exactly one matching unique constraint.
-- ============================================================================
-- SELECT conrelid::regclass AS table, conname, pg_get_constraintdef(oid)
-- FROM   pg_constraint
-- WHERE  contype = 'u'
--   AND  conrelid::regclass::text IN (
--     'public.read_progress', 'public.notes', 'public.highlights',
--     'public.section_completion', 'public.tutor_summaries'
--   )
-- ORDER  BY 1;
--
-- Expected:
--   read_progress      UNIQUE (user_id, chapter_id, section_id)
--   notes              UNIQUE (user_id, chapter_id, section_id)
--   highlights         UNIQUE (user_id, chapter_id, paragraph_id)
--   section_completion UNIQUE (user_id, chapter_id, section_index)
--   tutor_summaries    UNIQUE (chapter_id, section_id, depth)
--
-- If any are missing, add them, e.g.:
--   ALTER TABLE public.section_completion
--     ADD CONSTRAINT section_completion_uniq UNIQUE (user_id, chapter_id, section_index);
