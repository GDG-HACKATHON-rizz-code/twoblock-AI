export interface PracticeQuestion {
  id: string;
  subject: string;
  topic: string;
  level: number;
  equation: string;
  options: string[];
  answer: string | number;
  hint?: string;
  explanation?: string;
}

export class GeminiPracticeService {
  private static geminiApiKey = process.env.GEMINI_API_KEY || '';

  /**
   * Strictly limited to generating adaptive practice questions for the Student Practice page.
   */
  public static async generateAdaptiveQuestion(
    topic: string = 'addition',
    grade: number = 2,
    level: number = 1,
    subject: string = 'Mathematics'
  ): Promise<PracticeQuestion> {
    const topicKey = topic.toLowerCase().trim();

    // 1. Try Gemini API if API key is provided
    if (this.geminiApiKey) {
      try {
        const prompt = `You are an educational AI question generator for 2Block Ai.
Generate exactly 1 multiple-choice practice question for Grade ${grade} students in ${subject} on the topic "${topic}" at difficulty level ${level} (from 1 to 3).
Return ONLY valid raw JSON with NO markdown formatting, matching this exact structure:
{
  "equation": "Question or math equation to solve",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": "Exact matching string from options that is correct",
  "hint": "Short 1-sentence supportive hint",
  "explanation": "Short 1-sentence explanation of the answer"
}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          }
        );

        if (response.ok) {
          const resJson: any = await response.json();
          const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.equation && Array.isArray(parsed.options) && parsed.answer) {
              return {
                id: `gemini-q-${Date.now()}`,
                subject,
                topic,
                level,
                equation: parsed.equation,
                options: parsed.options,
                answer: parsed.answer,
                hint: parsed.hint || 'Take your time and double-check your steps.',
                explanation: parsed.explanation || `The correct answer is ${parsed.answer}.`
              };
            }
          }
        }
      } catch (err) {
        console.warn('Gemini API question generation fallback to procedural generator:', err);
      }
    }

    // 2. High-quality procedural curriculum generator (reliable fallback)
    return this.generateProceduralQuestion(topicKey, grade, level, subject);
  }

  private static generateProceduralQuestion(
    topic: string,
    grade: number,
    level: number,
    subject: string
  ): PracticeQuestion {
    const qId = `pq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (topic === 'addition') {
      const max = level === 1 ? 9 : level === 2 ? 25 : 50;
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
        equation: `${a} + ${b} = ?`,
        options,
        answer: String(ans),
        hint: `Count up from ${Math.max(a, b)} by ${Math.min(a, b)}.`,
        explanation: `${a} plus ${b} equals ${ans}.`
      };
    }

    if (topic === 'subtraction') {
      const max = level === 1 ? 12 : level === 2 ? 30 : 60;
      const a = 4 + Math.floor(Math.random() * max);
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
        equation: `${a} − ${b} = ?`,
        options,
        answer: String(ans),
        hint: `Start at ${a} and take away ${b}.`,
        explanation: `${a} minus ${b} leaves ${ans}.`
      };
    }

    if (topic === 'multiplication') {
      const a = 2 + Math.floor(Math.random() * (level === 1 ? 5 : 10));
      const b = 2 + Math.floor(Math.random() * (level === 1 ? 5 : 10));
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
        equation: `${a} × ${b} = ?`,
        options,
        answer: String(ans),
        hint: `Think of ${a} groups of ${b}.`,
        explanation: `${a} times ${b} equals ${ans}.`
      };
    }

    if (topic === 'division') {
      const b = 2 + Math.floor(Math.random() * (level === 1 ? 4 : 8));
      const ans = 2 + Math.floor(Math.random() * (level === 1 ? 5 : 9));
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
        equation: `${a} ÷ ${b} = ?`,
        options,
        answer: String(ans),
        hint: `How many times does ${b} fit into ${a}?`,
        explanation: `${a} divided by ${b} equals ${ans}.`
      };
    }

    // Default fallback
    return {
      id: qId,
      subject: 'Mathematics',
      topic: 'Addition',
      level: 1,
      equation: `5 + 4 = ?`,
      options: ['7', '8', '9', '10'],
      answer: '9',
      hint: '5 and 4 make 9.',
      explanation: '5 + 4 = 9.'
    };
  }
}
