"""Ollama Phi-4 Mini integration + prompt building."""
import json
import re
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL      = "phi4-mini"
OPTIONS    = {"temperature": 0.4, "num_predict": 800}


def _call_ollama(prompt: str) -> str:
    # First call can be slow — model has to warm up (30s+ on this box)
    resp = requests.post(
        OLLAMA_URL,
        json={"model": MODEL, "prompt": prompt, "stream": False, "options": OPTIONS},
        timeout=300,
    )
    resp.raise_for_status()
    return resp.json().get("response", "").strip()


def warmup() -> None:
    """Fire a tiny generation so the model is loaded before the first user request."""
    try:
        requests.post(
            OLLAMA_URL,
            json={"model": MODEL, "prompt": "hi", "stream": False,
                  "options": {"num_predict": 1}},
            timeout=300,
        )
    except Exception:
        pass  # warmup is best-effort


def build_system_block(chapter_title: str, subtopic_title: str, content: str) -> str:
    return (
        f"You are a friendly, patient Class 10 Science tutor.\n"
        f"The student is currently studying:\n"
        f"  Chapter: {chapter_title}\n"
        f"  Topic:   {subtopic_title}\n\n"
        f"Relevant textbook content:\n"
        f"---\n{content[:1500]}\n---\n\n"
        f"Rules:\n"
        f"- Answer specifically about this topic only\n"
        f"- Be concise but complete (3-6 sentences usually enough)\n"
        f"- If asked to explain: start with a real-life observation, then the concept\n"
        f"- If asked to simplify: use an everyday analogy a 15-year-old would relate to\n"
        f"- If asked for an example: give a concrete real-world example\n"
        f"- For numericals: show step-by-step with each formula clearly stated\n"
        f"- End with the key exam point when relevant\n"
    )


def build_history_block(history: list[dict]) -> str:
    if not history:
        return ""
    lines = ["Previous conversation:"]
    for msg in history[-8:]:  # last 4 pairs
        role = "Student" if msg["role"] == "user" else "Tutor"
        lines.append(f"{role}: {msg['content'][:300]}")
    return "\n".join(lines) + "\n\n"


def chat(
    user_message: str,
    chapter_title: str,
    subtopic_title: str,
    subtopic_content: str,
    history: list[dict],
) -> str:
    system  = build_system_block(chapter_title, subtopic_title, subtopic_content)
    hist    = build_history_block(history)
    prompt  = f"{system}\n{hist}Student: {user_message}\n\nTutor:"
    return _call_ollama(prompt)


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
    raw = _call_ollama(prompt)
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
    solution_text = _call_ollama(prompt)

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
    feedback = _call_ollama(prompt)
    rating = "Good"
    if "excellent" in feedback.lower():
        rating = "Excellent"
    elif "needs improvement" in feedback.lower() or "incorrect" in feedback.lower():
        rating = "Needs Improvement"
    return {"feedback": feedback, "rating": rating}
