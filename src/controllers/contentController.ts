import { Request, Response, NextFunction } from 'express';
import { contentService } from '../services/contentService.js';
import { sendSuccess } from '../utils/response.js';
import { ContentLanguage } from '@prisma/client';

export async function getSubjects(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subjects = await contentService.getSubjects();
    sendSuccess(res, subjects, 200);
  } catch (err) {
    next(err);
  }
}

export async function getTopicsBySubject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const topics = await contentService.getTopicsBySubject(req.params.id);
    sendSuccess(res, topics, 200);
  } catch (err) {
    next(err);
  }
}

export async function getSubtopicsByTopic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subtopics = await contentService.getSubtopicsByTopic(req.params.id);
    sendSuccess(res, subtopics, 200);
  } catch (err) {
    next(err);
  }
}

export async function updateSubtopic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subtopic = await contentService.updateSubtopic(req.params.id, req.body);
    sendSuccess(res, subtopic, 200);
  } catch (err) {
    next(err);
  }
}

export async function getQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      subject_id,
      topic_id,
      subtopic_id,
      difficulty_level,
      language,
      is_diagnostic,
      is_active,
      grade_level,
    } = req.query;

    const questions = await contentService.getQuestions({
      subject_id: subject_id as string | undefined,
      topic_id: topic_id as string | undefined,
      subtopic_id: subtopic_id as string | undefined,
      difficulty_level: difficulty_level ? parseInt(difficulty_level as string, 10) : undefined,
      language: language as ContentLanguage | undefined,
      is_diagnostic: is_diagnostic !== undefined ? is_diagnostic === 'true' : undefined,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      grade_level: grade_level ? parseInt(grade_level as string, 10) : undefined,
    });

    sendSuccess(res, questions, 200);
  } catch (err) {
    next(err);
  }
}

export async function getQuestionById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const question = await contentService.getQuestionById(req.params.id);
    sendSuccess(res, question, 200);
  } catch (err) {
    next(err);
  }
}

export async function createQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const question = await contentService.createQuestion(req.body, req.user!);
    sendSuccess(res, question, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const question = await contentService.updateQuestion(req.params.id, req.body, req.user!);
    sendSuccess(res, question, 200);
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await contentService.deleteQuestion(req.params.id, req.user!);
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}
