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

describe('/api/users', () => {
  describe('PATCH /:userId/role', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when admin updates user role to employee', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const targetUser = await createTestUser();

        expect(targetUser.role).toBe('user');

        const response = await request(app)
          .patch(`/api/users/${targetUser.id}/role`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            newRole: 'employee',
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: targetUser.id,
            username: targetUser.username,
            name: targetUser.name,
            email: targetUser.email,
            role: 'employee',
            createdAt: targetUser.created_at.toISOString(),
            updatedAt: expect.any(String),
            deletedAt: null,
          },
        });

        const updatedUserInDb = await db.query(
          `
            SELECT
              id,
              role
            FROM users
            WHERE id = $1
              AND deleted_at IS NULL
          `,
          [targetUser.id],
        );

        expect(updatedUserInDb.rows[0]).toEqual({
          id: targetUser.id,
          role: 'employee',
        });
      });

      test('returns 200 when admin updates employee role to user', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const targetUser = await createTestUser({
          role: 'employee',
        });

        expect(targetUser.role).toBe('employee');

        const response = await request(app)
          .patch(`/api/users/${targetUser.id}/role`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            newRole: 'user',
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            id: targetUser.id,
            role: 'user',
          }),
        );

        const updatedUserInDb = await db.query(
          `
            SELECT
              id,
              role
            FROM users
            WHERE id = $1
              AND deleted_at IS NULL
          `,
          [targetUser.id],
        );

        expect(updatedUserInDb.rows[0]).toEqual({
          id: targetUser.id,
          role: 'user',
        });
      });

      test('normalizes newRole to lowercase', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const targetUser = await createTestUser();

        const response = await request(app)
          .patch(`/api/users/${targetUser.id}/role`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            newRole: 'Employee',
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            id: targetUser.id,
            role: 'employee',
          }),
        );
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through usersRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}/role`)
            .send({
              newRole: 'employee',
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
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
            });

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
            });

          expectForbiddenResponse(response);
        });

        test('when admin tries to update own role', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .patch(`/api/users/${user.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
            });

          expectForbiddenResponse(response, {
            message: 'You cannot update your own role.',
          });
        });

        test("when admin tries to update another admin's role", async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const targetAdmin = await createTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .patch(`/api/users/${targetAdmin.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
            });

          expectNoDetailsErrorResponse({
            response,
            status: 403,
            code: 'ADMIN_ROLE_UPDATE_NOT_ALLOWED',
            message: 'You cannot update the role of an admin.',
          });
        });
      });

      describe('returns 404 USER_NOT_FOUND with correct response', () => {
        test('when user does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .patch('/api/users/999999/role')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
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
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USER_ALREADY_DELETED',
            message: 'You cannot update the role of a deleted user.',
          });
        });
      });

      describe('returns 409 USER_ROLE_ALREADY_SET with correct response', () => {
        test('when target user already has requested role', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const targetUser = await createTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USER_ROLE_ALREADY_SET',
            message: 'User already has this role.',
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
            .patch('/api/users/not-a-number/role')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
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
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user role update request.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for missing newRole', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user role update request.',
            field: 'newRole',
            detailsMessage: 'New role is required.',
          });
        });

        test('for unsupported newRole', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'admin',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user role update request.',
            field: 'newRole',
            detailsMessage: 'New role must be either user or employee.',
          });
        });

        test('for unknown body field', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const targetUser = await createTestUser();

          const response = await request(app)
            .patch(`/api/users/${targetUser.id}/role`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              newRole: 'employee',
              unknown: true,
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user role update request.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
