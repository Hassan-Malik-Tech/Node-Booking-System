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
  expectAvailabilityWindowConflictResponse,
  expectAllowedDurationLongerThanWindowResponse,
  expectResourceDeletedResponse,
  expectResourceInactiveResponse,
  expectNotAFutureAvailabilityWindowResponse,
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
  describe('PATCH /:availabilityWindowId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when updating all allowed fields', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          allowedDurations: [60, 30],
        });

        const updatedStartTime = '2036-01-01T10:00:00.000Z';
        const updatedEndTime = '2036-01-01T12:00:00.000Z';

        const response = await request(app)
          .patch(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            startTime: updatedStartTime,
            endTime: updatedEndTime,
            cancellationNoticeMinutes: 30,
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            availabilityWindow: {
              id: availabilityWindow.id,
              resourceId: availabilityWindow.resource_id,
              startTime: updatedStartTime,
              endTime: updatedEndTime,
              cancellationNoticeMinutes: 30,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              allowedDurations: [
                { id: expect.any(Number), minutes: 30 },
                { id: expect.any(Number), minutes: 60 },
              ],
            },
            reservationsCancelled: 0,
          },
        });
      });

      test('returns 200 when updating startTime only', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          startTime: '2036-01-01T09:00:00.000Z',
          endTime: '2036-01-01T17:00:00.000Z',
        });

        const updatedStartTime = '2036-01-01T10:00:00.000Z';

        const response = await request(app)
          .patch(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            startTime: updatedStartTime,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.availabilityWindow.id).toBe(
          availabilityWindow.id,
        );
        expect(response.body.data.availabilityWindow.startTime).toBe(
          updatedStartTime,
        );
        expect(response.body.data.availabilityWindow.endTime).toBe(
          availabilityWindow.end_time.toISOString(),
        );
      });

      test('returns 200 when updating endTime only', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          startTime: '2036-01-01T09:00:00.000Z',
          endTime: '2036-01-01T17:00:00.000Z',
        });

        const updatedEndTime = '2036-01-01T12:00:00.000Z';

        const response = await request(app)
          .patch(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            endTime: updatedEndTime,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.availabilityWindow.id).toBe(
          availabilityWindow.id,
        );
        expect(response.body.data.availabilityWindow.startTime).toBe(
          availabilityWindow.start_time.toISOString(),
        );
        expect(response.body.data.availabilityWindow.endTime).toBe(
          updatedEndTime,
        );
      });

      describe('side effects', () => {
        test('cancels future out-of-bounds reservations but keeps valid future and ongoing reservations', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const bookingUser = await createTestUser();

          const resource = await createTestResource({ owner: user });

          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const futureReservationBeforeUpdatedBounds =
            await createTestReservation({
              user: bookingUser,
              resource,
              availabilityWindow,
              startTime: '2036-01-01T09:30:00.000Z',
              endTime: '2036-01-01T10:00:00.000Z',
            });

          const futureReservationInsideUpdatedBounds =
            await createTestReservation({
              user: bookingUser,
              resource,
              availabilityWindow,
              startTime: '2036-01-01T10:00:00.000Z',
              endTime: '2036-01-01T10:30:00.000Z',
            });

          const futureReservationAfterUpdatedBounds =
            await createTestReservation({
              user: bookingUser,
              resource,
              availabilityWindow,
              startTime: '2036-01-01T16:30:00.000Z',
              endTime: '2036-01-01T17:00:00.000Z',
            });

          const ongoingReservation = await createTestReservation({
            user: bookingUser,
            resource,
            availabilityWindow,
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T09:00:00.000Z',
          });

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              startTime: '2036-01-01T10:00:00.000Z',
              endTime: '2036-01-01T16:00:00.000Z',
            });

          expect(response.status).toBe(200);
          expect(response.body.data.availabilityWindow.id).toBe(
            availabilityWindow.id,
          );
          expect(response.body.data.reservationsCancelled).toBe(2);

          // To prove the db state changed and is accurate.
          // ANY($1) expects an array as the parameter.
          // ::int[] means an array of integers.
          //
          // This proves not only the count, but also
          // that the correct reservations were cancelled.
          const cancelledReservations = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM reservations
              WHERE id = ANY($1::int[])
                AND status = 'cancelled'
                AND cancelled_at IS NOT NULL
            `,
            [
              [
                futureReservationBeforeUpdatedBounds.id,
                futureReservationAfterUpdatedBounds.id,
              ],
            ],
          );

          expect(cancelledReservations.rows[0].count).toBe(2);

          const activeReservations = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM reservations
              WHERE id = ANY($1::int[])
                AND status = 'active'
                AND cancelled_at IS NULL
            `,
            [[futureReservationInsideUpdatedBounds.id, ongoingReservation.id]],
          );

          expect(activeReservations.rows[0].count).toBe(2);
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

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
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 AVAILABILITY_WINDOW_NOT_FOUND with correct response', () => {
        test('when availability window does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/999999')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectAvailabilityWindowNotFoundResponse(response);
        });

        test('when availability window is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            deleted: true,
          });

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectAvailabilityWindowNotFoundResponse(response);
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
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectResourceDeletedResponse({
            response,
            message:
              'Cannot update availability windows for a deleted resource.',
          });
        });
      });

      describe('returns 409 RESOURCE_INACTIVE with correct response', () => {
        test('when parent resource is inactive', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ owner: user });
          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
          });

          const inactiveResource = await deactivateTestResource(resource.id);

          expect(inactiveResource.is_active).toBe(false);

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectResourceInactiveResponse({
            response,
            message:
              'Cannot update availability windows for an inactive resource.',
          });
        });
      });

      describe('returns 409 NOT_A_FUTURE_AVAILABILITY_WINDOW with correct response', () => {
        test('when availability window is expired', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            expired: true,
          });

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectNotAFutureAvailabilityWindowResponse({
            response,
            message: 'You can only update future availability windows.',
          });
        });

        test('when availability window is ongoing', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectNotAFutureAvailabilityWindowResponse({
            response,
            message: 'You can only update future availability windows.',
          });
        });
      });

      describe('returns 400 WINDOW_END_TIME_NOT_AFTER_START_TIME with correct response', () => {
        test('when final endTime is not after final startTime', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              endTime: '2036-01-01T08:30:00.000Z',
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'WINDOW_END_TIME_NOT_AFTER_START_TIME',
              message: 'End time must be after start time.',
            },
          });
        });
      });

      describe('returns 400 ALLOWED_DURATION_LONGER_THAN_WINDOW with correct response', () => {
        test('when updated window becomes shorter than an existing allowed duration', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            allowedDurations: [60],
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const response = await request(app)
            .patch(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              endTime: '2036-01-01T09:30:00.000Z',
            });

          expectAllowedDurationLongerThanWindowResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for availability window id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/not-a-number')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: 30,
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window id parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be a number.',
          });
        });

        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/1')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window update request body.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for empty request body', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/1')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window update request body.',
            field: 'body',
            detailsMessage: 'Request body must have at least one update field.',
          });
        });

        test('for invalid startTime', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/1')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              startTime: '2036-01-01T09:15:00.000Z',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window update request body.',
            field: 'startTime',
            detailsMessage: 'Start time must be on a UTC :00 or :30 boundary.',
          });
        });

        test('for invalid endTime', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/1')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              endTime: '2036-01-01T09:10:00.000Z',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window update request body.',
            field: 'endTime',
            detailsMessage: 'End time must be on a UTC :00 or :30 boundary.',
          });
        });

        test('for invalid cancellationNoticeMinutes', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/1')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              cancellationNoticeMinutes: -1,
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window update request body.',
            field: 'cancellationNoticeMinutes',
            detailsMessage: 'Cancellation notice minutes must be at least 0.',
          });
        });

        test('for unknown body field', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/availability-windows/1')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              unknown: 'unknown',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window update request body.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
