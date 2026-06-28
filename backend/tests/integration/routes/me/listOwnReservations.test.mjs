import { beforeEach, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestReservation,
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

// The schema and sql functions for this end point is shared with the list staff end point for reservations.
// Because of this, I dont need full testing.
describe('/api/me', () => {
  describe('GET /reservations', () => {
    describe('happy path', () => {
      test('returns 200 with correct response and default pagination shape', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [r1, r2] = await Promise.all([
          createTestReservation({ user }),
          createTestReservation({ user }),
        ]);

        const response = await request(app)
          .get('/api/me/reservations')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: r1.id,
              userId: user.id,
              resourceId: r1.resource.id,
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
              userId: user.id,
              resourceId: r2.resource.id,
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

      // Main behavior for this endpoint:
      // reservation filtering must be forced by authenticated user,
      // not by a client-provided reservationUserId.
      test('returns only reservations owned by authenticated user', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [ownedReservation] = await Promise.all([
          createTestReservation({ user }),
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/me/reservations')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: ownedReservation.id,
            userId: user.id,
          }),
        );
      });

      // Light test because status/timing/sort/pagination behavior
      // is shared with the staff reservation list schema and SQL.
      test('supports owned reservation list filters', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [targetReservation] = await Promise.all([
          createTestReservation({
            user,
            completed: true,
          }),
          createTestReservation({
            user,
          }),
          createTestReservation({
            completed: true,
          }),
        ]);

        const response = await request(app)
          .get('/api/me/reservations')
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
            userId: user.id,
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
          const response = await request(app).get('/api/me/reservations');

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
            .get('/api/me/reservations')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      // Light tests only because this endpoint reuses the owned reservation
      // list schema shape. The important endpoint-specific behavior here is
      // that staff-only query filters are rejected.

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid sortBy', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'sortBy',
            detailsMessage:
              'Sort by must be one of startTime, endTime, createdAt, or updatedAt.',
          });
        });

        // The 3 bellow are part of the staff schema but are invalid for this end point.
        test('for reservationUserId query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ reservationUserId: 1 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'reservationUserId',
            detailsMessage: '"reservationUserId" is not allowed',
          });
        });

        test('for resourceId query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ resourceId: 1 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'resourceId',
            detailsMessage: '"resourceId" is not allowed',
          });
        });

        test('for search query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ search: 'Resource name' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'search',
            detailsMessage: '"search" is not allowed',
          });
        });

        test('for timing other than all when status is not active', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({
              status: 'completed',
              timing: 'upcoming',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'timing',
            detailsMessage:
              'Timing must be all when reservation status is not active.',
          });
        });
      });
    });
  });
});
