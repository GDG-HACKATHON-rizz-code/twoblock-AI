import { Request, Response, NextFunction } from 'express';
import { dataStore } from '../services/dataStore.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { RecommendationEngine } from '../services/recommendationEngine.js';
import { diagnosticEngine } from '../services/diagnosticEngine.js';
import { ScoringService } from '../services/scoringService.js';
import { GeminiPracticeService } from '../services/geminiPracticeService.js';
import { sendSuccess } from '../utils/response.js';
import { demoDataService } from '../services/demoData.js';
import { resetAdamDemoData } from '../scripts/seedAdamDemo.js';

export function isDemoStudentRequest(req: Request): boolean {
  return !!(
    req?.user?.is_demo_account ||
    req?.user?.id === 'demo-student-adam' ||
    req?.user?.id === 'ad000000-0000-4000-8000-000000000001' ||
    req?.user?.email === 'adam.haziq@twoblock.ai' ||
    req?.headers?.['x-demo-mode'] === 'true'
  );
}

function resolveStudentId(req: Request): string {
  if (isDemoStudentRequest(req)) {
    return 'demo-student-adam';
  }
  return req.user?.id || 'real-student-unregistered';
}

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isDemoStudentRequest(req)) {
      sendSuccess(res, demoDataService.getStudentDashboard());
      return;
    }

    const studentId = resolveStudentId(req);

    // If zero subjects or student has not completed assessment/profile, return empty state
    if (dataStore.data.subjects.length === 0 || !dataStore.data.studentProfiles[studentId]) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyTitle: 'No learning data yet.',
        emptyMessage: 'Complete your Personal Information and Quick Learning Check to begin.',
        practiceEmptyTitle: 'No practice history yet.',
        practiceEmptyMessage: 'Your personalised practice will appear after the Quick Learning Check.',
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

    const calcOverall = AnalyticsService.calculateStudentOverallPerformance(studentId);
    const overallPerformance = dataStore.data.dashboard.overallPerformance ?? calcOverall;
    const health = AnalyticsService.calculateStudentHealthScore(studentId);
    const healthScore = dataStore.data.dashboard.healthScore ?? health.score;
    const learningGaps = AnalyticsService.identifyLearningGaps(studentId);
    const recommendation = RecommendationEngine.getStudentPriorityRecommendation(studentId);

    const dashboard = {
      hasAssessment: true,
      overallPerformance,
      healthScore,
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
    if (isDemoStudentRequest(req)) {
      sendSuccess(res, { hasAssessment: true, ...demoDataService.getStudentLearning() });
      return;
    }

    const studentId = resolveStudentId(req);
    if (dataStore.data.subjects.length === 0 || !dataStore.data.studentProfiles[studentId]) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyTitle: 'No learning data yet.',
        emptyMessage: 'Complete your Personal Information and Quick Learning Check to begin.',
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
    const grade = parseInt(req.query.grade as string) || 5;
    const subject = (req.query.subject as string) || 'Mathematics';

    const question = await GeminiPracticeService.generateSyllabusQuestion({
      subject,
      studentGrade: grade,
      topicName: topic,
      difficulty: level === 1 ? 'easy' : level === 2 ? 'medium' : 'hard'
    });
    sendSuccess(res, question);
  } catch (err) {
    next(err);
  }
}

