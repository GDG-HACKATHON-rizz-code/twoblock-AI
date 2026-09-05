// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code is designed to run in Supabase Edge Functions (Deno runtime).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PreviousAnswer {
  isCorrect: boolean;
  responseTimeSeconds?: number;
}

interface GenerateRequest {
  studentId?: string;
  studentGrade?: number;
  assessmentType?: 'quick_test' | 'practice';
  subject?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  previousAnswers?: PreviousAnswer[];
}

interface QuestionOutput {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  subject: string;
  topic: string;
  gradeLevel: number;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
}

// Fallback bank for Grades 1–6 across Math, BM, English, Science
const FALLBACK_BANK: Record<string, QuestionOutput[]> = {
  "Mathematics_Grade 1_Addition": [
    {
      question: "What is 4 + 3?",
      options: ["5", "6", "7", "8"],
      correctAnswer: "7",
      subject: "Mathematics",
      topic: "Addition",
      gradeLevel: 1,
      difficulty: "easy",
      explanation: "Four plus three equals seven."
    },
    {
      question: "What is 5 + 4?",
      options: ["8", "9", "10", "11"],
      correctAnswer: "9",
      subject: "Mathematics",
      topic: "Addition",
      gradeLevel: 1,
      difficulty: "medium",
      explanation: "Count up 4 from 5 to get 9."
    }
  ],
  "Mathematics_Grade 2_Subtraction": [
    {
      question: "What is 15 - 7?",
      options: ["6", "7", "8", "9"],
      correctAnswer: "8",
      subject: "Mathematics",
      topic: "Subtraction",
      gradeLevel: 2,
      difficulty: "medium",
      explanation: "15 minus 7 equals 8."
    }
  ],
  "Mathematics_Grade 3_Subtraction": [
    {
      question: "What is 43 - 18?",
      options: ["23", "25", "26", "27"],
      correctAnswer: "25",
      subject: "Mathematics",
      topic: "Subtraction",
      gradeLevel: 3,
      difficulty: "medium",
      explanation: "First subtract 10 from 43 to get 33. Then subtract 8 to get 25."
    },
    {
      question: "What is 72 - 39?",
      options: ["31", "33", "34", "43"],
      correctAnswer: "33",
      subject: "Mathematics",
      topic: "Subtraction",
      gradeLevel: 3,
      difficulty: "hard",
      explanation: "72 minus 40 is 32, add back 1 to get 33."
    }
  ],
  "Mathematics_Grade 3_Multiplication": [
    {
      question: "What is 6 × 7?",
      options: ["36", "42", "48", "54"],
      correctAnswer: "42",
      subject: "Mathematics",
      topic: "Multiplication",
      gradeLevel: 3,
      difficulty: "medium",
      explanation: "Six groups of seven equals forty-two."
    }
  ],
  "Bahasa Melayu_Grade 1_Kata nama": [
    {
      question: "Pilih kata nama am dalam pilihan di bawah.",
      options: ["kucing", "berlari", "merah", "sangat"],
      correctAnswer: "kucing",
      subject: "Bahasa Melayu",
      topic: "Kata nama",
      gradeLevel: 1,
      difficulty: "easy",
      explanation: "Kucing ialah kata nama yang merujuk kepada haiwan."
    }
  ],
  "Bahasa Melayu_Grade 4_Penjodoh bilangan": [
    {
      question: "Pilih penjodoh bilangan yang sesuai untuk sebilah gunting.",
      options: ["bilah", "keping", "batang", "biji"],
      correctAnswer: "bilah",
      subject: "Bahasa Melayu",
      topic: "Penjodoh bilangan",
      gradeLevel: 4,
      difficulty: "medium",
      explanation: "Bilah digunakan untuk benda yang tajam atau runcing seperti gunting atau pisau."
    }
  ],
  "English_Grade 1_Vocabulary": [
    {
      question: "Which word is an animal?",
      options: ["Rabbit", "Table", "Sing", "Yellow"],
      correctAnswer: "Rabbit",
      subject: "English",
      topic: "Vocabulary",
      gradeLevel: 1,
      difficulty: "easy",
      explanation: "A rabbit is a small mammal with long ears."
    }
  ],
  "English_Grade 6_Grammar and comprehension": [
    {
      question: "Choose the conjunction that best completes: 'She studied diligently, ___ she excelled in the test.'",
      options: ["so", "but", "although", "unless"],
      correctAnswer: "so",
      subject: "English",
      topic: "Grammar and comprehension",
      gradeLevel: 6,
      difficulty: "medium",
      explanation: "'So' indicates the result of her diligent study."
    }
  ],
  "Science_Grade 1_Living things and senses": [
    {
      question: "Which sense do we use to listen to music?",
      options: ["Hearing", "Sight", "Touch", "Smell"],
      correctAnswer: "Hearing",
      subject: "Science",
      topic: "Living things and senses",
      gradeLevel: 1,
      difficulty: "easy",
      explanation: "Our ears allow us to use the sense of hearing."
    }
  ],
  "Science_Grade 6_Electricity and energy": [
    {
      question: "Which of the following is an electrical conductor?",
      options: ["Copper wire", "Rubber band", "Glass rod", "Dry wood"],
      correctAnswer: "Copper wire",
      subject: "Science",
      topic: "Electricity and energy",
      gradeLevel: 6,
      difficulty: "medium",
      explanation: "Copper is a metal with low resistance that easily conducts electrical current."
    }
  ]
};

