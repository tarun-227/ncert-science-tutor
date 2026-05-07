"""In-memory chat session management."""
from typing import Optional

# session_id → {messages: [...], chapter_id: int, subtopic_id: str}
_sessions: dict[str, dict] = {}
MAX_HISTORY = 10  # keep last 10 message pairs


def get_or_create(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {"messages": [], "chapter_id": None, "subtopic_id": None}
    return _sessions[session_id]


def add_message(session_id: str, role: str, content: str):
    s = get_or_create(session_id)
    s["messages"].append({"role": role, "content": content})
    # Keep sliding window
    if len(s["messages"]) > MAX_HISTORY * 2:
        s["messages"] = s["messages"][-(MAX_HISTORY * 2):]


def get_history(session_id: str) -> list:
    return get_or_create(session_id)["messages"]


def set_context(session_id: str, chapter_id: Optional[int], subtopic_id: Optional[str]):
    s = get_or_create(session_id)
    s["chapter_id"] = chapter_id
    s["subtopic_id"] = subtopic_id


def clear(session_id: str):
    _sessions[session_id] = {"messages": [], "chapter_id": None, "subtopic_id": None}
