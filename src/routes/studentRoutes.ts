import { Router } from 'express';
import {
  getDashboard,
  getLearning,
  getPracticeQuestion,
  submitAnswer,
  endPracticeSession,
  getInsights,
  getReport,
  getProfile,
  updateProfile,
  startDiagnostic,
  submitDiagnosticAnswer,
  getDiagnosticQuestions,
  getDiagnosticStatus
} from '../controllers/studentController.js';

const router = Router();

router.get('/dashboard', getDashboard);
router.get('/learning', getLearning);
router.get('/practice/questions', getPracticeQuestion);
router.post('/practice/answer', submitAnswer);
router.post('/practice/end', endPracticeSession);
router.get('/insights', getInsights);
router.get('/report', getReport);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Diagnostic quick check routes
router.post('/diagnostic/start', startDiagnostic);
router.post('/diagnostic/answer', submitDiagnosticAnswer);
router.get('/diagnostic/questions', getDiagnosticQuestions);
router.get('/diagnostic/status', getDiagnosticStatus);

export default router;
