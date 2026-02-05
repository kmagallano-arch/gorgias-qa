export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');
  
  if (!ticketId) {
    return Response.json({ error: 'No ticket_id provided' }, { status: 400 });
  }
  
  const GORGIAS_DOMAIN = process.env.GORGIAS_DOMAIN || 'osmozone.gorgias.com';
  const GORGIAS_API_KEY = process.env.GORGIAS_API_KEY;
  const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL;
  
  if (!GORGIAS_API_KEY || !GORGIAS_EMAIL) {
    return Response.json({ 
      error: 'Gorgias API not configured',
      details: 'Add GORGIAS_EMAIL and GORGIAS_API_KEY to Vercel environment variables'
    }, { status: 500 });
  }
  
  const auth = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_API_KEY}`).toString('base64');
  
  try {
    // Fetch ticket details
    const ticketRes = await fetch(`https://${GORGIAS_DOMAIN}/api/tickets/${ticketId}`, {
      headers: { 
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ticketRes.ok) {
      const errorText = await ticketRes.text();
      console.error('Gorgias ticket fetch error:', ticketRes.status, errorText);
      return Response.json({ 
        error: 'Failed to fetch ticket from Gorgias',
        status: ticketRes.status
      }, { status: ticketRes.status });
    }
    
    const ticket = await ticketRes.json();
    
    // Fetch messages
    const messagesRes = await fetch(`https://${GORGIAS_DOMAIN}/api/tickets/${ticketId}/messages?limit=100`, {
      headers: { 
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    let messages = [];
    if (messagesRes.ok) {
      const messagesData = await messagesRes.json();
      messages = messagesData.data || [];
    }
    
    // Build conversation text
    const conversationText = messages.map(msg => {
      const sender = msg.sender?.type === 'customer' ? 'Customer' : (msg.sender?.name || msg.sender?.email || 'Agent');
      const body = msg.body_text || msg.stripped_text || (msg.body_html ? msg.body_html.replace(/<[^>]*>/g, '') : '');
      const date = msg.created_datetime ? new Date(msg.created_datetime).toLocaleString() : '';
      return `[${date}] ${sender}:\n${body}`;
    }).join('\n\n---\n\n');
    
    // Extract agents
    const agents = [...new Set(messages
      .filter(msg => msg.sender?.type === 'agent' || msg.from_agent)
      .map(msg => msg.sender?.name || msg.sender?.email || 'Unknown Agent')
    )];
    
    return Response.json({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        customer: ticket.customer,
        created_datetime: ticket.created_datetime,
        updated_datetime: ticket.updated_datetime
      },
      messages,
      conversationText,
      agents,
      messageCount: messages.length
    });
    
  } catch (error) {
    console.error('Gorgias API error:', error);
    return Response.json({ 
      error: 'Failed to connect to Gorgias',
      details: error.message 
    }, { status: 500 });
  }
}
