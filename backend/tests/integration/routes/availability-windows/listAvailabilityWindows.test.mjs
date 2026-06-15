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
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
  expectValidationErrorResponse,
  expectForbiddenResponse,
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

describe('/api/availability-windows', () => {
  describe('GET /', () => {
    describe('happy path', () => {
      test('returns 200 with correct response, ascending allowedDurations and default pagination shape', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [w1, w2] = await Promise.all([
          // allowedDurations is created in desc order to prove
          // that the response sends it in asc order.
          createTestAvailabilityWindow({ allowedDurations: [60, 30] }),
          createTestAvailabilityWindow({ allowedDurations: [60, 30] }),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: w1.id,
              resourceId: w1.resource_id,
              startTime: w1.start_time.toISOString(),
              endTime: w1.end_time.toISOString(),
              cancellationNoticeMinutes: w1.cancellation_notice_minutes,
              createdAt: w1.created_at.toISOString(),
              updatedAt: w1.updated_at.toISOString(),
              deletedAt: w1.deleted_at,
              allowedDurations: [
                { id: expect.any(Number), minutes: 30 },
                { id: expect.any(Number), minutes: 60 },
              ],
            },
            {
              id: w2.id,
              resourceId: w2.resource_id,
              startTime: w2.start_time.toISOString(),
              endTime: w2.end_time.toISOString(),
              cancellationNoticeMinutes: w2.cancellation_notice_minutes,
              createdAt: w2.created_at.toISOString(),
              updatedAt: w2.updated_at.toISOString(),
              deletedAt: w2.deleted_at,
              allowedDurations: [
                { id: expect.any(Number), minutes: 30 },
                { id: expect.any(Number), minutes: 60 },
              ],
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

      test('returns active windows by default', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [activeWindow] = await Promise.all([
          createTestAvailabilityWindow(),
          createTestAvailabilityWindow({ expired: true }),
          createTestAvailabilityWindow({ deleted: true }),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(activeWindow.id);
      });

      test('returns expired windows when status is expired', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [expiredWindow] = await Promise.all([
          createTestAvailabilityWindow({ expired: true }),
          createTestAvailabilityWindow(),
          createTestAvailabilityWindow({ deleted: true }),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'expired' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(expiredWindow.id);
      });

      test('returns deleted windows when status is deleted', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [deletedWindow] = await Promise.all([
          createTestAvailabilityWindow({ deleted: true }),
          createTestAvailabilityWindow(),
          createTestAvailabilityWindow({ expired: true }),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'deleted' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(deletedWindow.id);
      });

      test('returns all windows when status is all', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [activeWindow, expiredWindow, deletedWindow] = await Promise.all([
          createTestAvailabilityWindow(),
          createTestAvailabilityWindow({ expired: true }),
          createTestAvailabilityWindow({ deleted: true }),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'all' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: activeWindow.id }),
            expect.objectContaining({ id: expiredWindow.id }),
            expect.objectContaining({ id: deletedWindow.id }),
          ]),
        );
      });

      test('returns windows filtered by resourceId', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [targetWindow] = await Promise.all([
          createTestAvailabilityWindow(),
          createTestAvailabilityWindow(),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ resourceId: targetWindow.resource_id });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].resourceId).toBe(targetWindow.resource_id);
      });

      test('returns windows filtered by ownerId', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [targetWindow] = await Promise.all([
          createTestAvailabilityWindow(),
          createTestAvailabilityWindow(),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ ownerId: targetWindow.resource.owner.id });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetWindow.id,
            resourceId: targetWindow.resource.id,
          }),
        );
      });

      test('returns windows sorted by startTime asc by default', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        await Promise.all([
          createTestAvailabilityWindow({
            startTime: '2036-01-01T09:00:00Z',
            endTime: '2036-01-01T17:00:00Z',
          }),
          createTestAvailabilityWindow({
            startTime: '2036-01-02T09:00:00Z',
            endTime: '2036-01-02T17:00:00Z',
          }),
          createTestAvailabilityWindow({
            startTime: '2036-01-03T09:00:00Z',
            endTime: '2036-01-03T17:00:00Z',
          }),
        ]);

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);

        const startTimes = response.body.data.map((window) => window.startTime);

        // Even if your input has only seconds, the JSON response includes milliseconds
        expect(startTimes).toEqual([
          '2036-01-01T09:00:00.000Z',
          '2036-01-02T09:00:00.000Z',
          '2036-01-03T09:00:00.000Z',
        ]);
      });

      test('returns windows sorted by deletedAt desc', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await createTestAvailabilityWindow({
          deleted: true,
          noDurations: true,
        });
        await wait(10);

        await createTestAvailabilityWindow({
          deleted: true,
          noDurations: true,
        });
        await wait(10);

        await createTestAvailabilityWindow({
          deleted: true,
          noDurations: true,
        });

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            status: 'deleted',
            sortBy: 'deletedAt',
            sortDirection: 'desc',
          });

        expect(response.status).toBe(200);

        const deletedAtMsArr = response.body.data.map((window) =>
          Date.parse(window.deletedAt),
        );

        const descDeletedAtMsArr = [...deletedAtMsArr].sort((a, b) => b - a);

        expect(deletedAtMsArr).toEqual(descDeletedAtMsArr);
      });

      test('returns empty allowedDurations when window has no duration rows', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await createTestAvailabilityWindow({
          deleted: true,
          noDurations: true,
        });

        const response = await request(app)
          .get('/api/availability-windows')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'deleted' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].allowedDurations).toEqual([]);
      });
    });

    describe('unhappy path', () => {
      // Full auth middleware testing is covered by GET /api/me.
      // This route keeps one requireAuth test and one loadCurrentStateOfAuthUser test
      // just ot see if the route uses these middlewares.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).get('/api/availability-windows');

          expectAuthRequiredResponse(response);
        });
      });

      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .get('/api/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      // This also acts ass another test for loadCurrentStateOfAuthUser.
      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          await updateTestUserRole({
            userId: user.id,
            role: 'user',
          });

          const response = await request(app)
            .get('/api/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      // Since page, pageSize, and sortDirection are in a common schema
      // that all list endpoints use, testing it is not strictly needed.
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid sortBy', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window list query.',
            field: 'sortBy',
            detailsMessage:
              'Sort by must be one of startTime, endTime, createdAt, updatedAt, or deletedAt.',
          });
        });

        test('for invalid status', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ status: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window list query.',
            field: 'status',
            detailsMessage:
              'Status must be one of active, expired, deleted, or all.',
          });
        });

        test('for invalid resourceId', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ resourceId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window list query.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be at least 1.',
          });
        });

        test('for invalid ownerId', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ ownerId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window list query.',
            field: 'ownerId',
            detailsMessage: 'Owner id must be at least 1.',
          });
        });

        test('for unknown query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/availability-windows')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ unknown: 'unknown' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window list query.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
