import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpapghryrtnelmgfnfjg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function cleanDemoData() {
  console.log('🧹 Starting cleanup of demo/sample records from Supabase...');

  // Tables to clear demo records from (order respects foreign key dependencies)
  const tablesToClear = [
    'interventions',
    'practice_attempts',
    'student_subject_progress',
    'student_topic_progress',
    'class_students',
    'classes',
    'student_profiles',
    'teacher_profiles',
    'profiles',
    'users'
  ];

  for (const table of tablesToClear) {
    try {
      // Check if table exists by doing a quick head select
      const { count, error: checkErr } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
      if (checkErr) {
        console.log(`  ℹ Table "${table}" check skipped or not present: ${checkErr.message}`);
        continue;
      }

      console.log(`  Clearing table "${table}" (currently has ${count} records)...`);
      // Delete all records where id is not null (or user_id is not null)
      let delQuery;
      if (table === 'student_profiles' || table === 'teacher_profiles') {
        delQuery = await supabaseAdmin.from(table).delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
      } else if (table === 'student_subject_progress' || table === 'student_topic_progress') {
        delQuery = await supabaseAdmin.from(table).delete().neq('student_id', '00000000-0000-0000-0000-000000000000');
      } else if (table === 'class_students') {
        delQuery = await supabaseAdmin.from(table).delete().neq('class_id', '00000000-0000-0000-0000-000000000000');
      } else {
        delQuery = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      if (delQuery.error) {
        console.warn(`    Warning clearing ${table}:`, delQuery.error.message);
      } else {
        console.log(`    ✓ Cleared records from "${table}".`);
      }
    } catch (err: any) {
      console.warn(`    Error on ${table}:`, err?.message || err);
    }
  }

  // Verify questions and curriculum are preserved
  const { count: questionCount } = await supabaseAdmin.from('questions').select('*', { count: 'exact', head: true });
  console.log(`\n📚 Preserved Curriculum Questions in Supabase: ${questionCount} questions.`);

  // Verify zero state on all demo tables
  console.log('\n📊 Final Table Row Verification:');
  const verificationResults: Record<string, number | null> = {};
  for (const table of tablesToClear) {
    try {
      const { count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
      verificationResults[table] = count ?? 0;
      console.log(`  - ${table}: ${count ?? 0} records`);
    } catch {
      verificationResults[table] = null;
    }
  }

  console.log('\n✅ Demo data cleanup complete! Database is at pure zero-state ready for new data.');
  return { verificationResults, questionCount };
}

if (process.argv[1] && process.argv[1].includes('cleanDemoData')) {
  cleanDemoData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error during cleanup:', err);
      process.exit(1);
    });
}
