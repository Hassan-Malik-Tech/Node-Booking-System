import { beforeEach, afterAll, describe, expect, test } from '@jest/globals';
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
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';

beforeEach(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/me', () => {
  describe('GET /resources/reservations', () => {
    describe('happy path', () => {
      test('returns 200 with correct response and default pagination shape', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const resource = await createTestResource({ owner: user });

        const [r1, r2] = await Promise.all([
          createTestReservation({
            resource,
            windowStartTime: '2036-01-01T09:00:00Z',
            windowEndTime: '2036-01-01T17:00:00Z',
          }),
          createTestReservation({
            resource,
            windowStartTime: '2036-01-02T09:00:00Z',
            windowEndTime: '2036-01-02T17:00:00Z',
          }),
        ]);

        const response = await request(app)
          .get('/api/me/resources/reservations')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: r1.id,
              userId: r1.user.id,
              resourceId: resource.id,
              availabilityWindowId: r1.availabilityWindow.id,
              startTime: r1.start_time.toISOString(),
              endTime: r1.end_time.toISOString(),
              partySize: r1.party_size,
              status: 'active',
              completedAt: null,
              cancelledAt: null,
              createdAt: r1.created_at.toISOString(),
              updatedAt: r1.updated_at.toISOString(),
            },
            {
              id: r2.id,
              userId: r2.user.id,
              resourceId: resource.id,
              availabilityWindowId: r2.availabilityWindow.id,
              startTime: r2.start_time.toISOString(),
              endTime: r2.end_time.toISOString(),
              partySize: r2.party_size,
              status: 'active',
              completedAt: null,
              cancelledAt: null,
              createdAt: r2.created_at.toISOString(),
              updatedAt: r2.updated_at.toISOString(),
            },
          ]),
          pagination: {
            page: 1,
            pageSize: 10,
            total: 2,
            totalPages: 1,
          },
        });

        expect(response.body.data).toHaveLength(2);
      });

      test('returns only reservations for resources owned by authenticated user', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const ownedResource = await createTestResource({ owner: user });

        const [ownedResourceReservation] = await Promise.all([
          createTestReservation({ resource: ownedResource }),
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/me/resources/reservations')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: ownedResourceReservation.id,
            resourceId: ownedResource.id,
          }),
        );
      });

      test('returns reservations filtered by resourceId', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [targetResource, otherResource] = await Promise.all([
          createTestResource({ owner: user }),
          createTestResource({ owner: user }),
        ]);

        const [targetReservation] = await Promise.all([
          createTestReservation({ resource: targetResource }),
          createTestReservation({ resource: otherResource }),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/me/resources/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ resourceId: targetResource.id });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetReservation.id,
            resourceId: targetResource.id,
          }),
        );
      });

      test('returns reservations filtered by reservationUserId', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const resource = await createTestResource({ owner: user });
        const reservationUser = await createTestUser();

        const [targetReservation] = await Promise.all([
          createTestReservation({
            user: reservationUser,
            resource,
            windowStartTime: '2036-01-01T09:00:00Z',
            windowEndTime: '2036-01-01T17:00:00Z',
          }),
          createTestReservation({
            resource,
            windowStartTime: '2036-01-02T09:00:00Z',
            windowEndTime: '2036-01-02T17:00:00Z',
          }),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/me/resources/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ reservationUserId: reservationUser.id });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetReservation.id,
            userId: reservationUser.id,
            resourceId: resource.id,
          }),
        );
      });

      test('returns reservations filtered by availabilityWindowId', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const resource = await createTestResource({ owner: user });

        const [targetReservation] = await Promise.all([
          createTestReservation({
            resource,
            windowStartTime: '2036-01-01T09:00:00Z',
            windowEndTime: '2036-01-01T17:00:00Z',
          }),
          createTestReservation({
            resource,
            windowStartTime: '2036-01-02T09:00:00Z',
            windowEndTime: '2036-01-02T17:00:00Z',
          }),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/me/resources/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            availabilityWindowId: targetReservation.availabilityWindow.id,
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetReservation.id,
            availabilityWindowId: targetReservation.availabilityWindow.id,
            resourceId: resource.id,
          }),
        );
      });

      test('returns reservations filtered by resource name search', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [targetResource, otherResource] = await Promise.all([
          createTestResource({
            owner: user,
            name: 'Owned Reservation Search',
          }),
          createTestResource({ owner: user }),
        ]);

        const [targetReservation] = await Promise.all([
          createTestReservation({ resource: targetResource }),
          createTestReservation({ resource: otherResource }),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/me/resources/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ search: 'Reservation Search' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetReservation.id,
            resourceId: targetResource.id,
          }),
        );
      });

      test('supports shared reservation list filters', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const resource = await createTestResource({ owner: user });

        const [targetReservation] = await Promise.all([
          createTestReservation({
            resource,
            completed: true,
            windowStartTime: '2036-01-01T09:00:00Z',
            windowEndTime: '2036-01-01T17:00:00Z',
          }),
          createTestReservation({
            resource,
            windowStartTime: '2036-01-02T09:00:00Z',
            windowEndTime: '2036-01-02T17:00:00Z',
          }),
          createTestReservation({
            completed: true,
          }),
        ]);

        const response = await request(app)
          .get('/api/me/resources/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            status: 'completed',
            timing: 'all',
            sortBy: 'createdAt',
            sortDirection: 'desc',
            page: 1,
            pageSize: 1,
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetReservation.id,
            resourceId: resource.id,
            status: 'completed',
            completedAt: targetReservation.system_completed_at.toISOString(),
            cancelledAt: null,
          }),
        );

        expect(response.body.pagination).toEqual({
          page: 1,
          pageSize: 1,
          total: 1,
          totalPages: 1,
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through meRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).get(
            '/api/me/resources/reservations',
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place through meRouter.use.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid sortBy', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid owned resource reservation list query.',
            field: 'sortBy',
            detailsMessage:
              'Sort by must be one of startTime, endTime, createdAt, or updatedAt.',
          });
        });

        test('for resourceOwnerId query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ resourceOwnerId: 1 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid owned resource reservation list query.',
            field: 'resourceOwnerId',
            detailsMessage: '"resourceOwnerId" is not allowed',
          });
        });

        test('for invalid resourceId', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ resourceId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid owned resource reservation list query.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be at least 1.',
          });
        });

        test('for invalid reservationUserId', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ reservationUserId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid owned resource reservation list query.',
            field: 'reservationUserId',
            detailsMessage: 'Reservation user id must be at least 1.',
          });
        });

        test('for invalid availabilityWindowId', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ availabilityWindowId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid owned resource reservation list query.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be at least 1.',
          });
        });

        test('for empty search', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ search: '' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid owned resource reservation list query.',
            field: 'search',
            detailsMessage: 'Search cannot be empty.',
          });
        });

        test('for timing other than all when status is not active', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({
              status: 'completed',
              timing: 'upcoming',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid owned resource reservation list query.',
            field: 'timing',
            detailsMessage:
              'Timing must be all when reservation status is not active.',
          });
        });
      });
    });
  });
});
