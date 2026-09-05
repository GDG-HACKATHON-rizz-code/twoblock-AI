import { Request, Response, NextFunction } from 'express';
import { checkDatabaseConnection } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getBilingualError } from '../utils/i18n.js';

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isDbConnected = await checkDatabaseConnection();

    if (!isDbConnected) {
      const bilingualError = getBilingualError('DB_CONNECTION_ERROR');
      sendError(
        res,
        {
          code: 'DB_CONNECTION_ERROR',
          message_ms: bilingualError.message_ms,
          message_en: bilingualError.message_en,
        },
        503
      );
      return;
    }

    sendSuccess(
      res,
      {
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    next(error);
  }
}
