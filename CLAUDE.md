# CLAUDE.md - Gorgias QA System

## Project Overview
AI-powered ticket grading and QA analytics system for Gorgias customer support. Automatically evaluates agent performance 24 hours after ticket closure using Claude AI.

## Tech Stack
- **Framework:** Next.js 14.0.4 (App Router, single `'use client'` component)
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Deployment:** Vercel (serverless functions + cron)
- **Support Platform:** Gorgias REST API
- **Auth:** Google OAuth via Supabase

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build (use to verify before pushing)
- `npm run start` — Start production server
- `git push` — Triggers Vercel auto-deploy

## Project Structure
```
app/
├── page.js                    # Main dashboard (all UI in one component)
├── layout.js                  # Root layout
├── globals.css                # Global styles
└── api/
    ├── webhook/route.js       # Gorgias webhook (ticket closed → queue)
    ├── process/route.js       # Cron job (evaluate queued tickets)
    ├── analyze/route.js       # Claude AI analysis endpoint
    ├── ticket/route.js        # Fetch ticket from Gorgias
    ├── gorgias/route.js       # Widget status check (CORS enabled)
    ├── internal-note/route.js # Post internal note to Gorgias
    ├── auth/role/route.js     # Role-based access (admin emails + Gorgias teams)
    └── test-db/route.js       # DB connectivity test
```

## Database Tables (Supabase)
- **evaluations** — All QA evaluations (scores in JSONB `scores` column, includes `suggestedResponse`)
- **grading_queue** — Tickets awaiting auto-evaluation (24h delay)
- **disputes** — Agent evaluation appeals (pending/accepted/rejected)
- **coaching_sessions** — Coaching records per agent

## Environment Variables
All set in Vercel + `.env.local`:
- `ANTHROPIC_API_KEY` — Claude API key
- `GORGIAS_API_KEY`, `GORGIAS_DOMAIN`, `GORGIAS_EMAIL` — Gorgias API access
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client

## Auth & Roles
- **Team Leads** — Hardcoded in `app/api/auth/role/route.js` (`ADMIN_EMAILS` array) + Gorgias "Escalations" team members
- **Agents** — All other Google-authenticated users
- Team Leads see: Grade, History, Queue, Analytics, Coaching, Disputes tabs
- Agents see: History (own evaluations only), My Stats tab

## Scoring System
```
Final = SoftSkills(20%) + IssueUnderstanding(30%) + ProductProcess(30%) + ToolsUtilization(20%)
Each subcriteria scored 1-5. Passing rate: ≥ 80%
Grades: A+(95+), A(90+), B+(85+), B(80+), C+(75+), C(70+), D(60+), F(<60)
Zero-tolerance violation → automatic F (0%)
```

## Key Patterns
- All UI is in `app/page.js` — single large client component
- `suggestedResponse` stored inside `scores` JSONB (no separate DB column)
- Bot/skip detection in `process/route.js` (`botNames` and `skipNames` arrays)
- Escalation agents: JB, Arche, Princess, Cess, Analie, Randel, Ardylyn
- Cron runs every 5 minutes (`vercel.json`), processes up to 10 tickets per run

## Important Notes
- RLS is disabled on all tables
- The Gorgias sidebar widget (`/api/gorgias`) must remain unauthenticated (JSON API)
- When adding new DB columns, run `NOTIFY pgrst, 'reload schema';` in Supabase SQL Editor
- To add a team lead: add email to `ADMIN_EMAILS` + `adminNames` in `app/api/auth/role/route.js`
- To skip an agent from auto-grading: add to `skipNames` or `botNames` in `app/api/process/route.js`
