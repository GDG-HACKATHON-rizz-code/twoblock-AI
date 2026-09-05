import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { setupTestContext, TestContext } from './helpers/setup.js';
import { ContentLanguage, QuestionType, MasterySource, SessionStatus } from '@prisma/client';

describe('Phase 5 — Practice Session State Machine & Adaptive Engine', () => {
  let ctx: TestContext;
  let questionsL1: any[] = [];
  let questionsL2: any[] = [];
  let questionsL3: any[] = [];

  beforeAll(async () => {
    ctx = await setupTestContext('practice');

    // Seed ample questions across L1, L2, L3 for adaptive selection and 15-question test
    for (let i = 1; i <= 6; i++) {
      const q1 = await prisma.question.create({
        data: {
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 1,
          question_text: `Soalan L1 Nombor ${i}: Berapakah 10 + ${i}?`,
          question_type: QuestionType.mcq,
          options: { A: `${10 + i}`, B: `${11 + i}`, C: `${12 + i}`, D: `${13 + i}` },
          correct_answer: 'A',
          explanation: `10 + ${i} = ${10 + i}`,
          language: ContentLanguage.ms,
          created_by: ctx.teacherA.id,
        },
      });
      questionsL1.push(q1);

      const q2 = await prisma.question.create({
        data: {
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 2,
          question_text: `Soalan L2 Nombor ${i}: Berapakah 20 x ${i}?`,
          question_type: QuestionType.mcq,
          options: { A: `${20 * i}`, B: `${20 * i + 5}`, C: `${20 * i + 10}`, D: `${20 * i + 15}` },
          correct_answer: 'A',
          explanation: `20 x ${i} = ${20 * i}`,
          language: ContentLanguage.ms,
          created_by: ctx.teacherA.id,
        },
      });
      questionsL2.push(q2);

      const q3 = await prisma.question.create({
        data: {
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 3,
          question_text: `Soalan L3 Nombor ${i}: Selesaikan persamaan ${(i + 1) * 15} / 3.`,
          question_type: QuestionType.mcq,
          options: { A: `${((i + 1) * 15) / 3}`, B: '50', C: '60', D: '70' },
          correct_answer: 'A',
          explanation: `Jawapan tepat.`,
          language: ContentLanguage.ms,
          created_by: ctx.teacherA.id,
        },
      });
      questionsL3.push(q3);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Adaptive Question Selection by Status', () => {
    it('1. Student status=Strong (Mastery >= 85) receives difficulty Level 3', async () => {
      // Set student topic progress to Strong
      await prisma.studentTopicProgress.upsert({
        where: {
          student_id_subtopic_id: {
            student_id: ctx.student.id,
            subtopic_id: ctx.subtopicMat1_1.id,
          },
        },
        create: {
          student_id: ctx.student.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          mastery_level: 90,
          status: 'STRONG',
          mastery_source: MasterySource.calculated,
        },
        update: {
          mastery_level: 90,
          status: 'STRONG',
        },
      });

      const startRes = await request(app)
        .post('/practice/sessions')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({ subtopic_id: ctx.subtopicMat1_1.id });

      const sessionId = startRes.body.data.session_id;

      const qRes = await request(app)
        .get(`/practice/sessions/${sessionId}/next-question`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(qRes.status).toBe(200);
      expect(qRes.body.success).toBe(true);
      expect(qRes.body.data.question.difficulty_level).toBe(3);
    });

    it('2. Student status=Weak (Mastery < 60) receives difficulty Level 1', async () => {
      await prisma.studentTopicProgress.upsert({
        where: {
          student_id_subtopic_id: {
            student_id: ctx.student.id,
            subtopic_id: ctx.subtopicMat1_1.id,
          },
        },
        create: {
          student_id: ctx.student.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          mastery_level: 40,
          status: 'WEAK',
          mastery_source: MasterySource.calculated,
        },
        update: {
          mastery_level: 40,
          status: 'WEAK',
        },
      });

      const startRes = await request(app)
        .post('/practice/sessions')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({ subtopic_id: ctx.subtopicMat1_1.id });

      const sessionId = startRes.body.data.session_id;

      const qRes = await request(app)
        .get(`/practice/sessions/${sessionId}/next-question`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(qRes.status).toBe(200);
      expect(qRes.body.data.question.difficulty_level).toBe(1);
    });
  });

  describe('Termination vs Recovery Mode Counters', () => {
    it('3. Survival Round: 3 consecutive wrong answers session-level causes immediate auto-COMPLETED', async () => {
      const startRes = await request(app)
        .post('/practice/sessions')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({ subtopic_id: ctx.subtopicMat1_1.id });

      const sessionId = startRes.body.data.session_id;

      // Submit 3 wrong answers in a row
      for (let i = 0; i < 3; i++) {
        const qRes = await request(app)
          .get(`/practice/sessions/${sessionId}/next-question`)
          .set('Authorization', `Bearer ${ctx.student.token}`);

        const ansRes = await request(app)
          .post(`/practice/sessions/${sessionId}/answer`)
          .set('Authorization', `Bearer ${ctx.student.token}`)
          .send({
            question_id: qRes.body.data.question.id,
            student_answer: 'WRONG_ANSWER',
          });

        if (i === 2) {
          expect(ansRes.body.data.is_terminated).toBe(true);
          expect(ansRes.body.data.termination_reason).toBe('THREE_CONSECUTIVE_WRONG');
          expect(ansRes.body.data.session_status).toBe('COMPLETED');
        }
      }

      // Next question call should now be rejected as session ended
      const nextQ = await request(app)
        .get(`/practice/sessions/${sessionId}/next-question`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(nextQ.status).toBe(400);
      expect(nextQ.body.error.code).toBe('SESSION_ALREADY_ENDED');
    });

    it('4. Repeated mistake gap: 3 wrong on subtopic triggers LearningEvent and RECOVERY_MODE without terminating', async () => {
      // Create a separate student to test subtopic recovery isolation
      const otherStudentRes = await request(app)
        .post('/auth/register')
        .send({
          email: `student_rec_${Date.now()}@twoblock.ai`,
          password: 'Password123!',
          full_name: 'Pelajar Pemulihan',
        });
      const studentToken = otherStudentRes.body.data.token;
      const otherStudentId = otherStudentRes.body.data.user.id;

      const startRes = await request(app)
        .post('/practice/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ subtopic_id: ctx.subtopicMat1_1.id });

      const sessionId = startRes.body.data.session_id;

      // Question 1: Wrong
      let q1 = await request(app).get(`/practice/sessions/${sessionId}/next-question`).set('Authorization', `Bearer ${studentToken}`);
      await request(app).post(`/practice/sessions/${sessionId}/answer`).set('Authorization', `Bearer ${studentToken}`).send({ question_id: q1.body.data.question.id, student_answer: 'WRONG' });

      // Question 2: Wrong
      let q2 = await request(app).get(`/practice/sessions/${sessionId}/next-question`).set('Authorization', `Bearer ${studentToken}`);
      await request(app).post(`/practice/sessions/${sessionId}/answer`).set('Authorization', `Bearer ${studentToken}`).send({ question_id: q2.body.data.question.id, student_answer: 'WRONG' });

      // Question 3: Wrong -> Triggers repeated_mistake_gap and recovery mode
      let q3 = await request(app).get(`/practice/sessions/${sessionId}/next-question`).set('Authorization', `Bearer ${studentToken}`);
      const ans3 = await request(app).post(`/practice/sessions/${sessionId}/answer`).set('Authorization', `Bearer ${studentToken}`).send({ question_id: q3.body.data.question.id, student_answer: 'WRONG' });

      // Verify LearningEvent in DB
      const gapEvent = await prisma.learningEvent.findFirst({
        where: {
          student_id: otherStudentId,
          gap_type: 'repeated_mistake_gap',
        },
      });

      expect(gapEvent).toBeDefined();
      expect(ans3.body.data.in_recovery).toBe(true);
    });
  });

  describe('Dual Mastery Labels in Summary', () => {
    it('5. GET /practice/sessions/:id/summary returns both round_result cosmetic label and authoritative subtopic_progress', async () => {
      const startRes = await request(app)
        .post('/practice/sessions')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({ subtopic_id: ctx.subtopicMat1_1.id });

      const sessionId = startRes.body.data.session_id;

      // Answer 2 questions correctly
      const q1 = await request(app).get(`/practice/sessions/${sessionId}/next-question`).set('Authorization', `Bearer ${ctx.student.token}`);
      await request(app).post(`/practice/sessions/${sessionId}/answer`).set('Authorization', `Bearer ${ctx.student.token}`).send({ question_id: q1.body.data.question.id, student_answer: 'A' });

      const q2 = await request(app).get(`/practice/sessions/${sessionId}/next-question`).set('Authorization', `Bearer ${ctx.student.token}`);
      await request(app).post(`/practice/sessions/${sessionId}/answer`).set('Authorization', `Bearer ${ctx.student.token}`).send({ question_id: q2.body.data.question.id, student_answer: 'A' });

      // End session
      const endRes = await request(app)
        .post(`/practice/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(endRes.status).toBe(200);
      expect(endRes.body.success).toBe(true);

      const summary = endRes.body.data;

      // 1. Cosmetic Round Result
      expect(summary.round_result).toBeDefined();
      expect(summary.round_result.total_questions).toBe(2);
      expect(summary.round_result.correct_count).toBe(2);
      expect(summary.round_result.accuracy_percent).toBe(100);
      expect(summary.round_result.label).toBe('Strong foundation');

      // 2. Authoritative Subtopic Status
      expect(summary.subtopic_progress).toBeDefined();
      expect(summary.subtopic_progress.subtopic_id).toBe(ctx.subtopicMat1_1.id);
      expect(summary.subtopic_progress.status).toBeDefined();
      expect(summary.subtopic_progress.mastery_score).toBeGreaterThan(0);
      expect(summary.subtopic_progress.mastery_source).toBe('calculated');
    });
  });
});
