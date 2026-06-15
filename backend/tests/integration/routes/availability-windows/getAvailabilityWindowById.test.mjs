import { beforeAll, afterAll, describe, test, expect } from '@jest/globals';
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
  expectForbiddenResponse,
  expectValidationErrorResponse,
  expectAvailabilityWindowNotFoundResponse,
} from '../../../helpers/assertions.mjs';
import { updateTestUserRole } from '../../../helpers/updateTestData.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/availability-windows', () => {
  describe('GET /:availabilityWindowId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          allowedDurations: [60, 30],
        });

        const response = await request(app)
          .get(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: availabilityWindow.id,
            resourceId: availabilityWindow.resource_id,
            startTime: availabilityWindow.start_time.toISOString(),
            endTime: availabilityWindow.end_time.toISOString(),
            cancellationNoticeMinutes:
              availabilityWindow.cancellation_notice_minutes,
            createdAt: availabilityWindow.created_at.toISOString(),
            updatedAt: availabilityWindow.updated_at.toISOString(),
            deletedAt: availabilityWindow.deleted_at,
            allowedDurations: [
              { id: expect.any(Number), minutes: 30 },
              { id: expect.any(Number), minutes: 60 },
            ],
          },
        });
      });

      test('returns expired window', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          expired: true,
        });

        const response = await request(app)
          .get(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(availabilityWindow.id);
        expect(response.body.data.deletedAt).toBeNull();

        // Expired is endTime <= now
        // Checks if the parsed(ms) endTime time string is <= Date.now()
        expect(Date.parse(response.body.data.endTime)).toBeLessThanOrEqual(
          Date.now(),
        );
      });

      test('returns deleted window', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          deleted: true,
        });

        const response = await request(app)
          .get(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(availabilityWindow.id);
        expect(response.body.data.deletedAt).toEqual(expect.any(String));
      });

      test('returns empty allowedDurations when window has no duration rows', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const availabilityWindow = await createTestAvailabilityWindow({
          deleted: true,
          noDurations: true,
        });

        const response = await request(app)
          .get(`/api/availability-windows/${availabilityWindow.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(availabilityWindow.id);
        expect(response.body.data.deletedAt).not.toBeNull();
        expect(response.body.data.allowedDurations).toEqual([]);
      });
    });

    // To test if requireAuth is in place
    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app).get(
            `/api/availability-windows/${availabilityWindow.id}`,
          );

          expectAuthRequiredResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'user',
          });

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .get(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });

        // To test if loadCurrentStateOfAuthUser is in place
        test('when token role is employee but current user role is user', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          await updateTestUserRole({
            userId: user.id,
            role: 'user',
          });

          const availabilityWindow = await createTestAvailabilityWindow();

          const response = await request(app)
            .get(`/api/availability-windows/${availabilityWindow.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 AVAILABILITY_WINDOW_NOT_FOUND with correct response', () => {
        test('when availability window does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/availability-windows/999999999')
            .set('Authorization', `Bearer ${accessToken}`);

          expectAvailabilityWindowNotFoundResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for availability window id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/availability-windows/not-a-number')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window id parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be a number.',
          });
        });

        test('for availability window id that is not an integer', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/availability-windows/1.5')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window id parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be an integer.',
          });
        });

        test('for availability window id less than 1', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/availability-windows/0')
            .set('Authorization', `Bearer ${accessToken}`);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid availability window id parameter.',
            field: 'availabilityWindowId',
            detailsMessage: 'Availability window id must be at least 1.',
          });
        });
      });
    });
  });
});
