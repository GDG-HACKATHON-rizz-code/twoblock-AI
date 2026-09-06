import fs from 'fs';
import path from 'path';

export interface PracticeQuestion {
  id: string;
  subject: string;
  topic: string;
  subtopic?: string;
  questionType: 'numeric' | 'multiple_choice';
  level: number;
  gradeLevel?: number;
  equation: string;
  question: string;
  options: string[];
  answer: string | number;
  correctAnswer: string;
  hint?: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source?: 'gemini' | 'dataset' | 'procedural';
  curriculumReference?: string;
}

export interface CurriculumTopic {
  id: string;
  grade: number;
  subject: string;
  topic: string;
  subtopic: string;
  difficultyMin: string;
  difficultyMax: string;
  learningObjective: string;
}

export interface DatasetQuestion {
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

export interface GenerateSyllabusParams {
  studentId?: string;
  subject: string;
  studentGrade?: number;
  topicId?: string;
  topicName?: string;
  subtopicName?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  recentAccuracy?: number;
  previousAnswers?: Array<{ isCorrect: boolean; responseTimeSeconds?: number }>;
  excludeQuestionTexts?: string[];
}

export class GeminiPracticeService {
  private static geminiApiKey = process.env.GEMINI_API_KEY || '';
  private static curriculumTopics: CurriculumTopic[] = [];
  private static curriculumDataset: DatasetQuestion[] = [];

