/**
 * Backfill script - queues ungraded closed tickets from February 2026
 *
 * Usage: node --env-file=.env.local backfill.js
 */

const { createClient } = require('@supabase/supabase-js');

const GORGIAS_DOMAIN = process.env.GORGIAS_DOMAIN || 'osmozone.gorgias.com';
const GORGIAS_API_KEY = process.env.GORGIAS_API_KEY;
const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const auth = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_API_KEY}`).toString('base64');

const FEB_START = new Date('2026-02-01T00:00:00Z');
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

async function run() {
  console.log('=== Backfill: February 2026 ungraded closed tickets ===\n');

  // Load already-graded ticket IDs
  console.log('Loading already-graded ticket IDs...');
  const gradedIds = new Set();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('evaluations')
      .select('ticket_id')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    data.forEach(r => gradedIds.add(r.ticket_id));
    offset += data.length;
    if (data.length < 1000) break;
  }
  console.log(`Already graded: ${gradedIds.size} tickets`);

  // Load already-queued ticket IDs
  const { data: queuedData } = await supabase
    .from('grading_queue')
    .select('ticket_id')
    .in('status', ['pending', 'processing']);
  const queuedIds = new Set((queuedData || []).map(r => r.ticket_id));
  console.log(`Already queued: ${queuedIds.size} tickets\n`);

  // Scan Gorgias tickets
  let cursor = null;
  let page = 0;
  let queued = 0;
  let skipped = 0;
  let totalClosed = 0;

  while (true) {
    page++;
    const url = new URL(`https://${GORGIAS_DOMAIN}/api/tickets`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('order_by', 'updated_datetime:desc');
    if (cursor) url.searchParams.set('cursor', cursor);

    if (page % 25 === 0 || page <= 3) {
      console.log(`Page ${page} | Queued so far: ${queued}`);
    }

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
    });

    if (!res.ok) { console.error('API error:', res.status); break; }

    const data = await res.json();
    const items = data.data || [];
    if (items.length === 0) break;

    // Check if we've gone past February
    const oldestUpdated = new Date(items[items.length - 1].updated_datetime);
    if (oldestUpdated < FEB_START) {
      // Process remaining Feb items in this page, then stop
      for (const t of items) {
        if (t.status !== 'closed') continue;
        const closedAt = new Date(t.closed_datetime || t.updated_datetime);
        if (closedAt < FEB_START || closedAt > twentyFourHoursAgo) continue;
        totalClosed++;
        const tid = t.id.toString();
        if (gradedIds.has(tid) || queuedIds.has(tid)) { skipped++; continue; }
        const { error } = await supabase.from('grading_queue').insert([{
          ticket_id: tid,
          ticket_data: { id: tid, subject: t.subject, status: t.status, customer: t.customer, closed_datetime: t.closed_datetime },
          status: 'pending', created_at: new Date().toISOString(), process_at: new Date().toISOString()
        }]);
        if (!error) { queued++; queuedIds.add(tid); }
      }
      console.log(`Reached pre-February tickets. Stopping.`);
      break;
    }

    for (const t of items) {
      if (t.status !== 'closed') continue;
      const closedAt = new Date(t.closed_datetime || t.updated_datetime);
      if (closedAt < FEB_START) continue;
      if (closedAt > twentyFourHoursAgo) continue;
      totalClosed++;
      const tid = t.id.toString();
      if (gradedIds.has(tid) || queuedIds.has(tid)) { skipped++; continue; }
      const { error } = await supabase.from('grading_queue').insert([{
        ticket_id: tid,
        ticket_data: { id: tid, subject: t.subject, status: t.status, customer: t.customer, closed_datetime: t.closed_datetime },
        status: 'pending', created_at: new Date().toISOString(), process_at: new Date().toISOString()
      }]);
      if (!error) { queued++; queuedIds.add(tid); }
    }

    cursor = data.meta?.next_cursor;
    if (!cursor) break;
  }

  console.log(`\n=== Done ===`);
  console.log(`February closed tickets found: ${totalClosed}`);
  console.log(`Newly queued: ${queued}`);
  console.log(`Skipped (already graded/queued): ${skipped}`);
  if (queued > 0) {
    console.log(`\nCron processes 10 every 5 min. ETA: ~${Math.ceil(queued / 10) * 5} minutes`);
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
