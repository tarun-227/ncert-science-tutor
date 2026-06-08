"""Load and query ncert_chapters.json."""
import json
from pathlib import Path
from functools import lru_cache

DATA_FILE = Path("data/ncert_chapters.json")


@lru_cache(maxsize=1)
def load_chapters() -> list[dict]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def get_chapter(chapter_id: int) -> dict | None:
    for c in load_chapters():
        if c["id"] == chapter_id:
            return c
    return None


def get_subtopic(chapter_id: int, subtopic_id: str) -> dict | None:
    chapter = get_chapter(chapter_id)
    if not chapter:
        return None
    # 1. Exact match (works for old ncert subtopic IDs like "3.1.1")
    for section in chapter.get("sections", []):
        for sub in section.get("subtopics", []):
            if sub["id"] == subtopic_id:
                return {"section": section["title"], "subtopic": sub}
    # 2. Section-level prefix fallback: rich section ID "3.2" → matches "3.2.1", "3.2.2" …
    prefix = subtopic_id + "."
    matched_subs: list[dict] = []
    section_title: str | None = None
    for section in chapter.get("sections", []):
        for sub in section.get("subtopics", []):
            if sub["id"].startswith(prefix):
                matched_subs.append(sub)
                section_title = section["title"]
    if matched_subs:
        combined = "\n\n".join(
            f"{sub['title']}: {sub.get('content', '')}" for sub in matched_subs
        )
        return {
            "section": section_title,
            "subtopic": {
                "id": subtopic_id,
                "title": section_title or matched_subs[0]["title"],
                "content": combined,
            },
        }
    return None


def get_exercise(chapter_id: int, ex_id: str) -> dict | None:
    chapter = get_chapter(chapter_id)
    if not chapter:
        return None
    for ex in chapter.get("exercises", []):
        if ex["id"] == ex_id:
            return ex
    return None


@lru_cache(maxsize=64)
def rich_section_count(chapter_id: int) -> int | None:
    """Number of sections StudyView actually renders for a chapter.

    StudyView reads ch{id}_rich.json (the /rich endpoint), which dedups
    sections by id. This can differ from the basic ncert_chapters.json — e.g.
    a stray exercise line sometimes leaks into the basic sections list. The
    completion UI indexes into these rich sections, so progress must be
    measured against this count. Returns None when no rich file exists.
    """
    rich_path = Path(f"data/ch{chapter_id}_rich.json")
    if not rich_path.exists():
        return None
    try:
        data = json.loads(rich_path.read_text(encoding="utf-8"))
        return len({s["id"] for s in data.get("sections", [])})
    except Exception:
        return None


def chapters_summary() -> list[dict]:
    """Lightweight list for landing page."""
    result = []
    for c in load_chapters():
        # Prefer the rich section count (what StudyView renders and what the
        # completion UI marks); fall back to the basic list if no rich file.
        rich_count = rich_section_count(c["id"])
        section_count = rich_count if rich_count is not None else len(c.get("sections", []))
        subtopic_count = sum(len(s.get("subtopics", [])) for s in c.get("sections", []))
        exercise_count = len(c.get("exercises", []))
        result.append({
            "id":             c["id"],
            "title":          c["title"],
            "subject":        c["subject"],
            "section_count":  section_count,
            "subtopic_count": subtopic_count,
            "exercise_count": exercise_count,
        })
    return result