  static {
    try {
      const topPath = path.resolve(process.cwd(), 'data', 'curriculum_topics.json');
      if (fs.existsSync(topPath)) {
        this.curriculumTopics = JSON.parse(fs.readFileSync(topPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('Could not load curriculum_topics.json:', e);
    }

    try {
      const dataPath = path.resolve(process.cwd(), 'data', 'curriculum_dataset.json');
      if (fs.existsSync(dataPath)) {
        this.curriculumDataset = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      }
    } catch (e) {
      console.warn('Could not load curriculum_dataset.json:', e);
    }
  }

  public static normalizeSubject(raw: string = ''): string {
    const s = raw.toLowerCase().trim();
    if (s.includes('melayu') || s === 'bm') return 'Bahasa Melayu';
    if (s.includes('science') || s.includes('sains')) return 'Science';
    if (s.includes('english') || s === 'bi') return 'English';
    return 'Mathematics';
  }

  public static getCurriculumTopics(grade?: number, subject?: string): CurriculumTopic[] {
    const normSubj = subject ? this.normalizeSubject(subject) : undefined;
    return this.curriculumTopics.filter(t => {
      if (grade && t.grade !== grade) return false;
      if (normSubj && t.subject.toLowerCase() !== normSubj.toLowerCase()) return false;
      return true;
    });
  }

  public static getCurriculumQuestions(subject?: string, topic?: string, grade?: number): DatasetQuestion[] {
    const normSubj = subject ? this.normalizeSubject(subject) : undefined;
    return this.curriculumDataset.filter(q => {
      if (grade && q.gradeLevel !== grade) return false;
      if (normSubj && q.subject.toLowerCase() !== normSubj.toLowerCase()) return false;
      if (topic && q.topic.toLowerCase() !== topic.toLowerCase()) return false;
      return true;
    });
  }

  /**
   * Generates adaptive questions limited strictly to approved syllabus topics.
   */
  public static async generateAdaptiveQuestion(
    topic: string = 'Addition',
    grade: number = 2,
    level: number = 1,
    subject: string = 'Mathematics',
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    previousAnswers?: Array<{ isCorrect: boolean; responseTimeSeconds?: number }>
  ): Promise<PracticeQuestion> {
    return this.generateSyllabusQuestion({
      subject,
      studentGrade: grade,
      topicName: topic,
      difficulty,
      previousAnswers
    });
  }

  /**
   * Generates questions strictly bounded to syllabus dataset for Bahasa Melayu, Mathematics, Science, and English.
   */
  public static async generateSyllabusQuestion(params: GenerateSyllabusParams): Promise<PracticeQuestion> {
    const studentGrade = params.studentGrade || 5;
    const clampedGrade = Math.min(6, Math.max(1, studentGrade));
    const subject = this.normalizeSubject(params.subject);

    // Calculate adaptive difficulty
    let difficulty: 'easy' | 'medium' | 'hard' = params.difficulty || 'medium';
    if (params.previousAnswers && params.previousAnswers.length > 0) {
      const last = params.previousAnswers[params.previousAnswers.length - 1];
      if (last.isCorrect) {
        if ((last.responseTimeSeconds ?? 15) <= 12) {
          difficulty = difficulty === 'easy' ? 'medium' : 'hard';
        }
      } else {
        difficulty = difficulty === 'hard' ? 'medium' : 'easy';
      }
    }

    // Resolve approved syllabus topic
    let topicName = (params.topicName || '').trim();
    let subtopicName = (params.subtopicName || '').trim();

    const isArithmeticMath = subject === 'Mathematics' &&
      ['addition', 'subtraction', 'multiplication', 'division', 'tambah', 'tolak', 'darab', 'bahagi'].some(op => topicName.toLowerCase().includes(op));

    const subjectTopics = this.getCurriculumTopics(clampedGrade, subject);
    let matchedTopic = subjectTopics.find(
      t => (topicName && t.topic.toLowerCase() === topicName.toLowerCase()) ||
           (subtopicName && t.subtopic.toLowerCase() === subtopicName.toLowerCase())
    );

    if (!matchedTopic && !isArithmeticMath && subjectTopics.length > 0) {
      matchedTopic = subjectTopics[0];
    }

    const defaultTopicMap: Record<string, string> = {
      'Bahasa Melayu': 'Kata Adjektif',
      'Mathematics': 'addition',
      'Science': 'Haiwan dan Ciri Khas',
      'English': 'Grammar'
    };

    const finalTopic = (isArithmeticMath && topicName) ? topicName : (matchedTopic?.topic || topicName || defaultTopicMap[subject] || 'addition');
    const finalSubtopic = matchedTopic?.subtopic || subtopicName || finalTopic;
    const learningObjective = matchedTopic?.learningObjective || `Master Grade ${clampedGrade} ${subject} concepts for ${finalTopic}.`;

    const excludes = params.excludeQuestionTexts || [];

    // Determine questionType
    const isMathNumeric = subject === 'Mathematics' &&
      ['addition', 'subtraction', 'multiplication', 'division', 'tambah', 'tolak', 'darab', 'bahagi'].some(op => finalTopic.toLowerCase().includes(op));
    const targetQuestionType: 'numeric' | 'multiple_choice' = isMathNumeric ? 'numeric' : 'multiple_choice';

    // 1. If Gemini API is configured, generate strictly syllabus-bounded question
    if (this.geminiApiKey) {
      try {
        const sampleExamples = this.curriculumDataset
          .filter(q => q.subject.toLowerCase() === subject.toLowerCase())
          .slice(0, 3)
          .map(q => ({ question: q.questionText, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation }));

        const langInstruction = (subject === 'Bahasa Melayu' || subject === 'Science')
          ? 'Use formal Standard Malay (Bahasa Melayu Baku) appropriate for Malaysian Primary Grade 5 students.'
          : 'Use clear, friendly English appropriate for Grade 5 students.';

        const typeInstruction = targetQuestionType === 'numeric'
          ? 'Provide a direct arithmetic question (e.g. 20 + 11 = ?). Set questionType to "numeric", options to [], and correctAnswer to the numeric string (e.g. "31").'
          : 'Provide a multiple-choice question. Set questionType to "multiple_choice", options to an array of EXACTLY 4 distinct strings, and correctAnswer to the matching option string.';

        const prompt = `You are an educational AI tutor for Malaysian primary school students.
Curriculum Scope:
- Subject: ${subject}
- Grade Level: Grade ${clampedGrade}
- Approved Topic: ${finalTopic}
- Approved Subtopic: ${finalSubtopic}
- Learning Objective: ${learningObjective}
- Target Difficulty: ${difficulty}
- Question Type: ${targetQuestionType}

${sampleExamples.length > 0 ? `Approved Syllabus Examples:\n${JSON.stringify(sampleExamples, null, 2)}` : ''}

${langInstruction}
${typeInstruction}

CRITICAL RULES:
1. Return ONLY valid, parseable JSON with NO markdown fences.
2. The returned "subject" MUST strictly be "${subject}". Do NOT return Mathematics if ${subject} is requested.
3. The returned "topic" MUST strictly relate to "${finalTopic}".
4. ${targetQuestionType === 'multiple_choice' ? 'The options array must contain EXACTLY 4 distinct strings, and correctAnswer MUST be one of them.' : 'options array must be empty [].'}
5. Explanation must be concise, helpful, and child-safe.
6. The question MUST NOT duplicate: ${JSON.stringify(excludes.slice(-5))}

JSON format:
{
  "subject": "${subject}",
  "topic": "${finalTopic}",
  "questionType": "${targetQuestionType}",
  "question": "question text",
  "options": ${targetQuestionType === 'multiple_choice' ? '["Option A", "Option B", "Option C", "Option D"]' : '[]'},
  "correctAnswer": "matching answer",
  "explanation": "concise solution explanation"
}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3,
                maxOutputTokens: 500
              }
            })
          }
        );

        if (response.ok) {
          const resJson: any = await response.json();
          const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            // STRICT VALIDATION:
            // 1. selected subject === generated question subject
            const generatedSubj = this.normalizeSubject(parsed.subject);
            const isSubjMatch = generatedSubj.toLowerCase() === subject.toLowerCase();

            // 2. selected topic === generated question topic (or matches requested finalTopic)
            const generatedTopic = String(parsed.topic || '').trim().toLowerCase();
            const requestedTopic = finalTopic.trim().toLowerCase();
            const isTopicMatch = !requestedTopic ||
              generatedTopic.includes(requestedTopic) ||
              requestedTopic.includes(generatedTopic) ||
              generatedTopic.length > 0;

            // 3. selected grade is within allowed grade range (Grade 1 - 6)
            const isGradeValid = clampedGrade >= 1 && clampedGrade <= 6;

            const isValidMcq = targetQuestionType === 'multiple_choice' &&
              Array.isArray(parsed.options) &&
              parsed.options.length === 4 &&
              parsed.correctAnswer &&
              parsed.options.map(String).includes(String(parsed.correctAnswer));

            const isValidNumeric = targetQuestionType === 'numeric' &&
              subject === 'Mathematics' &&
              Boolean(parsed.question) &&
              Boolean(parsed.correctAnswer);

            if (isSubjMatch && isTopicMatch && isGradeValid && parsed.question && (isValidMcq || isValidNumeric) && !excludes.includes(parsed.question.trim())) {
              const qText = parsed.question.trim();
              const qOpts = Array.isArray(parsed.options) && parsed.options.length === 4 ? parsed.options : [];
              const qAns = String(parsed.correctAnswer).trim();

              return {
                id: `gemini-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                subject,
                topic: parsed.topic || finalTopic,
                subtopic: finalSubtopic,
                questionType: targetQuestionType,
                level: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
                gradeLevel: clampedGrade,
                equation: qText,
                question: qText,
                options: qOpts,
                answer: qAns,
                correctAnswer: qAns,
                hint: targetQuestionType === 'numeric' ? 'Kira dengan teliti.' : 'Perhatikan semua pilihan jawapan.',
                explanation: parsed.explanation || `Jawapan yang betul ialah ${qAns}.`,
                difficulty,
                source: 'gemini',
                curriculumReference: `${finalTopic}_Grade_${clampedGrade}`
              };
            } else {
              console.warn(`[Practice Validation] Gemini returned mismatched or invalid question for subject "${subject}" (got "${parsed.subject}"), rejecting and falling back to approved syllabus.`);
            }
          }
        }
      } catch (err) {
        console.warn('Gemini syllabus generation error, falling back to approved dataset:', err);
      }
    }

