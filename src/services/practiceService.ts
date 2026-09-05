import { MasterySource, SessionStatus, QuestionType, GapType } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';

export interface SubmitAnswerInput {
  question_id: string;
  student_answer: any;
  response_time_seconds?: number;
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

/**
 * Spec Section 2 Full Mastery Formula:
 * mastery_score = (0.6 * recent_accuracy) + (0.25 * difficulty_weighted_accuracy) + (0.15 * consistency_score)
 *
 * @param recentAttempts Up to 10 most recent attempts on the subtopic in chronological order
 */
export function calculateMasteryScore(
  recentAttempts: Array<{ is_correct: boolean; question: { difficulty_level: number } }>
): MasteryCalculationResult {
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

  // 2. difficulty_weighted_accuracy (Level1=1.0x, Level2=1.3x, Level3=1.6x)
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

export class PracticeService {
  /**
   * Start a new practice session for a student and subtopic.
   */
  async createSession(studentId: string, subtopicId: string) {
    const subtopic = await prisma.subtopic.findUnique({
      where: { id: subtopicId },
      include: { topic: { include: { subject: true } } },
    });

    if (!subtopic) {
      throw new AppError('SUBTOPIC_NOT_FOUND', 404);
    }

    const session = await prisma.practiceSession.create({
      data: {
        student_id: studentId,
        subtopic_id: subtopicId,
        mode: 'PRACTICE',
        status: SessionStatus.IN_PROGRESS,
        total_questions: 0,
        correct_count: 0,
      },
    });

    return {
      session_id: session.id,
      subtopic_id: subtopic.id,
      subtopic_title_ms: subtopic.title_ms,
      subtopic_title_en: subtopic.title_en,
      topic_title_ms: subtopic.topic.title_ms,
      subject_code: subtopic.topic.subject.code,
      status: session.status,
      created_at: session.created_at,
    };
  }

  /**
   * Get the next adaptive question for this session.
   */
  async getNextQuestion(studentId: string, sessionId: string) {
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
      include: { subtopic: true },
    });

    if (!session || session.student_id !== studentId) {
      throw new AppError('SESSION_NOT_FOUND', 404);
    }

    // Lazy Timeout Check: 30 minutes of inactivity
    const thirtyMinutesMs = 30 * 60 * 1000;
    if (
      session.status === SessionStatus.IN_PROGRESS ||
      session.status === SessionStatus.RECOVERY_MODE
    ) {
      const timeSinceUpdate = Date.now() - new Date(session.updated_at).getTime();
      if (timeSinceUpdate > thirtyMinutesMs) {
        await prisma.practiceSession.update({
          where: { id: session.id },
          data: { status: SessionStatus.ABANDONED },
        });
        throw new AppError('SESSION_TIMEOUT', 400);
      }
    }

    if (
      session.status === SessionStatus.COMPLETED ||
      session.status === SessionStatus.ABANDONED
    ) {
      throw new AppError('SESSION_ALREADY_ENDED', 400);
    }

    if (!session.subtopic_id) {
      throw new AppError('SUBTOPIC_NOT_FOUND', 404);
    }

    // Questions already attempted in this session
    const attempts = await prisma.questionAttempt.findMany({
      where: { session_id: session.id },
      select: { question_id: true },
    });
    const attemptedIds = attempts.map((a) => a.question_id);

    // Get current student topic progress
    const progress = await prisma.studentTopicProgress.findUnique({
      where: {
        student_id_subtopic_id: {
          student_id: studentId,
          subtopic_id: session.subtopic_id,
        },
      },
    });

    const factors = (progress?.contributing_factors as Record<string, any>) || {};
    const isInRecovery =
      session.status === SessionStatus.RECOVERY_MODE || factors.in_recovery === true;
    const recoveryStep = factors.recovery_step || 1;
    const currentStatus = (progress?.status || 'DEVELOPING').toUpperCase();

    // Determine target difficulty level based on Adaptive Rules (Spec Section 6 & 1)
    let targetLevel = 1;

    if (isInRecovery) {
      // Recovery Sequence (4 Steps):
      // Step 1: level - 1
      // Step 2: guided/hint question
      // Step 3: similar at same level
      // Step 4: reassessment at original level
      if (recoveryStep === 1) targetLevel = 1;
      else if (recoveryStep === 2) targetLevel = 1;
      else if (recoveryStep === 3) targetLevel = factors.original_level || 2;
      else targetLevel = factors.original_level || 2;
    } else if (currentStatus === 'STRONG') {
      targetLevel = 3; // level + 1
    } else if (currentStatus === 'DEVELOPING') {
      // 70% level 2, 30% level 1
      targetLevel = Math.random() < 0.7 ? 2 : 1;
    } else if (currentStatus === 'WEAK') {
      targetLevel = 1; // level - 1
    } else {
      targetLevel = 1;
    }

    // Try finding an unattempted question at target difficulty
    let candidate = await prisma.question.findFirst({
      where: {
        subtopic_id: session.subtopic_id,
        difficulty_level: targetLevel,
        is_active: true,
        id: { notIn: attemptedIds },
      },
    });

    // Fallback: any unattempted active question in this subtopic
    if (!candidate) {
      candidate = await prisma.question.findFirst({
        where: {
          subtopic_id: session.subtopic_id,
          is_active: true,
          id: { notIn: attemptedIds },
        },
        orderBy: { difficulty_level: 'asc' },
      });
    }

    if (!candidate) {
      throw new AppError('NO_QUESTIONS_AVAILABLE', 404);
    }

    return {
      session_id: session.id,
      session_status: session.status,
      question_index: attempts.length + 1,
      total_answered: attempts.length,
      in_recovery: isInRecovery,
      recovery_step: isInRecovery ? recoveryStep : null,
      question: {
        id: candidate.id,
        subtopic_id: candidate.subtopic_id,
        difficulty_level: candidate.difficulty_level,
        question_text: candidate.question_text,
        question_type: candidate.question_type,
        options: candidate.options,
        language: candidate.language,
        estimated_time_seconds: candidate.estimated_time_seconds,
      },
    };
  }