function calculateAdaptiveDifficulty(previousAnswers?: PreviousAnswer[], baseDiff: 'easy' | 'medium' | 'hard' = 'medium'): 'easy' | 'medium' | 'hard' {
  if (!previousAnswers || previousAnswers.length === 0) return baseDiff;
  const last = previousAnswers[previousAnswers.length - 1];
  const responseTime = last.responseTimeSeconds || 10;

  if (last.isCorrect) {
    if (responseTime <= 12) {
      if (baseDiff === 'easy') return 'medium';
      if (baseDiff === 'medium') return 'hard';
      return 'hard';
    }
    return baseDiff; // Keep same if correct but slow
  } else {
    // Wrong answer -> lower difficulty
    if (baseDiff === 'hard') return 'medium';
    return 'easy';
  }
}

function getFallbackQuestion(subject: string, grade: number, topic: string, diff: 'easy' | 'medium' | 'hard'): QuestionOutput {
  const key = `${subject}_Grade ${grade}_${topic}`;
  if (FALLBACK_BANK[key] && FALLBACK_BANK[key].length > 0) {
    const list = FALLBACK_BANK[key];
    const match = list.find(q => q.difficulty === diff) || list[0];
    return { ...match, id: `fb-${Date.now()}-${Math.floor(Math.random()*1000)}` };
  }

  // Generic subject-level fallback
  const anyMatch = Object.keys(FALLBACK_BANK).find(k => k.startsWith(subject));
  if (anyMatch && FALLBACK_BANK[anyMatch].length > 0) {
    return { ...FALLBACK_BANK[anyMatch][0], gradeLevel: grade, id: `fb-${Date.now()}` };
  }

  // Universal arithmetic fallback
  const a = Math.floor(Math.random() * (grade * 5)) + 5;
  const b = Math.floor(Math.random() * a) + 1;
  const ans = a - b;
  const opts = [String(ans), String(ans + 2), String(Math.max(1, ans - 3)), String(ans + 5)].sort(() => Math.random() - 0.5);
  return {
    id: `fb-${Date.now()}`,
    question: `What is ${a} - ${b}?`,
    options: opts,
    correctAnswer: String(ans),
    subject: "Mathematics",
    topic: "Subtraction",
    gradeLevel: grade,
    difficulty: diff,
    explanation: `${a} minus ${b} equals ${ans}.`
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: GenerateRequest = await req.json().catch(() => ({}));
    const grade = Math.min(6, Math.max(1, Number(body.studentGrade) || 3));
    const subject = body.subject || 'Mathematics';
    const topic = body.topic || 'Subtraction';
    const baseDifficulty = body.difficulty || 'medium';
    const calculatedDifficulty = calculateAdaptiveDifficulty(body.previousAnswers, baseDifficulty);

    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      console.warn('GEMINI_API_KEY not configured in Edge Function, using fallback syllabus bank.');
      const fallback = getFallbackQuestion(subject, grade, topic, calculatedDifficulty);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Call Gemini API with strict JSON schema
    const prompt = `You are an educational AI tutor for Malaysian primary students.
Generate an adaptive multiple-choice question for:
- Grade Level: Grade ${grade} (Ages ${grade + 6})
- Subject: ${subject}
- Syllabus Topic: ${topic}
- Target Difficulty: ${calculatedDifficulty}

CRITICAL RULES:
1. Return ONLY a valid, parseable JSON object without markdown or code blocks.
2. The options array must contain EXACTLY 4 distinct strings.
3. The correctAnswer MUST match exactly one of the strings in the options array.
4. Language: For Bahasa Melayu use correct Standard Malay (Bahasa Melayu Baku). For English, Mathematics, and Science use clear, child-friendly English.
5. Child-safe, encouraging, and concise.

JSON format required:
{
  "question": "question text",
  "options": ["opt1", "opt2", "opt3", "opt4"],
  "correctAnswer": "exact matching option",
  "subject": "${subject}",
  "topic": "${topic}",
  "gradeLevel": ${grade},
  "difficulty": "${calculatedDifficulty}",
  "explanation": "concise 1-2 sentence solution explanation"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.3,
          max_output_tokens: 500
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API call returned status:', response.status);
      const fallback = getFallbackQuestion(subject, grade, topic, calculatedDifficulty);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      const fallback = getFallbackQuestion(subject, grade, topic, calculatedDifficulty);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Clean JSON if needed
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed: QuestionOutput = JSON.parse(cleaned);

    // Strict Validation:
    // 1. Must have question string
    // 2. Exactly 4 options
    // 3. correctAnswer in options
    if (
      !parsed.question ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4 ||
      !parsed.correctAnswer ||
      !parsed.options.includes(parsed.correctAnswer)
    ) {
      console.warn('Gemini returned invalid question structure, activating fallback bank.');
      const fallback = getFallbackQuestion(subject, grade, topic, calculatedDifficulty);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const output: QuestionOutput = {
      id: `gq-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      question: parsed.question,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      subject: parsed.subject || subject,
      topic: parsed.topic || topic,
      gradeLevel: grade,
      difficulty: calculatedDifficulty,
      explanation: parsed.explanation || 'Good job reviewing this question!'
    };

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('generate-adaptive-question error:', err);
    const fallback = getFallbackQuestion("Mathematics", 3, "Subtraction", "medium");
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
