import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { setupTestContext, TestContext } from './helpers/setup.js';
import { learningGapService } from '../src/services/learningGapService.js';
import { adaptiveEngine } from '../src/services/adaptiveEngine.js';
import { GapType, QuestionType, ContentLanguage, SessionStatus, MasterySource } from '@prisma/client';

describe('Phase 8 — Learning Gap Detection (Spec A3)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext('learning_gaps');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Repeated Mistake Gap (Immediate)', () => {
    it('1. Detects repeated_mistake_gap when consecutive wrong answers on same subtopic reach 3', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `RM_GAP_${Date.now()}`,
          title_ms: 'Subtopik Repeated Mistake',
          title_en: 'Repeated Mistake Subtopic',
        },
      });

      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 45,
        consecutiveWrong: 3,
        inRecovery: true,
        recoveryStep: 1,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).toContain(GapType.repeated_mistake_gap);
      expect(result.activeGaps).toContain(GapType.repeated_mistake_gap);
      expect(result.adjustedStatus).toBe('WEAK');

      // Verify LearningEvent in DB
      const event = await prisma.learningEvent.findFirst({
        where: {
          student_id: ctx.student.id,
          gap_type: GapType.repeated_mistake_gap,
          event_type: 'GAP_DETECTED',
        },
      });

      expect(event).toBeDefined();
      const eventData = event?.event_data as Record<string, any>;
      expect(eventData.severity).toBe('Immediate');
      expect(eventData.consecutive_wrong).toBe(3);
    });

    it('2. Resets consecutive wrong count upon correct answer and resolves gap at Step 4', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `RM_RESET_${Date.now()}`,
          title_ms: 'Subtopik Reset RM',
          title_en: 'Reset RM Subtopic',
        },
      });

      const recoveryEval = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 2,
        isCorrect: true,
        inRecovery: false,
        recoveryStep: null,
      });

      expect(recoveryEval.consecutiveWrong).toBe(0);
      expect(recoveryEval.triggerRecovery).toBe(false);

      // Resolve at Step 4
      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 80,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: true,
        existingActiveGaps: [GapType.repeated_mistake_gap],
      });

      expect(result.resolvedGaps).toContain(GapType.repeated_mistake_gap);
      expect(result.activeGaps).not.toContain(GapType.repeated_mistake_gap);
      expect(result.adjustedStatus).toBe('DEVELOPING');

      // Verify GAP_RESOLVED LearningEvent in DB
      const resolveEvent = await prisma.learningEvent.findFirst({
        where: {
          student_id: ctx.student.id,
          gap_type: GapType.repeated_mistake_gap,
          event_type: 'GAP_RESOLVED',
        },
      });

      expect(resolveEvent).toBeDefined();
    });

    it('3. Does NOT create duplicate repeated_mistake_gap event if gap is already active', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `RM_NODUP_${Date.now()}`,
          title_ms: 'Subtopik No Dup RM',
          title_en: 'No Dup RM Subtopic',
        },
      });

      const eventsBefore = await prisma.learningEvent.count({
        where: {
          student_id: ctx.student.id,
          gap_type: GapType.repeated_mistake_gap,
          event_type: 'GAP_DETECTED',
        },
      });

      // Run with existing active gap
      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 40,
        consecutiveWrong: 4,
        inRecovery: true,
        recoveryStep: 2,
        gapResolved: false,
        existingActiveGaps: [GapType.repeated_mistake_gap],
      });

      expect(result.detectedGaps).not.toContain(GapType.repeated_mistake_gap);
      expect(result.activeGaps).toContain(GapType.repeated_mistake_gap);

      const eventsAfter = await prisma.learningEvent.count({
        where: {
          student_id: ctx.student.id,
          gap_type: GapType.repeated_mistake_gap,
          event_type: 'GAP_DETECTED',
        },
      });

      expect(eventsAfter).toBe(eventsBefore);
    });
  });

  describe('2. Mastery Decline Gap (Medium)', () => {
    it('4. Detects mastery_decline_gap when score drops > 10 points within 7 days and current mastery < 70%', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `DECLINE_GAP_${Date.now()}`,
          title_ms: 'Subtopik Decline Gap',
          title_en: 'Decline Gap Subtopic',
        },
      });

      // Insert snapshot from 2 days ago with mastery 80%
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await prisma.studentTopicProgressHistory.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          previous_mastery: 75,
          new_mastery: 80,
          trigger_event: 'PRACTICE_ANSWER',
          recorded_at: twoDaysAgo,
        },
      });

      // Current mastery drops to 65% (drop of 15 points > 10, current 65% < 70%)
      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 65,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).toContain(GapType.mastery_decline_gap);
      expect(result.activeGaps).toContain(GapType.mastery_decline_gap);
      expect(result.adjustedStatus).toBe('WEAK');

      const event = await prisma.learningEvent.findFirst({
        where: {
          student_id: ctx.student.id,
          gap_type: GapType.mastery_decline_gap,
          event_type: 'GAP_DETECTED',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(event).toBeDefined();
      const eventData = event?.event_data as Record<string, any>;
      expect(eventData.severity).toBe('Medium');
      expect(eventData.point_drop).toBe(15);
      expect(eventData.current_mastery).toBe(65);
      expect(eventData.reference_mastery).toBe(80);
    });

    it('5. Does NOT trigger mastery_decline_gap if score drop is exactly 10 points or less', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `DECLINE_LE10_${Date.now()}`,
          title_ms: 'Subtopik Decline <= 10',
          title_en: 'Decline <= 10 Subtopic',
        },
      });

      // 3 days ago: mastery was 75%
      await prisma.studentTopicProgressHistory.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          previous_mastery: 70,
          new_mastery: 75,
          trigger_event: 'PRACTICE_ANSWER',
          recorded_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      });

      // Current mastery is 65% (drop of exactly 10 points)
      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 65,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).not.toContain(GapType.mastery_decline_gap);
      expect(result.activeGaps).not.toContain(GapType.mastery_decline_gap);
    });

    it('6. Does NOT trigger mastery_decline_gap if current mastery is >= 70%', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `DECLINE_GTE70_${Date.now()}`,
          title_ms: 'Subtopik Decline >= 70',
          title_en: 'Decline >= 70 Subtopic',
        },
      });

      // 2 days ago: mastery was 95%
      await prisma.studentTopicProgressHistory.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          previous_mastery: 90,
          new_mastery: 95,
          trigger_event: 'PRACTICE_ANSWER',
          recorded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      });

      // Current mastery is 75% (drop of 20 points, but current mastery is 75% >= 70%)
      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 75,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).not.toContain(GapType.mastery_decline_gap);
      expect(result.activeGaps).not.toContain(GapType.mastery_decline_gap);
    });

    it('7. Does NOT trigger mastery_decline_gap if no history within 7 days', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `DECLINE_NOHIST_${Date.now()}`,
          title_ms: 'Subtopik No Hist',
          title_en: 'No Hist Subtopic',
        },
      });

      // History was 10 days ago (> 7 days)
      await prisma.studentTopicProgressHistory.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          previous_mastery: 85,
          new_mastery: 90,
          trigger_event: 'PRACTICE_ANSWER',
          recorded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      });

      // Current mastery is 55%
      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 55,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).not.toContain(GapType.mastery_decline_gap);
    });
  });

  describe('3. Persistent Weak Gap (High)', () => {
    it('8. Detects persistent_weak_gap when mastery < 60% across 3 distinct practice sessions', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `PW_GAP_${Date.now()}`,
          title_ms: 'Subtopik Persistent Weak',
          title_en: 'Persistent Weak Subtopic',
        },
      });

      // Create 3 distinct sessions with low accuracy (< 60%)
      for (let i = 1; i <= 3; i++) {
        await prisma.practiceSession.create({
          data: {
            student_id: ctx.student.id,
            subtopic_id: subtopic.id,
            mode: 'PRACTICE',
            status: SessionStatus.COMPLETED,
            total_questions: 5,
            correct_count: 1, // 20% accuracy
          },
        });
      }

      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 45,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).toContain(GapType.persistent_weak_gap);
      expect(result.activeGaps).toContain(GapType.persistent_weak_gap);
      expect(result.adjustedStatus).toBe('WEAK');

      const event = await prisma.learningEvent.findFirst({
        where: {
          student_id: ctx.student.id,
          gap_type: GapType.persistent_weak_gap,
          event_type: 'GAP_DETECTED',
        },
      });

      expect(event).toBeDefined();
      const eventData = event?.event_data as Record<string, any>;
      expect(eventData.severity).toBe('High');
      expect(eventData.session_ids).toHaveLength(3);
    });

    it('9. Does NOT trigger persistent_weak_gap if only 3 answers in 1 session (requires 3 distinct sessions)', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `PW_1SESS_${Date.now()}`,
          title_ms: 'Subtopik 1 Session Only',
          title_en: '1 Session Only Subtopic',
        },
      });

      // Only 1 session with 3 answers
      await prisma.practiceSession.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          mode: 'PRACTICE',
          status: SessionStatus.IN_PROGRESS,
          total_questions: 3,
          correct_count: 0,
        },
      });

      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 35,
        consecutiveWrong: 3,
        inRecovery: true,
        recoveryStep: 1,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).not.toContain(GapType.persistent_weak_gap);
    });

    it('10. Does NOT trigger persistent_weak_gap if any of the 3 sessions had mastery >= 60%', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `PW_ONESTRONG_${Date.now()}`,
          title_ms: 'Subtopik 1 Strong Sess',
          title_en: '1 Strong Sess Subtopic',
        },
      });

      // Session 1: Low (20%)
      await prisma.practiceSession.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          mode: 'PRACTICE',
          status: SessionStatus.COMPLETED,
          total_questions: 5,
          correct_count: 1,
        },
      });

      // Session 2: High (80%)
      await prisma.practiceSession.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          mode: 'PRACTICE',
          status: SessionStatus.COMPLETED,
          total_questions: 5,
          correct_count: 4,
        },
      });

      // Session 3: Low (40%)
      await prisma.practiceSession.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          mode: 'PRACTICE',
          status: SessionStatus.COMPLETED,
          total_questions: 5,
          correct_count: 2,
        },
      });

      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 50,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.detectedGaps).not.toContain(GapType.persistent_weak_gap);
    });
  });

  describe('4. Integrated Subtopic Status Resolution (Spec A3)', () => {
    it('11. Subtopic with active gap has status Weak regardless of mastery score', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `STATUS_ACTIVEGAP_${Date.now()}`,
          title_ms: 'Subtopik Active Gap',
          title_en: 'Active Gap Subtopic',
        },
      });

      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 88, // Even with 88%
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [GapType.mastery_decline_gap], // Active gap present
      });

      expect(result.adjustedStatus).toBe('WEAK');
    });

    it('12. Subtopic with NO active gap and mastery >= 85% has status Strong', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `STATUS_STRONG_${Date.now()}`,
          title_ms: 'Subtopik Strong No Gap',
          title_en: 'Strong No Gap Subtopic',
        },
      });

      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 86,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.activeGaps).toHaveLength(0);
      expect(result.adjustedStatus).toBe('STRONG');
    });

    it('13. Subtopic with NO active gap and mastery 60-84% has status Developing', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `STATUS_DEV_${Date.now()}`,
          title_ms: 'Subtopik Dev No Gap',
          title_en: 'Dev No Gap Subtopic',
        },
      });

      const result = await learningGapService.evaluateAllGaps({
        studentId: ctx.student.id,
        subtopicId: subtopic.id,
        currentMastery: 72,
        consecutiveWrong: 0,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
        existingActiveGaps: [],
      });

      expect(result.activeGaps).toHaveLength(0);
      expect(result.adjustedStatus).toBe('DEVELOPING');
    });

    it('14. Query student learning gaps via getStudentLearningGaps', async () => {
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `GET_GAPS_${Date.now()}`,
          title_ms: 'Subtopik Query Gaps',
          title_en: 'Query Gaps Subtopic',
        },
      });

      await prisma.studentTopicProgress.create({
        data: {
          student_id: ctx.student.id,
          subtopic_id: subtopic.id,
          mastery_level: 50,
          mastery_source: MasterySource.calculated,
          status: 'WEAK',
          contributing_factors: {
            active_gaps: [GapType.repeated_mistake_gap],
          },
        },
      });

      const gaps = await learningGapService.getStudentLearningGaps(ctx.student.id, subtopic.id);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].subtopic_id).toBe(subtopic.id);
      expect(gaps[0].active_gaps).toContain(GapType.repeated_mistake_gap);
      expect(gaps[0].status).toBe('WEAK');
    });
  });
});
