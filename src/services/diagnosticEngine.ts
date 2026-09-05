import fs from 'fs';
import path from 'path';
import { dataStore } from './dataStore.js';

export interface DiagnosticQuestion {
  id: string;
  subject: string;
  grade: number;
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface SessionAnswerRecord {
  questionId: string;
  subject: string;
  grade: number;
  topic: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface DiagnosticSessionState {
  id: string;
  studentId: string;
  initialGrade: number;
  currentGrade: number;
  totalQuestions: number;
  questionsAnswered: number;
  status: 'in_progress' | 'completed';
  answers: SessionAnswerRecord[];
  createdAt: string;
  completedAt?: string;
  currentQuestionId?: string;
}

export interface InitialAssessmentResult {
  studentId: string;
  sessionId: string;
  estimatedGradeLevel: number;
  overallScore: number;
  subjectScores: Record<string, number>;
  topicStrengths: string[];
  learningGaps: string[];
  recommendedFirstPracticeTopic: {
    subject: string;
    topic: string;
    description: string;
    durationMinutes: number;
  };
  recommendedDashboardInsight: {
    title: string;
    reason: string;
    category: string;
    suggestedDurationMinutes: number;
  };
}

class DiagnosticEngine {
  private questions: DiagnosticQuestion[] = [];
  private sessions: Map<string, DiagnosticSessionState> = new Map();

  constructor() {
    this.loadQuestions();
  }

  private loadQuestions(): void {
    try {
      const qPath = path.resolve(process.cwd(), 'data', 'diagnostic-questions.json');
      if (fs.existsSync(qPath)) {
        this.questions = JSON.parse(fs.readFileSync(qPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('Failed to load diagnostic-questions.json:', e);
      this.questions = [];
    }
  }

  public getQuestions(): DiagnosticQuestion[] {
    if (this.questions.length === 0) {
      this.loadQuestions();
    }
    return this.questions;
  }

  /**
   * Start or resume a 10-question adaptive diagnostic assessment session
   */
  public startSession(studentId: string, gradeStr: string | number = 1): {
    session: DiagnosticSessionState;
    currentQuestion: Omit<DiagnosticQuestion, 'correctAnswer' | 'explanation'> & { questionNumber: number; totalQuestions: number };
  } {
    let parsedGrade = 1;
    if (typeof gradeStr === 'number') {
      parsedGrade = Math.min(6, Math.max(1, gradeStr));
    } else {
      const m = String(gradeStr).match(/\d+/);
      parsedGrade = m ? Math.min(6, Math.max(1, parseInt(m[0], 10))) : 1;
    }

    // Check if student has an existing active session
    let session = Array.from(this.sessions.values()).find(
      s => s.studentId === studentId && s.status === 'in_progress'
    );

    if (!session) {
      const sessionId = `diag-sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      session = {
        id: sessionId,
        studentId,
        initialGrade: parsedGrade,
        currentGrade: parsedGrade,
        totalQuestions: 10,
        questionsAnswered: 0,
        status: 'in_progress',
        answers: [],
        createdAt: new Date().toISOString()
      };
      this.sessions.set(sessionId, session);
    }

    const nextQ = this.pickNextQuestion(session);
    session.currentQuestionId = nextQ.id;

    return {
      session,
      currentQuestion: {
        id: nextQ.id,
        subject: nextQ.subject,
        grade: nextQ.grade,
        topic: nextQ.topic,
        question: nextQ.question,
        options: nextQ.options,
        questionNumber: session.questionsAnswered + 1,
        totalQuestions: session.totalQuestions
      }
    };
  }

  /**
   * Selects an adaptive question based on student's grade and previous answers.
   * If correct -> more difficult.
   * If wrong -> easier or similar topic.
   */
  private pickNextQuestion(session: DiagnosticSessionState): DiagnosticQuestion {
    const questions = this.getQuestions();
    const answeredIds = new Set(session.answers.map(a => a.questionId));
    const available = questions.filter(q => !answeredIds.has(q.id));

    if (available.length === 0) {
      // If exhausted, fallback to any question
      return questions[Math.floor(Math.random() * questions.length)];
    }

    // Attempt to match current target grade
    const targetGrade = session.currentGrade;
    let candidates = available.filter(q => q.grade === targetGrade);

    // If no candidate at exact target grade, search nearest grades (targetGrade +/- 1, 2, etc.)
    if (candidates.length === 0) {
      for (let delta = 1; delta <= 5; delta++) {
        const lower = available.filter(q => q.grade === targetGrade - delta);
        if (lower.length > 0) {
          candidates = lower;
          break;
        }
        const higher = available.filter(q => q.grade === targetGrade + delta);
        if (higher.length > 0) {
          candidates = higher;
          break;
        }
      }
    }

    if (candidates.length === 0) {
      candidates = available;
    }

    // If last answer was wrong, try finding a similar topic or subject if possible
    const lastAnswer = session.answers[session.answers.length - 1];
    if (lastAnswer && !lastAnswer.isCorrect) {
      const sameTopicOrSubj = candidates.filter(
        q => q.topic.toLowerCase() === lastAnswer.topic.toLowerCase() || q.subject === lastAnswer.subject
      );
      if (sameTopicOrSubj.length > 0) {
        candidates = sameTopicOrSubj;
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Validate student answer securely on backend and adapt next question
   */
  public submitAnswer(
    sessionId: string,
    questionId: string,
    studentAnswer: string,
    timeSpentSeconds: number = 5
  ): {
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
    isCompleted: boolean;
    nextQuestion?: Omit<DiagnosticQuestion, 'correctAnswer' | 'explanation'> & { questionNumber: number; totalQuestions: number };
    assessment?: InitialAssessmentResult;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Diagnostic session not found: ${sessionId}`);
    }

    const question = this.getQuestions().find(q => q.id === questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    // Backend answer validation
    const cleanStudent = String(studentAnswer).trim().toLowerCase();
    const cleanCorrect = String(question.correctAnswer).trim().toLowerCase();
    const isCorrect = cleanStudent === cleanCorrect;

    // Record answer
    session.answers.push({
      questionId: question.id,
      subject: question.subject,
      grade: question.grade,
      topic: question.topic,
      studentAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      timeSpentSeconds: Math.max(1, timeSpentSeconds)
    });

    session.questionsAnswered = session.answers.length;

    // Adaptive rules:
    // - Correct and fast (<= 12s): increase difficulty / advance grade
    // - Correct but slow (> 12s): keep similar difficulty / grade
    // - Wrong: ask a simpler question / lower grade
    if (isCorrect) {
      if (timeSpentSeconds <= 12) {
        session.currentGrade = Math.min(6, session.currentGrade + 1);
      }
    } else {
      session.currentGrade = Math.max(1, session.currentGrade - 1);
    }

    // Save attempt to Supabase diagnostic_attempts if available
    try {
      import('../config/supabase.js').then(({ supabase }) => {
        if (supabase && session.studentId) {
          supabase.from('diagnostic_attempts').insert({
            session_id: session.id,
            student_id: session.studentId,
            question_id: question.id,
            subject: question.subject,
            grade: question.grade,
            topic: question.topic,
            question_text: question.question,
            student_answer: String(studentAnswer),
            correct_answer: String(question.correctAnswer),
            is_correct: isCorrect,
            response_time_seconds: Math.max(1, timeSpentSeconds),
            score: isCorrect ? 100 : 0
          }).then(() => {}).catch(() => {});
        }
      }).catch(() => {});
    } catch (e) {}

    // End the quick test after 10 questions
    if (session.questionsAnswered >= session.totalQuestions) {
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      const assessment = this.computeInitialAssessment(session);
      return {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        isCompleted: true,
        assessment
      };
    }

    // Otherwise prepare next question
    const nextQ = this.pickNextQuestion(session);
    session.currentQuestionId = nextQ.id;

    return {
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      isCompleted: false,
      nextQuestion: {
        id: nextQ.id,
        subject: nextQ.subject,
        grade: nextQ.grade,
        topic: nextQ.topic,
        question: nextQ.question,
        options: nextQ.options,
        questionNumber: session.questionsAnswered + 1,
        totalQuestions: session.totalQuestions
      }
    };
  }

  /**
   * After the quick test, create the student's initial progress,
   * strengths, learning gaps, and recommendations.
   */
  public computeInitialAssessment(session: DiagnosticSessionState): InitialAssessmentResult {
    const total = session.answers.length;
    const correctCount = session.answers.filter(a => a.isCorrect).length;
    const overallScore = total > 0 ? Math.round((correctCount / total) * 100) : 50;

    // Estimate grade level based on difficulty and correct answers
    const gradeScores = session.answers.map(a => a.isCorrect ? a.grade : Math.max(1, a.grade - 0.5));
    const avgGrade = gradeScores.reduce((sum, g) => sum + g, 0) / (total || 1);
    const estimatedGradeLevel = Math.round(avgGrade * 10) / 10;

    // Calculate subject scores
    const subjects = ['Mathematics', 'Bahasa Melayu', 'English', 'Science'];
    const subjectScores: Record<string, number> = {};

    for (const sub of subjects) {
      const subAnswers = session.answers.filter(a => a.subject === sub);
      if (subAnswers.length > 0) {
        const subCorrect = subAnswers.filter(a => a.isCorrect).length;
        const rawScore = Math.round((subCorrect / subAnswers.length) * 100);
        subjectScores[sub] = Math.max(45, Math.min(95, rawScore));
      } else {
        // Calibrated baseline
        subjectScores[sub] = overallScore >= 70 ? 75 : 60;
      }
    }

    // Identify strengths and gaps
    const topicStrengths: string[] = [];
    const learningGaps: string[] = [];

    session.answers.forEach(a => {
      if (a.isCorrect && !topicStrengths.includes(a.topic)) {
        topicStrengths.push(a.topic);
      } else if (!a.isCorrect && !learningGaps.includes(a.topic)) {
        learningGaps.push(a.topic);
      }
    });

    if (topicStrengths.length === 0) {
      topicStrengths.push('Addition', 'Living things');
    }
    if (learningGaps.length === 0) {
      learningGaps.push('Subtraction', 'Fractions');
    }

    // Recommended first practice topic: lowest scoring area or primary gap
    const recommendedSubject = learningGaps.length > 0
      ? (session.answers.find(a => !a.isCorrect)?.subject || 'Mathematics')
      : 'Mathematics';
    const recommendedTopic = learningGaps[0] || 'Subtraction';

    const recommendedFirstPracticeTopic = {
      subject: recommendedSubject,
      topic: recommendedTopic,
      description: `Strengthen ${recommendedTopic.toLowerCase()} in a 15-minute session calibrated to your diagnostic results.`,
      durationMinutes: 15
    };

    const recommendedDashboardInsight = {
      title: `Build confidence in ${recommendedTopic.toLowerCase()}`,
      reason: `Your Quick Learning Check highlighted ${recommendedTopic.toLowerCase()} as your key growth area. A 15-minute focused session will help establish foundational mastery.`,
      category: recommendedSubject,
      suggestedDurationMinutes: 15
    };

    const result: InitialAssessmentResult = {
      studentId: session.studentId,
      sessionId: session.id,
      estimatedGradeLevel,
      overallScore,
      subjectScores,
      topicStrengths,
      learningGaps,
      recommendedFirstPracticeTopic,
      recommendedDashboardInsight
    };

    // Persist into dataStore
    this.persistAssessmentToDataStore(result);

    return result;
  }

  /**
   * Updates dataStore student subjects, topics, and recommendations
   */
  private persistAssessmentToDataStore(assessment: InitialAssessmentResult): void {
    // 1. Update or create student subject progress
    const subList = [
      { id: 'mathematics', name: 'Mathematics', shortName: 'Maths', score: assessment.subjectScores['Mathematics'] || 70 },
      { id: 'bahasa-melayu', name: 'Bahasa Melayu', shortName: 'BM', score: assessment.subjectScores['Bahasa Melayu'] || 68 },
      { id: 'english', name: 'English', shortName: 'English', score: assessment.subjectScores['English'] || 68 },
      { id: 'science', name: 'Science', shortName: 'Science', score: assessment.subjectScores['Science'] || 85 }
    ];

    dataStore.data.subjects = subList.map(s => {
      const strength = assessment.topicStrengths.find(t => t.toLowerCase().includes(s.name.toLowerCase())) ||
        (s.id === 'mathematics' ? 'Addition' : s.id === 'science' ? 'Living things' : 'Vocabulary');
      return {
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        score: s.score,
        mastery: s.score,
        learningMinutes: 15,
        status: s.score >= 75 ? 'On track' : 'Developing',
        strength,
        topics: [
          { id: `${s.id}-t1`, name: strength, score: Math.min(95, s.score + 10), status: 'Strong' },
          { id: `${s.id}-t2`, name: assessment.learningGaps[0] || 'Foundation', score: Math.max(45, s.score - 15), status: 'Developing' }
        ],
        learningGaps: assessment.learningGaps
      };
    });

    // 2. Update dashboard stats
    dataStore.data.dashboard = {
      overallPerformance: assessment.overallScore,
      healthScore: Math.min(100, assessment.overallScore + 5),
      learningStreakDays: 1,
      streakIncreaseThisWeek: 1,
      studyActivityMinutes: 15,
      studyActivityChangePercent: 0,
      availableFocusMinutes: 45,
      bestFocusWindow: '7:00 PM',
      weeklyActivity: [
        { day: 'Mon', minutes: 0 },
        { day: 'Tue', minutes: 0 },
        { day: 'Wed', minutes: 0 },
        { day: 'Thu', minutes: 0 },
        { day: 'Fri', minutes: 0 },
        { day: 'Sat', minutes: 0 },
        { day: 'Sun', minutes: 15 }
      ],
      recommendedPractice: assessment.recommendedFirstPracticeTopic
    };

    // 3. Update priority recommendation
    dataStore.data.recommendations = [
      {
        id: `rec-${Date.now()}`,
        studentId: assessment.studentId,
        subject: assessment.recommendedFirstPracticeTopic.subject,
        topic: assessment.recommendedFirstPracticeTopic.topic,
        title: assessment.recommendedDashboardInsight.title,
        reason: assessment.recommendedDashboardInsight.reason,
        currentScore: assessment.overallScore,
        timeSpentMinutes: 15,
        recommendedMinutes: 15,
        status: 'active'
      }
    ];

    // 4. Update student profile diagnostic completion flag
    const prof = dataStore.data.studentProfiles[assessment.studentId];
    if (prof) {
      (prof as any).diagnostic_completed = true;
      (prof as any).estimatedGradeLevel = assessment.estimatedGradeLevel;
    }

    try {
      import('../config/supabase.js').then(({ supabase }) => {
        if (supabase && assessment.studentId && assessment.studentId.includes('-')) {
          supabase.from('student_profiles').update({
            diagnostic_completed: true,
            estimated_grade_level: assessment.estimatedGradeLevel
          }).eq('user_id', assessment.studentId).then(() => {}).catch(() => {});
        }
      }).catch(() => {});
    } catch (e) {}

    // 5. Add to teacher student roster
    const existingStudent = dataStore.data.students.find(s => s.id === assessment.studentId);
    const studentName = prof?.name || 'New Learner';
    const initials = prof?.initials || 'NL';

    if (!existingStudent) {
      dataStore.data.students.push({
        id: assessment.studentId,
        name: studentName,
        initials,
        primarySubject: assessment.recommendedFirstPracticeTopic.subject,
        learningMinutes: 15,
        healthScore: Math.min(100, assessment.overallScore + 5),
        status: assessment.overallScore >= 75 ? 'thriving' : assessment.overallScore >= 55 ? 'on track' : 'support',
        trend: 'up'
      });
    }

    dataStore.save();
  }
}

export const diagnosticEngine = new DiagnosticEngine();
export default diagnosticEngine;
