import { Request, Response, NextFunction } from 'express';
import { dataStore } from '../services/dataStore.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { RecommendationEngine } from '../services/recommendationEngine.js';
import { diagnosticEngine } from '../services/diagnosticEngine.js';
import { ScoringService } from '../services/scoringService.js';
import { GeminiPracticeService } from '../services/geminiPracticeService.js';
import { sendSuccess } from '../utils/response.js';

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || Object.keys(dataStore.data.studentProfiles)[0] || 'new-student-001';

    // If zero subjects / no assessment completed yet, return empty state
    if (dataStore.data.subjects.length === 0) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyMessage: 'Complete your Quick Learning Check to personalise your learning.',
        overallPerformance: 0,
        healthScore: 0,
        healthCategory: 'beginning',
        learningStreakDays: 0,
        streakIncreaseThisWeek: 0,
        studyActivityMinutes: 0,
        studyActivityChangePercent: 0,
        availableFocusMinutes: 0,
        bestFocusWindow: '—',
        weeklyActivity: [],
        subjects: [],
        learningGaps: {},
        recommendedPractice: null
      });
      return;
    }

    const overallPerformance = AnalyticsService.calculateStudentOverallPerformance(studentId);
    const health = AnalyticsService.calculateStudentHealthScore(studentId);
    const learningGaps = AnalyticsService.identifyLearningGaps(studentId);
    const recommendation = RecommendationEngine.getStudentPriorityRecommendation(studentId);

    const dashboard = {
      hasAssessment: true,
      overallPerformance,
      healthScore: health.score,
      healthCategory: health.category,
      learningStreakDays: dataStore.data.dashboard.learningStreakDays || 1,
      streakIncreaseThisWeek: dataStore.data.dashboard.streakIncreaseThisWeek || 1,
      studyActivityMinutes: dataStore.data.dashboard.studyActivityMinutes || 15,
      studyActivityChangePercent: dataStore.data.dashboard.studyActivityChangePercent || 0,
      availableFocusMinutes: dataStore.data.dashboard.availableFocusMinutes || 45,
      bestFocusWindow: dataStore.data.dashboard.bestFocusWindow || '7:00 PM',
      weeklyActivity: dataStore.data.dashboard.weeklyActivity || [
        { day: 'Mon', minutes: 0 },
        { day: 'Tue', minutes: 0 },
        { day: 'Wed', minutes: 0 },
        { day: 'Thu', minutes: 0 },
        { day: 'Fri', minutes: 0 },
        { day: 'Sat', minutes: 0 },
        { day: 'Sun', minutes: 15 }
      ],
      subjects: dataStore.data.subjects.map(s => ({
        id: s.id,
        name: s.name,
        shortName: s.shortName || s.name,
        score: s.score,
        mastery: s.mastery || s.score,
        status: s.status
      })),
      learningGaps,
      recommendedPractice: {
        topic: recommendation.topic,
        subject: recommendation.subject,
        durationMinutes: recommendation.recommendedMinutes,
        description: `Strengthen ${recommendation.topic.toLowerCase()} in a ${recommendation.recommendedMinutes}-minute session calibrated to your pace.`
      }
    };

    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
}

export async function getLearning(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (dataStore.data.subjects.length === 0) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyMessage: 'Complete your Quick Learning Check to personalise your learning.',
        subjects: []
      });
      return;
    }

    const subjects = dataStore.data.subjects.map(s => {
      const hours = Math.floor(s.learningMinutes / 60);
      const mins = s.learningMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      const lowestTopic = s.topics.reduce((low, t) => t.score < low.score ? t : low, s.topics[0]);

      return {
        id: s.id,
        name: s.name,
        shortName: s.shortName || s.name,
        score: s.score,
        learningMinutes: s.learningMinutes,
        learningTimeFormatted: timeStr,
        status: s.status,
        strongestSubtopic: s.strength,
        nextFocus: lowestTopic?.name || s.strength,
        topics: s.topics.map(t => ({
          id: t.id,
          name: t.name,
          score: t.score,
          status: t.status
        }))
      };
    });

    sendSuccess(res, { hasAssessment: true, subjects });
  } catch (err) {
    next(err);
  }
}

