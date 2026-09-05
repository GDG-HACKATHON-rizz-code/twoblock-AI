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
        emptyMessage: 'No students or class data yet.'
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
      { subject: 'Mathematics', score: 70, changePercent: 8, priority: 'Subtraction', weeklyScores: [43, 55, 48, 66, 72, 62, 70] },
      { subject: 'Bahasa Melayu', score: 67, changePercent: 3, priority: 'Sentence structure', weeklyScores: [54, 49, 61, 65, 58, 68, 67] },
      { subject: 'English', score: 67, changePercent: 4, priority: 'Essay evidence', weeklyScores: [45, 56, 59, 62, 68, 65, 67] },
      { subject: 'Science', score: 90, changePercent: 10, priority: 'Strong', weeklyScores: [73, 78, 82, 79, 88, 86, 90] }
    ];

    const studentList = dataStore.data.students.map(s => {
      const hours = Math.floor(s.learningMinutes / 60);
      const mins = s.learningMinutes % 60;
      const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      return {
        ...s,
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
      sendSuccess(res, { students: [], counts: { good: 0, bad: 0, total: 0 }, filter, emptyMessage: 'No students or class data yet.' });
      return;
    }

    let list = dataStore.data.students;
    if (filter === 'bad') {
      list = list.filter(s => s.healthScore < 55);
    } else if (filter === 'mid') {
      list = list.filter(s => s.healthScore >= 55 && s.healthScore < 75);
    } else if (filter === 'good') {
      list = list.filter(s => s.healthScore >= 75);
    }

    const students = list.map(s => {
      const hours = Math.floor(s.learningMinutes / 60);
      const mins = s.learningMinutes % 60;
      const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      const statusClass = s.healthScore >= 75 ? 'good' : s.healthScore >= 55 ? 'watch' : 'risk';

      return {
        id: s.id,
        name: s.name,
        initials: s.initials,
        subject: s.primarySubject,
        healthScore: s.healthScore,
        learningMinutes: s.learningMinutes,
        timeFormatted,
        status: s.status,
        statusClass,
        trend: s.trend,
        trendSymbol: s.trend === 'up' ? '↗' : s.trend === 'steady' ? '→' : '↘'
      };
    });

    const counts = {
      good: dataStore.data.students.filter(s => s.healthScore >= 75).length,
      bad: dataStore.data.students.filter(s => s.healthScore < 55).length,
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
    ) || dataStore.data.students[0];

    const hours = Math.floor(student.learningMinutes / 60);
    const mins = student.learningMinutes % 60;
    const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const detail = {
      id: student.id,
      name: student.name,
      initials: student.initials,
      meta: `Year 10 · ${student.primarySubject} focus · Active today`,
      healthScore: student.healthScore,
      healthStatus: AnalyticsService.getStudentCategory(student.healthScore),
      overallPerformance: Math.max(50, student.healthScore - 7),
      learningTimeFormatted: timeFormatted,
      streakDays: 12,
      roundsCompleted: 24,
      subjects: [
        { name: 'Mathematics', score: 70 },
        { name: 'Bahasa Melayu', score: 67 },
        { name: 'English', score: 67 },
        { name: 'Science', score: 90 }
      ],
      topics: [
        { topic: 'Addition', score: 88, note: 'Strong foundation' },
        { topic: 'Subtraction', score: 54, note: 'Recommended guided practice' },
        { topic: 'Multiplication', score: 62, note: 'Developing' },
        { topic: 'Division', score: 58, note: 'Needs more repetition' }
      ],
      recommendation: {
        title: student.healthScore >= 80 ? `Keep ${student.name} challenged in Science` : `Support ${student.name} with Subtraction`,
        text: student.healthScore >= 80
          ? `${student.name} is performing strongly in Science at 90%. Consider offering extension questions while targeted Mathematics continues.`
          : `${student.name} is below mastery thresholds. Offer a short 15-minute visual mini-lesson to rebuild core arithmetic.`
      },
      recentActivity: [
        { icon: '∑', title: 'Mathematics practice', detail: 'Subtraction · 15 minutes · today' },
        { icon: '⚗', title: 'Science lesson', detail: 'Cell structure · 28 minutes · yesterday' },
        { icon: '✦', title: 'Practice round completed', detail: 'Addition Level 1 · 88% · 2 days ago' }
      ]
    };

    sendSuccess(res, detail);
  } catch (err) {
    next(err);
  }
}