  /**
   * Submit student's answer for the current question in this session.
   * Enforces rolling mastery, two distinct consecutive wrong counters, and termination rules.
   */
  async submitAnswer(studentId: string, sessionId: string, input: SubmitAnswerInput) {
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.student_id !== studentId) {
      throw new AppError('SESSION_NOT_FOUND', 404);
    }

    if (
      session.status === SessionStatus.COMPLETED ||
      session.status === SessionStatus.ABANDONED
    ) {
      throw new AppError('SESSION_ALREADY_ENDED', 400);
    }

    const question = await prisma.question.findUnique({
      where: { id: input.question_id },
    });

    if (!question) {
      throw new AppError('QUESTION_NOT_FOUND', 404);
    }

    // 1. Evaluate Correctness
    const isCorrect = this.checkAnswerCorrectness(question, input.student_answer);

    // 2. Fetch past attempts in this session to calculate Session-Level Consecutive Wrong
    const pastAttempts = await prisma.questionAttempt.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'asc' },
    });

    // Session-Level Consecutive Wrong Calculation (Survival Round)
    let sessionConsecutiveWrong = 0;
    if (!isCorrect) {
      // count trailing wrong answers in session
      let count = 1;
      for (let i = pastAttempts.length - 1; i >= 0; i--) {
        if (!pastAttempts[i].is_correct) {
          count++;
        } else {
          break;
        }
      }
      sessionConsecutiveWrong = count;
    } else {
      sessionConsecutiveWrong = 0;
    }

    // 3. Fetch StudentTopicProgress for Subtopic-Level Tracking
    const subtopicId = session.subtopic_id || question.subtopic_id;
    const progress = await prisma.studentTopicProgress.findUnique({
      where: {
        student_id_subtopic_id: {
          student_id: studentId,
          subtopic_id: subtopicId,
        },
      },
    });

    const factors = (progress?.contributing_factors as Record<string, any>) || {};
    let subtopicConsecutiveWrong = factors.subtopic_consecutive_wrong || 0;
    if (!isCorrect) {
      subtopicConsecutiveWrong += 1;
    } else {
      subtopicConsecutiveWrong = 0;
    }

    let isInRecovery =
      session.status === SessionStatus.RECOVERY_MODE || factors.in_recovery === true;
    let recoveryStep = factors.recovery_step || 1;

    // 4. Check Subtopic-Level Repeated Mistake Gap Trigger (consecutive wrong >= 3 on same subtopic)
    if (subtopicConsecutiveWrong >= 3 && !isInRecovery) {
      isInRecovery = true;
      recoveryStep = 1;

      // Log LearningEvent (GAP_DETECTED)
      await prisma.learningEvent.create({
        data: {
          student_id: studentId,
          event_type: 'GAP_DETECTED',
          gap_type: GapType.repeated_mistake_gap,
          event_data: {
            subtopic_id: subtopicId,
            consecutive_wrong: subtopicConsecutiveWrong,
            triggered_at: new Date().toISOString(),
          },
        },
      });

      // Update session status to RECOVERY_MODE (does NOT terminate session)
      await prisma.practiceSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.RECOVERY_MODE },
      });
    } else if (isInRecovery) {
      if (recoveryStep < 4) {
        recoveryStep += 1;
      } else if (recoveryStep === 4) {
        // Step 4 is reassessment
        if (isCorrect) {
          // Gap resolved!
          isInRecovery = false;
          recoveryStep = null;
          subtopicConsecutiveWrong = 0;

          await prisma.learningEvent.create({
            data: {
              student_id: studentId,
              event_type: 'GAP_RESOLVED',
              gap_type: GapType.repeated_mistake_gap,
              event_data: {
                subtopic_id: subtopicId,
                resolved_at: new Date().toISOString(),
              },
            },
          });

          await prisma.practiceSession.update({
            where: { id: sessionId },
            data: { status: SessionStatus.IN_PROGRESS },
          });
        }
      }
    }

    // 5. Record QuestionAttempt first so it is included in the attempt history
    let attemptScore = 0;
    if (isCorrect) {
      const difficultyMultiplier = (question.difficulty_level / 3) * 0.3 + 0.7;
      attemptScore = Math.round(100 * difficultyMultiplier);
    }

    await prisma.questionAttempt.create({
      data: {
        session_id: sessionId,
        question_id: question.id,
        student_id: studentId,
        student_answer: input.student_answer,
        is_correct: isCorrect,
        score: attemptScore,
        response_time_seconds: input.response_time_seconds || 0,
      },
    });

    // 6. Fetch 10 most recent attempts for this student on this subtopic
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

    // Chronological order for consistency chunking
    const chronologicalAttempts = [...recentAttempts].reverse();
    const masteryCalc = calculateMasteryScore(chronologicalAttempts);

    const prevMastery = progress?.mastery_level ?? 50;
    const newMastery = masteryCalc.mastery_score;

    // Authoritative Status: Strong >= 85%, Developing >= 60%, Weak < 60%
    let newStatus = 'DEVELOPING';
    if (newMastery >= 85) newStatus = 'STRONG';
    else if (newMastery >= 60) newStatus = 'DEVELOPING';
    else newStatus = 'WEAK';

    // 7. Record StudentTopicProgressHistory
    await prisma.studentTopicProgressHistory.create({
      data: {
        student_id: studentId,
        subtopic_id: subtopicId,
        previous_mastery: prevMastery,
        new_mastery: newMastery,
        trigger_event: 'PRACTICE_ANSWER',
      },
    });

    // 8. Upsert StudentTopicProgress with detailed contributing_factors
    const updatedFactors = {
      ...factors,
      subtopic_consecutive_wrong: subtopicConsecutiveWrong,
      in_recovery: isInRecovery,
      recovery_step: recoveryStep,
      original_level: factors.original_level || question.difficulty_level,
      last_attempt_correct: isCorrect,
      ...masteryCalc.contributing_factors,
    };

    await prisma.studentTopicProgress.upsert({
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
        status: newStatus,
        total_attempts: (progress?.total_attempts || 0) + 1,
        correct_attempts: (progress?.correct_attempts || 0) + (isCorrect ? 1 : 0),
        last_practiced_at: new Date(),
        contributing_factors: updatedFactors,
      },
      update: {
        mastery_level: newMastery,
        mastery_source: MasterySource.calculated,
        status: newStatus,
        total_attempts: (progress?.total_attempts || 0) + 1,
        correct_attempts: (progress?.correct_attempts || 0) + (isCorrect ? 1 : 0),
        last_practiced_at: new Date(),
        contributing_factors: updatedFactors,
      },
    });

    // 9. Termination Rules Checking
    const totalQuestionsInSession = pastAttempts.length + 1;
    const totalCorrectInSession =
      pastAttempts.filter((a) => a.is_correct).length + (isCorrect ? 1 : 0);

    let isTerminated = false;
    let terminationReason: string | null = null;

    // Rule 1: Survival Round (3 consecutive wrong session-level)
    if (sessionConsecutiveWrong >= 3) {
      isTerminated = true;
      terminationReason = 'THREE_CONSECUTIVE_WRONG';
    }
    // Rule 2: Max 15 questions
    else if (totalQuestionsInSession >= 15) {
      isTerminated = true;
      terminationReason = 'MAX_QUESTIONS_REACHED';
    }
    // Rule 3: Mastery Gate reached (>= 80%, not Weak, no active gap)
    else if (newMastery >= 80 && newStatus !== 'WEAK' && !isInRecovery) {
      isTerminated = true;
      terminationReason = 'MASTERY_GATE_REACHED';
    }

    // Update PracticeSession
    await prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        total_questions: totalQuestionsInSession,
        correct_count: totalCorrectInSession,
        ...(isTerminated
          ? { status: SessionStatus.COMPLETED, end_time: new Date() }
          : {}),
      },
    });

    return {
      is_correct: isCorrect,
      explanation: question.explanation,
      correct_answer: question.correct_answer,
      score: attemptScore,
      current_mastery: newMastery,
      subtopic_status: newStatus,
      session_status: isTerminated ? SessionStatus.COMPLETED : session.status,
      is_terminated: isTerminated,
      termination_reason: terminationReason,
      in_recovery: isInRecovery,
      recovery_step: recoveryStep,
      session_consecutive_wrong: sessionConsecutiveWrong,
    };
  }

  /**
   * Voluntarily end a practice session.
   */
  async endSession(studentId: string, sessionId: string) {
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.student_id !== studentId) {
      throw new AppError('SESSION_NOT_FOUND', 404);
    }

    await prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        end_time: new Date(),
      },
    });

    return this.getSessionSummary(studentId, sessionId);
  }

  /**
   * Get practice session summary with dual mastery labels:
   * 1. Cosmetic Round Label (calculated from this round score)
   * 2. Authoritative Subtopic Status (persistent database mastery)
   */
  async getSessionSummary(studentId: string, sessionId: string) {
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
      include: {
        subtopic: {
          include: {
            topic: {
              include: { subject: true },
            },
          },
        },
      },
    });

    if (!session || session.student_id !== studentId) {
      throw new AppError('SESSION_NOT_FOUND', 404);
    }

    const attempts = await prisma.questionAttempt.findMany({
      where: { session_id: sessionId },
    });

    const totalQuestions = attempts.length;
    const correctCount = attempts.filter((a) => a.is_correct).length;
    const wrongCount = totalQuestions - correctCount;
    const accuracyPercent =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // 1. Cosmetic Round Label (calculated from this round score alone)
    let cosmeticLabel = 'Beginning';
    if (accuracyPercent >= 80) {
      cosmeticLabel = 'Strong foundation';
    } else if (accuracyPercent >= 55) {
      cosmeticLabel = 'Developing';
    } else {
      cosmeticLabel = 'Beginning';
    }

    // 2. Authoritative Subtopic Status from Database
    let subtopicProgress = null;
    if (session.subtopic_id) {
      const progress = await prisma.studentTopicProgress.findUnique({
        where: {
          student_id_subtopic_id: {
            student_id: studentId,
            subtopic_id: session.subtopic_id,
          },
        },
      });

      if (progress) {
        subtopicProgress = {
          subtopic_id: progress.subtopic_id,
          subtopic_code: session.subtopic?.code,
          subtopic_title_ms: session.subtopic?.title_ms,
          subtopic_title_en: session.subtopic?.title_en,
          status: progress.status,
          mastery_score: progress.mastery_level,
          mastery_source: progress.mastery_source,
        };
      }
    }

    return {
      session_id: session.id,
      status: session.status,
      round_result: {
        total_questions: totalQuestions,
        correct_count: correctCount,
        wrong_count: wrongCount,
        accuracy_percent: accuracyPercent,
        label: cosmeticLabel,
      },
      subtopic_progress: subtopicProgress,
    };
  }

  private checkAnswerCorrectness(question: any, studentAnswer: any): boolean {
    if (question.question_type === QuestionType.mcq) {
      const ansString = String(studentAnswer).trim().toLowerCase();
      const correctAns = String(question.correct_answer).trim().toLowerCase();

      if (ansString === correctAns) return true;

      if (typeof question.options === 'object' && question.options !== null) {
        const optionVal = (question.options as Record<string, any>)[studentAnswer];
        if (optionVal && String(optionVal).trim().toLowerCase() === correctAns) {
          return true;
        }
      }
      return false;
    }

    return (
      String(studentAnswer).trim().toLowerCase() ===
      String(question.correct_answer).trim().toLowerCase()
    );
  }
}

export const practiceService = new PracticeService();
