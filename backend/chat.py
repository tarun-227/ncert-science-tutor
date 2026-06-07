"""Groq API integration + prompt building."""
import json
import os
import re
import requests

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
MODEL        = "llama-3.1-8b-instant"
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"


def _call_hf(prompt: str) -> str:
    """Single-turn call — used by practice / exercise / evaluate helpers."""
    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.4,
            "max_tokens": 800,
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_hf_long(prompt: str, max_tokens: int = 2000) -> str:
    """Single-turn call with higher token limit — used by qpaper pipeline."""
    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": max_tokens,
        },
        timeout=90,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_chat(messages: list[dict]) -> str:
    """Multi-turn call — used by the interactive tutor chat."""
    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": MODEL,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 800,
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_chat_json(messages: list[dict]) -> str:
    """Multi-turn call constrained to a JSON object response (Groq JSON mode).

    Used by the structured "Style F" tutor answer so the model reliably returns
    parseable JSON instead of free-form prose.
    """
    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": MODEL,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 900,
            "response_format": {"type": "json_object"},
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def chat(
    user_message: str,
    chapter_title: str,
    subtopic_title: str,
    subtopic_content: str,
    history: list[dict],
    subject: str = "Science",
) -> str:
    """Interactive tutor chat using proper multi-turn message format.

    Uses system / user / assistant roles so the model never confuses the
    conversation history with its own output and never hallucinates a fake
    'Student:' turn.
    """
    is_english = subject.lower() == "english"
    subject_label = "English Literature & Language" if is_english else "Science"
    subject_rules = (
        "- Help the student understand the story/poem theme, characters, and language.\n"
        "- For comprehension questions: guide with hints before giving the full answer.\n"
        "- For grammar/vocabulary: give clear definitions with examples from the text.\n"
        "- For essay/writing prompts: suggest an outline and key points.\n"
        "- Quote from the text when it helps clarify meaning.\n"
        "- End with the key literary point or exam tip when relevant.\n"
        if is_english else
        "- Be concise but complete (3–6 sentences is usually enough).\n"
        "- If asked to explain: start with a real-life observation, then the concept.\n"
        "- If asked to simplify: use an everyday analogy a 15-year-old would relate to.\n"
        "- If asked for an example: give a concrete real-world example.\n"
        "- For numericals: show step-by-step with each formula clearly stated.\n"
        "- End with the key exam point when relevant.\n"
    )
    system_content = (
        f"You are a friendly, patient Class 10 {subject_label} tutor.\n"
        f"The student is currently studying:\n"
        f"  Chapter: {chapter_title}\n"
        f"  Topic:   {subtopic_title}\n\n"
        f"Relevant textbook content:\n"
        f"---\n{subtopic_content[:1500]}\n---\n\n"
        f"Rules:\n"
        f"- ALWAYS answer the student's current question directly — do not continue or invent previous topics.\n"
        f"{subject_rules}"
    )

    messages: list[dict] = [{"role": "system", "content": system_content}]

    # Inject history as proper user / assistant turns (last 4 pairs = 8 messages)
    for msg in history[-8:]:
        messages.append({"role": msg["role"], "content": msg["content"][:400]})

    messages.append({"role": "user", "content": user_message})

    return _call_chat(messages)


# ── Structured "Style F" tutor answer ─────────────────────────────────────────

