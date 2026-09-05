import { ScoringService, SCORING_WEIGHTS } from '../src/services/scoringService.js';
import { GeminiPracticeService } from '../src/services/geminiPracticeService.js';
import { dataStore } from '../src/services/dataStore.js';

async function runTests() {
  console.log('=== TEST 1: Weighted Scoring Formula ===');
  // Case A: 70% previous, 100% latest -> 79%
  const scoreA = ScoringService.calculateWeightedScore(70, 100, SCORING_WEIGHTS);
  console.log('70% prev + 100% latest ->', scoreA, '(Expected: 79)');
  if (scoreA !== 79) throw new Error(`Expected 79, got ${scoreA}`);

  // Case B: 70% previous, 0% latest -> 49%
  const scoreB = ScoringService.calculateWeightedScore(70, 0, SCORING_WEIGHTS);
  console.log('70% prev + 0% latest ->', scoreB, '(Expected: 49)');
  if (scoreB !== 49) throw new Error(`Expected 49, got ${scoreB}`);

  // Case C: Initial practice (0% previous), 80% latest -> 80%
  const scoreC = ScoringService.calculateWeightedScore(0, 80, SCORING_WEIGHTS);
  console.log('0% prev + 80% latest ->', scoreC, '(Expected: 80)');
  if (scoreC !== 80) throw new Error(`Expected 80, got ${scoreC}`);

  console.log('=== TEST 2: Gemini Adaptive Question Generator ===');
  const qMath = await GeminiPracticeService.generateAdaptiveQuestion('multiplication', 3, 2, 'Mathematics');
  console.log('Generated Math Question:', qMath.equation, 'Options:', qMath.options, 'Answer:', qMath.answer);
  if (!qMath.equation || qMath.options.length !== 4 || !qMath.answer) {
    throw new Error('Invalid practice question generated');
  }

  console.log('=== TEST 3: Process Practice Result Flow ===');
  const studentId = 'test-student-flow-001';
  
  // Set initial subject data
  dataStore.data.subjects = [
    {
      id: 'mathematics',
      name: 'Mathematics',
      score: 70,
      mastery: 75,
      learningMinutes: 60,
      status: 'On track',
      strength: 'Addition',
      topics: [
        { id: 'addition', name: 'Addition', score: 85, status: 'Mastered', correctAnswers: 8, totalAnswers: 10, timeSpentMinutes: 20 },
        { id: 'subtraction', name: 'Subtraction', score: 55, status: 'Developing', correctAnswers: 5, totalAnswers: 10, timeSpentMinutes: 20 }
      ],
      learningGaps: ['Subtraction']
    }
  ];

  // Submit correct answer for Subtraction
  const res1 = await ScoringService.processPracticeResult({
    studentId,
    topic: 'subtraction',
    subject: 'Mathematics',
    question: '15 - 7 = ?',
    submittedAnswer: '8',
    correctAnswer: '8',
    isCorrect: true,
    timeSpentSeconds: 15
  });

  console.log('After Correct Answer in Subtraction:');
  console.log('- Topic Score:', res1.topicProgress.previousScore, '->', res1.topicProgress.score);
  console.log('- Topic Mastery:', res1.topicProgress.status);
  console.log('- Subject Score:', res1.subjectProgress.previousScore, '->', res1.subjectProgress.score);
  console.log('- Subject Trend:', res1.subjectProgress.trend);
  console.log('- Student Overall Performance:', res1.studentMetrics.overallPerformance);
  console.log('- Student Health Score:', res1.studentMetrics.healthScore);
  console.log('- Class Health Score:', res1.teacherMetrics.classHealthScore);

  // Verify: 55 * 0.7 + 100 * 0.3 = 38.5 + 30 = 68.5 -> 69
  if (res1.topicProgress.score !== 69) {
    throw new Error(`Expected topic score 69, got ${res1.topicProgress.score}`);
  }
  if (res1.subjectProgress.trend !== 'up') {
    throw new Error(`Expected trend 'up', got ${res1.subjectProgress.trend}`);
  }

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