    // 2. Fallback to approved curriculum dataset matching the requested SUBJECT
    const diffNumber = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    let candidates = this.curriculumDataset.filter(q => {
      if (q.subject.toLowerCase() !== subject.toLowerCase()) return false;
      if (finalTopic && (q.topic.toLowerCase() === finalTopic.toLowerCase() || q.subtopic.toLowerCase().includes(finalTopic.toLowerCase()))) {
        return true;
      }
      return false;
    });

    if (candidates.length === 0) {
      candidates = this.curriculumDataset.filter(q => q.subject.toLowerCase() === subject.toLowerCase());
    }

    let filtered = candidates.filter(q => q.difficulty === diffNumber && !excludes.includes(q.questionText));
    if (filtered.length === 0) {
      filtered = candidates.filter(q => !excludes.includes(q.questionText));
    }
    if (filtered.length === 0) {
      filtered = candidates;
    }

    if (filtered.length > 0 && targetQuestionType === 'multiple_choice') {
      const selected = filtered[Math.floor(Math.random() * filtered.length)];
      return {
        id: selected.id,
        subject: selected.subject,
        topic: selected.topic,
        subtopic: selected.subtopic,
        questionType: 'multiple_choice',
        level: selected.difficulty,
        gradeLevel: selected.gradeLevel,
        equation: selected.questionText,
        question: selected.questionText,
        options: selected.options,
        answer: selected.correctAnswer,
        correctAnswer: selected.correctAnswer,
        hint: `Fokus pada konsep asas ${selected.topic}.`,
        explanation: selected.explanation,
        difficulty,
        source: 'dataset',
        curriculumReference: selected.sourceReference
      };
    }

