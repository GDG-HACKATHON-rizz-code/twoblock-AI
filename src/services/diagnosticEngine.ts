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
        totalQuestions: 20,
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
   * 20 Questions total:
   * - Q1 to Q5: Mathematics
   * - Q6 to Q10: Bahasa Melayu
   * - Q11 to Q15: English
   * - Q16 to Q20: Science
   */
  private pickNextQuestion(session: DiagnosticSessionState): DiagnosticQuestion {
    const questions = this.getQuestions();
    const answeredIds = new Set(session.answers.map(a => a.questionId));
    const count = session.answers.length;

    let targetSubject = 'Mathematics';
    if (count >= 15) {
      targetSubject = 'Science';
    } else if (count >= 10) {
      targetSubject = 'English';
    } else if (count >= 5) {
      targetSubject = 'Bahasa Melayu';
    }

    const available = questions.filter(q => !answeredIds.has(q.id) && q.subject === targetSubject);

    if (available.length === 0) {
      // If exhausted in this subject, pick any unattempted question
      const anyAvailable = questions.filter(q => !answeredIds.has(q.id));
      if (anyAvailable.length > 0) {
        return anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
      }
      return questions[Math.floor(Math.random() * questions.length)];
    }

    // Match current target grade
    const targetGrade = session.currentGrade;
    let candidates = available.filter(q => q.grade === targetGrade);

    // If no candidate at exact target grade, search nearest grades (+/- 1, 2, etc.)
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

    // Save attempt to Supabase question_attempts if available
    try {
      import('../config/supabase.js').then(({ supabase }) => {
        if (supabase && session.studentId) {
          supabase.from('question_attempts').insert({
            session_id: session.id,
            student_id: session.studentId,
            question_id: question.id,
            student_answer: String(studentAnswer),
            is_correct: isCorrect,
            response_time_seconds: Math.max(1, timeSpentSeconds),
            attempted_at: new Date().toISOString()
          }).then(() => {}, () => {});
        }
      }).catch(() => {});
    } catch (e) {}

    // End the quick test after 20 questions
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
   * After the quick test, calculate the student's real progress,
   * strengths, learning gaps, and recommendations.
   */
  public computeInitialAssessment(session: DiagnosticSessionState): InitialAssessmentResult {
    const total = session.answers.length;
    const correctCount = session.answers.filter(a => a.isCorrect).length;
    const overallScore = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // Estimate grade level based on performance and starting grade
    const gradeScores = session.answers.map(a => a.isCorrect ? a.grade : Math.max(1, a.grade - 0.5));
    const avgGrade = gradeScores.reduce((sum, g) => sum + g, 0) / (total || 1);
    const estimatedGradeLevel = Math.round(avgGrade * 10) / 10;

    // Calculate real subject scores (5 questions per subject)
    const subjects = ['Mathematics', 'Bahasa Melayu', 'English', 'Science'];
    const subjectScores: Record<string, number> = {};

    for (const sub of subjects) {
      const subAnswers = session.answers.filter(a => a.subject === sub);
      if (subAnswers.length > 0) {
        const subCorrect = subAnswers.filter(a => a.isCorrect).length;
        subjectScores[sub] = Math.round((subCorrect / subAnswers.length) * 100);
      } else {
        subjectScores[sub] = 0;
      }
    }

    // Identify real strengths (topics answered correctly)
    const topicStrengths: string[] = [];
    const learningGaps: string[] = [];

    session.answers.forEach(a => {
      if (a.isCorrect && !topicStrengths.includes(a.topic)) {
        topicStrengths.push(a.topic);
      } else if (!a.isCorrect && !learningGaps.includes(a.topic)) {
        learningGaps.push(a.topic);
      }
    });

    // Determine recommended weak topic for personalised practice
    // Prioritize learning gaps (incorrect topics); if all correct, pick lowest scoring subject
    let recommendedSubject = 'Mathematics';
    let recommendedTopic = 'Subtraction';

    if (learningGaps.length > 0) {
      const wrongAnswer = session.answers.find(a => !a.isCorrect);
      if (wrongAnswer) {
        recommendedSubject = wrongAnswer.subject;
        recommendedTopic = wrongAnswer.topic;
      } else {
        recommendedTopic = learningGaps[0];
      }
    } else {
      // Find subject with lowest score
      const sortedSubs = Object.entries(subjectScores).sort((a, b) => a[1] - b[1]);
      recommendedSubject = sortedSubs[0][0];
      const matchSubQ = session.answers.find(a => a.subject === recommendedSubject);
      recommendedTopic = matchSubQ?.topic || 'Core concepts';
    }

    const recommendedFirstPracticeTopic = {
      subject: recommendedSubject,
      topic: recommendedTopic,
      description: `Strengthen ${recommendedTopic.toLowerCase()} in a 15-minute session calibrated to your Quick Learning Check.`,
      durationMinutes: 15
    };

    const recommendedDashboardInsight = {
      title: `Build confidence in ${recommendedTopic.toLowerCase()}`,
      reason: `Your Quick Learning Check highlighted ${recommendedTopic.toLowerCase()} as your focus topic. A 15-minute session will reinforce key concepts.`,
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

    // Persist into dataStore and Supabase
    this.persistAssessmentToDataStore(result);

    return result;
  }

  /**
   * Updates dataStore student subjects, topics, recommendations, and Supabase tables
   */
  private persistAssessmentToDataStore(assessment: InitialAssessmentResult): void {
    // 1. Update or create student subject progress
    const subList = [
      { id: 'mathematics', name: 'Mathematics', shortName: 'Maths', score: assessment.subjectScores['Mathematics'] ?? 0 },
      { id: 'bahasa-melayu', name: 'Bahasa Melayu', shortName: 'BM', score: assessment.subjectScores['Bahasa Melayu'] ?? 0 },
      { id: 'english', name: 'English', shortName: 'English', score: assessment.subjectScores['English'] ?? 0 },
      { id: 'science', name: 'Science', shortName: 'Science', score: assessment.subjectScores['Science'] ?? 0 }
    ];

    dataStore.data.subjects = subList.map(s => {
      const strength = assessment.topicStrengths.find(t => t.toLowerCase().includes(s.name.toLowerCase())) || 'Core concepts';
      return {
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        score: s.score,
        mastery: s.score,
        learningMinutes: 15,
        status: s.score >= 75 ? 'On track' : s.score >= 50 ? 'Developing' : 'Support',
        strength,
        topics: [
          { id: `${s.id}-t1`, name: strength, score: s.score, status: s.score >= 75 ? 'Strong' : 'Developing' }
        ],
        learningGaps: assessment.learningGaps
      };
    });

    // 2. Update dashboard stats
    dataStore.data.dashboard = {
      overallPerformance: assessment.overallScore,
      healthScore: assessment.overallScore,
      learningStreakDays: 1,
      streakIncreaseThisWeek: 1,
      studyActivityMinutes: 15,
      studyActivityChangePercent: 100,
      availableFocusMinutes: 45,
      bestFocusWindow: '5:00 PM',
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
      (prof as any).onboarding_completed = true;
      (prof as any).estimatedGradeLevel = assessment.estimatedGradeLevel;
    }

    // 5. Update or add to teacher student roster with REAL status
    const studentName = prof?.name || 'New Learner';
    const initials = prof?.initials || 'NL';
    const existingStudentIndex = dataStore.data.students.findIndex(s => s.id === assessment.studentId);

    const studentRosterItem = {
      id: assessment.studentId,
      name: studentName,
      initials,
      primarySubject: assessment.recommendedFirstPracticeTopic.subject,
      learningMinutes: 15,
      healthScore: assessment.overallScore,
      status: 'Assessment completed' as const,
      trend: 'up' as const
    };

    if (existingStudentIndex >= 0) {
      dataStore.data.students[existingStudentIndex] = studentRosterItem;
    } else {
      dataStore.data.students.push(studentRosterItem);
    }

    // 6. Generate real intervention only when real support is needed
    if (assessment.overallScore < 55 || assessment.learningGaps.length > 0) {
      const weakTopic = assessment.learningGaps[0] || assessment.recommendedFirstPracticeTopic.topic;
      dataStore.data.interventions.push({
        id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        studentId: assessment.studentId,
        studentName,
        status: 'problem',
        classification: 'Low topic mastery',
        subject: assessment.recommendedFirstPracticeTopic.subject,
        topic: weakTopic,
        healthScore: assessment.overallScore,
        topicScore: Math.max(30, assessment.overallScore - 10),
        learningMinutes: 15,
        recommendation: `Targeted review in ${weakTopic}: 15-minute guided practice session.`,
        reviewDueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
    }

    // 7. Sync directly to Supabase tables
    try {
      import('../config/supabase.js').then(async ({ supabase }) => {
        if (!supabase || !assessment.studentId) return;

        // a. student_profiles update
        await supabase.from('student_profiles').update({
          onboarding_completed: true
        }).eq('user_id', assessment.studentId);

        // b. student_subject_progress upsert
        for (const s of subList) {
          await supabase.from('student_subject_progress').upsert({
            student_id: assessment.studentId,
            subject_id: s.id,
            overall_score: s.score,
            last_updated_at: new Date().toISOString()
          });
        }

        // c. student_health_scores
        await supabase.from('student_health_scores').upsert({
          student_id: assessment.studentId,
          health_score: assessment.overallScore,
          label: assessment.overallScore >= 75 ? 'Thriving' : assessment.overallScore >= 55 ? 'On track' : 'Support Needed',
          calculated_at: new Date().toISOString()
        });

        // d. ai_recommendations
        await supabase.from('ai_recommendations').insert({
          target_type: 'student',
          student_id: assessment.studentId,
          recommendation_text: `${assessment.recommendedFirstPracticeTopic.subject}: ${assessment.recommendedFirstPracticeTopic.topic}`,
          evidence_data: {
            title: assessment.recommendedDashboardInsight.title,
            reason: assessment.recommendedDashboardInsight.reason,
            suggestedDurationMinutes: 15
          },
          status: 'active'
        });
      }).catch(() => {});
    } catch (e) {}

    dataStore.save();
  }
}

export const diagnosticEngine = new DiagnosticEngine();
export default diagnosticEngine;
