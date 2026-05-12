# NCERT Class 10 Science — AI Tutor

An interactive learning platform for NCERT Class 10 Science. Read structured chapter content, chat with an AI tutor, solve practice questions, and upload question papers for automatic answer generation.

**Live demo:** *(add your Railway URL here after deploying)*

---

## Features

- **AI Tutor Chat** — Ask questions about any chapter or subtopic and get contextual answers
- **Chapter Reader** — All 13 NCERT Class 10 Science chapters structured and ready to read
- **Practice Questions** — Auto-generated MCQs and short-answer questions per subtopic
- **Exercise Solutions** — Step-by-step solutions for textbook exercises
- **Question Paper Solver** — Upload a PDF question paper and get a formatted answer PDF back (supports scanned PDFs via OCR)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Backend | FastAPI (Python 3.10+) |
| AI | Groq API — Llama 3.1 8B Instant (free tier) |
| OCR | Tesseract 5.x (optional, for scanned PDFs) |
| Content | Pre-structured NCERT JSON files |

---

## Local Development

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| Groq API key | Free at [console.groq.com](https://console.groq.com) |
| Tesseract OCR | 5.x — optional, only needed for scanned PDF upload |

### Setup

**1. Clone the repo**
```bash
git clone https://github.com/tarun-227/ncert-science-tutor.git
cd ncert-science-tutor
```

**2. Set your Groq API key**
```bash
cp .env.example .env
# Edit .env and add your key:
# GROQ_API_KEY=gsk_...
```

**3. Install Python dependencies**
```bash
pip install -r requirements.txt
```

**4. Start the backend**
```bash
python -m uvicorn backend.main:app --port 8000 --reload
```

**5. Install frontend dependencies and start the dev server**
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Deploying to Railway

This repo is pre-configured for a single-service Railway deployment — FastAPI serves both the API and the built React frontend.

**1. Push to GitHub** (already done if you're reading this)

**2. Create a Railway project**
- Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
- Select this repository

**3. Add environment variable**

In the Railway dashboard → Variables tab:
```
GROQ_API_KEY = gsk_your_key_here
```

**4. Deploy**

Railway auto-detects the `railway.toml` config, builds the frontend, and starts the server. You'll get a public URL in ~3 minutes.

---

## Project Structure

```
ncert-science-tutor/
├── backend/
│   ├── main.py          # FastAPI app — all API endpoints + serves React build
│   ├── chat.py          # Groq API integration & prompt building
│   ├── content.py       # Chapter JSON loader
│   ├── sessions.py      # In-memory chat history
│   └── qpaper.py        # Question paper → OCR → AI answers → PDF pipeline
├── frontend/
│   ├── src/
│   │   ├── pages/       # LandingPage, ChapterPage, QPaperPage
│   │   └── components/  # ChatSidebar, RichContent, ExerciseSection, …
│   ├── package.json
│   └── vite.config.js   # Proxies /api → localhost:8000 in dev
├── data/
│   ├── ncert_chapters.json   # All 13 chapters (structured content)
│   ├── ch1_rich.json         # Rich block content for Chapter 1
│   └── figures/ch1/          # Chapter 1 figures
├── railway.toml              # Railway build + start config
├── .env.example              # Required environment variables
└── requirements.txt
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key from [console.groq.com](https://console.groq.com) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins. Defaults to `*` |

---

## Troubleshooting

**AI responses failing** — Check that `GROQ_API_KEY` is set correctly. The `/api/health` endpoint returns `groq_key_set: true` if it's loaded.

**`Module not found`** — Run `pip install -r requirements.txt` from the project root.

**Figures not showing** — The backend serves figures from `data/figures/`. Make sure you did a full clone.

**Port already in use** — Change `--port 8000` to any free port and update `frontend/vite.config.js` to match.

**Scanned PDF upload not working** — Install [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki). The app falls back gracefully if it's not installed but OCR won't work.