export async function getPracticeQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const topic = (req.query.topic as string) || 'addition';
    const level = parseInt(req.query.level as string) || 1;
    const grade = parseInt(req.query.grade as string) || 2;
    const subject = (req.query.subject as string) || 'Mathematics';

    const question = await GeminiPracticeService.generateAdaptiveQuestion(topic, grade, level, subject);
    sendSuccess(res, question);
  } catch (err) {
    next(err);
  }
}

export async function submitAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || 'student-user-001';
    const { topic, studentAnswer, correctAnswer, timeSpentSeconds, questionText, question, subject, level } = req.body;

    const isCorrect = String(studentAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

    const result = await ScoringService.processPracticeResult({
      studentId,
      topic: topic || 'addition',
      subject: subject || 'Mathematics',
      question: questionText || question || '',
      submittedAnswer: String(studentAnswer),
      correctAnswer: String(correctAnswer),
      isCorrect,
      timeSpentSeconds: Number(timeSpentSeconds) || 5,
      level: Number(level) || 1
    });

    sendSuccess(res, {
      ...result,
      isCorrect,
      correctAnswer,
      previousTopicScore: result.topicProgress.previousScore,
      newTopicScore: result.topicProgress.score,
      topicAccuracy: result.topicProgress.accuracyPercent,
      topicMastery: result.topicProgress.status,
      subjectScore: result.subjectProgress.score,
      subjectMastery: result.subjectProgress.mastery,
      overallPerformance: result.studentMetrics.overallPerformance,
      healthScore: result.studentMetrics.healthScore,
      learningStreak: result.studentMetrics.learningStreakDays,
      recommendation: result.studentMetrics.activeRecommendation,
      feedback: isCorrect ? 'Correct! Great thinking.' : `Not quite — the answer was ${correctAnswer}.`
    });
  } catch (err) {
    next(err);
  }
}

export async function processPracticeResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || req.body.studentId || 'student-user-001';
    const result = await ScoringService.processPracticeResult({
      ...req.body,
      studentId
    });
    sendSuccess(res, {
      ...result,
      isCorrect: result.topicProgress.accuracyPercent === 100,
      previousTopicScore: result.topicProgress.previousScore,
      newTopicScore: result.topicProgress.score,
      topicAccuracy: result.topicProgress.accuracyPercent,
      topicMastery: result.topicProgress.status,
      subjectScore: result.subjectProgress.score,
      subjectMastery: result.subjectProgress.mastery,
      overallPerformance: result.studentMetrics.overallPerformance,
      healthScore: result.studentMetrics.healthScore,
      learningStreak: result.studentMetrics.learningStreakDays,
      recommendation: result.studentMetrics.activeRecommendation
    });
  } catch (err) {
    next(err);
  }
}

export async function endPracticeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || 'student-user-001';
    const { topic, correctCount, wrongCount } = req.body;
    const total = (Number(correctCount) || 0) + (Number(wrongCount) || 0);
    const roundScore = total > 0 ? Math.round((Number(correctCount) / total) * 100) : 0;
    const mastery = roundScore >= 80 ? 'Strong' : roundScore >= 55 ? 'Developing' : 'Beginning';

    dataStore.data.dashboard.studyActivityMinutes = (dataStore.data.dashboard.studyActivityMinutes || 0) + 5;
    dataStore.save();

    sendSuccess(res, {
      topic,
      correct: Number(correctCount) || 0,
      wrong: Number(wrongCount) || 0,
      score: roundScore,
      mastery,
      message: `You completed the practice round in ${topic}.`
    });
  } catch (err) {
    next(err);
  }
}

