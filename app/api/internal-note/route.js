import { NextResponse } from 'next/server';

const GORGIAS_DOMAIN = process.env.GORGIAS_DOMAIN;
const GORGIAS_API_KEY = process.env.GORGIAS_API_KEY;
const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL;

export async function POST(request) {
  try {
    const { ticketId, agentName, finalScore, grade, feedback, evaluator } = await request.json();
    
    console.log('Creating internal note for ticket:', ticketId, 'evaluator:', evaluator);
    
    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });
    }
    
    if (!GORGIAS_API_KEY || !GORGIAS_EMAIL || !GORGIAS_DOMAIN) {
      console.error('Gorgias API not configured');
      return NextResponse.json({ error: 'Gorgias API not configured' }, { status: 400 });
    }
    
    const auth = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_API_KEY}`).toString('base64');
    
    const scoreDisplay = typeof finalScore === 'number' ? finalScore.toFixed(1) : (finalScore || 0);
    
    const noteBody = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Evaluated by ${evaluator || 'QA Team'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: ${agentName || 'Unknown'}
Score: ${scoreDisplay}%
Grade: ${grade || 'N/A'}

Feedback:
${feedback || 'No specific feedback provided.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
View full details in the QA Dashboard.`;
    
    // Gorgias requires sender with email address
    const payload = {
      channel: 'internal-note',
      body_text: noteBody,
      via: 'api',
      sender: {
        email: GORGIAS_EMAIL,
        name: evaluator || 'QA Team'
      }
    };
    
    console.log('Sending to Gorgias:', `https://${GORGIAS_DOMAIN}/api/tickets/${ticketId}/messages`);
    console.log('Payload:', JSON.stringify(payload));
    
    const response = await fetch(`https://${GORGIAS_DOMAIN}/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    console.log('Gorgias response status:', response.status);
    console.log('Gorgias response:', responseText);
    
    if (!response.ok) {
      console.error('Failed to create internal note:', response.status, responseText);
      return NextResponse.json({ 
        error: 'Failed to create internal note', 
        status: response.status,
        details: responseText 
      }, { status: response.status });
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { raw: responseText };
    }
    
    console.log('Internal note created successfully for ticket:', ticketId);
    
    return NextResponse.json({ success: true, messageId: data.id, data });
  } catch (error) {
    console.error('Internal note error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
