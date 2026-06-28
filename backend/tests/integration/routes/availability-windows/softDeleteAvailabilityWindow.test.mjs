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
  expectInvalidTokenResponse,
  expectForbiddenResponse,
  expectValidationErrorResponse,
  expectAvailabilityWindowNotFoundResponse,
  expectResourceDeletedResponse,
  expectNoDetailsErrorResponse,
} from '../../../helpers/assertions.mjs';
import {
  softDeleteTestResource,
  softDeleteTestUser,
} from '../../../helpers/updateTestData.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/availability-windows', () => {
  describe('DELETE /:availabilityWindowId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when owner soft deletes availability window', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
        });

        const response = await request(app)
          .delete(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            availabilityWindowId: availabilityWindow.id,
            reservationsCancelled: 0,
          },
        });
      });

      test('returns 200 when admin soft deletes another user availability window', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const availabilityWindow = await createTestAvailabilityWindow();

        const response = await request(app)
          .delete(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.availabilityWindowId).toBe(
          availabilityWindow.id,
        );
      });

      test('returns 200 when employee soft deletes their own availability window', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
        });

        const response = await request(app)
          .delete(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.availabilityWindowId).toBe(
          availabilityWindow.id,
        );
      });

      describe('side effects', () => {
        test('deletes allowed durations for the soft deleted availability window', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            allowedDurations: [30, 60],
          });

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(200);
          expect(response.body.data.availabilityWindowId).toBe(
            availabilityWindow.id,
          );

          const durations = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM availability_window_allowed_durations
              WHERE availability_window_id = $1
            `,
            [availabilityWindow.id],
          );

          expect(durations.rows[0].count).toBe(0);
        });

        test('cancels upcoming reservations and not ongoing reservations', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const bookingUser = await createTestUser();

          const resource = await createTestResource({ owner: user });

          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const upcomingReservation = await createTestReservation({
            user: bookingUser,
            resource,
            availabilityWindow,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T09:30:00.000Z',
          });

          const ongoingReservation = await createTestReservation({
            user: bookingUser,
            resource,
            availabilityWindow,
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T09:00:00.000Z',
          });

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(200);
          expect(response.body.data.availabilityWindowId).toBe(
            availabilityWindow.id,
          );
          expect(response.body.data.reservationsCancelled).toBe(1);

          const cancelledReservations = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM reservations
              WHERE id = $1
                AND status = 'cancelled'
                AND cancelled_at IS NOT NULL
            `,
            [upcomingReservation.id],
          );

          expect(cancelledReservations.rows[0].count).toBe(1);

          const activeReservations = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM reservations
              WHERE id = $1
                AND status = 'active'
            `,
            [ongoingReservation.id],
          );

          expect(activeReservations.rows[0].count).toBe(1);
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app).delete(
            `/api/availability-windows/${availabilityWindow.id}`,
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
          });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the parent resource and is not an admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });

        test('when employee does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 AVAILABILITY_WINDOW_NOT_FOUND with correct response', () => {
        test('when availability window does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .delete('/api/availability-windows/999999')
            .set('Authorization', `Bearer ${accessToken}`);

          expectAvailabilityWindowNotFoundResponse({ response });
        });

        test('when availability window is already soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            deleted: true,
          });

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectAvailabilityWindowNotFoundResponse({ response });
        });
      });

      describe('returns 409 RESOURCE_DELETED with correct response', () => {
        test('when parent resource is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ owner: user });
          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
          });

          const deletedResource = await softDeleteTestResource(resource.id);

          expect(deletedResource.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectResourceDeletedResponse({
            response,
            message: 'Resource has been deleted.',
          });
        });
      });

      describe('returns 409 AVAILABILITY_WINDOW_EXPIRED with correct response', () => {
        test('when availability window is expired', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            expired: true,
          });

          const response = await request(app)
            .delete(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'AVAILABILITY_WINDOW_EXPIRED',
            message: 'Cannot delete an expired availability window.',
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for availability window id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .delete('/api/availability-windows/not-a-number')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window id parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be a number.',
          });
        });
      });
    });
  });
});
