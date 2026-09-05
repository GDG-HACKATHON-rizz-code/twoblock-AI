import { MasterySource, SessionStatus, GapType, QuestionType } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { learningGapService } from './learningGapService.js';

export interface AttemptItem {
  is_correct: boolean;
  question: {
    difficulty_level: number;
  };
}

export interface MasteryCalculationResult {
  mastery_score: number;
  contributing_factors: {
    recent_accuracy: number;
    difficulty_weighted_accuracy: number;
    consistency_score: number;
    window_size: number;
    insufficient_data_for_consistency?: boolean;
    computed_at: string;
  };
}

export interface DifficultyDecision {
  nextDifficulty: number;
  status: 'STRONG' | 'DEVELOPING' | 'WEAK';
  reason: string;
}

export interface RepeatedMistakeEvaluation {
  consecutiveWrong: number;
  triggerRecovery: boolean;
  inRecovery: boolean;
  recoveryStep: number | null;
  gapResolved: boolean;
}

export interface MasteryGateCheck {
  passed: boolean;
  reason?: string;
}

export class AdaptiveEngine {
  /**
   * Mastery Calculation Formula (Spec Section 2 / Part A1):
   * mastery_score = (0.6 * recent_accuracy) + (0.25 * difficulty_weighted_accuracy) + (0.15 * consistency_score)
   *
   * @param recentAttempts Up to 10 most recent attempts on the subtopic in chronological order
   */
  calculateMasteryScore(recentAttempts: AttemptItem[]): MasteryCalculationResult {
    const windowSize = recentAttempts.length;
    if (windowSize === 0) {
      return {
        mastery_score: 50,
        contributing_factors: {
          recent_accuracy: 50,
          difficulty_weighted_accuracy: 50,
          consistency_score: 50,
          window_size: 0,
          insufficient_data_for_consistency: true,
          computed_at: new Date().toISOString(),
        },
      };
    }

    // 1. recent_accuracy (% correct out of recent attempts up to 10)
    const correctCount = recentAttempts.filter((a) => a.is_correct).length;
    const recent_accuracy = (correctCount / windowSize) * 100;

    // 2. difficulty_weighted_accuracy (Level 1=1.0x, Level 2=1.3x, Level 3=1.6x)
    const weights: Record<number, number> = { 1: 1.0, 2: 1.3, 3: 1.6 };
    let totalWeightedScore = 0;
    let totalPossibleWeight = 0;

    for (const att of recentAttempts) {
      const w = weights[att.question.difficulty_level] || 1.0;
      totalPossibleWeight += w;
      if (att.is_correct) {
        totalWeightedScore += w;
      }
    }

    const difficulty_weighted_accuracy =
      totalPossibleWeight > 0 ? (totalWeightedScore / totalPossibleWeight) * 100 : 0;

    // 3. consistency_score (100 - normalized variance across groups of 3 consecutive attempts)
    let consistency_score = 50;
    let insufficientData = false;

    if (windowSize < 3) {
      consistency_score = 50;
      insufficientData = true;
    } else {
      // Group attempts in sequential chunks of 3
      const chunkScores: number[] = [];
      for (let i = 0; i + 3 <= windowSize; i += 3) {
        const chunk = recentAttempts.slice(i, i + 3);
        const chunkCorrect = chunk.filter((c) => c.is_correct).length;
        chunkScores.push((chunkCorrect / 3) * 100);
      }

      if (chunkScores.length === 0) {
        consistency_score = 50;
        insufficientData = true;
      } else if (chunkScores.length === 1) {
        // 1 chunk of 3 attempts: 0 variance across chunks
        consistency_score = 100;
      } else {
        const mean = chunkScores.reduce((a, b) => a + b, 0) / chunkScores.length;
        const variance =
          chunkScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
          chunkScores.length;

        // Max possible variance between 0 and 100 is 2500
        const normalizedVariance = Math.min(100, (variance / 2500) * 100);
        consistency_score = Math.max(0, Math.min(100, 100 - normalizedVariance));
      }
    }

    // Formula: (0.6 * recent_accuracy) + (0.25 * difficulty_weighted_accuracy) + (0.15 * consistency_score)
    const rawMastery =
      0.6 * recent_accuracy +
      0.25 * difficulty_weighted_accuracy +
      0.15 * consistency_score;

    const roundedMastery = Math.min(100, Math.max(0, Math.round(rawMastery)));

    return {
      mastery_score: roundedMastery,
      contributing_factors: {
        recent_accuracy: Math.round(recent_accuracy * 100) / 100,
        difficulty_weighted_accuracy: Math.round(difficulty_weighted_accuracy * 100) / 100,
        consistency_score: Math.round(consistency_score * 100) / 100,
        window_size: windowSize,
        ...(insufficientData ? { insufficient_data_for_consistency: true } : {}),
        computed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Adaptive Rules (Spec Part A2):
   * Minimum 5 attempts before adjusting difficulty.
   * - accuracy >= 85% -> naik difficulty +1, status="STRONG"
   * - accuracy 60-84% -> kekal level, mixed practice, status="DEVELOPING"
   * - accuracy < 60%  -> turun difficulty -1, status="WEAK"
   * - Perubahan level: ±1 sahaja setiap kali, bounded between [1, 3].
   */
  determineNextDifficulty(params: {
    currentDifficulty: number;
    recentAccuracy: number;
    totalAttempts: number;
  }): DifficultyDecision {
    const { currentDifficulty, recentAccuracy, totalAttempts } = params;
    const clampedCurrent = Math.min(3, Math.max(1, currentDifficulty || 1));

    // Minimum data gate: If attempt count < 5, DO NOT adjust difficulty
    if (totalAttempts < 5) {
      let status: 'STRONG' | 'DEVELOPING' | 'WEAK' = 'DEVELOPING';
      if (recentAccuracy >= 85) status = 'STRONG';
      else if (recentAccuracy < 60) status = 'WEAK';

      return {
        nextDifficulty: clampedCurrent,
        status,
        reason: 'LESS_THAN_MIN_ATTEMPTS_MAINTAIN_LEVEL',
      };
    }

    if (recentAccuracy >= 85) {
      const nextDiff = Math.min(3, clampedCurrent + 1);
      return {
        nextDifficulty: nextDiff,
        status: 'STRONG',
        reason: 'ACCURACY_HIGH_INCREASE_DIFFICULTY',
      };
    }

    if (recentAccuracy >= 60) {
      return {
        nextDifficulty: clampedCurrent,
        status: 'DEVELOPING',
        reason: 'ACCURACY_MODERATE_MAINTAIN_DIFFICULTY',
      };
    }

    const nextDiff = Math.max(1, clampedCurrent - 1);
    return {
      nextDifficulty: nextDiff,
      status: 'WEAK',
      reason: 'ACCURACY_LOW_DECREASE_DIFFICULTY',
    };
  }

  /**
   * Repeated Mistake & Recovery Sequence Evaluator (Spec Part A2):
   * - consecutive_wrong_count >= 3 on same subtopic triggers repeated_mistake_gap and 4-step recovery
   * - resets consecutive_wrong_count = 0 on correct answer
   */
  evaluateRepeatedMistake(params: {
    previousConsecutiveWrong: number;
    isCorrect: boolean;
    inRecovery: boolean;
    recoveryStep: number | null;
  }): RepeatedMistakeEvaluation {
    const { previousConsecutiveWrong, isCorrect, inRecovery, recoveryStep } = params;

    if (isCorrect) {
      if (inRecovery) {
        if (recoveryStep === 4) {
          // Reassessment passed -> Gap resolved
          return {
            consecutiveWrong: 0,
            triggerRecovery: false,
            inRecovery: false,
            recoveryStep: null,
            gapResolved: true,
          };
        }
        // Advance recovery step
        const nextStep = (recoveryStep ?? 1) + 1;
        return {
          consecutiveWrong: 0,
          triggerRecovery: false,
          inRecovery: true,
          recoveryStep: Math.min(4, nextStep),
          gapResolved: false,
        };
      }

      return {
        consecutiveWrong: 0,
        triggerRecovery: false,
        inRecovery: false,
        recoveryStep: null,
        gapResolved: false,
      };
    }

    // Wrong answer
    const newConsecutive = previousConsecutiveWrong + 1;

    if (inRecovery) {
      const nextStep = (recoveryStep ?? 1) < 4 ? (recoveryStep ?? 1) + 1 : 4;
      return {
        consecutiveWrong: newConsecutive,
        triggerRecovery: false,
        inRecovery: true,
        recoveryStep: nextStep,
        gapResolved: false,
      };
    }

    if (newConsecutive >= 3) {
      return {
        consecutiveWrong: newConsecutive,
        triggerRecovery: true,
        inRecovery: true,
        recoveryStep: 1,
        gapResolved: false,
      };
    }

    return {
      consecutiveWrong: newConsecutive,
      triggerRecovery: false,
      inRecovery: false,
      recoveryStep: null,
      gapResolved: false,
    };
  }

  /**
   * Mastery Gate Evaluator:
   * mastery_score >= 80% AND status != "WEAK" AND tiada gap aktif
   */
  checkMasteryGate(params: {
    masteryScore: number;
    status: string;
    hasActiveGap: boolean;
  }): MasteryGateCheck {
    const { masteryScore, status, hasActiveGap } = params;
    const normStatus = status.toUpperCase();

    if (masteryScore >= 80 && normStatus !== 'WEAK' && !hasActiveGap) {
      return {
        passed: true,
        reason: 'MASTERY_GATE_CRITERIA_MET',
      };
    }

    return {
      passed: false,
      reason:
        masteryScore < 80
          ? 'MASTERY_SCORE_BELOW_80'
          : normStatus === 'WEAK'
          ? 'STATUS_IS_WEAK'
          : 'ACTIVE_GAP_PRESENT',
    };
  }

  /**
   * Select Next Adaptive Question with Fallback:
   * Fallback to nearest difficulty level if candidate question at target difficulty is unavailable.
   */
  async selectAdaptiveQuestion(
    subtopicId: string,
    targetLevel: number,
    excludeQuestionIds: string[] = []
  ) {
    const clampedLevel = Math.min(3, Math.max(1, targetLevel));

    // 1. Try exact target level
    let candidate = await prisma.question.findFirst({
      where: {
        subtopic_id: subtopicId,
        difficulty_level: clampedLevel,
        is_active: true,
        id: { notIn: excludeQuestionIds },
      },
    });

    if (candidate) return candidate;

    // 2. Fallback to nearest difficulty levels (e.g. if 3 -> try 2, then 1; if 1 -> try 2, then 3; if 2 -> try 1, then 3)
    const fallbackOrder =
      clampedLevel === 3 ? [2, 1] : clampedLevel === 1 ? [2, 3] : [1, 3];

    for (const lvl of fallbackOrder) {
      candidate = await prisma.question.findFirst({
        where: {
          subtopic_id: subtopicId,
          difficulty_level: lvl,
          is_active: true,
          id: { notIn: excludeQuestionIds },
        },
      });
      if (candidate) return candidate;
    }

    // 3. Fallback to any active question
    candidate = await prisma.question.findFirst({
      where: {
        subtopic_id: subtopicId,
        is_active: true,
        id: { notIn: excludeQuestionIds },
      },
      orderBy: { difficulty_level: 'asc' },
    });

    return candidate;
  }

  /**
   * Process Attempt Adaptation (Invoked after each question attempt is recorded):
   * 1. Evaluates subtopic repeated mistakes and recovery state
   * 2. Calculates updated mastery_score with full contributing factors
   * 3. Determines next difficulty level with max ±1 change and minimum 5 attempts rule
   * 4. Updates StudentTopicProgress & records StudentTopicProgressHistory
   * 5. Emits LearningEvents for gap detection/resolution
   */
  async processAttemptAdaptation(params: {
    studentId: string;
    subtopicId: string;
    sessionId?: string;
    isCorrect: boolean;
    questionDifficulty: number;
  }) {
    const { studentId, subtopicId, sessionId, isCorrect, questionDifficulty } = params;

    // Fetch current progress
    const progress = await prisma.studentTopicProgress.findUnique({
      where: {
        student_id_subtopic_id: {
          student_id: studentId,
          subtopic_id: subtopicId,
        },
      },
    });

    const prevFactors = (progress?.contributing_factors as Record<string, any>) || {};
    const prevConsecutiveWrong = prevFactors.subtopic_consecutive_wrong || 0;
    const prevInRecovery = prevFactors.in_recovery === true;
    const prevRecoveryStep = prevFactors.recovery_step || null;
    const currentDifficulty = prevFactors.current_difficulty_level || questionDifficulty || 1;
    const totalAttempts = (progress?.total_attempts || 0) + 1;
    const correctAttempts = (progress?.correct_attempts || 0) + (isCorrect ? 1 : 0);

    // 1. Evaluate Repeated Mistake & Recovery Sequence State
    const recoveryEval = this.evaluateRepeatedMistake({
      previousConsecutiveWrong: prevConsecutiveWrong,
      isCorrect,
      inRecovery: prevInRecovery,
      recoveryStep: prevRecoveryStep,
    });

    // 2. Fetch recent attempts (up to 10) for mastery calculation
    const recentAttempts = await prisma.questionAttempt.findMany({
      where: {
        student_id: studentId,
        question: { subtopic_id: subtopicId },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      include: {
        question: { select: { difficulty_level: true } },
      },
    });

    // Chronological order
    const chronologicalAttempts = [...recentAttempts].reverse();
    const masteryCalc = this.calculateMasteryScore(chronologicalAttempts);

    const prevMastery = progress?.mastery_level ?? 50;
    const newMastery = masteryCalc.mastery_score;

    // 3. Determine Next Difficulty (Minimum 5 attempts rule, max ±1 change)
    const difficultyDecision = this.determineNextDifficulty({
      currentDifficulty,
      recentAccuracy: masteryCalc.contributing_factors.recent_accuracy,
      totalAttempts,
    });

    // 4. Record StudentTopicProgressHistory
    await prisma.studentTopicProgressHistory.create({
      data: {
        student_id: studentId,
        subtopic_id: subtopicId,
        previous_mastery: prevMastery,
        new_mastery: newMastery,
        trigger_event: 'PRACTICE_ANSWER',
      },
    });

    // 5. Evaluate all 3 learning gap rules (Repeated Mistake, Mastery Decline, Persistent Weak) & resolve status
    const existingActiveGaps: GapType[] = prevFactors.active_gaps || [];
    const gapEval = await learningGapService.evaluateAllGaps({
      studentId,
      subtopicId,
      sessionId,
      currentMastery: newMastery,
      consecutiveWrong: recoveryEval.consecutiveWrong,
      inRecovery: recoveryEval.inRecovery,
      recoveryStep: recoveryEval.recoveryStep,
      gapResolved: recoveryEval.gapResolved,
      existingActiveGaps,
    });

    // Authoritative Status per Spec A3:
    // mastery >= 85% AND no active gaps -> STRONG
    // mastery 60-84% AND no active gaps -> DEVELOPING
    // mastery < 60% OR any active gap -> WEAK
    const authoritativeStatus = gapEval.adjustedStatus;

    // 6. Update contributing_factors JSON
    const updatedFactors = {
      ...prevFactors,
      current_difficulty_level: difficultyDecision.nextDifficulty,
      subtopic_consecutive_wrong: recoveryEval.consecutiveWrong,
      in_recovery: recoveryEval.inRecovery,
      recovery_step: recoveryEval.recoveryStep,
      original_level: prevFactors.original_level || questionDifficulty,
      last_attempt_correct: isCorrect,
      active_gaps: gapEval.activeGaps,
      ...masteryCalc.contributing_factors,
    };

    // 7. Upsert StudentTopicProgress
    const updatedProgress = await prisma.studentTopicProgress.upsert({
      where: {
        student_id_subtopic_id: {
          student_id: studentId,
          subtopic_id: subtopicId,
        },
      },
      create: {
        student_id: studentId,
        subtopic_id: subtopicId,
        mastery_level: newMastery,
        mastery_source: MasterySource.calculated,
        status: authoritativeStatus,
        total_attempts: totalAttempts,
        correct_attempts: correctAttempts,
        last_practiced_at: new Date(),
        contributing_factors: updatedFactors,
      },
      update: {
        mastery_level: newMastery,
        mastery_source: MasterySource.calculated,
        status: authoritativeStatus,
        total_attempts: totalAttempts,
        correct_attempts: correctAttempts,
        last_practiced_at: new Date(),
        contributing_factors: updatedFactors,
      },
    });

    // 8. Check Mastery Gate
    const gateCheck = this.checkMasteryGate({
      masteryScore: newMastery,
      status: authoritativeStatus,
      hasActiveGap: gapEval.activeGaps.length > 0 || recoveryEval.inRecovery,
    });

    return {
      mastery_score: newMastery,
      status: authoritativeStatus,
      next_difficulty_level: difficultyDecision.nextDifficulty,
      contributing_factors: updatedFactors,
      active_gaps: gapEval.activeGaps,
      gap_eval: gapEval,
      recovery: recoveryEval,
      mastery_gate: gateCheck,
      updated_progress: updatedProgress,
    };
  }
}

export const adaptiveEngine = new AdaptiveEngine();
