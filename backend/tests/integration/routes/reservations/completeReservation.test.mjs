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
  createTestUser,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
  expectForbiddenResponse,
  expectValidationErrorResponse,
  expectReservationCompletedResponse,
  expectReservationNotFoundResponse,
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

describe('/api/reservations', () => {
  describe('PATCH /:reservationId/complete', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when employee completes an ongoing reservation', async () => {
        const { user: employee, accessToken } =
          await createAuthenticatedTestUser({
            role: 'employee',
          });

        // Creates user, resource and window internally.
        const reservation = await createTestReservation({
          ongoing: true,
        });

        // To prove that reservation is ongoing.
        expect(reservation.status).toBe('active');
        expect(reservation.start_time.getTime()).toBeLessThanOrEqual(
          Date.now(),
        );
        expect(reservation.end_time.getTime()).toBeGreaterThan(Date.now());

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/complete`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: reservation.id,
            userId: reservation.user.id,
            resourceId: reservation.resource.id,
            availabilityWindowId: reservation.availabilityWindow.id,
            startTime: reservation.start_time.toISOString(),
            endTime: reservation.end_time.toISOString(),
            partySize: reservation.party_size,
            status: 'completed',
            staffCompletedByUserId: employee.id,
            systemCompletedAt: null,
            staffCompletedAt: expect.any(String),
            cancelledAt: null,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        });

        const reservationInDb = await db.query(
          `
            SELECT
              status,
              staff_completed_by_user_id,
              system_completed_at,
              staff_completed_at,
              cancelled_at
            FROM reservations
            WHERE id = $1
          `,
          [reservation.id],
        );

        expect(reservationInDb.rows[0]).toEqual({
          status: 'completed',
          staff_completed_by_user_id: employee.id,
          system_completed_at: null,
          staff_completed_at: expect.any(Date),
          cancelled_at: null,
        });
      });

      test('returns 200 when admin completes an ongoing reservation', async () => {
        const { user: admin, accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const reservation = await createTestReservation({
          ongoing: true,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/complete`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectReservationCompletedResponse({
          response,
          reservation,
          staff: admin,
        });
      });

      test('returns 200 when employee completes an expired active reservation', async () => {
        const { user: employee, accessToken } =
          await createAuthenticatedTestUser({
            role: 'employee',
          });

        const reservation = await createTestReservation({
          expired: true,
        });

        // To prove that reservation is expired.
        expect(reservation.status).toBe('active');
        expect(reservation.end_time.getTime()).toBeLessThanOrEqual(Date.now());

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/complete`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectReservationCompletedResponse({
          response,
          reservation,
          staff: employee,
        });
      });

      test('returns 200 when admin completes an expired active reservation', async () => {
        const { user: admin, accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const reservation = await createTestReservation({
          expired: true,
        });

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/complete`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectReservationCompletedResponse({
          response,
          reservation,
          staff: admin,
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).patch(
            '/api/reservations/1/complete',
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch('/api/reservations/1/complete')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not staff', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/1/complete')
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });

        test('when staff tries to complete their own reservation', async () => {
          const { user: employee, accessToken } =
            await createAuthenticatedTestUser({
              role: 'employee',
            });

          const reservation = await createTestReservation({
            user: employee,
            ongoing: true,
          });

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response, {
            message: 'You cannot complete your own reservation.',
          });
        });
      });

      describe('returns 404 RESERVATION_NOT_FOUND with correct response', () => {
        test('when reservation does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .patch('/api/reservations/999999/complete')
            .set('Authorization', `Bearer ${accessToken}`);

          expectReservationNotFoundResponse({ response });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_COMPLETED with correct response', () => {
        test('when reservation is already completed', async () => {
          const { user: employee, accessToken } =
            await createAuthenticatedTestUser({
              role: 'employee',
            });

          const reservation = await createTestReservation({
            ongoing: true,
          });

          const completedReservation = await db.query(
            `
              UPDATE reservations
              SET status = 'completed',
                staff_completed_at = NOW(),
                staff_completed_by_user_id = $1
              WHERE id = $2
              RETURNING staff_completed_at
            `,
            [employee.id, reservation.id],
          );

          expect(completedReservation.rows[0].staff_completed_at).toEqual(
            expect.any(Date),
          );

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESERVATION_ALREADY_COMPLETED',
            message: 'Reservation already completed.',
          });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_CANCELLED with correct response', () => {
        test('when reservation is cancelled', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const reservation = await createTestReservation({
            ongoing: true,
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
            .patch(`/api/reservations/${reservation.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESERVATION_ALREADY_CANCELLED',
            message: 'Cannot complete a cancelled reservation.',
          });
        });
      });

      describe('returns 409 RESERVATION_NOT_STARTED with correct response', () => {
        test('when reservation has not started yet', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const reservation = await createTestReservation();

          expect(reservation.start_time.getTime()).toBeGreaterThan(Date.now());

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESERVATION_NOT_STARTED',
            message: 'You cannot complete a reservation that has not started yet.',
          });
        });
      });

      // Since the schema is shared and already tested in the cancel reservation test,
      // I do not need to do a full test, only one test to prove that it is wired.
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for reservation id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .patch('/api/reservations/not-a-number/complete')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation id parameter.',
            field: 'reservationId',
            detailsMessage: 'Reservation id must be a number.',
          });
        });
      });
    });
  });
});
