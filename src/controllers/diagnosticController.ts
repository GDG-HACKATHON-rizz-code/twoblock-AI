import { Request, Response, NextFunction } from 'express';
import { diagnosticService } from '../services/diagnosticService.js';
import { sendSuccess } from '../utils/response.js';

export async function getDiagnosticAssessment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const subjectId = req.query.subject_id as string | undefined;

    const assessment = await diagnosticService.getDiagnosticAssessment(studentId, subjectId);
    sendSuccess(res, assessment, 200);
  } catch (err) {
    next(err);
  }
}

export async function submitDiagnostic(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const result = await diagnosticService.submitDiagnostic(studentId, req.body);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}

export async function getLearningSnapshot(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const subjectId = req.query.subject_id as string | undefined;

    const snapshot = await diagnosticService.getLearningSnapshot(studentId, subjectId);
    sendSuccess(res, snapshot, 200);
  } catch (err) {
    next(err);
  }
}
