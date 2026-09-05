import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import {
  getSubjects,
  getTopicsBySubject,
  getSubtopicsByTopic,
  updateSubtopic,
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../controllers/contentController.js';
import { authenticate, requireRoles } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const updateSubtopicSchema = z.object({
  body: z.object({
    title_ms: z.string().min(1).optional(),
    title_en: z.string().min(1).optional(),
    order_seq: z.number().int().optional(),
    difficulty_tier: z.number().int().optional(),
    is_foundational: z.boolean().optional(),
  }),
});

const createQuestionSchema = z.object({
  body: z.object({
    subject_id: z.string().uuid(),
    topic_id: z.string().uuid(),
    subtopic_id: z.string().uuid(),
    difficulty_level: z.number().int().min(1).max(3),
    question_text: z.string().min(1),
    question_type: z.enum(['mcq', 'short_answer']),
    options: z.union([z.record(z.any()), z.array(z.any())]),
    correct_answer: z.any(),
    explanation: z.string().min(1),
    language: z.enum(['ms', 'en']),
    is_diagnostic: z.boolean().optional(),
    grade_level: z.number().int().min(1).max(6).optional(),
    estimated_time_seconds: z.number().int().positive().optional(),
  }),
});

const updateQuestionSchema = z.object({
  body: z.object({
    subject_id: z.string().uuid().optional(),
    topic_id: z.string().uuid().optional(),
    subtopic_id: z.string().uuid().optional(),
    difficulty_level: z.number().int().min(1).max(3).optional(),
    question_text: z.string().min(1).optional(),
    question_type: z.enum(['mcq', 'short_answer']).optional(),
    options: z.union([z.record(z.any()), z.array(z.any())]).optional(),
    correct_answer: z.any().optional(),
    explanation: z.string().min(1).optional(),
    language: z.enum(['ms', 'en']).optional(),
    is_diagnostic: z.boolean().optional(),
    grade_level: z.number().int().min(1).max(6).optional(),
    estimated_time_seconds: z.number().int().positive().optional(),
    is_active: z.boolean().optional(),
  }),
});

// --------------------------------------------------------
// Read Routes (Authenticated: STUDENT, TEACHER, ADMIN)
// --------------------------------------------------------
router.get('/subjects', authenticate, getSubjects);
router.get('/subjects/:id/topics', authenticate, getTopicsBySubject);
router.get('/topics/:id/subtopics', authenticate, getSubtopicsByTopic);
router.get('/questions', authenticate, getQuestions);
router.get('/questions/:id', authenticate, getQuestionById);

// --------------------------------------------------------
// Write Routes
// PATCH /subtopics/:id: Restricted to TEACHER, ADMIN
// POST /questions: Restricted to TEACHER, ADMIN
// PATCH/DELETE /questions/:id: Restricted to TEACHER (own question) or ADMIN
// --------------------------------------------------------
router.patch(
  '/subtopics/:id',
  authenticate,
  requireRoles(UserRole.TEACHER, UserRole.ADMIN),
  validate(updateSubtopicSchema),
  updateSubtopic
);

router.post(
  '/questions',
  authenticate,
  requireRoles(UserRole.TEACHER, UserRole.ADMIN),
  validate(createQuestionSchema),
  createQuestion
);

router.patch(
  '/questions/:id',
  authenticate,
  requireRoles(UserRole.TEACHER, UserRole.ADMIN),
  validate(updateQuestionSchema),
  updateQuestion
);

router.delete(
  '/questions/:id',
  authenticate,
  requireRoles(UserRole.TEACHER, UserRole.ADMIN),
  deleteQuestion
);

export default router;
