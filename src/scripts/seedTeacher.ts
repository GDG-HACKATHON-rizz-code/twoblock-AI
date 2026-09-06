import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { dataStore } from '../services/dataStore.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpapghryrtnelmgfnfjg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export const TEACHER_CLASS_CODES: Record<string, string> = {
  'year10-amanah': 'AMANAH10',
  'year10-bestari': 'BESTARI10',
  'year10-cemerlang': 'CEMERLANG10'
};

export async function seedTeacherOnly() {
  console.log('🧑‍🏫 Seeding Teacher Account information from teacher-demo-data.json ONLY...');

  // 1. Load teacher data
  const teacherDataPath = path.resolve(process.cwd(), 'teacher-demo-data.json');
  const teacherDemo = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
  const t = teacherDemo.teacher;

  console.log(`  Teacher: ${t.name} (${t.teacherId}) - ${t.school}`);

  // 2. Ensure Teacher Auth User exists in Supabase Auth
  const email = 'teacher@twoblock.ai';
  const password = 'password123';
  let teacherUserId = '';

  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const existing = listData?.users?.find(u => u.email === email || u.email === 'liyana@twoblock.ai');

  if (existing) {
    teacherUserId = existing.id;
    console.log(`  ✓ Teacher auth user already exists: ${existing.email} (${teacherUserId})`);
  } else {
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: t.name, role: 'teacher' },
      app_metadata: { role: 'teacher' }
    });
    if (createErr || !newUser?.user) {
      throw new Error(`Failed to create teacher auth user: ${createErr?.message}`);
    }
    teacherUserId = newUser.user.id;
    console.log(`  ✓ Created teacher auth user: ${email} (${teacherUserId})`);
  }

  // 3. Upsert user in public.users if table exists
  try {
    await supabaseAdmin.from('users').upsert({
      id: teacherUserId,
      email,
      password_hash: 'managed_by_supabase_auth',
      role: 'teacher'
    });
  } catch (err: any) {
    console.warn('  Note on users table:', err?.message || err);
  }

  // 4. Upsert in public.teacher_profiles
  try {
    const { error: tpErr } = await supabaseAdmin.from('teacher_profiles').upsert({
      user_id: teacherUserId,
      full_name: t.name,
      school_name: t.school
    });
    if (tpErr) {
      console.warn('  Note on teacher_profiles upsert:', tpErr.message);
    } else {
      console.log('  ✓ Upserted teacher profile in Supabase teacher_profiles');
    }
  } catch (err: any) {
    console.warn('  Note on teacher_profiles:', err?.message || err);
  }

  // 5. Upsert Teacher Classes in Supabase (with 0 students enrolled)
  const seededClasses: any[] = [];
  for (const c of t.classes) {
    const classCode = TEACHER_CLASS_CODES[c.id] || `${c.name.replace(/\s+/g, '').toUpperCase()}`;
    const classNameWithCode = `${c.name} (${classCode})`;

    const { data: existingClass } = await supabaseAdmin
      .from('classes')
      .select('id, class_name')
      .or(`class_name.eq.${c.name},class_name.eq.${classNameWithCode}`)
      .maybeSingle();

    let classId = existingClass?.id;
    if (!classId) {
      const { data: insertedClass, error: classErr } = await supabaseAdmin
        .from('classes')
        .insert({
          teacher_id: teacherUserId,
          class_name: classNameWithCode,
          grade_level: t.teachingLevel || 'Year 10'
        })
        .select()
        .single();

      if (!classErr && insertedClass) {
        classId = insertedClass.id;
      }
    }

    seededClasses.push({
      id: classId || c.id,
      code: classCode,
      name: c.name,
      displayName: classNameWithCode,
      teacherId: teacherUserId,
      yearLevel: t.teachingLevel || 'Year 10',
      subject: c.subject || t.primarySubject || 'Mathematics',
      studentCount: 0 // Real count starts at 0!
    });
  }

  console.log(`  ✓ Seeded ${seededClasses.length} teacher classes (Year 10 Amanah, Bestari, Cemerlang)`);

  // 6. Update local dataStore for in-memory and local fallback
  dataStore.data.teacherProfiles['current-teacher'] = {
    userId: teacherUserId,
    name: t.name,
    initials: t.initials,
    teacherId: t.teacherId,
    school: t.school,
    district: t.district,
    primarySubject: t.primarySubject,
    teachingLevel: t.teachingLevel
  };

  dataStore.data.classes = seededClasses.map(sc => ({
    id: sc.id,
    teacherId: sc.teacherId,
    name: sc.displayName,
    yearLevel: sc.yearLevel,
    subject: sc.subject,
    studentCount: 0
  }));

  // Confirm ZERO fake student records in dataStore
  dataStore.data.students = [];
  dataStore.data.studentProfiles = {};
  dataStore.data.interventions = [];
  dataStore.data.practiceAttempts = [];
  dataStore.data.classDashboard = {
    classId: seededClasses[0]?.id || 'year10-amanah',
    studentCount: 0,
    classHealthScore: 0,
    onTrackCount: 0,
    needsSupportCount: 0,
    averageLoginMinutesPerDay: 0,
    weeklyPerformance: [],
    subjectPerformance: []
  };

  dataStore.save();

  console.log('✅ Teacher seeding complete! Zero fake students seeded.');
  return {
    teacher: t.name,
    teacherId: t.teacherId,
    classes: seededClasses
  };
}

if (process.argv[1] && process.argv[1].includes('seedTeacher')) {
  seedTeacherOnly()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal seed error:', err);
      process.exit(1);
    });
}
