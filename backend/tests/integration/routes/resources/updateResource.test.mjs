import { beforeAll, afterAll, describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestResource,
  createTestReservation,
  createTestUser,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
  expectForbiddenResponse,
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
  expectResourceDeletedResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import { wait } from '../../../helpers/asyncHelpers.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('PATCH /:resourceId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when updating name, description, and capacity', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        // To tests that inactive resources can update.
        const resource = await createTestResource({
          owner: user,
          inactive: true,
        });

        // To ensure that the old updated_at and new updated_at
        // are not in the same ms.
        await wait(10);

        const response = await request(app)
          .patch(`/api/resources/${resource.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'new resource name',
            description: 'new description',
            capacity: 20,
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            resource: {
              id: resource.id,
              ownerId: user.id,
              name: 'new resource name',
              description: 'new description',
              capacity: 20,
              isActive: false,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            reservationsCancelled: 0,
          },
        });

        // resource.updated_at is a Date object
        // so getTime() works on it.
        // This also proves my auto updated_at trigger/function
        expect(
          Date.parse(response.body.data.resource.updatedAt),
        ).toBeGreaterThan(resource.updated_at.getTime());
      });

      test('returns 200 with description updated to null', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const resource = await createTestResource({ owner: user });

        const response = await request(app)
          .patch(`/api/resources/${resource.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            description: null,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.resource.id).toBe(resource.id);
        expect(response.body.data.resource.description).toBeNull();
      });

      describe('side effects', () => {
        test('returns accurate reservationsCancelled count when capacity cancels upcoming reservations', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const bookingUser = await createTestUser();

          const resource = await createTestResource({
            owner: user,
            capacity: 10,
          });

          await createTestReservation({
            user: bookingUser,
            resource,
            partySize: 10,
          });

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              capacity: 9,
            });

          expect(response.status).toBe(200);
          expect(response.body.data.resource.id).toBe(resource.id);
          expect(response.body.data.resource.capacity).toBe(9);
          expect(response.body.data.reservationsCancelled).toBe(1);

          // The response shape and count accuracy are proven above.
          // This query prove the actual DB state is correct.
          const cancelledReservations = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM reservations
              WHERE resource_id = $1
                AND status = 'cancelled'
            `,
            [resource.id],
          );

          expect(cancelledReservations.rows[0].count).toBe(1);
        });

        test('does not cancel ongoing reservations when capacity is lowered', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const bookingUser = await createTestUser();

          const resource = await createTestResource({
            owner: user,
            capacity: 10,
          });

          // This should not be possible normally
          // but tests are not bound by service logic.
          await createTestReservation({
            user: bookingUser,
            resource,
            startTime: '2026-01-01T09:00:00Z',
            endTime: '2036-01-01T09:30:00Z',
            partySize: 10,
          });

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              capacity: 9,
            });

          expect(response.status).toBe(200);
          expect(response.body.data.resource.id).toBe(resource.id);
          expect(response.body.data.resource.capacity).toBe(9);
          expect(response.body.data.reservationsCancelled).toBe(0);

          const activeReservations = await db.query(
            `
              SELECT COUNT(*)::int AS count
              FROM reservations
              WHERE resource_id = $1
                AND status = 'active'
            `,
            [resource.id],
          );

          expect(activeReservations.rows[0].count).toBe(1);
        });
      });
    });

    // To test if requireAuth is in place
    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const resource = await createTestResource();

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .send({
              name: 'new resource name',
            });

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
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: 'new resource name',
            });

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource();

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: 'new resource name',
            });

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/resources/9999999')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: 'new resource name',
            });

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
            .patch(`/api/resources/${deletedResource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: 'new resource name',
            });

          expectResourceDeletedResponse({
            response,
            message: 'Cannot update a deleted resource.',
          });
        });
      });

      describe('returns 409 RESOURCE_NAME_ALREADY_EXISTS_FOR_OWNER with correct response', () => {
        test('when owner already has a non-deleted resource with the updated name', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const existingResource = await createTestResource({ owner: user });
          const resourceToUpdate = await createTestResource({ owner: user });

          const response = await request(app)
            .patch(`/api/resources/${resourceToUpdate.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: existingResource.name,
            });

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'RESOURCE_NAME_ALREADY_EXISTS_FOR_OWNER',
              message: 'Resource name is already in use for this owner',
            },
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/resources/not-a-number')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: 'new resource name',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });

        test('for request body that is not an object', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource update request body.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for empty request body', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource update request body.',
            field: 'body',
            detailsMessage: 'Request body must have at least one update field.',
          });
        });

        // Resource field schema sanity test:
        // create resource tests cover the individual field rules in more detail.
        // This proves the update route is wired to the same reusable field schemas.
        test('for invalid update fields', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: '#',
              description: '',
              capacity: 0,
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid resource update request body.',
              details: expect.arrayContaining([
                {
                  field: 'name',
                  message:
                    'Resource name must contain at least one letter or number.',
                },
                {
                  field: 'description',
                  message: 'Description cannot be empty.',
                },
                {
                  field: 'capacity',
                  message: 'Capacity must be at least 1.',
                },
              ]),
            },
          });

          expect(response.body.error.details).toHaveLength(3);
        });

        test('for unknown body field', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource({ owner: user });

          const response = await request(app)
            .patch(`/api/resources/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              unknown: 'unknown',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource update request body.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
