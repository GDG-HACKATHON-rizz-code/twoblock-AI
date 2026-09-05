import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('2Block Ai Real Backend Integration Test Suite', () => {
  let studentToken = '';
  let teacherToken = '';

  it('POST /auth/demo-login should log in student and return valid JWT', async () => {
    const res = await request(app)
      .post('/auth/demo-login')
      .send({ role: 'student' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('STUDENT');
    studentToken = res.body.data.token;
  });

  it('POST /auth/demo-login should log in teacher and return valid JWT', async () => {
    const res = await request(app)
      .post('/auth/demo-login')
      .send({ role: 'teacher' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('TEACHER');
    teacherToken = res.body.data.token;
  });

  it('GET /api/student/dashboard should return metrics, weekly graph, and gaps', async () => {
    const res = await request(app)
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('overallPerformance');
    expect(res.body.data).toHaveProperty('learningStreakDays', 12);
    expect(res.body.data.weeklyActivity).toHaveLength(7);
    expect(res.body.data.subjects).toHaveLength(4);
    expect(res.body.data.learningGaps).toHaveProperty('Mathematics');
  });

  it('GET /api/student/learning should return all subjects with subtopic scores', async () => {
    const res = await request(app)
      .get('/api/student/learning')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subjects).toHaveLength(4);
    const math = res.body.data.subjects.find((s: any) => s.name === 'Mathematics');
    expect(math).toBeDefined();
    expect(math.topics.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/student/practice/questions should generate questions for topic', async () => {
    const res = await request(app)
      .get('/api/student/practice/questions?topic=subtraction&level=1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('equation');
    expect(res.body.data).toHaveProperty('answer');
    expect(res.body.data.topic).toBe('subtraction');
  });

  it('POST /api/student/practice/answer should validate correctness and track attempt', async () => {
    const res = await request(app)
      .post('/api/student/practice/answer')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        topic: 'addition',
        studentAnswer: 5,
        correctAnswer: 5,
        timeSpentSeconds: 3,
        questionText: '2 + 3 = ?'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isCorrect).toBe(true);
  });

  it('POST /api/student/practice/end should compute mastery and score', async () => {
    const res = await request(app)
      .post('/api/student/practice/end')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        topic: 'subtraction',
        correctCount: 7,
        wrongCount: 3
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBe(70);
    expect(res.body.data.mastery).toBe('Developing');
  });

  it('GET /api/student/insights should return priority recommendations and steps', async () => {
    const res = await request(app)
      .get('/api/student/insights')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.priority).toBeDefined();
    expect(res.body.data.whyPoints).toHaveLength(3);
    expect(res.body.data.steps).toHaveLength(3);
  });

  it('GET /api/student/report should return comprehensive learning report', async () => {
    const res = await request(app)
      .get('/api/student/report')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('overallPerformance');
    expect(res.body.data).toHaveProperty('trendChart');
    expect(res.body.data.achievements.length).toBeGreaterThan(0);
  });

  it('PUT /api/student/profile should update student profile', async () => {
    const res = await request(app)
      .put('/api/student/profile')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        name: 'Amira M.',
        grade: 'Grade 2',
        city: 'Kuala Lumpur'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.grade).toBe('Grade 2');
  });

  it('GET /api/teacher/dashboard should return class health score and breakdown', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('classHealthScore');
    expect(res.body.data.subjectPerformance).toHaveLength(4);
    expect(res.body.data.studentList.length).toBeGreaterThanOrEqual(10);
  });

  it('GET /api/teacher/students with filter=bad should return students needing support', async () => {
    const res = await request(app)
      .get('/api/teacher/students?filter=bad')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.students.every((s: any) => s.healthScore < 55)).toBe(true);
  });

  it('GET /api/teacher/students/:name should return individual student progress', async () => {
    const res = await request(app)
      .get('/api/teacher/students/Omar%20P.')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Omar P.');
    expect(res.body.data.topics).toHaveLength(4);
  });

  it('POST /api/teacher/interventions should create support plan', async () => {
    const res = await request(app)
      .post('/api/teacher/interventions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentName: 'Omar P.',
        focus: 'Subtraction',
        action: '15-minute guided support plan',
        notes: 'Visual counters mini-lesson'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignedStudents).toContain('Omar P.');
  });

  it('GET /api/teacher/interventions?category=problem should return problem students', async () => {
    const res = await request(app)
      .get('/api/teacher/interventions?category=problem')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category).toBe('problem');
    expect(res.body.data.counts).toHaveProperty('total', 30);
  });

  it('GET /api/teacher/report should return class report overview', async () => {
    const res = await request(app)
      .get('/api/teacher/report')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('classHealthScore');
    expect(res.body.data.subjectPerformance).toHaveLength(4);
  });

  it('PUT /api/teacher/profile should save teacher profile information', async () => {
    const res = await request(app)
      .put('/api/teacher/profile')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        teacherName: 'Liyana K.',
        school: 'Sekolah Menengah Maju Jaya',
        level: 'Year 10'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.name).toBe('Liyana K.');
  });
});
