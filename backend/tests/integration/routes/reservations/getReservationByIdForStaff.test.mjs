import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestReservation,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectReservationNotFoundResponse,
  expectValidationErrorResponse,
  expectGetReservationResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/reservations', () => {
  describe('GET /:reservationId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when employee gets reservation by id', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const reservation = await createTestReservation();

        const response = await request(app)
          .get(`/api/reservations/${reservation.id}`)
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
            status: 'active',
            staffCompletedByUserId: reservation.staff_completed_by_user_id,
            systemCompletedAt: null,
            staffCompletedAt: null,
            cancelledAt: null,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        });
      });

      test('returns 200 when admin gets reservation by id', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const reservation = await createTestReservation();

        const response = await request(app)
          .get(`/api/reservations/${reservation.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectGetReservationResponse({ response, reservation });
      });

      test('returns 200 for completed reservation', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const reservation = await createTestReservation({
          completed: true,
        });

        const response = await request(app)
          .get(`/api/reservations/${reservation.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectGetReservationResponse({
          response,
          reservation,
          expectedStatus: 'completed',
        });
      });

      test('returns 200 for cancelled reservation', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const reservation = await createTestReservation({
          cancelled: true,
        });

        const response = await request(app)
          .get(`/api/reservations/${reservation.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectGetReservationResponse({
          response,
          reservation,
          expectedStatus: 'cancelled',
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const reservation = await createTestReservation();

          const response = await request(app).get(
            `/api/reservations/${reservation.id}`,
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const reservation = await createTestReservation();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .get(`/api/reservations/${reservation.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation();

          const response = await request(app)
            .get(`/api/reservations/${reservation.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESERVATION_NOT_FOUND with correct response', () => {
        test('when reservation does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations/999999')
            .set('Authorization', `Bearer ${accessToken}`);

          expectReservationNotFoundResponse({ response });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for reservation id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations/not-a-number')
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