    // 3. Fallback to Subject-Specific Procedural Generator
    return this.generateProceduralQuestion(finalTopic, clampedGrade, diffNumber, subject, difficulty);
  }

  private static generateProceduralQuestion(
    topic: string,
    grade: number,
    level: number,
    subject: string,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): PracticeQuestion {
    const qId = `pq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const lowerTopic = topic.toLowerCase();
    const normSubj = this.normalizeSubject(subject);

    // ==========================================
    // SCIENCE PROCEDURAL QUESTIONS
    // ==========================================
    if (normSubj === 'Science') {
      if (lowerTopic.includes('tumbuhan') || lowerTopic.includes('plant')) {
        return {
          id: qId,
          subject: 'Science',
          topic: 'Tumbuhan dan Penyesuaian',
          subtopic: 'Penyesuaian',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Bahagian tumbuhan yang manakah berfungsi menyerap air daripada tanah?',
          question: 'Bahagian tumbuhan yang manakah berfungsi menyerap air daripada tanah?',
          options: ['Akar', 'Daun', 'Bunga', 'Buah'],
          answer: 'Akar',
          correctAnswer: 'Akar',
          explanation: 'Akar tumbuhan menyerap air dan garam mineral daripada tanah untuk dihantar ke seluruh bahagian tumbuhan.',
          difficulty,
          source: 'procedural'
        };
      }

      if (lowerTopic.includes('suria') || lowerTopic.includes('bumi') || lowerTopic.includes('bulan') || lowerTopic.includes('solar')) {
        return {
          id: qId,
          subject: 'Science',
          topic: 'Sistem Suria',
          subtopic: 'Peredaran Bumi',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Peredaran Bumi mengelilingi Matahari yang lengkap mengambil masa selama ____.',
          question: 'Peredaran Bumi mengelilingi Matahari yang lengkap mengambil masa selama ____.',
          options: ['1 tahun (365 ¼ hari)', '24 jam', '1 bulan', '12 jam'],
          answer: '1 tahun (365 ¼ hari)',
          correctAnswer: '1 tahun (365 ¼ hari)',
          explanation: 'Bumi mengambil masa 365 ¼ hari (1 tahun) untuk membuat satu peredaran lengkap mengelilingi Matahari.',
          difficulty,
          source: 'procedural'
        };
      }

      if (lowerTopic.includes('tenaga') || lowerTopic.includes('bahan') || lowerTopic.includes('energy')) {
        return {
          id: qId,
          subject: 'Science',
          topic: 'Bentuk Tenaga',
          subtopic: 'Sumber Tenaga',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Antara sumber tenaga berikut, yang manakah sumber tenaga boleh dibaharui?',
          question: 'Antara sumber tenaga berikut, yang manakah sumber tenaga boleh dibaharui?',
          options: ['Tenaga solar', 'Arang batu', 'Petroleum', 'Gas asli'],
          answer: 'Tenaga solar',
          correctAnswer: 'Tenaga solar',
          explanation: 'Tenaga solar daripada matahari ialah sumber tenaga boleh dibaharui yang tidak akan habis.',
          difficulty,
          source: 'procedural'
        };
      }

      // Default Science: Animals
      return {
        id: qId,
        subject: 'Science',
        topic: 'Haiwan dan Ciri Khas',
        subtopic: 'Kemandirian Spesies',
        questionType: 'multiple_choice',
        level,
        gradeLevel: grade,
        equation: 'Apakah ciri khas yang membantu ikan bernafas di dalam air?',
        question: 'Apakah ciri khas yang membantu ikan bernafas di dalam air?',
        options: ['Insang', 'Paruh', 'Bulu', 'Sayap'],
        answer: 'Insang',
        correctAnswer: 'Insang',
        explanation: 'Ikan bernafas menggunakan insang yang menyerap oksigen terlarut dalam air.',
        difficulty,
        source: 'procedural'
      };
    }

    // ==========================================
    // ENGLISH PROCEDURAL QUESTIONS
    // ==========================================
    if (normSubj === 'English') {
      if (lowerTopic.includes('reading') || lowerTopic.includes('comprehension')) {
        return {
          id: qId,
          subject: 'English',
          topic: 'Reading',
          subtopic: 'Main Idea',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Choose the sentence that best describes a daily healthy habit.',
          question: 'Choose the sentence that best describes a daily healthy habit.',
          options: ['Amir drinks plenty of water every day.', 'Amir sleeps at 2 AM every night.', 'Amir skips breakfast always.', 'Amir dislikes eating vegetables.'],
          answer: 'Amir drinks plenty of water every day.',
          correctAnswer: 'Amir drinks plenty of water every day.',
          explanation: 'Drinking water daily is a positive and healthy habit.',
          difficulty,
          source: 'procedural'
        };
      }

      if (lowerTopic.includes('writing') || lowerTopic.includes('sentence')) {
        return {
          id: qId,
          subject: 'English',
          topic: 'Writing',
          subtopic: 'Sentence Construction',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Which sentence uses capital letters and punctuation correctly?',
          question: 'Which sentence uses capital letters and punctuation correctly?',
          options: ['Where are you going?', 'where are you going', 'Where are you going.', 'where are you going!'],
          answer: 'Where are you going?',
          correctAnswer: 'Where are you going?',
          explanation: 'A question starts with a capital letter and ends with a question mark.',
          difficulty,
          source: 'procedural'
        };
      }

      // Default English: Grammar
      return {
        id: qId,
        subject: 'English',
        topic: 'Grammar',
        subtopic: 'Subject-Verb Agreement',
        questionType: 'multiple_choice',
        level,
        gradeLevel: grade,
        equation: 'Choose the correct sentence.',
        question: 'Choose the correct sentence.',
        options: ['She is happy.', 'She are happy.', 'She am happy.', 'She be happy.'],
        answer: 'She is happy.',
        correctAnswer: 'She is happy.',
        explanation: 'Singular subject "She" takes the singular verb "is".',
        difficulty,
        source: 'procedural'
      };
    }

    // ==========================================
    // BAHASA MELAYU PROCEDURAL QUESTIONS
    // ==========================================
    if (normSubj === 'Bahasa Melayu') {
      if (lowerTopic.includes('adjektif')) {
        return {
          id: qId,
          subject: 'Bahasa Melayu',
          topic: 'Kata Adjektif',
          subtopic: 'Sifat',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Pilih kata adjektif yang sesuai: Amir seorang murid yang ____.',
          question: 'Pilih kata adjektif yang sesuai: Amir seorang murid yang ____.',
          options: ['rajin', 'buku', 'berlari', 'sekolah'],
          answer: 'rajin',
          correctAnswer: 'rajin',
          explanation: "'Rajin' menerangkan sifat seseorang, maka ia ialah kata adjektif.",
          difficulty,
          source: 'procedural'
        };
      }

      if (lowerTopic.includes('nama')) {
        return {
          id: qId,
          subject: 'Bahasa Melayu',
          topic: 'Kata Nama',
          subtopic: 'Kata Nama Am',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Pilih perkataan yang tergolong dalam kata nama am.',
          question: 'Pilih perkataan yang tergolong dalam kata nama am.',
          options: ['kereta', 'Malaysia', 'Proton', 'Aiman'],
          answer: 'kereta',
          correctAnswer: 'kereta',
          explanation: "'Kereta' merujuk kepada kenderaan umum dan dieja dengan huruf kecil.",
          difficulty,
          source: 'procedural'
        };
      }

      if (lowerTopic.includes('kerja')) {
        return {
          id: qId,
          subject: 'Bahasa Melayu',
          topic: 'Kata Kerja',
          subtopic: 'Kata Kerja Transitif',
          questionType: 'multiple_choice',
          level,
          gradeLevel: grade,
          equation: 'Pilih kata kerja yang sesuai: Kakak sedang ____ kek di dapur.',
          question: 'Pilih kata kerja yang sesuai: Kakak sedang ____ kek di dapur.',
          options: ['membakar', 'cantik', 'pinggan', 'lazat'],
          answer: 'membakar',
          correctAnswer: 'membakar',
          explanation: "'Membakar' ialah kata kerja yang menunjukkan perbuatan memasak kek.",
          difficulty,
          source: 'procedural'
        };
      }

      // Default BM: Tatabahasa
      return {
        id: qId,
        subject: 'Bahasa Melayu',
        topic: 'Tatabahasa',
        subtopic: 'Ayat Majmuk',
        questionType: 'multiple_choice',
        level,
        gradeLevel: grade,
        equation: 'Pilih ayat majmuk yang betul.',
        question: 'Pilih ayat majmuk yang betul.',
        options: ['Ali makan dan minum bersama adiknya.', 'Siti tidur.', 'Buku itu baru.', 'Adik kecil.'],
        answer: 'Ali makan dan minum bersama adiknya.',
        correctAnswer: 'Ali makan dan minum bersama adiknya.',
        explanation: 'Ayat majmuk mengandungi kata hubung "dan" yang menggabungkan dua klausa.',
        difficulty,
        source: 'procedural'
      };
    }

    // ==========================================
    // MATHEMATICS PROCEDURAL QUESTIONS
    // ==========================================
    if (lowerTopic.includes('pecahan') || lowerTopic.includes('fraction')) {
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'Pecahan',
        subtopic: 'Tambah pecahan',
        questionType: 'multiple_choice',
        level,
        gradeLevel: grade,
        equation: 'Berapakah 1/4 + 2/4?',
        question: 'Berapakah 1/4 + 2/4?',
        options: ['3/4', '3/8', '2/4', '1/2'],
        answer: '3/4',
        correctAnswer: '3/4',
        explanation: 'Tambah pengangka sahaja apabila penyebutnya sama: 1/4 + 2/4 = 3/4.',
        difficulty,
        source: 'procedural'
      };
    }

    if (lowerTopic.includes('nombor bulat') || lowerTopic.includes('nilai tempat')) {
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'Nombor Bulat',
        subtopic: 'Nilai Tempat',
        questionType: 'multiple_choice',
        level,
        gradeLevel: grade,
        equation: 'Apakah nilai tempat bagi digit 5 dalam nombor 35,420?',
        question: 'Apakah nilai tempat bagi digit 5 dalam nombor 35,420?',
        options: ['Ribu', 'Ratus', 'Puluh', 'Sa'],
        answer: 'Ribu',
        correctAnswer: 'Ribu',
        explanation: 'Digit 5 berada di tempat keempat dari kanan, iaitu nilai tempat Ribu.',
        difficulty,
        source: 'procedural'
      };
    }

    if (lowerTopic.includes('subtraction')) {
      const a = 12 + Math.floor(Math.random() * (difficulty === 'easy' ? 10 : 30));
      const b = 2 + Math.floor(Math.random() * 10);
      const ans = a - b;
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'subtraction',
        subtopic: 'Penolakan',
        questionType: 'numeric',
        level,
        gradeLevel: grade,
        equation: `${a} - ${b} = ?`,
        question: `${a} - ${b} = ?`,
        options: [],
        answer: String(ans),
        correctAnswer: String(ans),
        explanation: `${a} minus ${b} equals ${ans}.`,
        difficulty,
        source: 'procedural'
      };
    }

    if (lowerTopic.includes('multiplication')) {
      const a = 2 + Math.floor(Math.random() * (difficulty === 'easy' ? 5 : 9));
      const b = 2 + Math.floor(Math.random() * (difficulty === 'easy' ? 5 : 9));
      const ans = a * b;
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'multiplication',
        subtopic: 'Pendaraban',
        questionType: 'numeric',
        level,
        gradeLevel: grade,
        equation: `${a} × ${b} = ?`,
        question: `${a} × ${b} = ?`,
        options: [],
        answer: String(ans),
        correctAnswer: String(ans),
        explanation: `${a} times ${b} equals ${ans}.`,
        difficulty,
        source: 'procedural'
      };
    }

    if (lowerTopic.includes('division')) {
      const b = 2 + Math.floor(Math.random() * 5);
      const ans = 2 + Math.floor(Math.random() * 6);
      const a = b * ans;
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'division',
        subtopic: 'Pembahagian',
        questionType: 'numeric',
        level,
        gradeLevel: grade,
        equation: `${a} ÷ ${b} = ?`,
        question: `${a} ÷ ${b} = ?`,
        options: [],
        answer: String(ans),
        correctAnswer: String(ans),
        explanation: `${a} divided by ${b} equals ${ans}.`,
        difficulty,
        source: 'procedural'
      };
    }

    // Default Numeric Math (Addition)
    const max = difficulty === 'easy' ? 15 : difficulty === 'medium' ? 35 : 75;
    const a = 5 + Math.floor(Math.random() * max);
    const b = 3 + Math.floor(Math.random() * max);
    const ans = a + b;
    return {
      id: qId,
      subject: 'Mathematics',
      topic: 'addition',
      subtopic: 'Penambahan',
      questionType: 'numeric',
      level,
      gradeLevel: grade,
      equation: `${a} + ${b} = ?`,
      question: `${a} + ${b} = ?`,
      options: [],
      answer: String(ans),
      correctAnswer: String(ans),
      explanation: `${a} plus ${b} equals ${ans}.`,
      difficulty,
      source: 'procedural'
    };
  }
}
