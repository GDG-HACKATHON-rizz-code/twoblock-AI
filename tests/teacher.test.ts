import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { setupTestContext, TestContext } from './helpers/setup.js';
import { healthScoreService } from '../src/services/healthScoreService.js';

describe('A10 — Teacher Endpoints & Access Control', () => {
  let ctx: TestContext;
  let testClass: any;

  beforeAll(async () => {
    ctx = await setupTestContext('teacher_api');

    // Create a class for teacherA and enrol student
    testClass = await prisma.class.create({
      data: {
        teacher_id: ctx.teacherA.id,
        name: 'Kelas 4 Bestari',
        grade_level: 4,
        academic_year: '2026',
        join_code: `BESTARI_${Date.now()}`,
      },
    });

    await prisma.classEnrolment.create({
      data: {
        class_id: testClass.id,
        student_id: ctx.student.id,
        status: 'ACTIVE',
      },
    });

    // Create a health score record for the student
    await healthScoreService.recalculateAndSave(ctx.student.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. GET /teacher/classes returns list of classes for authenticated teacher', async () => {
    const res = await request(app)
      .get('/teacher/classes')
      .set('Authorization', `Bearer ${ctx.teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].id).toBe(testClass.id);
    expect(res.body.data[0].total_students).toBe(1);
  });

  it('2. GET /teacher/classes/:id/students returns student health score data', async () => {
    const res = await request(app)
      .get(`/teacher/classes/${testClass.id}/students`)
      .set('Authorization', `Bearer ${ctx.teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.class_id).toBe(testClass.id);
    expect(res.body.data.students).toHaveLength(1);
    expect(res.body.data.students[0].student.id).toBe(ctx.student.id);
    expect(res.body.data.students[0].health_score).toBeDefined();
    expect(res.body.data.students[0].health_label).toBeDefined();
  });

  it('3. GET /teacher/classes/:id/summary returns class summary and health distribution', async () => {
    const res = await request(app)
      .get(`/teacher/classes/${testClass.id}/summary`)
      .set('Authorization', `Bearer ${ctx.teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.class_id).toBe(testClass.id);
    expect(res.body.data.total_students).toBe(1);
    expect(res.body.data.health_distribution).toBeDefined();
  });

  it('4. Rejects student attempting to access teacher endpoints (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/teacher/classes')
      .set('Authorization', `Bearer ${ctx.student.token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('5. Rejects unauthorized teacher accessing another teacher class (404 Not Found)', async () => {
    const res = await request(app)
      .get(`/teacher/classes/${testClass.id}/students`)
      .set('Authorization', `Bearer ${ctx.teacherB.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
