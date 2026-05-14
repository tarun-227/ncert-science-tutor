"""Question paper upload → answer PDF pipeline (v2).

Stages:
1. Extract text from uploaded PDF (PyMuPDF text layer, fallback to pytesseract OCR).
2. Parse into structured question objects (sections, sub-parts, OR choices, marks).
3. For each question, call LLM with a type-specific prompt to generate answers.
4. Render a clean red/black/white PDF matching the v2 answer key design.

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

MAX_QUESTIONS = 45

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
                text_parts.append(t)
            except Exception:
                text_parts.append(t)
    finally:
        doc.close()
    return "\n\n".join(text_parts), used_ocr


# ─── Structured question parser (v2) ─────────────────────────────────────────

# Repeated header/footer noise in CBSE PDFs
_PAGE_NOISE = re.compile(
    r"^\*Please note that.*?2025-26\.\s*",
    re.MULTILINE | re.DOTALL,
)

_SECTION_HEADER = re.compile(
    r"(?:Section|SECTION)\s*[-–—]?\s*([A-E])\b",
    re.IGNORECASE,
)

_OR_LINE = re.compile(r"^\s*OR\s*$", re.IGNORECASE | re.MULTILINE)


def _clean_text(text: str) -> str:
    """Remove page headers/footers and normalise whitespace."""
    text = _PAGE_NOISE.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _find_question_boundaries(text: str) -> list[tuple[int, int]]:
    """Find (question_number, char_offset) for every top-level question.

    CBSE SQP format: question number appears at the start of a line as a bare
    number (e.g. '1\\n' or '17\\n') FOLLOWED on the next line(s) by actual
    question text (words, not just a number). Marks also appear as bare numbers
    on their own line but are NOT followed by question text.

    Strategy: find every line that is just a 1-2 digit number. Then look at
    what follows — if the next non-blank content is text (not another bare
    number), it's a question boundary. Track expected sequence to avoid false
    positives.
    """
    # Pattern: line that is JUST a number (possibly with trailing spaces)
    # Must be preceded by a blank line or start of text (not mid-content)
    bare_num = re.compile(r"(?:^|\n\s*\n)(\d{1,2})\s*\n", re.MULTILINE)

    candidates: list[tuple[int, int, int]] = []  # (num, line_start, line_end)
    for m in bare_num.finditer(text):
        num = int(m.group(1))
        if num < 1 or num > 45:
            continue
        # Position of the digit itself
        digit_start = m.start(1)
        candidates.append((num, digit_start, m.end()))

    # Also try "Q1." / "1." / "1)" format (some PDFs use this)
    q_dot = re.compile(r"^[ \t]*(?:Q\.?\s*)?(\d{1,2})\s*[\.\)]\s+\S", re.MULTILINE)
    for m in q_dot.finditer(text):
        num = int(m.group(1))
        if num < 1 or num > 45:
            continue
        candidates.append((num, m.start(), m.end() - 1))

    # Sort by position
    candidates.sort(key=lambda x: x[1])

    # Filter: keep only those that form a strictly increasing sequence
    # and are followed by actual question text (not just marks/noise)
    boundaries: list[tuple[int, int]] = []
    expected = 1

    for num, start, end in candidates:
        # Must be >= expected and not too far ahead
        if num < expected or num > expected + 2:
            continue

        # Check what follows this number — should be question text
        after = text[end:end + 300].strip()

        # If the content after the number is another bare number or empty, skip
        first_line = after.split("\n")[0].strip() if after else ""
        if not first_line or re.match(r"^\d{1,2}\s*$", first_line):
            lines_after = after.split("\n")
            found_text = False
            for la in lines_after[1:5]:
                la = la.strip()
                if la and not re.match(r"^\d{1,2}\s*$", la) and len(la) > 10:
                    found_text = True
                    break
            if not found_text:
                continue

        # The text following must contain actual words (not just numbers/noise)
        words_after = re.findall(r"[a-zA-Z]{3,}", after[:150])
        if len(words_after) < 3:
            continue

        # Guard against table data: if the lines immediately before AND after
        # are also bare numbers, this is likely a table cell, not a question
        before_ctx = text[max(0, start - 20):start].strip()
        after_first = after.split("\n")[0].strip() if after else ""
        before_lines = before_ctx.split("\n")
        prev_line = before_lines[-1].strip() if before_lines else ""
        if re.match(r"^\d{1,3}$", prev_line) and re.match(r"^\d{1,3}$", after_first):
            continue

        boundaries.append((num, start))
        expected = num + 1

    return boundaries


def split_questions(text: str) -> list[dict]:
    """Parse question paper text into structured question objects."""
    text = _clean_text(text)
    if not text:
        return []

    # Detect section positions for later assignment
    section_positions: list[tuple[int, str]] = []
    for m in _SECTION_HEADER.finditer(text):
        section_positions.append((m.start(), m.group(1).upper()))

    def _section_at(pos: int) -> str:
        sec = ""
        for spos, sletter in section_positions:
            if spos <= pos:
                sec = sletter
            else:
                break
        return sec

    # --- Pass 1: find question boundaries ---
    boundaries = _find_question_boundaries(text)

    if len(boundaries) < 3:
        chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if len(c.strip()) >= 5]
        return [
            {"num": i + 1, "marks": None, "section": "", "text": c,
             "options": [], "parts": [], "or_text": "", "or_parts": [],
             "type": "short", "raw": c}
            for i, c in enumerate(chunks)
        ]

    # Extract raw blocks between boundaries
    raw_blocks: list[tuple[int, int, str]] = []  # (q_num, position, raw_text)
    for i, (num, start) in enumerate(boundaries):
        # Find start of content (skip the number line itself)
        content_start = text.find("\n", start)
        if content_start == -1:
            content_start = start
        else:
            content_start += 1

        block_end = boundaries[i + 1][1] if i + 1 < len(boundaries) else len(text)
        raw = text[content_start:block_end].strip()

        # Strip trailing bare number (marks indicator at end of block)
        raw = re.sub(r"\n\s*\d{1,2}\s*$", "", raw).strip()

        raw_blocks.append((num, start, raw))

    # --- Pass 2: parse each block into structured dict ---
    questions: list[dict] = []

    for q_num, pos, raw in raw_blocks:
        section = _section_at(pos)

        # Try to extract marks from the raw block
        # CBSE puts marks as a standalone number — we already stripped trailing ones
        # Also look for explicit marks patterns
        marks = None
        marks_m = re.search(r"\[?\(?\s*(\d)\s*[Mm]arks?\s*\]?\)?", raw[:100])
        if marks_m:
            marks = int(marks_m.group(1))

        # Infer marks from position if not found
        if marks is None:
            # Check the line just before this question's content in the original text
            before_content = text[max(0, pos - 5):pos].strip()
            if re.match(r"^\d$", before_content):
                pass  # That's the previous question's marks, not ours

        # Split on OR
        or_split = _OR_LINE.split(raw)
        main_block = or_split[0].strip()
        or_block = or_split[1].strip() if len(or_split) > 1 else ""

        # Parse blocks
        main_text, main_options, main_parts = _parse_block(main_block)
        or_text_parsed, or_options, or_parts = _parse_block(or_block) if or_block else ("", [], [])

        # Determine question type
        qtype = _infer_type(main_text, main_options, main_parts, marks)

        questions.append({
            "num": q_num,
            "marks": marks,
            "section": section,
            "text": main_text,
            "options": main_options,
            "parts": main_parts,
            "or_text": or_text_parsed,
            "or_options": or_options,
            "or_parts": or_parts,
            "type": qtype,
            "raw": raw,
        })

    return questions


def _parse_block(block: str) -> tuple[str, list[str], list[dict]]:
    """Parse a question block into (text, mcq_options, sub_parts)."""
    if not block:
        return ("", [], [])

    lines = block.split("\n")
    text_lines: list[str] = []
    options: list[str] = []
    parts: list[dict] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Check for MCQ option: A. / B. / C. / D. or (A) / (B) etc.
        opt_m = re.match(r"^\s*\(?([A-Da-d])\s*[\.\)]\s*(.+)", stripped)
        if opt_m:
            letter = opt_m.group(1).upper()
            opt_text = opt_m.group(2).strip()
            options.append(f"{letter}. {opt_text}")
            continue

        # Check for sub-part: (i), (ii), (a), (b), (A), (B) etc.
        part_m = re.match(r"^\s*\(?\s*([a-d]|[iv]{1,4}|[A-D])\s*\)\s*(.+)", stripped)
        if part_m and not options:
            label = part_m.group(1)
            part_text = part_m.group(2).strip()
            parts.append({"label": f"({label})", "text": part_text})
            continue

        text_lines.append(stripped)

    main_text = " ".join(text_lines).strip()
    return main_text, options, parts


def _infer_type(text: str, options: list, parts: list, marks: int | None) -> str:
    """Infer question type from content."""
    text_lower = text.lower()
    if options and len(options) >= 3:
        return "mcq"
    if "assertion" in text_lower and "reason" in text_lower:
        return "assertion"
    if any(kw in text_lower for kw in ["calculate", "find the", "determine", "compute", "what is the value"]):
        return "numerical"
    if marks and marks >= 4:
        return "long"
    return "short"


# ─── Answer generation (type-specific prompts) ───────────────────────────────

def _build_prompt(q: dict) -> str:
    """Build an answer prompt tailored to the question type."""
    base = (
        "You are an expert NCERT Class 10 Science tutor solving a student's question paper.\n"
        "Write clear, well-structured answers.\n"
        "Use **bold** for key terms. Use bullet points (- item) for lists of 3+ points.\n\n"
    )

    qtype = q.get("type", "short")
    num = q.get("num", "?")
    marks = q.get("marks")
    marks_str = f" [{marks} Mark{'s' if marks != 1 else ''}]" if marks else ""

    prompt = base + f"Question {num}{marks_str}:\n{q['text']}\n"

    if q.get("options"):
        for opt in q["options"]:
            prompt += f"{opt}\n"

    if q.get("parts"):
        for p in q["parts"]:
            prompt += f"{p['label']} {p['text']}\n"

    prompt += "\n"

    if qtype == "mcq":
        prompt += (
            "State the correct option clearly (e.g., 'Answer: C. ...'), then explain in 2-3 sentences "
            "why it is correct and why key wrong options fail.\n"
        )
    elif qtype == "assertion":
        prompt += (
            "First state whether Assertion (A) and Reason (R) are true or false. "
            "Then state whether R is the correct explanation of A. "
            "Give 2-3 sentences of reasoning.\n"
        )
    elif qtype == "numerical":
        prompt += (
            "Show each step clearly: formula → substitution → calculation → final answer with units. "
            "**Bold** the final answer.\n"
        )
    else:
        target = max(4, (marks or 2) * 2)
        prompt += (
            f"Give a structured answer in {target}-{target + 4} sentences. "
            "Use bullet points for 3+ distinct points. **Bold** key terms.\n"
        )

    if q.get("or_text"):
        prompt += f"\n--- OR ---\nAlso answer this alternative question:\n{q['or_text']}\n"
        if q.get("or_options"):
            for opt in q["or_options"]:
                prompt += f"{opt}\n"
        if q.get("or_parts"):
            for p in q["or_parts"]:
                prompt += f"{p['label']} {p['text']}\n"
        prompt += (
            "\nClearly separate your answers with 'Answer (Main):' and 'Answer (OR):' labels.\n"
        )

    return prompt


def solve_question(q: dict) -> str:
    """Generate an answer for a structured question dict."""
    prompt = _build_prompt(q)
    max_retries = 4
    for attempt in range(max_retries + 1):
        try:
            return chat_mod._call_hf_long(prompt)
        except Exception as e:
            if "429" in str(e) and attempt < max_retries:
                wait = 2 ** attempt
                time.sleep(wait)
                continue
            raise


# ─── PDF rendering (v2 — red/black/white only) ───────────────────────────────

def _inline_md(text: str) -> str:
    """Minimal markdown → ReportLab inline tags."""
    text = (text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<![\*\w])\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', text)
    return text


def _answer_to_flowables(text: str, a_s, ab_s, bul_s) -> list:
    """Convert LLM answer text into ReportLab flowables."""
    from reportlab.platypus import Paragraph, Spacer

    flows: list = []
    lines = text.split("\n")
    buf: list[str] = []

    def flush():
        if buf:
            para = " ".join(buf).strip()
            if para:
                flows.append(Paragraph(_inline_md(para), a_s))
            buf.clear()

    for ln in lines:
        stripped = ln.strip()
        if not stripped:
            flush()
            flows.append(Spacer(1, 4))
            continue

        # Bold answer lines
        if stripped.lower().startswith(("answer:", "answer (main):", "answer (or):")):
            flush()
            flows.append(Paragraph(_inline_md(stripped), ab_s))
            continue

        # Bullet items
        if re.match(r"^[-*•·]\s+", stripped):
            flush()
            item = re.sub(r"^[-*•·]\s+", "", stripped)
            flows.append(Paragraph(f"&bull;&nbsp;&nbsp;{_inline_md(item)}", bul_s))
        elif re.match(r"^\d+[\.\)]\s+", stripped):
            flush()
            item = re.sub(r"^(\d+)[\.\)]\s+", r"<b>\1.</b>&nbsp;", stripped)
            flows.append(Paragraph(f"&nbsp;&nbsp;{_inline_md(item)}", a_s))
        elif re.match(r"^#{1,3}\s+", stripped):
            flush()
            heading = re.sub(r"^#{1,3}\s+", "", stripped)
            flows.append(Paragraph(f"<b>{_inline_md(heading)}</b>", ab_s))
        else:
            buf.append(stripped)

    flush()
    return flows


def render_answer_pdf(questions: list[dict], answers: list[str],
                      out_path: Path, meta: dict) -> None:
    """Render a v2-style PDF with Q+A — red/black/white only."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle,
    )

    RED = HexColor("#C0392B")
    BLACK = black
    GREY = HexColor("#555555")
    LIGHT_GREY = HexColor("#E0E0E0")

    W, H = A4
    base = getSampleStyleSheet()

    # Styles matching v2
    title_s = ParagraphStyle("T", parent=base["Heading1"],
        fontName="Times-Bold", fontSize=20, leading=24, textColor=BLACK,
        alignment=TA_CENTER, spaceAfter=2)
    sub_s = ParagraphStyle("Sub", parent=base["Normal"],
        fontName="Helvetica", fontSize=10, textColor=GREY,
        alignment=TA_CENTER, spaceAfter=4)
    sec_s = ParagraphStyle("Sec", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=13, textColor=white,
        alignment=TA_CENTER, leading=17)
    qnum_s = ParagraphStyle("QNum", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=11, textColor=RED,
        leading=14, spaceAfter=4)
    q_s = ParagraphStyle("Q", parent=base["Normal"],
        fontName="Times-Bold", fontSize=11, leading=15, textColor=BLACK,
        spaceAfter=2)
    qopt_s = ParagraphStyle("QOpt", parent=base["Normal"],
        fontName="Times-Roman", fontSize=10.5, leading=14, textColor=BLACK,
        leftIndent=16)
    alabel_s = ParagraphStyle("AL", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=10, textColor=BLACK,
        leading=13, spaceAfter=3)
    a_s = ParagraphStyle("A", parent=base["Normal"],
        fontName="Times-Roman", fontSize=10.5, leading=14.5, textColor=BLACK,
        alignment=TA_JUSTIFY, spaceAfter=2)
    ab_s = ParagraphStyle("AB", parent=a_s, fontName="Times-Bold")
    bul_s = ParagraphStyle("Bul", parent=a_s, leftIndent=14, firstLineIndent=0)
    or_s = ParagraphStyle("OR", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=11, textColor=RED,
        alignment=TA_CENTER, spaceBefore=8, spaceAfter=8)
    part_s = ParagraphStyle("Part", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=10, textColor=BLACK,
        leading=13, spaceAfter=2)

    cw = W - 40 * mm

    def e(t):
        return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def hr():
        return HRFlowable(width="100%", thickness=0.4, color=LIGHT_GREY,
                          spaceAfter=10, spaceBefore=8)

    def section_banner(text):
        tbl = Table([[Paragraph(text, sec_s)]], colWidths=[cw])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), RED),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        return tbl

    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=16 * mm,
        title="Answer Paper — ScienceTutor",
        author="ScienceTutor",
    )

    story: list = []

    # Title block
    src = meta.get("source_filename") or "question_paper.pdf"
    n = len(questions)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Answer Paper", title_s))
    story.append(HRFlowable(width="100%", thickness=1, color=RED, spaceAfter=8))
    story.append(Paragraph(
        f"Generated by ScienceTutor &middot; Source: {e(src)} &middot; "
        f"{n} question{'s' if n != 1 else ''} answered",
        sub_s,
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY, spaceAfter=16))

    # Track sections for banners
    last_section = ""

    for i, q in enumerate(questions):
        ans_text = answers[i] if i < len(answers) else "_No answer generated._"

        # Section banner
        section = q.get("section", "")
        if section and section != last_section:
            section_names = {
                "A": "SECTION A",
                "B": "SECTION B",
                "C": "SECTION C",
                "D": "SECTION D",
                "E": "SECTION E",
            }
            story.append(section_banner(section_names.get(section, f"SECTION {section}")))
            story.append(Spacer(1, 12))
            last_section = section

        # Question number with marks
        marks = q.get("marks")
        marks_str = ""
        if marks:
            marks_str = f"  [{marks} Mark{'s' if marks != 1 else ''}]"
        story.append(Paragraph(f"Q{q['num']}.{marks_str}", qnum_s))

        # Question text
        if q.get("text"):
            story.append(Paragraph(_inline_md(q["text"]), q_s))

        # MCQ options — each on its own line
        for opt in q.get("options", []):
            story.append(Paragraph(e(opt), qopt_s))

        # Sub-parts
        for part in q.get("parts", []):
            story.append(Paragraph(f"<b>{part['label']}</b> {e(part['text'])}", qopt_s))

        # OR divider + alternative question
        if q.get("or_text"):
            story.append(Paragraph("OR", or_s))
            story.append(Paragraph(_inline_md(q["or_text"]), q_s))
            for opt in q.get("or_options", []):
                story.append(Paragraph(e(opt), qopt_s))
            for part in q.get("or_parts", []):
                story.append(Paragraph(f"<b>{part['label']}</b> {e(part['text'])}", qopt_s))

        story.append(Spacer(1, 6))

        # Answer
        story.append(Paragraph("Answer:", alabel_s))
        for flow in _answer_to_flowables(ans_text, a_s, ab_s, bul_s):
            story.append(flow)

        story.append(hr())

    # Footer
    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(20 * mm, 8 * mm, "ScienceTutor · NCERT Class 10")
        canvas.drawRightString(W - 20 * mm, 8 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)


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

        answers: list[str] = []
        for i, q in enumerate(questions):
            try:
                ans = solve_question(q)
            except Exception as exc:
                ans = f"_Failed to generate answer: {exc}_"
            answers.append(ans)
            _set_job(job_id, progress=i + 1)
            if i < len(questions) - 1:
                time.sleep(1.5)

        _set_job(job_id, status="rendering", stage="Rendering answer PDF")
        out_path = OUTPUT_DIR / f"{job_id}.pdf"
        render_answer_pdf(questions, answers, out_path,
                          meta={"source_filename": filename})

        _set_job(
            job_id, status="done", stage="Done",
            pdf_path=str(out_path),
            question_count=len(questions),
        )
    except Exception as exc:
        traceback.print_exc()
        _set_job(job_id, status="error", error=str(exc))


def start_job(pdf_bytes: bytes, filename: str) -> str:
    job_id = uuid.uuid4().hex[:12]
    _set_job(job_id, status="queued", filename=filename, total=0, progress=0, stage="Queued")
    threading.Thread(
        target=process_job, args=(job_id, pdf_bytes, filename), daemon=True,
    ).start()
    return job_id
