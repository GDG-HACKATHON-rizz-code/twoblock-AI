import fs from 'fs';
import path from 'path';

export interface PracticeQuestion {
  id: string;
  subject: string;
  topic: string;
  subtopic?: string;
  level: number;
  gradeLevel?: number;
  equation: string;
  question?: string;
  options: string[];
  answer: string | number;
  correctAnswer?: string;
  hint?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
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

  public static getCurriculumTopics(grade?: number, subject?: string): CurriculumTopic[] {
    return this.curriculumTopics.filter(t => {
      if (grade && t.grade !== grade) return false;
      if (subject && t.subject.toLowerCase() !== subject.toLowerCase()) return false;
      return true;
    });
  }

  public static getCurriculumQuestions(subject?: string, topic?: string, grade?: number): DatasetQuestion[] {
    return this.curriculumDataset.filter(q => {
      if (grade && q.gradeLevel !== grade) return false;
      if (subject && q.subject.toLowerCase() !== subject.toLowerCase()) return false;
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
    const clampedGrade = Math.min(6, Math.max(1, grade));
    const topicKey = topic.trim();

    // Verify syllabus limit from curriculum_topics
    const validTopic = this.curriculumTopics.find(
      t => t.grade === clampedGrade &&
           t.subject.toLowerCase() === subject.toLowerCase() &&
           (t.topic.toLowerCase() === topicKey.toLowerCase() || t.subtopic.toLowerCase().includes(topicKey.toLowerCase()))
    ) || {
      topic: topicKey,
      subtopic: topicKey,
      learningObjective: `Master ${topicKey} concepts appropriate for Grade ${clampedGrade}.`
    };

    // 1. Try Gemini API if API key is provided
    if (this.geminiApiKey) {
      try {
        const prompt = `You are an educational AI tutor for Malaysian primary school students.
Generate exactly 1 multiple-choice question for:
- Grade Level: Grade ${clampedGrade}
- Subject: ${subject}
- Approved Syllabus Topic: ${validTopic.topic}
- Learning Objective: ${validTopic.learningObjective}
- Target Difficulty: ${difficulty}

CRITICAL RULES:
1. Return ONLY valid, parseable JSON with NO markdown code fences.
2. The options array must contain EXACTLY 4 distinct strings.
3. The correctAnswer MUST match exactly one of the strings in the options array.
4. For Bahasa Melayu use Standard Malay (Bahasa Melayu Baku). For English, Math, and Science use clear, child-friendly English.
5. Strictly child-safe and concise.

JSON format:
{
  "question": "question text or math equation",
  "options": ["opt1", "opt2", "opt3", "opt4"],
  "correctAnswer": "exact matching option",
  "hint": "short 1-sentence hint",
  "explanation": "concise 1-2 sentence solution explanation"
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

            if (
              parsed.question &&
              Array.isArray(parsed.options) &&
              parsed.options.length === 4 &&
              parsed.correctAnswer &&
              parsed.options.includes(parsed.correctAnswer)
            ) {
              return {
                id: `gemini-q-${Date.now()}`,
                subject,
                topic: validTopic.topic,
                subtopic: validTopic.subtopic,
                level,
                gradeLevel: clampedGrade,
                equation: parsed.question,
                question: parsed.question,
                options: parsed.options,
                answer: parsed.correctAnswer,
                correctAnswer: parsed.correctAnswer,
                hint: parsed.hint || 'Take your time and double-check your steps.',
                explanation: parsed.explanation || `The correct answer is ${parsed.correctAnswer}.`,
                difficulty,
                source: 'gemini',
                curriculumReference: `${validTopic.topic}_Grade_${clampedGrade}`
              };
            }
          }
        }
      } catch (err) {
        console.warn('Gemini API question generation fallback to procedural/dataset generator:', err);
      }
    }

    // 2. Check if approved question exists in curriculumDataset (for exact topic match)
    if (!['addition', 'subtraction', 'multiplication', 'division'].includes(topicKey.toLowerCase())) {
      const datasetMatch = this.findDatasetFallback(subject, topicKey, clampedGrade, difficulty);
      if (datasetMatch) {
        return datasetMatch;
      }
    }

    // 3. High-quality procedural curriculum generator (reliable fallback)
    return this.generateProceduralQuestion(topicKey, clampedGrade, level, subject, difficulty);

  }

  /**
   * Generates questions strictly bounded to syllabus dataset for Bahasa Melayu, Mathematics, Science, and English.
   */
  public static async generateSyllabusQuestion(params: GenerateSyllabusParams): Promise<PracticeQuestion> {
    const studentGrade = params.studentGrade || 5;
    const clampedGrade = Math.min(6, Math.max(1, studentGrade));

    // Normalize subject
    const rawSubj = (params.subject || 'Mathematics').trim();
    let subject = 'Mathematics';
    if (rawSubj.toLowerCase().includes('melayu') || rawSubj.toLowerCase() === 'bm') {
      subject = 'Bahasa Melayu';
    } else if (rawSubj.toLowerCase().includes('science') || rawSubj.toLowerCase().includes('sains')) {
      subject = 'Science';
    } else if (rawSubj.toLowerCase().includes('english')) {
      subject = 'English';
    }

    // Calculate adaptive difficulty
    let difficulty: 'easy' | 'medium' | 'hard' = params.difficulty || 'medium';
    if (params.previousAnswers && params.previousAnswers.length > 0) {
      const last = params.previousAnswers[params.previousAnswers.length - 1];
      if (last.isCorrect) {
        if ((last.responseTimeSeconds ?? 15) <= 12) {
          // Fast correct -> increase difficulty
          difficulty = difficulty === 'easy' ? 'medium' : 'hard';
        }
      } else {
        // Incorrect -> lower difficulty
        difficulty = difficulty === 'hard' ? 'medium' : 'easy';
      }
    }

    // Resolve approved syllabus topic
    let topicName = (params.topicName || '').trim();
    let subtopicName = (params.subtopicName || '').trim();

    const subjectTopics = this.getCurriculumTopics(clampedGrade, subject);
    let matchedTopic = subjectTopics.find(
      t => (topicName && t.topic.toLowerCase() === topicName.toLowerCase()) ||
           (subtopicName && t.subtopic.toLowerCase() === subtopicName.toLowerCase())
    );

    if (!matchedTopic && subjectTopics.length > 0) {
      matchedTopic = subjectTopics[0];
    }

    const finalTopic = matchedTopic?.topic || topicName || (subject === 'Bahasa Melayu' ? 'Kata Adjektif' : 'Pecahan');
    const finalSubtopic = matchedTopic?.subtopic || subtopicName || finalTopic;
    const learningObjective = matchedTopic?.learningObjective || `Master Grade ${clampedGrade} ${subject} concepts for ${finalTopic}.`;

    const excludes = params.excludeQuestionTexts || [];

    // 1. If Gemini API is configured, generate strictly syllabus-bounded question
    if (this.geminiApiKey) {
      try {
        // Pull reference examples from curriculumDataset for high fidelity
        const sampleExamples = this.curriculumDataset
          .filter(q => q.subject === subject && q.topic.toLowerCase() === finalTopic.toLowerCase())
          .slice(0, 3)
          .map(q => ({ question: q.questionText, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation }));

        const langInstruction = subject === 'Bahasa Melayu'
          ? 'Use formal Standard Malay (Bahasa Melayu Baku) appropriate for Malaysian Primary Grade 5 students.'
          : 'Use clear, friendly English appropriate for Grade 5 students.';

        const prompt = `You are an educational AI tutor for Malaysian primary school students.
Curriculum Scope:
- Subject: ${subject}
- Grade Level: Grade ${clampedGrade}
- Approved Topic: ${finalTopic}
- Approved Subtopic: ${finalSubtopic}
- Learning Objective: ${learningObjective}
- Target Difficulty: ${difficulty}

${sampleExamples.length > 0 ? `Approved Syllabus Examples:\n${JSON.stringify(sampleExamples, null, 2)}` : ''}

${langInstruction}

STRICT REQUIREMENTS:
1. Return ONLY valid, parseable JSON with NO markdown code fences.
2. The options array must contain EXACTLY 4 distinct strings.
3. The correctAnswer MUST match exactly one of the strings in the options array.
4. Provide a clear, child-friendly explanation.
5. Strictly child-safe and concise.
6. The question MUST NOT duplicate: ${JSON.stringify(excludes.slice(-5))}

JSON format:
{
  "question": "question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "exact matching option",
  "hint": "short hint",
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

            if (
              parsed.question &&
              Array.isArray(parsed.options) &&
              parsed.options.length === 4 &&
              parsed.correctAnswer &&
              parsed.options.includes(parsed.correctAnswer) &&
              !excludes.includes(parsed.question.trim())
            ) {
              return {
                id: `gemini-syl-${Date.now()}`,
                subject,
                topic: finalTopic,
                subtopic: finalSubtopic,
                level: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
                gradeLevel: clampedGrade,
                equation: parsed.question,
                question: parsed.question,
                options: parsed.options,
                answer: parsed.correctAnswer,
                correctAnswer: parsed.correctAnswer,
                hint: parsed.hint || 'Perhatikan soalan dengan teliti.',
                explanation: parsed.explanation || `Jawapan yang tepat ialah ${parsed.correctAnswer}.`,
                difficulty,
                source: 'gemini',
                curriculumReference: `${finalTopic}_Grade_${clampedGrade}`
              };
            }
          }
        }
      } catch (err) {
        console.warn('Gemini syllabus generation error, falling back to approved dataset:', err);
      }
    }

    // 2. Select from approved curriculum dataset
    const diffNumber = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    let candidates = this.curriculumDataset.filter(q => {
      if (q.subject.toLowerCase() !== subject.toLowerCase()) return false;
      if (q.gradeLevel !== clampedGrade) return false;
      if (finalTopic && q.topic.toLowerCase() !== finalTopic.toLowerCase()) return false;
      return true;
    });

    if (candidates.length === 0) {
      candidates = this.curriculumDataset.filter(q => q.subject.toLowerCase() === subject.toLowerCase());
    }

    // Filter by difficulty and exclusion
    let filtered = candidates.filter(q => q.difficulty === diffNumber && !excludes.includes(q.questionText));
    if (filtered.length === 0) {
      filtered = candidates.filter(q => !excludes.includes(q.questionText));
    }
    if (filtered.length === 0) {
      filtered = candidates;
    }

    if (filtered.length > 0) {
      const selected = filtered[Math.floor(Math.random() * filtered.length)];
      return {
        id: selected.id,
        subject: selected.subject,
        topic: selected.topic,
        subtopic: selected.subtopic,
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

    // 3. Fallback to procedural question
    return this.generateProceduralQuestion(finalTopic, clampedGrade, diffNumber, subject, difficulty);
  }

  private static findDatasetFallback(
    subject: string,
    topic: string,
    grade: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): PracticeQuestion | null {
    const diffNum = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const matches = this.curriculumDataset.filter(q =>
      q.subject.toLowerCase() === subject.toLowerCase() &&
      (q.topic.toLowerCase() === topic.toLowerCase() || topic.toLowerCase().includes(q.topic.toLowerCase()))
    );

    if (matches.length === 0) return null;

    let picked = matches.find(q => q.difficulty === diffNum) || matches[0];
    return {
      id: picked.id,
      subject: picked.subject,
      topic: picked.topic,
      subtopic: picked.subtopic,
      level: picked.difficulty,
      gradeLevel: picked.gradeLevel,
      equation: picked.questionText,
      question: picked.questionText,
      options: picked.options,
      answer: picked.correctAnswer,
      correctAnswer: picked.correctAnswer,
      hint: `Take your time to read the question carefully.`,
      explanation: picked.explanation,
      difficulty,
      source: 'dataset',
      curriculumReference: picked.sourceReference
    };
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

    if (subject.toLowerCase() === 'bahasa melayu') {
      if (lowerTopic.includes('nama')) {
        return {
          id: qId,
          subject: 'Bahasa Melayu',
          topic: 'Kata Nama',
          subtopic: 'Kata Nama Am',
          level,
          gradeLevel: grade,
          equation: 'Pilih kata nama am yang betul.',
          options: ['kucing', 'berlari', 'sangat', 'cantik'],
          answer: 'kucing',
          hint: 'Kata nama am merujuk benda hidup atau bukan hidup secara umum.',
          explanation: "'Kucing' ialah kata nama am kerana merujuk haiwan secara umum.",
          difficulty,
          source: 'procedural'
        };
      }

      if (lowerTopic.includes('adjektif')) {
        return {
          id: qId,
          subject: 'Bahasa Melayu',
          topic: 'Kata Adjektif',
          subtopic: 'Sifat',
          level,
          gradeLevel: grade,
          equation: 'Pilih kata adjektif sifat untuk melengkapkan ayat: Ali seorang murid yang ____.',
          options: ['rajin', 'berjalan', 'sekolah', 'buku'],
          answer: 'rajin',
          hint: 'Kata adjektif sifat menerangkan perangai atau kelakuan seseorang.',
          explanation: "'Rajin' merupakan sifat yang menerangkan kelakuan Ali.",
          difficulty,
          source: 'procedural'
        };
      }
    }

    if (lowerTopic.includes('pecahan') || lowerTopic.includes('fraction')) {
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'Pecahan',
        subtopic: 'Tambah pecahan',
        level,
        gradeLevel: grade,
        equation: 'Berapakah 1/4 + 2/4?',
        options: ['3/4', '3/8', '2/4', '1/2'],
        answer: '3/4',
        hint: 'Tambah pengangka sahaja apabila penyebutnya sama.',
        explanation: '1/4 + 2/4 = 3/4 kerana kedua-dua pecahan mempunyai penyebut 4.',
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
        level,
        gradeLevel: grade,
        equation: 'Apakah nilai tempat bagi digit 5 dalam nombor 35,420?',
        options: ['Ribu', 'Ratus', 'Puluh', 'Sa'],
        answer: 'Ribu',
        hint: 'Kira susunan tempat dari kanan: Sa, Puluh, Ratus, Ribu.',
        explanation: 'Digit 5 berada di tempat keempat dari kanan, iaitu nilai tempat Ribu.',
        difficulty,
        source: 'procedural'
      };
    }

    if (lowerTopic.includes('darab') || lowerTopic.includes('multiplication')) {
      const a = 2 + Math.floor(Math.random() * (difficulty === 'easy' ? 5 : 9));
      const b = 2 + Math.floor(Math.random() * (difficulty === 'easy' ? 5 : 9));
      const ans = a * b;
      const distractors = new Set<number>([ans]);
      while (distractors.size < 4) {
        const fake = Math.max(1, ans + (Math.floor(Math.random() * 9) - 4) || 2);
        distractors.add(fake);
      }
      const options = Array.from(distractors).sort((x, y) => x - y).map(String);
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'Operasi Asas',
        subtopic: 'Darab',
        level,
        gradeLevel: grade,
        equation: `${a} × ${b} = ?`,
        options,
        answer: String(ans),
        hint: `Fikirkan ${a} kumpulan yang mengandungi ${b} setiap satu.`,
        explanation: `${a} didarab dengan ${b} menghasilkan ${ans}.`,
        difficulty,
        source: 'procedural'
      };
    }

    // Default Addition
    const max = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 25 : 50;
    const a = 1 + Math.floor(Math.random() * max);
    const b = 1 + Math.floor(Math.random() * max);
    const ans = a + b;
    const distractors = new Set<number>([ans]);
    while (distractors.size < 4) {
      const offset = (Math.floor(Math.random() * 7) - 3) || 1;
      const fake = Math.max(1, ans + offset);
      distractors.add(fake);
    }
    const options = Array.from(distractors).sort((x, y) => x - y).map(String);
    return {
      id: qId,
      subject: 'Mathematics',
      topic: 'Operasi Asas',
      subtopic: 'Tambah',
      level,
      gradeLevel: grade,
      equation: `${a} + ${b} = ?`,
      options,
      answer: String(ans),
      hint: `Tambah nombor ${a} dan ${b}.`,
      explanation: `${a} ditambah dengan ${b} ialah ${ans}.`,
      difficulty,
      source: 'procedural'
    };
  }
}
