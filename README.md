# Ticket Grader - Gorgias Integration

AI-powered ticket grading with **automatic evaluation 24 hours after ticket closure**.

## Features

- 🤖 AI-powered ticket analysis using Claude
- ⏰ **Auto-grade tickets 24 hours after closing**
- 📊 4 scoring categories (Soft Skills 20%, Issue Understanding 30%, Product & Process 30%, Tools 20%)
- 🚨 Zero tolerance buzzword detection
- 👥 Multi-agent support
- 📈 Analytics dashboard with filters and trends
- 📧 Send evaluations to agents via email
- 📥 Export to CSV

## Setup

### 1. Create Supabase Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Grading queue table
CREATE TABLE IF NOT EXISTS grading_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  ticket_data JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  process_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  result JSONB
);

CREATE INDEX idx_grading_queue_status ON grading_queue(status);
CREATE INDEX idx_grading_queue_process_at ON grading_queue(process_at);

-- Add auto_graded column to evaluations if not exists
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS auto_graded BOOLEAN DEFAULT FALSE;

-- Disable RLS for both tables
ALTER TABLE evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE grading_queue DISABLE ROW LEVEL SECURITY;
```

### 2. Deploy to Vercel

1. Push this code to GitHub
2. Import to Vercel
3. Add environment variables (see below)
4. Deploy

### 3. Environment Variables (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `GORGIAS_DOMAIN` | Your Gorgias subdomain | `osmozone.gorgias.com` |
| `GORGIAS_EMAIL` | Gorgias login email | `your@email.com` |
| `GORGIAS_API_KEY` | Gorgias REST API key | `abc123...` |
| `CRON_SECRET` | (Optional) Secure cron endpoint | `random-string` |

**To get Gorgias API credentials:**
1. Go to Gorgias → Settings → REST API
2. Copy your email and API key

### 4. Set Up Gorgias Webhook (Auto-Grading)

This webhook triggers when a ticket is closed, queuing it for auto-grading in 24 hours.

1. Go to **Gorgias → Settings → REST API → HTTP Integrations**
2. Click **Add HTTP Integration**
3. Configure:
   - **Name:** `Auto Grader Webhook`
   - **URL:** `https://YOUR-APP.vercel.app/api/webhook`
   - **Method:** POST
   - **Triggers:** ✅ Ticket status changed
4. Save

### 5. Create Gorgias Widget (Manual Grading)

1. Open any ticket in Gorgias
2. Click the ⚙️ cog icon in the sidebar
3. Add a **Standalone Widget**
4. Add a **Redirection Link**:
   - **Title:** `🤖 Grade Ticket`
   - **URL:** `https://YOUR-APP.vercel.app?ticket_id={{ticket.id}}`
5. Save

## How Auto-Grading Works

```
1. Ticket Closed in Gorgias
        ↓
2. Webhook fires → POST /api/webhook
        ↓
3. Ticket added to grading_queue (24hr delay)
        ↓
4. Cron runs daily at 9 AM UTC → GET /api/process
        ↓
5. For each ready ticket:
   - Fetch conversation from Gorgias API
   - Analyze with Claude AI
   - Save evaluation to Supabase
        ↓
6. Evaluation appears in Analytics (evaluator: "AI-Auto")
```

## Testing

### Test Webhook
```bash
curl -X POST https://YOUR-APP.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"ticket": {"id": "12345", "status": "closed"}}'
```

### Test Process (Manual Trigger)
Visit: `https://YOUR-APP.vercel.app/api/process`

This will process any tickets in the queue that are ready (past their 24hr delay).

### Check Queue Status
```sql
SELECT * FROM grading_queue ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Tickets not being queued
- Check Gorgias webhook URL is correct
- Verify webhook trigger is set to "Ticket status changed"
- Check Vercel function logs for errors

### Tickets not being processed
- Verify Gorgias API credentials are correct in Vercel
- Check if tickets are in `grading_queue` with `status = 'pending'`
- Make sure `process_at` time has passed
- Check Vercel function logs

### Evaluations not saving
- Verify Supabase credentials
- Check RLS is disabled on `evaluations` table
- Look for errors in Vercel logs

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook` | POST | Receives ticket closed events from Gorgias |
| `/api/process` | GET/POST | Processes queued tickets (called by cron) |
| `/api/ticket` | GET | Fetches ticket data from Gorgias |
| `/api/analyze` | POST | Analyzes ticket with AI |
| `/api/gorgias` | GET | Returns ticket status for Gorgias widget |

## Cron Schedule

The cron job runs **once daily at 9 AM UTC** (Vercel free tier limitation).

To change the schedule, edit `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/process",
      "schedule": "0 9 * * *"
    }
  ]
}
```
