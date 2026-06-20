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
  expectAvailabilityWindowNotFoundResponse,
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('GET /:resourceId/availability-windows/:availabilityWindowId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape and ascending allowedDurations', async () => {
        // createTestAvailabilityWindow creates its own resource when no resource is passed in.
        const availabilityWindow = await createTestAvailabilityWindow({
          allowedDurations: [60, 30],
        });

        const response = await request(app).get(
          `/api/resources/${availabilityWindow.resource.id}/availability-windows/${availabilityWindow.id}`,
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: availabilityWindow.id,
            resourceId: availabilityWindow.resource.id,
            startTime: availabilityWindow.start_time.toISOString(),
            endTime: availabilityWindow.end_time.toISOString(),
            cancellationNoticeMinutes:
              availabilityWindow.cancellation_notice_minutes,
            createdAt: availabilityWindow.created_at.toISOString(),
            updatedAt: availabilityWindow.updated_at.toISOString(),
            allowedDurations: [
              { id: expect.any(Number), minutes: 30 },
              { id: expect.any(Number), minutes: 60 },
            ],
          },
        });
      });
    });

    describe('unhappy path', () => {
      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app).get(
            `/api/resources/999999/availability-windows/${availabilityWindow.id}`,
          );

          expectResourceNotFoundResponse(response);
        });

        test('when resource is inactive', async () => {
          const inactiveResource = await createTestResource({ inactive: true });

          const response = await request(app).get(
            `/api/resources/${inactiveResource.id}/availability-windows/999999`,
          );

          expectResourceNotFoundResponse(response);
        });

        test('when resource is soft deleted', async () => {
          const deletedResource = await createTestResource({ deleted: true });

          const response = await request(app).get(
            `/api/resources/${deletedResource.id}/availability-windows/999999`,
          );

          expectResourceNotFoundResponse(response);
        });
      });

      describe('returns 404 AVAILABILITY_WINDOW_NOT_FOUND with correct response', () => {
        test('when availability window does not exist', async () => {
          const resource = await createTestResource();

          const response = await request(app).get(
            `/api/resources/${resource.id}/availability-windows/99999`,
          );

          expectAvailabilityWindowNotFoundResponse({ response });
        });

        test('when availability window belongs to another resource', async () => {
          const resource = await createTestResource();
          const otherWindow = await createTestAvailabilityWindow();

          const response = await request(app).get(
            `/api/resources/${resource.id}/availability-windows/${otherWindow.id}`,
          );

          expectAvailabilityWindowNotFoundResponse({ response });
        });

        test('when availability window is expired', async () => {
          const expiredWindow = await createTestAvailabilityWindow({
            expired: true,
          });

          const response = await request(app).get(
            `/api/resources/${expiredWindow.resource.id}/availability-windows/${expiredWindow.id}`,
          );

          expectAvailabilityWindowNotFoundResponse({ response });
        });

        test('when availability window is soft deleted', async () => {
          const deletedWindow = await createTestAvailabilityWindow({
            deleted: true,
          });

          const response = await request(app).get(
            `/api/resources/${deletedWindow.resource.id}/availability-windows/${deletedWindow.id}`,
          );

          expectAvailabilityWindowNotFoundResponse({ response });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const response = await request(app).get(
            '/api/resources/not-a-number/availability-windows/1',
          );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window lookup parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });

        test('for availability window id that is not a number', async () => {
          const response = await request(app).get(
            '/api/resources/1/availability-windows/not-a-number',
          );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window lookup parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be a number.',
          });
        });
      });
    });
  });
});
