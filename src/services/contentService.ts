import { ContentLanguage, QuestionType, UserRole } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { AuthUserPayload } from '../types/express.js';

export interface CreateQuestionInput {
  subject_id: string;
  topic_id: string;
  subtopic_id: string;
  difficulty_level: number;
  question_text: string;
  question_type: QuestionType;
  options: Record<string, any> | Array<any>;
  correct_answer: any;
  explanation: string;
  language: ContentLanguage;
  is_diagnostic?: boolean;
  grade_level?: number;
  estimated_time_seconds?: number;
}

export interface UpdateQuestionInput {
  subject_id?: string;
  topic_id?: string;
  subtopic_id?: string;
  difficulty_level?: number;
  question_text?: string;
  question_type?: QuestionType;
  options?: Record<string, any> | Array<any>;
  correct_answer?: any;
  explanation?: string;
  language?: ContentLanguage;
  is_diagnostic?: boolean;
  grade_level?: number;
  estimated_time_seconds?: number;
  is_active?: boolean;
}

export interface QuestionFilterQuery {
  subject_id?: string;
  topic_id?: string;
  subtopic_id?: string;
  difficulty_level?: number;
  language?: ContentLanguage;
  is_diagnostic?: boolean;
  is_active?: boolean;
  grade_level?: number;
}

export class ContentService {
  // --------------------------------------------------------
  // SUBJECTS, TOPICS, SUBTOPICS (READ)
  // --------------------------------------------------------

  async getSubjects() {
    return prisma.subject.findMany({
      where: { is_active: true },
      include: {
        topics: {
          orderBy: { order_seq: 'asc' },
          include: {
            subtopics: {
              orderBy: { order_seq: 'asc' },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getTopicsBySubject(subjectId: string) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      throw new AppError('SUBJECT_NOT_FOUND', 404);
    }

    return prisma.topic.findMany({
      where: { subject_id: subjectId },
      include: {
        subtopics: {
          orderBy: { order_seq: 'asc' },
        },
      },
      orderBy: { order_seq: 'asc' },
    });
  }

  async getSubtopicsByTopic(topicId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });
    if (!topic) {
      throw new AppError('TOPIC_NOT_FOUND', 404);
    }

    return prisma.subtopic.findMany({
      where: { topic_id: topicId },
      orderBy: { order_seq: 'asc' },
    });
  }

  async updateSubtopic(
    id: string,
    input: {
      title_ms?: string;
      title_en?: string;
      order_seq?: number;
      difficulty_tier?: number;
      is_foundational?: boolean;
    }
  ) {
    const existing = await prisma.subtopic.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('SUBTOPIC_NOT_FOUND', 404);
    }

    return prisma.subtopic.update({
      where: { id },
      data: input,
    });
  }

  // --------------------------------------------------------
  // QUESTIONS CRUD & VALIDATION
  // --------------------------------------------------------

  async getQuestions(filter: QuestionFilterQuery) {
    const whereClause: any = {};

    if (filter.subject_id) whereClause.subject_id = filter.subject_id;
    if (filter.topic_id) whereClause.topic_id = filter.topic_id;
    if (filter.subtopic_id) whereClause.subtopic_id = filter.subtopic_id;
    if (filter.difficulty_level !== undefined) whereClause.difficulty_level = filter.difficulty_level;
    if (filter.language) whereClause.language = filter.language;
    if (filter.is_diagnostic !== undefined) whereClause.is_diagnostic = filter.is_diagnostic;
    if (filter.is_active !== undefined) {
      whereClause.is_active = filter.is_active;
    } else {
      whereClause.is_active = true;
    }
    if (filter.grade_level !== undefined) whereClause.grade_level = filter.grade_level;

    return prisma.question.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, code: true, name_ms: true, name_en: true } },
        topic: { select: { id: true, code: true, title_ms: true, title_en: true } },
        subtopic: { select: { id: true, code: true, title_ms: true, title_en: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getQuestionById(id: string) {
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        subject: true,
        topic: true,
        subtopic: true,
      },
    });

    if (!question) {
      throw new AppError('QUESTION_NOT_FOUND', 404);
    }

    return question;
  }

  async createQuestion(input: CreateQuestionInput, user: AuthUserPayload) {
    await this.validateQuestionRules(input);

    return prisma.question.create({
      data: {
        subject_id: input.subject_id,
        topic_id: input.topic_id,
        subtopic_id: input.subtopic_id,
        difficulty_level: input.difficulty_level,
        question_text: input.question_text,
        question_type: input.question_type,
        options: input.options,
        correct_answer: input.correct_answer,
        explanation: input.explanation,
        language: input.language,
        is_diagnostic: input.is_diagnostic ?? false,
        grade_level: input.grade_level ?? 1,
        estimated_time_seconds: input.estimated_time_seconds ?? 60,
        created_by: user.id,
      },
      include: {
        subject: true,
        topic: true,
        subtopic: true,
      },
    });
  }

