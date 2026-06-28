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
  createTestUser,
  createTestResource,
  createTestAvailabilityWindow,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectValidationErrorResponse,
  expectReservationsListResponse,
} from '../../../helpers/assertions.mjs';
import {
  softDeleteTestUser,
  updateTestUserRole,
} from '../../../helpers/updateTestData.mjs';
import { wait } from '../../../helpers/asyncHelpers.mjs';

beforeEach(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/reservations', () => {
  describe('GET /', () => {
    describe('happy path', () => {
      test('returns 200 with correct response and default pagination shape', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [r1, r2] = await Promise.all([
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'active' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: r1.id,
              userId: r1.user.id,
              resourceId: r1.resource.id,
              availabilityWindowId: r1.availabilityWindow.id,
              startTime: r1.start_time.toISOString(),
              endTime: r1.end_time.toISOString(),
              partySize: r1.party_size,
              status: 'active',
              staffCompletedByUserId: r1.staff_completed_by_user_id,
              systemCompletedAt: null,
              staffCompletedAt: null,
              cancelledAt: null,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            {
              id: r2.id,
              userId: r2.user.id,
              resourceId: r2.resource.id,
              availabilityWindowId: r2.availabilityWindow.id,
              startTime: r2.start_time.toISOString(),
              endTime: r2.end_time.toISOString(),
              partySize: r2.party_size,
              status: 'active',
              staffCompletedByUserId: r2.staff_completed_by_user_id,
              systemCompletedAt: null,
              staffCompletedAt: null,
              cancelledAt: null,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
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

      test('returns active ongoing and upcoming reservations by default', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [upcomingReservation, ongoingReservation] = await Promise.all([
          createTestReservation(),
          createTestReservation({ ongoing: true }),
          createTestReservation({ expired: true }),
          createTestReservation({ cancelled: true }),
          createTestReservation({ completed: true }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`);

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 2,
              totalPages: 1,
            },
          },
          [upcomingReservation, 'active'],
          [ongoingReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(2);
      });

      test('returns reservations filtered by status completed', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [completedReservation] = await Promise.all([
          createTestReservation({ completed: true }),
          createTestReservation(),
          createTestReservation({ cancelled: true }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'completed' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [completedReservation, 'completed'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns reservations filtered by status cancelled', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [cancelledReservation] = await Promise.all([
          createTestReservation({ cancelled: true }),
          createTestReservation(),
          createTestReservation({ completed: true }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'cancelled' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [cancelledReservation, 'cancelled'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns reservations filtered by status all', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [activeReservation, completedReservation, cancelledReservation] =
          await Promise.all([
            createTestReservation(),
            createTestReservation({ completed: true }),
            createTestReservation({ cancelled: true }),
          ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'all' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 3,
              totalPages: 1,
            },
          },
          [activeReservation, 'active'],
          [completedReservation, 'completed'],
          [cancelledReservation, 'cancelled'],
        );

        expect(response.body.data).toHaveLength(3);
      });

      test('returns active upcoming reservations when timing is upcoming', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [upcomingReservation] = await Promise.all([
          createTestReservation(),
          createTestReservation({ ongoing: true }),
          createTestReservation({ expired: true }),
          createTestReservation({ cancelled: true }),
          createTestReservation({ completed: true }),
        ]);

        // status is manually set to acitve to prove
        // that it can be manually set.
        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'active', timing: 'upcoming' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [upcomingReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns active ongoing reservations when timing is ongoing', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [ongoingReservation] = await Promise.all([
          createTestReservation({ ongoing: true }),
          createTestReservation(),
          createTestReservation({ expired: true }),
          createTestReservation({ cancelled: true }),
          createTestReservation({ completed: true }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ timing: 'ongoing' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [ongoingReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns active ongoing and upcoming reservations when timing is ongoingAndUpcoming', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [ongoingReservation, upcomingReservation] = await Promise.all([
          createTestReservation({ ongoing: true }),
          createTestReservation(),
          createTestReservation({ expired: true }),
          createTestReservation({ cancelled: true }),
          createTestReservation({ completed: true }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ timing: 'ongoingAndUpcoming' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 2,
              totalPages: 1,
            },
          },
          [ongoingReservation, 'active'],
          [upcomingReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(2);
      });

      test('returns active past reservations when timing is past', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [pastReservation] = await Promise.all([
          createTestReservation({ expired: true }),
          createTestReservation(),
          createTestReservation({ ongoing: true }),
          createTestReservation({ cancelled: true }),
          createTestReservation({ completed: true }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ timing: 'past' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [pastReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns active reservations across all timings when timing is all', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [upcomingReservation, ongoingReservation, pastReservation] =
          await Promise.all([
            createTestReservation(),
            createTestReservation({ ongoing: true }),
            createTestReservation({ expired: true }),
            createTestReservation({ cancelled: true }),
            createTestReservation({ completed: true }),
          ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ timing: 'all' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 3,
              totalPages: 1,
            },
          },
          [upcomingReservation, 'active'],
          [ongoingReservation, 'active'],
          [pastReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(3);
      });

      test('returns reservations filtered by resourceId', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [targetReservation] = await Promise.all([
          createTestReservation(),
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ resourceId: targetReservation.resource.id });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [targetReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns reservations filtered by resourceOwnerId', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [targetReservation] = await Promise.all([
          createTestReservation(),
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ resourceOwnerId: targetReservation.resource.owner_id });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [targetReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns reservations filtered by reservationUserId', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [targetReservation] = await Promise.all([
          createTestReservation(),
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ reservationUserId: targetReservation.user_id });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [targetReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns reservations filtered by availabilityWindowId', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [targetReservation] = await Promise.all([
          createTestReservation(),
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            availabilityWindowId: targetReservation.availability_window_id,
          });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [targetReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns reservations filtered by resource name search', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const targetResource = await createTestResource({
          name: 'Search',
        });

        const [targetReservation] = await Promise.all([
          createTestReservation({ resource: targetResource }),
          createTestReservation(),
          createTestReservation(),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ search: 'Search' });

        expectReservationsListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          [targetReservation, 'active'],
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns reservations sorted by startTime asc by default', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          startTime: '2036-01-01T09:00:00Z',
          endTime: '2036-01-01T17:00:00Z',
          allowedDurations: [30],
        });

        await Promise.all([
          createTestReservation({
            availabilityWindow,
            startTime: '2036-01-01T10:00:00Z',
            endTime: '2036-01-01T10:30:00Z',
          }),
          createTestReservation({
            availabilityWindow,
            startTime: '2036-01-01T09:30:00Z',
            endTime: '2036-01-01T10:00:00Z',
          }),
          createTestReservation({
            availabilityWindow,
            startTime: '2036-01-01T09:00:00Z',
            endTime: '2036-01-01T09:30:00Z',
          }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);

        const startTimes = response.body.data.map(
          (reservation) => reservation.startTime,
        );

        expect(startTimes).toEqual([
          '2036-01-01T09:00:00.000Z',
          '2036-01-01T09:30:00.000Z',
          '2036-01-01T10:00:00.000Z',
        ]);
      });

      test('returns reservations sorted by endTime desc', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          startTime: '2036-01-01T09:00:00Z',
          endTime: '2036-01-01T17:00:00Z',
          allowedDurations: [30],
        });

        await Promise.all([
          createTestReservation({
            availabilityWindow,
            startTime: '2036-01-01T09:00:00Z',
            endTime: '2036-01-01T09:30:00Z',
          }),
          createTestReservation({
            availabilityWindow,
            startTime: '2036-01-01T09:30:00Z',
            endTime: '2036-01-01T10:00:00Z',
          }),
          createTestReservation({
            availabilityWindow,
            startTime: '2036-01-01T10:00:00Z',
            endTime: '2036-01-01T10:30:00Z',
          }),
        ]);

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            sortBy: 'endTime',
            sortDirection: 'desc',
          });

        expect(response.status).toBe(200);

        const endTimes = response.body.data.map(
          (reservation) => reservation.endTime,
        );

        expect(endTimes).toEqual([
          '2036-01-01T10:30:00.000Z',
          '2036-01-01T10:00:00.000Z',
          '2036-01-01T09:30:00.000Z',
        ]);
      });

      test('returns reservations sorted by createdAt desc', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await createTestReservation();
        await wait(10);

        await createTestReservation();
        await wait(10);

        await createTestReservation();

        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            sortBy: 'createdAt',
            sortDirection: 'desc',
          });

        expect(response.status).toBe(200);

        const createdAtMsArr = response.body.data.map((reservation) =>
          Date.parse(reservation.createdAt),
        );

        const descCreatedAtMsArr = [...createdAtMsArr].sort((a, b) => b - a);

        expect(createdAtMsArr).toEqual(descCreatedAtMsArr);
      });

      test('returns the requested page and page size', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await Promise.all([
          createTestReservation(),
          createTestReservation(),
          createTestReservation(),
          createTestReservation(),
        ]);

        const firstPageResponse = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ page: 1, pageSize: 2 });

        const secondPageResponse = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ page: 2, pageSize: 2 });

        expect(firstPageResponse.status).toBe(200);
        expect(secondPageResponse.status).toBe(200);

        expect(firstPageResponse.body.data).toHaveLength(2);
        expect(secondPageResponse.body.data).toHaveLength(2);

        expect(firstPageResponse.body.pagination).toEqual({
          page: 1,
          pageSize: 2,
          total: 4,
          totalPages: 2,
        });

        expect(secondPageResponse.body.pagination).toEqual({
          page: 2,
          pageSize: 2,
          total: 4,
          totalPages: 2,
        });
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).get('/api/reservations');

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid page', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ page: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'page',
            detailsMessage: 'Page must be at least 1.',
          });
        });

        test('for invalid pageSize', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ pageSize: 101 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'pageSize',
            detailsMessage: 'Page size must be at most 100.',
          });
        });

        test('for invalid sortBy', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
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

        test('for invalid sortDirection', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortDirection: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'sortDirection',
            detailsMessage: 'Sort direction must be either asc or desc.',
          });
        });

        test('for invalid resourceId', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ resourceId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be at least 1.',
          });
        });

        test('for invalid resourceOwnerId', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ resourceOwnerId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'resourceOwnerId',
            detailsMessage: 'Resource owner id must be at least 1.',
          });
        });

        test('for invalid reservationUserId', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ reservationUserId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'reservationUserId',
            detailsMessage: 'Reservation user id must be at least 1.',
          });
        });

        test('for invalid availabilityWindowId', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ availabilityWindowId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be at least 1.',
          });
        });

        test('for empty search', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ search: '' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'search',
            detailsMessage: 'Search cannot be empty.',
          });
        });

        test('for invalid status', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ status: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'status',
            detailsMessage:
              'Status must be one of active, completed, cancelled, or all.',
          });
        });

        test('for invalid timing', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ timing: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'timing',
            detailsMessage:
              'Timing must be one of upcoming, ongoing, ongoingAndUpcoming, past, or all.',
          });
        });

        test('for timing other than all when status is completed', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations')
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

        test('for timing other than all when status is cancelled', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({
              status: 'cancelled',
              timing: 'ongoing',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'timing',
            detailsMessage:
              'Timing must be all when reservation status is not active.',
          });
        });

        test('for timing other than all when status is all', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({
              status: 'all',
              timing: 'past',
            });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'timing',
            detailsMessage:
              'Timing must be all when reservation status is not active.',
          });
        });

        test('for unknown query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ unknown: 'unknown' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid reservation list query.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
