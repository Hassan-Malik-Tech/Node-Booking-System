import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import { createAuthenticatedTestUser } from '../../../helpers/createTestData.mjs';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  expectNoPasswordFields,
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';

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

      test('does not return password or password hash', async () => {
        const { accessToken } = await createAuthenticatedTestUser();

        const response = await request(app)
          .get('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expectNoPasswordFields(response.body.data);
      });
    });

    // extractBearerToken()
    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).get('/api/me');

          expectAuthRequiredResponse(response);
        });
      });

      // extractBearerToken()
      describe('returns 401 INVALID_AUTHORIZATION_HEADER with correct response', () => {
        test('when Authorization header format is invalid', async () => {
          const response = await request(app)
            .get('/api/me')
            .set('Authorization', 'not-a-bearer-token');

          expect(response.status).toBe(401);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'INVALID_AUTHORIZATION_HEADER',
              message: 'Invalid authorization header',
            },
          });
        });
      });

      // verifyAccessToken()
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token is invalid', async () => {
          const response = await request(app)
            .get('/api/me')
            .set('Authorization', 'Bearer invalid-token');

          expectInvalidTokenResponse(response);
        });

        // This test proves loadCurrentStateOfAuthUser blocks soft deleted users
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .get('/api/me')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });
    });
  });
});
