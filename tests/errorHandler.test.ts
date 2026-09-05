import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { validate } from '../src/middlewares/validate.js';
import { NotFoundError } from '../src/utils/errors.js';
import app from '../src/app.js';

describe('Bilingual Error Handling Middleware', () => {
  it('should return bilingual 404 error on unknown route', async () => {
    const res = await request(app).get('/route-that-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message_ms).toContain('tidak dijumpai');
    expect(res.body.error.message_en).toContain('was not found');
  });

  it('should return bilingual 400 validation error with field-level details', async () => {
    const testApp = express();
    testApp.use(express.json());

    const testSchema = z.object({
      body: z.object({
        email: z.string({ required_error: 'email is required' }).email(),
        grade: z.number(),
      }),
    });

    testApp.post('/test-validate', validate(testSchema), (_req: Request, res: Response) => {
      res.json({ success: true });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/test-validate')
      .send({ email: 'not-an-email' }); // missing grade, invalid email

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message_ms).toBeDefined();
    expect(res.body.error.message_en).toBeDefined();
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);

    const gradeIssue = res.body.error.details.find((d: any) => d.field === 'body.grade');
    expect(gradeIssue).toBeDefined();
    expect(gradeIssue.message_ms).toContain('diperlukan');
    expect(gradeIssue.message_en).toContain('required');
  });

  it('should return bilingual 500 error on uncaught server exceptions', async () => {
    const testApp = express();
    testApp.get('/crash', () => {
      throw new Error('Database suddenly exploded');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/crash');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.error.message_ms).toContain('Ralat dalaman pelayan');
    expect(res.body.error.message_en).toContain('Internal server error');
  });
});
