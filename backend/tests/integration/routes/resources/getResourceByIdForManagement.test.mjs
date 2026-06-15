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
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('GET /manage/:resourceId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape for active resource', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const resource = await createTestResource();

        const response = await request(app)
          .get(`/api/resources/manage/${resource.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: resource.id,
            ownerId: resource.owner_id,
            name: resource.name,
            description: resource.description,
            capacity: resource.capacity,
            isActive: true,
            createdAt: resource.created_at.toISOString(),
            updatedAt: resource.updated_at.toISOString(),
            deletedAt: null,
          },
        });
      });

      test('returns 200 for inactive resource', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const resource = await createTestResource({ inactive: true });

        const response = await request(app)
          .get(`/api/resources/manage/${resource.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(resource.id);
        expect(response.body.data.isActive).toBe(false);
        expect(response.body.data.deletedAt).toBeNull();
      });

      test('returns 200 for soft deleted resource', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const resource = await createTestResource({ deleted: true });

        const response = await request(app)
          .get(`/api/resources/manage/${resource.id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(resource.id);
        expect(response.body.data.isActive).toBe(false);
        expect(response.body.data.deletedAt).toBe(
          resource.deleted_at.toISOString(),
        );
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const resource = await createTestResource();

          const response = await request(app).get(
            `/api/resources/manage/${resource.id}`,
          );

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const resource = await createTestResource();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .get(`/api/resources/manage/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });
      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const resource = await createTestResource();

          const response = await request(app)
            .get(`/api/resources/manage/${resource.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/resources/manage/999999')
            .set('Authorization', `Bearer ${accessToken}`);

          expectResourceNotFoundResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/resources/manage/not-a-number')
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
