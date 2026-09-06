import { dataStore, SubjectData, StudentListItem, InterventionItem, PracticeAttempt } from './dataStore.js';
import { AnalyticsService } from './analyticsService.js';
import { supabase } from '../config/supabase.js';

export interface ScoringWeights {
  PREVIOUS: number;
  LATEST: number;
}

export const SCORING_WEIGHTS: ScoringWeights = {
  PREVIOUS: 0.7,
  LATEST: 0.3,
};

export interface ProcessPracticeInput {
  studentId: string;
  topic: string;
  subject?: string;
  question: string;
  submittedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds?: number;
  level?: number;
}

export interface PracticeResultResponse {
  isCorrect: boolean;
  correctAnswer: string;
  topicProgress: {
    id: string;
    name: string;
    previousScore: number;
    score: number;
    correctAnswers: number;
    totalAnswers: number;
    accuracyPercent: number;
    status: string;
    timeSpentMinutes: number;
    latestActivityDate: string;
  };
  subjectProgress: {
    id: string;
    name: string;
    previousScore: number;
    score: number;
    mastery: number;
    learningMinutes: number;
    trend: 'up' | 'steady' | 'down';
    strength: string;
    nextFocus: string;
  };
  studentMetrics: {
    overallPerformance: number;
    healthScore: number;
    healthCategory: string;
    learningStreakDays: number;
    studyActivityMinutes: number;
    strengths: string[];
    learningGaps: string[];
    activeRecommendation: any;
  };
  teacherMetrics: {
    classHealthScore: number;
    onTrackCount: number;
    needsSupportCount: number;
    updatedStudent: StudentListItem | null;
  };
}

export class ScoringService {
  /**
   * Calculate smoothed score using configurable weights.
   * If previousScore is 0, the latestScore becomes the new baseline.
   */
  public static calculateWeightedScore(
    previousScore: number,
    latestScore: number,
    weights: ScoringWeights = SCORING_WEIGHTS
  ): number {
    if (previousScore <= 0) {
      return Math.max(0, Math.min(100, Math.round(latestScore)));
    }
    const weighted = (previousScore * weights.PREVIOUS) + (latestScore * weights.LATEST);
    return Math.max(0, Math.min(100, Math.round(weighted)));
  }

  /**
   * Determine mastery level based on score and number of attempts
   */
  public static calculateTopicMastery(score: number): string {
    if (score >= 75) return 'Mastered';
    if (score >= 55) return 'Developing';
    return 'Beginning';
  }

  /**
   * Calculate trend comparing previous and new score
   */
  public static calculateTrend(previous: number, current: number): 'up' | 'steady' | 'down' {
    if (current > previous + 1) return 'up';
    if (current < previous - 1) return 'down';
    return 'steady';
  }

