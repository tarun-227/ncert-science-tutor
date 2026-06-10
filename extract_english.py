"""Re-extract First Flight (Class X English) from the NCERT PDF into app data.

Every lesson and poem becomes its own chapter; its comprehension questions
(Oral Comprehension Check / Thinking about the Text / Thinking about the Poem)
become the final "Questions" section. Poems keep their line/stanza breaks.

Notes on the PDF:
- Decorative fonts (titles, box headers, margin glosses) use per-font shifted
  byte encodings (+3, +26, +29 ...). We auto-detect the shift per font by
  scoring English-ness of the decoded sample.
- Piece start pages come from the printed contents (book page + 10 = pdf page,
  verified on several anchors).
- Story body: Bookman non-italic ~11pt. Oral Comprehension Check questions:
  italic 10pt inside a box; body resumes with the next non-italic 11pt line.
- Margin glosses are decorative-font spans on body baselines; never merge
  fonts of different families on a shared baseline.

Usage:  python extract_english.py "<path to First Flight PDF>"
"""
import json
import re
import sys
import statistics
from pathlib import Path

import fitz

PDF_PATH = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\user\Downloads\ed9b3239b1999b90a4a3f8cc4742c0fe4fc3ed85.pdf"
DATA_DIR = Path("data")
FIRST_ID = 14
PAGE_OFFSET = 10        # pdf page = book page + 10

# Book order with the contents-page book page numbers.
PIECES = [
    {"title": "A Letter to God",                      "kind": "lesson", "book_page": 1},
    {"title": "Dust of Snow",                         "kind": "poem",   "book_page": 14},
    {"title": "Fire and Ice",                         "kind": "poem",   "book_page": 15},
    {"title": "Nelson Mandela: Long Walk to Freedom", "kind": "lesson", "book_page": 16},
    {"title": "A Tiger in the Zoo",                   "kind": "poem",   "book_page": 29},
    {"title": "Two Stories about Flying",             "kind": "lesson", "book_page": 32,
     "parts": ["His First Flight", "Black Aeroplane"]},
    {"title": "How to Tell Wild Animals",             "kind": "poem",   "book_page": 43},
    {"title": "The Ball Poem",                        "kind": "poem",   "book_page": 46},
    {"title": "From the Diary of Anne Frank",         "kind": "lesson", "book_page": 48},
    {"title": "Amanda!",                              "kind": "poem",   "book_page": 61},
    {"title": "The Hundred Dresses-I",                "kind": "lesson", "book_page": 63},
    {"title": "The Hundred Dresses-II",               "kind": "lesson", "book_page": 73},
    {"title": "Animals",                              "kind": "poem",   "book_page": 83},
    {"title": "Glimpses of India",                    "kind": "lesson", "book_page": 85,
     "parts": ["A Baker from Goa", "Coorg", "Tea from Assam"]},
    {"title": "The Trees",                            "kind": "poem",   "book_page": 99},
    {"title": "Mijbil the Otter",                     "kind": "lesson", "book_page": 102},
    {"title": "Fog",                                  "kind": "poem",   "book_page": 115},
    {"title": "Madam Rides the Bus",                  "kind": "lesson", "book_page": 116},
    {"title": "The Tale of Custard the Dragon",       "kind": "poem",   "book_page": 129},
    {"title": "The Sermon at Benares",                "kind": "lesson", "book_page": 133},
    {"title": "For Anne Gregory",                     "kind": "poem",   "book_page": 140},
    {"title": "The Proposal",                         "kind": "lesson", "book_page": 142},
]
BOOK_END_PAGE = 162     # roughly where The Proposal ends; rest is back matter

Q_START = re.compile(r"^(oral comprehension check|thinking about the (text|poem))\b", re.I)
Q_STOP = re.compile(
    r"^(thinking about (the )?language|speaking|writing|listening|reading|"
    r"glossary|i\.?\s*dictation|activity|what we have done)", re.I)


