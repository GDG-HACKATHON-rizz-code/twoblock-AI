import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { dataStore } from '../src/services/dataStore.js';
import { seedTeacherOnly } from '../src/scripts/seedTeacher.js';
import * as studentController from '../src/controllers/studentController.js';
import * as teacherController from '../src/controllers/teacherController.js';

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.json = (payload: any) => {
    res.payload = payload;
    return res;
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  return res;
}

describe('Real-Data Student Lifecycle & Teacher Class Sync', () => {
  before(async () => {
    // 1. Seed teacher account only from teacher-demo-data.json
    await seedTeacherOnly();
  });

  it('Step 1: Teacher account seeded with classes and 0 fake students', async () => {
    const res = createMockRes();
    await teacherController.getProfile({} as any, res, () => {});
    const data = res.payload?.data;

    assert.strictEqual(data.profile.name, 'Liyana K.');
    assert.strictEqual(data.profile.teacherId, 'TCH-10482');
    assert.strictEqual(data.profile.school, 'Sekolah Menengah Maju Jaya');
    assert.strictEqual(data.classes.length, 3);

    // Initial student directory must be completely empty
    const studRes = createMockRes();
    await teacherController.getStudents({ query: { filter: 'all' } } as any, studRes, () => {});
    const studData = studRes.payload?.data;

    assert.strictEqual(studData.students.length, 0);
    assert.strictEqual(studData.counts.total, 0);
    assert.strictEqual(dataStore.data.students.length, 0);
  });

  it('Step 2: Class mismatch returns appropriate notice when code or school does not match', async () => {
    const res = createMockRes();
    await studentController.updateProfile({
      body: {
        userId: 'student-mismatch-99',
        name: 'Unmatched Student',
        grade: 'Grade 3',
        school: 'Sekolah Kebangsaan Subang Jaya',
        city: 'Subang',
        birth: '2014-05-12',
        language: 'English',
        favourite: 'Science',
        studytime: 'Evening',
        classCode: 'UNKNOWN_CODE_999'
      }
    } as any, res, () => {});

    const data = res.payload?.data;
    assert.strictEqual(data.classMatched, false);
    assert.strictEqual(
      data.message,
      'Your class is not available yet. Please ask your teacher to create or share a class code.'
    );
  });

  it('Step 3: New student completes Personal Information with class code AMANAH10 -> automatically synced', async () => {
    const res = createMockRes();
    await studentController.updateProfile({
      body: {
        userId: 'student-real-001',
        name: 'Farah Nadia',
        grade: 'Year 10',
        school: 'Sekolah Menengah Maju Jaya',
        city: 'Kuala Lumpur',
        birth: '2010-03-15',
        language: 'English',
        favourite: 'Mathematics',
        studytime: 'Evening',
        classCode: 'AMANAH10'
      }
    } as any, res, () => {});

    const data = res.payload?.data;
    assert.strictEqual(data.classMatched, true);
    assert.ok(data.matchedClass.name.includes('Amanah'));

    // Profile stored in dataStore
    const prof = dataStore.data.studentProfiles['student-real-001'];
    assert.ok(prof);
    assert.strictEqual(prof.name, 'Farah Nadia');
    assert.strictEqual(prof.diagnostic_completed, false);
  });

  it('Step 4: Teacher immediately sees newly synced student with Assessment pending, Not available score, 0m', async () => {
    const studRes = createMockRes();
    await teacherController.getStudents({ query: { filter: 'all' } } as any, studRes, () => {});
    const studData = studRes.payload?.data;

    assert.strictEqual(studData.students.length, 1);
    const studentRow = studData.students[0];
    assert.strictEqual(studentRow.name, 'Farah Nadia');
    assert.strictEqual(studentRow.status, 'Assessment pending');
    assert.strictEqual(studentRow.healthScore, null);
    assert.strictEqual(studentRow.healthScoreDisplay, 'Not available');
    assert.strictEqual(studentRow.learningMinutes, 0);
    assert.strictEqual(studentRow.timeFormatted, '0 minutes');

    // Check teacher overview
    const dashRes = createMockRes();
    await teacherController.getDashboard({} as any, dashRes, () => {});
    const dashData = dashRes.payload?.data;

    assert.strictEqual(dashData.totalStudents, 1);
    assert.strictEqual(dashData.studentList[0].status, 'Assessment pending');
    assert.strictEqual(dashData.studentList[0].healthScoreDisplay, 'Not available');
  });

  it('Step 5: Student executes 20-question Quick Learning Check (5 Math, 5 BM, 5 English, 5 Science)', async () => {
    // Start diagnostic session
    const startRes = createMockRes();
    await studentController.startDiagnostic({
      body: { studentId: 'student-real-001', grade: 10 }
    } as any, startRes, () => {});

    const startData = startRes.payload?.data;
    assert.strictEqual(startData.totalQuestions, 20);
    assert.strictEqual(startData.questionNumber, 1);
    assert.strictEqual(startData.currentQuestion.subject, 'Mathematics');

    const sessionId = startData.sessionId;
    let nextQ = startData.currentQuestion;
    const subjectsSequence: string[] = [];

    // Answer all 20 questions
    for (let qNum = 1; qNum <= 20; qNum++) {
      subjectsSequence.push(nextQ.subject);

      // Intentionally make question 2 wrong in Mathematics to establish a learning gap
      const isWrongTarget = qNum === 2;
      const answerToSubmit = isWrongTarget ? 'wrong_answer_xyz' : (nextQ.options ? nextQ.options[0] : 'correct');

      const ansRes = createMockRes();
      await studentController.submitDiagnosticAnswer({
        body: {
          sessionId,
          questionId: nextQ.id,
          studentAnswer: answerToSubmit,
          timeSpentSeconds: 6
        }
      } as any, ansRes, () => {});

      const ansData = ansRes.payload?.data;

      if (qNum < 20) {
        assert.strictEqual(ansData.isCompleted, false);
        assert.ok(ansData.nextQuestion);
        assert.strictEqual(ansData.nextQuestion.questionNumber, qNum + 1);
        nextQ = ansData.nextQuestion;
      } else {
        assert.strictEqual(ansData.isCompleted, true);
        assert.ok(ansData.assessment);
        
        const assessment = ansData.assessment;
        assert.strictEqual(typeof assessment.overallScore, 'number');
        assert.ok(assessment.overallScore > 0);
        assert.ok(assessment.learningGaps.length > 0);
        assert.ok(assessment.recommendedFirstPracticeTopic.topic);
      }
    }

    // Verify progression: Q1-Q5 Math, Q6-Q10 BM, Q11-Q15 English, Q16-Q20 Science
    const mathCount = subjectsSequence.slice(0, 5).filter(s => s === 'Mathematics').length;
    const bmCount = subjectsSequence.slice(5, 10).filter(s => s === 'Bahasa Melayu').length;
    const engCount = subjectsSequence.slice(10, 15).filter(s => s === 'English').length;
    const sciCount = subjectsSequence.slice(15, 20).filter(s => s === 'Science').length;

    assert.strictEqual(mathCount, 5, 'Questions 1-5 must be Mathematics');
    assert.strictEqual(bmCount, 5, 'Questions 6-10 must be Bahasa Melayu');
    assert.strictEqual(engCount, 5, 'Questions 11-15 must be English');
    assert.strictEqual(sciCount, 5, 'Questions 16-20 must be Science');
  });

  it('Step 6: Teacher views update with real assessment results, real scores, and completed status', async () => {
    const studRes = createMockRes();
    await teacherController.getStudents({ query: { filter: 'all' } } as any, studRes, () => {});
    const studData = studRes.payload?.data;

    assert.strictEqual(studData.students.length, 1);
    const studentRow = studData.students[0];
    assert.strictEqual(studentRow.name, 'Farah Nadia');
    assert.strictEqual(studentRow.status, 'Assessment completed');
    assert.strictEqual(typeof studentRow.healthScore, 'number');
    assert.ok(studentRow.healthScore > 0);
    assert.strictEqual(studentRow.learningMinutes, 15);
  });

  it('Step 7: Personalised practice targets weak topic only and updates real scores', async () => {
    const dashRes = createMockRes();
    await studentController.getDashboard({ user: { id: 'student-real-001' } } as any, dashRes, () => {});
    const dashData = dashRes.payload?.data;

    assert.strictEqual(dashData.hasAssessment, true);
    assert.ok(dashData.recommendedPractice.topic);

    const weakTopic = dashData.recommendedPractice.topic;
    const weakSubj = dashData.recommendedPractice.subject;

    // Practice session on this weak topic
    const practiceAnsRes = createMockRes();
    await studentController.submitAnswer({
      user: { id: 'student-real-001' },
      body: {
        topic: weakTopic,
        subject: weakSubj,
        studentAnswer: '42',
        correctAnswer: '42',
        timeSpentSeconds: 15,
        level: 1
      }
    } as any, practiceAnsRes, () => {});

    const pracData = practiceAnsRes.payload?.data;
    assert.strictEqual(pracData.isCorrect, true);
    assert.strictEqual(typeof pracData.newTopicScore, 'number');
  });
});
