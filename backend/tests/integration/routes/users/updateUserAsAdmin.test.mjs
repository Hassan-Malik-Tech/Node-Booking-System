import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import { generateRandomUsername } from '../../../helpers/generateRandomData.mjs';
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
  expectNoDetailsErrorResponse,
  expectUserNotFoundResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

const UPDATED_NAME = 'updated name';

describe('/api/users', () => {
  describe('PATCH /:userId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when admin updates user', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const targetUser = await createTestUser();
        const updatedUsername = generateRandomUsername();

        const response = await request(app)
          .patch(`/api/users/${targetUser.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            username: updatedUsername,
            name: UPDATED_NAME,
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: targetUser.id,
            username: updatedUsername,
            name: UPDATED_NAME,
            email: targetUser.email,
            role: 'user',
            createdAt: targetUser.created_at.toISOString(),
            updatedAt: expect.any(String),
            deletedAt: null,
          },
        });

        const updatedUserInDb = await db.query(
          `
            SELECT
              id,
              username,
              name,
              email,
              role,
              deleted_at
            FROM users
            WHERE id = $1
          `,
          [targetUser.id],
        );

        expect(updatedUserInDb.rows[0]).toEqual({
          id: targetUser.id,
          username: updatedUsername,
          name: UPDATED_NAME,
          email: targetUser.email,
          role: 'user',
          deleted_at: null,
        });
      });

      test('returns 200 when admin updates employee', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const targetEmployee = await createTestUser({
          role: 'employee',
        });
        const updatedUsername = generateRandomUsername();

        const response = await request(app)
          .patch(`/api/users/${targetEmployee.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            username: updatedUsername,
            name: UPDATED_NAME,
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            id: targetEmployee.id,
            username: updatedUsername,
            name: UPDATED_NAME,
            email: targetEmployee.email,
            role: 'employee',
            deletedAt: null,
          }),
        );
      });

      test('returns 200 with name updated to null', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const targetUser = await createTestUser({
          name: 'target user name',
        });

        const response = await request(app)
          .patch(`/api/users/${targetUser.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: null,
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            id: targetUser.id,
            username: targetUser.username,
            name: null,
            email: targetUser.email,
            role: targetUser.role,
            deletedAt: null,
          }),
        );

        const updatedUserInDb = await db.query(
          `
            SELECT
              id,
              name
            FROM users
            WHERE id = $1
          `,
          [targetUser.id],
        );

        expect(updatedUserInDb.rows[0]).toEqual({
          id: targetUser.id,
          name: null,
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through usersRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .send({
              name: UPDATED_NAME,
            });

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place through usersRouter.use.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          // Keep another active admin so the last-admin trigger does not block
          // soft-deleting the authenticated admin directly in test setup.
          await createTestUser({ role: 'admin' });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectForbiddenResponse(response);
        });

        test('when admin tries to update own account through this route', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .patch(`/api/users/${user.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectForbiddenResponse(response, {
            message: 'You cannot update your own account through this route.',
          });
        });

        test('when admin tries to update another admin account', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const targetAdmin = await createTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .patch(`/api/users/${targetAdmin.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 403,
            code: 'ADMIN_UPDATE_NOT_ALLOWED',
            message: 'Admin accounts cannot be updated through this route.',
          });
        });
      });

      describe('returns 404 USER_NOT_FOUND with correct response', () => {
        test('when user does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .patch('/api/users/999999')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectUserNotFoundResponse({ response });
        });
      });

      describe('returns 409 USER_ALREADY_DELETED with correct response', () => {
        test('when user is already deleted', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const deletedUser = await softDeleteTestUser(targetUser.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USER_ALREADY_DELETED',
            message: 'You cannot update a deleted user.',
          });
        });
      });

      describe('returns 409 USERNAME_ALREADY_EXISTS with correct response', () => {
        test('when username already exists', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();
          const { username: takenUsername } = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              username: takenUsername,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USERNAME_ALREADY_EXISTS',
            message: 'Username is already in use.',
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        // Light test since the params schema is already tested elsewhere.
        test('for user id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .patch('/api/users/not-a-number')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user id parameter.',
            field: 'userId',
            detailsMessage: 'User id must be a number.',
          });
        });

        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user update request.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for empty request body', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user update request.',
            field: 'body',
            detailsMessage: 'At least one user field is required.',
          });
        });

        test('for invalid username', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              username: 'a',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user update request.',
            field: 'username',
            detailsMessage: 'Username must be at least 3 characters.',
          });
        });

        test('for empty name', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: '',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user update request.',
            field: 'name',
            detailsMessage: 'Name cannot be empty.',
          });
        });

        test('for email field', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              email: 'updated@example.com',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user update request.',
            field: 'email',
            detailsMessage: '"email" is not allowed',
          });
        });

        test('for unknown body field', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
              unknown: true,
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user update request.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
