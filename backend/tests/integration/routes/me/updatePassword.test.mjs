import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import { TEST_PASSWORD } from '../../../helpers/testConstants.mjs';
import { createAuthenticatedTestUser } from '../../../helpers/createTestData.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
  expectInvalidCredentialsResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
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

const NEW_PASSWORD = 'NewBookingTestPassword';

describe('/api/me', () => {
  describe('PATCH /password', () => {
    describe('happy path', () => {
      test('new password works after password update', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const updateResponse = await request(app)
          .patch('/api/me/password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ password: NEW_PASSWORD });

        expect(updateResponse.status).toBe(204);
        expect(updateResponse.text).toBe('');

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: NEW_PASSWORD });

        expect(loginResponse.status).toBe(200);
      });

      test('old password no longer works after password update', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const updateResponse = await request(app)
          .patch('/api/me/password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ password: NEW_PASSWORD });

        expect(updateResponse.status).toBe(204);
        expect(updateResponse.text).toBe('');

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: TEST_PASSWORD });

        expectInvalidCredentialsResponse(loginResponse);
      });

      test('old access token is revoked after password update', async () => {
        const { accessToken } = await createAuthenticatedTestUser();

        const updateResponse = await request(app)
          .patch('/api/me/password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ password: NEW_PASSWORD });

        expect(updateResponse.status).toBe(204);
        expect(updateResponse.text).toBe('');

        const getResponse = await request(app)
          .get('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expectInvalidTokenResponse(getResponse);
      });
    });

    describe('unhappy path', () => {
      // GET /api/me has the full auth middleware matrix.
      // This route keeps one requireAuth smoke test and one loadCurrentStateOfAuthUser smoke test.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).patch('/api/me/password').send({
            password: NEW_PASSWORD,
          });

          expectAuthRequiredResponse(response);
        });
      });

      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch('/api/me/password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              password: NEW_PASSWORD,
            });

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for missing password', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me/password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid password update request body.',
            field: 'password',
            detailsMessage: 'Password is required.',
          });
        });

        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me/password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid password update request body.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for password that exceeds bcrypt max bytes', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me/password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'a'.repeat(73) });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid password update request body.',
            field: 'password',
            detailsMessage: 'Password must be 72 bytes or fewer.',
          });
        });
      });
    });
  });
});
