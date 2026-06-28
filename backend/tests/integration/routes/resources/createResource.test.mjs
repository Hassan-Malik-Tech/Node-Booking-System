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
  expectValidationErrorResponse,
  expectAvailabilityWindowConflictResponse,
  expectAllowedDurationLongerThanWindowResponse,
  expectNoDetailsErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import {
  buildCreateResourceRequestBody,
  buildCreateAvailabilityWindowsBulkRequestBody,
} from '../../../helpers/postRequestBodies.mjs';
import { generateRandomResourceName } from '../../../helpers/generateRandomData.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('POST /', () => {
    describe('happy path', () => {
      test('returns 201 with correct response shape for active resource with availability windows', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        // This is manual so it does not rely on the helper having 2 windows.
        const resourceReqBody = {
          resourceData: {
            name: generateRandomResourceName(),
            description: 'Test resource description',
            capacity: 10,
            isActive: true,
          },
          availabilityWindowDataList: [
            {
              startTime: '2036-01-01T09:00:00.000Z',
              endTime: '2036-01-01T17:00:00.000Z',
              cancellationNoticeMinutes: 90,
              allowedDurations: [30, 60],
            },
            {
              startTime: '2036-01-02T09:00:00.000Z',
              endTime: '2036-01-02T17:00:00.000Z',
              cancellationNoticeMinutes: 60,
              allowedDurations: [45, 60],
            },
          ],
        };

        const response = await request(app)
          .post('/api/resources')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(resourceReqBody);

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe(
          `/api/resources/${response.body.data.resource.id}`,
        );

        expect(response.body).toEqual({
          success: true,
          data: {
            resource: {
              id: expect.any(Number),
              ownerId: user.id,
              name: resourceReqBody.resourceData.name,
              description: resourceReqBody.resourceData.description,
              capacity: resourceReqBody.resourceData.capacity,
              isActive: true,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            availabilityWindowsCreated: 2,
            allowedDurationsCreated: 4,
            availabilityWindowIds: [1, 2],
          },
        });
      });

      test('returns 201 with correct response shape for inactive resource with no availability windows', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const resourceReqBody = buildCreateResourceRequestBody({
          isActive: false,
        });

        const response = await request(app)
          .post('/api/resources')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(resourceReqBody);

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe(
          `/api/resources/${response.body.data.resource.id}`,
        );

        expect(response.body).toEqual({
          success: true,
          data: {
            resource: {
              id: expect.any(Number),
              ownerId: user.id,
              name: resourceReqBody.resourceData.name,
              description: resourceReqBody.resourceData.description,
              capacity: resourceReqBody.resourceData.capacity,
              isActive: false,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            availabilityWindowsCreated: 0,
            allowedDurationsCreated: 0,
            availabilityWindowIds: [],
          },
        });
      });
    });

    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app)
            .post('/api/resources')
            .send(buildCreateResourceRequestBody());

          expectAuthRequiredResponse(response);
        });
      });

      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateResourceRequestBody());

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 409 RESOURCE_NAME_ALREADY_EXISTS_FOR_OWNER with correct response', () => {
        test('when active owner already has a non-deleted resource with the same name', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const existingResource = await createTestResource({ owner: user });

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
                name: existingResource.name,
              }),
            );

          expectNoDetailsErrorResponse({
            response,
            status: 409,
            code: 'RESOURCE_NAME_ALREADY_EXISTS_FOR_OWNER',
            message: 'Resource name is already in use for this owner',
          });
        });
      });

      describe('returns 409 WINDOW_OVERLAP_OR_ADJACENCY with correct response', () => {
        test('when nested availability windows overlap and transaction rolls back resource creation', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
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

          const resourceCount = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM resources
              WHERE owner_id = $1
            `,
            [user.id],
          );

          expect(resourceCount.rows[0].count).toBe(0);
        });
      });

      describe('returns 400 ALLOWED_DURATION_LONGER_THAN_WINDOW with correct response', () => {
        test('when nested allowed duration is longer than one of the windows', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
                firstWindowOverrides: {
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
        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for missing resourceData', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          // If resourceData is missing, resourceData.isActive cannot default to true.
          // So availabilityWindowDataList is not valid in this request.
          // Keep this body empty so the test only checks the missing resourceData error.
          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'resourceData',
            detailsMessage: 'Resource data is required.',
          });
        });

        test('for resourceData that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              resourceData: 'not-an-object',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'resourceData',
            detailsMessage: 'Resource data must be an object.',
          });
        });

        test('for missing required resourceData fields', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              resourceData: {},
              availabilityWindowDataList:
                buildCreateAvailabilityWindowsBulkRequestBody(),
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid resource create request body.',
              details: expect.arrayContaining([
                {
                  field: 'resourceData.name',
                  message: 'Resource name is required.',
                },
                {
                  field: 'resourceData.capacity',
                  message: 'Capacity is required.',
                },
              ]),
            },
          });

          expect(response.body.error.details).toHaveLength(2);
        });

        test('for resource name with multiple spaces', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
                name: 'Meeting  Room',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'resourceData.name',
            detailsMessage: 'Resource name cannot contain multiple spaces.',
          });
        });

        test('for resource name with invalid characters', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
                name: 'Meeting Room @',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'resourceData.name',
            detailsMessage:
              'Resource name can only contain letters, numbers, spaces, #, apostrophes, parentheses, and hyphens.',
          });
        });

        test('for resource name with no letter or number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
                name: '#',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'resourceData.name',
            detailsMessage:
              'Resource name must contain at least one letter or number.',
          });
        });

        test('for invalid capacity', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
                capacity: 0,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'resourceData.capacity',
            detailsMessage: 'Capacity must be at least 1.',
          });
        });

        test('for inactive resource with availabilityWindowDataList', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const resourceReqBody = buildCreateResourceRequestBody({
            isActive: false,
          });

          // isActive: false prevents windows body from being created
          // this adds it to the req body.
          resourceReqBody.availabilityWindowDataList =
            buildCreateAvailabilityWindowsBulkRequestBody();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(resourceReqBody);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'availabilityWindowDataList',
            detailsMessage:
              'Availability windows are not allowed when creating an inactive resource.',
          });
        });

        test('for missing availabilityWindowDataList when isActive is omitted', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              resourceData: {
                name: generateRandomResourceName(),
                description: 'Test resource description',
                capacity: 10,
              },
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'availabilityWindowDataList',
            detailsMessage:
              'At least one availability window is required when creating an active resource.',
          });
        });

        test('for invalid nested availability window field', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .post('/api/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateResourceRequestBody({
                firstWindowOverrides: {
                  allowedDurations: [20],
                },
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource create request body.',
            field: 'availabilityWindowDataList[0].allowedDurations[0]',
            detailsMessage: 'Allowed duration must be a 15 minute interval.',
          });
        });
      });
    });
  });
});
