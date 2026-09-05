import { Request, Response, NextFunction } from 'express';
import { checkDatabaseConnection } from '../config/db.js';
import { sendSuccess } from '../utils/response.js';
import { dataStore } from '../services/dataStore.js';

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isDbConnected = await checkDatabaseConnection();

    sendSuccess(
      res,
      {
        status: 'ok',
        db: isDbConnected ? 'connected' : (dataStore.data.users.length > 0 ? 'connected' : 'local_store'),
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (error) {
    next(error);
  }
}