def _style_f_instructions(is_english: bool) -> str:
    """How the model must shape its JSON so it fits the Style F answer card."""
    formula_rule = (
        "- \"formula\": always null (English answers have no formulas).\n"
        if is_english else
        "- \"formula\": include ONLY when a genuine chemical equation or math formula is "
        "central to the answer; otherwise set it to null. Use Unicode subscripts/superscripts "
        "(e.g. C₆H₁₂O₆, H₂O, CO₂) and → for reaction arrows. Keep it to a single line.\n"
    )
    term_kind = (
        "important literary or language terms (e.g. theme, metaphor, narrator)"
        if is_english else
        "important scientific/technical vocabulary"
    )
    return (
        "Respond with a SINGLE JSON object (no text outside it) in exactly this shape:\n"
        "{\n"
        '  "paragraphs": ["...", "..."],\n'
        '  "terms": {"TermText": "one-sentence definition"},\n'
        '  "formula": null,\n'
        '  "keyLink": "one-sentence key takeaway"\n'
        "}\n"
        "Rules for the JSON values:\n"
        "- \"paragraphs\": 2–3 SHORT plain-text paragraphs that are the actual answer. "
        "No markdown, no bullet characters, no headings.\n"
        f"- \"terms\": a map of 2–5 of the MOST {term_kind} used in your answer, each to a "
        "concise one-sentence definition. Every term key MUST appear verbatim (identical spelling "
        "and capitalisation) somewhere in the paragraphs so it can be highlighted. Choose real "
        "domain terms, never common words. Use {} if the answer has no notable terms.\n"
        f"{formula_rule}"
        "- \"keyLink\": one short sentence with the single most important takeaway for a conceptual "
        "answer; use null for trivial or one-line answers.\n"
        "- Keep everything accurate to the textbook content and concise. Output ONLY the JSON object."
    )


def chat_structured(
    user_message: str,
    chapter_title: str,
    subtopic_title: str,
    subtopic_content: str,
    history: list[dict],
    subject: str = "Science",
) -> tuple[str, dict | None]:
    """Interactive tutor chat that returns a structured "Style F" answer.

    Returns (plain_text, structured) where `structured` is
    {paragraphs, terms, formula, keyLink} ready for the RichAnswer renderer, or
    None if the model could not produce valid structured output (caller should
    fall back to rendering plain_text). `plain_text` is always a usable answer
    string for chat history / fallback rendering.
    """
    is_english = subject.lower() == "english"
    subject_label = "English Literature & Language" if is_english else "Science"
    subject_rules = (
        "- Help the student understand the story/poem theme, characters, and language.\n"
        "- For comprehension: guide with the reasoning, then the answer.\n"
        "- Quote briefly from the text when it clarifies meaning.\n"
        if is_english else
        "- Be concise but complete.\n"
        "- When explaining a concept, start from a real-life observation, then the idea.\n"
        "- When simplifying, use an everyday analogy a 15-year-old relates to.\n"
        "- For numericals, state each formula and step clearly.\n"
    )
    system_content = (
        f"You are a friendly, patient Class 10 {subject_label} tutor.\n"
        f"The student is currently studying:\n"
        f"  Chapter: {chapter_title}\n"
        f"  Topic:   {subtopic_title}\n\n"
        f"Relevant textbook content:\n---\n{subtopic_content[:1500]}\n---\n\n"
        f"Teaching style:\n"
        f"- ALWAYS answer the student's current question directly.\n"
        f"{subject_rules}\n"
        f"{_style_f_instructions(is_english)}"
    )

    messages: list[dict] = [{"role": "system", "content": system_content}]
    for msg in history[-8:]:
        messages.append({"role": msg["role"], "content": msg["content"][:400]})
    messages.append({"role": "user", "content": user_message})

    try:
        raw = _call_chat_json(messages)
        data = json.loads(raw)

        paragraphs = [p.strip() for p in data.get("paragraphs", [])
                      if isinstance(p, str) and p.strip()]
        if not paragraphs:
            raise ValueError("no paragraphs in structured answer")

        raw_terms = data.get("terms") or {}
        terms = {
            str(k).strip(): str(v).strip()
            for k, v in raw_terms.items()
            if isinstance(k, str) and k.strip() and isinstance(v, str) and v.strip()
        }

        formula = data.get("formula")
        if not (isinstance(formula, str) and formula.strip()):
            formula = None
        else:
            formula = formula.strip()

        key_link = data.get("keyLink")
        if not (isinstance(key_link, str) and key_link.strip()):
            key_link = None
        else:
            key_link = key_link.strip()

        structured = {
            "paragraphs": paragraphs,
            "terms": terms,
            "formula": formula,
            "keyLink": key_link,
        }
        plain_text = " ".join(paragraphs)
        if key_link:
            plain_text += " " + key_link
        return plain_text, structured
    except Exception:
        # Model didn't return usable JSON — fall back to plain prose answer.
        text = chat(user_message, chapter_title, subtopic_title,
                    subtopic_content, history, subject)
        return text, None