  /**
   * Core Live Practice-Result Flow:
   * 1. Save question attempt to practice_attempts
   * 2. Update student_topic_progress with weighted scoring
   * 3. Update student_subject_progress
   * 4. Recalculate overall performance, health score, streak, gaps, strengths, recommendations
   * 5. Recalculate teacher metrics and interventions
   * 6. Save to Supabase and local store
   */
  public static async processPracticeResult(input: ProcessPracticeInput): Promise<PracticeResultResponse> {
    const studentId = input.studentId || 'student-user-001';
    const topicRaw = input.topic || 'subtraction';
    const topicKey = topicRaw.toLowerCase().trim();
    const topicTitle = topicRaw.charAt(0).toUpperCase() + topicRaw.slice(1);
    const timeSpentSeconds = Number(input.timeSpentSeconds) || 5;
    const timeSpentMinutes = Math.max(1, Math.round(timeSpentSeconds / 60));

    // Derive subject
    let subjectName = input.subject || 'Mathematics';
    if (['addition', 'subtraction', 'multiplication', 'division', 'fractions'].includes(topicKey)) {
      subjectName = 'Mathematics';
    } else if (['living things', 'cell structure', 'energy transfer', 'matter', 'plants'].includes(topicKey)) {
      subjectName = 'Science';
    } else if (['reading comprehension', 'vocabulary', 'sentence structure', 'grammar'].includes(topicKey)) {
      subjectName = 'English';
    } else if (['kata nama', 'kata kerja', 'ayat majmuk', 'penanda wacana'].includes(topicKey)) {
      subjectName = 'Bahasa Melayu';
    }
    const subjectId = subjectName.toLowerCase().replace(/\s+/g, '-');

    // 1. Record practice attempt
    const attempt: PracticeAttempt = {
      id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      studentId,
      topic: topicTitle,
      level: input.level || 1,
      question: input.question,
      submittedAnswer: String(input.submittedAnswer),
      correctAnswer: String(input.correctAnswer),
      isCorrect: input.isCorrect,
      timeSpentSeconds,
      attemptedAt: new Date().toISOString()
    };
    dataStore.data.practiceAttempts.push(attempt);

    // 2. Locate or initialize Subject in dataStore
    let subject = dataStore.data.subjects.find(s => s.id === subjectId || s.name.toLowerCase() === subjectName.toLowerCase());
    if (!subject) {
      subject = {
        id: subjectId,
        name: subjectName,
        score: 50,
        mastery: 50,
        learningMinutes: 0,
        status: 'Building skills',
        strength: topicTitle,
        topics: [],
        learningGaps: []
      };
      dataStore.data.subjects.push(subject);
    }
    const previousSubjectScore = subject.score || 0;

    // Locate or initialize Topic
    let topicItem = subject.topics.find(t => t.id === topicKey || t.name.toLowerCase() === topicKey);
    if (!topicItem) {
      topicItem = {
        id: topicKey,
        name: topicTitle,
        score: 50,
        status: 'Developing',
        correctAnswers: 0,
        totalAnswers: 0,
        timeSpentMinutes: 0
      };
      subject.topics.push(topicItem);
    }

    const previousTopicScore = topicItem.score || 50;
    const attemptScore = input.isCorrect ? 100 : 0;

    // Apply weighted recalculation: (previous * 0.7) + (latest * 0.3)
    const newTopicScore = this.calculateWeightedScore(previousTopicScore, attemptScore, SCORING_WEIGHTS);
    
    topicItem.correctAnswers = (topicItem.correctAnswers || 0) + (input.isCorrect ? 1 : 0);
    topicItem.totalAnswers = (topicItem.totalAnswers || 0) + 1;
    topicItem.score = newTopicScore;
    topicItem.status = this.calculateTopicMastery(newTopicScore);
    topicItem.timeSpentMinutes = (topicItem.timeSpentMinutes || 0) + timeSpentMinutes;
    const accuracyPercent = Math.round((topicItem.correctAnswers / topicItem.totalAnswers) * 100);
    const nowIso = new Date().toISOString();

    // 3. Update Subject Progress
    const totalTopicScores = subject.topics.reduce((sum, t) => sum + t.score, 0);
    const newSubjectScore = Math.round(totalTopicScores / Math.max(1, subject.topics.length));
    subject.score = newSubjectScore;
    subject.learningMinutes = (subject.learningMinutes || 0) + timeSpentMinutes;
    subject.mastery = newSubjectScore >= 80 ? 90 : newSubjectScore >= 65 ? 75 : 55;
    subject.status = newSubjectScore >= 80 ? 'Mastered' : newSubjectScore >= 65 ? 'On track' : 'Building skills';

    const sortedTopics = [...subject.topics].sort((a, b) => b.score - a.score);
    const strongestTopic = sortedTopics[0]?.name || topicTitle;
    const weakestTopic = sortedTopics[sortedTopics.length - 1]?.name || topicTitle;
    subject.strength = strongestTopic;
    const subjectTrend = this.calculateTrend(previousSubjectScore, newSubjectScore);

    // 4. Recalculate Student Overall Metrics
    const allSubjects = dataStore.data.subjects;
    const totalAllScores = allSubjects.reduce((acc, s) => acc + (s.score || 0), 0);
    const overallPerformance = Math.round(totalAllScores / Math.max(1, allSubjects.length));
    
    // Increment study minutes & streak
    dataStore.data.dashboard.studyActivityMinutes = (dataStore.data.dashboard.studyActivityMinutes || 0) + timeSpentMinutes;
    dataStore.data.dashboard.overallPerformance = overallPerformance;
    if (!dataStore.data.dashboard.learningStreakDays) {
      dataStore.data.dashboard.learningStreakDays = 1;
    }

    // Identify Strengths (>= 75%) and Gaps (< 60%)
    const allTopicsList = allSubjects.flatMap(s => s.topics);
    const strengths = allTopicsList.filter(t => t.score >= 70).map(t => `${t.name} (${t.score}%)`);
    const learningGaps = allTopicsList.filter(t => t.score < 60).map(t => `${t.name} (${t.score}%)`);

    // Insights & Adaptive Recommendation Logic:
    // Remove recommendation when improved above 75%, add new recommendation when weak (< 60%)
    let activeRecommendation = null;
    if (newTopicScore >= 75) {
      // Resolved! Find another topic needing attention
      const nextWeak = allTopicsList.find(t => t.score < 65);
      if (nextWeak) {
        activeRecommendation = {
          id: `rec-${nextWeak.id}`,
          title: `Strengthen ${nextWeak.name}`,
          reason: `Your score in ${nextWeak.name} is ${nextWeak.score}%. A 15-minute focused session will help establish mastery.`,
          currentScore: nextWeak.score,
          timeSpentMinutes: nextWeak.timeSpentMinutes || 15,
          recentCorrect: nextWeak.correctAnswers || 1,
          recentTotal: nextWeak.totalAnswers || 3,
          recommendedDurationMinutes: 15
        };
      } else {
        activeRecommendation = {
          id: 'rec-challenge',
          title: `Advance in ${strongestTopic}`,
          reason: `Great mastery! You have achieved ${newTopicScore}% in ${topicTitle}. You are ready for extension challenges.`,
          currentScore: newTopicScore,
          timeSpentMinutes: topicItem.timeSpentMinutes,
          recentCorrect: topicItem.correctAnswers,
          recentTotal: topicItem.totalAnswers,
          recommendedDurationMinutes: 15
        };
      }
    } else {
      activeRecommendation = {
        id: `rec-${topicKey}`,
        title: `Build confidence in ${topicTitle}`,
        reason: `Your ${topicTitle} score is ${newTopicScore}%. Continuing adaptive practice will close this learning gap.`,
        currentScore: newTopicScore,
        timeSpentMinutes: topicItem.timeSpentMinutes,
        recentCorrect: topicItem.correctAnswers,
        recentTotal: topicItem.totalAnswers,
        recommendedDurationMinutes: 15
      };
    }
    dataStore.data.dashboard.recommendedPractice = {
      title: activeRecommendation.title,
      description: activeRecommendation.reason
    };

    // 5. Recalculate Student in Teacher Directory & Class Health
    let studentItem = dataStore.data.students.find(s => s.id === studentId);
    if (!studentItem) {
      studentItem = {
        id: studentId,
        name: 'Active Learner',
        initials: 'AL',
        primarySubject: subjectName,
        learningMinutes: 0,
        healthScore: 60,
        status: 'on track',
        trend: 'steady'
      };
      dataStore.data.students.push(studentItem);
    }

    studentItem.learningMinutes += timeSpentMinutes;
    studentItem.primarySubject = subjectName;
    studentItem.trend = subjectTrend;

    // Health score: 40% mastery, 30% activity, 20% streak, 10% trend
    const healthResult = AnalyticsService.calculateStudentHealthScore(studentId);
    studentItem.healthScore = healthResult.score;
    studentItem.status = healthResult.category;

    // Class aggregate calculations
    const allStudents = dataStore.data.students;
    const classHealthScore = allStudents.length
      ? Math.round(allStudents.reduce((acc, s) => acc + (s.healthScore ?? 0), 0) / allStudents.length)
      : 0;
    const onTrackCount = allStudents.filter(s => s.status === 'thriving' || s.status === 'on track').length;
    const needsSupportCount = allStudents.filter(s => s.status === 'support' || s.status === 'watch').length;

    // Update teacher interventions if needed
    if (studentItem.healthScore < 55) {
      const existingInv = dataStore.data.interventions.find(i => i.studentId === studentId && i.status === 'problem');
      if (!existingInv) {
        dataStore.data.interventions.push({
          id: `inv-${Date.now()}`,
          studentId,
          studentName: studentItem.name,
          subject: subjectName,
          topic: weakestTopic,
          classification: 'Needs targeted support',
          recommendation: `Schedule 15-min guided session on ${weakestTopic}`,
          healthScore: studentItem.healthScore,
          topicScore: `${newTopicScore}%`,
          learningMinutes: `${studentItem.learningMinutes} min`,
          status: 'problem',
          createdAt: nowIso
        });
      }
    } else if (studentItem.healthScore >= 75) {
      // Mark problem interventions as review or complete
      dataStore.data.interventions.forEach(inv => {
        if (inv.studentId === studentId && inv.status === 'problem') {
          inv.status = 'review';
        }
      });
    }

    // Save locally
    dataStore.save();

    // 6. Supabase Persistence (if configured)
    if (supabase) {
      try {
        // Attempt
        await supabase.from('practice_attempts').insert({
          student_id: studentId,
          topic_id: topicKey,
          subject_id: subjectId,
          level: input.level || 1,
          question: input.question,
          submitted_answer: String(input.submittedAnswer),
          correct_answer: String(input.correctAnswer),
          is_correct: input.isCorrect,
          time_spent_seconds: timeSpentSeconds,
          attempted_at: nowIso
        });

        // Topic Progress
        await supabase.from('student_topic_progress').upsert({
          student_id: studentId,
          topic_id: topicKey,
          score: newTopicScore,
          correct_answers: topicItem.correctAnswers,
          total_answers: topicItem.totalAnswers,
          accuracy_percent: accuracyPercent,
          status: topicItem.status,
          time_spent_seconds: timeSpentSeconds,
          latest_activity_date: nowIso
        });

        // Subject Progress
        await supabase.from('student_subject_progress').upsert({
          student_id: studentId,
          subject_id: subjectId,
          score: newSubjectScore,
          mastery: subject.mastery,
          learning_minutes: subject.learningMinutes,
          trend: subjectTrend,
          status: subject.status,
          strength: strongestTopic,
          latest_activity_date: nowIso
        });

        // Recommendations
        if (activeRecommendation) {
          await supabase.from('recommendations').upsert({
            id: activeRecommendation.id,
            student_id: studentId,
            subject_id: subjectId,
            topic_id: topicKey,
            title: activeRecommendation.title,
            reason: activeRecommendation.reason,
            current_score: activeRecommendation.currentScore,
            time_spent_minutes: activeRecommendation.timeSpentMinutes,
            recommended_duration_minutes: activeRecommendation.recommendedDurationMinutes,
            status: 'active'
          });
        }
      } catch (err: any) {
        console.warn('Supabase practice sync notice:', err?.message || err);
      }
    }

    return {
      isCorrect: input.isCorrect,
      correctAnswer: input.correctAnswer,
      topicProgress: {
        id: topicKey,
        name: topicTitle,
        previousScore: previousTopicScore,
        score: newTopicScore,
        correctAnswers: topicItem.correctAnswers,
        totalAnswers: topicItem.totalAnswers,
        accuracyPercent,
        status: topicItem.status,
        timeSpentMinutes: topicItem.timeSpentMinutes,
        latestActivityDate: nowIso
      },
      subjectProgress: {
        id: subjectId,
        name: subjectName,
        previousScore: previousSubjectScore,
        score: newSubjectScore,
        mastery: subject.mastery,
        learningMinutes: subject.learningMinutes,
        trend: subjectTrend,
        strength: strongestTopic,
        nextFocus: weakestTopic
      },
      studentMetrics: {
        overallPerformance,
        healthScore: studentItem.healthScore,
        healthCategory: studentItem.status,
        learningStreakDays: dataStore.data.dashboard.learningStreakDays,
        studyActivityMinutes: dataStore.data.dashboard.studyActivityMinutes,
        strengths: strengths.length ? strengths : ['Foundation skills'],
        learningGaps: learningGaps.length ? learningGaps : ['Skill refinement'],
        activeRecommendation
      },
      teacherMetrics: {
        classHealthScore,
        onTrackCount,
        needsSupportCount,
        updatedStudent: studentItem
      }
    };
  }
}
