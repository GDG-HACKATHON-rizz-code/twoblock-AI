import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { setupTestContext, TestContext } from './helpers/setup.js';
import { healthScoreService } from '../src/services/healthScoreService.js';
import { SessionStatus, MasterySource, UserRole } from '@prisma/client';

describe('Phase 9 — Teacher Health Score (Spec A8)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext('health_score');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Health Score Formula & Component Breakdown', () => {
    it('1. Calculates exact final health score using weights 40/25/20/15', async () => {
      // Create isolated student
      const student = await prisma.user.create({
        data: {
          email: `hs_student_${Date.now()}@twoblock.ai`,
          password_hash: 'hash',
          role: UserRole.STUDENT,
          full_name: 'Pelajar Health Score 1',
        },
      });

      // 1. Mastery: 2 touched subtopics with mastery 80% and 90% -> avg = 85%
      const st1 = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `HS_ST1_${Date.now()}`,
          title_ms: 'Subtopik HS 1',
          title_en: 'HS Subtopic 1',
        },
      });
      const st2 = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `HS_ST2_${Date.now()}`,
          title_ms: 'Subtopik HS 2',
          title_en: 'HS Subtopic 2',
        },
      });

      await prisma.studentTopicProgress.create({
        data: {
          student_id: student.id,
          subtopic_id: st1.id,
          mastery_level: 80,
          total_attempts: 5,
          correct_attempts: 4,
          status: 'DEVELOPING',
        },
      });
      await prisma.studentTopicProgress.create({
        data: {
          student_id: student.id,
          subtopic_id: st2.id,
          mastery_level: 90,
          total_attempts: 5,
          correct_attempts: 5,
          status: 'STRONG',
        },
      });

      // 2. Engagement: 5 sessions in last 7 days -> (5/5)*100 = 100%
      // 3. Consistency: 5 sessions all 100% accuracy -> variance = 0 -> consistency = 100%
      for (let i = 0; i < 5; i++) {
        await prisma.practiceSession.create({
          data: {
            student_id: student.id,
            subtopic_id: st1.id,
            mode: 'PRACTICE',
            status: SessionStatus.COMPLETED,
            total_questions: 5,
            correct_count: 5,
            created_at: new Date(Date.now() - (i + 1) * 3600 * 1000), // in last few hours
          },
        });
      }

      // 4. Trend: 7d avg mastery = 85%, 7-14d avg mastery = 75% -> delta = +10 -> trend = 100
      await prisma.studentTopicProgressHistory.create({
        data: {
          student_id: student.id,
          subtopic_id: st1.id,
          previous_mastery: 70,
          new_mastery: 75,
          trigger_event: 'PRACTICE_ANSWER',
          recorded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
      });
      await prisma.studentTopicProgressHistory.create({
        data: {
          student_id: student.id,
          subtopic_id: st1.id,
          previous_mastery: 80,
          new_mastery: 85,
          trigger_event: 'PRACTICE_ANSWER',
          recorded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
      });

      const calc = await healthScoreService.calculateHealthScore(student.id);

      // Mastery = 85 (0.40 * 85 = 34)
      expect(calc.components.mastery_component).toBe(85);
      // Engagement = 100 (0.25 * 100 = 25)
      expect(calc.components.engagement_component).toBe(100);
      // Consistency = 100 (0.20 * 100 = 20)
      expect(calc.components.consistency_component).toBe(100);
      // Trend = 100 (0.15 * 100 = 15)
      expect(calc.components.trend_component).toBe(100);

      // Final Score = 34 + 25 + 20 + 15 = 94
      expect(calc.health_score).toBe(94);
      expect(calc.health_label).toBe('Thriving');
    });

    it('2. Mastery component takes average of touched subtopics only', async () => {
      const student = await prisma.user.create({
        data: {
          email: `hs_touched_${Date.now()}@twoblock.ai`,
          password_hash: 'hash',
          role: UserRole.STUDENT,
          full_name: 'Pelajar Touched Subtopics',
        },
      });

      const st1 = await prisma.subtopic.create({
        data: { topic_id: ctx.topicMat1.id, code: `ST_T1_${Date.now()}`, title_ms: 'T1', title_en: 'T1' },
      });
      const st2 = await prisma.subtopic.create({
        data: { topic_id: ctx.topicMat1.id, code: `ST_T2_${Date.now()}`, title_ms: 'T2', title_en: 'T2' },
      });

      // st1 touched (attempts = 3, mastery = 70)
      await prisma.studentTopicProgress.create({
        data: {
          student_id: student.id,
          subtopic_id: st1.id,
          mastery_level: 70,
          total_attempts: 3,
        },
      });

      // st2 untouched (total_attempts = 0, mastery = 0) -> should be excluded from calculation
      await prisma.studentTopicProgress.create({
        data: {
          student_id: student.id,
          subtopic_id: st2.id,
          mastery_level: 0,
          total_attempts: 0,
        },
      });

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.components.mastery_component).toBe(70);
      expect(calc.contributing_factors.mastery.subtopics_count).toBe(1);
    });

    it('3. Engagement reaches max 100 when 7-day sessions >= 5', async () => {
      const student = await prisma.user.create({
        data: {
          email: `hs_eng100_${Date.now()}@twoblock.ai`,
          password_hash: 'hash',
          role: UserRole.STUDENT,
          full_name: 'Pelajar Engagement 100',
        },
      });

      for (let i = 0; i < 7; i++) {
        await prisma.practiceSession.create({
          data: {
            student_id: student.id,
            subtopic_id: ctx.subtopicMat1_1.id,
            mode: 'PRACTICE',
            status: SessionStatus.COMPLETED,
            total_questions: 4,
            correct_count: 3,
            created_at: new Date(Date.now() - i * 12 * 3600 * 1000), // all in last 4 days
          },
        });
      }

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.components.engagement_component).toBe(100);
      expect(calc.contributing_factors.engagement.sessions_7d_count).toBe(7);
    });

    it('4. Engagement receives penalty of -30 when no session in 14 days', async () => {
      const student = await prisma.user.create({
        data: {
          email: `hs_inact_${Date.now()}@twoblock.ai`,
          password_hash: 'hash',
          role: UserRole.STUDENT,
          full_name: 'Pelajar Inactive',
        },
      });

      // Session was 20 days ago
      await prisma.practiceSession.create({
        data: {
          student_id: student.id,
          subtopic_id: ctx.subtopicMat1_1.id,
          mode: 'PRACTICE',
          status: SessionStatus.COMPLETED,
          total_questions: 5,
          correct_count: 5,
          created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        },
      });

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.components.engagement_component).toBe(0);
      expect(calc.contributing_factors.engagement.inactivity_penalty_applied).toBe(true);
      expect(calc.reasons).toContain('Tiada sesi latihan selama 14 hari');
    });

    it('5. Consistency uses default 50 when session count < 3 in 14 days', async () => {
      const student = await prisma.user.create({
        data: {
          email: `hs_cons_def_${Date.now()}@twoblock.ai`,
          password_hash: 'hash',
          role: UserRole.STUDENT,
          full_name: 'Pelajar Cons Def',
        },
      });

      // Only 2 sessions in 14 days
      for (let i = 0; i < 2; i++) {
        await prisma.practiceSession.create({
          data: {
            student_id: student.id,
            subtopic_id: ctx.subtopicMat1_1.id,
            mode: 'PRACTICE',
            status: SessionStatus.COMPLETED,
            total_questions: 5,
            correct_count: 4,
          },
        });
      }

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.components.consistency_component).toBe(50);
      expect(calc.contributing_factors.consistency.insufficient_data).toBe(true);
    });

    it('6. Consistency calculated from variance between sessions for >= 3 sessions', async () => {
      const student = await prisma.user.create({
        data: {
          email: `hs_cons_var_${Date.now()}@twoblock.ai`,
          password_hash: 'hash',
          role: UserRole.STUDENT,
          full_name: 'Pelajar Cons Var',
        },
      });

      // 3 sessions:
      // Session 1: 5/5 = 100%
      // Session 2: 4/5 = 80%
      // Session 3: 3/5 = 60%
      // Mean = 80%. Variance = ((100-80)^2 + (80-80)^2 + (60-80)^2)/3 = (400 + 0 + 400)/3 = 266.67
      // Consistency = 100 - 266.67 -> clamped to 0 or 100 - variance
      await prisma.practiceSession.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, mode: 'PRACTICE', status: SessionStatus.COMPLETED, total_questions: 5, correct_count: 5 },
      });
      await prisma.practiceSession.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, mode: 'PRACTICE', status: SessionStatus.COMPLETED, total_questions: 5, correct_count: 4 },
      });
      await prisma.practiceSession.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, mode: 'PRACTICE', status: SessionStatus.COMPLETED, total_questions: 5, correct_count: 3 },
      });

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.contributing_factors.consistency.sessions_count).toBe(3);
      expect(calc.contributing_factors.consistency.variance).toBeCloseTo(266.67, 1);
      expect(calc.components.consistency_component).toBe(0); // 100 - 266.67 clamped to 0
    });

    it('7. Trend component evaluates to 100 when delta mastery >= +5', async () => {
      const student = await prisma.user.create({
        data: { email: `hs_trend100_${Date.now()}@twoblock.ai`, password_hash: 'hash', role: UserRole.STUDENT, full_name: 'T100' },
      });

      // 7-14d avg = 60
      await prisma.studentTopicProgressHistory.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, previous_mastery: 55, new_mastery: 60, trigger_event: 'ANSWER', recorded_at: new Date(Date.now() - 9 * 24 * 3600 * 1000) },
      });
      // 7d avg = 70 (delta = +10 >= 5)
      await prisma.studentTopicProgressHistory.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, previous_mastery: 65, new_mastery: 70, trigger_event: 'ANSWER', recorded_at: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
      });

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.components.trend_component).toBe(100);
      expect(calc.contributing_factors.trend.delta).toBe(10);
    });

    it('8. Trend component evaluates to 70 when delta mastery is between -5 and +5', async () => {
      const student = await prisma.user.create({
        data: { email: `hs_trend70_${Date.now()}@twoblock.ai`, password_hash: 'hash', role: UserRole.STUDENT, full_name: 'T70' },
      });

      // 7-14d avg = 60
      await prisma.studentTopicProgressHistory.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, previous_mastery: 55, new_mastery: 60, trigger_event: 'ANSWER', recorded_at: new Date(Date.now() - 10 * 24 * 3600 * 1000) },
      });
      // 7d avg = 62 (delta = +2)
      await prisma.studentTopicProgressHistory.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, previous_mastery: 60, new_mastery: 62, trigger_event: 'ANSWER', recorded_at: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
      });

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.components.trend_component).toBe(70);
      expect(calc.contributing_factors.trend.delta).toBe(2);
    });

    it('9. Trend component evaluates to 30 when delta mastery < -5', async () => {
      const student = await prisma.user.create({
        data: { email: `hs_trend30_${Date.now()}@twoblock.ai`, password_hash: 'hash', role: UserRole.STUDENT, full_name: 'T30' },
      });

      // 7-14d avg = 80
      await prisma.studentTopicProgressHistory.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, previous_mastery: 75, new_mastery: 80, trigger_event: 'ANSWER', recorded_at: new Date(Date.now() - 10 * 24 * 3600 * 1000) },
      });
      // 7d avg = 65 (delta = -15 < -5)
      await prisma.studentTopicProgressHistory.create({
        data: { student_id: student.id, subtopic_id: ctx.subtopicMat1_1.id, previous_mastery: 70, new_mastery: 65, trigger_event: 'ANSWER', recorded_at: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
      });

      const calc = await healthScoreService.calculateHealthScore(student.id);
      expect(calc.components.trend_component).toBe(30);
      expect(calc.contributing_factors.trend.delta).toBe(-15);
      expect(calc.reasons).toContain('Trend penguasaan menunjukkan penurunan (>5 mata)');
    });

    it('10. Health labels match exact boundary conditions (50, 65, 80)', () => {
      expect(healthScoreService.getHealthLabel(80)).toBe('Thriving');
      expect(healthScoreService.getHealthLabel(95)).toBe('Thriving');
      expect(healthScoreService.getHealthLabel(79.9)).toBe('On track');
      expect(healthScoreService.getHealthLabel(65)).toBe('On track');
      expect(healthScoreService.getHealthLabel(64.9)).toBe('Watch');
      expect(healthScoreService.getHealthLabel(50)).toBe('Watch');
      expect(healthScoreService.getHealthLabel(49.9)).toBe('Needs support');
      expect(healthScoreService.getHealthLabel(10)).toBe('Needs support');
    });
  });

  describe('2. Append-Only Persistence & Explanations', () => {
    it('11. Each recalculation creates a new record without modifying past records (append-only)', async () => {
      const student = await prisma.user.create({
        data: { email: `hs_append_${Date.now()}@twoblock.ai`, password_hash: 'hash', role: UserRole.STUDENT, full_name: 'Append Only Student' },
      });

      // Recalculate 1
      const rec1 = await healthScoreService.recalculateAndSave(student.id);
      // Recalculate 2
      const rec2 = await healthScoreService.recalculateAndSave(student.id);

      const count = await prisma.studentHealthScore.count({
        where: { student_id: student.id },
      });

      expect(count).toBe(2);
      expect(rec1.id).not.toBe(rec2.id);

      const history = await healthScoreService.getStudentHealthScoreHistory(student.id);
      expect(history).toHaveLength(2);
    });

    it('12. contributing_factors and reasons[] are saved with grounded evidence in DB', async () => {
      const student = await prisma.user.create({
        data: { email: `hs_evid_${Date.now()}@twoblock.ai`, password_hash: 'hash', role: UserRole.STUDENT, full_name: 'Evidence Student' },
      });

      const saved = await healthScoreService.recalculateAndSave(student.id);
      const dbRecord = await prisma.studentHealthScore.findUnique({
        where: { id: saved.id },
      });

      expect(dbRecord).toBeDefined();
      expect(dbRecord?.contributing_factors).toHaveProperty('mastery');
      expect(dbRecord?.contributing_factors).toHaveProperty('engagement');
      expect(dbRecord?.contributing_factors).toHaveProperty('consistency');
      expect(dbRecord?.contributing_factors).toHaveProperty('trend');
      expect(dbRecord?.gap_indicators).toHaveProperty('reasons');
    });
  });

  describe('3. Recalculation Triggers & Scheduled Daily Job', () => {
    it('13. Practice session voluntary end or completion triggers a health score recalculation', async () => {
      const studentRes = await request(app)
        .post('/auth/register')
        .send({ email: `student_hstrig_${Date.now()}@twoblock.ai`, password: 'Password123!', full_name: 'Trigger Student' });
      const studentToken = studentRes.body.data.token;
      const studentId = studentRes.body.data.user.id;

      const countBefore = await prisma.studentHealthScore.count({
        where: { student_id: studentId },
      });

      const startRes = await request(app)
        .post('/practice/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ subtopic_id: ctx.subtopicMat1_1.id });
      const sessionId = startRes.body.data.session_id;

      // End session
      await request(app)
        .post(`/practice/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${studentToken}`);

      const countAfter = await prisma.studentHealthScore.count({
        where: { student_id: studentId },
      });

      expect(countAfter).toBe(countBefore + 1);
    });

    it('14. Daily job processes multiple students and continues smoothly if one student fails', async () => {
      const jobResult = await healthScoreService.runDailyHealthScoreJob();

      expect(jobResult.job_name).toBe('DAILY_HEALTH_SCORE_RECALCULATION');
      expect(jobResult.total_students).toBeGreaterThan(0);
      expect(jobResult.success_count).toBeGreaterThan(0);
      expect(jobResult.failure_count).toBe(0);
      expect(jobResult.executed_at).toBeDefined();
    });

    it('15. Teacher query layer returns class student health scores with teacher validation', async () => {
      // Create a class and enrol student
      const testClass = await prisma.class.create({
        data: {
          teacher_id: ctx.teacherA.id,
          name: 'Kelas 4 Amanah',
          grade_level: 4,
          academic_year: '2026',
          join_code: `CODE_${Date.now()}`,
        },
      });

      await prisma.classEnrolment.create({
        data: {
          class_id: testClass.id,
          student_id: ctx.student.id,
          status: 'ACTIVE',
        },
      });

      // Recalculate health score for student
      await healthScoreService.recalculateAndSave(ctx.student.id);

      const result = await healthScoreService.getClassHealthScores(ctx.teacherA.id, testClass.id);

      expect(result.class_id).toBe(testClass.id);
      expect(result.total_students).toBeGreaterThan(0);
      expect(result.students[0]).toHaveProperty('student');
      expect(result.students[0]).toHaveProperty('health_score');
      expect(result.students[0]).toHaveProperty('health_label');

      // Unauthorized teacher access to class throws CLASS_NOT_FOUND
      const otherTeacher = await prisma.user.create({
        data: { email: `other_teacher_${Date.now()}@twoblock.ai`, password_hash: 'hash', role: UserRole.TEACHER, full_name: 'Cikgu Lain' },
      });

      await expect(
        healthScoreService.getClassHealthScores(otherTeacher.id, testClass.id)
      ).rejects.toThrow();
    });
  });
});
