import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  demoDataService,
  INITIAL_DEMO_TEACHER,
  INITIAL_DEMO_CLASS,
  INITIAL_ADAM_PROFILE,
  INITIAL_CLASSMATES
} from '../services/demoData.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpapghryrtnelmgfnfjg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function seedOfficialDemoData() {
  console.log('🌟 Seeding official Demo Mode records (Student Adam Haziq & Teacher Ms. Liyana Karim)...');

  // Reset local state in demoDataService
  demoDataService.resetDemoData();

  // 1. Seed Demo Teacher Auth User
  const demoTeacherEmail = 'demo.teacher@twoblock.ai';
  let demoTeacherAuthId = INITIAL_DEMO_TEACHER.userId;

  try {
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingTeacher = userList?.users?.find(u => u.email === demoTeacherEmail || u.email === 'liyana.demo@twoblock.ai');

    if (existingTeacher) {
      demoTeacherAuthId = existingTeacher.id;
      await supabaseAdmin.auth.admin.updateUserById(demoTeacherAuthId, {
        user_metadata: {
          full_name: INITIAL_DEMO_TEACHER.name,
          role: 'teacher',
          is_demo: true,
          is_demo_account: true
        },
        app_metadata: {
          role: 'teacher',
          is_demo: true,
          is_demo_account: true
        }
      });
    } else {
      const { data: newTeacher } = await supabaseAdmin.auth.admin.createUser({
        email: demoTeacherEmail,
        password: 'password123',
        email_confirm: true,
        user_metadata: {
          full_name: INITIAL_DEMO_TEACHER.name,
          role: 'teacher',
          is_demo: true,
          is_demo_account: true
        },
        app_metadata: {
          role: 'teacher',
          is_demo: true,
          is_demo_account: true
        }
      });
      if (newTeacher?.user) demoTeacherAuthId = newTeacher.user.id;
    }
  } catch (err) {}

  // 2. Seed Demo Teacher Profile & Class in Supabase
  try {
    await supabaseAdmin.from('teacher_profiles').upsert({
      user_id: demoTeacherAuthId,
      full_name: INITIAL_DEMO_TEACHER.name,
      teacher_id: INITIAL_DEMO_TEACHER.teacherId,
      school_name: INITIAL_DEMO_TEACHER.school,
      primary_subject: INITIAL_DEMO_TEACHER.primarySubject,
      teaching_level: INITIAL_DEMO_TEACHER.teachingLevel
    });

    await supabaseAdmin.from('classes').upsert({
      id: INITIAL_DEMO_CLASS.id,
      teacher_id: demoTeacherAuthId,
      class_name: INITIAL_DEMO_CLASS.name,
      year_level: INITIAL_DEMO_CLASS.yearLevel,
      subject: INITIAL_DEMO_CLASS.subject
    });
  } catch (err) {}

  // 3. Seed Demo Student Auth User (Adam Haziq)
  const adamEmail = 'adam.haziq@twoblock.ai';
  let adamAuthId = INITIAL_ADAM_PROFILE.userId;

  try {
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAdam = userList?.users?.find(u => u.email === adamEmail);

    if (existingAdam) {
      adamAuthId = existingAdam.id;
      await supabaseAdmin.auth.admin.updateUserById(adamAuthId, {
        user_metadata: {
          full_name: INITIAL_ADAM_PROFILE.name,
          role: 'student',
          is_demo: true,
          is_demo_account: true,
          profile_completed: true,
          quick_test_completed: true
        },
        app_metadata: {
          role: 'student',
          is_demo: true,
          is_demo_account: true
        }
      });
    } else {
      const { data: newAdam } = await supabaseAdmin.auth.admin.createUser({
        email: adamEmail,
        password: 'password123',
        email_confirm: true,
        user_metadata: {
          full_name: INITIAL_ADAM_PROFILE.name,
          role: 'student',
          is_demo: true,
          is_demo_account: true,
          profile_completed: true,
          quick_test_completed: true
        },
        app_metadata: {
          role: 'student',
          is_demo: true,
          is_demo_account: true
        }
      });
      if (newAdam?.user) adamAuthId = newAdam.user.id;
    }
  } catch (err) {}

  // 4. Seed Adam's Student Profile and enroll in 5 Cemerlang
  try {
    await supabaseAdmin.from('student_profiles').upsert({
      user_id: adamAuthId,
      full_name: INITIAL_ADAM_PROFILE.name,
      grade_level: 5,
      preferred_language: 'English',
      school_name: INITIAL_ADAM_PROFILE.school,
      diagnostic_completed: true
    });

    await supabaseAdmin.from('class_students').upsert({
      class_id: INITIAL_DEMO_CLASS.id,
      student_id: adamAuthId,
      status: 'active'
    });
  } catch (err) {}

  console.log('✅ Official Demo Mode seeded:');
  console.log(`  • Teacher: ${INITIAL_DEMO_TEACHER.name} (${INITIAL_DEMO_TEACHER.teacherId})`);
  console.log(`  • Class: ${INITIAL_DEMO_CLASS.name} (${INITIAL_DEMO_CLASS.id})`);
  console.log(`  • Student: ${INITIAL_ADAM_PROFILE.name} (${INITIAL_ADAM_PROFILE.grade})`);
  console.log(`  • Demo classmates: ${INITIAL_CLASSMATES.map(c => c.name).join(', ')}`);
}

if (process.argv[1]?.endsWith('seedDemoData.ts')) {
  seedOfficialDemoData().catch(console.error);
}
