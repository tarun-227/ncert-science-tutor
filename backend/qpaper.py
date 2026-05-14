"""Question paper upload → answer PDF pipeline.

Stages:
1. Extract text from uploaded PDF (PyMuPDF text layer, fallback to pytesseract OCR).
2. Split into individual questions using numbered-list heuristics.
3. For each question, call Phi-4 Mini to generate a structured answer.
4. Render a nicely-formatted PDF (ReportLab Platypus) with Q+A cards.

Jobs run in a background thread with an in-memory store so the frontend can poll
progress. Status values: queued → extracting → solving → rendering → done | error.
"""
import io
import re
import time
import uuid
import threading
import traceback
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF

from backend import chat as chat_mod


OUTPUT_DIR = Path("data/qpaper_jobs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Cap how many questions we solve per job to keep latency bounded.
MAX_QUESTIONS = 20

# In-memory job store
_JOBS: dict[str, dict] = {}
_JOBS_LOCK = threading.Lock()


def _set_job(job_id: str, **fields) -> None:
    with _JOBS_LOCK:
        job = _JOBS.setdefault(job_id, {
            "id": job_id, "status": "queued", "progress": 0, "total": 0,
        })
        job.update(fields)


def get_job(job_id: str) -> Optional[dict]:
    with _JOBS_LOCK:
        return dict(_JOBS[job_id]) if job_id in _JOBS else None


# ─── Text extraction (PyMuPDF → OCR fallback) ────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, bool]:
    """Return (text, used_ocr). Uses page-level text layer first, OCR per page if empty."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text_parts: list[str] = []
    used_ocr = False
    try:
        for page in doc:
            t = page.get_text("text") or ""
            if len(t.strip()) >= 20:
                text_parts.append(t)
                continue
            # Page seems to be a scan → OCR it with pytesseract
            try:
                import pytesseract
                from PIL import Image
                pix = page.get_pixmap(dpi=220)
                img = Image.frombytes(
                    "RGB" if pix.n < 4 else "RGBA",
                    (pix.width, pix.height), pix.samples,
                )
                if img.mode == "RGBA":
                    img = img.convert("RGB")
                ocr = pytesseract.image_to_string(img)
                text_parts.append(ocr)
                used_ocr = True
            except ImportError:
                text_parts.append(t)  # keep whatever (likely empty)
            except Exception:
                text_parts.append(t)
    finally:
        doc.close()
    return "\n\n".join(text_parts), used_ocr


# ─── Question splitter ───────────────────────────────────────────────────────

# Catches lines that start with `1.`, `1)`, `Q1.`, `Q. 1:` etc.
QUESTION_BOUNDARY = re.compile(
    r"(?m)^\s*(?:Q\s*[\.\:]?\s*)?(\d{1,2})\s*[\)\.\:]\s+",
    re.IGNORECASE,
)


def split_questions(text: str) -> list[str]:
    """Split raw text into a list of question strings."""
    # Normalise whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    matches = list(QUESTION_BOUNDARY.finditer(text))
    if len(matches) >= 2:
        questions: list[str] = []
        for i, m in enumerate(matches):
            start = m.end()
            end   = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            q = text[start:end].strip()
            if len(q) >= 5:
                questions.append(q)
        if questions:
            return questions

    # Fallback: split by blank lines
    chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if len(c.strip()) >= 5]
    return chunks


# ─── Answer generation ───────────────────────────────────────────────────────

def solve_question(question: str) -> str:
    prompt = (
        "You are an expert Class 10 NCERT Science tutor solving a student's question paper.\n\n"
        f"Question:\n{question}\n\n"
        "Write a clear, well-structured answer.\n"
        "- If the question is MCQ, clearly state the correct option and explain why.\n"
        "- If numerical, show each step with formulas, substitutions, and units.\n"
        "- If descriptive, give a structured answer with key points.\n"
        "- Use **bold** for key terms. Use a bullet list only if there are 3+ distinct points.\n"
        "- Keep it concise (4-8 sentences) unless the question demands more.\n\n"
        "Answer:"
    )
    # Retry with exponential backoff for rate-limit (429) errors
    max_retries = 4
    for attempt in range(max_retries + 1):
        try:
            return chat_mod._call_hf(prompt)
        except Exception as e:
            if "429" in str(e) and attempt < max_retries:
                wait = 2 ** attempt  # 1, 2, 4, 8 seconds
                time.sleep(wait)
                continue
            raise


# ─── PDF rendering (ReportLab Platypus, Scholarly Ink palette) ───────────────

def _inline_md(text: str) -> str:
    """Minimal markdown → ReportLab inline tags. Handles **bold**, *italic*, `code`."""
    # Escape XML-special chars first
    text = (text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))
    # Bold first (**x**)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # Italic (*x*) — avoid matching leftover ** boundaries
    text = re.sub(r"(?<![\*\w])\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    # Inline code
    text = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', text)
    return text


def _format_answer_flows(text: str, style) -> list:
    """Convert a markdown-ish answer string into a list of ReportLab flowables."""
    from reportlab.platypus import Paragraph, Spacer

    flows: list = []
    lines = text.split("\n")
    buf: list[str] = []

    def flush():
        if buf:
            para = " ".join(buf).strip()
            if para:
                flows.append(Paragraph(_inline_md(para), style))
            buf.clear()

    for ln in lines:
        stripped = ln.strip()
        if not stripped:
            flush()
            flows.append(Spacer(1, 4))
            continue
        if re.match(r"^[-*•·]\s+", stripped):
            flush()
            item = re.sub(r"^[-*•·]\s+", "", stripped)
            flows.append(Paragraph(f"&nbsp;&nbsp;•&nbsp;&nbsp;{_inline_md(item)}", style))
        elif re.match(r"^\d+[\.\)]\s+", stripped):
            flush()
            item = re.sub(r"^(\d+)[\.\)]\s+", r"<b>\1.</b>&nbsp;", stripped)
            flows.append(Paragraph(f"&nbsp;&nbsp;{_inline_md(item)}", style))
        elif re.match(r"^#{1,3}\s+", stripped):
            flush()
            heading = re.sub(r"^#{1,3}\s+", "", stripped)
            flows.append(Paragraph(f"<b>{_inline_md(heading)}</b>", style))
        else:
            buf.append(stripped)
    flush()
    return flows


def render_answer_pdf(qa_pairs: list[tuple[str, str]], out_path: Path, meta: dict) -> None:
    """Render a formatted PDF with Q+A pairs using ReportLab Platypus."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    )

    # Scholarly Ink palette (mirrors frontend index.css)
    INK      = HexColor("#1C1917")
    INK_DIM  = HexColor("#3A322E")
    MUTED    = HexColor("#9E8E82")
    BORDER   = HexColor("#E4DDD3")
    ACCENT   = HexColor("#3B4FA8")
    CARD_ALT = HexColor("#F5F1EA")
    CHEM     = HexColor("#1A6B3C")

    base = getSampleStyleSheet()

    h1 = ParagraphStyle(
        "H1", parent=base["Heading1"],
        fontName="Times-Bold", fontSize=24, leading=28, textColor=INK,
        spaceAfter=2,
    )
    sub = ParagraphStyle(
        "Sub", parent=base["Normal"],
        fontName="Helvetica", fontSize=10, textColor=MUTED,
        spaceAfter=16,
    )
    q_label = ParagraphStyle(
        "QLabel", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=10, textColor=ACCENT,
        leading=13, spaceAfter=4,
    )
    q_text = ParagraphStyle(
        "QText", parent=base["Normal"],
        fontName="Times-Roman", fontSize=12, leading=16, textColor=INK,
    )
    a_label = ParagraphStyle(
        "ALabel", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=10, textColor=CHEM,
        leading=13, spaceAfter=4,
    )
    a_text = ParagraphStyle(
        "AText", parent=base["Normal"],
        fontName="Times-Roman", fontSize=11.5, leading=16, textColor=INK_DIM,
        spaceAfter=3,
    )

    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=22*mm, rightMargin=22*mm,
        topMargin=20*mm, bottomMargin=20*mm,
        title="Answer Paper — ScienceTutor",
        author="ScienceTutor",
    )

    story: list = []

    # Title block
    story.append(Paragraph("Answer Paper", h1))
    src = meta.get("source_filename") or "question_paper.pdf"
    n   = len(qa_pairs)
    story.append(Paragraph(
        f"Generated by ScienceTutor · Source: {src} · {n} question{'s' if n != 1 else ''} answered",
        sub,
    ))
    story.append(HRFlowable(width="100%", thickness=0.6, color=BORDER, spaceAfter=14))

    content_width = A4[0] - 44 * mm  # page width minus L+R margins

    # Question card style — uses background + border so it can split across pages
    # (Table cells can't split, causing crashes on long questions)
    q_card = ParagraphStyle(
        "QCard", parent=q_text,
        backColor=CARD_ALT,
        borderColor=BORDER,
        borderWidth=0.5,
        borderPadding=(9, 12, 9, 12),  # top, right, bottom, left
    )

    for i, (q, a) in enumerate(qa_pairs, 1):
        # Q label + question card
        story.append(Paragraph(f"QUESTION {i}", q_label))
        story.append(Paragraph(_inline_md(q).replace("\n", "<br/>"), q_card))
        story.append(Spacer(1, 10))

        # Answer
        story.append(Paragraph("ANSWER", a_label))
        for flow in _format_answer_flows(a, a_text):
            story.append(flow)

        story.append(Spacer(1, 14))
        story.append(HRFlowable(width="100%", thickness=0.3, color=BORDER, spaceAfter=14))

    def _page_chrome(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(22 * mm, 10 * mm, "ScienceTutor · NCERT Class 10")
        canvas.drawRightString(A4[0] - 22 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_page_chrome, onLaterPages=_page_chrome)


# ─── Job runner ──────────────────────────────────────────────────────────────

def process_job(job_id: str, pdf_bytes: bytes, filename: str) -> None:
    try:
        _set_job(job_id, status="extracting", stage="Extracting text from PDF")
        text, used_ocr = extract_text_from_pdf(pdf_bytes)
        if not text.strip():
            _set_job(job_id, status="error",
                     error="Could not extract any text from the PDF. "
                           "If the file is a scanned image, install pytesseract and Tesseract-OCR.")
            return

        questions = split_questions(text)
        if not questions:
            _set_job(job_id, status="error",
                     error="Could not identify any questions in the PDF text.")
            return

        questions = questions[:MAX_QUESTIONS]
        _set_job(job_id, status="solving",
                 total=len(questions), progress=0,
                 used_ocr=used_ocr,
                 stage=f"Solving {len(questions)} question{'s' if len(questions) != 1 else ''}")

        qa_pairs: list[tuple[str, str]] = []
        for i, q in enumerate(questions):
            try:
                ans = solve_question(q)
            except Exception as e:
                ans = f"_Failed to generate answer: {e}_"
            qa_pairs.append((q, ans))
            _set_job(job_id, progress=i + 1)
            # Pace requests to stay under Groq's rate limit
            if i < len(questions) - 1:
                time.sleep(1.5)

        _set_job(job_id, status="rendering", stage="Rendering answer PDF")
        out_path = OUTPUT_DIR / f"{job_id}.pdf"
        render_answer_pdf(qa_pairs, out_path, meta={"source_filename": filename})

        _set_job(
            job_id, status="done", stage="Done",
            pdf_path=str(out_path),
            question_count=len(qa_pairs),
        )
    except Exception as e:
        traceback.print_exc()
        _set_job(job_id, status="error", error=str(e))


def start_job(pdf_bytes: bytes, filename: str) -> str:
    job_id = uuid.uuid4().hex[:12]
    _set_job(job_id, status="queued", filename=filename, total=0, progress=0, stage="Queued")
    threading.Thread(
        target=process_job, args=(job_id, pdf_bytes, filename), daemon=True,
    ).start()
    return job_id