def norm(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[–—‐‑‒-]", "-", s)
    s = re.sub(r"[^a-z0-9!?-]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# ── Font shift detection ──────────────────────────────────────────────────────

COMMON = {"the", "and", "in", "of", "to", "a", "is", "you", "he", "his", "for",
          "first", "flight", "about", "with", "what", "we", "have", "check",
          "comprehension", "read", "before", "thinking"}


def english_score(text: str) -> float:
    if not text:
        return 0.0
    letters = sum(c.isalpha() or c in " ,.'\"!?;:-()" for c in text)
    base = letters / len(text)
    words = re.findall(r"[a-zA-Z']+", text.lower())
    hits = sum(w in COMMON for w in words)
    return base + 0.6 * (hits / max(len(words), 1))


def decode(text: str, shift: int) -> str:
    if not shift:
        return text
    out = []
    for c in text:
        if c == " ":
            out.append(" ")          # extractor-inserted spaces stay spaces
        elif ord(c) + shift < 0x250:
            out.append(chr(ord(c) + shift))
        else:
            out.append(c)
    return "".join(out)


def detect_shifts(doc) -> dict:
    samples: dict[str, list[str]] = {}
    for page in doc:
        for blk in page.get_text("dict")["blocks"]:
            if blk["type"] != 0:
                continue
            for line in blk["lines"]:
                for sp in line["spans"]:
                    if len(samples.setdefault(sp["font"], [])) < 60:
                        samples[sp["font"]].append(sp["text"])
    shifts = {}
    for font, texts in samples.items():
        raw = " ".join(texts)[:2000]
        best, best_score = 0, english_score(raw)
        for sh in range(1, 36):
            sc = english_score(decode(raw, sh))
            if sc > best_score + 0.05:
                best, best_score = sh, sc
        shifts[font] = best
    return shifts


# ── Line extraction ───────────────────────────────────────────────────────────

def same_family(f1: str, f2: str) -> bool:
    return f1.startswith("TT") == f2.startswith("TT")


def extract_lines(doc, shifts):
    """Horizontal text lines, decoded and cleaned, in reading order.

    Also emits section-banner events: the "Thinking about the Text/Poem" /
    "Thinking about Language" ribbons are ribbon-art images (~130-145pt wide,
    ~25-35pt tall) with no extractable text. Within a piece (resetting at part
    headings) banner #1 starts the questions, banner #2 starts the
    language/speaking matter we skip.
    """
    out = []
    for pno, page in enumerate(doc, start=1):
        page_lines = []
        for blk in page.get_text("dict")["blocks"]:
            if blk["type"] == 1:
                x0, y0, x1, y1 = blk["bbox"]
                if 90 <= x1 - x0 <= 200 and 12 <= y1 - y0 <= 45 and x0 <= 200:
                    page_lines.append({"page": pno, "y": y0, "x": x0, "x1": x1,
                                       "size": 0, "font": "", "italic": False,
                                       "text": "", "banner": True})
                continue
            if blk["type"] != 0:
                continue
            for line in blk["lines"]:
                if abs(line["dir"][0] - 1) > 0.01:      # rotated running heads
                    continue
                spans = sorted(line["spans"], key=lambda s: s["bbox"][0])
                text = "".join(decode(s["text"], shifts.get(s["font"], 0)) for s in spans)
                text = re.sub(r"\s+", " ", text).strip()
                if not text:
                    continue
                big = max(spans, key=lambda s: len(s["text"]))
                page_lines.append({
                    "page": pno, "y": line["bbox"][1],
                    "x": line["bbox"][0], "x1": line["bbox"][2],
                    "size": big["size"], "font": big["font"],
                    "italic": "Italic" in big["font"], "text": text,
                })
        # group by baseline; drop shadow copies; merge drop-cap fragments
        page_lines.sort(key=lambda l: (round(l["y"] / 4), l["x"]))
        merged = []
        for ln in page_lines:
            prev = merged[-1] if merged else None
            if ln.get("banner") or (prev and prev.get("banner")):
                merged.append(dict(ln))
                continue
            if prev and abs(prev["y"] - ln["y"]) < 3.5:
                # identical / contained shadow copies of decorative titles
                if ln["text"] in prev["text"] or prev["text"] in ln["text"]:
                    if len(ln["text"]) > len(prev["text"]):
                        prev.update(text=ln["text"], size=max(prev["size"], ln["size"]),
                                    x1=max(prev["x1"], ln["x1"]))
                    continue
                # adjacent fragment on the same baseline (drop-caps, small caps)
                if same_family(prev["font"], ln["font"]) and ln["x"] - prev["x1"] < 14:
                    joiner = "" if ln["text"][0].islower() else " "
                    prev["text"] = (prev["text"] + joiner + ln["text"]).strip()
                    prev["size"] = max(prev["size"], ln["size"])
                    prev["x1"] = max(prev["x1"], ln["x1"])
                    continue
            merged.append(dict(ln))
        merged.sort(key=lambda l: (l["y"], l["x"]))
        for ln in merged:
            if ln.get("banner"):
                out.append(ln)
                continue
            t = ln["text"]
            if re.fullmatch(r"[\d/]{1,4}", t) or re.fullmatch(r"20\d\d-\d\d", t):
                continue                                  # page numbers / watermark
            if re.fullmatch(r"[IVX]{1,4}", t):
                continue                                  # bare part numerals
            if ln["font"] == "Arial":
                continue                                  # watermark font
            if norm(t) == "first flight":
                continue                                  # running head
            out.append(ln)
    return out


def smallcaps_before_you_read(text: str) -> bool:
    t = norm(text).replace(" ", "")
    return sorted(t) == sorted("beforeyouread")


# ── Per-piece assembly ────────────────────────────────────────────────────────

def is_decorative(ln) -> bool:
    return ln["font"].startswith("TT")


def para_join(lines):
    """Join body lines into paragraphs using vertical gaps / indents."""
    paras, cur, last = [], [], None
    gaps = [b["y"] - a["y"] for a, b in zip(lines, lines[1:])
            if b["page"] == a["page"] and 0 < b["y"] - a["y"] < 40]
    normal = statistics.median(gaps) if gaps else 13
    for ln in lines:
        new_para = False
        if last is not None:
            if ln["page"] != last["page"]:
                new_para = not ln["text"][0].islower()
            elif ln["y"] - last["y"] > normal * 1.7:
                new_para = True
            elif ln["x"] > last["x"] + 8 and last["text"][-1:] in ".!?”’":
                new_para = True
        if new_para and cur:
            paras.append(" ".join(cur))
            cur = []
        cur.append(ln["text"])
        last = ln
    if cur:
        paras.append(" ".join(cur))
    return paras


def poem_join(lines, author=None):
    """Poem body -> text with \n per line and blank line between stanzas."""
    out, last = [], None
    gaps = [b["y"] - a["y"] for a, b in zip(lines, lines[1:])
            if b["page"] == a["page"] and 0 < b["y"] - a["y"] < 60]
    normal = statistics.median(gaps) if gaps else 15
    for ln in lines:
        if last is not None:
            stanza_break = (ln["page"] != last["page"] and not ln["text"][0].islower()) or \
                           (ln["page"] == last["page"] and ln["y"] - last["y"] > normal * 1.55)
            if stanza_break:
                out.append("")
        out.append(ln["text"])
        last = ln
    if author:
        out += ["", author]
    return "\n".join(out)


def build_piece(piece, lines):
    """Split a piece's stream (text lines + banner events) into
    intro / body parts / questions / author."""
    is_poem = piece["kind"] == "poem"
    part_titles = [norm(p) for p in piece.get("parts", [])]
    mode = "body"
    intro, questions = [], []
    parts = [{"title": piece["title"], "lines": []}]
    author = None
    oral_box = False        # questions mode entered via an in-text check box
    banner_seen = False     # first ribbon after the reading = its questions

    def q_header(text):
        h = {"kind": "h", "text": text}
        if not questions or questions[-1] != h:
            questions.append(h)

    for ln in lines:
        # ── section ribbons (images) ──
        if ln.get("banner"):
            if is_poem and not parts[-1]["lines"]:
                continue                 # decoration before the poem started
            if not banner_seen:
                banner_seen = True
                mode = "questions"
                oral_box = False
                q_header("Thinking about the Poem" if is_poem else "Thinking about the Text")
            else:
                mode = "skip_hard"       # language / speaking / writing matter
            continue

        t = ln["text"]
        n = norm(t)

        # ── text headers ──
        if smallcaps_before_you_read(t):
            mode = "intro"
            continue
        matched_part = None
        if part_titles and (is_decorative(ln) or ln["size"] >= 12.5 or ln["font"].endswith("Demi")):
            stripped = re.sub(r"^(the|i{1,3}v?|iv)\s+", "", n)
            for pi, pt in enumerate(part_titles):
                if pt in (n, stripped) or pt in n:
                    matched_part = pi
                    break
        if matched_part is not None:
            parts.append({"title": piece["parts"][matched_part], "lines": []})
            mode = "body"
            banner_seen = False
            oral_box = False
            continue
        if Q_START.match(n):
            mode = "questions"
            oral_box = n.startswith("oral")
            q_header(re.sub(r"\s*\(.*$", "", t).strip())
            continue
        if Q_STOP.match(n) and (is_decorative(ln) or ln["font"].endswith("Demi") or ln["size"] >= 12):
            if mode != "questions" or not oral_box:
                # soft skip: an activity box inside the reading; the story
                # resumes with the next full-size body line
                mode = "skip_soft" if mode in ("body", "intro") else "skip_hard"
                continue
        if is_decorative(ln):
            continue                      # margin glosses, teacher boxes, titles

        # ── content ──
        if mode == "intro":
            if ln["italic"]:
                intro.append(ln)
                continue
            mode = "body"
        if mode == "questions":
            if oral_box and not ln["italic"] and ln["size"] >= 10.5:
                mode = "body"             # check box ended; story resumes
            elif not oral_box and re.match(r"^[IVX]+\.\s", t):
                mode = "skip_hard"        # roman groups = language exercises
                continue
            elif ln["size"] >= 8.8:
                questions.append({"kind": "l", "line": ln})
                continue
            else:
                continue
        if mode == "skip_soft":
            if not ln["italic"] and ln["size"] >= 10.5 and not ln["font"].endswith("Demi"):
                mode = "body"             # story resumes after the activity box
            else:
                continue
        if mode == "skip_hard":
            continue

        # body
        if is_poem:
            if re.fullmatch(r"[A-Z][A-Z .'’-]{3,}", t) and 7.5 <= ln["size"] <= 13:
                author = t.title()
                continue
            if ln["italic"] and not parts[-1]["lines"]:
                intro.append(ln)          # italic preface under the poem title
                continue
            if ln["size"] < 10.5:
                continue
        else:
            if ln["size"] < 9.2:
                continue                  # stray margin matter
            if ln["italic"] and not parts[-1]["lines"] and len(parts) == 1:
                intro.append(ln)
                continue
        parts[-1]["lines"].append(ln)

    parts = [p for p in parts if sum(len(l["text"]) for l in p["lines"]) > 40]
    return intro, parts, questions, author


def _question_paragraphs(qlines):
    """Group question lines into paragraphs (a numbered/roman/(i) marker or a
    sub-question starts a new paragraph)."""
    paras, buf = [], []

    def flush():
        if buf:
            paras.append(" ".join(buf))
            buf.clear()

    for t in qlines:
        if re.match(r"^(\d+\.|\([ivx]+\)|[IVX]+\.)\s", t):
            flush()
        buf.append(t)
    flush()
    return paras


def questions_blocks(questions):
    """Structured blocks for the rich JSON: one 'subsection' per header so the
    book renderer shows the header as a heading, then the questions as paras."""
    blocks, title, lines = [], None, []

    def flush():
        if title is None and not lines:
            return
        paras = _question_paragraphs(lines)
        if title is not None:
            blocks.append({"type": "subsection", "title": title,
                           "blocks": [{"type": "text", "content": "\n\n".join(paras)}]})
        elif paras:
            blocks.append({"type": "text", "content": "\n\n".join(paras)})

    for q in questions:
        if q["kind"] == "h":
            flush()
            title, lines = q["text"], []
        else:
            lines.append(q["line"]["text"])
    flush()
    return blocks


def questions_flat(questions):
    """Flattened markdown-ish text for the basic JSON (AI/chat context)."""
    out = []
    for q in questions:
        if q["kind"] == "h":
            out.append(f"## {q['text']}")
        else:
            out.append(q["line"]["text"])
    # rejoin into paragraphs sharing the heading grouping
    text = "\n".join(out)
    return re.sub(r"\n(?=## )", "\n\n", text)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    doc = fitz.open(PDF_PATH)
    shifts = detect_shifts(doc)
    lines = extract_lines(doc, shifts)

    basic_chapters = json.loads((DATA_DIR / "ncert_chapters.json").read_text(encoding="utf-8"))
    basic_chapters = [c for c in basic_chapters if c.get("subject") != "English"]

    page_bounds = [p["book_page"] + PAGE_OFFSET for p in PIECES] + [BOOK_END_PAGE + PAGE_OFFSET + 1]
    for pi, piece in enumerate(PIECES):
        cid = FIRST_ID + pi
        start, end = page_bounds[pi], page_bounds[pi + 1]
        seg = [l for l in lines if start <= l["page"] < end]
        intro, parts, questions, author = build_piece(piece, seg)

        sections, sub_basic = [], []
        for si, part in enumerate(parts, start=1):
            sec_id = f"{cid}.{si}"
            blocks = []
            if si == 1 and intro:
                blocks.append({"type": "text", "content": " ".join(l["text"] for l in intro)})
            if piece["kind"] == "poem":
                blocks.append({"type": "poem", "content": poem_join(part["lines"], author)})
            else:
                blocks.append({"type": "text", "content": "\n\n".join(para_join(part["lines"]))})
            sections.append({"id": sec_id, "title": part["title"], "blocks": blocks})
            content_full = "\n\n".join(b["content"] for b in blocks)
            sub_basic.append({
                "id": sec_id, "title": part["title"],
                "subtopics": [{"id": f"{sec_id}.1", "title": part["title"],
                               "content": content_full[:6000]}],
            })

        qblocks = questions_blocks(questions)
        qflat = questions_flat(questions)
        if qblocks:
            qid = f"{cid}.{len(parts) + 1}"
            sections.append({"id": qid, "title": "Questions", "blocks": qblocks})
            sub_basic.append({
                "id": qid, "title": "Questions",
                "subtopics": [{"id": f"{qid}.1", "title": "Questions",
                               "content": qflat[:6000]}],
            })

        rich = {"id": cid, "title": piece["title"], "subject": "English",
                "sections": sections}
        (DATA_DIR / f"ch{cid}_rich.json").write_text(
            json.dumps(rich, ensure_ascii=False, indent=1), encoding="utf-8")

        basic_chapters.append({
            "id": cid, "title": piece["title"], "subject": "English",
            "intro": " ".join(l["text"] for l in intro)[:800],
            "sections": sub_basic, "exercises": [],
        })

        def blen(b):
            return len(b.get("content", "")) + sum(blen(x) for x in b.get("blocks", []))
        stat = ", ".join(
            f"{s['title'][:22]}({sum(blen(b) for b in s['blocks'])})"
            for s in sections)
        extra = f" author={author!r}" if author else ""
        print(f"ch{cid:2d} [{piece['kind']:6s}] {piece['title'][:34]:36s} p{start}-{end-1} -> {stat}{extra}")

    basic_chapters.sort(key=lambda c: c["id"])
    (DATA_DIR / "ncert_chapters.json").write_text(
        json.dumps(basic_chapters, ensure_ascii=False, indent=1), encoding="utf-8")
    n_eng = len([c for c in basic_chapters if c["subject"] == "English"])
    print(f"\nWrote {n_eng} English chapters (ids {FIRST_ID}..{FIRST_ID + n_eng - 1}).")


if __name__ == "__main__":
    main()
