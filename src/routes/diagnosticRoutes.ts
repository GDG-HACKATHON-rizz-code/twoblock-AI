import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import {
  getDiagnosticAssessment,
  submitDiagnostic,
  getLearningSnapshot,
} from '../controllers/diagnosticController.js';
import { authenticate, requireRoles } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const submitDiagnosticSchema = z.object({
  body: z.object({
    session_id: z.string().uuid(),
    answers: z.array(
      z.object({
        question_id: z.string().uuid(),
        student_answer: z.any(),
        response_time_seconds: z.number().int().nonnegative().optional(),
      })
    ),
  }),
});

// All diagnostic and snapshot endpoints require authentication (STUDENT or ADMIN)
router.get(
  '/diagnostic',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  getDiagnosticAssessment
);

router.post(
  '/diagnostic/submit',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  validate(submitDiagnosticSchema),
  submitDiagnostic
);

router.get(
  '/snapshot',
  authenticate,
  requireRoles(UserRole.STUDENT, UserRole.ADMIN),
  getLearningSnapshot
);

export default router;