export async function submitAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isDemo = isDemoStudentRequest(req);
    const { topic, studentAnswer, correctAnswer, timeSpentSeconds, questionText, question, subject, level } = req.body;

    const isCorrect = String(studentAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

    if (isDemo) {
      const demoResult = demoDataService.submitPracticeAttempt(topic || 'subtraction', isCorrect);
      const studentDash = demoDataService.getStudentDashboard();
      sendSuccess(res, {
        isCorrect,
        correctAnswer,
        previousTopicScore: demoResult.previousScore,
        newTopicScore: demoResult.newTopicScore,
        topicAccuracy: isCorrect ? 100 : 0,
        topicMastery: demoResult.topicMastery,
        subjectScore: demoDataService.subjects.find(s => s.id === 'mathematics')?.score || 70,
        subjectMastery: 'Developing',
        overallPerformance: studentDash.overallPerformance,
        healthScore: studentDash.healthScore,
        learningStreak: studentDash.learningStreakDays,
        recommendation: studentDash.recommendedPractice,
        feedback: isCorrect ? 'Correct! Great thinking.' : `Not quite — the answer was ${correctAnswer}.`
      });
      return;
    }

    const studentId = req.user?.id || 'student-user-001';

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
    const studentId = resolveStudentId(req);
    const { topic, correctCount, wrongCount } = req.body;
    const total = (Number(correctCount) || 0) + (Number(wrongCount) || 0);
    const roundScore = total > 0 ? Math.round((Number(correctCount) / total) * 100) : 0;
    const mastery = roundScore >= 80 ? 'Strong' : roundScore >= 55 ? 'Developing' : 'Beginning';

    dataStore.data.dashboard.studyActivityMinutes = (dataStore.data.dashboard.studyActivityMinutes || 0) + 5;

    // Record completed practice attempt
    if (!dataStore.data.practiceAttempts) dataStore.data.practiceAttempts = [];
    dataStore.data.practiceAttempts.push({
      id: `practice-attempt-${Date.now()}`,
      studentId,
      subject: 'Mathematics',
      topic: topic || 'Fractions',
      score: roundScore,
      isCorrect: roundScore >= 60,
      createdAt: new Date().toISOString()
    });

    // Record recent activity
    if (Array.isArray(dataStore.data.recentActivity)) {
      dataStore.data.recentActivity.unshift({
        type: 'practice',
        subject: 'Mathematics',
        topic: topic || 'Fractions',
        detail: `Score ${roundScore}% · Just now`,
        date: 'Just now'
      });
      dataStore.data.recentActivity = dataStore.data.recentActivity.slice(0, 8);
    }

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
    if (isDemoStudentRequest(req)) {
      sendSuccess(res, demoDataService.getStudentInsights());
      return;
    }

    const studentId = resolveStudentId(req);
    if (dataStore.data.subjects.length === 0 || !dataStore.data.studentProfiles[studentId]) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyTitle: 'No practice history yet.',
        emptyMessage: 'Your personalised practice will appear after the Quick Learning Check.',
        priority: null,
        whyPoints: [],
        steps: [],
        otherSignals: []
      });
      return;
    }
    const priority = RecommendationEngine.getStudentPriorityRecommendation(studentId);

    const insights = {
      hasAssessment: true,
      priority,
      whyPoints: priority.whyPoints && priority.whyPoints.length ? priority.whyPoints : [
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
        { icon: '✓', title: 'Science is a strength', detail: 'Demonstrated strong 84% mastery during your assessments.' },
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
    if (isDemoStudentRequest(req)) {
      sendSuccess(res, demoDataService.getStudentReport());
      return;
    }

    const studentId = resolveStudentId(req);
    if (dataStore.data.subjects.length === 0 || !dataStore.data.studentProfiles[studentId]) {
      sendSuccess(res, {
        hasAssessment: false,
        emptyTitle: 'No learning data yet.',
        emptyMessage: 'Complete your Personal Information and Quick Learning Check to begin.',
        learnerName: 'Learner',
        period: 'Current Period',
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

    const profile = dataStore.data.studentProfiles[studentId];
    const overallPerformance = dataStore.data.dashboard.overallPerformance ?? AnalyticsService.calculateStudentOverallPerformance(studentId);
    const mathSub = dataStore.data.subjects.find(s => s.id === 'mathematics');

    const totalMinutes = dataStore.data.dashboard.studyActivityMinutes || dataStore.data.subjects.reduce((sum, s) => sum + s.learningMinutes, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remMins = totalMinutes % 60;

    const report = {
      hasAssessment: true,
      learnerName: profile?.name || 'Adam Haziq',
      period: 'September 2026',
      overallPerformance,
      totalLearningTimeFormatted: totalHours > 0 ? `${totalHours}h ${remMins}m` : `${remMins}m`,
      learningStreakDays: dataStore.data.dashboard.learningStreakDays || 12,
      practiceRoundsCompleted: dataStore.data.practiceAttempts?.length || 16,
      subjects: dataStore.data.subjects.map(s => {
        const hours = Math.floor(s.learningMinutes / 60);
        const mins = s.learningMinutes % 60;
        return {
          name: s.name,
          time: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
          score: s.score,
          trend: '↑ 5%'
        };
      }),
      trendChart: [
        { week: 'Week 1', heightPercent: 55 },
        { week: 'Week 2', heightPercent: 62 },
        { week: 'Week 3', heightPercent: 69 },
        { week: 'Week 4', heightPercent: overallPerformance }
      ],
      mathTopicMastery: mathSub?.topics.map(t => ({
        topic: t.name,
        score: t.score,
        status: t.status
      })) || [
        { topic: 'Addition', score: 88, status: 'Strong' },
        { topic: 'Subtraction', score: 76, status: 'Strong' },
        { topic: 'Multiplication', score: 68, status: 'Developing' },
        { topic: 'Division', score: 58, status: 'Needs focus' },
        { topic: 'Fractions', score: 54, status: 'Needs focus' }
      ],
      studyHabits: [
        { icon: '◷', title: 'Best focus time: 7:00 PM', detail: 'Evening sessions fit your schedule best.' },
        { icon: '◉', title: 'Average session: 24 minutes', detail: 'Short focused bursts maintain high retention.' },
        { icon: '⌁', title: 'Most active day: Thursday', detail: 'Completed 87 minutes of focused study.' }
      ],
      achievements: [
        { icon: '🔥', text: '12-day learning streak' },
        { icon: '∑', text: 'Math Whiz (Addition 88%)' },
        { icon: '⚗', text: 'Science Explorer (84%)' },
        { icon: '✦', text: `${dataStore.data.practiceAttempts?.length || 16} practice rounds completed` }
      ],
      recommendedNextStep: {
        title: 'Strengthen Fractions this week.',
        description: 'Your current score is 54% after 48 minutes of practice. Complete one 15-minute Fractions round to build confidence and improve your Mathematics foundation.'
      }
    };

    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isDemoStudentRequest(req)) {
      sendSuccess(res, demoDataService.getStudentProfile());
      return;
    }

    const studentId = resolveStudentId(req);
    const profile = dataStore.data.studentProfiles[studentId] || Object.values(dataStore.data.studentProfiles).find((p: any) => p.is_demo_account || p.name === 'Adam Haziq') || null;
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
    const grade = req.body.grade || (current as any).grade || 'Grade 1';
    const school = req.body.school || (current as any).school || '';
    const district = req.body.city || req.body.district || (current as any).district || '';
    const dateOfBirth = req.body.birth || req.body.dateOfBirth || (current as any).dateOfBirth || '';
    const preferredLanguage = req.body.language || req.body.preferred_language || (current as any).preferredLanguage || 'English';
    const favouriteSubject = req.body.favourite || req.body.favouriteSubject || (current as any).favouriteSubject || 'Mathematics';
    const preferredStudyTime = req.body.studytime || req.body.preferredStudyTime || (current as any).preferredStudyTime || '7:00 PM';
    const classCode = (req.body.classCode || req.body.class_code || req.body.classSelection || '').trim();

    // Match student to class using:
    // 1. Class code (e.g. AMANAH10, BESTARI10, CEMERLANG10)
    // 2. School and Grade/Year level
    // 3. Selected class name / ID
    let matchedClass: any = null;

    if (classCode) {
      const upperCode = classCode.toUpperCase();
      matchedClass = dataStore.data.classes.find(c => {
        const cName = c.name.toUpperCase();
        return c.id.toUpperCase() === upperCode ||
               cName.includes(upperCode) ||
               (upperCode === 'AMANAH10' && cName.includes('AMANAH')) ||
               (upperCode === 'BESTARI10' && cName.includes('BESTARI')) ||
               (upperCode === 'CEMERLANG10' && cName.includes('CEMERLANG'));
      });
    }

    if (!matchedClass && school) {
      const teacher = dataStore.data.teacherProfiles['current-teacher'];
      const schoolLower = school.toLowerCase();
      const teacherSchoolLower = (teacher?.school || 'sekolah menengah maju jaya').toLowerCase();

      const schoolMatches = schoolLower.includes('maju jaya') || teacherSchoolLower.includes(schoolLower);
      const gradeStr = String(grade).toLowerCase();
      const gradeMatches = gradeStr.includes('10') || (teacher?.teachingLevel && gradeStr.includes(teacher.teachingLevel.toLowerCase()));

      if (schoolMatches && gradeMatches) {
        matchedClass = dataStore.data.classes[0];
      }
    }

    if (!matchedClass && req.body.className) {
      matchedClass = dataStore.data.classes.find(c =>
        c.name.toLowerCase().includes(String(req.body.className).toLowerCase())
      );
    }

    const updated = {
      userId: studentId,
      name,
      initials,
      grade,
      school,
      district,
      dateOfBirth,
      learningLanguages: req.body.language ? [req.body.language] : ((current as any).learningLanguages || ['English']),
      preferredLanguage,
      favouriteSubject,
      preferredStudyTime,
      classId: matchedClass?.id || null,
      className: matchedClass?.name || null,
      classCode: classCode || null,
      diagnostic_completed: (current as any).diagnostic_completed || false,
      onboarding_completed: false
    };

    dataStore.data.studentProfiles[studentId] = updated as any;

    if (matchedClass) {
      matchedClass.studentCount = Math.max(1, (matchedClass.studentCount || 0) + 1);

      // Add or update student on teacher roster with Assessment pending
      const existingIdx = dataStore.data.students.findIndex(s => s.id === studentId || s.name.toLowerCase() === name.toLowerCase());
      const pendingStudent = {
        id: studentId,
        name,
        initials,
        primarySubject: favouriteSubject,
        learningMinutes: 0,
        healthScore: null,
        status: 'Assessment pending' as const,
        trend: 'steady' as const,
        classId: matchedClass.id,
        className: matchedClass.name
      };

      if (existingIdx >= 0) {
        const existing = dataStore.data.students[existingIdx];
        if (existing.status !== 'Assessment completed') {
          dataStore.data.students[existingIdx] = pendingStudent;
        }
      } else {
        dataStore.data.students.push(pendingStudent);
      }

      // Sync with Supabase (student_profiles and class_enrolments)
      try {
        const { supabase } = await import('../config/supabase.js');
        if (supabase) {
          let studentProfileId = studentId;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);

          if (isUuid) {
            const { data: sp } = await supabase.from('student_profiles').upsert({
              user_id: studentId,
              full_name: name,
              grade_level: String(grade),
              preferred_language: preferredLanguage,
              learning_preferences: {
                school,
                district,
                dateOfBirth,
                favouriteSubject,
                preferredStudyTime,
                classCode
              },
              onboarding_completed: false
            }).select().single();

            if (sp?.id) {
              studentProfileId = sp.id;
            }
          }

          const classUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchedClass.id) ? matchedClass.id : null;
          const studentProfUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentProfileId) ? studentProfileId : null;

          if (classUuid && studentProfUuid) {
            await supabase.from('class_enrolments').upsert({
              class_id: classUuid,
              student_id: studentProfUuid
            });
          }
        }
      } catch (sbErr) {}

      dataStore.save();

      sendSuccess(res, {
        profile: updated,
        classMatched: true,
        matchedClass: {
          id: matchedClass.id,
          name: matchedClass.name
        },
        message: 'Your education profile has been saved and connected to your class.'
      });
      return;
    }

    // If no class match
    dataStore.save();
    sendSuccess(res, {
      profile: updated,
      classMatched: false,
      message: 'Your class is not available yet. Please ask your teacher to create or share a class code.'
    });
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
    if (isDemoStudentRequest(req)) {
      const demoProfile = demoDataService.getStudentProfile().profile;
      sendSuccess(res, {
        profileCompleted: true,
        diagnosticCompleted: true,
        gradeLevel: demoProfile.grade || 5,
        profile: demoProfile
      });
      return;
    }

    let studentId = req.user?.id || Object.keys(dataStore.data.studentProfiles)[0] || 'new-student-001';
    let profile = dataStore.data.studentProfiles[studentId];

    if (!profile && (req.user?.is_demo_account || req.user?.email === 'adam.haziq@twoblock.ai')) {
      const demoEntry = Object.values(dataStore.data.studentProfiles).find((p: any) => p.is_demo_account || p.name === 'Adam Haziq');
      if (demoEntry) {
        profile = demoEntry;
        studentId = demoEntry.userId || studentId;
      }
    }

    // Check all 8 required profile fields (or demo account)
    const isProfileComplete = !!(
      profile && (
        (profile as any).is_demo_account === true ||
        ((profile as any).name &&
         (profile as any).grade &&
         (profile as any).school &&
         ((profile as any).district || (profile as any).city) &&
         ((profile as any).birth || (profile as any).dateOfBirth) &&
         ((profile as any).language || (profile as any).preferred_language || (profile as any).preferredLanguage) &&
         ((profile as any).favourite || (profile as any).favourite_subject || (profile as any).favouriteSubject) &&
         ((profile as any).studytime || (profile as any).preferred_study_time || (profile as any).preferredStudyTime))
      )
    );

    const isDiagnosticComplete = isProfileComplete && (
      (profile as any).diagnostic_completed === true ||
      (profile as any).is_demo_account === true
    );
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
    const grade = Number(studentGrade) || req.user?.grade || 5;
    const subj = subject || 'Mathematics';
    const top = topic || 'Addition';
    const diff = (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') ? difficulty : 'medium';

    const question = await GeminiPracticeService.generateSyllabusQuestion({
      subject: subj,
      studentGrade: grade,
      topicName: top,
      difficulty: diff,
      previousAnswers
    });

    sendSuccess(res, question);
  } catch (err) {
    next(err);
  }
}

export async function generateSyllabusQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id || req.body.studentId;
    const {
      subject,
      studentGrade,
      topicId,
      topicName,
      subtopicName,
      difficulty,
      recentAccuracy,
      previousAnswers,
      excludeQuestionTexts
    } = req.body;

    const question = await GeminiPracticeService.generateSyllabusQuestion({
      studentId,
      subject: subject || 'Mathematics',
      studentGrade: Number(studentGrade) || 5,
      topicId,
      topicName,
      subtopicName,
      difficulty,
      recentAccuracy: Number(recentAccuracy) || 70,
      previousAnswers,
      excludeQuestionTexts
    });

    sendSuccess(res, question);
  } catch (err) {
    next(err);
  }
}

export async function resetDemoProgress(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    demoDataService.resetDemoData();
    let result = null;
    try {
      result = await resetAdamDemoData();
    } catch (e) {}
    sendSuccess(res, {
      success: true,
      message: 'Demo progress has been reset.',
      data: result || demoDataService.getStudentProfile()
    }, 200);
  } catch (err) {
    next(err);
  }
}

