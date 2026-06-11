# Master.AI — NCERT Class 10 Study Companion

An AI-powered study platform for **CBSE Class 10**, covering **Science** and **English**. Sign in with Google, read structured chapter content, learn section-by-section with an AI tutor, build study plans, track your progress, and turn any question paper into a solved PDF.

**Live demo:** *(add your Railway URL here)*

---

## Features

- **Google sign-in + onboarding** — Supabase auth (with anonymous fallback) and a guided onboarding wizard that captures name, school, phone, self-ratings, tough subjects, and learning pace.
- **Two study modes**
  - **Book mode** — read the full, structured chapter with breadcrumb navigation, inline figures, and exercises.
  - **Tutor mode** — work through a chapter section-by-section with AI-generated summaries at two depths (**Overview** / **Detail**).
- **AI Tutor chat** — ask anything about the current chapter or section and get contextual answers.
- **Select-to-learn** — highlight any text to **Explain** it with AI or save it as a **Note**.
- **Practice & exercises** — auto-generated questions and step-by-step solutions for textbook exercises.
- **Study plans** — multi-subject plans with a target date and daily hours, plus engagement/completion progress tracking.
- **Progress, notes & highlights** — all saved per-user in Supabase and synced across devices.
- **Question Paper Solver** — upload a PDF question paper and get a formatted answer PDF back (scanned PDFs supported via OCR).

### Content

| Subject | Chapters | Source |
|---------|----------|--------|
| Science | 13 | NCERT Class 10 Science |
| English | 22 | NCERT Class 10 *First Flight* (each lesson & poem as its own chapter) |

All content is pre-structured into JSON (`data/ncert_chapters.json` + per-chapter `chN_rich.json`).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + React Router |
| Backend | FastAPI (Python 3.12) |
| Auth & DB | Supabase (Postgres, Row-Level Security, Google OAuth) |
| AI | Groq API — Llama 3.3 70B Versatile |
| PDF / OCR | pdfplumber, PyMuPDF, ReportLab, Tesseract (`pytesseract`) |
| Deploy | Railway (multi-stage Dockerfile — Node builds the frontend, Python serves it) |

---

## Architecture

A single FastAPI service serves both the JSON API and the built React app. User data lives in Supabase; the browser talks to Supabase directly with the public anon key (protected by RLS), while the backend uses the service key for trusted operations.

```
Browser ──┬─► FastAPI  (/api/*  +  serves React build)  ──► Groq API
          └─► Supabase (auth + Postgres, guarded by RLS)
```

### Backend modules (`backend/`)

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app — all endpoints + serves the React build |
| `chat.py` | Groq integration & prompt building |
| `content.py` | Chapter JSON loader |
| `db_sessions.py` | Supabase-backed chat history (falls back to in-memory) |
| `sessions.py` | In-memory chat fallback store |
| `supabase_client.py` | Supabase service client |
| `qpaper.py` | Question paper → OCR → AI answers → PDF pipeline |

### Key API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/api/chapters` | List all chapters |
| `GET`  | `/api/chapters/{id}` | Chapter (structured) |
| `GET`  | `/api/chapters/{id}/rich` | Chapter (rich block content) |
| `POST` | `/api/chat` | Tutor chat |
| `POST` | `/api/tutor-summary` | Section summary (Overview / Detail) |
| `POST` | `/api/practice` | Generate practice questions |
| `POST` | `/api/exercise` | Solve a textbook exercise |
| `POST` | `/api/qpaper/upload` | Upload a question paper PDF |
| `GET`  | `/api/qpaper/{job_id}/download` | Download the solved PDF |
| `GET`  | `/api/health` | Health check (`groq_key_set`, etc.) |

---

## Local Development

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.12+ |
| Node.js | 20+ |
| Groq API key | Free at [console.groq.com](https://console.groq.com) |
| Supabase project | Free at [supabase.com](https://supabase.com) — for auth & data |
| Tesseract OCR | 5.x — optional, only for scanned-PDF upload |

### Setup

**1. Clone**
```bash
git clone https://github.com/tarun-227/ncert-science-tutor.git
cd ncert-science-tutor
```

**2. Configure environment**
```bash
cp .env.example .env
# Fill in GROQ_API_KEY and your Supabase values (see Environment Variables below)
```

**3. Backend**
```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --port 8000 --reload
```

**4. Frontend** (new terminal)
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

> **Dev convenience:** in `npm run dev`, the auth/onboarding gate is bypassed (`ProtectedRoute` short-circuits when `import.meta.env.DEV` is true) so you can preview the UI without signing in. Production builds enforce it fully. The frontend reads Supabase keys from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, so put those in `frontend/.env.local` (or the root `.env`) if you want auth working locally.

---

## Environment Variables

### Backend (server-side — keep secret)

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service-role key (full DB access, bypasses RLS — **never expose**) |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret from Supabase → Settings → API |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (defaults to `*`) |

### Frontend (build-time — baked into the JS bundle)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Same project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon key (safe to expose; protected by RLS) |

---

## Deploying to Railway

The repo builds from a multi-stage `Dockerfile` (Node stage builds the frontend, Python stage serves the API + static build).

1. **New Project → Deploy from GitHub repo**, select this repository.
2. **Variables tab** — add the four backend variables: `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`.
3. **Settings → Build → Build Args** — add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (these must be present at build time so they get baked into the bundle).
4. **Supabase → Authentication → URL Configuration** — set the **Site URL** and add the Railway URL to **Redirect URLs** so Google OAuth redirects back correctly.
5. Deploy — Railway builds and gives you a public URL.

---

## Project Structure

```
ncert-science-tutor/
├── backend/
│   ├── main.py              # FastAPI app — endpoints + serves React build
│   ├── chat.py              # Groq integration & prompts
│   ├── content.py           # Chapter JSON loader
│   ├── db_sessions.py       # Supabase chat persistence (+ in-memory fallback)
│   ├── supabase_client.py   # Supabase service client
│   └── qpaper.py            # Question paper → OCR → AI → PDF
├── frontend/
│   └── src/
│       ├── pages/           # LandingPage, StudyView (book+tutor), Onboarding,
│       │                    #   AuthPage, ProfilePage, AppShell, QPaperPage
│       ├── components/      # Sidebar, ChatSidebar, RichContent, StudyPlans, …
│       ├── contexts/        # AuthContext
│       └── lib/             # supabase.js, userdata.js
├── data/
│   ├── ncert_chapters.json  # Science + English chapter index
│   ├── chN_rich.json        # Rich block content (ch1–ch35)
│   └── figures/             # Chapter figures
├── supabase/                # SQL maintenance scripts
├── Dockerfile               # Multi-stage build (Railway)
├── requirements.txt
└── .env.example
```

---

## Troubleshooting

- **AI responses failing** — Confirm `GROQ_API_KEY` is set. `GET /api/health` returns `"groq_key_set": true` when it's loaded. Note the Groq key lives only on the **backend** (Railway Variables / local `.env`); the frontend never sees it.
- **Sign-in redirects to the wrong/old deployment** — Update the **Site URL** and **Redirect URLs** in Supabase → Authentication to match your current Railway domain.
- **Login works but data doesn't save** — Check the three Supabase backend vars and that the build args (`VITE_SUPABASE_*`) were set; the anon key must be baked into the frontend bundle at build time.
- **`Module not found`** — Run `pip install -r requirements.txt` from the project root.
- **Scanned PDF upload not working** — Install [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki). The app degrades gracefully without it (text-based PDFs still work).
- **Port already in use** — Change `--port 8000` and update `frontend/vite.config.js`'s `/api` proxy to match.
```
