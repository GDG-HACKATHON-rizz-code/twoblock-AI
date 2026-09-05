import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import {
  createSession,
  getNextQuestion,
  submitAnswer,
  endSession,
  getSessionSummary,
} from '../controllers/practiceController.js';
import { authenticate, requireRoles } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const createSessionSchema = z.object({
  body: z.object({
    subtopic_id: z.string().uuid(),
  }),
});

const submitAnswerSchema = z.object({
  body: z.object({
    question_id: z.string().uuid(),
    student_answer: z.any(),
    response_time_seconds: z.number().int().nonnegative().optional(),
  }),
});

// All practice endpoints require authenticated STUDENT or ADMIN
router.post(
  '/sessions',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  validate(createSessionSchema),
  createSession
);

router.get(
  '/sessions/:id/next-question',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  getNextQuestion
);

router.post(
  '/sessions/:id/answer',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  validate(submitAnswerSchema),
  submitAnswer
);

router.post(
  '/sessions/:id/end',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  endSession
);

router.get(
  '/sessions/:id/summary',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  getSessionSummary
);

export default router;
