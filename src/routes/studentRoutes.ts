import { Router } from 'express';
import {
  getDashboard,
  getLearning,
  getPracticeQuestion,
  submitAnswer,
  processPracticeResult,
  endPracticeSession,
  getInsights,
  getReport,
  getProfile,
  updateProfile,
  startDiagnostic,
  submitDiagnosticAnswer,
  getDiagnosticQuestions,
  getDiagnosticStatus,
  generateAdaptiveQuestion,
  generateSyllabusQuestion,
  resetDemoProgress
} from '../controllers/studentController.js';
import { optionalAuthenticate } from '../middlewares/auth.js';

const router = Router();
router.use(optionalAuthenticate);

router.get('/dashboard', getDashboard);
router.get('/learning', getLearning);
router.get('/practice/questions', getPracticeQuestion);
router.post('/practice/generate-adaptive-question', generateAdaptiveQuestion);
router.post('/practice/generate-syllabus-question', generateSyllabusQuestion);
router.post('/practice/answer', submitAnswer);
router.post('/practice/process-result', processPracticeResult);
router.post('/practice/end', endPracticeSession);
router.get('/insights', getInsights);
router.get('/report', getReport);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/reset-demo', resetDemoProgress);

// Diagnostic quick check routes
router.post('/diagnostic/start', startDiagnostic);
router.post('/diagnostic/answer', submitDiagnosticAnswer);
router.get('/diagnostic/questions', getDiagnosticQuestions);
router.get('/diagnostic/status', getDiagnosticStatus);

export default router;
