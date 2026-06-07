"""FastAPI backend — AI Learning Product."""
import json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()  # loads .env from project root in development

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uuid

from fastapi import Depends
from backend import content, chat, sessions, qpaper
import backend.db_sessions as db_sessions
from backend.supabase_client import get_current_user

app = FastAPI(title="NCERT Science Tutor API")

# Serve extracted figure PNGs at /figures/ch1/fig_*.png
FIGURES_DIR = Path("data/figures")
if FIGURES_DIR.exists():
    app.mount("/figures", StaticFiles(directory=str(FIGURES_DIR)), name="figures")


import os

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Chapter endpoints ─────────────────────────────────────────────────────────

@app.get("/api/chapters")
def list_chapters():
    return content.chapters_summary()


@app.get("/api/chapters/{chapter_id}")
def get_chapter(chapter_id: int):
    ch = content.get_chapter(chapter_id)
    if not ch:
        raise HTTPException(404, f"Chapter {chapter_id} not found")
    return ch


# Rich (block-typed) chapter content — all 13 chapters available.
_RICH_CACHE: dict[int, dict] = {}


@app.get("/api/chapters/{chapter_id}/rich")
def get_chapter_rich(chapter_id: int):
    if chapter_id in _RICH_CACHE:
        return _RICH_CACHE[chapter_id]
    rich_path = Path(f"data/ch{chapter_id}_rich.json")
    if not rich_path.exists():
        raise HTTPException(
            404,
            f"Rich content for chapter {chapter_id} not found.",
        )
    data = json.loads(rich_path.read_text(encoding="utf-8"))
    # Deduplicate sections: the PDF extractor sometimes emits an empty shell
    # (0 blocks) followed by the real section with the same ID.  Keep only
    # the entry with the most blocks for each section ID.
    seen: dict[str, dict] = {}
    for s in data.get("sections", []):
        sid = s["id"]
        if sid not in seen or len(s.get("blocks", [])) > len(seen[sid].get("blocks", [])):
            seen[sid] = s
    data["sections"] = list(seen.values())
    _RICH_CACHE[chapter_id] = data
    return data


# ── Tutor summary endpoint (no auth required) ────────────────────────────────

class SummaryRequest(BaseModel):
    chapter_id: int
    subtopic_id: str
    depth: str = "medium"  # short | medium | long


@app.post("/api/tutor-summary")
def tutor_summary(req: SummaryRequest):
    chapter = content.get_chapter(req.chapter_id)
    if not chapter:
        raise HTTPException(404, "Chapter not found")

    sub_data = content.get_subtopic(req.chapter_id, req.subtopic_id)
    if not sub_data:
        subtopic_title = chapter["title"]
        subtopic_content = chapter.get("intro", "")
    else:
        subtopic_title = sub_data["subtopic"]["title"]
        subtopic_content = sub_data["subtopic"].get("content", "")

    depth_prompts = {
        "short": (
            f"Give a brief 2-3 sentence summary of the topic '{subtopic_title}'. "
            f"Focus only on the core concept. Be concise."
        ),
        "medium": (
            f"Summarize the topic '{subtopic_title}' in 5-8 sentences. "
            f"Include key concepts, use **bold** for important terms, and give one practical example or analogy. "
            f"Structure it clearly."
        ),
        "long": (
            f"Give a detailed explanation of the topic '{subtopic_title}'. "
            f"Use ## headings for subtopics, bullet points (- item) for lists, **bold** for key terms. "
            f"Include examples, step-by-step explanations where relevant, and end with a key exam takeaway. "
            f"Make it thorough but clear — a student should be able to study from this summary."
        ),
        "notes": (
            f"Create concise revision notes for the topic '{subtopic_title}'. "
            f"Group them under 2-4 short headings using '## Heading' on its own line, "
            f"and under each heading list 2-3 brief bullet points (- point). "
            f"Keep each bullet to one short line — these are quick-revision key points."
        ),
    }

    prompt = depth_prompts.get(req.depth, depth_prompts["medium"])

    try:
        response = chat.chat(
            user_message=prompt,
            chapter_title=chapter["title"],
            subtopic_title=subtopic_title,
            subtopic_content=subtopic_content,
            history=[],
        )
        return {"summary": response}
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {e}")


# ── Chat endpoint ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    message: str
    chapter_id: int
    subtopic_id: str
    action: Optional[str] = None  # "explain" | "simplify" | "example" | None (free chat)


