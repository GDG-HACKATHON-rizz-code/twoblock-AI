import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpapghryrtnelmgfnfjg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

interface RawQuestion {
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty_level?: number;
  question_text?: string;
  question_type?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  language?: string;
  is_diagnostic?: boolean;
  grade_level?: string | number;
}

export interface StandardQuestion {
  id: string;
  subject: string;
  gradeLevel: number;
  topic: string;
  subtopic: string;
  questionText: string;
  questionType: 'mcq' | 'short_answer';
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  difficultyLabel: 'easy' | 'medium' | 'hard';
  language: 'ms' | 'en';
  isDiagnostic: boolean;
  sourceReference: string;
}

export interface StandardTopic {
  id: string;
  grade: number;
  subject: string;
  topic: string;
  subtopic: string;
  difficultyMin: 'easy' | 'medium' | 'hard';
  difficultyMax: 'easy' | 'medium' | 'hard';
  learningObjective: string;
}

const SUBJECT_IDS: Record<string, string> = {
  'Mathematics': '17efaa74-9793-4af7-b933-4fefa1f3f037',
  'Bahasa Melayu': '52bcad8a-3807-4038-87f0-d83d28088225',
  'English': 'c4f7dd88-93fe-43ab-bde4-a6cf5ebdc623',
  'Science': 'bcd5da24-adb3-4850-8d75-e0b23a570d26',
};

function normalizeOptions(raw: RawQuestion): { options: string[]; answer: string } {
  const optA = (raw.option_a || '').trim();
  const optB = (raw.option_b || '').trim();
  const optC = (raw.option_c || '').trim();
  const optD = (raw.option_d || '').trim();

  let options = [optA, optB, optC, optD].filter(o => o.length > 0);
  if (options.length === 0 && Array.isArray(raw.options)) {
    options = raw.options.map(o => String(o).trim());
  }

  // Ensure exactly 4 options
  while (options.length < 4) {
    options.push(`Option ${String.fromCharCode(65 + options.length)}`);
  }

  let ans = String(raw.correct_answer || '').trim();
  const lowerAns = ans.toLowerCase();

  if (lowerAns === 'a' || lowerAns === 'option_a' || lowerAns === 'option a') {
    ans = options[0];
  } else if (lowerAns === 'b' || lowerAns === 'option_b' || lowerAns === 'option b') {
    ans = options[1];
  } else if (lowerAns === 'c' || lowerAns === 'option_c' || lowerAns === 'option c') {
    ans = options[2];
  } else if (lowerAns === 'd' || lowerAns === 'option_d' || lowerAns === 'option d') {
    ans = options[3];
  } else {
    // If not direct option key, check if text matches one of the options
    const exactMatch = options.find(o => o.toLowerCase() === lowerAns);
    if (exactMatch) {
      ans = exactMatch;
    } else {
      // If none matches, default to option A to prevent orphaned answers
      ans = options[0];
    }
  }

  return { options, answer: ans };
}

function getLearningObjective(subject: string, topic: string, subtopic: string): string {
  if (subject === 'Bahasa Melayu') {
    if (topic.includes('Adjektif')) {
      return `Mengenal pasti dan membina ayat menggunakan kata adjektif ${subtopic.toLowerCase()} dengan tepat.`;
    }
    if (topic.includes('Nama')) {
      return `Memahami fungsi dan menggunakan ${subtopic.toLowerCase()} mengikut konteks ayat standard.`;
    }
    return `Menguasai kemahiran tatabahasa dan kosa kata Bahasa Melayu Tahun 5 bagi tajuk ${topic}.`;
  }

  if (subject === 'Mathematics') {
    if (topic.includes('Pecahan')) {
      return `Menyelesaikan operasi pecahan (${subtopic.toLowerCase()}) mengikut sukatan Matematik Tahun 5.`;
    }
    if (topic.includes('Nombor Bulat')) {
      return `Menentukan nilai tempat, nilai digit dan cerakinan nombor hingga 1,000,000.`;
    }
    if (topic.includes('Operasi Asas')) {
      return `Menyelesaikan operasi asas ${subtopic.toLowerCase()} melibatkan nombor bulat sehingga ratus ribu.`;
    }
    return `Menguasai konsep dan penyelesaian masalah Matematik Tahun 5 bagi tajuk ${topic}.`;
  }

  if (subject === 'Science') {
    return `Menjelaskan konsep ${topic} (${subtopic}) berpandukan sukatan Sains Tahun 5.`;
  }

  return `Master key Grade 5 learning objectives for ${topic}.`;
}

