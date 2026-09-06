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

export const ADAM_HAZIQ_USER_ID = 'ad000000-0000-4000-8000-000000000001';
export const ADAM_HAZIQ_EMAIL = 'adam.haziq@twoblock.ai';

export async function seedAdamDemoAccount() {
  console.log('🧑‍🎓 Seeding Adam Haziq demonstration account from student-demo-data.json...');

  // 1. Read student-demo-data.json
  const dataPath = path.resolve(process.cwd(), 'student-demo-data.json');
  const demoData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const studentName = 'Adam Haziq';
  const studentInitials = 'AH';
  const email = ADAM_HAZIQ_EMAIL;
  const password = 'password123';

  // 2. Ensure Supabase Auth user exists for Adam Haziq
  let authUserId = ADAM_HAZIQ_USER_ID;
  try {
    const { data: listUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = listUsers?.users?.find(u => u.email === email);

    if (existing) {
      authUserId = existing.id;
      // Update metadata to reflect demo account
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          full_name: studentName,
          role: 'student',
          is_demo_account: true,
          profile_completed: true,
          quick_test_completed: true
        },
        app_metadata: {
          role: 'student',
          is_demo_account: true
        }
      });
      console.log(`  ✓ Updated Supabase auth user for Adam Haziq (${authUserId})`);
    } else {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: studentName,
          role: 'student',
          is_demo_account: true,
          profile_completed: true,
          quick_test_completed: true
        },
        app_metadata: {
          role: 'student',
          is_demo_account: true
        }
      });

      if (!createErr && newUser?.user) {
        authUserId = newUser.user.id;
        console.log(`  ✓ Created Supabase auth user for Adam Haziq (${authUserId})`);
      }
    }
  } catch (err: any) {
    console.warn('  Note on auth user creation:', err?.message || err);
  }

  // 3. Upsert into public.users if table exists
  try {
    await supabaseAdmin.from('users').upsert({
      id: authUserId,
      email,
      password_hash: 'managed_by_supabase_auth',
      role: 'student'
    });
  } catch (err) {}

  // 4. Find Teacher Liyana's class to enroll Adam Haziq
  const { data: classes } = await supabaseAdmin
    .from('classes')
    .select('id, class_name')
    .limit(5);

  const targetClass = classes?.find(c => (c.class_name || '').includes('Amanah')) || classes?.[0];
  const classId = targetClass?.id || 'year10-amanah';
  const className = targetClass?.class_name || 'Year 10 Amanah (AMANAH10)';

  // 5. Upsert into public.student_profiles
  let studentProfileId = authUserId;
  try {
    const { data: sp, error: spErr } = await supabaseAdmin.from('student_profiles').upsert({
      user_id: authUserId,
      full_name: studentName,
      grade_level: 'Grade 5',
      preferred_language: 'English',
      learning_preferences: {
        district: 'Kuala Lumpur',
        dateOfBirth: '2014-03-18',
        learningLanguages: ['Bahasa Melayu', 'English'],
        favouriteSubject: 'Mathematics',
        preferredStudyTime: '7:00 PM',
        school: 'Sekolah Menengah Maju Jaya',
        is_demo_account: true,
        profile_completed: true,
        quick_test_completed: true,
        classCode: 'AMANAH10'
      },
      onboarding_completed: true
    }).select().single();

    if (!spErr && sp?.id) {
      studentProfileId = sp.id;
      console.log(`  ✓ Upserted student_profiles in Supabase (${studentProfileId})`);
    }
  } catch (err: any) {
    console.warn('  Note on student_profiles:', err?.message || err);
  }

  // 6. Enroll Adam Haziq in class_enrolments
  try {
    const isClassUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);
    const isStudentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentProfileId);

    if (isClassUuid && isStudentUuid) {
      await supabaseAdmin.from('class_enrolments').upsert({
        class_id: classId,
        student_id: studentProfileId
      });
      console.log(`  ✓ Enrolled Adam Haziq in class: ${className}`);
    }
  } catch (err: any) {
    console.warn('  Note on class_enrolments:', err?.message || err);
  }

  // 7. Upsert subject progress in public.student_subject_progress
  try {
    for (const sub of demoData.subjects) {
      await supabaseAdmin.from('student_subject_progress').upsert({
        student_id: authUserId,
        subject_id: sub.id,
        score: sub.score,
        mastery: sub.mastery || sub.score,
        learning_minutes: sub.learningMinutes,
        status: sub.status,
        strength: sub.strength
      });
    }
    console.log(`  ✓ Upserted 4 subject progress records in Supabase`);
  } catch (err: any) {
    console.warn('  Note on student_subject_progress:', err?.message || err);
  }

  // 8. Upsert topic progress in public.student_topic_progress
  try {
    for (const sub of demoData.subjects) {
      for (const topic of sub.topics) {
        await supabaseAdmin.from('student_topic_progress').upsert({
          student_id: authUserId,
          topic_id: topic.id,
          score: topic.score,
          status: topic.status
        });
      }
    }
    console.log(`  ✓ Upserted 16 topic progress records in Supabase`);
  } catch (err: any) {
    console.warn('  Note on student_topic_progress:', err?.message || err);
  }

  // 9. Sync into local dataStore for fast query and fallback
  dataStore.load();

  const adamProfile = {
    userId: authUserId,
    name: studentName,
    initials: studentInitials,
    grade: demoData.student.grade || 'Grade 5',
    school: demoData.student.school || 'Sekolah Menengah Maju Jaya',
    district: demoData.student.district || 'Kuala Lumpur',
    dateOfBirth: demoData.student.dateOfBirth || '2014-03-18',
    learningLanguages: demoData.student.learningLanguages || ['Bahasa Melayu', 'English'],
    preferredLanguage: demoData.student.preferredLanguage || 'English',
    favouriteSubject: demoData.student.favouriteSubject || 'Mathematics',
    preferredStudyTime: demoData.student.preferredStudyTime || '7:00 PM',
    is_demo_account: true,
    diagnostic_completed: true,
    onboarding_completed: true,
    profile_completed: true,
    quick_test_completed: true,
    classId,
    className
  } as any;

  dataStore.data.studentProfiles[authUserId] = adamProfile;
  dataStore.data.studentProfiles[ADAM_HAZIQ_USER_ID] = adamProfile;
  if (demoData.student?.id) {
    dataStore.data.studentProfiles[demoData.student.id] = adamProfile;
  }

  // Set 4 subjects with topic progress
  dataStore.data.subjects = demoData.subjects.map((s: any) => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName || s.name,
    score: s.score,
    mastery: s.mastery || s.score,
    learningMinutes: s.learningMinutes,
    status: s.status,
    strength: s.strength,
    topics: s.topics.map((t: any) => ({
      id: t.id,
      name: t.name,
      score: t.score,
      status: t.status
    })),
    learningGaps: s.learningGaps || []
  }));

  // Set Adam's dashboard metrics
  dataStore.data.dashboard = {
    overallPerformance: demoData.dashboard.overallPerformance,
    healthScore: demoData.dashboard.healthScore || 84,
    learningStreakDays: demoData.dashboard.learningStreakDays,
    streakIncreaseThisWeek: demoData.dashboard.streakIncreaseThisWeek,
    studyActivityMinutes: demoData.dashboard.studyActivityMinutes,
    studyActivityChangePercent: demoData.dashboard.studyActivityChangePercent,
    availableFocusMinutes: demoData.dashboard.availableFocusMinutes,
    bestFocusWindow: demoData.dashboard.bestFocusWindow,
    weeklyActivity: demoData.dashboard.weeklyActivity,
    recommendedPractice: {
      subject: 'Mathematics',
      topic: 'Fractions',
      description: 'Adam needs more practice with equivalent fractions and fractions addition.',
      durationMinutes: 15
    }
  };

  // Set Adam's priority recommendation
  dataStore.data.recommendations = demoData.recommendations.map((r: any) => ({
    ...r,
    studentId: authUserId,
    status: 'active'
  }));

  // Set Adam's recent activity
  dataStore.data.recentActivity = demoData.recentActivity;

  // Set Adam's 16 practice attempts
  dataStore.data.practiceAttempts = Array.from({ length: 16 }).map((_, i) => ({
    id: `practice-attempt-${i + 1}`,
    studentId: authUserId,
    subject: i % 2 === 0 ? 'Mathematics' : 'Science',
    topic: i % 2 === 0 ? 'Fractions' : 'Living Things',
    score: 75,
    isCorrect: true,
    createdAt: new Date(Date.now() - (16 - i) * 3600 * 1000).toISOString()
  }));

  // Set Adam's 20 diagnostic attempts
  dataStore.data.diagnosticAttempts = Array.from({ length: 20 }).map((_, i) => ({
    id: `diag-attempt-${i + 1}`,
    studentId: authUserId,
    questionId: `diag-q-${i + 1}`,
    selectedAnswer: 'A',
    isCorrect: i < 15,
    createdAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString()
  }));

  // Adam Haziq is the ONLY student in Teacher student directory
  const totalLearningMins = demoData.subjects.reduce((sum: number, s: any) => sum + (s.learningMinutes || 0), 0);

  const adamRosterItem = {
    id: authUserId,
    name: studentName,
    initials: studentInitials,
    primarySubject: 'Mathematics',
    learningMinutes: totalLearningMins,
    healthScore: demoData.dashboard.healthScore || 84,
    status: 'On track' as const,
    trend: 'up' as const,
    classId,
    className
  };

  // Remove phantom students - Adam Haziq is the single demo student
  dataStore.data.students = [adamRosterItem];

  // Teacher intervention for Adam Haziq on Fractions
  dataStore.data.interventions = [
    {
      id: `int-fractions-${authUserId}`,
      studentId: authUserId,
      studentName,
      status: 'problem',
      classification: 'Guided Support',
      subject: 'Mathematics',
      topic: 'Fractions',
      healthScore: demoData.dashboard.healthScore || 84,
      topicScore: 54,
      learningMinutes: 48,
      recommendation: 'Targeted 15-minute guided support plan in Fractions to build core equivalent fractions confidence.',
      plan: '15-minute visual fractions mini-lesson with adaptive step-by-step hints.',
      createdAt: new Date().toISOString()
    }
  ];

  dataStore.save();
  console.log('✅ Adam Haziq demonstration account seeded and synced to teacher class!');
  return {
    userId: authUserId,
    name: studentName,
    email,
    class: className
  };
}

// Reset function to restore original baseline from student-demo-data.json
export async function resetAdamDemoData() {
  console.log('↺ Resetting Adam Haziq demo progress to baseline...');
  return seedAdamDemoAccount();
}

if (process.argv[1] && process.argv[1].includes('seedAdamDemo')) {
  seedAdamDemoAccount()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Failed to seed Adam Haziq demo account:', err);
      process.exit(1);
    });
}
