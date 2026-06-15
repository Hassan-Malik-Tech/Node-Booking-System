import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestResource,
  createTestAvailabilityWindow,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
  expectForbiddenResponse,
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
  expectResourceDeletedResponse,
  expectResourceInactiveResponse,
  expectAvailabilityWindowConflictResponse,
  expectAllowedDurationLongerThanWindowResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import { buildCreateAvailabilityWindowRequestBody } from '../../../helpers/postRequestBodies.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('POST /:resourceId/availability-windows', () => {
    describe('happy path', () => {
      test('returns 201 with correct response shape and ascending allowedDurations', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const resource = await createTestResource({ owner: user });

        const windowReqBody = buildCreateAvailabilityWindowRequestBody({
          allowedDurations: [45, 15],
        });

        const response = await request(app)
          .post(`/api/resources/${resource.id}/availability-windows`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(windowReqBody);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: expect.any(Number),
            resourceId: resource.id,
            startTime: windowReqBody.startTime,
            endTime: windowReqBody.endTime,
            cancellationNoticeMinutes: windowReqBody.cancellationNoticeMinutes,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            allowedDurations: [
              { id: expect.any(Number), minutes: 15 },
              { id: expect.any(Number), minutes: 45 },
            ],
          },
        });
      });
    });

    // To test if requireAuth is in place
    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const resource = await createTestResource();

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .send(buildCreateAvailabilityWindowRequestBody());

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowRequestBody());

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource();

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowRequestBody());

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources/99999/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowRequestBody());

          expectResourceNotFoundResponse(response);
        });
      });

      describe('returns 409 RESOURCE_DELETED with correct response', () => {
        test('when resource is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const deletedResource = await createTestResource({
            owner: user,
            deleted: true,
          });

          expect(deletedResource.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .post(`/api/resources/${deletedResource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowRequestBody());

          expectResourceDeletedResponse({
            response,
            message:
              'Cannot create availability window for a deleted resource.',
          });
        });
      });

      describe('returns 409 RESOURCE_INACTIVE with correct response', () => {
        test('when resource is inactive', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const inactiveResource = await createTestResource({
            owner: user,
            inactive: true,
          });

          expect(inactiveResource.is_active).toBe(false);

          const response = await request(app)
            .post(`/api/resources/${inactiveResource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowRequestBody());

          expectResourceInactiveResponse({
            response,
            message:
              'Cannot create availability window for an inactive resource.',
          });
        });
      });

      describe('returns 409 WINDOW_OVERLAP_OR_ADJACENCY with correct response', () => {
        test('when window overlaps an existing window for the same resource', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const existingWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            startTime: '2036-01-01T09:00:00Z',
            endTime: '2036-01-01T10:00:00Z',
          });

          const response = await request(app)
            .post(
              `/api/resources/${existingWindow.resource.id}/availability-windows`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                startTime: '2036-01-01T09:30:00.000Z',
                endTime: '2036-01-01T11:00:00.000Z',
              }),
            );

          expectAvailabilityWindowConflictResponse(response);
        });

        test('when window is adjacent to an existing window for the same resource', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const existingWindow = await createTestAvailabilityWindow({
            resourceOwner: user,
            startTime: '2036-01-01T09:00:00Z',
            endTime: '2036-01-01T10:00:00Z',
          });

          const response = await request(app)
            .post(
              `/api/resources/${existingWindow.resource.id}/availability-windows`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                startTime: '2036-01-01T10:00:00.000Z',
                endTime: '2036-01-01T11:00:00.000Z',
              }),
            );

          expectAvailabilityWindowConflictResponse(response);
        });
      });

      describe('returns 400 ALLOWED_DURATION_LONGER_THAN_WINDOW with correct response', () => {
        test('when allowed duration is longer than the window', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                startTime: '2036-01-01T09:00:00.000Z',
                endTime: '2036-01-01T09:30:00.000Z',
                allowedDurations: [60],
              }),
            );

          expectAllowedDurationLongerThanWindowResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources/not-a-number/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowRequestBody());

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });

        test('for allowed duration that is not a 15 minute interval', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                allowedDurations: [20],
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'allowedDurations[0]',
            detailsMessage: 'Allowed duration must be a 15 minute interval.',
          });
        });

        // Because endTime references startTime, it is hard to test for that individually.
        // So an empty request body test is the best alternative.
        test('for missing required body fields', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid availability window create request body.',
              details: expect.arrayContaining([
                {
                  field: 'startTime',
                  message: 'Start time is required.',
                },
                {
                  field: 'endTime',
                  message: 'End time is required.',
                },
                {
                  field: 'allowedDurations',
                  message: 'Allowed durations are required.',
                },
              ]),
            },
          });

          expect(response.body.error.details).toHaveLength(3);
        });

        test('for request body that is not an object', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for invalid startTime', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                startTime: '2036-01-01T09:15:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'startTime',
            detailsMessage: 'Start time must be on a UTC :00 or :30 boundary.',
          });
        });

        test('for endTime that is before startTime', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                endTime: '2006-01-01T09:00:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'endTime',
            detailsMessage: 'End time must be after start time.',
          });
        });

        test('for invalid endTime', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                endTime: '2066-01-01T09:10:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'endTime',
            detailsMessage: 'End time must be on a UTC :00 or :30 boundary.',
          });
        });

        test('for invalid cancellationNoticeMinutes', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                cancellationNoticeMinutes: -1,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'cancellationNoticeMinutes',
            detailsMessage: 'Cancellation notice minutes must be at least 0.',
          });
        });

        test('for allowedDurations that is not an array', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                allowedDurations: 30,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'allowedDurations',
            detailsMessage: 'Allowed durations must be an array.',
          });
        });

        test('for startTime that is in the past', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                startTime: '2025-01-01T09:00:00.000Z',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'startTime',
            detailsMessage: 'Start time must be in the future.',
          });
        });

        test('for cancellationNoticeMinutes that is not a number', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                cancellationNoticeMinutes: 'not-a-number',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'cancellationNoticeMinutes',
            detailsMessage: 'Cancellation notice minutes must be a number.',
          });
        });

        test('for cancellationNoticeMinutes that is not an integer', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                cancellationNoticeMinutes: 1.5,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'cancellationNoticeMinutes',
            detailsMessage: 'Cancellation notice minutes must be an integer.',
          });
        });

        test('for unknown body field', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowRequestBody({
                unknown: 'unknown',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window create request body.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
