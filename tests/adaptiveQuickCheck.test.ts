import { diagnosticEngine } from '../src/services/diagnosticEngine.js';
import { GeminiPracticeService } from '../src/services/geminiPracticeService.js';
import { dataStore } from '../src/services/dataStore.js';

async function runAdaptiveQuickCheckTests() {
  console.log('=== TEST 1: Diagnostic Session Initialization at Grade 3 ===');
  const studentId = 'student-test-' + Date.now();
  
  const startResult = diagnosticEngine.startSession(studentId, 3);
  const session = startResult.session;
  const q1 = startResult.currentQuestion;

  console.log(`- Session ID: ${session.id}`);
  console.log(`- Initial Grade: ${session.initialGrade}`);
  console.log(`- Current Grade: ${session.currentGrade}`);
  console.log(`- Question 1: "${q1.question}" (${q1.subject}, Grade ${q1.grade})`);
  console.log(`- Options: ${JSON.stringify(q1.options)}`);

  if (session.currentGrade !== 3) throw new Error(`Expected currentGrade 3, got ${session.currentGrade}`);
  if (session.totalQuestions !== 10) throw new Error(`Expected 10 total questions, got ${session.totalQuestions}`);
  if (q1.options.length !== 4) throw new Error(`Expected 4 options, got ${q1.options.length}`);
  if (!q1.subject || !q1.topic || !q1.question) throw new Error('Missing required question fields');

  console.log('\n=== TEST 2: Adaptive Progression - Fast Correct Answer (<=12s) Increases Difficulty ===');
  // Find correct answer for Q1
  const fullQ1 = diagnosticEngine.getQuestions().find(q => q.id === q1.id);
  if (!fullQ1) throw new Error('Full question 1 not found in bank');

  const ans1 = diagnosticEngine.submitAnswer(session.id, fullQ1.id, fullQ1.correctAnswer, 8); // 8 seconds (fast)
  console.log(`- Answer 1 Correct: ${ans1.isCorrect}`);
  console.log(`- New Grade after fast correct answer: ${session.currentGrade}`);
  if (!ans1.isCorrect) throw new Error('Expected answer 1 to be correct');
  if (session.currentGrade !== 4) throw new Error(`Expected Grade 4 after fast correct answer, got ${session.currentGrade}`);

  console.log('\n=== TEST 3: Adaptive Progression - Slow Correct Answer (>12s) Maintains Difficulty ===');
  const q2 = ans1.nextQuestion!;
  const fullQ2 = diagnosticEngine.getQuestions().find(q => q.id === q2.id);
  if (!fullQ2) throw new Error('Full question 2 not found');

  const ans2 = diagnosticEngine.submitAnswer(session.id, fullQ2.id, fullQ2.correctAnswer, 20); // 20 seconds (slow)
  console.log(`- Answer 2 Correct: ${ans2.isCorrect}`);
  console.log(`- New Grade after slow correct answer: ${session.currentGrade}`);
  if (!ans2.isCorrect) throw new Error('Expected answer 2 to be correct');
  if (session.currentGrade !== 4) throw new Error(`Expected Grade 4 maintained after slow answer, got ${session.currentGrade}`);

  console.log('\n=== TEST 4: Adaptive Progression - Incorrect Answer Lowers Difficulty ===');
  const q3 = ans2.nextQuestion!;
  const fullQ3 = diagnosticEngine.getQuestions().find(q => q.id === q3.id);
  if (!fullQ3) throw new Error('Full question 3 not found');

  // Deliberately incorrect answer
  const wrongAnswer = fullQ3.options.find(opt => opt !== fullQ3.correctAnswer) || 'wrong_ans';
  const ans3 = diagnosticEngine.submitAnswer(session.id, fullQ3.id, wrongAnswer, 10);
  console.log(`- Answer 3 Correct: ${ans3.isCorrect}`);
  console.log(`- New Grade after incorrect answer: ${session.currentGrade}`);
  if (ans3.isCorrect) throw new Error('Expected answer 3 to be incorrect');
  if (session.currentGrade !== 3) throw new Error(`Expected Grade 3 after wrong answer, got ${session.currentGrade}`);

  console.log('\n=== TEST 5: Complete 10-Question Diagnostic Assessment & Calibration ===');
  // Answer remaining 7 questions (questions 4 through 10)
  let currentNext = ans3.nextQuestion;
  let finalAnsResult = null;

  for (let i = 4; i <= 10; i++) {
    if (!currentNext) throw new Error(`Expected question ${i} to be present`);
    const qItem = diagnosticEngine.getQuestions().find(q => q.id === currentNext!.id);
    if (!qItem) throw new Error(`Question ${i} (${currentNext.id}) not in bank`);

    // Alternate correct and incorrect to test mixed performance
    const shouldBeCorrect = i % 2 === 0;
    const submitted = shouldBeCorrect ? qItem.correctAnswer : (qItem.options.find(o => o !== qItem.correctAnswer) || 'wrong');
    finalAnsResult = diagnosticEngine.submitAnswer(session.id, qItem.id, submitted, 10);
    console.log(`- Q${i} (${qItem.subject}, Grade ${qItem.grade}): ${shouldBeCorrect ? 'CORRECT' : 'WRONG'} -> Grade now ${session.currentGrade}`);
    currentNext = finalAnsResult.nextQuestion;
  }

  if (!finalAnsResult || !finalAnsResult.isCompleted) {
    throw new Error('Expected session to be completed after 10 questions');
  }

  const assessment = finalAnsResult.assessment!;
  console.log('\n=== TEST 6: Verify Initial Assessment Results ===');
  console.log(`- Overall Score: ${assessment.overallScore}%`);
  console.log(`- Estimated Grade Level: ${assessment.estimatedGradeLevel}`);
  console.log(`- Subject Scores:`, assessment.subjectScores);
  console.log(`- Topic Strengths:`, assessment.topicStrengths);
  console.log(`- Learning Gaps:`, assessment.learningGaps);
  console.log(`- Recommended First Topic:`, assessment.recommendedFirstPracticeTopic);

  if (typeof assessment.overallScore !== 'number') throw new Error('Invalid overallScore');
  if (typeof assessment.estimatedGradeLevel !== 'number') throw new Error('Invalid estimatedGradeLevel');
  if (!assessment.subjectScores['Mathematics']) throw new Error('Missing Mathematics score');
  if (!assessment.subjectScores['Science']) throw new Error('Missing Science score');
  if (!assessment.subjectScores['English']) throw new Error('Missing English score');
  if (!assessment.subjectScores['Bahasa Melayu']) throw new Error('Missing Bahasa Melayu score');
  if (assessment.topicStrengths.length === 0) throw new Error('Strengths should not be empty');
  if (assessment.learningGaps.length === 0) throw new Error('Learning gaps should not be empty');
  if (!assessment.recommendedFirstPracticeTopic.topic) throw new Error('Missing recommended topic');

  console.log('\n=== TEST 7: Multi-Subject Adaptive Question Generation within Syllabus ===');
  const subjectsToTest = [
    { subject: 'Mathematics', topic: 'multiplication', grade: 3 },
    { subject: 'Bahasa Melayu', topic: 'tatabahasa', grade: 2 },
    { subject: 'English', topic: 'grammar', grade: 4 },
    { subject: 'Science', topic: 'living things', grade: 1 }
  ];

  for (const s of subjectsToTest) {
    const q = await GeminiPracticeService.generateAdaptiveQuestion(s.topic, s.grade, 2, s.subject);
    console.log(`[${s.subject} G${s.grade}] "${q.equation}" (options: ${q.options.length}, answer: ${q.answer})`);
    if (!q.equation || q.options.length !== 4 || !q.answer) {
      throw new Error(`Failed to generate valid adaptive question for ${s.subject}`);
    }
  }

  console.log('\n=== TEST 8: Clamped Grade Bounds (Never < 1, Never > 6) ===');
  const studentLow = 'low-grade-student';
  const lowSession = diagnosticEngine.startSession(studentLow, 1).session;
  // Intentionally fail multiple times at Grade 1
  for (let k = 0; k < 4; k++) {
    diagnosticEngine.submitAnswer(lowSession.id, diagnosticEngine.getQuestions()[0].id, 'wrong_ans', 10);
  }
  console.log(`- Grade after multiple failures at Grade 1: ${lowSession.currentGrade} (Should be 1)`);
  if (lowSession.currentGrade < 1) throw new Error(`Grade dropped below 1: ${lowSession.currentGrade}`);

  const studentHigh = 'high-grade-student';
  const highSession = diagnosticEngine.startSession(studentHigh, 6).session;
  // Intentionally pass quickly multiple times at Grade 6
  for (let k = 0; k < 4; k++) {
    const qSample = diagnosticEngine.getQuestions()[0];
    diagnosticEngine.submitAnswer(highSession.id, qSample.id, qSample.correctAnswer, 5);
  }
  console.log(`- Grade after multiple fast successes at Grade 6: ${highSession.currentGrade} (Should be 6)`);
  if (highSession.currentGrade > 6) throw new Error(`Grade exceeded 6: ${highSession.currentGrade}`);

  console.log('\n ALL 8 ADAPTIVE QUICK LEARNING CHECK TESTS PASSED SUCCESSFULLY! ');
}

runAdaptiveQuickCheckTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
