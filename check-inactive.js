const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const activeNames = ['Kirl','Juver','Edlyn','Eduard','Gercel','Noralyn','Juvelyn','Reynand','Angelo F.','Carl','Arche','Jeofrey','Angelo','Tweny','Hank','Jean','Jayson','Joylyn','Carlo','Christian','Ran','Anja','Princess','Melo','Ara','Aiza','Analie','Ardylyn','Jade','Mark','Flor','Marie','JB','Mike','Macky','Janine','Patrick','Julie Ann','Nicole','Norbelyn','Anna','Courtney','Miguel','Nea','Anj','Ljay','George','Randel','Alden','Donna','Vanessa','Jen','Karen','Jamaica','Victor Hansen'];

async function run() {
  const { data } = await supabase.from('evaluations').select('agent_name');
  const counts = {};
  (data || []).forEach(r => { counts[r.agent_name] = (counts[r.agent_name] || 0) + 1; });

  const inactive = [];
  Object.entries(counts).forEach(([name, count]) => {
    const match = activeNames.some(a => a.toLowerCase() === name.toLowerCase());
    if (match === false) inactive.push({ name, count });
  });

  console.log('INACTIVE agents with evaluations (to delete):');
  inactive.sort((a, b) => b.count - a.count);
  let total = 0;
  inactive.forEach(({ name, count }) => { console.log('  ' + count + 'x  ' + name); total += count; });
  console.log('\nTotal evaluations to delete:', total);
}
run();
