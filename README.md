# NCERT Class 10 Science — AI Tutor

An interactive, local-first learning platform for NCERT Class 10 Science. Read structured chapter content, chat with an AI tutor powered by **Phi-4 Mini** (running entirely on your machine via Ollama), solve practice questions, and upload question papers for automatic answer generation — all without an internet connection or API keys.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10 + | [python.org](https://www.python.org/downloads/) |
| Node.js | 18 + | [nodejs.org](https://nodejs.org/) |
| Ollama | latest | [ollama.com](https://ollama.com/) |
| Tesseract OCR | 5.x | [github.com/UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki) *(for scanned PDF upload only)* |

---

## Setup & Run

### 1 — Clone the repo

```bash
git clone https://github.com/tarun-227/ncert-science-tutor.git
cd ncert-science-tutor
```

### 2 — Pull the AI model

```bash
ollama pull phi4-mini
```

> Ollama must be running in the background before starting the app.
> On Windows/Mac it starts automatically after installation.

### 3 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4 — Start the backend

```bash
# Windows
python -m uvicorn backend.main:app --port 8000 --reload

# Mac / Linux
uvicorn backend.main:app --port 8000 --reload
```

The API will be available at `http://localhost:8000`.

### 5 — Install frontend dependencies & start the dev server

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Project Structure

```
ncert-science-tutor/
├── backend/
│   ├── main.py          # FastAPI app — all API endpoints
│   ├── chat.py          # Ollama integration & prompt building
│   ├── content.py       # Chapter JSON loader
│   ├── sessions.py      # In-memory chat history
│   └── qpaper.py        # Question paper solver pipeline
├── frontend/
│   ├── src/
│   │   ├── pages/       # LandingPage, ChapterPage, QPaperPage
│   │   └── components/  # ChatSidebar, RichContent, ExerciseSection, …
│   ├── package.json
│   └── vite.config.js   # Proxies /api → localhost:8000
├── data/
│   ├── ncert_chapters.json   # Structured chapter content (all 13 chapters)
│   ├── ch1_rich.json         # Rich block content for Chapter 1
│   └── figures/ch1/          # Chapter 1 figure images
└── requirements.txt
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, inline-styled components |
| Backend | FastAPI (Python) |
| AI model | Phi-4 Mini via Ollama (runs 100% locally) |
| Content | Pre-extracted NCERT JSON (no PDF parsing at runtime) |

---

## Troubleshooting

**`Connection refused` on chat** — Make sure Ollama is running (`ollama serve`) and `phi4-mini` is pulled.

**`Module not found`** — Run `pip install -r requirements.txt` again inside the project root.

**Figures not showing** — The backend serves figures from `data/figures/`. Make sure you cloned with the full repo (LFS not used — images are committed directly).

**Port already in use** — Change `--port 8000` to any free port and update `frontend/vite.config.js` to match.