async function uploadFileToStorage(localPath: string, storagePath: string) {
  if (!fs.existsSync(localPath)) {
    console.warn(`File not found for storage upload: ${localPath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(localPath);
  console.log(`Uploading ${path.basename(localPath)} (${fileBuffer.length} bytes) to curriculum-resources/${storagePath}...`);

  const { data, error } = await supabase.storage
    .from('curriculum-resources')
    .upload(storagePath, fileBuffer, {
      contentType: storagePath.endsWith('.zip') ? 'application/zip' : 'application/octet-stream',
      upsert: true
    });

  if (error) {
    console.error(`Error uploading to ${storagePath}:`, error.message);
    return null;
  }

  console.log(`Successfully uploaded to curriculum-resources/${storagePath}`);
  return data;
}

export async function importAllCurriculum() {
  console.log('🚀 Starting Curriculum Import for Grade 5...');
  const rawBase = path.resolve(process.cwd(), 'data', 'curriculum', 'raw');

  // 1. Upload source archives to Supabase Storage
  console.log('\n📦 Step 1: Uploading source files to Supabase Storage...');
  const bmZip = path.join(rawBase, 'bahasa-melayu', 'dataset.zip');
  const mathZip = path.join(rawBase, 'mathematics', 'dataset.zip');
  const sciDocx = path.join(rawBase, 'science', 'Topic Science G5.docx');

  await uploadFileToStorage(bmZip, 'bahasa-melayu/grade-5/source/dataset.zip');
  await uploadFileToStorage(mathZip, 'mathematics/grade-5/source/dataset.zip');
  if (fs.existsSync(sciDocx)) {
    await uploadFileToStorage(sciDocx, 'science/grade-5/source/Topic Science G5.docx');
  }

  // 2. Parse Bahasa Melayu JSON files
  console.log('\n📖 Step 2: Parsing Bahasa Melayu Grade 5 datasets...');
  const allStandardQuestions: StandardQuestion[] = [];
  const allStandardTopics: StandardTopic[] = [];

  const bmFiles = [
    { file: path.join(rawBase, 'bahasa-melayu', 'Kata_Adjektif.json'), defaultTopic: 'Kata Adjektif' },
    { file: path.join(rawBase, 'bahasa-melayu', 'Kata_Nama.json'), defaultTopic: 'Kata Nama' },
  ];

  const seenQuestions = new Set<string>();

  for (const item of bmFiles) {
    if (fs.existsSync(item.file)) {
      const list: RawQuestion[] = JSON.parse(fs.readFileSync(item.file, 'utf-8'));
      console.log(`  Loaded ${list.length} raw records from ${path.basename(item.file)}`);
      for (const q of list) {
        const text = (q.question_text || '').trim();
        if (!text || seenQuestions.has(text)) continue;
        seenQuestions.add(text);

        const topic = (q.topic || item.defaultTopic).trim();
        const subtopic = (q.subtopic || 'Umum').trim();
        const { options, answer } = normalizeOptions(q);
        const diff = Number(q.difficulty_level) || 1;
        const diffLabel: 'easy' | 'medium' | 'hard' = diff === 1 ? 'easy' : diff === 2 ? 'medium' : 'hard';

        allStandardQuestions.push({
          id: `bm-g5-${allStandardQuestions.length + 1}`,
          subject: 'Bahasa Melayu',
          gradeLevel: 5,
          topic,
          subtopic,
          questionText: text,
          questionType: 'mcq',
          options,
          correctAnswer: answer,
          explanation: q.explanation || `Jawapan yang betul bagi ${topic} (${subtopic}).`,
          difficulty: diff,
          difficultyLabel: diffLabel,
          language: 'ms',
          isDiagnostic: Boolean(q.is_diagnostic),
          sourceReference: `bahasa-melayu/grade-5/${path.basename(item.file)}`
        });
      }
    }
  }

  // 3. Parse Mathematics JSON files
  console.log('\n📐 Step 3: Parsing Mathematics Grade 5 datasets...');
  const mathFiles = [
    { file: path.join(rawBase, 'mathematics', 'Pecahan.json'), defaultTopic: 'Pecahan' },
    { file: path.join(rawBase, 'mathematics', 'Nombor_bulat.json'), defaultTopic: 'Nombor Bulat' },
    { file: path.join(rawBase, 'mathematics', 'operasi_asas.json'), defaultTopic: 'Operasi Asas' },
  ];

  for (const item of mathFiles) {
    if (fs.existsSync(item.file)) {
      const list: RawQuestion[] = JSON.parse(fs.readFileSync(item.file, 'utf-8'));
      console.log(`  Loaded ${list.length} raw records from ${path.basename(item.file)}`);
      for (const q of list) {
        const text = (q.question_text || '').trim();
        if (!text || seenQuestions.has(text)) continue;
        seenQuestions.add(text);

        let topic = (q.topic || item.defaultTopic).trim();
        if (topic.toUpperCase() === 'NOMBOR BULAT') topic = 'Nombor Bulat';
        const subtopic = (q.subtopic || 'Konsep').trim();
        const { options, answer } = normalizeOptions(q);
        const diff = Number(q.difficulty_level) || 1;
        const diffLabel: 'easy' | 'medium' | 'hard' = diff === 1 ? 'easy' : diff === 2 ? 'medium' : 'hard';

        allStandardQuestions.push({
          id: `math-g5-${allStandardQuestions.length + 1}`,
          subject: 'Mathematics',
          gradeLevel: 5,
          topic,
          subtopic,
          questionText: text,
          questionType: 'mcq',
          options,
          correctAnswer: answer,
          explanation: q.explanation || `Langkah pengiraan bagi tajuk ${topic} (${subtopic}).`,
          difficulty: diff,
          difficultyLabel: diffLabel,
          language: 'ms',
          isDiagnostic: Boolean(q.is_diagnostic),
          sourceReference: `mathematics/grade-5/${path.basename(item.file)}`
        });
      }
    }
  }

  // 4. Extract distinct syllabus topics & learning objectives
  console.log('\n🎯 Step 4: Generating syllabus topics catalog...');
  const topicMap = new Map<string, { subject: string; topic: string; subtopics: Set<string> }>();

  for (const q of allStandardQuestions) {
    const key = `${q.subject}:::${q.topic}`;
    if (!topicMap.has(key)) {
      topicMap.set(key, { subject: q.subject, topic: q.topic, subtopics: new Set() });
    }
    topicMap.get(key)!.subtopics.add(q.subtopic);
  }

  let topicCounter = 1;
  for (const [_, info] of topicMap.entries()) {
    for (const sub of Array.from(info.subtopics)) {
      allStandardTopics.push({
        id: `curr-${info.subject.substring(0, 4).toLowerCase()}-g5-${topicCounter++}`,
        grade: 5,
        subject: info.subject,
        topic: info.topic,
        subtopic: sub,
        difficultyMin: 'easy',
        difficultyMax: 'hard',
        learningObjective: getLearningObjective(info.subject, info.topic, sub)
      });
    }
  }

  // 5. Save local data stores
  console.log('\n💾 Step 5: Persisting structured local datasets...');
  const datasetPath = path.resolve(process.cwd(), 'data', 'curriculum_dataset.json');
  fs.writeFileSync(datasetPath, JSON.stringify(allStandardQuestions, null, 2), 'utf-8');
  console.log(`  Saved ${allStandardQuestions.length} questions to data/curriculum_dataset.json`);

  // Merge with existing topics
  const topicsPath = path.resolve(process.cwd(), 'data', 'curriculum_topics.json');
  let existingTopics: StandardTopic[] = [];
  if (fs.existsSync(topicsPath)) {
    try {
      existingTopics = JSON.parse(fs.readFileSync(topicsPath, 'utf-8'));
    } catch {}
  }
  // Remove existing Grade 5 topics for Math and BM to refresh cleanly
  const keptTopics = existingTopics.filter(t => !(t.grade === 5 && (t.subject === 'Mathematics' || t.subject === 'Bahasa Melayu')));
  const mergedTopics = [...keptTopics, ...allStandardTopics];
  fs.writeFileSync(topicsPath, JSON.stringify(mergedTopics, null, 2), 'utf-8');
  console.log(`  Updated data/curriculum_topics.json (Total topics: ${mergedTopics.length})`);

  // 6. Sync to Supabase Database (topics, subtopics, questions)
  console.log('\n⚡ Step 6: Syncing topics and questions to Supabase Database...');

  // Map to Supabase topic and subtopic records
  const dbTopicCache = new Map<string, string>(); // name -> id
  const dbSubtopicCache = new Map<string, string>(); // name -> id

  // Fetch existing topics in DB
  const { data: dbTopics } = await supabase.from('topics').select('id, subject_id, name');
  if (dbTopics) {
    for (const t of dbTopics) {
      dbTopicCache.set(`${t.subject_id}:::${t.name.toLowerCase()}`, t.id);
    }
  }

  const { data: dbSubtopics } = await supabase.from('subtopics').select('id, topic_id, name');
  if (dbSubtopics) {
    for (const s of dbSubtopics) {
      dbSubtopicCache.set(`${s.topic_id}:::${s.name.toLowerCase()}`, s.id);
    }
  }

  // Insert missing topics and subtopics
  for (const st of allStandardTopics) {
    const subjectId = SUBJECT_IDS[st.subject];
    if (!subjectId) continue;

    const topicKey = `${subjectId}:::${st.topic.toLowerCase()}`;
    let topicId = dbTopicCache.get(topicKey);

    if (!topicId) {
      const { data: insertedTopic, error } = await supabase.from('topics').insert({
        subject_id: subjectId,
        name: st.topic,
        display_order: 1
      }).select().single();

      if (insertedTopic) {
        topicId = insertedTopic.id;
        dbTopicCache.set(topicKey, topicId!);
      }
    }

    if (topicId) {
      const subKey = `${topicId}:::${st.subtopic.toLowerCase()}`;
      let subId = dbSubtopicCache.get(subKey);
      if (!subId) {
        const { data: insertedSub } = await supabase.from('subtopics').insert({
          topic_id: topicId,
          name: st.subtopic,
          display_order: 1
        }).select().single();

        if (insertedSub) {
          dbSubtopicCache.set(subKey, insertedSub.id);
        }
      }
    }
  }

  // Batch insert questions into Supabase (up to 100 at a time)
  console.log(`  Syncing ${allStandardQuestions.length} questions into Supabase questions table...`);
  const batchSize = 50;
  let insertedCount = 0;

  for (let i = 0; i < allStandardQuestions.length; i += batchSize) {
    const batch = allStandardQuestions.slice(i, i + batchSize);
    const rows = batch.map(q => {
      const subjectId = SUBJECT_IDS[q.subject];
      const topicId = subjectId ? dbTopicCache.get(`${subjectId}:::${q.topic.toLowerCase()}`) : null;
      const subtopicId = topicId ? dbSubtopicCache.get(`${topicId}:::${q.subtopic.toLowerCase()}`) : null;

      return {
        subject_id: subjectId,
        topic_id: topicId,
        subtopic_id: subtopicId,
        difficulty_level: q.difficulty,
        question_text: q.questionText,
        question_type: q.questionType,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        language: q.language,
        is_diagnostic: q.isDiagnostic,
        grade_level: 5,
        estimated_time_seconds: 30,
        is_active: true
      };
    });

    const { error: batchErr } = await supabase.from('questions').insert(rows);
    if (batchErr) {
      console.warn(`  Batch ${i}-${i + batch.length} insert warning:`, batchErr.message);
    } else {
      insertedCount += rows.length;
    }
  }

  console.log(`  ✅ Successfully synced ${insertedCount}/${allStandardQuestions.length} questions to Supabase Database!`);
  console.log('\n🎉 Curriculum Ingestion Complete!');
  return {
    questionsCount: allStandardQuestions.length,
    topicsCount: allStandardTopics.length,
    insertedToSupabase: insertedCount
  };
}

// Run if called directly
if (process.argv[1] && process.argv[1].includes('importCurriculumDataset')) {
  importAllCurriculum()
    .then(res => {
      console.log('Finished with result:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal import error:', err);
      process.exit(1);
    });
}
