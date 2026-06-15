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
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectResourceDeletedResponse,
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
  expectAvailabilityWindowConflictResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import { buildCreateAvailabilityWindowsBulkRequestBody } from '../../../helpers/postRequestBodies.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('PATCH /:resourceId/activate', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when owner activates resource with availability windows', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const inactiveResource = await createTestResource({
          owner: user,
          inactive: true,
        });

        const availabilityWindowReqBody = [
          {
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
            cancellationNoticeMinutes: 30,
            allowedDurations: [45, 75],
          },
          {
            startTime: '2036-01-02T09:00:00.000Z',
            endTime: '2036-01-02T17:00:00.000Z',
            cancellationNoticeMinutes: 60,
            allowedDurations: [30, 60],
          },
        ];

        const response = await request(app)
          .patch(`/api/resources/${inactiveResource.id}/activate`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(availabilityWindowReqBody);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            resource: {
              id: inactiveResource.id,
              ownerId: user.id,
              name: inactiveResource.name,
              description: inactiveResource.description,
              capacity: inactiveResource.capacity,
              isActive: true,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            availabilityWindowsCreated: 2,
            allowedDurationsCreated: 4,
            availabilityWindowIds: [expect.any(Number), expect.any(Number)],
          },
        });
      });

      // Rollback test
      test('does not activate resource when nested availability windows overlap', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const inactiveResource = await createTestResource({
          owner: user,
          inactive: true,
        });

        const response = await request(app)
          .patch(`/api/resources/${inactiveResource.id}/activate`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send([
            {
              startTime: '2036-01-01T09:00:00.000Z',
              endTime: '2036-01-01T11:00:00.000Z',
              cancellationNoticeMinutes: 30,
              allowedDurations: [30],
            },
            {
              startTime: '2036-01-01T10:00:00.000Z',
              endTime: '2036-01-01T12:00:00.000Z',
              cancellationNoticeMinutes: 60,
              allowedDurations: [30],
            },
          ]);

        expectAvailabilityWindowConflictResponse(response);

        // To prove that the db did not change.
        const resource = await db.query(
          `
            SELECT is_active
            FROM resources
            WHERE id = $1
          `,
          [inactiveResource.id],
        );

        expect(resource.rows[0].is_active).toBe(false);

        const availabilityWindowCount = await db.query(
          `
            SELECT COUNT(*)::int AS count
            FROM availability_windows
            WHERE resource_id = $1
          `,
          [inactiveResource.id],
        );

        expect(availabilityWindowCount.rows[0].count).toBe(0);
      });
    });

    // To test if requireAuth is in place.
    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const inactiveResource = await createTestResource({ inactive: true });

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const inactiveResource = await createTestResource({
            owner: user,
            inactive: true,
          });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const inactiveResource = await createTestResource({ inactive: true });

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectForbiddenResponse(response);
        });

        test('when employee does not own the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });
          const inactiveResource = await createTestResource({ inactive: true });

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectForbiddenResponse(response);
        });

        test('when admin does not own the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const inactiveResource = await createTestResource({ inactive: true });

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/resources/9999999/activate')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

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
            .patch(`/api/resources/${deletedResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectResourceDeletedResponse({
            response,
            message: 'Cannot activate a deleted resource.',
          });
        });
      });

      describe('returns 409 RESOURCE_ALREADY_ACTIVE with correct response', () => {
        test('when resource is already active', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const activeResource = await createTestResource({ owner: user });

          expect(activeResource.is_active).toBe(true);

          const response = await request(app)
            .patch(`/api/resources/${activeResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESOURCE_ALREADY_ACTIVE',
              message: 'Resource is already active.',
            },
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/resources/not-a-number/activate')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });

        test('for body that is not an array', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const inactiveResource = await createTestResource({
            owner: user,
            inactive: true,
          });

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource activation request body.',
            field: 'body',
            detailsMessage: 'Availability window data list must be an array.',
          });
        });

        test('for empty body array', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const inactiveResource = await createTestResource({
            owner: user,
            inactive: true,
          });

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource activation request body.',
            field: 'body',
            detailsMessage: 'At least one availability window is required.',
          });
        });

        // Proves createAvailabilityWindowsBodySchema is in place
        // already done more testing on this schema before, so dont need to repeat.
        test('for empty nested availability window request body object', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const inactiveResource = await createTestResource({
            owner: user,
            inactive: true,
          });

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/activate`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send([{}]);

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid resource activation request body.',
              details: expect.arrayContaining([
                {
                  field: '[0].startTime',
                  message: 'Start time is required.',
                },
                {
                  field: '[0].endTime',
                  message: 'End time is required.',
                },
                {
                  field: '[0].allowedDurations',
                  message: 'Allowed durations are required.',
                },
              ]),
            },
          });
          expect(response.body.error.details).toHaveLength(3);
        });
      });
    });
  });
});
