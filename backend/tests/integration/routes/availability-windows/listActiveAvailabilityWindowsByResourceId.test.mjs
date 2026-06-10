import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createTestResource,
  createTestAvailabilityWindow,
} from '../../../helpers/createTestData.mjs';
import {
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { wait } from '../../../helpers/asyncHelpers.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('GET /:resourceId/availability-windows', () => {
    describe('happy path', () => {
      test('returns 200 with correct response, ascending allowedDurations, and default pagination shape', async () => {
        const resource = await createTestResource();

        const [w1, w2] = await Promise.all([
          createTestAvailabilityWindow({
            resource,
            allowedDurations: [60, 30],
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          }),
          createTestAvailabilityWindow({
            resource,
            allowedDurations: [30, 60],
            startTime: '2036-01-02T09:00:00.000Z',
            endTime: '2036-01-02T17:00:00.000Z',
          }),
        ]);

        const response = await request(app).get(
          `/api/resources/${resource.id}/availability-windows`,
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: w1.id,
              resourceId: resource.id,
              startTime: w1.start_time.toISOString(),
              endTime: w1.end_time.toISOString(),
              cancellationNoticeMinutes: w1.cancellation_notice_minutes,
              createdAt: w1.created_at.toISOString(),
              updatedAt: w1.updated_at.toISOString(),
              allowedDurations: [
                { id: expect.any(Number), minutes: 30 },
                { id: expect.any(Number), minutes: 60 },
              ],
            },
            {
              id: w2.id,
              resourceId: resource.id,
              startTime: w2.start_time.toISOString(),
              endTime: w2.end_time.toISOString(),
              cancellationNoticeMinutes: w2.cancellation_notice_minutes,
              createdAt: w2.created_at.toISOString(),
              updatedAt: w2.updated_at.toISOString(),
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

      test('returns only active windows for the requested resource', async () => {
        const resource = await createTestResource();

        const [futureWindow] = await Promise.all([
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-03T09:00:00.000Z',
            endTime: '2036-01-03T17:00:00.000Z',
          }),
          createTestAvailabilityWindow({
            resource,
            expired: true,
          }),
          createTestAvailabilityWindow({
            resource,
            deleted: true,
          }),
        ]);

        const response = await request(app).get(
          `/api/resources/${resource.id}/availability-windows`,
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(futureWindow.id);
      });

      test('returns the requested page and page size', async () => {
        const resource = await createTestResource();

        await Promise.all([
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          }),
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-02T09:00:00.000Z',
            endTime: '2036-01-02T17:00:00.000Z',
          }),
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-03T09:00:00.000Z',
            endTime: '2036-01-03T17:00:00.000Z',
          }),
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-04T09:00:00.000Z',
            endTime: '2036-01-04T17:00:00.000Z',
          }),
        ]);

        const firstPageResponse = await request(app)
          .get(`/api/resources/${resource.id}/availability-windows`)
          .query({ page: 1, pageSize: 2 });

        const secondPageResponse = await request(app)
          .get(`/api/resources/${resource.id}/availability-windows`)
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

      test('returns windows sorted by startTime asc by default', async () => {
        const resource = await createTestResource();

        await Promise.all([
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-03T09:00:00.000Z',
            endTime: '2036-01-03T17:00:00.000Z',
          }),
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-02T09:00:00.000Z',
            endTime: '2036-01-02T17:00:00.000Z',
          }),
          createTestAvailabilityWindow({
            resource,
            startTime: '2036-01-01T09:00:00.000Z',
            endTime: '2036-01-01T17:00:00.000Z',
          }),
        ]);

        const response = await request(app).get(
          `/api/resources/${resource.id}/availability-windows`,
        );

        expect(response.status).toBe(200);

        const startTimes = response.body.data.map((window) => window.startTime);

        expect(startTimes).toEqual([
          '2036-01-01T09:00:00.000Z',
          '2036-01-02T09:00:00.000Z',
          '2036-01-03T09:00:00.000Z',
        ]);
      });

      test('returns windows sorted by createdAt desc', async () => {
        const resource = await createTestResource();

        await createTestAvailabilityWindow({
          resource,
          startTime: '2036-01-01T09:00:00.000Z',
          endTime: '2036-01-01T17:00:00.000Z',
        });
        await wait(10);

        await createTestAvailabilityWindow({
          resource,
          startTime: '2036-01-02T09:00:00.000Z',
          endTime: '2036-01-02T17:00:00.000Z',
        });
        await wait(10);

        await createTestAvailabilityWindow({
          resource,
          startTime: '2036-01-03T09:00:00.000Z',
          endTime: '2036-01-03T17:00:00.000Z',
        });

        const response = await request(app)
          .get(`/api/resources/${resource.id}/availability-windows`)
          .query({
            sortBy: 'createdAt',
            sortDirection: 'desc',
          });

        expect(response.status).toBe(200);

        const createdAtMsArr = response.body.data.map((window) =>
          Date.parse(window.createdAt),
        );

        const descCreatedAtMsArr = [...createdAtMsArr].sort((a, b) => b - a);

        expect(createdAtMsArr).toEqual(descCreatedAtMsArr);
      });
    });

    describe('unhappy path', () => {
      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const response = await request(app).get(
            '/api/resources/999999/availability-windows',
          );

          expectResourceNotFoundResponse(response);
        });

        test('when resource is inactive', async () => {
          const resource = await createTestResource({ inactive: true });

          const response = await request(app).get(
            `/api/resources/${resource.id}/availability-windows`,
          );

          expectResourceNotFoundResponse(response);
        });

        test('when resource is soft deleted', async () => {
          const resource = await createTestResource({ deleted: true });

          const response = await request(app).get(
            `/api/resources/${resource.id}/availability-windows`,
          );

          expectResourceNotFoundResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const response = await request(app).get(
            '/api/resources/not-a-number/availability-windows',
          );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });

        test('for invalid sortBy', async () => {
          const resource = await createTestResource();

          const response = await request(app)
            .get(`/api/resources/${resource.id}/availability-windows`)
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window list query.',
            field: 'sortBy',
            detailsMessage: 'Sort by must be either startTime or createdAt.',
          });
        });

        test('for invalid sortDirection', async () => {
          const resource = await createTestResource();

          const response = await request(app)
            .get(`/api/resources/${resource.id}/availability-windows`)
            .query({ sortDirection: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window list query.',
            field: 'sortDirection',
            detailsMessage: 'Sort direction must be either asc or desc.',
          });
        });

        test('for unknown query param', async () => {
          const resource = await createTestResource();

          const response = await request(app)
            .get(`/api/resources/${resource.id}/availability-windows`)
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
