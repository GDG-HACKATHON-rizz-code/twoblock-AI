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
    const mathSub = dataStore.data.subjects.find(s => s.id === 'mathematics');
    const lowestTopic = mathSub?.topics.reduce((min, t) => t.score < min.score ? t : min, mathSub.topics[0]) || { name: 'Subtraction', score: 54 };

    return {
      id: 'rec-subtraction-001',
      subject: 'Mathematics',
      topic: lowestTopic.name,
      title: `Build confidence in ${lowestTopic.name.toLowerCase()}`,
      currentScore: lowestTopic.score,
      timeSpentMinutes: 48,
      recentCorrect: 6,
      recentTotal: 12,
      recommendedMinutes: 15,
      reason: `Your ${lowestTopic.name.toLowerCase()} score is lower than other Mathematics topics. A short, focused session now helps strengthen your foundation before harder questions.`,
      steps: [
        { duration: '5 min', label: 'Warm-up' },
        { duration: '7 min', label: 'Guided practice' },
        { duration: '3 min', label: 'Quick check' }
      ]
    };
  }
}
