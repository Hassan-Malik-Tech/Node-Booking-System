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
  expectCancelledReservationResponse,
  expectReservationNotFoundResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

const CANCELLATION_NOTICE_PERIOD = 10_000_000;

describe('/api/reservations', () => {
  describe('PATCH /:reservationId/cancel', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when reservation user cancels their own future reservation', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        // Resource and availability window are created internally.
        const reservation = await createTestReservation({
          user,
        });

        expect(reservation.status).toBe('active');

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            reservationId: reservation.id,
            status: 'cancelled',
            cancelledAt: expect.any(String),
          },
        });

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

      test('returns 200 when resource owner cancels another user reservation', async () => {
        const { user: resourceOwner, accessToken } =
          await createAuthenticatedTestUser();

        const reservationUser = await createTestUser();

        const resource = await createTestResource({
          owner: resourceOwner,
        });

        const reservation = await createTestReservation({
          user: reservationUser,
          resource,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectCancelledReservationResponse({ response, reservation });
      });

      test('returns 200 when employee cancels another user reservation', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const reservationUser = await createTestUser();

        const reservation = await createTestReservation({
          user: reservationUser,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectCancelledReservationResponse({ response, reservation });
      });

      test('returns 200 when admin cancels another user reservation', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const reservationUser = await createTestUser();

        const reservation = await createTestReservation({
          user: reservationUser,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectCancelledReservationResponse({ response, reservation });
      });

      test('allows resource owner to cancel own reservation after cancellation notice period has passed', async () => {
        const { user: resourceOwner, accessToken } =
          await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner,
          cancellationNoticeMinutes: CANCELLATION_NOTICE_PERIOD,
        });

        const reservation = await createTestReservation({
          user: resourceOwner,
          availabilityWindow,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectCancelledReservationResponse({ response, reservation });
      });

      test("allows resource owner to cancel another user's reservation after cancellation notice period has passed", async () => {
        const { user: resourceOwner, accessToken } =
          await createAuthenticatedTestUser();

        const reservationUser = await createTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner,
          cancellationNoticeMinutes: CANCELLATION_NOTICE_PERIOD,
        });

        const reservation = await createTestReservation({
          user: reservationUser,
          availabilityWindow,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectCancelledReservationResponse({ response, reservation });
      });

      test('allows staff to cancel another user reservation after cancellation notice period has passed', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const reservationUser = await createTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          cancellationNoticeMinutes: CANCELLATION_NOTICE_PERIOD,
        });

        const reservation = await createTestReservation({
          user: reservationUser,
          availabilityWindow,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/cancel`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectCancelledReservationResponse({ response, reservation });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).patch(
            '/api/reservations/1/cancel',
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
            .patch('/api/reservations/1/cancel')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the reservation, does not own the resource, and is not staff', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const reservationUser = await createTestUser();

          const reservation = await createTestReservation({
            user: reservationUser,
          });

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESERVATION_NOT_FOUND with correct response', () => {
        test('when reservation does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/999999/cancel')
            .set('Authorization', `Bearer ${accessToken}`);

          expectReservationNotFoundResponse({ response });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_CANCELLED with correct response', () => {
        test('when reservation is already cancelled', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
          });

          const cancelledReservation = await db.query(
            `
              UPDATE reservations
              SET status = 'cancelled',
                cancelled_at = NOW()
              WHERE id = $1
              RETURNING cancelled_at
            `,
            [reservation.id],
          );

          expect(cancelledReservation.rows[0].cancelled_at).toEqual(
            expect.any(Date),
          );

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_ALREADY_CANCELLED',
              message: 'Reservation is already cancelled.',
            },
          });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_COMPLETED with correct response', () => {
        test('when reservation is completed', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
          });

          const completedReservation = await db.query(
            `
              UPDATE reservations
              SET status = 'completed',
                system_completed_at = NOW()
              WHERE id = $1
              RETURNING system_completed_at
            `,
            [reservation.id],
          );

          expect(completedReservation.rows[0].system_completed_at).toEqual(
            expect.any(Date),
          );

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_ALREADY_COMPLETED',
              message: 'Cannot cancel a completed reservation.',
            },
          });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_ENDED with correct response', () => {
        test('when reservation is active but in the past', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            expired: true,
          });

          const reservation = await createTestReservation({
            user,
            availabilityWindow,
          });

          expect(reservation.status).toBe('active');
          expect(reservation.end_time.getTime()).toBeLessThanOrEqual(
            Date.now(),
          );

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_ALREADY_ENDED',
              message: 'Cannot cancel a past reservation.',
            },
          });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_STARTED with correct response', () => {
        test('when reservation is ongoing', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const reservation = await createTestReservation({
            user,
            availabilityWindow,
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T09:30:00.000Z',
          });

          expect(reservation.status).toBe('active');
          expect(reservation.start_time.getTime()).toBeLessThanOrEqual(
            Date.now(),
          );
          expect(reservation.end_time.getTime()).toBeGreaterThan(Date.now());

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_ALREADY_STARTED',
              message: 'Cannot cancel a reservation that has already started.',
            },
          });
        });
      });

      describe('returns 409 RESERVATION_CANCELLATION_NOTICE_PASSED with correct response', () => {
        test('when reservation user cancels their own reservation after notice period has passed', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            cancellationNoticeMinutes: CANCELLATION_NOTICE_PERIOD,
          });

          const reservation = await createTestReservation({
            user,
            availabilityWindow,
          });

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_CANCELLATION_NOTICE_PASSED',
              message:
                'You can no longer cancel this reservation because the cancellation notice period has passed.',
            },
          });
        });

        test('when employee cancels their own reservation after notice period has passed and does not own the resource', async () => {
          const { user: employee, accessToken } =
            await createAuthenticatedTestUser({
              role: 'employee',
            });

          const availabilityWindow = await createTestAvailabilityWindow({
            cancellationNoticeMinutes: CANCELLATION_NOTICE_PERIOD,
          });

          const reservation = await createTestReservation({
            user: employee,
            availabilityWindow,
          });

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_CANCELLATION_NOTICE_PASSED',
              message:
                'You can no longer cancel this reservation because the cancellation notice period has passed.',
            },
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for reservation id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/not-a-number/cancel')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation id parameter.',
            field: 'reservationId',
            detailsMessage: 'Reservation id must be a number.',
          });
        });

        test('for reservation id that is not an integer', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/1.5/cancel')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation id parameter.',
            field: 'reservationId',
            detailsMessage: 'Reservation id must be an integer.',
          });
        });

        test('for reservation id less than 1', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/0/cancel')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation id parameter.',
            field: 'reservationId',
            detailsMessage: 'Reservation id must be at least 1.',
          });
        });
      });
    });
  });
});
