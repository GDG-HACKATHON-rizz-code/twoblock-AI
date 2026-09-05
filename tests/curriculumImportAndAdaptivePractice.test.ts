import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpapghryrtnelmgfnfjg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

describe('Grade 5 Bahasa Melayu & Mathematics Curriculum & Adaptive Practice', () => {

  it('1. Supabase Storage: verified dataset archives exist in private curriculum-resources bucket', async () => {
    const { data: bmFiles, error: bmErr } = await supabase.storage
      .from('curriculum-resources')
      .list('bahasa-melayu/grade-5/source');
    
    assert.strictEqual(bmErr, null, 'Error listing BM storage files');
    assert(bmFiles && bmFiles.some(f => f.name === 'dataset.zip'), 'BM dataset.zip must exist in storage');

    const { data: mathFiles, error: mathErr } = await supabase.storage
      .from('curriculum-resources')
      .list('mathematics/grade-5/source');

    assert.strictEqual(mathErr, null, 'Error listing Math storage files');
    assert(mathFiles && mathFiles.some(f => f.name === 'dataset.zip'), 'Math dataset.zip must exist in storage');
  });

  it('2. Supabase Database: verified syllabus questions exist in DB', async () => {
    const { count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    assert.strictEqual(error, null, 'Error querying questions count');
    assert(count && count >= 200, `Expected at least 200 questions in DB, got ${count}`);
  });

  it('3. Practice API: generates valid syllabus question for Bahasa Melayu Grade 5', async () => {
    const res = await fetch(`${BASE_URL}/api/student/practice/generate-syllabus-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Bahasa Melayu',
        studentGrade: 5,
        topicName: 'Kata Adjektif',
        subtopicName: 'Sifat',
        difficulty: 'medium'
      })
    });

    assert.strictEqual(res.status, 200, 'Endpoint should return 200');
    const data = await res.json();
    assert(data.success, 'Response should indicate success');
    const q = data.data;

    assert.strictEqual(q.subject, 'Bahasa Melayu', 'Subject must be Bahasa Melayu');
    assert.strictEqual(q.gradeLevel, 5, 'Grade level must be 5');
    assert(Array.isArray(q.options), 'Options must be an array');
    assert.strictEqual(q.options.length, 4, 'Must have exactly 4 options');
    assert(q.options.includes(q.correctAnswer || q.answer), 'Correct answer must be present in options');
    assert(Boolean(q.explanation), 'Question must include an explanation');
  });

  it('4. Practice API: generates valid syllabus question for Mathematics Grade 5 (Pecahan)', async () => {
    const res = await fetch(`${BASE_URL}/api/student/practice/generate-syllabus-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Mathematics',
        studentGrade: 5,
        topicName: 'Pecahan',
        difficulty: 'easy'
      })
    });

    assert.strictEqual(res.status, 200, 'Endpoint should return 200');
    const data = await res.json();
    assert(data.success, 'Response should indicate success');
    const q = data.data;

    assert.strictEqual(q.subject, 'Mathematics', 'Subject must be Mathematics');
    assert.strictEqual(q.gradeLevel, 5, 'Grade level must be 5');
    assert.strictEqual(q.options.length, 4, 'Must have exactly 4 options');
    assert(q.options.includes(q.correctAnswer || q.answer), 'Correct answer must match one of the options');
  });

  it('5. Adaptive calibration: fast correct upgrades difficulty; wrong downgrades difficulty', async () => {
    // Fast correct (4s) should raise easy to medium or medium to hard
    const resElevated = await fetch(`${BASE_URL}/api/student/practice/generate-syllabus-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Mathematics',
        studentGrade: 5,
        topicName: 'Operasi Asas',
        difficulty: 'easy',
        previousAnswers: [{ isCorrect: true, responseTimeSeconds: 4 }]
      })
    });

    const dataElevated = await resElevated.json();
    assert.strictEqual(dataElevated.data.difficulty, 'medium', 'Fast correct on easy should elevate to medium');

    // Incorrect should drop hard to medium
    const resDropped = await fetch(`${BASE_URL}/api/student/practice/generate-syllabus-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Mathematics',
        studentGrade: 5,
        topicName: 'Operasi Asas',
        difficulty: 'hard',
        previousAnswers: [{ isCorrect: false, responseTimeSeconds: 25 }]
      })
    });

    const dataDropped = await resDropped.json();
    assert.strictEqual(dataDropped.data.difficulty, 'medium', 'Incorrect answer on hard should reduce to medium');
  });

  it('6. Answer submission: updates progress and persists score', async () => {
    const res = await fetch(`${BASE_URL}/api/student/practice/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: 'test-student-adaptive-1',
        subject: 'Bahasa Melayu',
        topic: 'Kata Adjektif',
        studentAnswer: 'rajin',
        correctAnswer: 'rajin',
        timeSpentSeconds: 8,
        questionText: 'Apakah kata adjektif bagi sifat rajin?'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success);
    assert.strictEqual(data.data.isCorrect, true);
    assert(typeof data.data.subjectScore === 'number');
    assert(typeof data.data.newTopicScore === 'number');
  });
});
