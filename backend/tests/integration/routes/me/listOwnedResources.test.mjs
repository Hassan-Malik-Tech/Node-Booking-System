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

// The schema and sql functions for this end point is shared with the list resources for staff end point
// Because of this, I dont need full testing.
describe('/api/me', () => {
  describe('GET /resources', () => {
    describe('happy path', () => {
      test('returns 200 with correct response and default pagination shape', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [r1, r2, r3] = await Promise.all([
          createTestResource({ owner: user }),
          createTestResource({ owner: user, deleted: true }),
          createTestResource({ owner: user, inactive: true }),
        ]);

        const response = await request(app)
          .get('/api/me/resources')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'all' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: r1.id,
              ownerId: user.id,
              name: r1.name,
              description: r1.description,
              capacity: r1.capacity,
              isActive: true,
              createdAt: r1.created_at.toISOString(),
              updatedAt: r1.updated_at.toISOString(),
              deletedAt: null,
            },
            {
              id: r2.id,
              ownerId: user.id,
              name: r2.name,
              description: r2.description,
              capacity: r2.capacity,
              isActive: false,
              createdAt: r2.created_at.toISOString(),
              updatedAt: r2.updated_at.toISOString(),
              deletedAt: r2.deleted_at.toISOString(),
            },
            {
              id: r3.id,
              ownerId: user.id,
              name: r3.name,
              description: r3.description,
              capacity: r3.capacity,
              isActive: false,
              createdAt: r3.created_at.toISOString(),
              updatedAt: r3.updated_at.toISOString(),
              deletedAt: null,
            },
          ]),
          pagination: {
            page: 1,
            pageSize: 10,
            total: 3,
            totalPages: 1,
          },
        });

        expect(response.body.data).toHaveLength(3);
      });

      // Main behavior for this endpoint:
      // resource filtering must be forced by authenticated owner,
      // not by a client-provided ownerId.
      test('returns only resources owned by authenticated user', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [ownedResource] = await Promise.all([
          createTestResource({ owner: user }),
          createTestResource(),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/me/resources')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: ownedResource.id,
            ownerId: user.id,
          }),
        );
      });

      // Light test because status/search/sort/pagination behavior
      // is shared with the staff resource list schema and SQL.
      test('supports owner resource list filters', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();

        const [targetResource] = await Promise.all([
          createTestResource({
            owner: user,
            inactive: true,
            name: 'Owner Filter Target',
          }),
          createTestResource({
            owner: user,
            inactive: true,
          }),
          createTestResource({
            owner: user,
          }),
        ]);

        const response = await request(app)
          .get('/api/me/resources')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            status: 'inactive',
            search: 'Owner Filter Target',
            sortBy: 'name',
            sortDirection: 'asc',
            page: 1,
            pageSize: 1,
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toEqual(
          expect.objectContaining({
            id: targetResource.id,
            ownerId: user.id,
            name: 'Owner Filter Target',
            isActive: false,
            deletedAt: null,
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
          const response = await request(app).get('/api/me/resources');

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
            .get('/api/me/resources')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      // Light tests only because this endpoint reuses the resource owner list schema shape.
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid sortBy', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'sortBy',
            detailsMessage:
              'Sort by must be one of createdAt, updatedAt, or name.',
          });
        });

        test('for ownerId query param', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/me/resources')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ ownerId: 1 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'ownerId',
            detailsMessage: '"ownerId" is not allowed',
          });
        });
      });
    });
  });
});
