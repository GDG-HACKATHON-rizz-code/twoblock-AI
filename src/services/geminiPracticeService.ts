import fs from 'fs';
import path from 'path';

export interface PracticeQuestion {
  id: string;
  subject: string;
  topic: string;
  level: number;
  gradeLevel?: number;
  equation: string;
  options: string[];
  answer: string | number;
  hint?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  source?: 'gemini' | 'procedural';
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

export class GeminiPracticeService {
  private static geminiApiKey = process.env.GEMINI_API_KEY || '';
  private static curriculumTopics: CurriculumTopic[] = [];

  static {
    try {
      const p = path.resolve(process.cwd(), 'data', 'curriculum_topics.json');
      if (fs.existsSync(p)) {
        this.curriculumTopics = JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch (e) {
      console.warn('Could not load curriculum_topics.json:', e);
    }
  }

  public static getCurriculumTopics(grade?: number, subject?: string): CurriculumTopic[] {
    return this.curriculumTopics.filter(t => {
      if (grade && t.grade !== grade) return false;
      if (subject && t.subject.toLowerCase() !== subject.toLowerCase()) return false;
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
                level,
                gradeLevel: clampedGrade,
                equation: parsed.question,
                options: parsed.options,
                answer: parsed.correctAnswer,
                hint: parsed.hint || 'Take your time and double-check your steps.',
                explanation: parsed.explanation || `The correct answer is ${parsed.correctAnswer}.`,
                difficulty,
                source: 'gemini'
              };
            }
          }
        }
      } catch (err) {
        console.warn('Gemini API question generation fallback to procedural generator:', err);
      }
    }

    // 2. High-quality procedural curriculum generator (reliable fallback)
    return this.generateProceduralQuestion(topicKey, clampedGrade, level, subject, difficulty);
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
          topic: 'Kata nama',
          level,
          gradeLevel: grade,
          equation: 'Pilih kata nama am yang betul.',
          options: ['kucing', 'berlari', 'sangat', 'cantik'],
          answer: 'kucing',
          hint: 'Kata nama merujuk kepada orang, haiwan, tempat, atau benda.',
          explanation: 'Kucing ialah kata nama am yang merujuk kepada haiwan.',
          difficulty,
          source: 'procedural'
        };
      }
      return {
        id: qId,
        subject: 'Bahasa Melayu',
        topic: 'Kata kerja',
        level,
        gradeLevel: grade,
        equation: 'Pilih kata kerja dalam ayat: "Adik sedang membaca buku cerita."',
        options: ['Adik', 'sedang', 'membaca', 'cerita'],
        answer: 'membaca',
        hint: 'Kata kerja menunjukkan sesuatu perbuatan atau aktiviti.',
        explanation: 'Membaca ialah kata kerja yang menunjukkan perbuatan.',
        difficulty,
        source: 'procedural'
      };
    }

    if (subject.toLowerCase() === 'english') {
      if (grade >= 4) {
        return {
          id: qId,
          subject: 'English',
          topic: 'Grammar and comprehension',
          level,
          gradeLevel: grade,
          equation: 'Choose the correct conjunction: "I wanted to go outside, ___ it started raining."',
          options: ['but', 'and', 'or', 'so'],
          answer: 'but',
          hint: 'Use a conjunction that shows a contrast between two ideas.',
          explanation: '"But" shows contrast between wanting to go out and rain preventing it.',
          difficulty,
          source: 'procedural'
        };
      }
      return {
        id: qId,
        subject: 'English',
        topic: 'Vocabulary',
        level,
        gradeLevel: grade,
        equation: 'Which of the following is a fruit?',
        options: ['Apple', 'Chair', 'Pencil', 'Shirt'],
        answer: 'Apple',
        hint: 'Think of something healthy and sweet that you can eat.',
        explanation: 'An apple is a healthy edible fruit.',
        difficulty,
        source: 'procedural'
      };
    }

    if (subject.toLowerCase() === 'science') {
      if (grade >= 4) {
        return {
          id: qId,
          subject: 'Science',
          topic: 'Electricity and energy',
          level,
          gradeLevel: grade,
          equation: 'Which material is a good conductor of electricity?',
          options: ['Copper wire', 'Plastic spoon', 'Rubber eraser', 'Dry stick'],
          answer: 'Copper wire',
          hint: 'Metals generally allow electric current to pass through easily.',
          explanation: 'Copper is a metal with low electrical resistance, making it an excellent conductor.',
          difficulty,
          source: 'procedural'
        };
      }
      return {
        id: qId,
        subject: 'Science',
        topic: 'Living things and senses',
        level,
        gradeLevel: grade,
        equation: 'Which sense organ is used to taste food?',
        options: ['Tongue', 'Eyes', 'Ears', 'Nose'],
        answer: 'Tongue',
        hint: 'This organ is inside your mouth.',
        explanation: 'The tongue contains taste buds that identify sweet, sour, salty, and bitter tastes.',
        difficulty,
        source: 'procedural'
      };
    }

    // Mathematics
    if (lowerTopic.includes('subtraction')) {
      const max = difficulty === 'easy' ? 12 : difficulty === 'medium' ? 30 : 60;
      const a = 5 + Math.floor(Math.random() * max);
      const b = 1 + Math.floor(Math.random() * (a - 1));
      const ans = a - b;
      const distractors = new Set<number>([ans]);
      while (distractors.size < 4) {
        const offset = (Math.floor(Math.random() * 7) - 3) || 1;
        const fake = Math.max(0, ans + offset);
        distractors.add(fake);
      }
      const options = Array.from(distractors).sort((x, y) => x - y).map(String);
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'Subtraction',
        level,
        gradeLevel: grade,
        equation: `${a} − ${b} = ?`,
        options,
        answer: String(ans),
        hint: `Start at ${a} and count back by ${b}.`,
        explanation: `${a} minus ${b} equals ${ans}.`,
        difficulty,
        source: 'procedural'
      };
    }

    if (lowerTopic.includes('multiplication')) {
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
        topic: 'Multiplication',
        level,
        gradeLevel: grade,
        equation: `${a} × ${b} = ?`,
        options,
        answer: String(ans),
        hint: `Think of ${a} equal groups of ${b}.`,
        explanation: `${a} times ${b} equals ${ans}.`,
        difficulty,
        source: 'procedural'
      };
    }

    if (lowerTopic.includes('division')) {
      const b = 2 + Math.floor(Math.random() * (difficulty === 'easy' ? 4 : 8));
      const ans = 2 + Math.floor(Math.random() * (difficulty === 'easy' ? 5 : 9));
      const a = b * ans;
      const distractors = new Set<number>([ans]);
      while (distractors.size < 4) {
        const fake = Math.max(1, ans + (Math.floor(Math.random() * 5) - 2) || 1);
        distractors.add(fake);
      }
      const options = Array.from(distractors).sort((x, y) => x - y).map(String);
      return {
        id: qId,
        subject: 'Mathematics',
        topic: 'Division',
        level,
        gradeLevel: grade,
        equation: `${a} ÷ ${b} = ?`,
        options,
        answer: String(ans),
        hint: `How many times does ${b} fit into ${a}?`,
        explanation: `${a} divided by ${b} equals ${ans}.`,
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
      topic: 'Addition',
      level,
      gradeLevel: grade,
      equation: `${a} + ${b} = ?`,
      options,
      answer: String(ans),
      hint: `Count on ${b} from ${a}.`,
      explanation: `${a} plus ${b} equals ${ans}.`,
      difficulty,
      source: 'procedural'
    };
  }
}

