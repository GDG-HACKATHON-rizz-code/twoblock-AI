import { MasterySource, SessionStatus, QuestionType } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';

export interface SubmitDiagnosticAnswer {
  question_id: string;
  student_answer: any;
  response_time_seconds?: number;
}

export interface SubmitDiagnosticInput {
  session_id: string;
  answers: SubmitDiagnosticAnswer[];
}

export class DiagnosticService {
  /**
   * Get 5 diagnostic questions for a subject, selected only from foundational subtopics,
   * strictly ordered: L1 -> L1 -> L2 -> L2 -> L3.
   */
  async getDiagnosticAssessment(studentId: string, subjectId?: string) {
    // 1. Get Target Subject
    let subject;
    if (subjectId) {
      subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: {
          topics: {
            include: {
              subtopics: true,
            },
          },
        },
      });
    } else {
      subject = await prisma.subject.findFirst({
        where: { is_active: true },
        include: {
          topics: {
            include: {
              subtopics: true,
            },
          },
        },
        orderBy: { code: 'asc' },
      });
    }

    if (!subject) {
      throw new AppError('SUBJECT_NOT_FOUND', 404);
    }

    // 2. Guard: Every topic in the subject must have at least one foundational subtopic
    for (const topic of subject.topics) {
      const foundationalSubtopics = topic.subtopics.filter((st) => st.is_foundational);
      if (foundationalSubtopics.length === 0) {
        throw new AppError('NO_FOUNDATIONAL_SUBTOPICS', 400);
      }
    }

    const foundationalSubtopicIds = subject.topics
      .flatMap((t) => t.subtopics)
      .filter((st) => st.is_foundational)
      .map((st) => st.id);

    // 3. Fetch diagnostic questions (is_diagnostic = true, is_active = true) in foundational subtopics
    const questionsL1 = await prisma.question.findMany({
      where: {
        subject_id: subject.id,
        subtopic_id: { in: foundationalSubtopicIds },
        is_diagnostic: true,
        is_active: true,
        difficulty_level: 1,
      },
      take: 2,
    });

    const questionsL2 = await prisma.question.findMany({
      where: {
        subject_id: subject.id,
        subtopic_id: { in: foundationalSubtopicIds },
        is_diagnostic: true,
        is_active: true,
        difficulty_level: 2,
      },
      take: 2,
    });

    const questionsL3 = await prisma.question.findMany({
      where: {
        subject_id: subject.id,
        subtopic_id: { in: foundationalSubtopicIds },
        is_diagnostic: true,
        is_active: true,
        difficulty_level: 3,
      },
      take: 1,
    });

    if (questionsL1.length < 2 || questionsL2.length < 2 || questionsL3.length < 1) {
      throw new AppError('INSUFFICIENT_DIAGNOSTIC_QUESTIONS', 400);
    }

    // Ordered: 2 x L1 -> 2 x L2 -> 1 x L3
    const orderedQuestions = [...questionsL1, ...questionsL2, ...questionsL3];

    // 4. Create or reuse an active PracticeSession
    let session = await prisma.practiceSession.findFirst({
      where: {
        student_id: studentId,
        mode: 'DIAGNOSTIC',
        status: SessionStatus.IN_PROGRESS,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!session) {
      session = await prisma.practiceSession.create({
        data: {
          student_id: studentId,
          mode: 'DIAGNOSTIC',
          status: SessionStatus.IN_PROGRESS,
          total_questions: 5,
        },
      });
    }

    return {
      session_id: session.id,
      subject: {
        id: subject.id,
        code: subject.code,
        name_ms: subject.name_ms,
        name_en: subject.name_en,
      },
      total_questions: orderedQuestions.length,
      questions: orderedQuestions.map((q) => ({
        id: q.id,
        subtopic_id: q.subtopic_id,
        topic_id: q.topic_id,
        subject_id: q.subject_id,
        difficulty_level: q.difficulty_level,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        language: q.language,
        estimated_time_seconds: q.estimated_time_seconds,
      })),
    };
  }

  /**
   * Submit diagnostic answers, apply Spec Section 2 Initial Mastery formula,
   * infer untested subtopics as unverified_estimate, and complete session.
   */
  async submitDiagnostic(studentId: string, input: SubmitDiagnosticInput) {
    const session = await prisma.practiceSession.findUnique({
      where: { id: input.session_id },
    });

    if (!session || session.student_id !== studentId) {
      throw new AppError('DIAGNOSTIC_SESSION_NOT_FOUND', 404);
    }

    if (session.status === SessionStatus.COMPLETED) {
      throw new AppError('DIAGNOSTIC_ALREADY_COMPLETED', 400);
    }

    if (!input.answers || input.answers.length !== 5) {
      throw new AppError('INVALID_DIAGNOSTIC_ANSWERS_COUNT', 400, {
        count: input.answers ? input.answers.length : 0,
      });
    }

    // Process each answer and compute scores
    const questionIds = input.answers.map((a) => a.question_id);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: { subtopic: true, subject: true },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    let correctCount = 0;
    const testedSubtopicScores: Map<string, { totalScore: number; count: number; subtopicId: string; subjectId: string }> =
      new Map();

    const attemptsToRecord = [];

    for (const ans of input.answers) {
      const q = questionMap.get(ans.question_id);
      if (!q) {
        throw new AppError('QUESTION_NOT_FOUND', 404);
      }

      // Determine correctness
      const isCorrect = this.checkAnswerCorrectness(q, ans.student_answer);
      if (isCorrect) correctCount++;

      // Spec Section 2 Initial Mastery Formula:
      // Correct: 60 + (difficulty_level * 10) -> L1=70, L2=80, L3=90
      // Incorrect: 30 - (difficulty_level * 5) -> L1=25, L2=20, L3=15
      const masteryScore = isCorrect
        ? 60 + q.difficulty_level * 10
        : 30 - q.difficulty_level * 5;

      attemptsToRecord.push({
        session_id: session.id,
        question_id: q.id,
        student_id: studentId,
        student_answer: ans.student_answer,
        is_correct: isCorrect,
        response_time_seconds: ans.response_time_seconds || 0,
        score: masteryScore,
      });

      // Aggregate score per subtopic
      const prev = testedSubtopicScores.get(q.subtopic_id) || {
        totalScore: 0,
        count: 0,
        subtopicId: q.subtopic_id,
        subjectId: q.subject_id,
      };
      prev.totalScore += masteryScore;
      prev.count += 1;
      testedSubtopicScores.set(q.subtopic_id, prev);
    }

    // 1. Record Question Attempts
    for (const attempt of attemptsToRecord) {
      await prisma.questionAttempt.create({ data: attempt });
    }

    // 2. Upsert StudentTopicProgress for tested subtopics
    const subjectIds = new Set<string>();
    const allCalculatedScores: number[] = [];

    for (const [subtopicId, entry] of testedSubtopicScores.entries()) {
      subjectIds.add(entry.subjectId);
      const avgScore = Math.round(entry.totalScore / entry.count);
      allCalculatedScores.push(avgScore);

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
          mastery_level: avgScore,
          mastery_source: MasterySource.diagnostic_estimate,
          status: avgScore >= 70 ? 'IN_PROGRESS' : 'NEEDS_REVISION',
          total_attempts: entry.count,
          correct_attempts: entry.count,
          last_practiced_at: new Date(),
          contributing_factors: {
            is_verified: true,
            tested_in_diagnostic: true,
            score: avgScore,
          },
        },
        update: {
          mastery_level: avgScore,
          mastery_source: MasterySource.diagnostic_estimate,
          status: avgScore >= 70 ? 'IN_PROGRESS' : 'NEEDS_REVISION',
          last_practiced_at: new Date(),
          contributing_factors: {
            is_verified: true,
            tested_in_diagnostic: true,
            score: avgScore,
          },
        },
      });
    }

    // 3. Infer untested subtopics in the same subject(s)
    const overallAverageMastery =
      allCalculatedScores.length > 0
        ? Math.round(
            allCalculatedScores.reduce((a, b) => a + b, 0) / allCalculatedScores.length
          )
        : 50;

    for (const subId of subjectIds) {
      const allSubtopicsInSubject = await prisma.subtopic.findMany({
        where: {
          topic: { subject_id: subId },
        },
      });

      for (const st of allSubtopicsInSubject) {
        if (!testedSubtopicScores.has(st.id)) {
          // Untested subtopic: infer from tested average and tag unverified_estimate
          await prisma.studentTopicProgress.upsert({
            where: {
              student_id_subtopic_id: {
                student_id: studentId,
                subtopic_id: st.id,
              },
            },
            create: {
              student_id: studentId,
              subtopic_id: st.id,
              mastery_level: overallAverageMastery,
              mastery_source: MasterySource.diagnostic_estimate,
              status: 'NOT_STARTED',
              contributing_factors: {
                is_verified: false,
                unverified_estimate: true,
                inferred_from_average: overallAverageMastery,
              },
            },
            update: {
              mastery_level: overallAverageMastery,
              mastery_source: MasterySource.diagnostic_estimate,
              contributing_factors: {
                is_verified: false,
                unverified_estimate: true,
                inferred_from_average: overallAverageMastery,
              },
            },
          });
        }
      }
    }

    // 4. Mark Session COMPLETED
    await prisma.practiceSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.COMPLETED,
        correct_count: correctCount,
        end_time: new Date(),
      },
    });

    // 5. Update Student Profile diagnostic_completed flag
    await prisma.studentProfile.updateMany({
      where: { user_id: studentId },
      data: { diagnostic_completed: true },
    });

    return {
      session_id: session.id,
      total_questions: 5,
      correct_count: correctCount,
      diagnostic_completed: true,
      snapshot_endpoint: '/students/snapshot',
    };
  }

  /**
   * Generate Learning Snapshot summarizing tested & untested subtopics,
   * with recommended starting point prioritising tested/verified subtopics.
   */
  async getLearningSnapshot(studentId: string, subjectId?: string) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { user_id: studentId },
    });

    const progressRecords = await prisma.studentTopicProgress.findMany({
      where: {
        student_id: studentId,
        ...(subjectId ? { subtopic: { topic: { subject_id: subjectId } } } : {}),
      },
      include: {
        subtopic: {
          include: {
            topic: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
      orderBy: { mastery_level: 'asc' },
    });

    const testedSubtopics = [];
    const untestedSubtopics = [];

    for (const item of progressRecords) {
      const factors = (item.contributing_factors as Record<string, any>) || {};
      const isUnverified = factors.unverified_estimate === true || factors.is_verified === false;

      const formatted = {
        subtopic_id: item.subtopic_id,
        code: item.subtopic.code,
        title_ms: item.subtopic.title_ms,
        title_en: item.subtopic.title_en,
        topic_title_ms: item.subtopic.topic.title_ms,
        topic_title_en: item.subtopic.topic.title_en,
        subject_name_ms: item.subtopic.topic.subject.name_ms,
        subject_name_en: item.subtopic.topic.subject.name_en,
        mastery_level: item.mastery_level,
        mastery_source: item.mastery_source,
        status: item.status,
        is_verified: !isUnverified,
        unverified_estimate: isUnverified,
      };

      if (isUnverified) {
        untestedSubtopics.push(formatted);
      } else {
        testedSubtopics.push(formatted);
      }
    }

    // Recommendation logic:
    // Select the lowest mastery score from tested/verified subtopics
    // (excluding unverified estimates if verified subtopics exist)
    let recommendedStartingPoint = null;
    if (testedSubtopics.length > 0) {
      // already sorted asc by mastery_level
      recommendedStartingPoint = testedSubtopics[0];
    } else if (untestedSubtopics.length > 0) {
      recommendedStartingPoint = untestedSubtopics[0];
    }

    return {
      student_id: studentId,
      diagnostic_completed: studentProfile?.diagnostic_completed ?? false,
      total_subtopics_evaluated: progressRecords.length,
      tested_subtopics_count: testedSubtopics.length,
      untested_subtopics_count: untestedSubtopics.length,
      tested_subtopics: testedSubtopics,
      untested_subtopics: untestedSubtopics,
      recommended_starting_point: recommendedStartingPoint,
    };
  }

  private checkAnswerCorrectness(question: any, studentAnswer: any): boolean {
    if (question.question_type === QuestionType.mcq) {
      const ansString = String(studentAnswer).trim().toLowerCase();
      const correctAns = String(question.correct_answer).trim().toLowerCase();

      if (ansString === correctAns) return true;

      // Check if student provided option key (A, B, C, D) and option value matches
      if (typeof question.options === 'object' && question.options !== null) {
        const optionVal = (question.options as Record<string, any>)[studentAnswer];
        if (optionVal && String(optionVal).trim().toLowerCase() === correctAns) {
          return true;
        }
      }
      return false;
    }

    // Short answer
    return String(studentAnswer).trim().toLowerCase() === String(question.correct_answer).trim().toLowerCase();
  }
}

export const diagnosticService = new DiagnosticService();
