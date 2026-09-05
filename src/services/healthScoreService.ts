import { UserRole } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';

export interface HealthScoreCalculationResult {
  health_score: number;
  health_label: 'Thriving' | 'On track' | 'Watch' | 'Needs support';
  components: {
    mastery_component: number;
    engagement_component: number;
    consistency_component: number;
    trend_component: number;
  };
  contributing_factors: {
    mastery: {
      score: number;
      subtopics_count: number;
      average_mastery: number;
      insufficient_data?: boolean;
    };
    engagement: {
      score: number;
      sessions_7d_count: number;
      sessions_14d_count: number;
      last_session_at?: string | null;
      inactivity_penalty_applied: boolean;
    };
    consistency: {
      score: number;
      sessions_count: number;
      session_accuracies: number[];
      variance: number;
      insufficient_data?: boolean;
    };
    trend: {
      score: number;
      avg_mastery_7d?: number | null;
      avg_mastery_7_14d?: number | null;
      delta?: number | null;
      insufficient_data?: boolean;
    };
    computed_at: string;
  };
  reasons: string[];
}

export class HealthScoreService {
  /**
   * Determine health label based on locked boundaries:
   * 80–100 -> Thriving
   * 65–79  -> On track
   * 50–64  -> Watch
   * <50    -> Needs support
   */
  getHealthLabel(score: number): 'Thriving' | 'On track' | 'Watch' | 'Needs support' {
    if (score >= 80) return 'Thriving';
    if (score >= 65) return 'On track';
    if (score >= 50) return 'Watch';
    return 'Needs support';
  }

  /**
   * Calculate Health Score and component breakdowns for a student (Spec A8).
   */
  async calculateHealthScore(studentId: string): Promise<HealthScoreCalculationResult> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const reasons: string[] = [];

    // ----------------------------------------------------
    // 1. Mastery Component — 40%
    // Mengira purata skor penguasaan berangka (mastery score 0-100) dari
    // student_topic_progress.mastery_level bagi semua subtopik yang disentuh (total_attempts > 0).
    // BUKAN difficulty_level atau difficulty_tier.
    // ----------------------------------------------------
    const progressList = await prisma.studentTopicProgress.findMany({
      where: {
        student_id: studentId,
        total_attempts: { gt: 0 },
      },
      select: { mastery_level: true, subtopic_id: true },
    });

    let masteryComponent = 50;
    let masteryInsufficient = false;

    if (progressList.length > 0) {
      // Purata skor berangka mastery_score (0-100)
      const sumMastery = progressList.reduce((sum, p) => sum + p.mastery_level, 0);
      masteryComponent = sumMastery / progressList.length;
    } else {
      masteryComponent = 50;
      masteryInsufficient = true;
    }
    masteryComponent = Math.max(0, Math.min(100, Math.round(masteryComponent * 100) / 100));

    if (masteryComponent >= 85) {
      reasons.push('Penguasaan subtopik cemerlang (>=85%)');
    } else if (masteryComponent < 50 && !masteryInsufficient) {
      reasons.push('Purata penguasaan subtopik rendah (<50%)');
    }

    // ----------------------------------------------------
    // 2. Engagement Component — 25%
    // Base: MIN(100, (sessions_7hari / 5) * 100)
    // Penalty: -30 if no practice session in 14 days
    // ----------------------------------------------------
    const sessions14d = await prisma.practiceSession.findMany({
      where: {
        student_id: studentId,
        created_at: { gte: fourteenDaysAgo },
        total_questions: { gt: 0 },
      },
      select: { id: true, created_at: true, total_questions: true, correct_count: true },
      orderBy: { created_at: 'desc' },
    });

    const sessions7d = sessions14d.filter((s) => new Date(s.created_at) >= sevenDaysAgo);
    const sessions7dCount = sessions7d.length;
    const sessions14dCount = sessions14d.length;
    const lastSession = sessions14d[0];

    const baseEngagement = Math.min(100, (sessions7dCount / 5) * 100);
    const inactivityPenalty = sessions14dCount === 0 ? -30 : 0;
    const engagementComponent = Math.max(0, Math.min(100, Math.round((baseEngagement + inactivityPenalty) * 100) / 100));

