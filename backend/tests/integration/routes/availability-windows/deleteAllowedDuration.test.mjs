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
  expectResourceInactiveResponse,
  expectNotAFutureAvailabilityWindowResponse,
  expectNoDetailsErrorResponse,
} from '../../../helpers/assertions.mjs';
import {
  deactivateTestResource,
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
  describe('DELETE /:availabilityWindowId/allowed-durations/:allowedDurationId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when owner deletes allowed duration', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          allowedDurations: [30, 60],
        });

        const durationToDelete = availabilityWindow.allowed_durations[0];

        const response = await request(app)
          .delete(
            `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
          )
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            allowedDurationId: durationToDelete.id,
            reservationsCancelled: 0,
          },
        });

        // Proves that it is deleted.
        const allowedDurationsInDb = await db.query(
          `
            SELECT duration_minutes
            FROM availability_window_allowed_durations
            WHERE availability_window_id = $1
          `,
          [availabilityWindow.id],
        );

        expect(allowedDurationsInDb.rows).toEqual([{ duration_minutes: 60 }]);
      });

      test('returns 200 when employee deletes allowed duration for their own availability window', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          allowedDurations: [30, 60],
        });

        const durationToDelete = availabilityWindow.allowed_durations[0];

        const response = await request(app)
          .delete(
            `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
          )
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.allowedDurationId).toBe(durationToDelete.id);
      });

      test('returns 200 when admin deletes allowed duration for their own availability window', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          allowedDurations: [30, 60],
        });

        const durationToDelete = availabilityWindow.allowed_durations[0];

        const response = await request(app)
          .delete(
            `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
          )
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.allowedDurationId).toBe(durationToDelete.id);
      });

      describe('side effects', () => {
        test('cancels future reservations that no longer fit remaining allowed durations', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const bookingUser = await createTestUser();

          const resource = await createTestResource({ owner: user });

          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            allowedDurations: [30, 60],
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const durationToDelete = availabilityWindow.allowed_durations[1];

          const reservation = await createTestReservation({
            user: bookingUser,
            resource,
            availabilityWindow,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T10:00:00.000Z',
          });

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(200);
          expect(response.body.data.reservationsCancelled).toBe(1);

          const cancelledReservation = await db.query(
            `
              SELECT COUNT(*)::int AS total
              FROM reservations
              WHERE id = $1
                AND status = 'cancelled'
                AND cancelled_at IS NOT NULL
            `,
            [reservation.id],
          );

          expect(cancelledReservation.rows[0].total).toBe(1);
        });

        test('does not cancel future reservations that still fit remaining allowed durations', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const bookingUser = await createTestUser();

          const resource = await createTestResource({ owner: user });

          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            allowedDurations: [30, 60],
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const durationToDelete = availabilityWindow.allowed_durations[1];

          const reservation = await createTestReservation({
            user: bookingUser,
            resource,
            availabilityWindow,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T09:30:00.000Z',
          });

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(200);
          expect(response.body.data.reservationsCancelled).toBe(0);

          const activeReservation = await db.query(
            `
              SELECT COUNT(*)::int AS total
              FROM reservations
              WHERE id = $1
                AND status = 'active'
            `,
            [reservation.id],
          );

          expect(activeReservation.rows[0].total).toBe(1);
        });

        test('does not cancel ongoing reservations', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const bookingUser = await createTestUser();

          const resource = await createTestResource({ owner: user });

          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            allowedDurations: [30, 60],
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const durationToDelete = availabilityWindow.allowed_durations[1];

          const reservation = await createTestReservation({
            user: bookingUser,
            resource,
            availabilityWindow,
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T10:00:00.000Z',
          });

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(200);
          expect(response.body.data.reservationsCancelled).toBe(0);

          const activeReservation = await db.query(
            `
              SELECT COUNT(*)::int AS total
              FROM reservations
              WHERE id = $1
                AND status = 'active'
            `,
            [reservation.id],
          );

          expect(activeReservation.rows[0].total).toBe(1);
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).delete(
            '/api/availability-windows/1/allowed-durations/1',
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .delete('/api/availability-windows/1/allowed-durations/1')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            allowedDurations: [30, 60],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });

        test('when employee does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const availabilityWindow = await createTestAvailabilityWindow({
            allowedDurations: [30, 60],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });

        test('when admin does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const availabilityWindow = await createTestAvailabilityWindow({
            allowedDurations: [30, 60],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 AVAILABILITY_WINDOW_NOT_FOUND with correct response', () => {
        test('when availability window does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .delete('/api/availability-windows/99999/allowed-durations/1')
            .set('Authorization', `Bearer ${accessToken}`);

          expectAvailabilityWindowNotFoundResponse({ response });
        });

        test('when availability window is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            allowedDurations: [30, 60],
            deleted: true,
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectAvailabilityWindowNotFoundResponse({ response });
        });
      });

      describe('returns 404 ALLOWED_DURATION_NOT_FOUND with correct response', () => {
        test('when allowed duration does not exist', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            allowedDurations: [30, 60],
          });

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/999999`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 404,
            code: 'ALLOWED_DURATION_NOT_FOUND',
            message: 'Allowed duration not found.',
          });
        });

        test('when allowed duration belongs to another availability window', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ owner: user });

          const [targetWindow, otherWindow] = await Promise.all([
            createTestAvailabilityWindow({
              resource,
              allowedDurations: [30, 60],
              startTime: '2036-01-01T09:00:00.000Z',
              endTime: '2036-01-01T17:00:00.000Z',
            }),
            createTestAvailabilityWindow({
              resource,
              allowedDurations: [30, 60],
              startTime: '2036-01-02T09:00:00.000Z',
              endTime: '2036-01-02T17:00:00.000Z',
            }),
          ]);

          const durationFromOtherWindow = otherWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${targetWindow.id}/allowed-durations/${durationFromOtherWindow.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 404,
            code: 'ALLOWED_DURATION_NOT_FOUND',
            message: 'Allowed duration not found.',
          });
        });
      });

      describe('returns 409 RESOURCE_DELETED with correct response', () => {
        test('when parent resource is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ owner: user });

          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            allowedDurations: [30, 60],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const deletedResource = await softDeleteTestResource(resource.id);

          expect(deletedResource.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectResourceDeletedResponse({
            response,
            message:
              'Cannot delete allowed durations for availability windows that belong to a deleted resource.',
          });
        });
      });

      describe('returns 409 RESOURCE_INACTIVE with correct response', () => {
        test('when parent resource is inactive', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ owner: user });

          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            allowedDurations: [30, 60],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const inactiveResource = await deactivateTestResource(resource.id);

          expect(inactiveResource.is_active).toBe(false);

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectResourceInactiveResponse({
            response,
            message:
              'Cannot delete allowed durations for availability windows that belong to an inactive resource.',
          });
        });
      });

      describe('returns 409 NOT_A_FUTURE_AVAILABILITY_WINDOW with correct response', () => {
        test('when availability window is expired', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            expired: true,
            allowedDurations: [30, 60],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectNotAFutureAvailabilityWindowResponse({
            response,
            message:
              'You can only delete allowed durations for future availability windows.',
          });
        });

        test('when availability window is ongoing', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
            allowedDurations: [30, 60],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectNotAFutureAvailabilityWindowResponse({
            response,
            message:
              'You can only delete allowed durations for future availability windows.',
          });
        });
      });

      describe('returns 409 CANNOT_DELETE_LAST_ALLOWED_DURATION with correct response', () => {
        test('when deleting the last allowed duration for the availability window', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            allowedDurations: [30],
          });

          const durationToDelete = availabilityWindow.allowed_durations[0];

          const response = await request(app)
            .delete(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations/${durationToDelete.id}`,
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'CANNOT_DELETE_LAST_ALLOWED_DURATION',
            message: 'Cannot delete the last allowed duration for an active availability window.',
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for availability window id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .delete(
              '/api/availability-windows/not-a-number/allowed-durations/1',
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid delete allowed duration parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be a number.',
          });
        });

        test('for allowed duration id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .delete(
              '/api/availability-windows/1/allowed-durations/not-a-number',
            )
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid delete allowed duration parameter.',
            field: 'allowedDurationId',
            detailsMessage: 'Allowed duration id must be a number.',
          });
        });

        test('for allowed duration id that is not an integer', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .delete('/api/availability-windows/1/allowed-durations/1.5')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid delete allowed duration parameter.',
            field: 'allowedDurationId',
            detailsMessage: 'Allowed duration id must be an integer.',
          });
        });

        test('for allowed duration id less than 1', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .delete('/api/availability-windows/1/allowed-durations/0')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid delete allowed duration parameter.',
            field: 'allowedDurationId',
            detailsMessage: 'Allowed duration id must be at least 1.',
          });
        });
      });
    });
  });
});
