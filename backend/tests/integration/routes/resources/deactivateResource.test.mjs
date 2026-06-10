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
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectResourceDeletedResponse,
  expectResourceInactiveResponse,
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('PATCH /:resourceId/deactivate', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when owner deactivates resource', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const resource = await createTestResource({ owner: user });

        const response = await request(app)
          .patch(`/api/resources/${resource.id}/deactivate`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            resource: {
              id: resource.id,
              ownerId: user.id,
              name: resource.name,
              description: resource.description,
              capacity: resource.capacity,
              isActive: false,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            availabilityWindowsDeleted: 0,
            reservationsCancelled: 0,
          },
        });
      });

      test('returns 200 when admin deactivates another user resource', async () => {
        const { user: admin, accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const resource = await createTestResource();

        const response = await request(app)
          .patch(`/api/resources/${resource.id}/deactivate`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.resource.id).toBe(resource.id);
        expect(response.body.data.resource.ownerId).not.toBe(admin.id);
        expect(response.body.data.resource.isActive).toBe(false);
      });

      // To test that requireRole is not in this end points middleware.
      test('returns 200 when employee deactivates their own resource', async () => {
        const { user: employee, accessToken } =
          await createAuthenticatedTestUser({
            role: 'employee',
          });
        const resource = await createTestResource({ owner: employee });

        const response = await request(app)
          .patch(`/api/resources/${resource.id}/deactivate`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.resource.id).toBe(resource.id);
        expect(response.body.data.resource.ownerId).toBe(employee.id);
        expect(response.body.data.resource.isActive).toBe(false);
      });
    });

    describe('side effects', () => {
      test('soft deletes current and future availability windows but not expired windows', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const resource = await createTestResource({ owner: user });

        await createTestAvailabilityWindow({
          resource,
          startTime: '2026-01-01T09:00:00Z',
          endTime: '2036-01-01T06:00:00Z',
        });

        // Future time window by default
        await createTestAvailabilityWindow({
          resource,
        });

        await createTestAvailabilityWindow({
          resource,
          expired: true,
        });

        const response = await request(app)
          .patch(`/api/resources/${resource.id}/deactivate`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.availabilityWindowsDeleted).toBe(2);

        // The response shape and count accuracy are proven above.
        // These two queries prove the actual DB state is correct.
        const deletedWindows = await db.query(
          `
            SELECT COUNT(*)::int AS count
            FROM availability_windows
            WHERE resource_id = $1
              AND deleted_at IS NOT NULL
          `,
          [resource.id],
        );

        expect(deletedWindows.rows[0].count).toBe(2);

        const expiredNotDeletedWindows = await db.query(
          `
            SELECT COUNT(*)::int AS count
            FROM availability_windows
            WHERE resource_id = $1
              AND end_time < NOW()
              AND deleted_at IS NULL
          `,
          [resource.id],
        );

        expect(expiredNotDeletedWindows.rows[0].count).toBe(1);
      });

      test('cancels upcoming reservations', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const bookingUser = await createTestUser();

        const resource = await createTestResource({ owner: user });

        await createTestReservation({
          user: bookingUser,
          resource,
        });

        const response = await request(app)
          .patch(`/api/resources/${resource.id}/deactivate`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.reservationsCancelled).toBe(1);

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

      test('does not cancel ongoing reservations', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const bookingUser = await createTestUser();

        const resource = await createTestResource({ owner: user });

        // This should not be possible normally
        // but tests are not bound by service logic.
        await createTestReservation({
          user: bookingUser,
          resource,
          startTime: '2026-01-01T09:00:00Z',
          endTime: '2036-01-01T09:30:00Z',
        });

        const response = await request(app)
          .patch(`/api/resources/${resource.id}/deactivate`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
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

    // To test if requireAuth is in place
    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const resource = await createTestResource();

          const response = await request(app).patch(
            `/api/resources/${resource.id}/deactivate`,
          );

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
            .patch(`/api/resources/${resource.id}/deactivate`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user does not own the resource and is not an admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const resource = await createTestResource();

          const response = await request(app)
            .patch(`/api/resources/${resource.id}/deactivate`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });

        test('when employee does not own the resource', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });
          const resource = await createTestResource();

          const response = await request(app)
            .patch(`/api/resources/${resource.id}/deactivate`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/resources/99999/deactivate')
            .set('Authorization', `Bearer ${accessToken}`);

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
            .patch(`/api/resources/${deletedResource.id}/deactivate`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectResourceDeletedResponse({
            response,
            message: 'Cannot deactivate a deleted resource.',
          });
        });
      });

      describe('returns 409 RESOURCE_INACTIVE with correct response', () => {
        test('when resource is already inactive', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const inactiveResource = await createTestResource({
            owner: user,
            inactive: true,
          });

          expect(inactiveResource.is_active).toBe(false);

          const response = await request(app)
            .patch(`/api/resources/${inactiveResource.id}/deactivate`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectResourceInactiveResponse({
            response,
            message: 'Resource is already inactive.',
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/resources/not-a-number/deactivate')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });
      });
    });
  });
});
