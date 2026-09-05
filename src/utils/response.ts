import { Response } from 'express';

export interface BilingualErrorPayload {
  code: string;
  message_ms: string;
  message_en: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: BilingualErrorPayload;
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): Response {
  const payload: ApiResponse<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  error: BilingualErrorPayload,
  statusCode: number = 400
): Response {
  const payload: ApiResponse = {
    success: false,
    error,
  };
  return res.status(statusCode).json(payload);
}
