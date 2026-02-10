import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  // Check if env vars exist
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({
      error: 'Missing environment variables',
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
      keyPrefix: supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING'
    }, { status: 500 });
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try a simple query
    const { data, error } = await supabase
      .from('evaluations')
      .select('id')
      .limit(1);
    
    if (error) {
      return Response.json({
        error: 'Supabase query failed',
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        urlPrefix: supabaseUrl.substring(0, 30) + '...',
        keyPrefix: supabaseKey.substring(0, 20) + '...'
      }, { status: 500 });
    }
    
    return Response.json({
      success: true,
      message: 'Supabase connection working',
      recordsFound: data?.length || 0,
      urlPrefix: supabaseUrl.substring(0, 30) + '...',
      keyPrefix: supabaseKey.substring(0, 20) + '...'
    });
    
  } catch (e) {
    return Response.json({
      error: 'Connection error',
      message: e.message
    }, { status: 500 });
  }
}
