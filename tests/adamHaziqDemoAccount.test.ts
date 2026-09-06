import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { dataStore } from '../src/services/dataStore.js';
import { demoDataService } from '../src/services/demoData.js';
import { ScoringService } from '../src/services/scoringService.js';

test.describe('Official Demo Mode: Adam Haziq & Ms. Liyana Karim Suite', () => {

  test.beforeEach(async () => {
    // Reset demo state before each test
    demoDataService.resetDemoData();
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

  test('2. Demo login endpoint returns authenticated session for Ms. Liyana Karim', async () => {
    const res = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-teacher' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'JWT token should be present');
    assert.equal(res.body.data.user.full_name, 'Ms. Liyana Karim');
    assert.equal(res.body.data.user.email, 'demo.teacher@twoblock.ai');
    assert.equal(res.body.data.user.role, 'TEACHER');
    assert.equal(res.body.data.user.is_demo_account, true);
  });

  test('3. Adam Haziq bypasses onboarding (profile and diagnostic completed = true)', async () => {
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
  });

  test('4. Adam Haziq Student Overview loads official baseline scores from index.html', async () => {
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

    // Recommended practice should be Subtraction
    assert.ok(data.recommendedPractice);
    assert.equal(data.recommendedPractice.topic, 'Subtraction');
    assert.equal(data.recommendedPractice.currentScore, 54);
  });

  test('5. Demo Teacher Ms. Liyana Karim views Class 5 Cemerlang with Adam Haziq & classmates', async () => {
    const teacherLogin = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-teacher' });
    const teacherToken = teacherLogin.body.data.token;

    const rosterRes = await request(app)
      .get('/api/teacher/students')
      .set('Authorization', `Bearer ${teacherToken}`);

    assert.equal(rosterRes.status, 200);
    const students = rosterRes.body.data.students;
    assert.ok(students.length >= 6, 'Demo class should have at least 6 students');

    const adam = students.find((s: any) => s.name === 'Adam Haziq');
    assert.ok(adam, 'Adam Haziq must be listed in teacher students roster');
    assert.equal(adam.healthScore, 84);
    assert.equal(adam.className, '5 Cemerlang');

    // Verify Omar P. is also present
    const omar = students.find((s: any) => s.name.includes('Omar'));
    assert.ok(omar, 'Omar P. must be in class roster');
    assert.equal(omar.healthScore, 47);

    // Verify Teacher Insights priority recommendation
    const insightsRes = await request(app)
      .get('/api/teacher/insights')
      .set('Authorization', `Bearer ${teacherToken}`);

    assert.equal(insightsRes.status, 200);
    assert.ok(insightsRes.body.data.priorityIntervention, 'Priority intervention should be present');
    assert.equal(insightsRes.body.data.priorityIntervention.studentName, 'Omar P.');
    assert.equal(insightsRes.body.data.priorityIntervention.focus, 'subtraction');
  });

  test('6. Real Teacher account starts completely isolated from demo records', async () => {
    const realTeacherLogin = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'teacher' });
    const realToken = realTeacherLogin.body.data.token;

    const rosterRes = await request(app)
      .get('/api/teacher/students')
      .set('Authorization', `Bearer ${realToken}`);

    assert.equal(rosterRes.status, 200);
    const students = rosterRes.body.data.students;
    // Real teacher should have 0 demo students
    const hasDemoStudents = students.some((s: any) => s.id.startsWith('demo-') || s.is_demo);
    assert.equal(hasDemoStudents, false, 'Real teacher should never see demo students');
  });

  test('7. Live practice calculation follows (previous * 0.7) + (latest * 0.3)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-student' });
    const token = loginRes.body.data.token;

    // Subtraction previous baseline score is 54
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
        questionText: '8 - 4 = ?',
        level: 2
      });

    assert.equal(answerRes.status, 200);
    assert.equal(answerRes.body.data.isCorrect, true);
    assert.equal(answerRes.body.data.newTopicScore, 68);
    assert.equal(answerRes.body.data.topicMastery, 'Developing');
  });

  test('8. Reset demo progress endpoint restores original baseline scores', async () => {
    const loginRes = await request(app)
      .post('/api/auth/demo-login')
      .send({ role: 'demo-student' });
    const token = loginRes.body.data.token;

    // First practice to modify Subtraction score
    await request(app)
      .post('/api/student/practice/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        topic: 'subtraction',
        subject: 'Mathematics',
        studentAnswer: '4',
        correctAnswer: '4',
        timeSpentSeconds: 15,
        questionText: '8 - 4 = ?',
        level: 2
      });

    // Reset demo progress
    const resetRes = await request(app)
      .post('/api/student/reset-demo')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.data.success, true);

    // Verify dashboard returns baseline 54% for Subtraction
    const dashRes = await request(app)
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.body.data.overallPerformance, 84);
    assert.equal(dashRes.body.data.recommendedPractice.currentScore, 54);
  });

});
