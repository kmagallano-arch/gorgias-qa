import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const GORGIAS_DOMAIN = process.env.GORGIAS_DOMAIN || 'osmozone.gorgias.com';
const GORGIAS_API_KEY = process.env.GORGIAS_API_KEY || '';
const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL || '';

const escalationAgents = ['JB', 'Arche', 'Princess', 'Cess', 'Analie', 'Randel', 'Ardylyn'];
const buzzwords = ['legal', 'lawyer', 'attorney', 'lawsuit', 'sue', 'court', 'chargeback', 'dispute charge', 'consumer affairs', 'consumer protection', 'ftc', 'federal trade', 'bbb', 'better business bureau', 'attorney general', 'small claims'];

async function fetchTicketFromGorgias(ticketId) {
  if (!GORGIAS_API_KEY || !GORGIAS_EMAIL) {
    console.log('Gorgias API not configured');
    return null;
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
      console.error('Failed to fetch ticket:', ticketRes.status);
      return null;
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
    
    return {
      ...ticket,
      messages
    };
  } catch (error) {
    console.error('Gorgias fetch error:', error);
    return null;
  }
}

function buildConversationText(messages) {
  return messages.map(msg => {
    const sender = msg.sender?.type === 'customer' ? 'Customer' : (msg.sender?.name || msg.sender?.email || 'Agent');
    const body = msg.body_text || msg.stripped_text || (msg.body_html ? msg.body_html.replace(/<[^>]*>/g, '') : '');
    const date = msg.created_datetime ? new Date(msg.created_datetime).toLocaleString() : '';
    return `[${date}] ${sender}:\n${body}`;
  }).join('\n\n---\n\n');
}

function extractAgents(messages) {
  const agentSet = new Set();
  messages.forEach(msg => {
    if (msg.sender?.type === 'agent' || msg.from_agent) {
      const name = msg.sender?.name || msg.sender?.email || 'Unknown Agent';
      if (name && name !== 'Unknown Agent') {
        agentSet.add(name);
      }
    }
  });
  return [...agentSet];
}

function detectBuzzwords(text) {
  const lower = text.toLowerCase();
  return buzzwords.filter(b => lower.includes(b));
}

async function analyzeWithAI(conversationText, ticketId, detectedBuzzwords, agents) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.error('Anthropic API key not configured');
    return null;
  }
  
  const prompt = `You are a QA analyst evaluating a customer support ticket. This ticket may have been handled by MULTIPLE agents.

ZERO TOLERANCE POLICY (BUZZWORDS) - Legal threats requiring IMMEDIATE escalation:
Legal/Lawyer/Attorney/Lawsuit/Sue/Court, Chargeback/Dispute charge, Consumer Affairs/FTC/BBB/Attorney General

ESCALATION TEAM: ${escalationAgents.join(', ')} - evaluate their resolution quality, not escalation compliance.

AGENTS DETECTED: ${agents.join(', ') || 'Unknown'}

TICKET CONVERSATION:
${conversationText}

Detected buzzwords: ${detectedBuzzwords.join(', ') || 'None'}

TOOLS UTILIZATION scoring:
- Gorgias Usage: How well agent uses the helpdesk platform
- Internal Notes: Quality of internal documentation
- Shopify Usage: Did agent correctly perform actions in Shopify?

Respond ONLY with valid JSON (no markdown, no code blocks):
{"ticketId":"${ticketId}","agents":[{"agentName":"Name","isEscalationAgent":false,"zeroToleranceViolation":false,"violationNotes":"","scores":{"softSkills":{"tone":{"score":1-5,"explanation":"why"},"empathy":{"score":1-5,"explanation":"why"},"professionalism":{"score":1-5,"explanation":"why"},"clarity":{"score":1-5,"explanation":"why"}},"issueUnderstanding":{"correctIdentification":{"score":1-5,"explanation":"why"},"rootCauseAnalysis":{"score":1-5,"explanation":"why"},"customerContext":{"score":1-5,"explanation":"why"},"escalationRecognition":{"score":1-5,"explanation":"why"}},"productProcess":{"policyAccuracy":{"score":1-5,"explanation":"why"},"sopAdherence":{"score":1-5,"explanation":"why"},"solutionCorrectness":{"score":1-5,"explanation":"why"},"escalationProcess":{"score":1-5,"explanation":"why"}},"toolsUtilization":{"gorgiasUsage":{"score":1-5,"explanation":"why"},"internalNotes":{"score":1-5,"explanation":"why"},"shopifyUsage":{"score":1-5,"explanation":"why"}}},"overallAnalysis":"analysis","suggestedFeedback":"coaching"}]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Anthropic API error:', data.error);
      return null;
    }

    const text = data.content?.[0]?.text || '{}';
    
    // Clean JSON response
    let cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('AI analysis error:', error);
    return null;
  }
}

function calcScore(s) {
  const values = Object.values(s).filter(v => typeof v === 'number');
  if (values.length === 0) return 0;
  return (values.reduce((a, v) => a + v, 0) / (values.length * 5)) * 100;
}

function getGrade(s) {
  return s >= 95 ? 'A+' : s >= 90 ? 'A' : s >= 85 ? 'B+' : s >= 80 ? 'B' : s >= 75 ? 'C+' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F';
}

async function createInternalNote(ticketId, agentName, finalScore, grade, feedback) {
  if (!GORGIAS_API_KEY || !GORGIAS_EMAIL) {
    console.log('Gorgias API not configured - skipping internal note');
    return false;
  }
  
  const auth = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_API_KEY}`).toString('base64');
  
  const noteBody = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Evaluated by Seth AI-QA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: ${agentName}
