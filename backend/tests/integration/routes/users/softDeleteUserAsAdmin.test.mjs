import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestAvailabilityWindow,
  createTestReservation,
  createTestResource,
  createTestUser,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectNoDetailsErrorResponse,
  expectValidationErrorResponse,
  expectUserDeletedByAdminResponse,
  expectUserNotFoundResponse,
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
  describe('DELETE /:userId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when admin deletes user', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const userToDelete = await createTestUser();

        const response = await request(app)
          .delete(`/api/users/${userToDelete.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            deletedUser: {
              id: userToDelete.id,
              username: userToDelete.username,
              name: userToDelete.name,
              email: userToDelete.email,
              role: 'user',
              createdAt: userToDelete.created_at.toISOString(),
              updatedAt: expect.any(String),
              deletedAt: expect.any(String),
            },
            resourcesDeleted: 0,
            availabilityWindowsDeleted: 0,
            upcomingReservationsCancelledOnDeletedUserResources: 0,
            deletedUserUpcomingReservationsCancelled: 0,
          },
        });

        const deletedUserInDb = await db.query(
          `
            SELECT
              id,
              deleted_at
            FROM users
            WHERE id = $1
          `,
          [userToDelete.id],
        );

        expect(deletedUserInDb.rows[0]).toEqual({
          id: userToDelete.id,
          deleted_at: expect.any(Date),
        });
      });

      test('returns 200 when admin deletes employee', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const employeeToDelete = await createTestUser({
          role: 'employee',
        });

        const response = await request(app)
          .delete(`/api/users/${employeeToDelete.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectUserDeletedByAdminResponse({
          response,
          user: employeeToDelete,
          role: 'employee',
        });
      });
    });

    describe('side effects', () => {
      test("soft deletes deleted user's owned resources and availability windows", async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const userToDelete = await createTestUser();

        const [r1, r2] = await Promise.all([
          createTestResource({ owner: userToDelete }),
          createTestResource({ owner: userToDelete, inactive: true }),
        ]);

        await Promise.all([
          createTestAvailabilityWindow({ resource: r1 }),
          createTestAvailabilityWindow({ resource: r1, expired: true }),
        ]);

        const response = await request(app)
          .delete(`/api/users/${userToDelete.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectUserDeletedByAdminResponse({
          response,
          user: userToDelete,
          resourcesDeleted: 2,
          availabilityWindowsDeleted: 2,
        });

        const resourcesInDb = await db.query(
          `
            SELECT
              COUNT(*)::int AS total
            FROM resources
            WHERE owner_id = $1
              AND deleted_at IS NOT NULL
              AND is_active = false
          `,
          [userToDelete.id],
        );

        expect(resourcesInDb.rows[0].total).toBe(2);

        const windowsInDb = await db.query(
          `
            SELECT
              COUNT(*)::int AS total
            FROM availability_windows
            WHERE resource_id = $1
              AND deleted_at IS NOT NULL
          `,
          [r1.id],
        );

        expect(windowsInDb.rows[0].total).toBe(2);
      });

      test("cancels deleted user's upcoming reservations", async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const userToDelete = await createTestUser();

        const [r1, r2] = await Promise.all([
          createTestReservation({ user: userToDelete }),
          createTestReservation({ user: userToDelete }),
        ]);

        expect(r1.cancelled_at).toBeNull();
        expect(r1.status).toBe('active');

        const response = await request(app)
          .delete(`/api/users/${userToDelete.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectUserDeletedByAdminResponse({
          response,
          user: userToDelete,
          deletedUserUpcomingReservationsCancelled: 2,
        });

        const reservationsInDb = await db.query(
          `
              SELECT
                COUNT(*)::int AS total
              FROM reservations
              WHERE user_id = $1
                AND id = ANY($2::int[])
                AND status = 'cancelled'
                AND cancelled_at IS NOT NULL
            `,
          [userToDelete.id, [r1.id, r2.id]],
        );

        expect(reservationsInDb.rows[0].total).toBe(2);
      });

      test("cancels upcoming reservations on deleted user's owned resources and not ongoing", async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const userToDelete = await createTestUser();

        const resource = await createTestResource({ owner: userToDelete });

        // Each reservation helper call creates its own availability window
        // on the created resource above.
        const [upcomingReservation, ongoingReservation] = await Promise.all([
          createTestReservation({
            resource,
          }),
          createTestReservation({
            resource,
            ongoing: true,
          }),
        ]);

        const response = await request(app)
          .delete(`/api/users/${userToDelete.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectUserDeletedByAdminResponse({
          response,
          user: userToDelete,
          resourcesDeleted: 1,
          availabilityWindowsDeleted: 2,
          upcomingReservationsCancelledOnDeletedUserResources: 1,
        });

        const cancelledReservationInDb = await db.query(
          `
            SELECT
              COUNT(*)::int AS total
            FROM reservations
            WHERE resource_id = $1
              AND id = $2
              AND status = 'cancelled'
              AND cancelled_at IS NOT NULL
          `,
          [resource.id, upcomingReservation.id],
        );

        expect(cancelledReservationInDb.rows[0].total).toBe(1);

        const ongoingReservationInDb = await db.query(
          `
            SELECT
              COUNT(*)::int AS total
            FROM reservations
            WHERE resource_id = $1
              AND id = $2
              AND status = 'active'
              AND start_time <= NOW()
              AND end_time > NOW()
          `,
          [resource.id, ongoingReservation.id],
        );

        expect(ongoingReservationInDb.rows[0].total).toBe(1);
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through usersRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const userToDelete = await createTestUser();

          const response = await request(app).delete(
            `/api/users/${userToDelete.id}`,
          );

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

          const userToDelete = await createTestUser();

          const response = await request(app)
            .delete(`/api/users/${userToDelete.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const userToDelete = await createTestUser();

          const response = await request(app)
            .delete(`/api/users/${userToDelete.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });

        test('when admin tries to delete own account through this route', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .delete(`/api/users/${user.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response, {
            message: 'You cannot delete your own account through this route.',
          });
        });

        test('when admin tries to delete another admin account', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const adminToDelete = await createTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .delete(`/api/users/${adminToDelete.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 403,
            code: 'ADMIN_DELETION_NOT_ALLOWED',
            message: 'Admin accounts cannot be deleted through this route.',
          });
        });
      });

      describe('returns 404 USER_NOT_FOUND with correct response', () => {
        test('when user does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .delete('/api/users/999999')
            .set('Authorization', `Bearer ${accessToken}`);

          expectUserNotFoundResponse({ response });
        });
      });

      describe('returns 409 USER_ALREADY_DELETED with correct response', () => {
        test('when user is already deleted', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const userToDelete = await createTestUser();

          const deletedUser = await softDeleteTestUser(userToDelete.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .delete(`/api/users/${userToDelete.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USER_ALREADY_DELETED',
            message: 'User account is already deleted.',
          });
        });
      });

      describe('returns 409 USER_HAS_ONGOING_RESERVATION with correct response', () => {
        test('when user has an ongoing reservation', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const userToDelete = await createTestUser();

          await createTestReservation({
            user: userToDelete,
            ongoing: true,
          });

          const response = await request(app)
            .delete(`/api/users/${userToDelete.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USER_HAS_ONGOING_RESERVATION',
            message:
              'Cannot delete user while they have an ongoing reservation.',
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for user id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .delete('/api/users/not-a-number')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user id parameter.',
            field: 'userId',
            detailsMessage: 'User id must be a number.',
          });
        });

        test('for user id that is not an integer', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .delete('/api/users/1.5')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user id parameter.',
            field: 'userId',
            detailsMessage: 'User id must be an integer.',
          });
        });

        test('for user id less than 1', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .delete('/api/users/0')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user id parameter.',
            field: 'userId',
            detailsMessage: 'User id must be at least 1.',
          });
        });
      });
    });
  });
});
