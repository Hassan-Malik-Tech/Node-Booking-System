import { afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';
import { closeTestDbPool } from '../helpers/rebuildTestDb.mjs';

afterAll(async () => {
  await closeTestDbPool();
});

describe('/health', () => {
  describe('GET /', () => {
    test('returns 200 with correct response', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
      });
    });
  });
});
