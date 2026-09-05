import { Router } from 'express';
import { z } from 'zod';
import { register, login, demoLogin, getMe } from '../controllers/authController.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    full_name: z.string().min(2),
    role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
    grade_level: z.number().int().min(1).max(6).optional(),
    school_name: z.string().optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const demoLoginSchema = z.object({
  body: z.object({
    role: z.enum(['student', 'teacher']).optional(),
  }),
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/demo-login', validate(demoLoginSchema), demoLogin);
router.get('/me', authenticate, getMe);

export default router;
