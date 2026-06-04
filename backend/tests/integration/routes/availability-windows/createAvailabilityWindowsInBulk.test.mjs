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
import {
  buildCreateAvailabilityWindowsBulkRequestBody,
  buildCreateAvailabilityWindowRequestBody,
} from '../../../helpers/postRequestBodies.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('POST /:resourceId/availability-windows/bulk', () => {
    describe('happy path', () => {
      test('returns 201 with correct response shape', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const resource = await createTestResource({ owner: user });

        const windowBody = [
          buildCreateAvailabilityWindowRequestBody({
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          }),
          buildCreateAvailabilityWindowRequestBody({
            startTime: '2036-01-02T09:00:00.000Z',
            endTime: '2036-01-02T17:00:00.000Z',
          }),
        ];

        const response = await request(app)
          .post(`/api/resources/${resource.id}/availability-windows/bulk`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(windowBody);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          success: true,
          data: {
            availabilityWindowsCreated: 2,
            allowedDurationsCreated: 4,
            availabilityWindowIds: [1, 2],
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
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toBeDefined();

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource();

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources/99999/availability-windows/bulk')
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

          expect(deletedResource.deleted_at).toBeDefined();

          const response = await request(app)
            .post(
              `/api/resources/${deletedResource.id}/availability-windows/bulk`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectResourceDeletedResponse(response);
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
            .post(
              `/api/resources/${inactiveResource.id}/availability-windows/bulk`,
            )
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateAvailabilityWindowsBulkRequestBody());

          expectResourceInactiveResponse(response);
        });
      });

      // This proves that the bulk endpoint reaches the DB constraint
      // and that multiple windows in one request are all part of the same transaction.
      // The other test already tests for adjacency and overlap. This test should
      // just test the bulk part, if it behaves correctly.
      describe('returns 409 WINDOW_OVERLAP_OR_ADJACENCY with correct response', () => {
        test('when windows inside the same bulk request overlap', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowsBulkRequestBody({
                firstWindowOverrides: {
                  startTime: '2036-01-01T09:00:00.000Z',
                  endTime: '2036-01-01T11:00:00.000Z',
                },
                secondWindowOverrides: {
                  startTime: '2036-01-01T10:00:00.000Z',
                  endTime: '2036-01-01T12:00:00.000Z',
                },
              }),
            );

          expectAvailabilityWindowConflictResponse(response);

          // To prove that transaction rollback works
          // and no db writes persist in the db.
          const availabilityWindowCount = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM availability_windows
              WHERE resource_id = $1
            `,
            [resource.id],
          );

          expect(availabilityWindowCount.rows[0].count).toBe(0);
        });
      });

      describe('returns 400 ALLOWED_DURATION_LONGER_THAN_WINDOW with correct response', () => {
        test('when allowed duration is longer than one of the windows', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowsBulkRequestBody({
                secondWindowOverrides: {
                  startTime: '2036-01-02T09:00:00.000Z',
                  endTime: '2036-01-02T09:30:00.000Z',
                  allowedDurations: [60],
                },
              }),
            );

          expectAllowedDurationLongerThanWindowResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        // Not strictly needed, just a test to see if the resourceByIdParamsSchema is in place.
        test('for resource id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources/not-a-number/availability-windows/bulk')
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
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage:
              'Invalid availability window bulk create request body.',
            field: 'body',
            detailsMessage: 'Availability window data list must be an array.',
          });
        });

        test('for empty body array', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage:
              'Invalid availability window bulk create request body.',
            field: 'body',
            detailsMessage: 'At least one availability window is required.',
          });
        });

        test('for array item that is not an object', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(['not-an-object']);

          expectValidationErrorResponse({
            response,
            errorMessage:
              'Invalid availability window bulk create request body.',
            field: '[0]',
            detailsMessage: 'Each availability window must be an object.',
          });
        });

        // Dont need extensive testing here, just a small test to test if the
        // createAvailabilityWindowSchemaShape schema is in place nested inside the array.
        test('for invalid nested availability window field', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .post(`/api/resources/${resource.id}/availability-windows/bulk`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateAvailabilityWindowsBulkRequestBody({
                secondWindowOverrides: {
                  allowedDurations: [20],
                },
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage:
              'Invalid availability window bulk create request body.',
            field: '[1].allowedDurations[0]',
            detailsMessage: 'Allowed duration must be a 15 minute interval.',
          });
        });
      });
    });
  });
});
