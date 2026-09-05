import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getTeacherClasses,
  getClassSummary,
  getClassStudents,
} from '../controllers/teacherController.js';
import { authenticate, requireRoles } from '../middlewares/auth.js';

const router = Router();

// All teacher routes require authenticated TEACHER or ADMIN
router.use(authenticate);
router.use(requireRoles(UserRole.TEACHER, UserRole.ADMIN));

router.get('/classes', getTeacherClasses);
router.get('/classes/:id/summary', getClassSummary);
router.get('/classes/:id/students', getClassStudents);

export default router;
