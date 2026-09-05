import { getBilingualError } from './i18n.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly message_ms: string;
  public readonly message_en: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    code: string,
    statusCode: number = 400,
    params?: Record<string, string | number>,
    details?: unknown
  ) {
    const bilingual = getBilingualError(code, params);
    super(bilingual.message_en);

    this.code = code;
    this.statusCode = statusCode;
    this.message_ms = bilingual.message_ms;
    this.message_en = bilingual.message_en;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(path: string = '') {
    super('NOT_FOUND', 404, { path });
  }
}

export class ValidationError extends AppError {
  constructor(details?: unknown) {
    super('VALIDATION_ERROR', 400, undefined, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super('FORBIDDEN', 403);
  }
}

export class InternalServerError extends AppError {
  constructor(details?: unknown) {
    super('INTERNAL_SERVER_ERROR', 500, undefined, details);
  }
}
