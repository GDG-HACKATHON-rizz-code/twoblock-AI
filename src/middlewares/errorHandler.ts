import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { getBilingualError, getBilingualText } from '../utils/i18n.js';
import { sendError } from '../utils/response.js';

export function errorHandler(
  err: Error | AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // 1. Handled AppError (Custom Application Error)
  if (err instanceof AppError) {
    return sendError(
      res,
      {
        code: err.code,
        message_ms: err.message_ms,
        message_en: err.message_en,
        details: err.details,
      },
      err.statusCode
    );
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const bilingualBase = getBilingualError('VALIDATION_ERROR');
    const formattedIssues = err.issues.map((issue) => {
      const fieldPath = issue.path.join('.');
      let issueMs = issue.message;
      let issueEn = issue.message;

      if (issue.code === 'invalid_type' && issue.received === 'undefined') {
        const requiredMsg = getBilingualText('validation.required', { field: fieldPath });
        issueMs = requiredMsg.message_ms;
        issueEn = requiredMsg.message_en;
      }

      return {
        field: fieldPath,
        code: issue.code,
        message_ms: issueMs,
        message_en: issueEn,
      };
    });

    return sendError(
      res,
      {
        code: 'VALIDATION_ERROR',
        message_ms: bilingualBase.message_ms,
        message_en: bilingualBase.message_en,
        details: formattedIssues,
      },
      400
    );
  }

  // 3. Fallback / Uncaught Internal Server Errors (500)
  const defaultBilingual = getBilingualError('INTERNAL_SERVER_ERROR');
  return sendError(
    res,
    {
      code: 'INTERNAL_SERVER_ERROR',
      message_ms: defaultBilingual.message_ms,
      message_en: defaultBilingual.message_en,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
}