export async function getInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (dataStore.data.students.length === 0) {
      sendSuccess(res, { recommendations: [], emptyMessage: 'No students or class data yet.' });
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

    if (dataStore.data.students.length === 0) {
      sendSuccess(res, {
        category,
        counts: { total: 0, problem: 0, review: 0, complete: 0 },
        students: [],
        selectedStudent: null,
        emptyMessage: 'No students or class data yet.'
      });
      return;
    }

    const unassignedProblems = [
      { name: 'Omar P.', classification: 'Low Mathematics performance', focus: 'Subtraction', health: 47, topic: '54%', time: '38 min', description: 'Omar needs guided Mathematics support before moving to more difficult number work.', plan: 'Schedule a 15-minute guided subtraction activity: five minutes of visual warm-up, seven minutes of teacher-guided questions, and a short review.' },
      { name: 'Chong L.', classification: 'Low topic mastery', focus: 'Subtraction', health: 48, topic: '52%', time: '41 min', description: 'Chong benefits from visual “take away” activities and short repetition practice.', plan: 'Use visual counters for a 15-minute small-group session, then check understanding with three simple questions.' },
      { name: 'Oliver B.', classification: 'Low engagement', focus: 'English reading', health: 49, topic: '58%', time: '35 min', description: 'Oliver’s English engagement has declined during the last week.', plan: 'Schedule a short check-in and assign one age-appropriate reading activity with encouragement.' }
    ].filter(s => !dataStore.data.assignedInterventionStudents.includes(s.name));

    const reviewStudents = [
      { name: 'Amira M.', classification: 'Review due', focus: 'Maths + Science plan', health: 91, topic: '54%', time: '4h 12m', description: 'Amira’s extension-and-support plan is ready for teacher review this week.', plan: 'Review her Science extension activity and confirm whether the weekly subtraction support can continue or be adjusted.' },
      { name: 'Omar P.', classification: 'Review due', focus: 'Subtraction plan', health: 47, topic: '54%', time: '38 min', description: 'Omar’s guided subtraction plan needs a progress review.', plan: 'Compare his new subtraction answers with the baseline, then extend the plan if accuracy remains below 60%.' },
      { name: 'Chong L.', classification: 'Review due', focus: 'Visual Maths activity', health: 48, topic: '52%', time: '41 min', description: 'Chong’s visual activity plan is due for a teacher review.', plan: 'Check whether visual supports improved accuracy before moving to mixed subtraction questions.' }
    ];

    const completeStudents = [
      { name: 'Amira M.', classification: 'Complete check', focus: 'Science extension', health: 91, topic: '90%', time: '4h 12m', description: 'Amira completed a Science extension task and is ready for a teacher check.', plan: 'Review the extension task, celebrate progress, and assign the next Science challenge.' },
      { name: 'Jin L.', classification: 'Complete check', focus: 'Science confidence practice', health: 68, topic: '72%', time: '1h 08m', description: 'Jin completed the planned confidence practice this week.', plan: 'Review the completed questions and set one realistic next learning goal.' },
      { name: 'Sofia R.', classification: 'Complete check', focus: 'English writing task', health: 86, topic: '84%', time: '2h 41m', description: 'Sofia completed her English writing practice successfully.', plan: 'Provide short feedback and offer a more challenging evidence-writing activity.' }
    ];

    const categoryMap: Record<string, any[]> = {
      problem: unassignedProblems,
      review: reviewStudents,
      complete: completeStudents
    };

    const students = categoryMap[category] || unassignedProblems;

    sendSuccess(res, {
      category,
      counts: {
        total: 30,
        problem: unassignedProblems.length,
        review: reviewStudents.length,
        complete: completeStudents.length
      },
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
        period: 'September 2026 · Year 10 · 0 students',
        classHealthScore: 0,
        averagePerformance: 0,
        studentsOnTrack: 0,
        studentsNeedingSupport: 0,
        subjectPerformance: [],
        weeklyPerformance: [],
        studentsNeedingSupportList: [],
        emptyMessage: 'No students or class data yet.'
      });
      return;
    }

    const classMetrics = AnalyticsService.calculateClassHealthScore();

    const report = {
      period: 'September 2026 · Year 10 · 30 students',
      classHealthScore: classMetrics.classHealthScore,
      averagePerformance: 74,
      studentsOnTrack: classMetrics.onTrackCount,
      studentsNeedingSupport: classMetrics.needsSupportCount,
      subjectPerformance: [
        { subject: 'Mathematics', score: '70%', trend: '↑ 8%', priority: 'Subtraction', priorityClass: 'high' },
        { subject: 'Bahasa Melayu', score: '67%', trend: '↑ 3%', priority: 'Sentence structure', priorityClass: 'mid' },
        { subject: 'English', score: '67%', trend: '↑ 4%', priority: 'Essay evidence', priorityClass: 'mid' },
        { subject: 'Science', score: '90%', trend: '↑ 10%', priority: 'Strong', priorityClass: 'good' }
      ],
      weeklyPerformance: [
        { day: 'Mon', score: 54 },
        { day: 'Tue', score: 60 },
        { day: 'Wed', score: 66 },
        { day: 'Thu', score: 72 },
        { day: 'Fri', score: 78 },
        { day: 'Sat', score: 69 },
        { day: 'Sun', score: 74 }
      ],
      studentsNeedingSupportList: [
        { name: 'Omar P.', need: 'Maths subtraction', score: 47 },
        { name: 'Chong L.', need: 'Maths subtraction', score: 48 },
        { name: 'Oliver B.', need: 'English engagement', score: 49 }
      ],
      recommendedNextAction: {
        title: 'Reteach subtraction in a small group.',
        text: 'Nine learners are below the 60% mastery threshold. Use a 15-minute visual mini-lesson, then assign Level 1 adaptive practice and review results next week.'
      }
    };

    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = dataStore.data.teacherProfiles['teacher-liyana-001'];
    const classes = dataStore.data.classes;
    sendSuccess(res, { profile, classes });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const current = dataStore.data.teacherProfiles['teacher-liyana-001'];
    const updated = {
      ...current,
      name: req.body.teacherName || current.name,
      initials: (req.body.teacherName || current.name).split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
      teacherId: req.body.teacherId || current.teacherId,
      school: req.body.school || current.school,
      district: req.body.district || current.district,
      primarySubject: req.body.subject || current.primarySubject,
      teachingLevel: req.body.level || current.teachingLevel
    };

    dataStore.data.teacherProfiles['teacher-liyana-001'] = updated;
    const user = dataStore.data.users.find(u => u.role === 'teacher');
    if (user) user.name = updated.name;

    dataStore.save();
    sendSuccess(res, { profile: updated, message: 'Your teacher profile has been saved.' });
  } catch (err) {
    next(err);
  }
}
