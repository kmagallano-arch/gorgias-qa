// File: src/app/api/gorgias-webhook/route.js
// Receives webhooks from Gorgias when tickets are closed and adds them to the grading queue

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Set to 0 for immediate processing, or 1-24 for hours delay
const GRADING_DELAY_HOURS = 24;

export async function POST(request) {
  try {
    const body = await request.json();
    
    console.log('Webhook received:', JSON.stringify(body).substring(0, 500));
    
    // Gorgias HTTP integration sends {"ticket_id": "123456"}
    // Extract ticket ID from various possible formats
    const ticketId = body.ticket_id?.toString() || body.ticket?.id?.toString() || body.id?.toString();
    
    console.log('Parsed webhook: ticketId=', ticketId);
    
    if (!ticketId) {
      console.log('No ticket ID found in payload');
      return Response.json({ error: 'No ticket ID found', received: body }, { status: 400 });
    }
    
    // Fetch ticket data from Gorgias to check status
    const GORGIAS_DOMAIN = process.env.GORGIAS_DOMAIN;
    const GORGIAS_API_KEY = process.env.GORGIAS_API_KEY;
    const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL;
    
    if (!GORGIAS_DOMAIN || !GORGIAS_API_KEY || !GORGIAS_EMAIL) {
      console.log('Gorgias API not configured, queuing ticket anyway');
    }
    
    let status = 'closed';
    let ticket = { id: ticketId };
    
    if (GORGIAS_DOMAIN && GORGIAS_API_KEY && GORGIAS_EMAIL) {
      try {
        const auth = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_API_KEY}`).toString('base64');
        const ticketRes = await fetch(`https://${GORGIAS_DOMAIN}/api/tickets/${ticketId}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        if (ticketRes.ok) {
          ticket = await ticketRes.json();
          status = ticket.status;
          console.log('Fetched ticket status:', status);
        }
      } catch (fetchErr) {
        console.log('Could not fetch ticket, using default status:', fetchErr.message);
      }
    }
    
    // Only process if ticket is closed
    if (status !== 'closed') {
      return Response.json({ message: 'Not a closed ticket, skipping', status }, { status: 200 });
    }
    
    if (!supabase) {
      return Response.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    // Check if already queued
    const { data: existing } = await supabase
      .from('grading_queue')
      .select('id, status')
      .eq('ticket_id', ticketId)
      .in('status', ['pending', 'processing'])
      .single();
    
    if (existing) {
      return Response.json({ message: 'Ticket already queued', ticketId }, { status: 200 });
    }
    
    // Check if already graded (within last 7 days to allow re-evaluation of old tickets)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: graded } = await supabase
      .from('evaluations')
      .select('id, timestamp')
      .eq('ticket_id', ticketId)
      .gte('timestamp', sevenDaysAgo.toISOString())
      .limit(1);
    
    if (graded && graded.length > 0) {
      return Response.json({ message: 'Ticket already graded recently', ticketId }, { status: 200 });
    }
    
    // Add to queue - immediate or with delay
    const processAt = new Date();
    if (GRADING_DELAY_HOURS > 0) {
      processAt.setHours(processAt.getHours() + GRADING_DELAY_HOURS);
    }
    
    const queueRecord = {
      ticket_id: ticketId,
      ticket_data: {
        id: ticketId,
        subject: ticket.subject,
        status: ticket.status,
        customer: ticket.customer,
        closed_datetime: ticket.closed_datetime || new Date().toISOString()
      },
      status: 'pending',
      created_at: new Date().toISOString(),
      process_at: processAt.toISOString()
    };
    
    const { error } = await supabase.from('grading_queue').insert([queueRecord]);
    
    if (error) {
      console.error('Queue insert error:', error);
      return Response.json({ error: 'Failed to queue ticket', details: error.message }, { status: 500 });
    }
    
    console.log('Ticket queued successfully:', ticketId, 'Process at:', processAt.toISOString());
    
    const delayMsg = GRADING_DELAY_HOURS > 0 
      ? `Ticket queued for auto-grading in ${GRADING_DELAY_HOURS} hour(s)`
      : 'Ticket queued for immediate auto-grading';
    
    return Response.json({ 
      message: delayMsg,
      ticketId,
      processAt: processAt.toISOString()
    }, { status: 200 });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// GET for webhook verification
export async function GET(request) {
  return Response.json({ 
    status: 'Webhook endpoint active',
    delayHours: GRADING_DELAY_HOURS,
    timestamp: new Date().toISOString()
  }, { status: 200 });
}
