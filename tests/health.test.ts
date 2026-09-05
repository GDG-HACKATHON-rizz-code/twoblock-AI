import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /health', () => {
  it('should return 200 with standard success wrapper and database connected', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toMatchObject({
      status: 'ok',
      db: 'connected',
    });
    expect(response.body.data).toHaveProperty('timestamp');
  });
});
