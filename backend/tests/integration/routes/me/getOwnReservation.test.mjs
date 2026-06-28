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
  expectInvalidTokenResponse,
  expectReservationNotFoundResponse,
  expectValidationErrorResponse,
  expectGetOwnReservationResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/me', () => {
  describe('GET /reservations/:reservationId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when authenticated user gets own reservation by id', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const reservation = await createTestReservation({ user });

        const response = await request(app)
          .get(`/api/me/reservations/${reservation.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: reservation.id,
            userId: user.id,
            resourceId: reservation.resource.id,
            availabilityWindowId: reservation.availabilityWindow.id,
            startTime: reservation.start_time.toISOString(),
            endTime: reservation.end_time.toISOString(),
            partySize: reservation.party_size,
            status: 'active',
            completedAt: null,
            cancelledAt: null,
            createdAt: reservation.created_at.toISOString(),
            updatedAt: reservation.updated_at.toISOString(),
          },
        });
      });

      test('returns 200 for own completed reservation', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const reservation = await createTestReservation({
          user,
          completed: true,
        });

        const response = await request(app)
          .get(`/api/me/reservations/${reservation.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectGetOwnReservationResponse({
          response,
          reservation,
          expectedStatus: 'completed',
        });
      });

      test('returns 200 for own cancelled reservation', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const reservation = await createTestReservation({
          user,
          cancelled: true,
        });

        const response = await request(app)
          .get(`/api/me/reservations/${reservation.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expectGetOwnReservationResponse({
          response,
          reservation,
          expectedStatus: 'cancelled',
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through meRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const reservation = await createTestReservation();

          const response = await request(app).get(
            `/api/me/reservations/${reservation.id}`,
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place through meRouter.use.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({ user });

          await softDeleteTestUser(user.id);

          const response = await request(app)
            .get(`/api/me/reservations/${reservation.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 404 RESERVATION_NOT_FOUND with correct response', () => {
        test('when reservation does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/reservations/999999')
            .set('Authorization', `Bearer ${accessToken}`);

          expectReservationNotFoundResponse({
            response,
            message: 'No reservation with that id was found for your account.',
          });
        });

        test('when reservation belongs to another user', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation();

          const response = await request(app)
            .get(`/api/me/reservations/${reservation.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectReservationNotFoundResponse({
            response,
            message: 'No reservation with that id was found for your account.',
          });
        });
      });

      // Uses the already tested shared reservationIdParamsSchema,
      // so I don't need full testing.
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for reservation id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/reservations/not-a-number')
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
