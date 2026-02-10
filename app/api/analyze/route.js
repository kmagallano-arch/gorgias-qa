export async function POST(request) {
  const body = await request.json();
  const { prompt, content, hasImages } = body;

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    let messageContent;
    
    if (content && Array.isArray(content) && content.length > 0) {
      messageContent = content;
    } else if (prompt) {
      messageContent = prompt;
    } else {
      return Response.json({ error: 'No prompt or content provided' }, { status: 400 });
    }

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
        messages: [{ role: 'user', content: messageContent }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return Response.json({ error: data.error.message }, { status: 400 });
    }

    const text = data.content?.[0]?.text || '{}';
    let cleanJson = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    
    try {
      const parsed = JSON.parse(cleanJson);
      return Response.json(parsed);
    } catch (parseError) {
      return Response.json({ error: 'Failed to parse AI response', rawResponse: text.substring(0, 500) }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
