import { beforeEach, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestResource,
  createTestUser,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import { generateRandomId } from '../../../helpers/generateRandomData.mjs';
import { wait } from '../../../helpers/asyncHelpers.mjs';

beforeEach(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('GET /manage', () => {
    describe('happy path', () => {
      test('returns 200 with correct response and default pagination shape', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [r1, r2] = await Promise.all([
          createTestResource(),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: r1.id,
              ownerId: r1.owner_id,
              name: r1.name,
              description: r1.description,
              capacity: r1.capacity,
              isActive: r1.is_active,
              createdAt: r1.created_at.toISOString(),
              updatedAt: r1.updated_at.toISOString(),
              deletedAt: r1.deleted_at,
            },
            {
              id: r2.id,
              ownerId: r2.owner_id,
              name: r2.name,
              description: r2.description,
              capacity: r2.capacity,
              isActive: r2.is_active,
              createdAt: r2.created_at.toISOString(),
              updatedAt: r2.updated_at.toISOString(),
              deletedAt: r2.deleted_at,
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

      test('returns resources filtered by status active by default', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [activeResource] = await Promise.all([
          createTestResource(),
          createTestResource({ inactive: true }),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: activeResource.id,
            isActive: true,
            deletedAt: null,
          }),
        );
      });

      test('returns resources filtered by status inactive', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [inactiveResource] = await Promise.all([
          createTestResource({ inactive: true }),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'inactive' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: inactiveResource.id,
            isActive: false,
            deletedAt: null,
          }),
        );
      });

      test('returns resources filtered by status deleted', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [deletedResource] = await Promise.all([
          createTestResource({ deleted: true }),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'deleted' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: deletedResource.id,
            isActive: false,
            deletedAt: deletedResource.deleted_at.toISOString(),
          }),
        );
      });

      test('returns resources filtered by status all', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [activeResource, inactiveResource, deletedResource] =
          await Promise.all([
            createTestResource(),
            createTestResource({ inactive: true }),
            createTestResource({ deleted: true }),
          ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'all' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: activeResource.id,
              isActive: true,
              deletedAt: null,
            }),
            expect.objectContaining({
              id: inactiveResource.id,
              isActive: false,
              deletedAt: null,
            }),
            expect.objectContaining({
              id: deletedResource.id,
              isActive: false,
              deletedAt: deletedResource.deleted_at.toISOString(),
            }),
          ]),
        );
      });

      test('returns resources filtered by ownerId', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const [targetOwner, otherOwner] = await Promise.all([
          createTestUser(),
          createTestUser(),
        ]);

        const [targetResource] = await Promise.all([
          createTestResource({ owner: targetOwner }),
          createTestResource({ owner: otherOwner }),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ ownerId: targetOwner.id });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetResource.id,
            ownerId: targetOwner.id,
          }),
        );
      });

      test('returns resources matching search by name', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const [targetResource] = await Promise.all([
          createTestResource(),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ search: targetResource.name });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetResource.id,
            name: targetResource.name,
          }),
        );
      });

      test('returns resources matching search by description', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const targetDescription = generateRandomId();

        const [targetResource] = await Promise.all([
          createTestResource({ description: targetDescription }),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ search: targetDescription });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetResource.id,
            description: targetDescription,
          }),
        );
      });

      test('returns the requested page and page size', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await Promise.all([
          createTestResource(),
          createTestResource(),
          createTestResource(),
          createTestResource(),
        ]);

        const firstPageResponse = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ page: 1, pageSize: 2 });

        const secondPageResponse = await request(app)
          .get('/api/resources/manage')
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

      test('returns resources sorted by createdAt desc by default', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await createTestResource();
        await wait(10);

        await createTestResource();
        await wait(10);

        await createTestResource();

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);

        const createdAtMsArr = response.body.data.map((resource) =>
          Date.parse(resource.createdAt),
        );

        const descCreatedAtMsArr = [...createdAtMsArr].sort((a, b) => b - a);

        expect(createdAtMsArr).toEqual(descCreatedAtMsArr);
      });

      test('returns resources sorted by updatedAt desc', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        await createTestResource();
        await wait(10);

        await createTestResource();
        await wait(10);

        await createTestResource();

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            sortBy: 'updatedAt',
            sortDirection: 'desc',
          });

        expect(response.status).toBe(200);

        const updatedAtMsArr = response.body.data.map((resource) =>
          Date.parse(resource.updatedAt),
        );

        const descUpdatedAtMsArr = [...updatedAtMsArr].sort((a, b) => b - a);

        expect(updatedAtMsArr).toEqual(descUpdatedAtMsArr);
      });

      test('returns resources sorted by name asc', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await Promise.all([
          createTestResource({ name: 'c' }),
          createTestResource({ name: 'b' }),
          createTestResource({ name: 'a' }),
        ]);

        const response = await request(app)
          .get('/api/resources/manage')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            sortBy: 'name',
            sortDirection: 'asc',
          });

        expect(response.status).toBe(200);

        const names = response.body.data.map((resource) => resource.name);

        expect(names).toEqual(['a', 'b', 'c']);
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).get('/api/resources/manage');

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
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          // Creates with user role by default.
          const { user, accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/resources/manage')
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
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ page: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'page',
            detailsMessage: 'Page must be at least 1.',
          });
        });

        test('for invalid pageSize', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ pageSize: 101 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'pageSize',
            detailsMessage: 'Page size must be at most 100.',
          });
        });

        test('for invalid sortBy', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'sortBy',
            detailsMessage:
              'Sort by must be one of createdAt, updatedAt, or name.',
          });
        });

        test('for invalid sortDirection', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortDirection: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'sortDirection',
            detailsMessage: 'Sort direction must be either asc or desc.',
          });
        });

        test('for empty search', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ search: '' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'search',
            detailsMessage: 'Search cannot be empty.',
          });
        });

        test('for invalid ownerId', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ ownerId: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'ownerId',
            detailsMessage: 'Owner id must be at least 1.',
          });
        });

        test('for invalid status', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ status: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'status',
            detailsMessage:
              'Status must be one of active, inactive, deleted, or all.',
          });
        });

        test('for unknown query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/resources/manage')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ unknown: 'unknown' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource management list query.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
