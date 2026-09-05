import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import contentRoutes from './contentRoutes.js';
import diagnosticRoutes from './diagnosticRoutes.js';
import practiceRoutes from './practiceRoutes.js';
import studentRoutes from './studentRoutes.js';
import teacherRoutes from './teacherRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/student', studentRoutes);
router.use('/api/teacher', teacherRoutes);
router.use('/students', diagnosticRoutes);
router.use('/practice', practiceRoutes);
router.use('/', contentRoutes);

export default router;