  async updateQuestion(id: string, input: UpdateQuestionInput, user: AuthUserPayload) {
    const existing = await prisma.question.findUnique({
      where: { id },
      include: { subject: true, topic: true, subtopic: true },
    });

    if (!existing) {
      throw new AppError('QUESTION_NOT_FOUND', 404);
    }

    // Ownership Check: Teachers can only edit their own questions; Admins can edit any question
    if (user.role === UserRole.TEACHER && existing.created_by !== user.id) {
      throw new AppError('FORBIDDEN_OWNERSHIP', 403);
    }

    // Prepare combined data for full validation
    const mergedData: CreateQuestionInput = {
      subject_id: input.subject_id ?? existing.subject_id,
      topic_id: input.topic_id ?? existing.topic_id,
      subtopic_id: input.subtopic_id ?? existing.subtopic_id,
      difficulty_level: input.difficulty_level ?? existing.difficulty_level,
      question_text: input.question_text ?? existing.question_text,
      question_type: input.question_type ?? existing.question_type,
      options: input.options ?? (existing.options as any),
      correct_answer: input.correct_answer ?? (existing.correct_answer as any),
      explanation: input.explanation ?? existing.explanation,
      language: input.language ?? existing.language,
      is_diagnostic: input.is_diagnostic ?? existing.is_diagnostic,
      grade_level: input.grade_level ?? existing.grade_level,
      estimated_time_seconds: input.estimated_time_seconds ?? existing.estimated_time_seconds,
    };

    await this.validateQuestionRules(mergedData);

    return prisma.question.update({
      where: { id },
      data: {
        ...input,
      },
      include: {
        subject: true,
        topic: true,
        subtopic: true,
      },
    });
  }

  async deleteQuestion(id: string, user: AuthUserPayload) {
    const existing = await prisma.question.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('QUESTION_NOT_FOUND', 404);
    }

    // Ownership Check: Teachers can only delete their own questions; Admins can delete any
    if (user.role === UserRole.TEACHER && existing.created_by !== user.id) {
      throw new AppError('FORBIDDEN_OWNERSHIP', 403);
    }

    // Soft delete: is_active = false
    return prisma.question.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // --------------------------------------------------------
  // VALIDATION RULES (SPEC SECTION 4)
  // --------------------------------------------------------

  private async validateQuestionRules(input: CreateQuestionInput) {
    // 1. Explanation cannot be empty
    if (!input.explanation || !input.explanation.trim()) {
      throw new AppError('EXPLANATION_REQUIRED', 400);
    }

    // 2. MCQ options count & correct answer match
    if (input.question_type === QuestionType.mcq) {
      let optionKeys: string[] = [];
      let optionValues: any[] = [];

      if (Array.isArray(input.options)) {
        if (input.options.length !== 4) {
          throw new AppError('INVALID_OPTIONS_COUNT', 400);
        }
        optionKeys = ['0', '1', '2', '3', 'A', 'B', 'C', 'D'];
        optionValues = input.options;
      } else if (typeof input.options === 'object' && input.options !== null) {
        optionKeys = Object.keys(input.options);
        if (optionKeys.length !== 4) {
          throw new AppError('INVALID_OPTIONS_COUNT', 400);
        }
        optionValues = Object.values(input.options);
      } else {
        throw new AppError('INVALID_OPTIONS_COUNT', 400);
      }

      // Check correct_answer
      const ansString = String(input.correct_answer).trim();
      const matchesKey = optionKeys.some(
        (k) => k.toLowerCase() === ansString.toLowerCase()
      );
      const matchesValue = optionValues.some(
        (v) => String(v).trim().toLowerCase() === ansString.toLowerCase()
      );

      if (!matchesKey && !matchesValue) {
        throw new AppError('CORRECT_ANSWER_MISMATCH', 400);
      }
    }

    // 3. Subject, Topic, Subtopic Hierarchy Integrity
    const subject = await prisma.subject.findUnique({
      where: { id: input.subject_id },
    });
    if (!subject) {
      throw new AppError('SUBJECT_NOT_FOUND', 404);
    }

    const topic = await prisma.topic.findUnique({
      where: { id: input.topic_id },
    });
    if (!topic) {
      throw new AppError('TOPIC_NOT_FOUND', 404);
    }
    if (topic.subject_id !== input.subject_id) {
      throw new AppError('TOPIC_SUBJECT_MISMATCH', 400);
    }

    const subtopic = await prisma.subtopic.findUnique({
      where: { id: input.subtopic_id },
    });
    if (!subtopic) {
      throw new AppError('SUBTOPIC_NOT_FOUND', 404);
    }
    if (subtopic.topic_id !== input.topic_id) {
      throw new AppError('SUBTOPIC_TOPIC_MISMATCH', 400);
    }

    // 4. Subject Language Rules (Spec Section 4)
    // Matematik & Science -> BM only ('ms') for MVP
    // BM -> 'ms' only
    // English -> 'en' only
    const subCode = subject.code.toUpperCase();
    const subNameMs = (subject.name_ms || '').toUpperCase();
    const subNameEn = (subject.name_en || '').toUpperCase();

    if (
      subCode.startsWith('MAT') ||
      subNameMs.includes('MATEMATIK') ||
      subNameEn.includes('MATH')
    ) {
      if (input.language !== ContentLanguage.ms) {
        throw new AppError('LANGUAGE_MISMATCH', 400, {
          language: input.language,
          subject: subject.name_ms || 'Matematik',
        });
      }
    } else if (
      subCode.startsWith('SCI') ||
      subNameMs.includes('SAINS') ||
      subNameEn.includes('SCIENCE')
    ) {
      if (input.language !== ContentLanguage.ms) {
        throw new AppError('LANGUAGE_MISMATCH', 400, {
          language: input.language,
          subject: subject.name_ms || 'Sains',
        });
      }
    } else if (
      subCode.startsWith('BM') ||
      subNameMs.includes('MELAYU') ||
      subNameEn.includes('MALAY')
    ) {
      if (input.language !== ContentLanguage.ms) {
        throw new AppError('LANGUAGE_MISMATCH', 400, {
          language: input.language,
          subject: 'Bahasa Melayu',
        });
      }
    } else if (
      subCode.startsWith('ENG') ||
      subNameMs.includes('INGGERIS') ||
      subNameEn.includes('ENGLISH')
    ) {
      if (input.language !== ContentLanguage.en) {
        throw new AppError('LANGUAGE_MISMATCH', 400, {
          language: input.language,
          subject: 'English',
        });
      }
    }
  }
}

export const contentService = new ContentService();
