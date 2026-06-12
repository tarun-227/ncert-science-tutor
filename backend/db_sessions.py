"""Supabase-backed chat session management.

Replaces the in-memory sessions.py dict with persistent Supabase rows so
that chat history survives server restarts (Railway sleeps, redeploys, etc.).

Falls back gracefully to the in-memory store when Supabase is not configured
or when the service key doesn't have DB access (e.g. sb_secret_ format keys).
"""
from __future__ import annotations
import backend.sessions as _mem  # in-memory fallback

try:
    from backend.supabase_client import supabase as _sb
except ImportError:
    _sb = None

MAX_HISTORY = 10  # last 10 pairs = 20 messages

import uuid as _uuid

def _valid_uid(user_id: str) -> bool:
    """True only for real Supabase UUIDs. Placeholder ids like "anonymous"
    or "dev-user" would fail the uuid column / auth.users FK, so we skip the
    DB and let the in-memory store handle those sessions."""
    try:
        _uuid.UUID(str(user_id))
        return True
    except (ValueError, TypeError):
        return False

def _use_db(user_id: str = None) -> bool:
    if _sb is None:
        return False
    if user_id is not None and not _valid_uid(user_id):
        return False
    return True


# ── Session management ────────────────────────────────────────────────────────

def get_or_create(session_id: str, user_id: str = "anonymous", chapter_id: int = 0) -> dict:
    """Ensure a chat_sessions row exists and return it."""
    if not _use_db(user_id):
        return _mem.get_or_create(session_id)
    try:
        # Use limit(1) rather than maybe_single(): in some postgrest-py versions
        # maybe_single().execute() returns None on zero rows, which then crashes
        # on `.data` and silently drops the write to the in-memory fallback.
        res = _sb.table("chat_sessions").select("*").eq("id", session_id).limit(1).execute()
        if res.data:
            return res.data[0]
        new = _sb.table("chat_sessions").insert({
            "id":         session_id,
            "user_id":    user_id,
            "chapter_id": chapter_id,
        }).execute()
        global _db_available
        _db_available = True  # first successful call confirms DB works
        return new.data[0] if new.data else {}
    except Exception as exc:
        print(f"[db_sessions] DB error (falling back to in-memory): {exc}")
        return _mem.get_or_create(session_id)


def set_context(session_id: str, chapter_id: int | None, subtopic_id: str | None,
                user_id: str = "anonymous") -> None:
    """Update the chapter + subtopic context for a session."""
    if not _use_db(user_id):
        _mem.set_context(session_id, chapter_id, subtopic_id)
        return
    try:
        _sb.table("chat_sessions").update({
            "chapter_id":  chapter_id,
            "subtopic_id": subtopic_id,
            "last_active": "now()",
        }).eq("id", session_id).execute()
    except Exception as exc:
        print(f"[db_sessions] DB error (falling back to in-memory): {exc}")
        _mem.set_context(session_id, chapter_id, subtopic_id)


def add_message(session_id: str, role: str, content: str,
                user_id: str = "anonymous") -> None:
    """Append a single message to a session."""
    if not _use_db(user_id):
        _mem.add_message(session_id, role, content)
        return
    try:
        _sb.table("chat_messages").insert({
            "session_id": session_id,
            "user_id":    user_id,
            "role":       role,
            "content":    content,
        }).execute()
        _sb.table("chat_sessions").update({"last_active": "now()"}).eq("id", session_id).execute()
    except Exception as exc:
        print(f"[db_sessions] DB error (falling back to in-memory): {exc}")
        _mem.add_message(session_id, role, content)


def get_history(session_id: str) -> list[dict]:
    """Return the last MAX_HISTORY*2 messages as [{role, content}]."""
    if not _use_db():
        return _mem.get_history(session_id)
    try:
        res = (
            _sb.table("chat_messages")
            .select("role, content")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .limit(MAX_HISTORY * 2)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        print(f"[db_sessions] DB error (falling back to in-memory): {exc}")
        return _mem.get_history(session_id)


def clear(session_id: str) -> None:
    """Delete all messages for a session."""
    if not _use_db():
        _mem.clear(session_id)
        return
    try:
        _sb.table("chat_messages").delete().eq("session_id", session_id).execute()
    except Exception as exc:
        print(f"[db_sessions] DB error (falling back to in-memory): {exc}")
        _mem.clear(session_id)
