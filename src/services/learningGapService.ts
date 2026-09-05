import { GapType, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export interface GapDetectionResult {
  detectedGaps: GapType[];
  activeGaps: GapType[];
  resolvedGaps: GapType[];
  adjustedStatus: 'STRONG' | 'DEVELOPING' | 'WEAK';
  evidence: Record<string, any>;
}

export class LearningGapService {
  /**
   * Evaluate all 3 learning gap rules for a student on a specific subtopic:
   * 1. repeated_mistake_gap (Immediate)
   * 2. mastery_decline_gap (Medium)
   * 3. persistent_weak_gap (High)
   *
   * Also resolves subtopic status according to Spec A3.
   */
  async evaluateAllGaps(params: {
    studentId: string;
    subtopicId: string;
    sessionId?: string;
    currentMastery: number;
    consecutiveWrong: number;
    inRecovery: boolean;
    recoveryStep: number | null;
    gapResolved: boolean;
    existingActiveGaps?: GapType[];
  }): Promise<GapDetectionResult> {
    const {
      studentId,
      subtopicId,
      sessionId,
      currentMastery,
      consecutiveWrong,
      inRecovery,
      gapResolved,
      existingActiveGaps = [],
    } = params;

    const detectedGaps: GapType[] = [];
    const resolvedGaps: GapType[] = [];
    let activeGaps = new Set<GapType>(existingActiveGaps);
    const evidence: Record<string, any> = {};

    // ----------------------------------------------------
    // 1. REPEATED MISTAKE GAP (Immediate)
    // ----------------------------------------------------
    if (consecutiveWrong >= 3) {
      if (!activeGaps.has(GapType.repeated_mistake_gap)) {
        detectedGaps.push(GapType.repeated_mistake_gap);
        activeGaps.add(GapType.repeated_mistake_gap);

        evidence[GapType.repeated_mistake_gap] = {
          severity: 'Immediate',
          consecutive_wrong: consecutiveWrong,
          triggered_at: new Date().toISOString(),
        };

        // Persist LearningEvent
        await prisma.learningEvent.create({
          data: {
            student_id: studentId,
            event_type: 'GAP_DETECTED',
            gap_type: GapType.repeated_mistake_gap,
            event_data: {
              subtopic_id: subtopicId,
              severity: 'Immediate',
              consecutive_wrong: consecutiveWrong,
              evidence_data: {
                consecutive_wrong_count: consecutiveWrong,
              },
              triggered_at: new Date().toISOString(),
            },
          },
        });
      }
    } else if (gapResolved && activeGaps.has(GapType.repeated_mistake_gap)) {
      activeGaps.delete(GapType.repeated_mistake_gap);
      resolvedGaps.push(GapType.repeated_mistake_gap);

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
    }

    // ----------------------------------------------------
    // 2. MASTERY DECLINE GAP (Medium)
    // Trigger: mastery dropped > 10 points within 7 days AND current mastery < 70%
    // ----------------------------------------------------
    if (currentMastery < 70) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Fetch history snapshots in the last 7 days
      const recentHistory = await prisma.studentTopicProgressHistory.findMany({
        where: {
          student_id: studentId,
          subtopic_id: subtopicId,
          recorded_at: { gte: sevenDaysAgo },
        },
        orderBy: { recorded_at: 'desc' },
      });

      if (recentHistory.length > 0) {
        // Find max historical mastery in the 7-day window
        let maxHistoricalMastery = currentMastery;
        let referenceSnapshot: (typeof recentHistory)[0] | null = null;

        for (const snap of recentHistory) {
          const snapMax = Math.max(snap.previous_mastery, snap.new_mastery);
          if (snapMax > maxHistoricalMastery) {
            maxHistoricalMastery = snapMax;
            referenceSnapshot = snap;
          }
        }

        const pointDrop = maxHistoricalMastery - currentMastery;

        // Strictly greater than 10 points drop
        if (pointDrop > 10) {
          if (!activeGaps.has(GapType.mastery_decline_gap)) {
            detectedGaps.push(GapType.mastery_decline_gap);
            activeGaps.add(GapType.mastery_decline_gap);

            evidence[GapType.mastery_decline_gap] = {
              severity: 'Medium',
              current_mastery: currentMastery,
              reference_mastery: maxHistoricalMastery,
              point_drop: Math.round(pointDrop * 100) / 100,
              snapshot_timestamp: referenceSnapshot?.recorded_at,
            };

            await prisma.learningEvent.create({
              data: {
                student_id: studentId,
                event_type: 'GAP_DETECTED',
                gap_type: GapType.mastery_decline_gap,
                event_data: {
                  subtopic_id: subtopicId,
                  severity: 'Medium',
                  current_mastery: currentMastery,
                  reference_mastery: maxHistoricalMastery,
                  point_drop: Math.round(pointDrop * 100) / 100,
                  snapshot_timestamp: referenceSnapshot?.recorded_at,
                  evidence_data: {
                    current_mastery: currentMastery,
                    reference_mastery: maxHistoricalMastery,
                    point_drop: pointDrop,
                    window_days: 7,
                  },
                  triggered_at: new Date().toISOString(),
                },
              },
            });
          }
        }
      }
    }

    // ----------------------------------------------------
    // 3. PERSISTENT WEAK GAP (High)
    // Trigger: mastery < 60% across 3 distinct practice sessions for this subtopic
    // ----------------------------------------------------
    if (currentMastery < 60) {
      // Find distinct practice sessions for this subtopic with attempts
      const pastSessions = await prisma.practiceSession.findMany({
        where: {
          student_id: studentId,
          subtopic_id: subtopicId,
          total_questions: { gt: 0 },
        },
        orderBy: { created_at: 'desc' },
        take: 3,
        select: { id: true, total_questions: true, correct_count: true, created_at: true },
      });

      if (pastSessions.length >= 3) {
        // Check if each of the 3 distinct sessions had mastery/accuracy below 60%
        const allSessionsWeak = pastSessions.every((s) => {
          const sessionAccuracy = (s.correct_count / s.total_questions) * 100;
          return sessionAccuracy < 60;
        });

        if (allSessionsWeak) {
          if (!activeGaps.has(GapType.persistent_weak_gap)) {
            detectedGaps.push(GapType.persistent_weak_gap);
            activeGaps.add(GapType.persistent_weak_gap);

            evidence[GapType.persistent_weak_gap] = {
              severity: 'High',
              session_ids: pastSessions.map((s) => s.id),
              current_mastery: currentMastery,
            };

            await prisma.learningEvent.create({
              data: {
                student_id: studentId,
                event_type: 'GAP_DETECTED',
                gap_type: GapType.persistent_weak_gap,
                event_data: {
                  subtopic_id: subtopicId,
                  severity: 'High',
                  session_ids: pastSessions.map((s) => s.id),
                  current_mastery: currentMastery,
                  evidence_data: {
                    session_ids: pastSessions.map((s) => s.id),
                    distinct_sessions_count: pastSessions.length,
                    all_sessions_accuracy_below_60: true,
                  },
                  triggered_at: new Date().toISOString(),
                },
              },
            });
          }
        }
      }
    }

    // ----------------------------------------------------
    // 4. SUBTOPIC STATUS RESOLUTION (Spec A3 Rule):
    // - mastery >= 85% AND no active gap -> Strong
    // - mastery 60–84% AND no active gap -> Developing
    // - mastery < 60% OR any active gap -> Weak
    // ----------------------------------------------------
    const activeGapsList = Array.from(activeGaps);
    let adjustedStatus: 'STRONG' | 'DEVELOPING' | 'WEAK' = 'DEVELOPING';

    if (activeGapsList.length > 0 || currentMastery < 60) {
      adjustedStatus = 'WEAK';
    } else if (currentMastery >= 85) {
      adjustedStatus = 'STRONG';
    } else {
      adjustedStatus = 'DEVELOPING';
    }

    return {
      detectedGaps,
      activeGaps: activeGapsList,
      resolvedGaps,
      adjustedStatus,
      evidence,
    };
  }

  /**
   * Query all active learning gaps for a student across all topics or specific subtopic.
   */
  async getStudentLearningGaps(studentId: string, subtopicId?: string) {
    const progressList = await prisma.studentTopicProgress.findMany({
      where: {
        student_id: studentId,
        ...(subtopicId ? { subtopic_id: subtopicId } : {}),
      },
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

    const activeGapRecords = [];

    for (const prog of progressList) {
      const factors = (prog.contributing_factors as Record<string, any>) || {};
      const activeGaps: GapType[] = factors.active_gaps || [];

      if (activeGaps.length > 0) {
        // Fetch latest events for evidence
        const events = await prisma.learningEvent.findMany({
          where: {
            student_id: studentId,
            gap_type: { in: activeGaps },
            event_type: 'GAP_DETECTED',
          },
          orderBy: { created_at: 'desc' },
        });

        activeGapRecords.push({
          subtopic_id: prog.subtopic_id,
          subtopic_title_ms: prog.subtopic.title_ms,
          subtopic_title_en: prog.subtopic.title_en,
          topic_title_ms: prog.subtopic.topic.title_ms,
          subject_name: prog.subtopic.topic.subject.name_ms,
          mastery_score: prog.mastery_level,
          status: prog.status,
          active_gaps: activeGaps,
          latest_events: events,
        });
      }
    }

    return activeGapRecords;
  }

  /**
   * Query learning gaps for all students enrolled in a teacher's class.
   */
  async getClassLearningGaps(teacherId: string, classId: string) {
    const cls = await prisma.class.findFirst({
      where: { id: classId, teacher_id: teacherId },
      include: {
        enrolments: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!cls) {
      return null;
    }

    const studentIds = cls.enrolments.map((e) => e.student_id);
    const progressList = await prisma.studentTopicProgress.findMany({
      where: {
        student_id: { in: studentIds },
      },
      include: {
        student: { select: { id: true, full_name: true, email: true } },
        subtopic: {
          include: {
            topic: {
              include: { subject: true },
            },
          },
        },
      },
    });

    const results = [];
    for (const prog of progressList) {
      const factors = (prog.contributing_factors as Record<string, any>) || {};
      const activeGaps: GapType[] = factors.active_gaps || [];
      if (activeGaps.length > 0) {
        results.push({
          student: prog.student,
          subtopic_id: prog.subtopic_id,
          subtopic_title_ms: prog.subtopic.title_ms,
          topic_title_ms: prog.subtopic.topic.title_ms,
          subject_name: prog.subtopic.topic.subject.name_ms,
          mastery_score: prog.mastery_level,
          status: prog.status,
          active_gaps: activeGaps,
        });
      }
    }

    return {
      class_id: cls.id,
      class_name: cls.name,
      total_students: studentIds.length,
      students_with_gaps: results,
    };
  }
}

export const learningGapService = new LearningGapService();