export async function getInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (dataStore.data.subjects.length === 0 || !dataStore.data.recommendations || dataStore.data.recommendations.length === 0) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyMessage: 'Your recommendations will appear after your first learning check.',
        priority: null,
        whyPoints: [],
        steps: [],
        otherSignals: []
      });
      return;
    }

    const studentId = req.user?.id || 'new-student-001';
    const priority = RecommendationEngine.getStudentPriorityRecommendation(studentId);

    const insights = {
      hasAssessment: true,
      priority,
      whyPoints: [
        {
          icon: '↓',
          title: `It is your lowest Mathematics topic.`,
          detail: `${priority.topic} is lower than your strongest skill, Addition.`
        },
        {
          icon: '◷',
          title: 'You have practised it less.',
          detail: `You spent ${priority.timeSpentMinutes} minutes on ${priority.topic.toLowerCase()} compared to other topics.`
        },
        {
          icon: '✦',
          title: 'It helps unlock the next level.',
          detail: `Improving ${priority.topic.toLowerCase()} will make number problems and division easier.`
        }
      ],
      steps: priority.steps,
      otherSignals: [
        { icon: '✓', title: 'Science is a strength', detail: 'Demonstrated strong accuracy during your assessment.' },
        { icon: '◈', title: 'Best study time: 7:00 PM', detail: 'Your focus sessions are calibrated to this window.' }
      ]
    };

    sendSuccess(res, insights);
  } catch (err) {
    next(err);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (dataStore.data.subjects.length === 0) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyMessage: 'Not enough learning data to generate a report yet.',
        period: 'September 2026',
        overallPerformance: 0,
        totalLearningTimeFormatted: '0m',
        learningStreakDays: 0,
        practiceRoundsCompleted: 0,
        subjects: [],
        trendChart: [],
        mathTopicMastery: [],
        studyHabits: [],
        achievements: [],
        recommendedNextStep: null
      });
      return;
    }

    const studentId = req.user?.id || 'new-student-001';
    const overallPerformance = AnalyticsService.calculateStudentOverallPerformance(studentId);
    const mathSub = dataStore.data.subjects.find(s => s.id === 'mathematics');

    const totalMinutes = dataStore.data.subjects.reduce((sum, s) => sum + s.learningMinutes, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remMins = totalMinutes % 60;

    const report = {
      hasAssessment: true,
      period: 'September 2026',
      overallPerformance,
      totalLearningTimeFormatted: totalHours > 0 ? `${totalHours}h ${remMins}m` : `${remMins}m`,
      learningStreakDays: dataStore.data.dashboard.learningStreakDays || 1,
      practiceRoundsCompleted: dataStore.data.practiceAttempts.length || 1,
      subjects: dataStore.data.subjects.map(s => {
        const hours = Math.floor(s.learningMinutes / 60);
        const mins = s.learningMinutes % 60;
        return {
          name: s.name,
          time: `${hours}h ${mins}m`,
          score: s.score,
          trend: '↑ 5%'
        };
      }),
      trendChart: [
        { week: 'Week 1', heightPercent: Math.max(30, overallPerformance - 15) },
        { week: 'Week 2', heightPercent: Math.max(40, overallPerformance - 10) },
        { week: 'Week 3', heightPercent: Math.max(50, overallPerformance - 5) },
        { week: 'Week 4', heightPercent: overallPerformance }
      ],
      mathTopicMastery: mathSub?.topics.map(t => ({
        topic: t.name,
        score: t.score,
        status: t.status
      })) || [],
      studyHabits: [
        { icon: '◷', title: 'Best focus time: 7:00 PM', detail: 'Evening sessions fit your schedule best.' },
        { icon: '◉', title: 'Average session: 15 minutes', detail: 'Short focused bursts maintain high retention.' },
        { icon: '⌁', title: 'Most active day: Today', detail: 'Completed diagnostic onboarding assessment.' }
      ],
      achievements: [
        { icon: '🔥', text: '1-day learning streak' },
        { icon: '⚗', text: `Diagnostic completed` },
        { icon: '✦', text: 'Personalised plan active' },
        { icon: '↑', text: 'Ready for Level 1' }
      ],
      recommendedNextStep: {
        title: 'Complete your first practice topic.',
        description: 'Start with 15 minutes of guided practice to build your foundational confidence.'
      }
    };

    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || Object.keys(dataStore.data.studentProfiles)[0] || '';
    const profile = dataStore.data.studentProfiles[studentId] || null;
    sendSuccess(res, { profile, recentActivity: dataStore.data.recentActivity || [] });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || req.body.userId || 'new-student-001';
    const current = dataStore.data.studentProfiles[studentId] || {};

    const name = req.body.name || (current as any).name || 'Student';
    const initials = name.split(/\s+/).filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || 'ST';

    const updated = {
      userId: studentId,
      name,
      initials,
      grade: req.body.grade || (current as any).grade || 'Grade 1',
      school: req.body.school || (current as any).school || '',
      district: req.body.city || req.body.district || (current as any).district || '',
      dateOfBirth: req.body.birth || req.body.dateOfBirth || (current as any).dateOfBirth || '',
      learningLanguages: req.body.language ? [req.body.language] : ((current as any).learningLanguages || ['English']),
      preferredLanguage: req.body.language || req.body.preferred_language || 'English',
      favouriteSubject: req.body.favourite || (current as any).favouriteSubject || 'Mathematics',
      preferredStudyTime: req.body.studytime || (current as any).preferredStudyTime || '7:00 PM',
      diagnostic_completed: (current as any).diagnostic_completed || false
    };

    dataStore.data.studentProfiles[studentId] = updated as any;
    dataStore.save();
    sendSuccess(res, { profile: updated, message: 'Your education profile has been saved.' });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------------------------
// Diagnostic Assessment Endpoints
// ------------------------------------------------------------------------------

export async function startDiagnostic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || req.body.studentId || 'new-student-001';
    const grade = req.body.grade || 1;
    const result = diagnosticEngine.startSession(studentId, grade);
    sendSuccess(res, {
      sessionId: result.session.id,
      session: result.session,
      currentQuestion: result.currentQuestion,
      questionNumber: result.currentQuestion.questionNumber,
      totalQuestions: result.currentQuestion.totalQuestions,
      currentGrade: result.session.currentGrade,
      subject: result.currentQuestion.subject
    });
  } catch (err) {
    next(err);
  }
}

