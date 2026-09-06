import { Request, Response, NextFunction } from 'express';
import { dataStore } from '../services/dataStore.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { RecommendationEngine } from '../services/recommendationEngine.js';
import { sendSuccess } from '../utils/response.js';

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (dataStore.data.students.length === 0) {
      sendSuccess(res, {
        classHealthScore: 0,
        onTrackCount: 0,
        needsSupportCount: 0,
        totalStudents: 0,
        averageLoginMinutesPerDay: 0,
        weeklyPerformance: [],
        subjectPerformance: [],
        studentList: [],
        emptyTitle: 'No students have been added yet.',
        emptyMessage: 'Class progress will appear after students complete their learning check.'
      });
      return;
    }

    const classMetrics = AnalyticsService.calculateClassHealthScore();

    const weeklyPerformance = [
      { day: 'Mon', score: 54 },
      { day: 'Tue', score: 60 },
      { day: 'Wed', score: 66 },
      { day: 'Thu', score: 72 },
      { day: 'Fri', score: 78 },
      { day: 'Sat', score: 69 },
      { day: 'Sun', score: 74 }
    ];

    const subjectPerformance = [
      { subject: 'Mathematics', score: 70, changePercent: 8, priority: 'Fractions', weeklyScores: [43, 55, 48, 66, 72, 62, 70] },
      { subject: 'Bahasa Melayu', score: 67, changePercent: 3, priority: 'Ayat Majmuk', weeklyScores: [54, 49, 61, 65, 58, 68, 67] },
      { subject: 'English', score: 72, changePercent: 4, priority: 'Sentence Structure', weeklyScores: [45, 56, 59, 62, 68, 65, 72] },
      { subject: 'Science', score: 84, changePercent: 10, priority: 'Strong', weeklyScores: [73, 78, 82, 79, 88, 86, 84] }
    ];

    const studentList = dataStore.data.students.map(s => {
      const isPending = s.status === 'Assessment pending' || s.healthScore === null || s.healthScore === undefined;
      const hours = Math.floor((s.learningMinutes || 0) / 60);
      const mins = (s.learningMinutes || 0) % 60;
      const timeFormatted = isPending ? '0 minutes' : (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
      return {
        ...s,
        healthScore: isPending ? null : s.healthScore,
        healthScoreDisplay: isPending ? 'Not available' : `${s.healthScore}`,
        timeFormatted,
        trendSymbol: s.trend === 'up' ? '↗' : s.trend === 'steady' ? '→' : '↘'
      };
    });

    sendSuccess(res, {
      ...classMetrics,
      totalStudents: dataStore.data.students.length,
      weeklyPerformance,
      subjectPerformance,
      studentList
    });
  } catch (err) {
    next(err);
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter = (req.query.filter as string) || 'all';

    if (dataStore.data.students.length === 0) {
      sendSuccess(res, {
        students: [],
        counts: { good: 0, bad: 0, total: 0 },
        filter,
        emptyTitle: 'No students have been added yet.',
        emptyMessage: 'Class progress will appear after students complete their learning check.'
      });
      return;
    }

    let list = dataStore.data.students;
    if (filter === 'bad') {
      list = list.filter(s => typeof s.healthScore === 'number' && s.healthScore !== null && s.healthScore < 55);
    } else if (filter === 'mid') {
      list = list.filter(s => typeof s.healthScore === 'number' && s.healthScore !== null && s.healthScore >= 55 && s.healthScore < 75);
    } else if (filter === 'good') {
      list = list.filter(s => typeof s.healthScore === 'number' && s.healthScore !== null && s.healthScore >= 75);
    }

    const students = list.map(s => {
      const isPending = s.status === 'Assessment pending' || s.healthScore === null || s.healthScore === undefined;
      const hours = Math.floor((s.learningMinutes || 0) / 60);
      const mins = (s.learningMinutes || 0) % 60;
      const timeFormatted = isPending ? '0 minutes' : (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
      const statusClass = isPending ? 'watch' : ((s.healthScore as number) >= 75 ? 'good' : (s.healthScore as number) >= 55 ? 'watch' : 'risk');

      return {
        id: s.id,
        name: s.name,
        initials: s.initials,
        subject: s.primarySubject,
        healthScore: isPending ? null : s.healthScore,
        healthScoreDisplay: isPending ? 'Not available' : `${s.healthScore}`,
        learningMinutes: s.learningMinutes || 0,
        timeFormatted,
        status: s.status,
        statusClass,
        trend: s.trend,
        trendSymbol: s.trend === 'up' ? '↗' : s.trend === 'steady' ? '→' : '↘',
        classId: (s as any).classId || 'year10-amanah',
        className: (s as any).className || 'Year 10 Amanah (AMANAH10)'
      };
    });

    const assessed = dataStore.data.students.filter(s => typeof s.healthScore === 'number' && s.healthScore !== null);
    const counts = {
      good: assessed.filter(s => (s.healthScore as number) >= 75).length,
      bad: assessed.filter(s => (s.healthScore as number) < 55).length,
      total: dataStore.data.students.length
    };

    sendSuccess(res, { students, counts, filter });
  } catch (err) {
    next(err);
  }
}

