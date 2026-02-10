import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function handleRequest(ticketId) {
  const response = {
    ticket_id: ticketId,
    evaluate_url: `https://gorgias-qa.vercel.app?ticket_id=${ticketId}`,
    dashboard_url: 'https://gorgias-qa.vercel.app',
    status: 'not_graded',
    agents: []
  };

  if (supabase && ticketId) {
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select('agent_name, final_score, grade')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: false });

      if (!error && data && data.length > 0) {
        response.status = 'graded';

        // Group by agent, keep latest evaluation per agent
        const agentMap = {};
        data.forEach(e => {
          const name = e.agent_name || 'Unknown';
          if (!agentMap[name]) {
            agentMap[name] = {
              name,
              score: parseFloat(e.final_score).toFixed(1) + '%',
              grade: e.grade || 'N/A'
            };
          }
        });

        response.agents = Object.values(agentMap);
      }
    } catch (e) {
      console.error('Supabase error:', e);
    }
  }

  return response;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');
  const response = await handleRequest(ticketId);
  return Response.json(response, { headers: corsHeaders });
}

export async function POST(request) {
  let ticketId = null;

  try {
    const body = await request.json();
    ticketId = body?.ticket?.id || body?.ticket_id || null;
  } catch (e) {
    // If body parsing fails, try query params as fallback
  }

  if (!ticketId) {
    const { searchParams } = new URL(request.url);
    ticketId = searchParams.get('ticket_id');
  }

  if (ticketId) ticketId = String(ticketId);

  const response = await handleRequest(ticketId);
  return Response.json(response, { headers: corsHeaders });
}

export async function OPTIONS(request) {
  return new Response(null, { headers: corsHeaders });
}
