# NCERT Class 10 Science AI Tutor — Product Overview

## What is this?

This is an **AI-powered, interactive learning platform** built specifically for NCERT Class 10 Science students. It combines the full NCERT textbook content with a local AI tutor (Phi-4 Mini) so students can read, ask questions, practice, and get instant explanations — all without needing the internet or paying for any API.

Everything runs on the student's own computer. No data leaves the device.

---

## Who is it for?

- Class 10 students preparing for board exams
- Students who want deeper understanding beyond rote memorization
- Teachers who want a ready-to-use digital companion for NCERT Science

---

## Features

### 1. Chapter Library — Landing Page

The home screen displays all **13 NCERT Class 10 Science chapters** as cards. Each card shows:
- Chapter number and title
- Subject tag (Physics / Chemistry / Biology) with colour coding
- Section count

Click any card to open that chapter's full learning page.

**How it helps:** Students get a clear, visual overview of the entire syllabus and can jump directly to any topic without scrolling through a PDF.

---

### 2. Structured Chapter Reader — Left Panel

Each chapter page shows the full NCERT content in a clean, readable format:

- **Chapter intro** — the opening paragraph from the textbook
- **Sections & subsections** — collapsible, with bold headings
- **Paragraphs** — readable typography with highlight support (click ✦ to highlight any paragraph; highlights persist across sessions via localStorage)
- **Chemical equations** — displayed in a styled monospace block with equation number and a copy button; arrows (→) are rendered properly
- **Figures** — actual NCERT diagrams with captions; click any figure to zoom it in a lightbox
- **Activity boxes** — lab activities from the textbook, styled distinctly
- **Did You Know callouts** — fun facts and definitions pulled from the textbook margin notes
- **In-text questions** — NCERT in-chapter questions rendered inline
- **Section footer** — at the end of each section, quick-ask pills let students send a specific question to the AI tutor in one click

**How it helps:** Students read the same content as the textbook but in a format optimized for screens — no more pinching and zooming PDFs. Highlighting lets them mark important lines for revision.

---

### 3. AI Tutor Chat — Right Panel (Chat Tab)

A persistent chat sidebar powered by **Phi-4 Mini** running locally via Ollama.

Features:
- **Context-aware responses** — the AI always knows which chapter and section the student is currently reading; every response is grounded in the actual textbook content
- **Action buttons per subtopic** — below each subtopic, four buttons instantly send a pre-formed question:
  - **Explain** — get a plain-English explanation of the subtopic
  - **Simplify** — get an analogy or everyday-life explanation
  - **Give Example** — get a real-world example
  - **Test Me** — triggers a quick MCQ to test understanding
- **Free-form chat** — students can type any question; the AI answers in the context of the chapter
- **Quick-prompt chips** — one-click prompts like "What is a catalyst?" or "Explain decomposition" for common questions
- **Typing indicator** — animated dots while the AI is thinking
- **Markdown rendering** — responses with bold text, bullet points, and inline code display correctly
- **Chat history** — the conversation persists as long as the page is open; a "Clear" button resets it

**How it helps:** Students get a patient tutor available 24/7 who never gives a generic answer — every reply is tied to what they're reading right now. This is especially useful when a student is stuck on a concept at night before an exam.

---

### 4. Check Yourself — Inline MCQs (Chat Tab)

When a student clicks **Test Me** (or **✦ Check Yourself** at the bottom of a section), an MCQ pops up inside the chat panel:

- 4 options with radio-button style selectors
- **Check Answer** button reveals correct/wrong with colour-coded feedback (green = correct, red = wrong)
- An explanation follows automatically

**How it helps:** Spaced retrieval practice improves retention far better than re-reading. Students can self-test after every section without switching to another app.

---

### 5. NCERT Exercises — Exercise Tab

All NCERT end-of-chapter exercises are listed in a dedicated tab:

**MCQs (Multiple Choice):**
- Click an option to select it
- **Check Answer** reveals the correct answer with colour feedback
- An AI-generated step-by-step explanation loads automatically after checking

**Short & Long Answer questions:**
- Displayed with a **Solve with AI Tutor** button
- Clicking opens the question in the chat sidebar with a solve prompt pre-filled, so the AI walks through the solution

**How it helps:** Students can practice official NCERT exercises with instant feedback and explanations — replacing the need to look up answer keys or wait for a tutor.

---

### 6. Notes — Notes Tab

A simple notepad built into the right panel. Students can:
- Type and save personal notes for each chapter
- Notes are saved automatically to the browser (localStorage) per chapter
- Notes persist across page reloads and browser restarts

**How it helps:** Students can jot down formulas, key points, or their own summaries without switching to another app. Everything stays organized by chapter.

---

### 7. Question Paper Solver — Separate Page

An experimental feature accessible from the top-right of the landing page. Students can:

1. **Upload any PDF question paper** (scanned or digital, up to 20 MB, up to 20 questions)
2. The system:
   - Extracts text from the PDF (uses OCR automatically for scanned pages)
   - Splits the paper into individual questions
   - Sends each question to the AI tutor model
   - Compiles all answers into a formatted PDF
3. **Download the answer PDF** — every question paired with its AI-generated answer, cleanly formatted

Progress is shown in real time with a status bar: Queued → Extracting → Solving (Question X of Y) → Rendering → Done.

**How it helps:** Students can upload previous years' question papers and get a complete answer sheet in minutes — useful for last-minute revision or understanding how to approach exam-style questions.

---

## How Features Work Together (Typical Study Session)

```
Student opens the app
       ↓
Picks a chapter from the card grid
       ↓
Reads the section in the left panel
       ↓
Spots something confusing → clicks "Simplify" → AI explains with an analogy
       ↓
Reads more → clicks "✦ Check Yourself" → answers a quick MCQ
       ↓
Gets it wrong → AI explains the correct answer
       ↓
Opens Exercise tab → works through NCERT MCQs with instant checking
       ↓
Clicks "Solve with AI" on a long-answer question → AI shows step-by-step
       ↓
Jots key points in the Notes tab
       ↓
End of session → goes to Question Paper Solver → uploads last year's paper
       ↓
Downloads a complete answer PDF for review
```

---

## Privacy & Offline Use

- **100% local** — the AI model runs on your computer via Ollama. No questions or answers are sent to any server.
- **No login required** — there are no accounts, no sign-ups, no tracking.
- **Works offline** — once the model is downloaded and the app is running, no internet connection is needed.

---

## Current Coverage

| Chapter | Rich Content (figures + equations) | Exercises |
|---------|-----------------------------------|-----------|
| Ch. 1 — Chemical Reactions and Equations | Full | Full |
| Ch. 2–13 | Text + sections | Full |

Rich block content (figures, equations, activities) is currently fully detailed for Chapter 1. The remaining chapters have full text and exercises; rich content will be expanded in future updates.