export async function getStudentDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.params.nameOrId;
    const student = dataStore.data.students.find(
      s => s.id === query || s.name.toLowerCase() === decodeURIComponent(query).toLowerCase()
    );

    if (!student) {
      sendSuccess(res, null);
      return;
    }

    const isPending = student.status === 'Assessment pending' || student.healthScore === null || student.healthScore === undefined;
    const hours = Math.floor((student.learningMinutes || 0) / 60);
    const mins = (student.learningMinutes || 0) % 60;
    const timeFormatted = isPending ? '0 minutes' : (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);

    const detail = {
      id: student.id,
      name: student.name,
      initials: student.initials,
      meta: `${student.className || 'Year 10'} · ${student.primarySubject} · ${isPending ? 'Assessment pending' : 'Active learner'}`,
      healthScore: isPending ? null : student.healthScore,
      healthScoreDisplay: isPending ? 'Not available' : `${student.healthScore}`,
      healthStatus: isPending ? 'Assessment pending' : AnalyticsService.getStudentCategory(student.healthScore as number),
      overallPerformance: isPending ? 0 : (dataStore.data.dashboard.overallPerformance ?? Math.max(50, (student.healthScore as number) - 7)),
      learningTimeFormatted: timeFormatted,
      streakDays: isPending ? 0 : (dataStore.data.dashboard.learningStreakDays || 12),
      roundsCompleted: isPending ? 0 : (dataStore.data.practiceAttempts?.length || 16),
      subjects: isPending ? [] : (dataStore.data.subjects.length > 0 ? dataStore.data.subjects.map(s => ({ name: s.name, score: s.score })) : [
        { name: 'Mathematics', score: student.healthScore || 0 }
      ]),
      topics: isPending ? [] : (dataStore.data.subjects.flatMap(s => s.topics).slice(0, 5).map(t => ({ topic: t.name, score: t.score, note: t.status }))),
      recommendation: isPending ? {
        title: `Waiting for ${student.name} to complete Quick Learning Check`,
        text: 'Personalised recommendations and performance trends will appear once the diagnostic assessment is completed.'
      } : {
        title: 'Build confidence in Fractions.',
        text: 'Adam needs more practice with equivalent fractions and fractions addition.'
      },
      recentActivity: isPending ? [] : (dataStore.data.recentActivity && dataStore.data.recentActivity.length ? dataStore.data.recentActivity.map((a: any) => ({
        icon: a.type === 'practice' ? '∑' : a.type === 'lesson' ? '⚗' : '✦',
        title: a.subject ? `${a.subject}: ${a.topic || a.name}` : (a.name || 'Activity completed'),
        detail: a.detail || a.date || 'Recent'
      })) : [
        { icon: '✦', title: 'Quick Learning Check completed', detail: '20 calibrated questions · today' }
      ])
    };

    sendSuccess(res, detail);
  } catch (err) {
    next(err);
  }
}

export async function getInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (dataStore.data.students.length === 0) {
      sendSuccess(res, {
        recommendations: [],
        emptyTitle: 'No interventions are available yet.',
        emptyMessage: 'Recommendations will appear when student learning data is available.'
      });
      return;
    }
    const recommendations = RecommendationEngine.getTeacherPriorityRecommendations();
    sendSuccess(res, { recommendations });
  } catch (err) {
    next(err);
  }
}

export async function createIntervention(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentName, focus, action, notes } = req.body;

    if (studentName && !dataStore.data.assignedInterventionStudents.includes(studentName)) {
      dataStore.data.assignedInterventionStudents.push(studentName);
    }

    const newIntervention = {
      id: `int-${Date.now()}`,
      studentId: `student-${Date.now()}`,
      studentName: studentName || 'Student',
      status: 'problem' as const,
      classification: focus || 'Guided Support',
      subject: 'Mathematics',
      topic: focus || 'Subtraction',
      healthScore: 47,
      topicScore: '54%',
      learningMinutes: '38 min',
      recommendation: action || '15-minute guided support plan created',
      plan: notes || 'Guided questions and review session.',
      createdAt: new Date().toISOString()
    };

    dataStore.data.interventions.push(newIntervention);
    dataStore.save();

    sendSuccess(res, {
      intervention: newIntervention,
      assignedStudents: dataStore.data.assignedInterventionStudents,
      message: `Support plan created for ${studentName}.`
    });
  } catch (err) {
    next(err);
  }
}

