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
  expectReservationNotFoundResponse,
  expectReservationAlreadyCompletedResponse,
  expectReservationAlreadyCancelledResponse,
  expectNoDetailsErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import * as db from '../../../../src/db/db.js';
import {
  softDeleteTestResource,
  deactivateTestResource,
} from '../../../helpers/updateTestData.mjs';
import { softDeleteAvailabilityWindowById } from '../../../../src/data-access/availabilityWindows.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/reservations', () => {
  describe('PATCH /:reservationId/party-size', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when reservation user updates party size', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const reservation = await createTestReservation({
          user,
        });

        /// To prove the helper creates a reservation with a party size
        // that can be decreased safely.
        expect(reservation.resource.capacity).toBeGreaterThan(1);
        expect(reservation.party_size).toBeGreaterThan(1);
        expect(reservation.party_size).toBeLessThanOrEqual(
          reservation.resource.capacity,
        );

        const newPartySize = reservation.party_size - 1;

        const response = await request(app)
          .patch(`/api/reservations/${reservation.id}/party-size`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            partySize: newPartySize,
          });

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
            partySize: newPartySize,
            status: 'active',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        });

        const reservationInDb = await db.query(
          `
            SELECT party_size
            FROM reservations
            WHERE id = $1
          `,
          [reservation.id],
        );

        expect(reservationInDb.rows[0]).toEqual({
          party_size: newPartySize,
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app)
            .patch('/api/reservations/1/party-size')
            .send({
              partySize: 1,
            });

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
            .patch('/api/reservations/1/party-size')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: 1,
            });

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the reservation', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation();

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESERVATION_NOT_FOUND with correct response', () => {
        test('when reservation does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/999999/party-size')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: 1,
            });

          expectReservationNotFoundResponse({ response });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_COMPLETED with correct response', () => {
        test('when reservation is already completed', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
            completed: true,
          });

          expect(reservation.status).toBe('completed');
          expect(reservation.system_completed_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectReservationAlreadyCompletedResponse({
            response,
            message: 'Cannot update party size for a completed reservation.',
          });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_CANCELLED with correct response', () => {
        test('when reservation is cancelled', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
            cancelled: true,
          });

          expect(reservation.status).toBe('cancelled');
          expect(reservation.cancelled_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectReservationAlreadyCancelledResponse({
            response,
            message: 'Cannot update party size for a cancelled reservation.',
          });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_ENDED with correct response', () => {
        test('when reservation is active but in the past', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
            expired: true,
          });

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESERVATION_ALREADY_ENDED',
            message: 'Cannot update party size for a past reservation.',
          });
        });
      });

      describe('returns 409 RESERVATION_ALREADY_STARTED with correct response', () => {
        test('when reservation is ongoing', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
            ongoing: true,
          });

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESERVATION_ALREADY_STARTED',
            message: 'Cannot update party size for a reservation that has already started.',
          });
        });
      });

      // This should not be the case for normal service logic
      // as deleting or deactivating a resource deletes future reservations.
      describe('returns 409 RESOURCE_STATE_CHANGED with correct response', () => {
        test('when parent resource is soft deleted but reservation is still active future', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
          });

          const deletedResource = await softDeleteTestResource(
            reservation.resource.id,
          );

          expect(deletedResource.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESOURCE_STATE_CHANGED',
            message: 'You can no longer update this reservation because the resource is no longer bookable.',
          });
        });

        test('when parent resource is inactive but reservation is still active future', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
          });

          const inactiveResource = await deactivateTestResource(
            reservation.resource.id,
          );

          expect(inactiveResource.is_active).toBe(false);

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESOURCE_STATE_CHANGED',
            message: 'You can no longer update this reservation because the resource is no longer bookable.',
          });
        });
      });

      describe('returns 409 AVAILABILITY_WINDOW_STATE_CHANGED with correct response', () => {
        test('when availability window is soft deleted but reservation is still active future', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
          });

          const deletedAvailabilityWindow =
            await softDeleteAvailabilityWindowById({
              windowId: reservation.availabilityWindow.id,
            });

          expect(deletedAvailabilityWindow.deleted_at).toEqual(
            expect.any(Date),
          );

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: reservation.party_size,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'AVAILABILITY_WINDOW_STATE_CHANGED',
            message: 'You can no longer update this reservation because the availability window is no longer bookable.',
          });
        });
      });

      describe('returns 400 RESERVATION_PARTY_SIZE_EXCEEDS_CAPACITY with correct response', () => {
        test('when new party size exceeds resource capacity', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const reservation = await createTestReservation({
            user,
          });

          const resourceCapacity = reservation.resource.capacity;
          const newPartySize = resourceCapacity + 1;

          const response = await request(app)
            .patch(`/api/reservations/${reservation.id}/party-size`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: newPartySize,
            });

          expectNoDetailsErrorResponse({
            response,
            status: 400,
            code: 'RESERVATION_PARTY_SIZE_EXCEEDS_CAPACITY',
            message: `Reservation party size cannot exceed resource capacity of ${resourceCapacity}.`,
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for reservation id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/not-a-number/party-size')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: 1,
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation id parameter.',
            field: 'reservationId',
            detailsMessage: 'Reservation id must be a number.',
          });
        });

        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/1/party-size')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid update reservation party size request body.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for missing partySize', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/1/party-size')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid update reservation party size request body.',
            field: 'partySize',
            detailsMessage: 'Party size is required.',
          });
        });

        test('for partySize that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/reservations/1/party-size')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              partySize: 'not-a-number',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid update reservation party size request body.',
            field: 'partySize',
            detailsMessage: 'Party size must be a number.',
          });
        });
      });
    });
  });
});
