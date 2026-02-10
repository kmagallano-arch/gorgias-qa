const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const inactiveNames = [
  'Gorgias Bot', 'Marlon', 'Steven', 'Karylle', 'Vincent',
  'Patrick (Agent)', 'Aaron', 'Ella', 'Charlie', 'Chifemay',
  'Princess/Cess', 'Che', 'Kaye Bahi-an', 'Princess (signed as Cess)',
  'Princess (final resolution, signed as Cess)', 'Jezelle', 'Kent',
  'Dustin', 'Hilary', 'No Agent Found', 'Lynx'
];

async function run() {
  console.log('=== Deleting evaluations for inactive agents ===\n');

  let totalDeleted = 0;
  for (const name of inactiveNames) {
    const { data, error } = await supabase
      .from('evaluations')
      .delete()
      .eq('agent_name', name)
      .select('id');

    const count = data ? data.length : 0;
    if (count > 0) {
      console.log('  Deleted ' + count + 'x  ' + name);
      totalDeleted += count;
    }
  }

  console.log('\nTotal evaluations deleted: ' + totalDeleted);
}
run();