def generate_practice(subtopic_title: str, content: str) -> dict:
    """Generate 2 MCQs + 1 short answer for a subtopic."""
    prompt = (
        f"You are generating practice questions for Class 10 Science students.\n"
        f"Topic: {subtopic_title}\n"
        f"Content: {content[:1000]}\n\n"
        f"Generate exactly:\n"
        f"1. Two MCQs, each with 4 options (a/b/c/d). Mark the correct option.\n"
        f"2. One short answer question (answer in 2-3 sentences).\n\n"
        f"Return ONLY valid JSON in this exact format:\n"
        f'{{"mcqs": [{{"question": "...", "options": ["a) ...", "b) ...", "c) ...", "d) ..."], "answer": "a", "explanation": "..."}},'
        f'{{"question": "...", "options": ["a) ...", "b) ...", "c) ...", "d) ..."], "answer": "b", "explanation": "..."}}],'
        f'"short": {{"question": "...", "sample_answer": "..."}}}}\n'
    )
    raw = _call_hf(prompt)
    # Extract JSON from response
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    # Fallback
    return {
        "mcqs": [
            {"question": f"What is the main concept of {subtopic_title}?",
             "options": ["a) Option A", "b) Option B", "c) Option C", "d) Option D"],
             "answer": "a", "explanation": "See textbook content above."},
        ],
        "short": {"question": f"Explain {subtopic_title} in your own words.", "sample_answer": ""},
    }


def exercise_solution(question: str, chapter_title: str, step_num: int = 1) -> dict:
    """Generate step-by-step solution for an exercise question."""
    prompt = (
        f"You are solving a Class 10 Science exercise question from chapter: {chapter_title}\n\n"
        f"Question: {question}\n\n"
        f"Provide a complete step-by-step solution. Number each step clearly (Step 1, Step 2, ...).\n"
        f"For MCQs: explain why each option is correct/incorrect.\n"
        f"For numericals: show each formula and substitution.\n"
        f"For descriptive: give a structured answer with key points.\n\n"
        f"Solution:"
    )
    solution_text = _call_hf(prompt)

    # Split into steps
    steps = []
    for part in re.split(r'Step\s+\d+[:\.]?\s*', solution_text, flags=re.IGNORECASE):
        part = part.strip()
        if part:
            steps.append(part)

    if not steps:
        steps = [solution_text]

    return {"steps": steps, "full": solution_text}


def evaluate_short_answer(question: str, student_answer: str, sample_answer: str) -> dict:
    """Evaluate a student's short answer and give feedback."""
    prompt = (
        f"A Class 10 Science student answered a question. Evaluate their answer.\n\n"
        f"Question: {question}\n"
        f"Student's answer: {student_answer}\n"
        f"Reference answer: {sample_answer}\n\n"
        f"Give brief feedback (2-3 sentences):\n"
        f"1. What they got right\n"
        f"2. What's missing or incorrect\n"
        f"3. The correct key points\n\n"
        f"Also rate: Excellent / Good / Needs Improvement\n"
        f"Feedback:"
    )
    feedback = _call_hf(prompt)
    rating = "Good"
    if "excellent" in feedback.lower():
        rating = "Excellent"
    elif "needs improvement" in feedback.lower() or "incorrect" in feedback.lower():
        rating = "Needs Improvement"
    return {"feedback": feedback, "rating": rating}
