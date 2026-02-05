import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');
  
  const response = {
    ticket_id: ticketId,
    grader_url: `https://gorgias-qa.vercel.app?ticket_id=${ticketId}`,
    status: 'not_graded',
    summary: 'No evaluation found',
    evaluations: []
  };
  
  if (supabase && ticketId) {
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: false });
      
      if (!error && data && data.length > 0) {
        response.status = 'graded';
        response.summary = `${data.length} evaluation(s) found`;
        
        response.evaluations = data.map(e => {
          const score = parseFloat(e.final_score);
          const ss = e.scores?.softSkills?.categoryScore;
          const iu = e.scores?.issueUnderstanding?.categoryScore;
          const pp = e.scores?.productProcess?.categoryScore;
          const tu = e.scores?.toolsUtilization?.categoryScore;
          
          return {
            agent: e.agent_name || 'Unknown',
            score: score.toFixed(1) + '%',
            grade: e.grade || 'N/A',
            evaluator: e.evaluator_name || 'Unknown',
            date: e.date || '',
            auto_graded: e.auto_graded ? 'Auto' : 'Manual',
            soft_skills: ss ? ss.toFixed(0) + '%' : 'N/A',
            issue_understanding: iu ? iu.toFixed(0) + '%' : 'N/A',
            product_process: pp ? pp.toFixed(0) + '%' : 'N/A',
            tools_utilization: tu ? tu.toFixed(0) + '%' : 'N/A',
            feedback: e.comments || 'No feedback provided',
            violation: e.zero_tolerance_violation ? '⚠️ Yes' : 'None'
          };
        });
        
        // Top-level fields for quick display
        const latest = data[0];
        const latestScore = parseFloat(latest.final_score);
        response.latest_agent = latest.agent_name || 'Unknown';
        response.latest_score = latestScore.toFixed(1) + '%';
        response.latest_grade = latest.grade || 'N/A';
        response.latest_evaluator = latest.evaluator_name || 'Unknown';
        response.latest_date = latest.date || '';
        response.latest_feedback = latest.comments || 'No feedback provided';
        response.latest_auto = latest.auto_graded ? 'Auto' : 'Manual';
        response.latest_violation = latest.zero_tolerance_violation ? '⚠️ Yes' : 'None';
        
        const ss = latest.scores?.softSkills?.categoryScore;
        const iu = latest.scores?.issueUnderstanding?.categoryScore;
        const pp = latest.scores?.productProcess?.categoryScore;
        const tu = latest.scores?.toolsUtilization?.categoryScore;
        response.latest_soft_skills = ss ? ss.toFixed(0) + '%' : 'N/A';
        response.latest_issue_understanding = iu ? iu.toFixed(0) + '%' : 'N/A';
        response.latest_product_process = pp ? pp.toFixed(0) + '%' : 'N/A';
        response.latest_tools_utilization = tu ? tu.toFixed(0) + '%' : 'N/A';
      }
    } catch (e) {
      console.error('Supabase error:', e);
    }
  }
  
  return Response.json(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function OPTIONS(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
