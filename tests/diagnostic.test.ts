import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { setupTestContext, TestContext } from './helpers/setup.js';
import { ContentLanguage, QuestionType, UserRole } from '@prisma/client';

describe('Phase 4 — Diagnostic Assessment Design & Learning Snapshot', () => {
  let ctx: TestContext;
  let qL1_1: any;
  let qL1_2: any;
  let qL2_1: any;
  let qL2_2: any;
  let qL3_1: any;

  beforeAll(async () => {
    ctx = await setupTestContext('diag');

    // Mark subtopics as foundational for subjectMat
    await prisma.subtopic.update({
      where: { id: ctx.subtopicMat1_1.id },
      data: { is_foundational: true },
    });
    await prisma.subtopic.update({
      where: { id: ctx.subtopicMat2_1.id },
      data: { is_foundational: true },
    });

    // Create 5 diagnostic questions (2x L1, 2x L2, 1x L3)
    qL1_1 = await prisma.question.create({
      data: {
        subject_id: ctx.subjectMat.id,
        topic_id: ctx.topicMat1.id,
        subtopic_id: ctx.subtopicMat1_1.id,
        difficulty_level: 1,
        question_text: 'Berapakah nilai tempat bagi digit 5 dalam nombor 45,123?',
        question_type: QuestionType.mcq,
        options: { A: 'Sa', B: 'Puluh', C: 'Ratus', D: 'Ribu' },
        correct_answer: 'D',
        explanation: 'Digit 5 berada di tempat ribu.',
        language: ContentLanguage.ms,
        is_diagnostic: true,
        created_by: ctx.teacherA.id,
      },
    });

    qL1_2 = await prisma.question.create({
      data: {
        subject_id: ctx.subjectMat.id,
        topic_id: ctx.topicMat1.id,
        subtopic_id: ctx.subtopicMat1_1.id,
        difficulty_level: 1,
        question_text: 'Tuliskan 12,005 dalam perkataan.',
        question_type: QuestionType.mcq,
        options: {
          A: 'Dua belas ribu lima',
          B: 'Dua belas ribu lima puluh',
          C: 'Satu ribu dua ratus lima',
          D: 'Dua belas ribu lima ratus',
        },
        correct_answer: 'A',
        explanation: '12,005 disebut sebagai dua belas ribu lima.',
        language: ContentLanguage.ms,
        is_diagnostic: true,
        created_by: ctx.teacherA.id,
      },
    });

    qL2_1 = await prisma.question.create({
      data: {
        subject_id: ctx.subjectMat.id,
        topic_id: ctx.topicMat1.id,
        subtopic_id: ctx.subtopicMat1_1.id,
        difficulty_level: 2,
        question_text: 'Cari hasil tambah 34,560 + 12,340.',
        question_type: QuestionType.mcq,
        options: { A: '46,800', B: '46,900', C: '47,000', D: '45,900' },
        correct_answer: 'B',
        explanation: '34,560 + 12,340 = 46,900.',
        language: ContentLanguage.ms,
        is_diagnostic: true,
        created_by: ctx.teacherA.id,
      },
    });

    qL2_2 = await prisma.question.create({
      data: {
        subject_id: ctx.subjectMat.id,
        topic_id: ctx.topicMat2.id,
        subtopic_id: ctx.subtopicMat2_1.id,
        difficulty_level: 2,
        question_text: 'Tukarkan 3/4 kepada nombor perpuluhan.',
        question_type: QuestionType.mcq,
        options: { A: '0.25', B: '0.50', C: '0.75', D: '0.80' },
        correct_answer: 'C',
        explanation: '3 dibahagi 4 ialah 0.75.',
        language: ContentLanguage.ms,
        is_diagnostic: true,
        created_by: ctx.teacherA.id,
      },
    });

    qL3_1 = await prisma.question.create({
      data: {
        subject_id: ctx.subjectMat.id,
        topic_id: ctx.topicMat2.id,
        subtopic_id: ctx.subtopicMat2_1.id,
        difficulty_level: 3,
        question_text: 'Sebuah kotak mengandungi 120 biji guli. 3/5 daripadanya berwarna biru. Berapakah bilangan guli biru?',
        question_type: QuestionType.mcq,
        options: { A: '60', B: '72', C: '80', D: '84' },
        correct_answer: 'B',
        explanation: '3/5 x 120 = 3 x 24 = 72.',
        language: ContentLanguage.ms,
        is_diagnostic: true,
        created_by: ctx.teacherA.id,
      },
    });

    // Create an untested subtopic in topicMat2 to verify inference
    await prisma.subtopic.create({
      data: {
        topic_id: ctx.topicMat2.id,
        code: 'ST02_2_UNTESTED',
        title_ms: 'Pecahan Tak Wajar dan Nombor Bercampur',
        title_en: 'Improper Fractions and Mixed Numbers',
        order_seq: 2,
        difficulty_tier: 2,
        is_foundational: false, // Untested
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Content Extension: PATCH /subtopics/:id', () => {
    it('should allow teacher to update is_foundational flag', async () => {
      const res = await request(app)
        .patch(`/subtopics/${ctx.subtopicEng1_1.id}`)
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({ is_foundational: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_foundational).toBe(true);
    });
  });

  describe('GET /students/diagnostic', () => {
    it('Guard: should return bilingual error if topic has no foundational subtopic', async () => {
      // Create a new topic in English without foundational subtopic
      const newTopic = await prisma.topic.create({
        data: {
          subject_id: ctx.subjectEng.id,
          code: 'ENG_T02',
          title_ms: 'Penulisan',
          title_en: 'Writing',
        },
      });
      await prisma.subtopic.create({
        data: {
          topic_id: newTopic.id,
          code: 'ENG_ST02_1',
          title_ms: 'Esei',
          title_en: 'Essays',
          is_foundational: false, // NO foundational
        },
      });

      const res = await request(app)
        .get(`/students/diagnostic?subject_id=${ctx.subjectEng.id}`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NO_FOUNDATIONAL_SUBTOPICS');
      expect(res.body.error.message_ms).toContain('Tiada subtopic asas');
      expect(res.body.error.message_en).toContain('No foundational subtopic');
    });

    it('should return exactly 5 questions ordered L1 -> L1 -> L2 -> L2 -> L3', async () => {
      const res = await request(app)
        .get(`/students/diagnostic?subject_id=${ctx.subjectMat.id}`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_questions).toBe(5);
      expect(res.body.data.questions.length).toBe(5);

      const difficulties = res.body.data.questions.map((q: any) => q.difficulty_level);
      expect(difficulties).toEqual([1, 1, 2, 2, 3]);
    });
  });

  describe('POST /students/diagnostic/submit & Scoring Formulas', () => {
    let activeSessionId: string;

    it('Validation: reject submit if answer count is not 5', async () => {
      const diagRes = await request(app)
        .get(`/students/diagnostic?subject_id=${ctx.subjectMat.id}`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      activeSessionId = diagRes.body.data.session_id;

      const res = await request(app)
        .post('/students/diagnostic/submit')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({
          session_id: activeSessionId,
          answers: [
            { question_id: qL1_1.id, student_answer: 'D' }, // only 1 answer
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_DIAGNOSTIC_ANSWERS_COUNT');
      expect(res.body.error.message_ms).toContain('tidak sepadan dengan 5 soalan');
    });

    it('Formula verification: calculate correct and incorrect Initial Mastery scores per Spec Section 2', async () => {
      // Answers:
      // Q1 (L1): Correct ('D') -> 60 + (1 * 10) = 70
      // Q2 (L1): Correct ('A') -> 60 + (1 * 10) = 70
      // Q3 (L2): Correct ('B') -> 60 + (2 * 10) = 80
      // Q4 (L2): Incorrect ('A', correct is 'C') -> 30 - (2 * 5) = 20
      // Q5 (L3): Incorrect ('A', correct is 'B') -> 30 - (3 * 5) = 15

      const res = await request(app)
        .post('/students/diagnostic/submit')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({
          session_id: activeSessionId,
          answers: [
            { question_id: qL1_1.id, student_answer: 'D', response_time_seconds: 15 },
            { question_id: qL1_2.id, student_answer: 'A', response_time_seconds: 20 },
            { question_id: qL2_1.id, student_answer: 'B', response_time_seconds: 30 },
            { question_id: qL2_2.id, student_answer: 'A', response_time_seconds: 40 }, // Wrong
            { question_id: qL3_1.id, student_answer: 'A', response_time_seconds: 45 }, // Wrong
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.correct_count).toBe(3);
      expect(res.body.data.diagnostic_completed).toBe(true);

      // Verify attempts in database
      const attempts = await prisma.questionAttempt.findMany({
        where: { session_id: activeSessionId },
        orderBy: { created_at: 'asc' },
      });

      expect(attempts.length).toBe(5);
      // Unit tests on attempt scores:
      // Correct L2 (Q3) -> 80
      const attemptL2Correct = attempts.find((a) => a.question_id === qL2_1.id);
      expect(attemptL2Correct?.is_correct).toBe(true);
      expect(attemptL2Correct?.score).toBe(80);

      // Incorrect L3 (Q5) -> 15
      const attemptL3Wrong = attempts.find((a) => a.question_id === qL3_1.id);
      expect(attemptL3Wrong?.is_correct).toBe(false);
      expect(attemptL3Wrong?.score).toBe(15);
    });

    it('reject submitting again if session is already completed', async () => {
      const res = await request(app)
        .post('/students/diagnostic/submit')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({
          session_id: activeSessionId,
          answers: [
            { question_id: qL1_1.id, student_answer: 'D' },
            { question_id: qL1_2.id, student_answer: 'A' },
            { question_id: qL2_1.id, student_answer: 'B' },
            { question_id: qL2_2.id, student_answer: 'C' },
            { question_id: qL3_1.id, student_answer: 'B' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DIAGNOSTIC_ALREADY_COMPLETED');
    });
  });

  describe('GET /students/snapshot', () => {
    it('should return tested and untested subtopics with inferred estimate and recommended starting point', async () => {
      const res = await request(app)
        .get('/students/snapshot')
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.diagnostic_completed).toBe(true);
      expect(res.body.data.tested_subtopics.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.untested_subtopics.length).toBeGreaterThanOrEqual(1);

      // Verify unverified_estimate flag on untested subtopic
      const untested = res.body.data.untested_subtopics[0];
      expect(untested.unverified_estimate).toBe(true);
      expect(untested.is_verified).toBe(false);

      // Recommended starting point must be from tested subtopics (lowest score: subtopicMat2_1)
      const startingPoint = res.body.data.recommended_starting_point;
      expect(startingPoint).toBeDefined();
      expect(startingPoint.is_verified).toBe(true);
      expect(startingPoint.unverified_estimate).toBe(false);
      expect(startingPoint.subtopic_id).toBe(ctx.subtopicMat2_1.id);
    });
  });
});
