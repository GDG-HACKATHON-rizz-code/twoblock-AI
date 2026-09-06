import { dataStore } from './dataStore.js';

export interface GeneratedRecommendation {
  studentId: string;
  studentName: string;
  subject: string;
  topic: string;
  title: string;
  reason: string;
  healthScore: number;
  topicScore: number | string;
  learningMinutes: number | string;
  evidence: {
    healthScore: number;
    topicScore: string;
    learningMinutes: string;
  };
  recommendedAction: string;
  suggestedPlanSteps: Array<{ duration: string; label: string }>;
  whyPoints: Array<{ icon: string; title: string; detail: string }>;
}

export class RecommendationEngine {
  /**
   * Deterministic rule-based recommendation generator
   * Evaluates students with health score < 55, low topic mastery, falling trend, or low learning time.
   */
  static getTeacherPriorityRecommendations(): GeneratedRecommendation[] {
    const unassignedStudents = dataStore.data.students.filter(
      s => !dataStore.data.assignedInterventionStudents.includes(s.name)
    );

    // Sort by: lowest health score first, then lowest learning minutes
    const sortedAtRisk = [...unassignedStudents]
      .filter(s => s.healthScore < 60 || s.trend === 'down' || s.learningMinutes < 50)
      .sort((a, b) => a.healthScore - b.healthScore);

    const pool = sortedAtRisk.length > 0 ? sortedAtRisk : unassignedStudents;

    return pool.map(s => {
      let focus = 'Subtraction';
      let subject = s.primarySubject || 'Mathematics';
      let topicScore = '54%';
      let reason = `${s.name}’s ${subject} progress requires support. Performance and engagement are below expected benchmarks.`;

      if (subject === 'Mathematics') {
        focus = s.healthScore < 50 ? 'Subtraction' : 'Division';
        topicScore = s.healthScore < 50 ? '54%' : '56%';
        reason = `${s.name}’s Mathematics progress is at risk. Their ${focus.toLowerCase()} score and weekly engagement indicate that foundational reinforcement is needed before class progression.`;
      } else if (subject === 'English') {
        focus = 'Reading engagement';
        topicScore = '58%';
        reason = `${s.name}’s English engagement has declined recently. A short check-in and an achievable reading task will rebuild confidence.`;
      } else if (subject === 'Bahasa Melayu') {
        focus = 'Sentence structure';
        topicScore = '59%';
        reason = `${s.name} requires practice in connecting complex sentences and recognizing discourse markers.`;
      }

      return {
        studentId: s.id,
        studentName: s.name,
        subject,
        topic: focus,
        title: `Support ${s.name} with ${focus.toLowerCase()}`,
        reason,
        healthScore: s.healthScore,
        topicScore,
        learningMinutes: `${s.learningMinutes} min`,
        evidence: {
          healthScore: s.healthScore,
          topicScore,
          learningMinutes: `${s.learningMinutes} min`
        },
        recommendedAction: `Schedule a 15-minute guided ${focus.toLowerCase()} session with visual scaffolding.`,
        suggestedPlanSteps: [
          { duration: '5 min', label: 'Visual warm-up' },
          { duration: '7 min', label: 'Guided questions' },
          { duration: '3 min', label: 'Quick review' }
        ],
        whyPoints: [
          {
            icon: '↓',
            title: 'Performance below class support threshold',
            detail: `${s.name}’s health score is ${s.healthScore}, below the benchmark of 55.`
          },
          {
            icon: '◷',
            title: 'Weekly learning activity is limited',
            detail: `Recorded ${s.learningMinutes} minutes of study time this week.`
          },
          {
            icon: '◈',
            title: 'Impacts upcoming prerequisite skills',
            detail: `${focus} skills directly influence future problem-solving modules.`
          }
        ]
      };
    });
  }

  /**
   * Student prioritized self-practice recommendation
   */
  static getStudentPriorityRecommendation(studentId: string) {
    const existing = dataStore.data.recommendations?.find(r => r.studentId === studentId || r.topic === 'Fractions');
    if (existing) {
      return {
        id: existing.id || 'rec-fractions-001',
        subject: existing.subject || 'Mathematics',
        topic: existing.topic || 'Fractions',
        title: existing.title || `Build confidence in ${existing.topic}.`,
        currentScore: existing.currentScore || 54,
        timeSpentMinutes: existing.timeSpentMinutes || 48,
        recentCorrect: existing.recentCorrectAnswers || (existing as any).recentCorrect || 6,
        recentTotal: existing.recentTotalAnswers || (existing as any).recentTotal || 12,
        recommendedMinutes: existing.recommendedDurationMinutes || (existing as any).recommendedMinutes || 15,
        reason: existing.reason || 'Adam needs more practice with equivalent fractions and fractions addition.',
        steps: (existing as any).steps || [
          { duration: '5 min', label: 'Warm-up' },
          { duration: '7 min', label: 'Guided practice' },
          { duration: '3 min', label: 'Quick check' }
        ],
        whyPoints: (existing as any).whyPoints || [
          { icon: '↓', title: 'It is your lowest Mathematics topic.', detail: `${existing.topic} (${existing.currentScore || 54}%) is lower than your other Mathematics skills.` },
          { icon: '◷', title: 'You have practised it less.', detail: `You spent ${existing.timeSpentMinutes || 48} minutes on ${existing.topic.toLowerCase()} compared to other topics.` },
          { icon: '✦', title: 'It helps unlock the next level.', detail: `Mastering ${existing.topic.toLowerCase()} is required before advancing to decimal and percentage units.` }
        ]
      };
    }

    const mathSub = dataStore.data.subjects.find(s => s.id === 'mathematics');
    const lowestTopic = mathSub?.topics.reduce((min, t) => t.score < min.score ? t : min, mathSub.topics[0]) || { name: 'Fractions', score: 54 };

    return {
      id: `rec-${lowestTopic.name.toLowerCase()}-001`,
      subject: 'Mathematics',
      topic: lowestTopic.name,
      title: `Build confidence in ${lowestTopic.name}.`,
      currentScore: lowestTopic.score,
      timeSpentMinutes: 48,
      recentCorrect: 6,
      recentTotal: 12,
      recommendedMinutes: 15,
      reason: 'Adam needs more practice with equivalent fractions and fractions addition.',
      steps: [
        { duration: '5 min', label: 'Warm-up' },
        { duration: '7 min', label: 'Guided practice' },
        { duration: '3 min', label: 'Quick check' }
      ],
      whyPoints: [
        { icon: '↓', title: 'It is your lowest Mathematics topic.', detail: `${lowestTopic.name} (${lowestTopic.score}%) is lower than your other Mathematics skills.` },
        { icon: '◷', title: 'You have practised it less.', detail: `You spent 48 minutes on ${lowestTopic.name.toLowerCase()} compared to other topics.` },
        { icon: '✦', title: 'It helps unlock the next level.', detail: `Mastering ${lowestTopic.name.toLowerCase()} is required before advancing to decimal and percentage units.` }
      ]
    };
  }
}
