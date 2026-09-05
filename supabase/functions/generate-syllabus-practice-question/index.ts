// Supabase Edge Function: generate-syllabus-practice-question
// Generates syllabus-bounded practice questions using Gemini AI with fallback to approved curriculum datasets

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export interface SyllabusPracticeRequest {
  studentId?: string;
  subject: string;
  studentGrade: number;
  topicId?: string;
  topicName: string;
  subtopicName?: string;
  learningObjective?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  recentAccuracy?: number;
  referenceContent?: string[];
  exampleQuestions?: any[];
  excludeQuestionTexts?: string[];
}

export interface SyllabusPracticeResponse {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  subject: string;
  gradeLevel: number;
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
  curriculumReference?: string;
  source: 'gemini' | 'dataset' | 'curriculum_fallback';
}

const APPROVED_FALLBACKS: Record<string, SyllabusPracticeResponse[]> = {
  "Bahasa Melayu_Kata Adjektif": [
    {
      question: "Apakah kata adjektif yang sesuai untuk melengkapkan ayat? Amir seorang murid yang ____.",
      options: ["rajin", "buku", "berlari", "sekolah"],
      correctAnswer: "rajin",
      subject: "Bahasa Melayu",
      gradeLevel: 5,
      topic: "Kata Adjektif",
      subtopic: "Sifat",
      difficulty: "easy",
      explanation: "Perkataan 'rajin' menerangkan sifat seseorang, maka ia ialah kata adjektif.",
      source: "curriculum_fallback"
    },
    {
      question: "Pilih ayat yang menggunakan kata adjektif warna yang betul.",
      options: [
        "Bunga ros itu berwarna merah.",
        "Bunga ros itu berwarna pantas.",
        "Bunga ros itu berwarna pandai.",
        "Bunga ros itu berwarna rajin."
      ],
      correctAnswer: "Bunga ros itu berwarna merah.",
      subject: "Bahasa Melayu",
      gradeLevel: 5,
      topic: "Kata Adjektif",
      subtopic: "Warna",
      difficulty: "medium",
      explanation: "Merah merupakan kata adjektif warna yang tepat untuk bunga ros.",
      source: "curriculum_fallback"
    },
    {
      question: "Dadu mempunyai bentuk seperti sebuah ____.",
      options: ["kubus", "bujur", "bulat", "lonjong"],
      correctAnswer: "kubus",
      subject: "Bahasa Melayu",
      gradeLevel: 5,
      topic: "Kata Adjektif",
      subtopic: "Bentuk",
      difficulty: "medium",
      explanation: "Dadu berbentuk kubus bersisi enam rata.",
      source: "curriculum_fallback"
    }
  ],
  "Bahasa Melayu_Kata Nama": [
    {
      question: "Pilih perkataan yang tergolong dalam kata nama am.",
      options: ["kereta", "Malaysia", "Proton", "Aiman"],
      correctAnswer: "kereta",
      subject: "Bahasa Melayu",
      gradeLevel: 5,
      topic: "Kata Nama",
      subtopic: "Kata Nama Am",
      difficulty: "easy",
      explanation: "'Kereta' merujuk kepada benda umum tanpa huruf besar di pangkal.",
      source: "curriculum_fallback"
    },
    {
      question: "Antara yang berikut, yang manakah kata ganti nama diri pertama?",
      options: ["Saya", "Kamu", "Beliau", "Mereka"],
      correctAnswer: "Saya",
      subject: "Bahasa Melayu",
      gradeLevel: 5,
      topic: "Kata Nama",
      subtopic: "Kata Ganti Nama",
      difficulty: "easy",
      explanation: "'Saya' digunakan untuk merujuk diri penutur (kata ganti nama pertama).",
      source: "curriculum_fallback"
    }
  ],
  "Mathematics_Pecahan": [
    {
      question: "Pecahan yang manakah setara dengan 1/2?",
      options: ["2/4", "2/5", "3/5", "1/4"],
      correctAnswer: "2/4",
      subject: "Mathematics",
      gradeLevel: 5,
      topic: "Pecahan",
      subtopic: "Pecahan setara",
      difficulty: "easy",
      explanation: "1/2 didarabkan dengan 2/2 menghasilkan 2/4.",
      source: "curriculum_fallback"
    },
    {
      question: "Berapakah 2/5 + 1/5?",
      options: ["3/5", "3/10", "2/10", "1/5"],
      correctAnswer: "3/5",
      subject: "Mathematics",
      gradeLevel: 5,
      topic: "Pecahan",
      subtopic: "Tambah pecahan",
      difficulty: "easy",
      explanation: "Kerana penyebut sama, tambah pengangka: 2 + 1 = 3, maka jawapannya 3/5.",
      source: "curriculum_fallback"
    },
    {
      question: "Berapakah 5/6 - 2/6?",
      options: ["3/6", "3/12", "7/6", "1/6"],
      correctAnswer: "3/6",
      subject: "Mathematics",
      gradeLevel: 5,
      topic: "Pecahan",
      subtopic: "Tolak pecahan",
      difficulty: "medium",
      explanation: "5/6 - 2/6 = 3/6 (atau dipermudah kepada 1/2).",
      source: "curriculum_fallback"
    }
  ],
  "Mathematics_Operasi Asas": [
    {
      question: "Berapakah 245 + 132?",
      options: ["377", "367", "387", "357"],
      correctAnswer: "377",
      subject: "Mathematics",
      gradeLevel: 5,
      topic: "Operasi Asas",
      subtopic: "Tambah",
      difficulty: "easy",
      explanation: "245 + 132 = 377.",
      source: "curriculum_fallback"
    },
    {
      question: "Berapakah 850 - 325?",
      options: ["525", "515", "535", "495"],
      correctAnswer: "525",
      subject: "Mathematics",
      gradeLevel: 5,
      topic: "Operasi Asas",
      subtopic: "Tolak",
      difficulty: "easy",
      explanation: "850 - 325 = 525.",
      source: "curriculum_fallback"
    },
    {
      question: "Berapakah 25 x 4?",
      options: ["100", "80", "120", "90"],
      correctAnswer: "100",
      subject: "Mathematics",
      gradeLevel: 5,
      topic: "Operasi Asas",
      subtopic: "Darab",
      difficulty: "medium",
      explanation: "25 didarab dengan 4 menghasilkan 100.",
      source: "curriculum_fallback"
    }
  ],
  "Mathematics_Nombor Bulat": [
    {
      question: "Apakah nilai tempat bagi digit 7 dalam nombor 47,325?",
      options: ["Ribu", "Sa", "Puluh", "Ratus"],
      correctAnswer: "Ribu",
      subject: "Mathematics",
      gradeLevel: 5,
      topic: "Nombor Bulat",
      subtopic: "Nilai Tempat",
      difficulty: "easy",
      explanation: "Digit 7 berada pada nilai tempat ribu.",
      source: "curriculum_fallback"
    }
  ]
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: SyllabusPracticeRequest = await req.json();
    const {
      subject = 'Mathematics',
      studentGrade = 5,
      topicName = 'Pecahan',
      subtopicName,
      learningObjective,
      difficulty = 'medium',
      recentAccuracy = 70,
      referenceContent = [],
      exampleQuestions = [],
      excludeQuestionTexts = []
    } = payload;

    // Validate subject
    const normalizedSubject = subject.toLowerCase().includes('melayu') || subject.toLowerCase() === 'bm'
      ? 'Bahasa Melayu'
      : subject.toLowerCase().includes('math') || subject.toLowerCase().includes('matematik')
      ? 'Mathematics'
      : subject.toLowerCase().includes('science') || subject.toLowerCase().includes('sains')
      ? 'Science'
      : 'English';

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

    // If Gemini key is available, attempt AI generation strictly bounded to syllabus
    if (GEMINI_API_KEY) {
      try {
        const langInstruction = normalizedSubject === 'Bahasa Melayu'
          ? 'Use formal Standard Malay (Bahasa Melayu Baku) appropriate for Malaysian Primary Grade 5 students.'
          : 'Use clear, friendly English appropriate for Grade 5 students.';

        const examplesText = exampleQuestions.length > 0
          ? `\nHere are approved syllabus examples:\n${JSON.stringify(exampleQuestions.slice(0, 3), null, 2)}`
          : '';

        const contextText = referenceContent.length > 0
          ? `\nApproved Curriculum Content References:\n${referenceContent.slice(0, 3).join('\n')}`
          : '';

        const prompt = `You are an expert Malaysian Primary School teacher creating an adaptive practice question.
Curriculum Scope:
- Subject: ${normalizedSubject}
- Grade Level: Grade ${studentGrade}
- Approved Topic: ${topicName}
${subtopicName ? `- Subtopic: ${subtopicName}` : ''}
${learningObjective ? `- Learning Objective: ${learningObjective}` : ''}
- Target Difficulty: ${difficulty} (Student recent accuracy: ${recentAccuracy}%)
${contextText}
${examplesText}

${langInstruction}

STRICT REQUIREMENTS:
1. Generate EXACTLY 1 multiple-choice question.
2. The question MUST strictly align with the approved topic and learning objective. DO NOT introduce unrelated concepts.
3. Provide EXACTLY 4 distinct options in the "options" array.
4. "correctAnswer" MUST be an EXACT match to one of the 4 options.
5. Provide a helpful, encouraging explanation suitable for an 11-year-old child.
6. Return ONLY valid JSON with NO markdown fences.

Expected JSON output format:
{
  "question": "question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Option A",
  "subject": "${normalizedSubject}",
  "gradeLevel": ${studentGrade},
  "topic": "${topicName}",
  "subtopic": "${subtopicName || topicName}",
  "difficulty": "${difficulty}",
  "explanation": "Clear explanation here.",
  "curriculumReference": "${topicName}_Grade_${studentGrade}"
}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const resp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json"
            }
          })
        });

        if (resp.ok) {
          const result = await resp.json();
          let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);

            if (
              parsed.question &&
              Array.isArray(parsed.options) &&
              parsed.options.length === 4 &&
              parsed.correctAnswer &&
              parsed.options.includes(parsed.correctAnswer) &&
              !excludeQuestionTexts.includes(parsed.question.trim())
            ) {
              return new Response(JSON.stringify({
                id: `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                question: parsed.question,
                options: parsed.options,
                correctAnswer: parsed.correctAnswer,
                subject: normalizedSubject,
                gradeLevel: studentGrade,
                topic: topicName,
                subtopic: parsed.subtopic || subtopicName || topicName,
                difficulty,
                explanation: parsed.explanation || 'Jawapan yang tepat mengikut sukatan pelajaran.',
                curriculumReference: `${topicName}_Grade_${studentGrade}`,
                source: 'gemini'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
              });
            }
          }
        }
      } catch (geminiError) {
        console.warn('Gemini syllabus question generation error, using fallback:', geminiError);
      }
    }

    // Fallback selection from approved dataset bank
    const lookupKey = `${normalizedSubject}_${topicName}`;
    let candidateList = APPROVED_FALLBACKS[lookupKey] || [];

    if (candidateList.length === 0) {
      const generalKeys = Object.keys(APPROVED_FALLBACKS).filter(k => k.startsWith(normalizedSubject));
      if (generalKeys.length > 0) {
        candidateList = APPROVED_FALLBACKS[generalKeys[0]];
      }
    }

    if (candidateList.length === 0) {
      candidateList = APPROVED_FALLBACKS["Mathematics_Pecahan"];
    }

    // Filter by exclude list if possible
    let filtered = candidateList.filter(q => !excludeQuestionTexts.includes(q.question));
    if (filtered.length === 0) filtered = candidateList;

    const chosen = filtered[Math.floor(Math.random() * filtered.length)];

    return new Response(JSON.stringify({
      ...chosen,
      id: `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      difficulty
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    return new Response(JSON.stringify({
      error: 'Failed to generate syllabus practice question',
      details: err.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
