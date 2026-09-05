import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkTables() {
  const tables = ['curriculum_documents', 'curriculum_topics', 'curriculum_content', 'curriculum_questions'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t}: Error / Not found ->`, error.message);
    } else {
      console.log(`Table ${t}: EXISTS! (${data.length} sample rows)`);
    }
  }
}

checkTables().catch(console.error);