@app.post("/api/chat")
def chat_endpoint(req: ChatRequest, user: dict = Depends(get_current_user)):
    user_id = user["sub"]

    chapter = content.get_chapter(req.chapter_id)
    if not chapter:
        raise HTTPException(404, "Chapter not found")

    sub_data = content.get_subtopic(req.chapter_id, req.subtopic_id)
    if not sub_data:
        # Fall back to chapter intro
        subtopic_title   = chapter["title"]
        subtopic_content = chapter.get("intro", "")
    else:
        subtopic_title   = sub_data["subtopic"]["title"]
        subtopic_content = sub_data["subtopic"].get("content", "")

    # Build message based on action
    action_messages = {
        "explain":  f"Please explain '{subtopic_title}' clearly.",
        "simplify": f"Can you explain '{subtopic_title}' in a simpler way with an everyday analogy?",
        "example":  f"Can you give me a real-world example of '{subtopic_title}'?",
    }
    user_message = action_messages.get(req.action, req.message) if req.action else req.message

    # Ensure DB session exists and update context
    db_sessions.get_or_create(req.session_id, user_id, req.chapter_id)
    db_sessions.set_context(req.session_id, req.chapter_id, req.subtopic_id, user_id)

    # Prefer DB history (persistent); fall back to in-memory if DB not configured
    history = db_sessions.get_history(req.session_id)
    if not history:
        history = sessions.get_history(req.session_id)

    # Call AI — structured "Style F" answer (falls back to plain prose internally)
    try:
        response, structured = chat.chat_structured(
            user_message     = user_message,
            chapter_title    = chapter["title"],
            subtopic_title   = subtopic_title,
            subtopic_content = subtopic_content,
            history          = history,
            subject          = chapter.get("subject", "Science"),
        )
    except Exception as e:
        raise HTTPException(503, f"AI unavailable: {str(e)}")

    # Persist messages to DB (and in-memory as fallback) — store the plain text
    db_sessions.add_message(req.session_id, "user",      user_message, user_id)
    db_sessions.add_message(req.session_id, "assistant", response,     user_id)
    sessions.add_message(req.session_id, "user",      user_message)
    sessions.add_message(req.session_id, "assistant", response)

    return {
        "response":       response,
        "structured":     structured,
        "subtopic_title": subtopic_title,
        "session_id":     req.session_id,
    }


# ── Practice endpoint ─────────────────────────────────────────────────────────

class PracticeRequest(BaseModel):
    chapter_id:  int
    subtopic_id: str


@app.post("/api/practice")
def practice(req: PracticeRequest):
    sub_data = content.get_subtopic(req.chapter_id, req.subtopic_id)
    if not sub_data:
        raise HTTPException(404, "Subtopic not found")
    subtopic = sub_data["subtopic"]
    try:
        result = chat.generate_practice(subtopic["title"], subtopic.get("content", ""))
    except Exception as e:
        raise HTTPException(503, f"AI unavailable: {str(e)}")
    return result


# ── Exercise solution endpoint ────────────────────────────────────────────────

class ExerciseRequest(BaseModel):
    session_id: str
    chapter_id: int
    ex_id:      str


@app.post("/api/exercise")
def exercise_solution(req: ExerciseRequest, user: dict = Depends(get_current_user)):
    user_id = user["sub"]

    chapter = content.get_chapter(req.chapter_id)
    if not chapter:
        raise HTTPException(404, "Chapter not found")
    ex = content.get_exercise(req.chapter_id, req.ex_id)
    if not ex:
        raise HTTPException(404, "Exercise not found")
    try:
        result = chat.exercise_solution(ex["question"], chapter["title"])
    except Exception as e:
        raise HTTPException(503, f"AI unavailable: {str(e)}")

    # Add to chat history so student can continue asking
    user_msg  = f"Solve exercise {ex.get('id', req.ex_id)}: {ex['question'][:100]}..."
    db_sessions.add_message(req.session_id, "user",      user_msg,     user_id)
    db_sessions.add_message(req.session_id, "assistant", result["full"], user_id)
    sessions.add_message(req.session_id, "user",      user_msg)
    sessions.add_message(req.session_id, "assistant", result["full"])
    return result


# ── Short answer evaluation ───────────────────────────────────────────────────

class EvalRequest(BaseModel):
    question:       str
    student_answer: str
    sample_answer:  str


@app.post("/api/evaluate")
def evaluate(req: EvalRequest):
    try:
        result = chat.evaluate_short_answer(
            req.question, req.student_answer, req.sample_answer
        )
    except Exception as e:
        raise HTTPException(503, f"AI unavailable: {str(e)}")
    return result


# ── Session management ────────────────────────────────────────────────────────

@app.post("/api/session/new")
def new_session():
    """Create a new chat session UUID. No auth required — auth is checked at /api/chat."""
    sid = str(uuid.uuid4())
    # Pre-create an in-memory entry so history lookups don't fail before first message.
    sessions.get_or_create(sid)
    return {"session_id": sid}


@app.delete("/api/session/{session_id}")
def clear_session(session_id: str, user: dict = Depends(get_current_user)):
    db_sessions.clear(session_id)
    sessions.clear(session_id)  # also clear in-memory fallback
    return {"status": "cleared"}


# ── Question-paper upload → answer PDF ────────────────────────────────────────

@app.post("/api/qpaper/upload")
async def qpaper_upload(file: UploadFile = File(...)):
    name = (file.filename or "").lower()
    if not name.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Uploaded file is empty")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20 MB)")
    job_id = qpaper.start_job(data, file.filename or "question_paper.pdf")
    return {"job_id": job_id}


@app.get("/api/qpaper/{job_id}")
def qpaper_status(job_id: str):
    job = qpaper.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    # Hide absolute filesystem path but expose whether the PDF is ready
    out = {k: v for k, v in job.items() if k != "pdf_path"}
    out["has_pdf"] = job.get("status") == "done" and "pdf_path" in job
    return out


@app.get("/api/qpaper/{job_id}/download")
def qpaper_download(job_id: str):
    job = qpaper.get_job(job_id)
    if not job or job.get("status") != "done" or "pdf_path" not in job:
        raise HTTPException(404, "Answer PDF not ready")
    return FileResponse(
        job["pdf_path"],
        media_type="application/pdf",
        filename=f"answers_{job_id}.pdf",
    )


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    chapters_loaded = len(content.load_chapters())
    return {
        "model":    chat.MODEL,
        "chapters": chapters_loaded,
        "groq_key_set": bool(chat.GROQ_API_KEY),
    }


# ── Serve built React app (must be last) ─────────────────────────────────────

_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(str(_dist / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(str(_dist / "index.html"))
