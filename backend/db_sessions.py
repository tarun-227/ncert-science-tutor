"""Supabase-backed chat session management.

Replaces the in-memory sessions.py dict with persistent Supabase rows so
that chat history survives server restarts (Railway sleeps, redeploys, etc.).

Falls back gracefully to the in-memory store when Supabase is not configured.
"""
from __future__ import annotations
import backend.sessions as _mem  # in-memory fallback

try:
    from backend.supabase_client import supabase as _sb
except ImportError:
    _sb = None

MAX_HISTORY = 10  # last 10 pairs = 20 messages


def _use_db() -> bool:
    return _sb is not None


# ── Session management ────────────────────────────────────────────────────────

def get_or_create(session_id: str, user_id: str = "anonymous", chapter_id: int = 0) -> dict:
    """Ensure a chat_sessions row exists and return it."""
    if not _use_db():
        return _mem.get_or_create(session_id)
    res = _sb.table("chat_sessions").select("*").eq("id", session_id).maybe_single().execute()
    if res.data:
        return res.data
    new = _sb.table("chat_sessions").insert({
        "id":         session_id,
        "user_id":    user_id,
        "chapter_id": chapter_id,
    }).execute()
    return new.data[0] if new.data else {}


def set_context(session_id: str, chapter_id: int | None, subtopic_id: str | None,
                user_id: str = "anonymous") -> None:
    """Update the chapter + subtopic context for a session."""
    if not _use_db():
        _mem.set_context(session_id, chapter_id, subtopic_id)
        return
    _sb.table("chat_sessions").update({
        "chapter_id":  chapter_id,
        "subtopic_id": subtopic_id,
        "last_active": "now()",
    }).eq("id", session_id).execute()


def add_message(session_id: str, role: str, content: str,
                user_id: str = "anonymous") -> None:
    """Append a single message to a session."""
    if not _use_db():
        _mem.add_message(session_id, role, content)
        return
    _sb.table("chat_messages").insert({
        "session_id": session_id,
        "user_id":    user_id,
        "role":       role,
        "content":    content,
    }).execute()
    # Bump last_active
    _sb.table("chat_sessions").update({"last_active": "now()"}).eq("id", session_id).execute()


def get_history(session_id: str) -> list[dict]:
    """Return the last MAX_HISTORY*2 messages as [{role, content}]."""
    if not _use_db():
        return _mem.get_history(session_id)
    res = (
        _sb.table("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .limit(MAX_HISTORY * 2)
        .execute()
    )
    return res.data or []


def clear(session_id: str) -> None:
    """Delete all messages for a session."""
    if not _use_db():
        _mem.clear(session_id)
        return
    _sb.table("chat_messages").delete().eq("session_id", session_id).execute()