    if (sessions14dCount === 0) {
      reasons.push('Tiada sesi latihan selama 14 hari');
    } else if (sessions7dCount < 3) {
      reasons.push('Aktiviti latihan rendah dalam 7 hari (<3 sesi)');
    } else if (sessions7dCount >= 5) {
      reasons.push('Aktiviti latihan konsisten dan mencukupi (>=5 sesi seminggu)');
    }

    // ----------------------------------------------------
    // 3. Consistency Component — 20%
    // 100 - variance(accuracy% per session in 14 days)
    // If < 3 sessions -> default 50
    // ----------------------------------------------------
    let consistencyComponent = 50;
    let consistencyVariance = 0;
    let consistencyInsufficient = false;
    const sessionAccuracies: number[] = [];

    if (sessions14dCount >= 3) {
      for (const s of sessions14d) {
        const acc = s.total_questions > 0 ? (s.correct_count / s.total_questions) * 100 : 0;
        sessionAccuracies.push(acc);
      }

      const meanAcc = sessionAccuracies.reduce((a, b) => a + b, 0) / sessionAccuracies.length;
      consistencyVariance =
        sessionAccuracies.reduce((sum, a) => sum + Math.pow(a - meanAcc, 2), 0) /
        sessionAccuracies.length;

      consistencyComponent = Math.max(0, Math.min(100, Math.round((100 - consistencyVariance) * 100) / 100));

      if (consistencyComponent < 60) {
        reasons.push('Ketekalan prestasi latihan tidak stabil (varians ketara)');
      } else if (consistencyComponent >= 90) {
        reasons.push('Ketekalan prestasi latihan sangat stabil dan konsisten');
      }
    } else {
      consistencyComponent = 50;
      consistencyInsufficient = true;
    }

    // ----------------------------------------------------
    // 4. Trend Component — 15%
    // Compare 7d avg mastery vs 7–14d avg mastery in student_topic_progress_history
    // delta >= +5 -> 100, delta in [-5, +5) -> 70, delta < -5 -> 30
    // Fallback: 70 if insufficient data
    // ----------------------------------------------------
    const history14d = await prisma.studentTopicProgressHistory.findMany({
      where: {
        student_id: studentId,
        recorded_at: { gte: fourteenDaysAgo },
      },
      select: { new_mastery: true, recorded_at: true },
    });

    const history7d = history14d.filter((h) => new Date(h.recorded_at) >= sevenDaysAgo);
    const history7_14d = history14d.filter((h) => new Date(h.recorded_at) < sevenDaysAgo);

    let trendComponent = 70;
    let avg7d: number | null = null;
    let avg7_14d: number | null = null;
    let deltaMastery: number | null = null;
    let trendInsufficient = false;

    if (history7d.length > 0 && history7_14d.length > 0) {
      avg7d = history7d.reduce((s, h) => s + h.new_mastery, 0) / history7d.length;
      avg7_14d = history7_14d.reduce((s, h) => s + h.new_mastery, 0) / history7_14d.length;
      deltaMastery = Math.round((avg7d - avg7_14d) * 100) / 100;

      if (deltaMastery >= 5) {
        trendComponent = 100;
        reasons.push('Trend penguasaan menunjukkan peningkatan positif (>=5 mata)');
      } else if (deltaMastery < -5) {
        trendComponent = 30;
        reasons.push('Trend penguasaan menunjukkan penurunan (>5 mata)');
      } else {
        trendComponent = 70;
      }
    } else {
      trendComponent = 70;
      trendInsufficient = true;
    }

    // ----------------------------------------------------
    // Final Health Score Calculation:
    // (0.40 * mastery) + (0.25 * engagement) + (0.20 * consistency) + (0.15 * trend)
    // ----------------------------------------------------
    const rawHealthScore =
      0.4 * masteryComponent +
      0.25 * engagementComponent +
      0.2 * consistencyComponent +
      0.15 * trendComponent;

    const finalScore = Math.max(0, Math.min(100, Math.round(rawHealthScore * 100) / 100));
    const healthLabel = this.getHealthLabel(finalScore);