Score: ${finalScore.toFixed(1)}%
Grade: ${grade}

Feedback:
${feedback || 'No specific feedback provided.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This evaluation was automatically generated 24 hours after ticket closure.
View full details in the QA Dashboard.
  `.trim();
  
  try {
    const response = await fetch(`https://${GORGIAS_DOMAIN}/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: 'internal-note',
        via: 'api',
        source: {
          type: 'internal-note',
          from: { name: 'Seth AI-QA' }
        },
        body_text: noteBody,
        from_agent: true,
        receiver: null
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create internal note:', response.status, errorText);
      return false;
    }
    
    console.log('Internal note created for ticket:', ticketId);
    return true;
  } catch (error) {
    console.error('Error creating internal note:', error);
    return false;
  }
}

async function processTicket(queueItem) {
  const ticketId = queueItem.ticket_id;
  
  console.log('Processing ticket:', ticketId);
  
  // Fetch fresh ticket data from Gorgias
  const ticketData = await fetchTicketFromGorgias(ticketId);
  
  if (!ticketData || !ticketData.messages || ticketData.messages.length === 0) {
    return { success: false, error: 'No ticket data or messages found' };
  }
  
  const conversationText = buildConversationText(ticketData.messages);
  const agents = extractAgents(ticketData.messages);
  const detectedBuzzwords = detectBuzzwords(conversationText);
  
  console.log('Ticket details:', { 
    ticketId, 
    messageCount: ticketData.messages.length, 
    agents, 
    buzzwords: detectedBuzzwords 
  });
  
  if (agents.length === 0) {
    return { success: false, error: 'No agents found in ticket' };
  }
  
  // Analyze with AI
  const analysis = await analyzeWithAI(conversationText, ticketId, detectedBuzzwords, agents);
  
  if (!analysis || !analysis.agents || analysis.agents.length === 0) {
    return { success: false, error: 'AI analysis failed or returned no agents' };
  }
  
  // Save evaluations for each agent
  const savedEvaluations = [];
  
  for (const agent of analysis.agents) {
    const softSkills = {
      tone: agent.scores?.softSkills?.tone?.score || 3,
      empathy: agent.scores?.softSkills?.empathy?.score || 3,
      professionalism: agent.scores?.softSkills?.professionalism?.score || 3,
      clarity: agent.scores?.softSkills?.clarity?.score || 3
    };
    const issueUnderstanding = {
      correctIdentification: agent.scores?.issueUnderstanding?.correctIdentification?.score || 3,
      rootCauseAnalysis: agent.scores?.issueUnderstanding?.rootCauseAnalysis?.score || 3,
      customerContext: agent.scores?.issueUnderstanding?.customerContext?.score || 3,
      escalationRecognition: agent.scores?.issueUnderstanding?.escalationRecognition?.score || 3
    };
    const productProcess = {
      policyAccuracy: agent.scores?.productProcess?.policyAccuracy?.score || 3,
      sopAdherence: agent.scores?.productProcess?.sopAdherence?.score || 3,
      solutionCorrectness: agent.scores?.productProcess?.solutionCorrectness?.score || 3,
      escalationProcess: agent.scores?.productProcess?.escalationProcess?.score || 3
    };
    const toolsUtilization = {
      gorgiasUsage: agent.scores?.toolsUtilization?.gorgiasUsage?.score || 3,
      internalNotes: agent.scores?.toolsUtilization?.internalNotes?.score || 3,
      shopifyUsage: agent.scores?.toolsUtilization?.shopifyUsage?.score || 3
    };
    
    const isEscalation = agent.isEscalationAgent || escalationAgents.some(ea => 
      agent.agentName?.toLowerCase().includes(ea.toLowerCase())
    );
    
    const finalScore = agent.zeroToleranceViolation ? 0 :
      calcScore(softSkills) * 0.2 +
      calcScore(issueUnderstanding) * 0.3 +
      calcScore(productProcess) * 0.3 +
      calcScore(toolsUtilization) * 0.2;
    
    const dbRecord = {
      id: `auto-${ticketId}-${(agent.agentName || 'unknown').replace(/\s+/g, '-')}-${Date.now()}`,
      ticket_id: ticketId.toString(),
      agent_name: agent.agentName || 'Unknown',
      ticket_link: `https://${GORGIAS_DOMAIN}/app/ticket/${ticketId}`,
      evaluator_name: 'AI-Auto',
      is_escalation_agent: isEscalation,
      date: new Date().toLocaleDateString(),
      zero_tolerance_violation: agent.zeroToleranceViolation || false,
      violation_notes: agent.violationNotes || '',
      scores: {
        softSkills: {
          ...softSkills,
          explanations: {
            tone: agent.scores?.softSkills?.tone?.explanation || '',
            empathy: agent.scores?.softSkills?.empathy?.explanation || '',
            professionalism: agent.scores?.softSkills?.professionalism?.explanation || '',
            clarity: agent.scores?.softSkills?.clarity?.explanation || ''
          },
          categoryScore: calcScore(softSkills)
        },
        issueUnderstanding: {
          ...issueUnderstanding,
          explanations: {
            correctIdentification: agent.scores?.issueUnderstanding?.correctIdentification?.explanation || '',
            rootCauseAnalysis: agent.scores?.issueUnderstanding?.rootCauseAnalysis?.explanation || '',
            customerContext: agent.scores?.issueUnderstanding?.customerContext?.explanation || '',
            escalationRecognition: agent.scores?.issueUnderstanding?.escalationRecognition?.explanation || ''
          },
          categoryScore: calcScore(issueUnderstanding)
        },
        productProcess: {
          ...productProcess,
          explanations: {
            policyAccuracy: agent.scores?.productProcess?.policyAccuracy?.explanation || '',
            sopAdherence: agent.scores?.productProcess?.sopAdherence?.explanation || '',
            solutionCorrectness: agent.scores?.productProcess?.solutionCorrectness?.explanation || '',
            escalationProcess: agent.scores?.productProcess?.escalationProcess?.explanation || ''
          },
          categoryScore: calcScore(productProcess)
        },
        toolsUtilization: {
          ...toolsUtilization,
          explanations: {
            gorgiasUsage: agent.scores?.toolsUtilization?.gorgiasUsage?.explanation || '',
            internalNotes: agent.scores?.toolsUtilization?.internalNotes?.explanation || '',
            shopifyUsage: agent.scores?.toolsUtilization?.shopifyUsage?.explanation || ''
          },
          categoryScore: calcScore(toolsUtilization)
        }
      },
      final_score: finalScore,
      grade: agent.zeroToleranceViolation ? 'F' : getGrade(finalScore),
      comments: agent.suggestedFeedback || '',
      ai_reasoning: agent.overallAnalysis || '',
      detected_buzzwords: detectedBuzzwords,
      manual_mode: false,
      auto_graded: true
    };
    
    const { error } = await supabase.from('evaluations').insert([dbRecord]);
    
    if (error) {
      console.error('Save error for agent', agent.agentName, ':', error);
    } else {
      console.log('Saved evaluation for', agent.agentName, '- Score:', finalScore.toFixed(1), 'Grade:', dbRecord.grade);
      savedEvaluations.push({
        agent: agent.agentName,
        score: finalScore,
        grade: dbRecord.grade,
        feedback: agent.suggestedFeedback || ''
      });
      
      // Create internal note in Gorgias
      await createInternalNote(
        ticketId,
        agent.agentName,
        finalScore,
        dbRecord.grade,
        agent.suggestedFeedback || ''
      );
    }
  }
  
  return { 
    success: savedEvaluations.length > 0, 
    evaluations: savedEvaluations,
    agentsProcessed: savedEvaluations.length,
    agentsTotal: analysis.agents.length
  };
}

