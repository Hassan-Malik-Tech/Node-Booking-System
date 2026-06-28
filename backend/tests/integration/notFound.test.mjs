import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';

describe('not found middleware', () => {
  test('returns 404 with correct response for unknown api route', async () => {
    const response = await request(app).get('/api/not-a-real-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    });
  });

  test('returns 404 with correct response for unknown non-api route', async () => {
    const response = await request(app).get('/not-a-real-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    });
  });
});
