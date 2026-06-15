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
  expectForbiddenResponse,
  expectValidationErrorResponse,
  expectAvailabilityWindowNotFoundResponse,
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

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/availability-windows', () => {
  describe('POST /:availabilityWindowId/allowed-durations', () => {
    describe('happy path', () => {
      test('returns 201 with correct response shape when owner creates allowed durations', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          noDurations: true,
        });

        const response = await request(app)
          .post(
            `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
          )
          .set('Authorization', `Bearer ${accessToken}`)
          .send([60, 45, 30]);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          success: true,
          data: {
            availabilityWindowId: availabilityWindow.id,
            allowedDurations: [
              { id: expect.any(Number), minutes: 30 },
              { id: expect.any(Number), minutes: 45 },
              { id: expect.any(Number), minutes: 60 },
            ],
          },
        });
      });

      test('returns 201 when employee creates allowed durations for their own availability window', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          noDurations: true,
        });

        const response = await request(app)
          .post(
            `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
          )
          .set('Authorization', `Bearer ${accessToken}`)
          .send([30]);

        expect(response.status).toBe(201);
        expect(response.body.data.availabilityWindowId).toBe(
          availabilityWindow.id,
        );
      });

      test('returns 201 when admin creates allowed durations for their own availability window', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          resourceOwner: user,
          noDurations: true,
        });

        const response = await request(app)
          .post(
            `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
          )
          .set('Authorization', `Bearer ${accessToken}`)
          .send([30]);

        expect(response.status).toBe(201);
        expect(response.body.data.availabilityWindowId).toBe(
          availabilityWindow.id,
        );
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .send([30]);

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
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            noDurations: true,
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectForbiddenResponse(response);
        });

        test('when employee does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const availabilityWindow = await createTestAvailabilityWindow({
            noDurations: true,
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectForbiddenResponse(response);
        });

        test('when admin does not own the parent resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const availabilityWindow = await createTestAvailabilityWindow({
            noDurations: true,
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 AVAILABILITY_WINDOW_NOT_FOUND with correct response', () => {
        test('when availability window does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/999999/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectAvailabilityWindowNotFoundResponse(response);
        });

        test('when availability window is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            deleted: true,
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectAvailabilityWindowNotFoundResponse(response);
        });
      });

      describe('returns 409 RESOURCE_DELETED with correct response', () => {
        test('when parent resource is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ owner: user });
          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            noDurations: true,
          });

          const deletedResource = await softDeleteTestResource(resource.id);

          expect(deletedResource.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectResourceDeletedResponse({
            response,
            message:
              'Cannot create allowed durations for availability windows that belong to a deleted resource.',
          });
        });
      });

      describe('returns 409 RESOURCE_INACTIVE with correct response', () => {
        test('when parent resource is inactive', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource({ owner: user });
          const availabilityWindow = await createTestAvailabilityWindow({
            resource,
            noDurations: true,
          });

          const deactivatedResource = await deactivateTestResource(resource.id);

          expect(deactivatedResource.is_active).toBe(false);

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectResourceInactiveResponse({
            response,
            message:
              'Cannot create allowed durations for availability windows that belong to an inactive resource.',
          });
        });
      });

      describe('returns 409 NOT_A_FUTURE_AVAILABILITY_WINDOW with correct response', () => {
        test('when availability window is expired', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            expired: true,
            noDurations: true,
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectNotAFutureAvailabilityWindowResponse({
            response,
            message:
              'You can only create allowed durations for future availability windows.',
          });
        });

        test('when availability window is ongoing', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            startTime: '2026-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
            noDurations: true,
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectNotAFutureAvailabilityWindowResponse({
            response,
            message:
              'You can only create allowed durations for future availability windows.',
          });
        });
      });

      describe('returns 409 ALLOWED_DURATION_ALREADY_EXISTS with correct response', () => {
        test('when allowed duration already exists for the availability window', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            allowedDurations: [30],
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'ALLOWED_DURATION_ALREADY_EXISTS',
              message:
                'Allowed duration already exists for this availability window.',
            },
          });
        });
      });

      describe('returns 400 ALLOWED_DURATION_LONGER_THAN_WINDOW with correct response', () => {
        test('when allowed duration is longer than the availability window', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T09:30:00.000Z',
            noDurations: true,
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([60]);

          expectAllowedDurationLongerThanWindowResponse(response);
        });
      });

      describe('returns 400 TOO_MANY_ALLOWED_DURATIONS with correct response', () => {
        test('when availability window already has 10 allowed durations', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const availabilityWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            allowedDurations: [15, 30, 45, 60, 75, 90, 105, 120, 135, 150],
          });

          const response = await request(app)
            .post(
              `/api/availability-windows/${availabilityWindow.id}/allowed-durations`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send([165]);

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'TOO_MANY_ALLOWED_DURATIONS',
              message:
                'An availability window can have at most 10 allowed durations.',
            },
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for availability window id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/not-a-number/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window id parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be a number.',
          });
        });

        test('for request body that is not an array', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid create allowed durations request body.',
            field: 'body',
            detailsMessage: 'Allowed durations must be an array.',
          });
        });

        test('for empty request body array', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid create allowed durations request body.',
            field: 'body',
            detailsMessage: 'At least one allowed duration is required.',
          });
        });

        test('for more than 10 allowed durations', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid create allowed durations request body.',
            field: 'body',
            detailsMessage:
              'An availability window can have at most 10 allowed durations.',
          });
        });

        test('for allowed duration that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(['not-a-number']);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid create allowed durations request body.',
            field: '[0]',
            detailsMessage: 'Allowed duration must be a number.',
          });
        });

        test('for allowed duration less than 15 minutes', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          // Use 0 as 1 - 14 would trigger the
          // 15 minute interval error.
          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([0]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid create allowed durations request body.',
            field: '[0]',
            detailsMessage: 'Allowed duration must be at least 15 minutes.',
          });
        });

        test('for allowed duration that is not a 15 minute interval', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([20]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid create allowed durations request body.',
            field: '[0]',
            detailsMessage: 'Allowed duration must be a 15 minute interval.',
          });
        });

        test('for duplicate allowed durations in request body', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/availability-windows/1/allowed-durations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([30, 30]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid create allowed durations request body.',
            field: '[1]',
            detailsMessage: 'Allowed durations cannot contain duplicates.',
          });
        });
      });
    });
  });
});