export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('Unauthorized cron request');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!supabase) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }
  
  try {
    const now = new Date().toISOString();
    
    console.log('Processing queue at:', now);
    
    // Get pending tickets that are ready to process
    const { data: queue, error: queueError } = await supabase
      .from('grading_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('process_at', now)
      .order('process_at', { ascending: true })
      .limit(10); // Process 10 at a time
    
    if (queueError) {
      console.error('Queue fetch error:', queueError);
      return Response.json({ error: 'Failed to fetch queue' }, { status: 500 });
    }
    
    if (!queue || queue.length === 0) {
      console.log('No tickets to process');
      return Response.json({ message: 'No tickets to process', processed: 0 }, { status: 200 });
    }
    
    console.log(`Found ${queue.length} tickets to process`);
    
    const results = [];
    
    for (const item of queue) {
      console.log('Processing queue item:', item.ticket_id);
      
      // Mark as processing
      await supabase
        .from('grading_queue')
        .update({ status: 'processing' })
        .eq('id', item.id);
      
      try {
        const result = await processTicket(item);
        
        // Mark as completed or failed
        await supabase
          .from('grading_queue')
          .update({ 
            status: result.success ? 'completed' : 'failed',
            result: result,
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        results.push({
          ticketId: item.ticket_id,
          ...result
        });
        
      } catch (error) {
        console.error('Process error for ticket', item.ticket_id, ':', error);
        
        await supabase
          .from('grading_queue')
          .update({ 
            status: 'failed',
            result: { error: error.message },
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        results.push({
          ticketId: item.ticket_id,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Processed ${results.length} tickets, ${successCount} successful`);
    
    return Response.json({ 
      message: `Processed ${results.length} tickets`,
      successful: successCount,
      failed: results.length - successCount,
      results 
    }, { status: 200 });
    
  } catch (error) {
    console.error('Process endpoint error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Also allow POST for manual triggers
export async function POST(request) {
  return GET(request);
}
