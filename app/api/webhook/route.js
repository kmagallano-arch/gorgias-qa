import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(request) {
  try {
    const body = await request.json();
    
    console.log('Webhook received:', JSON.stringify(body).substring(0, 500));
    
    // Gorgias sends different event formats
    // Check for ticket status change to closed
    const ticket = body.ticket || body;
    const ticketId = ticket.id?.toString();
    const status = ticket.status;
    const eventType = body.event || body.type;
    
    console.log('Parsed webhook:', { ticketId, status, eventType });
    
    // Only process if ticket is closed
    if (status !== 'closed') {
      return Response.json({ message: 'Not a closed ticket, skipping', status }, { status: 200 });
    }
    
    if (!ticketId) {
      return Response.json({ error: 'No ticket ID found' }, { status: 400 });
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
    
    // Add to queue with 24-hour delay
    const processAt = new Date();
    processAt.setHours(processAt.getHours() + 24);
    
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
    
    return Response.json({ 
      message: 'Ticket queued for auto-grading in 24 hours',
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
    timestamp: new Date().toISOString()
  }, { status: 200 });
}
