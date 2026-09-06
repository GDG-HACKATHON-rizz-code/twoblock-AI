import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dataStore } from '../src/services/dataStore.js';
import * as studentController from '../src/controllers/studentController.js';
import * as teacherController from '../src/controllers/teacherController.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpapghryrtnelmgfnfjg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const EXPECTED_STRINGS = {
  studentLearning: {
    title: 'No learning data yet.',
    message: 'Complete your Personal Information and Quick Learning Check to begin.'
  },
  studentPractice: {
    title: 'No practice history yet.',
    message: 'Your personalised practice will appear after the Quick Learning Check.'
  },
  teacherStudents: {
    title: 'No students have been added yet.',
    message: 'Class progress will appear after students complete their learning check.'
  },
  teacherInterventions: {
    title: 'No interventions are available yet.',
    message: 'Recommendations will appear when student learning data is available.'
  }
};

describe('Demo Data Purge and Empty States Verification', () => {

  beforeEach(() => {
    // Reset dataStore in memory to zero state
    dataStore.data = {
      users: [],
      studentProfiles: {},
      teacherProfiles: {},
      classes: [],
      subjects: [],
      students: [],
      interventions: [],
      practiceAttempts: [],
      dashboard: {},
      classDashboard: {},
      recommendations: [],
      recentActivity: [],
      assignedInterventionStudents: []
    };
  });

  it('1. Supabase: zero fake student data, questions preserved, teacher account seeded', async () => {
    const studentTables = [
      'student_profiles',
      'student_subject_progress',
      'student_topic_progress'
    ];

    for (const table of studentTables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      assert.strictEqual(error, null, `Error querying ${table}: ${error?.message}`);
      assert.strictEqual(count, 0, `Table ${table} must have 0 fake student rows, found: ${count}`);
    }

    // Teacher profiles and classes hold teacher Liyana K.
    const { count: teacherCount } = await supabase
      .from('teacher_profiles')
      .select('*', { count: 'exact', head: true });
    assert(teacherCount && teacherCount > 0, 'Teacher profile must be seeded');

    const { count: classCount } = await supabase
      .from('classes')
      .select('*', { count: 'exact', head: true });
    assert(classCount && classCount >= 3, 'Teacher classes must be seeded');

    const { count: qCount, error: qErr } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });
    assert.strictEqual(qErr, null, `Error querying questions: ${qErr?.message}`);
    assert(qCount && qCount > 3000, `Questions table must preserve syllabus questions (>3000), found: ${qCount}`);
  });

  it('2. studentController: returns zero stats and exact required empty states', async () => {
    const createMockRes = () => {
      const res: any = {};
      res.json = (payload: any) => {
        res.payload = payload;
        return res;
      };
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      return res;
    };

    // Dashboard
    const dashRes = createMockRes();
    await studentController.getDashboard({ user: { id: 'test-user-id' } } as any, dashRes, () => {});
    const dash = dashRes.payload?.data;
    assert(dash, 'Expected dashboard data in response');
    assert.strictEqual(dash.overallPerformance, 0);
    assert.strictEqual(dash.learningStreakDays, 0);
    assert.strictEqual(dash.studyActivityMinutes, 0);
    assert.strictEqual(dash.hasAssessment, false);
    assert.strictEqual(dash.emptyTitle, EXPECTED_STRINGS.studentLearning.title);
    assert.strictEqual(dash.emptyMessage, EXPECTED_STRINGS.studentLearning.message);
    assert.strictEqual(dash.practiceEmptyTitle, EXPECTED_STRINGS.studentPractice.title);
    assert.strictEqual(dash.practiceEmptyMessage, EXPECTED_STRINGS.studentPractice.message);

    // Insights
    const insRes = createMockRes();
    await studentController.getInsights({ user: { id: 'test-user-id' } } as any, insRes, () => {});
    const ins = insRes.payload?.data;
    assert(ins, 'Expected insights data in response');
    assert.strictEqual(ins.emptyTitle, EXPECTED_STRINGS.studentPractice.title);
    assert.strictEqual(ins.emptyMessage, EXPECTED_STRINGS.studentPractice.message);

    // Report
    const repRes = createMockRes();
    await studentController.getReport({ user: { id: 'test-user-id' } } as any, repRes, () => {});
    const rep = repRes.payload?.data;
    assert(rep, 'Expected report data in response');
    assert.strictEqual(rep.emptyTitle, EXPECTED_STRINGS.studentLearning.title);
    assert.strictEqual(rep.emptyMessage, EXPECTED_STRINGS.studentLearning.message);
    assert.strictEqual(rep.learnerName, 'Learner');
  });

  it('3. teacherController: returns zero stats and exact required empty states', async () => {
    const createMockRes = () => {
      const res: any = {};
      res.json = (payload: any) => {
        res.payload = payload;
        return res;
      };
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      return res;
    };

    // Overview / Dashboard
    const overRes = createMockRes();
    await teacherController.getDashboard({ user: { id: 'test-teacher-id' } } as any, overRes, () => {});
    const over = overRes.payload?.data;
    assert(over, 'Expected teacher dashboard data in response');
    assert.strictEqual(over.totalStudents, 0);
    assert.strictEqual(over.classHealthScore, 0);
    assert.strictEqual(over.studentList.length, 0);
    assert.strictEqual(over.emptyTitle, EXPECTED_STRINGS.teacherStudents.title);
    assert.strictEqual(over.emptyMessage, EXPECTED_STRINGS.teacherStudents.message);

    // Students
    const studRes = createMockRes();
    await teacherController.getStudents({ user: { id: 'test-teacher-id' }, query: {} } as any, studRes, () => {});
    const stud = studRes.payload?.data;
    assert(stud, 'Expected teacher students data in response');
    assert.strictEqual(stud.counts.total, 0);
    assert.strictEqual(stud.students.length, 0);

    // Interventions
    const intRes = createMockRes();
    await teacherController.getInterventions({ user: { id: 'test-teacher-id' }, query: {} } as any, intRes, () => {});
    const interventions = intRes.payload?.data;
    assert(interventions, 'Expected teacher interventions data in response');
    assert.strictEqual(interventions.counts.total, 0);
    assert.strictEqual(interventions.students.length, 0);
    assert.strictEqual(interventions.emptyTitle, EXPECTED_STRINGS.teacherInterventions.title);
    assert.strictEqual(interventions.emptyMessage, EXPECTED_STRINGS.teacherInterventions.message);

    // Report
    const repRes = createMockRes();
    await teacherController.getReport({ user: { id: 'test-teacher-id' } } as any, repRes, () => {});
    const rep = repRes.payload?.data;
    assert(rep, 'Expected teacher report data in response');
    assert.strictEqual(rep.classHealthScore, 0);
    assert.strictEqual(rep.emptyTitle, EXPECTED_STRINGS.teacherStudents.title);
    assert.strictEqual(rep.emptyMessage, EXPECTED_STRINGS.teacherStudents.message);
  });

  it('4. public/index.html: contains all 4 exact empty state text pairs and no hard-coded demo student names', () => {
    const htmlPath = path.resolve(process.cwd(), 'public/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Check all required empty state phrases are present in the HTML template
    assert(html.includes(EXPECTED_STRINGS.studentLearning.title), 'Missing student learning title in HTML');
    assert(html.includes(EXPECTED_STRINGS.studentLearning.message), 'Missing student learning message in HTML');
    assert(html.includes(EXPECTED_STRINGS.studentPractice.title), 'Missing student practice title in HTML');
    assert(html.includes(EXPECTED_STRINGS.studentPractice.message), 'Missing student practice message in HTML');
    assert(html.includes(EXPECTED_STRINGS.teacherStudents.title), 'Missing teacher students title in HTML');
    assert(html.includes(EXPECTED_STRINGS.teacherStudents.message), 'Missing teacher students message in HTML');
    assert(html.includes(EXPECTED_STRINGS.teacherInterventions.title), 'Missing teacher interventions title in HTML');
    assert(html.includes(EXPECTED_STRINGS.teacherInterventions.message), 'Missing teacher interventions message in HTML');

    // Confirm demo student names are NOT present in rendered card content
    assert(!html.includes('Amira M.'), 'Should not contain hard-coded Amira M.');
    assert(!html.includes('Omar Faruk'), 'Should not contain hard-coded Omar Faruk');
    assert(!html.includes('Chong Wei'), 'Should not contain hard-coded Chong Wei');
    assert(!html.includes('Oliver Twist'), 'Should not contain hard-coded Oliver Twist');
    assert(!html.includes('Sofia Al-Attas'), 'Should not contain hard-coded Sofia Al-Attas');
    assert(!html.includes('Liyana K.'), 'Should not contain hard-coded Liyana K.');
  });
});
