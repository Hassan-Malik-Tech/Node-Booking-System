import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestUser,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectUserNotFoundResponse,
  expectValidationErrorResponse,
  expectGetUserByIdForStaffResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/users', () => {
  describe('GET /:userId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when employee gets user by id', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });
        const targetUser = await createTestUser();

        const response = await request(app)
          .get(`/api/users/${targetUser.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: targetUser.id,
            username: targetUser.username,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
            createdAt: targetUser.created_at.toISOString(),
            updatedAt: targetUser.updated_at.toISOString(),
            deletedAt: null,
          },
        });
      });

      test('returns 200 when admin gets user by id', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const targetUser = await createTestUser();

        const response = await request(app)
          .get(`/api/users/${targetUser.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectGetUserByIdForStaffResponse({
          response,
          user: targetUser,
        });
      });

      test('returns 200 for deleted user', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });
        const toBeDeletedUser = await createTestUser();

        const deletedUser = await softDeleteTestUser(toBeDeletedUser.id);

        const response = await request(app)
          .get(`/api/users/${deletedUser.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectGetUserByIdForStaffResponse({
          response,
          user: deletedUser,
          deletedAt: deletedUser.deleted_at.toISOString(),
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through usersRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const targetUser = await createTestUser();

          const response = await request(app).get(
            `/api/users/${targetUser.id}`,
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place through usersRouter.use.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });
          const targetUser = await createTestUser();

          await softDeleteTestUser(user.id);

          const response = await request(app)
            .get(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'user',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .get(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 USER_NOT_FOUND with correct response', () => {
        test('when user does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/users/999999')
            .set('Authorization', `Bearer ${accessToken}`);

          expectUserNotFoundResponse({ response });
        });
      });

      // Uses the already tested shared userIdParamsSchema, so I don't need full testing.
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for user id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/users/not-a-number')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user id parameter.',
            field: 'userId',
            detailsMessage: 'User id must be a number.',
          });
        });
      });
    });
  });
});
