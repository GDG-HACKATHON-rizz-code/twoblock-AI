import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import routes from './routes/index.js';
import { NotFoundError } from './utils/errors.js';
import { errorHandler } from './middlewares/errorHandler.js';

export function createApp(): Express {
  const app: Express = express();
  const publicDir = path.resolve(process.cwd(), 'public');

  // Security & Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(publicDir));

  // Serve root index.html
  app.get(['/', '/index.html'], (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // Routes
  app.use('/', routes);

  // 404 Handler for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(req.originalUrl));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
