import { Router } from 'express';
import {
  getDashboard,
  getStudents,
  getStudentDetail,
  getInsights,
  createIntervention,
  getInterventions,
  getReport,
  getProfile,
  updateProfile
} from '../controllers/teacherController.js';

import { optionalAuthenticate } from '../middlewares/auth.js';

const router = Router();
router.use(optionalAuthenticate);

router.get('/dashboard', getDashboard);
router.get('/students', getStudents);
router.get('/students/:nameOrId', getStudentDetail);
router.get('/insights', getInsights);
router.post('/interventions', createIntervention);
router.get('/interventions', getInterventions);
router.get('/report', getReport);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;