    const contributingFactors = {
      mastery: {
        score: masteryComponent,
        subtopics_count: progressList.length,
        average_mastery: masteryComponent,
        ...(masteryInsufficient ? { insufficient_data: true } : {}),
      },
      engagement: {
        score: engagementComponent,
        sessions_7d_count: sessions7dCount,
        sessions_14d_count: sessions14dCount,
        last_session_at: lastSession?.created_at?.toISOString() || null,
        inactivity_penalty_applied: sessions14dCount === 0,
      },
      consistency: {
        score: consistencyComponent,
        sessions_count: sessions14dCount,
        session_accuracies: sessionAccuracies,
        variance: Math.round(consistencyVariance * 100) / 100,
        ...(consistencyInsufficient ? { insufficient_data: true } : {}),
      },
      trend: {
        score: trendComponent,
        avg_mastery_7d: avg7d,
        avg_mastery_7_14d: avg7_14d,
        delta: deltaMastery,
        ...(trendInsufficient ? { insufficient_data: true } : {}),
      },
      computed_at: now.toISOString(),
    };

    return {
      health_score: finalScore,
      health_label: healthLabel,
      components: {
        mastery_component: masteryComponent,
        engagement_component: engagementComponent,
        consistency_component: consistencyComponent,
        trend_component: trendComponent,
      },
      contributing_factors: contributingFactors,
      reasons,
    };
  }

  /**
   * Recalculate health score for a student and append a new record to student_health_scores.
   * STRICTLY APPEND-ONLY: Never updates or deletes past health scores.
   */
  async recalculateAndSave(studentId: string, subjectId?: string) {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new AppError('USER_NOT_FOUND', 404);
    }

    const calc = await this.calculateHealthScore(studentId);

    // Append-only insertion into student_health_scores
    const record = await prisma.studentHealthScore.create({
      data: {
        student_id: studentId,
        subject_id: subjectId || null,
        health_score: calc.health_score,
        risk_level: calc.health_label,
        gap_indicators: {
          reasons: calc.reasons,
        },
        contributing_factors: {
          ...calc.contributing_factors,
          components: calc.components,
          health_label: calc.health_label,
          reasons: calc.reasons,
        },
      },
    });

    return {
      ...calc,
      id: record.id,
      created_at: record.created_at,
    };
  }

  /**
   * Scheduled Daily Job:
   * Recalculates health score for all active students.
   * Idempotent & fault-tolerant: failure of one student does not stop processing other students.
   */
  async runDailyHealthScoreJob() {
    const students = await prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        is_active: true,
      },
      select: { id: true, email: true },
    });

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ studentId: string; error: string }> = [];

    for (const student of students) {
      try {
        await this.recalculateAndSave(student.id);
        successCount++;
      } catch (err: any) {
        failureCount++;
        errors.push({
          studentId: student.id,
          error: err.message || 'Unknown error',
        });
      }
    }

    return {
      job_name: 'DAILY_HEALTH_SCORE_RECALCULATION',
      total_students: students.length,
      success_count: successCount,
      failure_count: failureCount,
      errors,
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * Query all health score history for a student (append-only history).
   */
  async getStudentHealthScoreHistory(studentId: string) {
    return prisma.studentHealthScore.findMany({
      where: { student_id: studentId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Query current health scores for all students in a teacher's class.
   * Enforces teacher ownership of the class.
   */
  async getClassHealthScores(teacherId: string, classId: string) {
    const cls = await prisma.class.findFirst({
      where: { id: classId, teacher_id: teacherId },
      include: {
        enrolments: {
          include: {
            student: { select: { id: true, full_name: true, email: true } },
          },
        },
      },
    });

    if (!cls) {
      throw new AppError('CLASS_NOT_FOUND', 404);
    }

    const results = [];

    for (const enrolment of cls.enrolments) {
      const student = enrolment.student;
      // Get most recent health score
      const latestScore = await prisma.studentHealthScore.findFirst({
        where: { student_id: student.id },
        orderBy: { created_at: 'desc' },
      });

      results.push({
        student: {
          id: student.id,
          full_name: student.full_name,
          email: student.email,
        },
        health_score: latestScore?.health_score ?? null,
        health_label: latestScore?.risk_level ?? null,
        reasons: (latestScore?.gap_indicators as any)?.reasons ?? [],
        contributing_factors: latestScore?.contributing_factors ?? null,
        recorded_at: latestScore?.created_at ?? null,
      });
    }

    return {
      class_id: cls.id,
      class_name: cls.name,
      total_students: cls.enrolments.length,
      students: results,
    };
  }
}

export const healthScoreService = new HealthScoreService();
