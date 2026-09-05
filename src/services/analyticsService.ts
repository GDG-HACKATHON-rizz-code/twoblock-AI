import { dataStore } from './dataStore.js';

export interface HealthScoreBreakdown {
  score: number;
  category: 'thriving' | 'on track' | 'watch' | 'support';
  statusClass: 'good' | 'mid' | 'bad';
  factors: {
    masteryScore: number;
    activityMinutes: number;
    streakDays: number;
    trend: 'up' | 'steady' | 'down';
  };
}

export class AnalyticsService {
  /**
   * Calculate overall student performance: weighted average of subject scores
   */
  static calculateStudentOverallPerformance(studentId: string): number {
    const subjects = dataStore.data.subjects;
    if (!subjects || subjects.length === 0) return 0;

    const totalScore = subjects.reduce((sum, s) => sum + (s.score || 0), 0);
    return Math.round(totalScore / subjects.length);
  }

  /**
   * Calculate student health score (0-100):
   * Combines mastery (40%), activity (30%), streak consistency (20%), and trend (10%).
   */
  static calculateStudentHealthScore(studentId: string): HealthScoreBreakdown {
    const studentItem = dataStore.data.students.find(s => s.id === studentId);
    const overallPerformance = this.calculateStudentOverallPerformance(studentId);
    const streakDays = dataStore.data.dashboard.learningStreakDays || 0;
    const learningMinutes = studentItem?.learningMinutes || dataStore.data.dashboard.studyActivityMinutes || 0;
    const trend = studentItem?.trend || 'steady';

    // 1. Mastery component (40% weight): overall performance (0-100)
    const masteryComponent = overallPerformance * 0.4;

    // 2. Activity component (30% weight): 200+ mins per week = 100%
    const activityRatio = Math.min(1.0, learningMinutes / 200);
    const activityComponent = activityRatio * 100 * 0.3;

    // 3. Streak component (20% weight): 7+ days = 100%
    const streakRatio = Math.min(1.0, streakDays / 7);
    const streakComponent = streakRatio * 100 * 0.2;

    // 4. Trend component (10% weight): up = 10, steady = 6, down = 2
    const trendPoints = trend === 'up' ? 10 : trend === 'steady' ? 6 : 2;

    const rawScore = Math.round(masteryComponent + activityComponent + streakComponent + trendPoints);
    const score = Math.max(0, Math.min(100, studentItem?.healthScore ?? rawScore));

    const category = this.getStudentCategory(score);
    const statusClass = score >= 75 ? 'good' : score >= 55 ? 'mid' : 'bad';

    return {
      score,
      category,
      statusClass,
      factors: {
        masteryScore: overallPerformance,
        activityMinutes: learningMinutes,
        streakDays,
        trend
      }
    };
  }

  /**
   * Performance category thresholds:
   * Good: 75 and above
   * Mid: 55-74
   * Bad/support: below 55
   */
  static getStudentCategory(healthScore: number): 'thriving' | 'on track' | 'watch' | 'support' {
    if (healthScore >= 85) return 'thriving';
    if (healthScore >= 75) return 'on track';
    if (healthScore >= 55) return 'watch';
    return 'support';
  }

  /**
   * Learning gaps: topics/subtopics below a configurable mastery threshold (default 60%)
   */
  static identifyLearningGaps(studentId: string, threshold = 60): Record<string, string[]> {
    const gaps: Record<string, string[]> = {};
    const subjects = dataStore.data.subjects;

    for (const sub of subjects) {
      const weakTopics = sub.topics
        .filter(t => t.score < threshold)
        .map(t => t.name);

      // Merge with curriculum prerequisite gaps if defined
      const combined = Array.from(new Set([...(sub.learningGaps || []), ...weakTopics]));
      gaps[sub.name] = combined.slice(0, 3);
    }

    return gaps;
  }

  /**
   * Teacher class health score: average active student health score
   */
  static calculateClassHealthScore(classId?: string): {
    classHealthScore: number;
    onTrackCount: number;
    needsSupportCount: number;
    averageLoginMinutesPerDay: number;
  } {
    const students = dataStore.data.students;
    if (!students || students.length === 0) {
      return {
        classHealthScore: 0,
        onTrackCount: 0,
        needsSupportCount: 0,
        averageLoginMinutesPerDay: 0
      };
    }

    const totalHealth = students.reduce((sum, s) => sum + s.healthScore, 0);
    const classHealthScore = Math.round(totalHealth / students.length);

    const onTrackCount = students.filter(s => s.healthScore >= 70).length;
    const needsSupportCount = students.filter(s => s.healthScore < 55).length;

    const totalMinutes = students.reduce((sum, s) => sum + s.learningMinutes, 0);
    const avgMinsPerWeek = Math.round(totalMinutes / students.length);
    const averageLoginMinutesPerDay = Math.round(avgMinsPerWeek / 6);

    return {
      classHealthScore,
      onTrackCount,
      needsSupportCount,
      averageLoginMinutesPerDay
    };
  }

  /**
   * Update student topic progress and recalculate scores after a practice round
   */
  static recordPracticeSessionResults(params: {
    studentId: string;
    topicName: string;
    correctCount: number;
    wrongCount: number;
  }) {
    const { studentId, topicName, correctCount, wrongCount } = params;
    const total = correctCount + wrongCount;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const status = score >= 80 ? 'Strong' : score >= 55 ? 'Developing' : 'Needs focus';

    // Find in math subject topics
    const mathSub = dataStore.data.subjects.find(s => s.id === 'mathematics');
    if (mathSub) {
      const topic = mathSub.topics.find(t => t.name.toLowerCase() === topicName.toLowerCase() || t.id.toLowerCase() === topicName.toLowerCase());
      if (topic) {
        topic.score = score;
        topic.status = status;
        topic.correctAnswers = (topic.correctAnswers || 0) + correctCount;
        topic.totalAnswers = (topic.totalAnswers || 0) + total;
      }

      // Recalculate Mathematics subject score
      const totalTopicScores = mathSub.topics.reduce((acc, t) => acc + t.score, 0);
      mathSub.score = Math.round(totalTopicScores / mathSub.topics.length);
      mathSub.learningMinutes += 15;
    }

    // Update student dashboard learning activity & streak
    if (dataStore.data.dashboard) {
      dataStore.data.dashboard.studyActivityMinutes = (dataStore.data.dashboard.studyActivityMinutes || 385) + 15;
      dataStore.data.dashboard.overallPerformance = this.calculateStudentOverallPerformance(studentId);
    }

    // Add to recent activity
    dataStore.data.recentActivity.unshift({
      type: 'practice',
      subject: 'Mathematics',
      topic: topicName,
      durationMinutes: 15,
      date: new Date().toISOString().split('T')[0]
    });

    dataStore.save();
    return { score, status };
  }
}