export async function submitDiagnosticAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId, questionId, studentAnswer, selectedAnswer, timeSpentSeconds, responseTimeSeconds } = req.body;
    const answer = (studentAnswer !== undefined && studentAnswer !== null) ? studentAnswer : selectedAnswer;
    const duration = Number(timeSpentSeconds) || Number(responseTimeSeconds) || 5;
    const result = diagnosticEngine.submitAnswer(sessionId, questionId, String(answer), duration);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getDiagnosticQuestions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const questions = diagnosticEngine.getQuestions().map(q => ({
      id: q.id,
      subject: q.subject,
      grade: q.grade,
      topic: q.topic,
      question: q.question,
      options: q.options
    }));
    sendSuccess(res, { questions });
  } catch (err) {
    next(err);
  }
}

export async function getDiagnosticStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || Object.keys(dataStore.data.studentProfiles)[0] || 'new-student-001';
    const profile = dataStore.data.studentProfiles[studentId];

    // Check all 8 required profile fields
    const isProfileComplete = !!(
      profile &&
      (profile as any).name &&
      (profile as any).grade &&
      (profile as any).school &&
      ((profile as any).district || (profile as any).city) &&
      ((profile as any).birth || (profile as any).dateOfBirth) &&
      ((profile as any).language || (profile as any).preferred_language) &&
      ((profile as any).favourite || (profile as any).favourite_subject) &&
      ((profile as any).studytime || (profile as any).preferred_study_time)
    );

    const isDiagnosticComplete = isProfileComplete && (profile as any).diagnostic_completed === true;
    const gradeLevel = profile?.grade ? parseInt(String(profile.grade), 10) : 1;

    sendSuccess(res, {
      profileCompleted: isProfileComplete,
      diagnosticCompleted: isDiagnosticComplete,
      gradeLevel,
      profile
    });
  } catch (err) {
    next(err);
  }
}

export async function generateAdaptiveQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentGrade, subject, topic, difficulty, previousAnswers } = req.body;
    const grade = Number(studentGrade) || req.user?.grade || 3;
    const subj = subject || 'Mathematics';
    const top = topic || 'Addition';
    const diff = (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') ? difficulty : 'medium';

    const question = await GeminiPracticeService.generateAdaptiveQuestion(
      top,
      grade,
      diff === 'easy' ? 1 : diff === 'medium' ? 2 : 3,
      subj,
      diff,
      previousAnswers
    );

    sendSuccess(res, {
      id: question.id,
      question: question.equation,
      options: question.options,
      correctAnswer: String(question.answer),
      subject: question.subject,
      topic: question.topic,
      gradeLevel: grade,
      difficulty: diff,
      explanation: question.explanation
    });
  } catch (err) {
    next(err);
  }
}
