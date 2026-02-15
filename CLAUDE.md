# Gorgias QA Ticket Grader

## Project Overview
AI-powered QA ticket grading tool for Gorgias support tickets. Deployed as a Vercel app that also embeds inside the Gorgias sidebar widget.

- **Production URL**: https://gorgias-qa.vercel.app/
- **GitHub**: `kmagallano-arch/gorgias-qa` (branch: main, auto-deploys disabled — use `vercel --prod --yes` from this directory)
- **Vercel Project**: `gorgias-qa` (team: seth-cs)

## Stack
- Next.js 14 (App Router)
- Supabase (database + Google OAuth)
- `@supabase/supabase-js` client-side
- All UI is inline CSS in a single `app/page.js` — no component library, no Tailwind
- Vercel cron: `/api/process` runs every 5 minutes for auto-grading queue

## Architecture
- **Single-page app**: Everything is in `app/page.js` (~396 lines, dense)
- **Theme object `T`**: Centralized color palette at top of component. Light corporate theme (#F0F0F0 bg, #FFFFFF cards, #2D2D2D sidebar, #C8D200 chartreuse accent)
- **Collapsible sidebar**: Navigation (Grade, History, Queue, Analytics, Coaching, Disputes). State: `sidebarOpen`
- **Inline styles everywhere**: Style objects `cardStyle`, `inputStyle`, `selectStyle`, `btnP`, `btnS`, `labelStyle` defined after theme
- **Role-based access**: `team_lead` sees all tabs; `agent` sees History + My Stats only
- **Google OAuth**: Required login via Supabase Auth. Role determined by `/api/auth/role`

## Key Files
- `app/page.js` — Entire frontend (UI, state, Supabase queries, all tabs)
- `app/globals.css` — Base styles (light gray background, scrollbar)
- `app/layout.js` — Root layout, metadata
- `app/api/auth/role/route.js` — Role lookup (admin emails hardcoded + Gorgias API team check)
- `app/api/analyze/route.js` — AI ticket analysis endpoint
- `app/api/ticket/route.js` — Fetch ticket from Gorgias API
- `app/api/process/route.js` — Auto-grade queue processor (cron)
- `app/api/internal-note/route.js` — Post internal notes to Gorgias tickets
- `app/api/webhook/route.js` — Gorgias webhook handler
- `next.config.js` — CORS headers for Gorgias iframe embedding
- `vercel.json` — Cron schedule

## Database (Supabase)
Tables:
- `evaluations` — All grading results (scores, grades, feedback, suggested responses)
- `disputes` — Agent-submitted disputes on evaluations
- `coaching_sessions` — Coaching completion records
- `grading_queue` — Auto-grade queue items

## Scoring System
```
Final = SoftSkills(20%) + IssueUnderstanding(30%) + ProductProcess(30%) + ToolsUtilization(20%)
Each subcriteria scored 1-5. Passing rate: >= 80%
Grades: A+(95+), A(90+), B+(85+), B(80+), C+(75+), C(70+), D(60+), F(<60)
Zero-tolerance violation -> automatic F (0%)
```

## Excluded Agents
The `excludedAgents` array in `page.js` filters out inactive/non-agent users from all views:
```
['Che', 'Donna S', 'Vanessa', 'Ric', 'Julie', 'Arche (old)', 'Jayson']
```
Uses partial case-insensitive matching. To add more, append to this array.

## Admin Emails
Hardcoded in `app/api/auth/role/route.js` (`ADMIN_EMAILS` array). These users get `team_lead` role regardless of Gorgias team membership.

## Environment Variables (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GORGIAS_DOMAIN` (default: osmozone.gorgias.com)
- `GORGIAS_API_KEY`
- `GORGIAS_EMAIL`
- `ANTHROPIC_API_KEY` — Claude API key for /api/analyze

## Deployment
```bash
cd /Users/karenmagallano/Downloads/gorgias-qa-repo
npx next build
vercel --prod --yes
```
The Vercel project is linked via `.vercel/` directory. GitHub auto-deploy is connected but CLI deploys override production.

## Important Patterns
- Analytics average score **excludes** zero-tolerance violations (score=0) to avoid skewing
- `finalScore` defaults to `0` via `parseFloat(r.final_score)||0` to prevent NaN
- All `rgba(255,255,255,...)` in sidebar are intentional (dark bg); content area uses `rgba(0,0,0,...)`
- Modals use `background:'rgba(0,0,0,0.4)'` overlay without backdrop blur
- The `sc()` function maps scores to colors; `gr()` maps scores to letter grades
- Bot/skip detection in `process/route.js` (`botNames` and `skipNames` arrays)
- Escalation agents: JB, Arche, Princess, Cess, Analie, Randel, Ardylyn
- `suggestedResponse` stored inside `scores` JSONB (no separate DB column)
- The Gorgias sidebar widget (`/api/gorgias`) must remain unauthenticated (JSON API)
- To add a team lead: add email to `ADMIN_EMAILS` + `adminNames` in `app/api/auth/role/route.js`
