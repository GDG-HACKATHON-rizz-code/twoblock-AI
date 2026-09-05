import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import contentRoutes from './contentRoutes.js';
import diagnosticRoutes from './diagnosticRoutes.js';
import practiceRoutes from './practiceRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/students', diagnosticRoutes);
router.use('/practice', practiceRoutes);
router.use('/', contentRoutes);

export default router;
