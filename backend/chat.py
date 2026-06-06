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
