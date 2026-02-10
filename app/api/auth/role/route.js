const GORGIAS_DOMAIN = process.env.GORGIAS_DOMAIN || 'osmozone.gorgias.com';
const GORGIAS_API_KEY = process.env.GORGIAS_API_KEY || '';
const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL || '';
const TEAM_LEAD_TEAM = 'Escalations';
const ADMIN_EMAILS = ['karen@sethmedia.com', 'victor@sethmedia.com', 'ara.proctoru@gmail.com', 'jenantonio.lorezo@gmail.com', 'lorezojen0713@gmail.com', 'jamaica@sethmedia.com', 'locasiadonna23@gmail.com', 'sojormikenico1998@gmail.com', 'nicholassalva29@gmail.com'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get('email');

  if (!userEmail) {
    return Response.json({ error: 'No email provided' }, { status: 400 });
  }

  if (ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    const adminNames = { 'karen@sethmedia.com': 'Karen', 'victor@sethmedia.com': 'Victor Hansen', 'ara.proctoru@gmail.com': 'Ara', 'jenantonio.lorezo@gmail.com': 'Jen', 'lorezojen0713@gmail.com': 'Jen', 'jamaica@sethmedia.com': 'Jamaica', 'locasiadonna23@gmail.com': 'Donna', 'sojormikenico1998@gmail.com': 'Mike', 'nicholassalva29@gmail.com': 'Nicholas' };
    return Response.json({ role: 'team_lead', name: adminNames[userEmail.toLowerCase()] || userEmail.split('@')[0], email: userEmail });
  }

  if (!GORGIAS_API_KEY || !GORGIAS_EMAIL) {
    return Response.json({ role: 'agent', name: userEmail.split('@')[0], email: userEmail });
  }

  const auth = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_API_KEY}`).toString('base64');

  try {
    let allUsers = [];
    let cursor = null;

    for (let page = 0; page < 10; page++) {
      const url = new URL(`https://${GORGIAS_DOMAIN}/api/users`);
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
      });

      if (!res.ok) break;

      const data = await res.json();
      const users = data.data || data;
      if (!Array.isArray(users) || users.length === 0) break;
      allUsers = allUsers.concat(users);

      cursor = data.meta?.next_cursor;
      if (!cursor || users.length < 100) break;
    }

    const gorgiasUser = allUsers.find(
      u => u.email?.toLowerCase() === userEmail.toLowerCase()
    );

    if (!gorgiasUser) {
      return Response.json({ role: 'agent', name: userEmail.split('@')[0], email: userEmail });
    }

    const teams = gorgiasUser.teams || [];
    const isTeamLead = teams.some(t => t.name === TEAM_LEAD_TEAM);
    const displayName = [gorgiasUser.firstname, gorgiasUser.lastname].filter(Boolean).join(' ').trim() || gorgiasUser.email;

    return Response.json({
      role: isTeamLead ? 'team_lead' : 'agent',
      name: displayName,
      email: gorgiasUser.email,
      teams: teams.map(t => t.name)
    });
  } catch (error) {
    console.error('Role check error:', error);
    return Response.json({ role: 'agent', name: userEmail.split('@')[0], email: userEmail });
  }
}
