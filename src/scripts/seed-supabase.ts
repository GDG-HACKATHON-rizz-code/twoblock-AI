import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpapghryrtnelmgfnfjg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwYXBnaHJ5cnRuZWxtZ2ZuZmpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODUzNTQwOSwiZXhwIjoyMTA0MTExNDA5fQ.-V6JjnsOo8isMis5VRKEfE6giHf31miycNCGMPvYsuU';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('🚀 Starting 2Block Ai Supabase Seed...');

  // 1. Load Demo Data files
  const studentDataPath = path.resolve(process.cwd(), 'student-demo-data.json');
  const teacherDataPath = path.resolve(process.cwd(), 'teacher-demo-data.json');

  const studentDemo = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
  const teacherDemo = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));

  console.log('✓ Loaded student-demo-data.json and teacher-demo-data.json');

  // 2. Ensure Auth Users exist
  async function ensureUser(email: string, pass: string, role: string, name: string) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const existing = listData?.users?.find(u => u.email === email);
    if (existing) {
      console.log(`✓ User ${email} already exists (${existing.id})`);
      return existing.id;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: name, role },
      app_metadata: { role }
    });

    if (error) {
      console.error(`Failed to create ${email}:`, error.message);
      throw error;
    }
    console.log(`✓ Created auth user ${email} (${data.user.id})`);
    return data.user.id;
  }

  const amiraUserId = await ensureUser('amira@twoblock.ai', 'password123', 'student', 'Amira M.');
  const liyanaUserId = await ensureUser('liyana@twoblock.ai', 'password123', 'teacher', 'Liyana K.');

  // 3. Upsert Users/Profiles in database
  console.log('✓ Seeding Users and Profiles...');
  try {
    await supabaseAdmin.from('users').upsert([
      { id: amiraUserId, email: 'amira@twoblock.ai', password_hash: 'managed_by_supabase_auth', role: 'student' },
      { id: liyanaUserId, email: 'liyana@twoblock.ai', password_hash: 'managed_by_supabase_auth', role: 'teacher' }
    ]);
  } catch (err) {
    console.warn('Note on users table:', err);
  }

  try {
    await supabaseAdmin.from('profiles').upsert([
      { id: amiraUserId, full_name: 'Amira M.', role: 'student' },
      { id: liyanaUserId, full_name: 'Liyana K.', role: 'teacher' }
    ]);
  } catch (err) {
    // profiles table might wait for schema.sql
  }

  // 4. Student Profile
  console.log('✓ Seeding Student Profile...');
  try {
    await supabaseAdmin.from('student_profiles').upsert({
      user_id: amiraUserId,
      full_name: studentDemo.student.name,
      grade_level: '1',
      preferred_language: 'ms',
      learning_preferences: {
        district: studentDemo.student.district,
        dateOfBirth: studentDemo.student.dateOfBirth,
        learningLanguages: studentDemo.student.learningLanguages,
        favouriteSubject: studentDemo.student.favouriteSubject,
        preferredStudyTime: studentDemo.student.preferredStudyTime,
        school: studentDemo.student.school
      },
      onboarding_completed: true
    });
  } catch (err) {
    console.warn('Note on student_profiles:', err);
  }

  // 5. Teacher Profile
  console.log('✓ Seeding Teacher Profile...');
  try {
    await supabaseAdmin.from('teacher_profiles').upsert({
      user_id: liyanaUserId,
      full_name: teacherDemo.teacher.name,
      school_name: teacherDemo.teacher.school
    });
  } catch (err) {
    console.warn('Note on teacher_profiles:', err);
  }

  // 6. Subjects & Topics
  console.log('✓ Seeding Curriculum Subjects & Topics...');
  for (const s of studentDemo.subjects) {
    let subjectId = '';
    const { data: subData } = await supabaseAdmin.from('subjects').select('id').eq('name', s.name).maybeSingle();
    if (subData) {
      subjectId = subData.id;
    } else {
      const { data: createdSub } = await supabaseAdmin.from('subjects').insert({
        name: s.name,
        display_order: s.id === 'mathematics' ? 1 : s.id === 'bahasa-melayu' ? 2 : s.id === 'english' ? 3 : 4
      }).select().single();
      if (createdSub) subjectId = createdSub.id;
    }

    if (subjectId && s.topics) {
      for (const t of s.topics) {
        const { data: topData } = await supabaseAdmin.from('topics').select('id').eq('name', t.name).maybeSingle();
        if (!topData) {
          await supabaseAdmin.from('topics').insert({
            subject_id: subjectId,
            name: t.name,
            display_order: 1
          });
        }
      }
    }
  }

  // 7. Classes
  console.log('✓ Seeding Teacher Classes...');
  for (const c of teacherDemo.teacher.classes) {
    const { data: existingClass } = await supabaseAdmin.from('classes').select('id').eq('class_name', c.name).maybeSingle();
    if (!existingClass) {
      await supabaseAdmin.from('classes').insert({
        teacher_id: liyanaUserId,
        class_name: c.name,
        grade_level: 'Year 10'
      });
    }
  }

  // 8. Practice Questions
  console.log('✓ Seeding Practice Questions...');
  const sampleQuestions = [
    { question_text: '4 + 5 = ?', correct_answer: '9', options: ['7', '8', '9', '10'], explanation: '4 + 5 = 9', difficulty_level: 1 },
    { question_text: '6 + 7 = ?', correct_answer: '13', options: ['11', '12', '13', '14'], explanation: '6 + 7 = 13', difficulty_level: 1 },
    { question_text: '12 - 4 = ?', correct_answer: '8', options: ['6', '7', '8', '9'], explanation: '12 - 4 = 8', difficulty_level: 1 },
    { question_text: '15 - 9 = ?', correct_answer: '6', options: ['5', '6', '7', '8'], explanation: '15 - 9 = 6', difficulty_level: 1 },
    { question_text: '8 + 8 = ?', correct_answer: '16', options: ['14', '15', '16', '18'], explanation: '8 + 8 = 16', difficulty_level: 1 },
    { question_text: '14 - 6 = ?', correct_answer: '8', options: ['7', '8', '9', '10'], explanation: '14 - 6 = 8', difficulty_level: 1 }
  ];

  const { data: mathSub } = await supabaseAdmin.from('subjects').select('id').eq('name', 'Mathematics').maybeSingle();
  if (mathSub) {
    const { data: addTopic } = await supabaseAdmin.from('topics').select('id').eq('name', 'Addition').maybeSingle();
    for (const q of sampleQuestions) {
      const { data: existingQ } = await supabaseAdmin.from('questions').select('id').eq('question_text', q.question_text).maybeSingle();
      if (!existingQ) {
        await supabaseAdmin.from('questions').insert({
          subject_id: mathSub.id,
          topic_id: addTopic?.id || null,
          difficulty_level: q.difficulty_level,
          question_text: q.question_text,
          question_type: 'mcq',
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          language: 'ms',
          is_diagnostic: false,
          grade_level: '1',
          is_active: true
        });
      }
    }
  }

  // 9. Teacher Interventions
  console.log('✓ Seeding Teacher Interventions...');
  for (const inv of teacherDemo.interventions) {
    const { data: existingInv } = await supabaseAdmin.from('teacher_interventions').select('id').eq('intervention_type', inv.classification).maybeSingle();
    if (!existingInv) {
      await supabaseAdmin.from('teacher_interventions').insert({
        teacher_id: liyanaUserId,
        student_id: amiraUserId,
        intervention_type: inv.classification,
        status: inv.status,
        notes: `${inv.subject} · ${inv.topic}: ${inv.recommendation}`
      });
    }
  }

  console.log('\n🎉 Supabase database seeding complete!');
  console.log('----------------------------------------------------');
  console.log('Student Login: amira@twoblock.ai  / password123');
  console.log('Teacher Login: liyana@twoblock.ai / password123');
  console.log('----------------------------------------------------');
}

main().catch(e => {
  console.error('❌ Seed error:', e);
  process.exit(1);
});
