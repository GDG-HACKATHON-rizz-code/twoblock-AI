import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { setupTestContext, TestContext } from './helpers/setup.js';

describe('Phase 3 — Content Management, Spec Section 4 Validations & Ownership', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext('content');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Read Endpoints', () => {
    it('GET /subjects should return list of active subjects with hierarchy', async () => {
      const res = await request(app)
        .get('/subjects')
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0]).toHaveProperty('topics');
    });

    it('GET /subjects/:id/topics should return topics for the subject', async () => {
      const res = await request(app)
        .get(`/subjects/${ctx.subjectMat.id}/topics`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0]).toHaveProperty('subtopics');
    });

    it('GET /topics/:id/subtopics should return subtopics for the topic', async () => {
      const res = await request(app)
        .get(`/topics/${ctx.topicMat1.id}/subtopics`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].code).toBe(ctx.subtopicMat1_1.code);
    });
  });

  describe('Spec Section 4 Question Validation Rules', () => {
    it('1. MCQ without 4 options should be rejected with bilingual INVALID_OPTIONS_COUNT', async () => {
      const res = await request(app)
        .post('/questions')
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 1,
          question_text: 'Berapakah 2 + 2?',
          question_type: 'mcq',
          options: { A: '1', B: '2', C: '4' }, // Only 3 options
          correct_answer: 'C',
          explanation: '2 tambah 2 bersamaan dengan 4.',
          language: 'ms',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_OPTIONS_COUNT');
      expect(res.body.error.message_ms).toContain('tepat 4 pilihan');
      expect(res.body.error.message_en).toContain('exactly 4');
    });

    it('2. correct_answer not matching options should be rejected with bilingual CORRECT_ANSWER_MISMATCH', async () => {
      const res = await request(app)
        .post('/questions')
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 1,
          question_text: 'Berapakah 5 x 5?',
          question_type: 'mcq',
          options: { A: '10', B: '20', C: '25', D: '30' },
          correct_answer: 'E', // Not in options
          explanation: '5 didarab 5 menghasilkan 25.',
          language: 'ms',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CORRECT_ANSWER_MISMATCH');
      expect(res.body.error.message_ms).toContain('sepadan dengan salah satu');
      expect(res.body.error.message_en).toContain('match one of the');
    });

    it('3. Mathematics question with language=en should be rejected with bilingual LANGUAGE_MISMATCH', async () => {
      const res = await request(app)
        .post('/questions')
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 1,
          question_text: 'What is 10 + 10?',
          question_type: 'mcq',
          options: { A: '10', B: '20', C: '30', D: '40' },
          correct_answer: 'B',
          explanation: '10 plus 10 equals 20.',
          language: 'en', // Matematik is BM-only for MVP
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('LANGUAGE_MISMATCH');
      expect(res.body.error.message_ms).toContain('Bahasa Melayu');
      expect(res.body.error.message_en).toContain('Bahasa Melayu');
    });

    it('4. Subtopic not belonging to specified topic should be rejected with SUBTOPIC_TOPIC_MISMATCH', async () => {
      const res = await request(app)
        .post('/questions')
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat2_1.id, // Belongs to topicMat2, not topicMat1
          difficulty_level: 1,
          question_text: 'Apakah pecahan wajar?',
          question_type: 'mcq',
          options: { A: '1/2', B: '3/2', C: '5/2', D: '7/2' },
          correct_answer: 'A',
          explanation: 'Pecahan wajar mempunyai pengangka lebih kecil daripada penyebut.',
          language: 'ms',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SUBTOPIC_TOPIC_MISMATCH');
      expect(res.body.error.message_ms).toContain('tidak tergolong dalam topik');
      expect(res.body.error.message_en).toContain('does not belong to the specified topic');
    });
  });

  describe('Role-Based Access Control & Ownership Rules', () => {
    let questionTeacherAId: string;
    let questionTeacherBId: string;

    it('5. Student role POST /questions should return 403 Forbidden with bilingual error', async () => {
      const res = await request(app)
        .post('/questions')
        .set('Authorization', `Bearer ${ctx.student.token}`)
        .send({
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 1,
          question_text: 'Soalan cubaan pelajar?',
          question_type: 'mcq',
          options: { A: '1', B: '2', C: '3', D: '4' },
          correct_answer: 'A',
          explanation: 'Penerangan ringkas.',
          language: 'ms',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      expect(res.body.error.message_ms).toContain('tidak dibenarkan');
      expect(res.body.error.message_en).toContain('not authorized');
    });

    it('Teacher A creates question successfully with created_by tracked', async () => {
      const res = await request(app)
        .post('/questions')
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 1,
          question_text: 'Bundarkan 45,678 kepada ribu terdekat.',
          question_type: 'mcq',
          options: { A: '45,000', B: '46,000', C: '45,600', D: '50,000' },
          correct_answer: 'B',
          explanation: 'Digit ratus ialah 6 (>=5), jadi tambah 1 pada digit ribu (5 -> 6).',
          language: 'ms',
          is_diagnostic: false,
          grade_level: 4,
          estimated_time_seconds: 45,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.created_by).toBe(ctx.teacherA.id);
      questionTeacherAId = res.body.data.id;
    });

    it('Teacher B creates question successfully', async () => {
      const res = await request(app)
        .post('/questions')
        .set('Authorization', `Bearer ${ctx.teacherB.token}`)
        .send({
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          difficulty_level: 2,
          question_text: 'Cari hasil darab 245 x 12.',
          question_type: 'mcq',
          options: { A: '2,940', B: '2,840', C: '3,000', D: '2,900' },
          correct_answer: 'A',
          explanation: '245 x 12 = 2940.',
          language: 'ms',
        });

      expect(res.status).toBe(201);
      questionTeacherBId = res.body.data.id;
    });

    it('6. Teacher A attempting to PATCH Teacher B question should return 403 FORBIDDEN_OWNERSHIP', async () => {
      const res = await request(app)
        .patch(`/questions/${questionTeacherBId}`)
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({
          question_text: 'Cubaan ubah soalan cikgu B!',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
      expect(res.body.error.message_ms).toContain('hanya boleh mengedit atau memadam soalan ciptaan anda sendiri');
      expect(res.body.error.message_en).toContain('only edit or delete your own questions');
    });

    it('7. Teacher A successfully PATCHes their own question', async () => {
      const res = await request(app)
        .patch(`/questions/${questionTeacherAId}`)
        .set('Authorization', `Bearer ${ctx.teacherA.token}`)
        .send({
          question_text: 'Bundarkan 45,678 kepada ribu terdekat (Dikemaskini).',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question_text).toBe('Bundarkan 45,678 kepada ribu terdekat (Dikemaskini).');
    });

    it('8. Admin successfully PATCHes any teacher question (bypassing ownership)', async () => {
      const res = await request(app)
        .patch(`/questions/${questionTeacherAId}`)
        .set('Authorization', `Bearer ${ctx.admin.token}`)
        .send({
          difficulty_level: 2,
          question_text: 'Bundarkan 45,678 kepada ribu terdekat (Admin Verified).',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.difficulty_level).toBe(2);
      expect(res.body.data.question_text).toContain('Admin Verified');
    });

    it('9. DELETE /questions/:id performs soft delete (is_active=false, row persists)', async () => {
      const res = await request(app)
        .delete(`/questions/${questionTeacherAId}`)
        .set('Authorization', `Bearer ${ctx.teacherA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_active).toBe(false);

      // Verify row still exists in database
      const rowInDb = await prisma.question.findUnique({
        where: { id: questionTeacherAId },
      });
      expect(rowInDb).not.toBeNull();
      expect(rowInDb?.is_active).toBe(false);
    });

    it('10. Integration: GET /questions with query filters returns matching records only', async () => {
      const res = await request(app)
        .get(`/questions?subtopic_id=${ctx.subtopicMat1_1.id}&difficulty_level=2&is_active=true`)
        .set('Authorization', `Bearer ${ctx.student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(questionTeacherBId);
      expect(res.body.data[0].difficulty_level).toBe(2);
    });
  });
});
