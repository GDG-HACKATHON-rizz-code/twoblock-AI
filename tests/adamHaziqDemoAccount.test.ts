import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { dataStore } from '../src/services/dataStore.js';
import { seedAdamDemoAccount, resetAdamDemoData } from '../src/scripts/seedAdamDemo.js';
import { ScoringService } from '../src/services/scoringService.js';

test.describe('Adam Haziq Demonstration Account & Live Sync Suite', () => {

  test.before(async () => {
    // Seed Adam demo account
    await seedAdamDemoAccount();
  });

  test('1. Demo login endpoint returns authenticated session for Adam Haziq', async () => {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-student' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'JWT token should be present');
    assert.equal(res.body.data.user.full_name, 'Adam Haziq');
    assert.equal(res.body.data.user.email, 'adam.haziq@twoblock.ai');
    assert.equal(res.body.data.user.role, 'STUDENT');
    assert.equal(res.body.data.user.is_demo_account, true);
  });

  test('2. Adam Haziq bypasses onboarding (profile and diagnostic completed = true)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-student' });
    const token = loginRes.body.data.token;

    const statusRes = await request(app)
      .get('/api/student/diagnostic/status')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.data.profileCompleted, true);
    assert.equal(statusRes.body.data.diagnosticCompleted, true);
    assert.equal(statusRes.body.data.profile.name, 'Adam Haziq');
    assert.equal(statusRes.body.data.profile.school, 'Sekolah Menengah Maju Jaya');
  });

  test('3. Adam Haziq Student Overview loads baseline scores from student-demo-data.json', async () => {
    const loginRes = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-student' });
    const token = loginRes.body.data.token;

    const dashRes = await request(app)
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(dashRes.status, 200);
    const data = dashRes.body.data;
    assert.equal(data.hasAssessment, true);
    assert.equal(data.overallPerformance, 84);
    assert.equal(data.healthScore, 84);
    assert.equal(data.learningStreakDays, 12);
    assert.equal(data.studyActivityMinutes, 385);
    assert.equal(data.subjects.length, 4);

    // Verify individual subjects
    const math = data.subjects.find((s: any) => s.name === 'Mathematics');
    const bm = data.subjects.find((s: any) => s.name === 'Bahasa Melayu');
    const english = data.subjects.find((s: any) => s.name === 'English');
    const science = data.subjects.find((s: any) => s.name === 'Science');

    assert.ok(math && math.score === 70, 'Maths should be 70');
    assert.ok(bm && bm.score === 67, 'BM should be 67');
    assert.ok(english && english.score === 67, 'English should be 67');
    assert.ok(science && science.score === 90, 'Science should be 90');
  });

  test('4. Adam Haziq appears on Teacher class roster with correct metrics and status', async () => {
    const teacherLogin = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'teacher' });
    const teacherToken = teacherLogin.body.data.token;

    const rosterRes = await request(app)
      .get('/api/teacher/students')
      .set('Authorization', `Bearer ${teacherToken}`);

    assert.equal(rosterRes.status, 200);
    const students = rosterRes.body.data.students;
    const adam = students.find((s: any) => s.name === 'Adam Haziq');

    assert.ok(adam, 'Adam Haziq must be listed in teacher students roster');
    assert.equal(adam.healthScore, 84);
    assert.equal(adam.status, 'Assessment completed');
    assert.ok(adam.className.includes('Amanah'), 'Adam should be assigned to Amanah class');
  });

  test('5. Live practice calculation follows (previous * 0.7) + (latest * 0.3)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-student' });
    const token = loginRes.body.data.token;

    // Subtraction previous score is 54
    // Student submits correct answer (100) -> new score: Math.round((54 * 0.7) + (100 * 0.3)) = Math.round(37.8 + 30) = 68
    const expectedScore = ScoringService.calculateWeightedScore(54, 100);
    assert.equal(expectedScore, 68);

    const answerRes = await request(app)
      .post('/api/student/practice/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        topic: 'subtraction',
        subject: 'Mathematics',
        studentAnswer: '4',
        correctAnswer: '4',
        timeSpentSeconds: 15,
        questionText: '9 - 5 = ?',
        level: 2
      });

    assert.equal(answerRes.status, 200);
    assert.equal(answerRes.body.data.isCorrect, true);
    assert.equal(answerRes.body.data.newTopicScore, 68);
    assert.equal(answerRes.body.data.topicMastery, 'Developing');
  });

  test('6. Reset demo progress endpoint restores original baseline scores', async () => {
    const loginRes = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-student' });
    const token = loginRes.body.data.token;

    const resetRes = await request(app)
      .post('/api/student/reset-demo')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.data.success, true);
    assert.equal(resetRes.body.data.message, 'Demo progress has been reset.');

    // Confirm subtraction is back to 54 in dataStore
    const math = dataStore.data.subjects.find(s => s.name === 'Mathematics');
    const sub = math?.topics.find(t => t.id === 'subtraction' || t.name === 'Subtraction');
    assert.equal(sub?.score, 54, 'Subtraction score should be restored to baseline 54');
    assert.equal(math?.score, 70, 'Math score should be restored to 70');
  });

});
