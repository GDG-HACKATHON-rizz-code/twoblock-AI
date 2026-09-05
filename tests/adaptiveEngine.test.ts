import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adaptiveEngine } from '../src/services/adaptiveEngine.js';
import { prisma } from '../src/config/db.js';
import { setupTestContext, TestContext } from './helpers/setup.js';
import { QuestionType, ContentLanguage } from '@prisma/client';

describe('Phase 7 — Adaptive Engine Unit & Rule Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestContext('adaptive_engine');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Mastery Calculation Formula Unit Tests', () => {
    it('calculates default score for empty attempts', () => {
      const result = adaptiveEngine.calculateMasteryScore([]);
      expect(result.mastery_score).toBe(50);
      expect(result.contributing_factors.window_size).toBe(0);
      expect(result.contributing_factors.insufficient_data_for_consistency).toBe(true);
    });

    it('calculates mastery score with difficulty weights and consistency chunking for 10 attempts', () => {
      // 10 attempts: 8 correct out of 10
      // 4 x L1 (3 correct, 1 wrong)
      // 3 x L2 (2 correct, 1 wrong)
      // 3 x L3 (3 correct, 0 wrong)
      const attempts = [
        { is_correct: true, question: { difficulty_level: 1 } },
        { is_correct: true, question: { difficulty_level: 1 } },
        { is_correct: true, question: { difficulty_level: 1 } },
        { is_correct: false, question: { difficulty_level: 1 } },
        { is_correct: true, question: { difficulty_level: 2 } },
        { is_correct: true, question: { difficulty_level: 2 } },
        { is_correct: false, question: { difficulty_level: 2 } },
        { is_correct: true, question: { difficulty_level: 3 } },
        { is_correct: true, question: { difficulty_level: 3 } },
        { is_correct: true, question: { difficulty_level: 3 } },
      ];

      const result = adaptiveEngine.calculateMasteryScore(attempts);

      // recent_accuracy = (8/10) * 100 = 80%
      expect(result.contributing_factors.recent_accuracy).toBe(80);

      // difficulty_weighted_accuracy:
      // totalPossibleWeight = 4*1.0 + 3*1.3 + 3*1.6 = 4.0 + 3.9 + 4.8 = 12.7
      // totalWeightedScore = 3*1.0 + 2*1.3 + 3*1.6 = 3.0 + 2.6 + 4.8 = 10.4
      // weighted_acc = (10.4 / 12.7) * 100 = 81.89%
      expect(result.contributing_factors.difficulty_weighted_accuracy).toBeCloseTo(81.89, 1);

      // consistency_score:
      // Chunk 1: [T, T, T] -> 100%
      // Chunk 2: [F, T, T] -> 66.67%
      // Chunk 3: [F, T, T] -> 66.67%
      // consistency ~ 90.12
      expect(result.contributing_factors.consistency_score).toBeCloseTo(90.12, 1);

      // Final Mastery: 0.6 * 80 + 0.25 * 81.89 + 0.15 * 90.12 = 81.99 -> 82
      expect(result.mastery_score).toBe(82);
    });

    it('handles less than 3 attempts with default consistency score of 50', () => {
      const attempts = [
        { is_correct: true, question: { difficulty_level: 2 } },
        { is_correct: true, question: { difficulty_level: 2 } },
      ];

      const result = adaptiveEngine.calculateMasteryScore(attempts);
      expect(result.contributing_factors.window_size).toBe(2);
      expect(result.contributing_factors.recent_accuracy).toBe(100);
      expect(result.contributing_factors.consistency_score).toBe(50);
      expect(result.contributing_factors.insufficient_data_for_consistency).toBe(true);
      // 0.6 * 100 + 0.25 * 100 + 0.15 * 50 = 60 + 25 + 7.5 = 92.5 -> 93
      expect(result.mastery_score).toBe(93);
    });
  });

  describe('2. Adaptive Difficulty Rules (Minimum 5 Attempts & ±1 Change)', () => {
    it('does NOT change difficulty if total attempts < 5', () => {
      const decision1 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 1,
        recentAccuracy: 100,
        totalAttempts: 4,
      });
      expect(decision1.nextDifficulty).toBe(1);
      expect(decision1.reason).toBe('LESS_THAN_MIN_ATTEMPTS_MAINTAIN_LEVEL');

      const decision2 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 2,
        recentAccuracy: 20,
        totalAttempts: 3,
      });
      expect(decision2.nextDifficulty).toBe(2);
      expect(decision2.reason).toBe('LESS_THAN_MIN_ATTEMPTS_MAINTAIN_LEVEL');
    });

    it('increases difficulty by +1 (max Level 3) when accuracy >= 85% after >= 5 attempts', () => {
      const decision1 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 1,
        recentAccuracy: 90,
        totalAttempts: 5,
      });
      expect(decision1.nextDifficulty).toBe(2);
      expect(decision1.status).toBe('STRONG');

      const decision2 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 2,
        recentAccuracy: 85,
        totalAttempts: 8,
      });
      expect(decision2.nextDifficulty).toBe(3);
      expect(decision2.status).toBe('STRONG');

      // Cap at Level 3
      const decision3 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 3,
        recentAccuracy: 95,
        totalAttempts: 10,
      });
      expect(decision3.nextDifficulty).toBe(3);
      expect(decision3.status).toBe('STRONG');
    });

    it('maintains difficulty level when accuracy is between 60% and 84% (Developing)', () => {
      const decision1 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 2,
        recentAccuracy: 75,
        totalAttempts: 6,
      });
      expect(decision1.nextDifficulty).toBe(2);
      expect(decision1.status).toBe('DEVELOPING');

      const decision2 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 1,
        recentAccuracy: 60,
        totalAttempts: 5,
      });
      expect(decision2.nextDifficulty).toBe(1);
      expect(decision2.status).toBe('DEVELOPING');
    });

    it('decreases difficulty by -1 (min Level 1) when accuracy < 60% after >= 5 attempts', () => {
      const decision1 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 3,
        recentAccuracy: 50,
        totalAttempts: 5,
      });
      expect(decision1.nextDifficulty).toBe(2);
      expect(decision1.status).toBe('WEAK');

      const decision2 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 2,
        recentAccuracy: 40,
        totalAttempts: 7,
      });
      expect(decision2.nextDifficulty).toBe(1);
      expect(decision2.status).toBe('WEAK');

      // Floor at Level 1
      const decision3 = adaptiveEngine.determineNextDifficulty({
        currentDifficulty: 1,
        recentAccuracy: 20,
        totalAttempts: 10,
      });
      expect(decision3.nextDifficulty).toBe(1);
      expect(decision3.status).toBe('WEAK');
    });
  });

  describe('3. Repeated Mistake Trigger & Recovery Sequence Evaluation', () => {
    it('triggers repeated_mistake_gap when consecutive wrong answers reach 3', () => {
      const eval1 = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 0,
        isCorrect: false,
        inRecovery: false,
        recoveryStep: null,
      });
      expect(eval1.consecutiveWrong).toBe(1);
      expect(eval1.triggerRecovery).toBe(false);

      const eval2 = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 1,
        isCorrect: false,
        inRecovery: false,
        recoveryStep: null,
      });
      expect(eval2.consecutiveWrong).toBe(2);
      expect(eval2.triggerRecovery).toBe(false);

      const eval3 = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 2,
        isCorrect: false,
        inRecovery: false,
        recoveryStep: null,
      });
      expect(eval3.consecutiveWrong).toBe(3);
      expect(eval3.triggerRecovery).toBe(true);
      expect(eval3.inRecovery).toBe(true);
      expect(eval3.recoveryStep).toBe(1);
    });

    it('resets consecutive wrong count to 0 upon correct answer', () => {
      const evalResult = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 2,
        isCorrect: true,
        inRecovery: false,
        recoveryStep: null,
      });
      expect(evalResult.consecutiveWrong).toBe(0);
      expect(evalResult.triggerRecovery).toBe(false);
      expect(evalResult.inRecovery).toBe(false);
    });

    it('advances through 4-step recovery and resolves gap at Step 4 if correct', () => {
      // Step 1 -> Step 2
      const step1 = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 0,
        isCorrect: true,
        inRecovery: true,
        recoveryStep: 1,
      });
      expect(step1.inRecovery).toBe(true);
      expect(step1.recoveryStep).toBe(2);
      expect(step1.gapResolved).toBe(false);

      // Step 2 -> Step 3
      const step2 = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 0,
        isCorrect: true,
        inRecovery: true,
        recoveryStep: 2,
      });
      expect(step2.inRecovery).toBe(true);
      expect(step2.recoveryStep).toBe(3);

      // Step 3 -> Step 4
      const step3 = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 0,
        isCorrect: true,
        inRecovery: true,
        recoveryStep: 3,
      });
      expect(step3.inRecovery).toBe(true);
      expect(step3.recoveryStep).toBe(4);

      // Step 4 (Reassessment) Correct -> Gap Resolved!
      const step4 = adaptiveEngine.evaluateRepeatedMistake({
        previousConsecutiveWrong: 0,
        isCorrect: true,
        inRecovery: true,
        recoveryStep: 4,
      });
      expect(step4.gapResolved).toBe(true);
      expect(step4.inRecovery).toBe(false);
      expect(step4.recoveryStep).toBeNull();
    });
  });

  describe('4. Mastery Gate Logic', () => {
    it('passes mastery gate when score >= 80, status is not WEAK, and no active gap', () => {
      const check1 = adaptiveEngine.checkMasteryGate({
        masteryScore: 82,
        status: 'STRONG',
        hasActiveGap: false,
      });
      expect(check1.passed).toBe(true);

      const check2 = adaptiveEngine.checkMasteryGate({
        masteryScore: 80,
        status: 'DEVELOPING',
        hasActiveGap: false,
      });
      expect(check2.passed).toBe(true);
    });

    it('fails mastery gate if score < 80', () => {
      const check = adaptiveEngine.checkMasteryGate({
        masteryScore: 78,
        status: 'DEVELOPING',
        hasActiveGap: false,
      });
      expect(check.passed).toBe(false);
      expect(check.reason).toBe('MASTERY_SCORE_BELOW_80');
    });

    it('fails mastery gate if status is WEAK even if score is high', () => {
      const check = adaptiveEngine.checkMasteryGate({
        masteryScore: 85,
        status: 'WEAK',
        hasActiveGap: false,
      });
      expect(check.passed).toBe(false);
      expect(check.reason).toBe('STATUS_IS_WEAK');
    });

    it('fails mastery gate if active gap is present', () => {
      const check = adaptiveEngine.checkMasteryGate({
        masteryScore: 90,
        status: 'STRONG',
        hasActiveGap: true,
      });
      expect(check.passed).toBe(false);
      expect(check.reason).toBe('ACTIVE_GAP_PRESENT');
    });
  });

  describe('5. Adaptive Question Selection & Nearest Level Fallback', () => {
    it('falls back to nearest difficulty if target level question is not present', async () => {
      // Create a isolated subtopic with only Level 1 and Level 2 questions (no Level 3)
      const subtopic = await prisma.subtopic.create({
        data: {
          topic_id: ctx.topicMat1.id,
          code: `FALLBACK_TEST_${Date.now()}`,
          title_ms: 'Subtopik Fallback',
          title_en: 'Fallback Subtopic',
        },
      });

      const qL1 = await prisma.question.create({
        data: {
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: subtopic.id,
          difficulty_level: 1,
          question_text: 'Soalan Fallback L1',
          question_type: QuestionType.mcq,
          options: { A: '1', B: '2' },
          correct_answer: 'A',
          explanation: 'L1',
          language: ContentLanguage.ms,
          created_by: ctx.teacherA.id,
        },
      });

      const qL2 = await prisma.question.create({
        data: {
          subject_id: ctx.subjectMat.id,
          topic_id: ctx.topicMat1.id,
          subtopic_id: subtopic.id,
          difficulty_level: 2,
          question_text: 'Soalan Fallback L2',
          question_type: QuestionType.mcq,
          options: { A: '10', B: '20' },
          correct_answer: 'A',
          explanation: 'L2',
          language: ContentLanguage.ms,
          created_by: ctx.teacherA.id,
        },
      });

      // Request Level 3 question (which does not exist) -> should fallback to Level 2 (nearest)
      const chosen = await adaptiveEngine.selectAdaptiveQuestion(subtopic.id, 3, []);
      expect(chosen).toBeDefined();
      expect(chosen?.difficulty_level).toBe(2);
      expect(chosen?.id).toBe(qL2.id);

      // If Level 2 is excluded, should fallback to Level 1
      const chosenL1 = await adaptiveEngine.selectAdaptiveQuestion(subtopic.id, 3, [qL2.id]);
      expect(chosenL1).toBeDefined();
      expect(chosenL1?.difficulty_level).toBe(1);
      expect(chosenL1?.id).toBe(qL1.id);
    });
  });
});
