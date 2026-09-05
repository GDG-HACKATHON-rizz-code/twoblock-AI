import { Request, Response, NextFunction } from 'express';
import { practiceService } from '../services/practiceService.js';
import { sendSuccess } from '../utils/response.js';

export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const { subtopic_id } = req.body;

    const result = await practiceService.createSession(studentId, subtopic_id);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function getNextQuestion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const sessionId = req.params.id;

    const result = await practiceService.getNextQuestion(studentId, sessionId);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}

export async function submitAnswer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const sessionId = req.params.id;

    const result = await practiceService.submitAnswer(studentId, sessionId, req.body);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}

export async function endSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const sessionId = req.params.id;

    const result = await practiceService.endSession(studentId, sessionId);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}

export async function getSessionSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const studentId = req.user!.id;
    const sessionId = req.params.id;

    const result = await practiceService.getSessionSummary(studentId, sessionId);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}
