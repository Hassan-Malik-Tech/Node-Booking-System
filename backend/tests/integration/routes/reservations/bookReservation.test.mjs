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
  createTestResource,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
  expectAvailabilityWindowNotFoundResponse,
} from '../../../helpers/assertions.mjs';
import {
  softDeleteTestUser,
} from '../../../helpers/updateTestData.mjs';
import { buildBookReservationRequestBody } from '../../../helpers/postRequestBodies.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/reservations', () => {
  describe('POST /', () => {
    describe('happy path', () => {
      test('returns 201 with correct response shape when user books reservation', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        // Creates a resource if none is passed in.
        const availabilityWindow = await createTestAvailabilityWindow({
          allowedDurations: [15],
        });

        const reservationReqBody = buildBookReservationRequestBody({
          resource: availabilityWindow.resource,
          availabilityWindow,
        });

        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(reservationReqBody);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: expect.any(Number),
            userId: user.id,
            resourceId: availabilityWindow.resource.id,
            availabilityWindowId: availabilityWindow.id,
            startTime: reservationReqBody.startTime,
            endTime: reservationReqBody.endTime,
            partySize: reservationReqBody.partySize,
            status: 'active',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        });
      });

      test('returns 201 when resource owner books their own resource', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          allowedDurations: [30],
        });

        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(
            buildBookReservationRequestBody({
              resource: availabilityWindow.resource,
              availabilityWindow,
            }),
          );

        expect(response.status).toBe(201);
        expect(response.body.data.userId).toBe(user.id);
        expect(response.body.data.resourceId).toBe(
          availabilityWindow.resource.id,
        );
      });

      // These 2 tests are here to make sure that I used the right rules
      // in my resourceRules function.
      test('returns 201 when employee books another users resource', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const availabilityWindow = await createTestAvailabilityWindow({});

        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(
            buildBookReservationRequestBody({
              resource: availabilityWindow.resource,
              availabilityWindow,
            }),
          );

        expect(response.status).toBe(201);
        expect(response.body.data.userId).toBe(user.id);
        expect(response.body.data.resourceId).toBe(
          availabilityWindow.resource.id,
        );
      });

      test('returns 201 when admin books another users resource', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const availabilityWindow = await createTestAvailabilityWindow({});

        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(
            buildBookReservationRequestBody({
              resource: availabilityWindow.resource,
              availabilityWindow,
            }),
          );

        expect(response.status).toBe(201);
        expect(response.body.data.userId).toBe(user.id);
        expect(response.body.data.resourceId).toBe(
          availabilityWindow.resource.id,
        );
      });

      test('returns 200 with existing reservation and does not create a duplicate when user retries the exact same booking', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow();

        const reservationReqBody = buildBookReservationRequestBody({
          resource: availabilityWindow.resource,
          availabilityWindow,
        });

        const firstResponse = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(reservationReqBody);

        expect(firstResponse.status).toBe(201);

        const retryResponse = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(reservationReqBody);

        expect(retryResponse.status).toBe(200);
        expect(retryResponse.body).toEqual({
          success: true,
          data: {
            id: firstResponse.body.data.id,
            userId: user.id,
            resourceId: availabilityWindow.resource.id,
            availabilityWindowId: availabilityWindow.id,
            startTime: reservationReqBody.startTime,
            endTime: reservationReqBody.endTime,
            partySize: reservationReqBody.partySize,
            status: 'active',
            createdAt: firstResponse.body.data.createdAt,
            updatedAt: firstResponse.body.data.updatedAt,
          },
        });

        const reservationsInDb = await db.query(
          `
            SELECT COUNT(*)::int AS total
            FROM reservations
            WHERE user_id = $1
              AND resource_id = $2
              AND availability_window_id = $3
              AND start_time = $4
              AND end_time = $5
              AND party_size = $6
              AND status = 'active'
          `,
          [
            user.id,
            reservationReqBody.resourceId,
            reservationReqBody.availabilityWindowId,
            reservationReqBody.startTime,
            reservationReqBody.endTime,
            reservationReqBody.partySize,
          ],
        );

        expect(reservationsInDb.rows[0].total).toBe(1);
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
              }),
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

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
              }),
            );

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: {
                  ...availabilityWindow.resource,
                  // overrides the resource id.
                  id: 999999,
                },
                availabilityWindow,
              }),
            );

          expectResourceNotFoundResponse(response);
        });

        test('when resource is inactive', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ inactive: true });

          // Does not belong to the inactive resource. It is only used
          // to build valid reservation times without manual request body setup.
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource,
                availabilityWindow,
              }),
            );

          expectResourceNotFoundResponse(response);
        });

        test('when resource is soft deleted', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ deleted: true });

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource,
                availabilityWindow,
              }),
            );

          expectResourceNotFoundResponse(response);
        });
      });

      const AVAILABILITY_WINDOW_NOT_FOUND_MESSAGE =
        'No active availability window with that id was found for this resource.';

      describe('returns 404 AVAILABILITY_WINDOW_NOT_FOUND with correct response', () => {
        test('when availability window does not exist for the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                availabilityWindowId: 999999,
              }),
            );

          expectAvailabilityWindowNotFoundResponse({
            response,
            message: AVAILABILITY_WINDOW_NOT_FOUND_MESSAGE,
          });
        });

        test('when availability window belongs to another resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const targetAvailabilityWindow = await createTestAvailabilityWindow();
          const otherAvailabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: targetAvailabilityWindow.resource,
                availabilityWindow: otherAvailabilityWindow,
              }),
            );

          expectAvailabilityWindowNotFoundResponse({
            response,
            message: AVAILABILITY_WINDOW_NOT_FOUND_MESSAGE,
          });
        });

        test('when availability window is expired', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            expired: true,
          });

          // Since exipred changed the start and end times,
          // I need to do it manually.
          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: '2036-01-01T09:00:00.000Z',
                endTime: '2036-01-01T09:30:00.000Z',
              }),
            );

          expectAvailabilityWindowNotFoundResponse({
            response,
            message: AVAILABILITY_WINDOW_NOT_FOUND_MESSAGE,
          });
        });

        test('when availability window is soft deleted', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            deleted: true,
          });

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
              }),
            );

          expectAvailabilityWindowNotFoundResponse({
            response,
            message: AVAILABILITY_WINDOW_NOT_FOUND_MESSAGE,
          });
        });
      });

      describe('returns 400 RESERVATION_OUTSIDE_AVAILABILITY_WINDOW with correct response', () => {
        test('when reservation starts before the availability window', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: '2036-01-01T08:30:00.000Z',
                endTime: '2036-01-01T09:30:00.000Z',
              }),
            );

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_OUTSIDE_AVAILABILITY_WINDOW',
              message: 'Reservation must fit within the availability window.',
            },
          });
        });

        test('when reservation ends after the availability window', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: '2036-01-01T16:30:00.000Z',
                endTime: '2036-01-01T17:30:00.000Z',
              }),
            );

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_OUTSIDE_AVAILABILITY_WINDOW',
              message: 'Reservation must fit within the availability window.',
            },
          });
        });
      });

      describe('returns 400 RESERVATION_DURATION_NOT_ALLOWED with correct response', () => {
        test('when reservation duration does not match any allowed duration for the availability window', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            allowedDurations: [30, 60],
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          });

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: '2036-01-01T09:00:00.000Z',
                endTime: '2036-01-01T09:45:00.000Z',
              }),
            );

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_DURATION_NOT_ALLOWED',
              message:
                'Reservation duration is not allowed for this availability window.',
            },
          });
        });
      });

      describe('returns 400 RESERVATION_PARTY_SIZE_EXCEEDS_CAPACITY with correct response', () => {
        test('when party size exceeds resource capacity', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resource: await createTestResource({ capacity: 4 }),
          });

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                partySize: 5,
              }),
            );

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_PARTY_SIZE_EXCEEDS_CAPACITY',
              message:
                'Reservation party size cannot exceed resource capacity of 4.',
            },
          });
        });
      });

      describe('returns 409 RESERVATION_OVERLAP with correct response', () => {
        test('when reservation overlaps an existing reservation for the resource', async () => {
          const [
            { accessToken: firstAccessToken },
            { accessToken: secondAccessToken },
          ] = await Promise.all([
            createAuthenticatedTestUser(),
            createAuthenticatedTestUser(),
          ]);

          const availabilityWindow = await createTestAvailabilityWindow();

          const reservationReqBody = buildBookReservationRequestBody({
            resource: availabilityWindow.resource,
            availabilityWindow,
          });

          const firstResponse = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${firstAccessToken}`)
            .send(reservationReqBody);

          expect(firstResponse.status).toBe(201);

          const secondResponse = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${secondAccessToken}`)
            .send(reservationReqBody);

          expect(secondResponse.status).toBe(409);
          expect(secondResponse.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_OVERLAP',
              message:
                'Reservation overlaps with an existing reservation for this resource',
            },
          });
        });

        test('returns one 201 and one 409 when two users book overlapping reservations at the same time', async () => {
          const [
            { accessToken: firstAccessToken },
            { accessToken: secondAccessToken },
          ] = await Promise.all([
            createAuthenticatedTestUser(),
            createAuthenticatedTestUser(),
          ]);

          const availabilityWindow = await createTestAvailabilityWindow();

          const reservationReqBody = buildBookReservationRequestBody({
            resource: availabilityWindow.resource,
            availabilityWindow,
          });

          const responses = await Promise.all([
            request(app)
              .post('/api/reservations')
              .set('Authorization', `Bearer ${firstAccessToken}`)
              .send(reservationReqBody),
            request(app)
              .post('/api/reservations')
              .set('Authorization', `Bearer ${secondAccessToken}`)
              .send(reservationReqBody),
          ]);

          const statuses = responses
            .map((response) => response.status)
            .sort((a, b) => a - b);

          expect(statuses).toEqual([201, 409]);

          const conflictResponse = responses.find(
            (response) => response.status === 409,
          );

          expect(conflictResponse.body).toEqual({
            success: false,
            error: {
              code: 'RESERVATION_OVERLAP',
              message:
                'Reservation overlaps with an existing reservation for this resource',
            },
          });

          const successResponse = responses.find(
            (response) => response.status === 201,
          );

          const activeReservationsInDb = await db.query(
            `
              SELECT COUNT(*)::int AS total
              FROM reservations
              WHERE availability_window_id = $1
                AND status = 'active'
            `,
            [availabilityWindow.id],
          );

          expect(activeReservationsInDb.rows[0].total).toBe(1);

          const activeReservationIdInDb = await db.query(
            `
              SELECT id
              FROM reservations
              WHERE availability_window_id = $1
                AND status = 'active'
            `,
            [availabilityWindow.id],
          );

          expect(activeReservationIdInDb.rows[0].id).toBe(
            successResponse.body.data.id,
          );
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for missing resourceId', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                resourceId: undefined,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'resourceId',
            detailsMessage: 'Resource id is required.',
          });
        });

        test('for resourceId that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                resourceId: 'not-a-number',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });

        test('for missing availabilityWindowId', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                availabilityWindowId: undefined,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id is required.',
          });
        });

        test('for availabilityWindowId that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                availabilityWindowId: 'not-a-number',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be a number.',
          });
        });

        test('for missing startTime', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: undefined,
              }),
            );

          expect(response.status).toBe(400);
          // Since endTime must reference a valid ISO startTime, there should be
          // 2 items in details, so I use arrayContaining.
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid book reservation request body.',
              details: expect.arrayContaining([
                { field: 'startTime', message: 'Start time is required.' },
              ]),
            },
          });
        });

        test('for invalid startTime', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: 'not-a-date',
              }),
            );

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid book reservation request body.',
              details: expect.arrayContaining([
                {
                  field: 'startTime',
                  message: 'Start time must be an ISO date string.',
                },
              ]),
            },
          });
        });

        test('for startTime that is in the past', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: '2025-01-01T09:00:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'startTime',
            detailsMessage: 'Start time must be in the future.',
          });
        });

        test('for startTime that is not on a UTC quarter-hour boundary', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: '2036-01-01T09:10:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'startTime',
            detailsMessage:
              'Start time must be on a UTC :00, :15, :30, or :45 boundary.',
          });
        });

        test('for missing endTime', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                endTime: undefined,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'endTime',
            detailsMessage: 'End time is required.',
          });
        });

        test('for invalid endTime', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                endTime: 'not-a-date',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'endTime',
            detailsMessage: 'End time must be an ISO date string.',
          });
        });

        test('for endTime that is before startTime', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                startTime: '2036-01-01T09:00:00.000Z',
                endTime: '2036-01-01T08:30:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'endTime',
            detailsMessage: 'End time must be after start time.',
          });
        });

        test('for endTime that is not on a UTC quarter-hour boundary', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                endTime: '2036-01-01T09:10:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'endTime',
            detailsMessage:
              'End time must be on a UTC :00, :15, :30, or :45 boundary.',
          });
        });

        test('for missing partySize', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                partySize: undefined,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'partySize',
            detailsMessage: 'Party size is required.',
          });
        });

        test('for partySize that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                partySize: 'not-a-number',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'partySize',
            detailsMessage: 'Party size must be a number.',
          });
        });

        test('for partySize less than 1', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                partySize: 0,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'partySize',
            detailsMessage: 'Party size must be at least 1.',
          });
        });

        test('for unknown body field', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildBookReservationRequestBody({
                resource: availabilityWindow.resource,
                availabilityWindow,
                unknown: true,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid book reservation request body.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
