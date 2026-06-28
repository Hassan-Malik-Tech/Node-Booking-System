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
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
  expectNoDetailsErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/me', () => {
  describe('DELETE /', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when authenticated user deletes own account', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        expect(user.deleted_at).toBeNull();

        const response = await request(app)
          .delete('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            userId: user.id,
            deletedAt: expect.any(String),
            resourcesDeleted: 0,
            availabilityWindowsDeleted: 0,
            upcomingReservationsCancelledOnOwnedResources: 0,
            ownUpcomingReservationsCancelled: 0,
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
          [user.id],
        );

        expect(deletedUserInDb.rows[0]).toEqual({
          id: user.id,
          deleted_at: expect.any(Date),
        });
      });
    });

    describe('side effects', () => {
      test('soft deletes owned resources and their availability windows', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [r1, r2] = await Promise.all([
          createTestResource({ owner: user }),
          createTestResource({ owner: user }),
        ]);

        expect(r1.deleted_at).toBeNull();

        const [w1] = await Promise.all([
          createTestAvailabilityWindow({ resource: r1 }),
          createTestAvailabilityWindow({ resource: r2 }),
        ]);

        expect(w1.deleted_at).toBeNull();

        const response = await request(app)
          .delete('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.resourcesDeleted).toBe(2);
        expect(response.body.data.availabilityWindowsDeleted).toBe(2);

        const resourcesInDb = await db.query(
          `
            SELECT
              COUNT(*)::int AS total
            FROM resources
            WHERE owner_id = $1
              AND deleted_at IS NOT NULL
              AND is_active = false
          `,
          [user.id],
        );

        expect(resourcesInDb.rows[0].total).toBe(2);

        const windowsInDb = await db.query(
          `
            SELECT
              COUNT(*)::int AS total
            FROM availability_windows
            WHERE resource_id = ANY($1::int[])
              AND deleted_at IS NOT NULL
          `,
          [[r1.id, r2.id]],
        );

        expect(windowsInDb.rows[0].total).toBe(2);
      });

      test("cancels authenticated user's upcoming reservations", async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [r1, r2] = await Promise.all([
          createTestReservation({ user }),
          createTestReservation({ user }),
        ]);

        expect(r1.cancelled_at).toBeNull();
        expect(r1.status).toBe('active');

        const response = await request(app)
          .delete('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.ownUpcomingReservationsCancelled).toBe(2);

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
          [user.id, [r1.id, r2.id]],
        );

        expect(reservationsInDb.rows[0].total).toBe(2);
      });

      test("cancels upcoming reservations on authenticated user's owned resources and not ongoing", async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const resource = await createTestResource({ owner: user });
        const availabilityWindow = await createTestAvailabilityWindow({
          resource,
          startTime: '2046-01-01T09:00:00Z',
          endTime: '2046-01-01T17:00:00Z',
        });

        const [upcomingReservation, ongoingReservation] = await Promise.all([
          createTestReservation({
            availabilityWindow,
          }),
          createTestReservation({
            resource,
            ongoing: true,
          }),
        ]);

        const response = await request(app)
          .delete('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(
          response.body.data.upcomingReservationsCancelledOnOwnedResources,
        ).toBe(1);

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

      test('allows account deletion when cancellation notice passed for own reservation on owned resource', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const resource = await createTestResource({ owner: user });

        const availabilityWindow = await createTestAvailabilityWindow({
          resource,
          cancellationNoticeMinutes: 10_000_000,
        });

        const reservation = await createTestReservation({
          user,
          resource,
          availabilityWindow,
        });

        const response = await request(app)
          .delete('/api/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.ownUpcomingReservationsCancelled).toBe(1);

        const reservationInDb = await db.query(
          `
            SELECT
              status,
              cancelled_at
            FROM reservations
            WHERE id = $1
          `,
          [reservation.id],
        );

        expect(reservationInDb.rows[0]).toEqual({
          status: 'cancelled',
          cancelled_at: expect.any(Date),
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through meRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).delete('/api/me');

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place through meRouter.use.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .delete('/api/me')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is an employee', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .delete('/api/me')
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 403,
            code: 'FORBIDDEN',
            message: 'Staff accounts cannot be deleted through this route.',
          });
        });

        test('when authenticated user is an admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .delete('/api/me')
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 403,
            code: 'FORBIDDEN',
            message: 'Staff accounts cannot be deleted through this route.',
          });
        });
      });

      describe('returns 409 USER_HAS_ONGOING_RESERVATION with correct response', () => {
        test('when authenticated user has an ongoing reservation', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          await createTestReservation({
            user,
            ongoing: true,
          });

          const response = await request(app)
            .delete('/api/me')
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USER_HAS_ONGOING_RESERVATION',
            message:
              'Cannot delete your account while you have an ongoing reservation.',
          });
        });
      });

      describe('returns 409 USER_HAS_NON_CANCELLABLE_RESERVATION with correct response', () => {
        test('when authenticated user has an upcoming reservation past cancellation notice on another user resource', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            cancellationNoticeMinutes: 10_000_000,
          });

          await createTestReservation({
            user,
            availabilityWindow,
          });

          const response = await request(app)
            .delete('/api/me')
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'USER_HAS_NON_CANCELLABLE_RESERVATION',
            message:
              'Cannot delete your account while you have an upcoming reservation past its cancellation notice period.',
          });
        });
      });
    });
  });
});
