import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import { buildRegisterRequestBody } from '../../../helpers/postRequestBodies.mjs';
import {
  createTestUser,
  createAuthenticatedTestUser,
} from '../../../helpers/createTestData.mjs';
import { TEST_PASSWORD } from '../../../helpers/testConstants.mjs';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/me', () => {
  describe('GET /', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape for authenticated user', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const {
          username: testUsername,
          name: testName,
          email: testEmail,
        } = user;

        const getResponse = await request(app)
          .get('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body).toEqual({
          success: true,
          data: {
            id: expect.any(Number),
            username: testUsername,
            name: testName,
            email: testEmail,
            role: 'user',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        });
      });

      test('does not return password or password hash', async () => {});

      test('uses current user role from database state', async () => {});
    });

    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {});
      });

      describe('returns 401 INVALID_AUTHORIZATION_HEADER with correct response', () => {
        test('when Authorization header format is invalid', async () => {});
      });

      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token is invalid or expired', async () => {});

        test('when token user no longer exists or is soft deleted', async () => {});
      });
    });
  });
});
