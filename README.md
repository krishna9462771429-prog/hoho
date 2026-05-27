# APIMerge

AI-Powered API Reliability & Orchestration Platform

## Stack

- **Frontend**: React, Vite, TypeScript, TailwindCSS, Framer Motion, Recharts
- **Backend**: FastAPI, Python, APScheduler, httpx
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **AI**: Groq LLaMA-3.1 (primary) + Google Gemini (fallback)
- **Deploy**: Vercel (frontend) + Render (backend)

## Features

- API endpoint registration and health monitoring
- Real-time uptime, latency, and failure tracking
- AI-generated fallback responses when APIs fail (Groq → Gemini cascade)
- API merge: combine multiple endpoints into one unified call
- AI workflow & format generator
- Keep-alive ticker for Render/Vercel deployments
- Logs with search, filter, pagination
- Analytics: charts, heatmaps, latency trends, AI usage
- Email and Discord webhook alerts
- Settings: AI provider, retry config, notifications

## Local Development

### Frontend

```bash
# 1. Copy env file
cp .env.example .env
# 2. Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

# 3. Install and run
npm install
npm run dev
```

### Backend

```bash
cd backend
cp .env.example .env
# Fill in all env vars

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Environment Variables

### Frontend (.env)

| Variable | Description |
|---|---|
| VITE_SUPABASE_URL | Your Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Supabase anon/public key |
| VITE_API_URL | Backend API URL |

### Backend (.env)

| Variable | Description |
|---|---|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Service role key (bypasses RLS) |
| GROQ_API_KEY | Groq API key (get from console.groq.com) |
| GEMINI_API_KEY | Google Gemini API key |
| RESEND_API_KEY | Resend API key for email alerts |
| DISCORD_WEBHOOK_URL | Discord webhook for alerts |

## Deployment

### Vercel (Frontend)

1. Push repo to GitHub
2. Import in Vercel
3. Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL)
4. Deploy

### Render (Backend)

1. Create new Web Service on render.com
2. Connect your repo, set root directory to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from backend/.env.example
6. Deploy

## Database

Apply `schema.sql` to your Supabase project via the SQL Editor, or use the migrations already applied.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /apis/ | List user APIs |
| POST | /apis/ | Create API |
| POST | /apis/{id}/check | Manual check |
| POST | /ai/fallback | Generate AI fallback |
| POST | /ai/generate | Generate workflow/schema |
| POST | /ai/diagnose | AI failure diagnosis |
| GET | /ai/diagnoses/{api_id} | Diagnosis history |
| GET | /ai/diagnosis-stats | Diagnosis statistics |
| POST | /merge/execute | Execute merge |
| GET | /merge/{slug} | Call workflow by slug |
| GET | /monitoring/stats | Dashboard stats |
| GET | /analytics/overview | Analytics data |
| GET/POST | /ticker/ | Keep-alive services |
| WS | /ws/logs | Real-time log stream |
| WS | /ws/events | Real-time events |

## WebSocket Events

| Event Type | Description |
|---|---|
| api_status_update | API status/latency changes |
| new_log | New log entry |
| failure_detected | API failure detected |
| recovery_detected | API recovered |
| diagnosis_generated | AI diagnosis completed |
| ticker_ping | Keep-alive ping result |
| ai_fallback_generated | AI fallback created |
| workflow_execution | Workflow executed |