export async function getInterventions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = (req.query.category as string) || 'problem';
    const allInterventions = dataStore.data.interventions || [];

    if (allInterventions.length === 0) {
      sendSuccess(res, {
        category,
        counts: { total: 0, problem: 0, review: 0, complete: 0 },
        students: [],
        selectedStudent: null,
        emptyTitle: 'No interventions are available yet.',
        emptyMessage: 'Recommendations will appear when student learning data is available.'
      });
      return;
    }

    const filtered = allInterventions.filter(i => category === 'all' || i.status === category);
    const counts = {
      total: allInterventions.length,
      problem: allInterventions.filter(i => i.status === 'problem').length,
      review: allInterventions.filter(i => i.status === 'review').length,
      complete: allInterventions.filter(i => i.status === 'complete').length
    };

    const students = filtered.map(i => ({
      id: i.id,
      name: i.studentName || 'Student',
      classification: i.classification,
      focus: i.topic,
      health: i.healthScore,
      topic: typeof i.topicScore === 'number' ? `${i.topicScore}%` : i.topicScore,
      time: typeof i.learningMinutes === 'number' ? `${i.learningMinutes} min` : i.learningMinutes,
      description: i.recommendation,
      plan: i.plan
    }));

    sendSuccess(res, {
      category,
      counts,
      students,
      selectedStudent: students[0] || null
    });
  } catch (err) {
    next(err);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (dataStore.data.students.length === 0) {
      sendSuccess(res, {
        period: 'Current Term · 0 students',
        classHealthScore: 0,
        averagePerformance: 0,
        studentsOnTrack: 0,
        studentsNeedingSupport: 0,
        subjectPerformance: [],
        weeklyPerformance: [],
        studentsNeedingSupportList: [],
        emptyTitle: 'No students have been added yet.',
        emptyMessage: 'Class progress will appear after students complete their learning check.'
      });
      return;
    }

    const classMetrics = AnalyticsService.calculateClassHealthScore();
    const assessedStudents = dataStore.data.students.filter(s => typeof s.healthScore === 'number' && s.healthScore !== null);
    const avgPerf = assessedStudents.length > 0
      ? Math.round(assessedStudents.reduce((acc, s) => acc + (s.healthScore as number), 0) / assessedStudents.length)
      : 0;

    const report = {
      period: `Current Term · ${dataStore.data.students.length} students`,
      classHealthScore: classMetrics.classHealthScore,
      averagePerformance: avgPerf,
      studentsOnTrack: classMetrics.onTrackCount,
      studentsNeedingSupport: classMetrics.needsSupportCount,
      subjectPerformance: [],
      weeklyPerformance: [],
      studentsNeedingSupportList: assessedStudents
        .filter(s => (s.healthScore as number) < 55)
        .map(s => ({ name: s.name, need: `${s.primarySubject} support`, score: s.healthScore })),
      recommendedNextAction: null
    };

    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = dataStore.data.teacherProfiles['current-teacher'] || {
      name: '',
      initials: '',
      teacherId: '',
      school: '',
      district: '',
      primarySubject: 'Mathematics',
      teachingLevel: 'Grade 5'
    };
    const classes = dataStore.data.classes;
    sendSuccess(res, { profile, classes });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const current = dataStore.data.teacherProfiles['current-teacher'] || {
      name: '',
      initials: '',
      teacherId: '',
      school: '',
      district: '',
      primarySubject: 'Mathematics',
      teachingLevel: 'Grade 5'
    };
    const updated = {
      ...current,
      name: req.body.teacherName || current.name || 'Teacher',
      initials: (req.body.teacherName || current.name || 'TC').split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
      teacherId: req.body.teacherId || current.teacherId,
      school: req.body.school || current.school,
      district: req.body.district || current.district,
      primarySubject: req.body.subject || current.primarySubject,
      teachingLevel: req.body.level || current.teachingLevel
    };

    dataStore.data.teacherProfiles['current-teacher'] = updated;
    const user = dataStore.data.users.find(u => u.role === 'teacher');
    if (user) user.name = updated.name;

    dataStore.save();
    sendSuccess(res, { profile: updated, message: 'Your teacher profile has been saved.' });
  } catch (err) {
    next(err);
  }
}
