import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, serviceKey);

async function testSql() {
  // Test if an rpc exists
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    console.log('rpc exec_sql:', { data, error });
  } catch (e) {
    console.log('rpc exec_sql error:', e);
  }

  // Check what tables are currently accessible via REST API
  const known = ['profiles', 'student_profiles', 'subjects', 'topics', 'practice_attempts', 'student_topic_progress', 'diagnostic_attempts'];
  for (const k of known) {
    const { data, error } = await supabase.from(k).select('*').limit(1);
    if (error) {
      console.log(`Table ${k}: ${error.message}`);
    } else {
      console.log(`Table ${k}: accessible, row count: ${data.length}`);
    }
  }
}

testSql().catch(console.error);
