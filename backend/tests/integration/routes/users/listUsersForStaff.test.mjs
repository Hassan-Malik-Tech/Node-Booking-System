import { beforeEach, afterAll, describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  createAuthenticatedTestUser,
  createTestUser,
} from '../../../helpers/createTestData.mjs';
import {
  expectAuthRequiredResponse,
  expectForbiddenResponse,
  expectInvalidTokenResponse,
  expectValidationErrorResponse,
  expectUsersListResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import { wait } from '../../../helpers/asyncHelpers.mjs';

beforeEach(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/users', () => {
  describe('GET /', () => {
    describe('happy path', () => {
      test('returns 200 with correct response and default pagination shape', async () => {
        const { user: employee, accessToken } =
          await createAuthenticatedTestUser({
            role: 'employee',
          });

        const [u1, u2] = await Promise.all([
          createTestUser(),
          createTestUser(),
        ]);

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: employee.id,
              username: employee.username,
              name: employee.name,
              email: employee.email,
              role: employee.role,
              createdAt: employee.created_at.toISOString(),
              updatedAt: employee.updated_at.toISOString(),
              deletedAt: null,
            },
            {
              id: u1.id,
              username: u1.username,
              name: u1.name,
              email: u1.email,
              role: u1.role,
              createdAt: u1.created_at.toISOString(),
              updatedAt: u1.updated_at.toISOString(),
              deletedAt: null,
            },
            {
              id: u2.id,
              username: u2.username,
              name: u2.name,
              email: u2.email,
              role: u2.role,
              createdAt: u2.created_at.toISOString(),
              updatedAt: u2.updated_at.toISOString(),
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

      test('returns users filtered by status active by default', async () => {
        const { user: admin, accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const deletedUser = await createTestUser();

        await softDeleteTestUser(deletedUser.id);

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`);

        expectUsersListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          { user: admin, deletedAt: null },
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns users filtered by status deleted', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const toBeDeletedUser = await createTestUser();

        const deletedUser = await softDeleteTestUser(toBeDeletedUser.id);

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'deleted' });

        expectUsersListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          {
            user: deletedUser,
            deletedAt: deletedUser.deleted_at.toISOString(),
          },
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns users filtered by status all', async () => {
        const { user: employee, accessToken } =
          await createAuthenticatedTestUser({
            role: 'employee',
          });
        const toBeDeletedUser = await createTestUser();

        const deletedUser = await softDeleteTestUser(toBeDeletedUser.id);

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ status: 'all' });

        expectUsersListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 2,
              totalPages: 1,
            },
          },
          { user: employee, deletedAt: null },
          {
            user: deletedUser,
            deletedAt: deletedUser.deleted_at.toISOString(),
          },
        );

        expect(response.body.data).toHaveLength(2);
      });

      test('returns users filtered by the role user', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const user = await createTestUser();

        await createTestUser({ role: 'admin' });

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ role: 'user' });

        expectUsersListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          { user, role: 'user' },
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns users filtered by the role employee', async () => {
        const { user: employee, accessToken } =
          await createAuthenticatedTestUser({
            role: 'employee',
          });

        await createTestUser();
        await createTestUser({ role: 'admin' });

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ role: 'employee' });

        expectUsersListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          { user: employee, role: 'employee' },
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns users filtered by the role admin', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });
        const admin = await createTestUser({ role: 'admin' });

        await createTestUser();

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ role: 'admin' });

        expectUsersListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          { user: admin, role: 'admin' },
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns users filtered by search', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const matchingUser = await createTestUser({
          username: 'search_user_match',
          email: 'search-match@example.com',
          name: 'Search Match',
        });

        await createTestUser({
          username: 'not_matching_user',
          email: 'not-matching@example.com',
          name: 'Not Matching',
        });

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ search: 'search' });

        expectUsersListResponse(
          {
            response,
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
            },
          },
          { user: matchingUser },
        );

        expect(response.body.data).toHaveLength(1);
      });

      test('returns users sorted by createdAt desc by default', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });
        await wait(10);

        await createTestUser();
        await wait(10);

        await createTestUser();
        await wait(10);

        await createTestUser();

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);

        const createdAtMsArr = response.body.data.map((user) =>
          Date.parse(user.createdAt),
        );

        const descCreatedAtMsArr = [...createdAtMsArr].sort((a, b) => b - a);

        expect(createdAtMsArr).toEqual(descCreatedAtMsArr);
      });

      test('returns users sorted by updatedAt desc', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        await wait(10);

        await createTestUser();
        await wait(10);

        await createTestUser({ role: 'employee' });
        await wait(10);

        await createTestUser({ role: 'admin' });

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            sortBy: 'updatedAt',
            sortDirection: 'desc',
          });

        expect(response.status).toBe(200);

        const updatedAtMsArr = response.body.data.map((user) =>
          Date.parse(user.updatedAt),
        );

        const descUpdatedAtMsArr = [...updatedAtMsArr].sort((a, b) => b - a);

        expect(updatedAtMsArr).toEqual(descUpdatedAtMsArr);
      });

      test('returns users sorted by deletedAt desc with nulls last', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        const activeUser = await createTestUser();

        const toBeDeletedUser1 = await createTestUser();
        const deletedUser1 = await softDeleteTestUser(toBeDeletedUser1.id);

        await wait(10);

        const toBeDeletedUser2 = await createTestUser();
        const deletedUser2 = await softDeleteTestUser(toBeDeletedUser2.id);

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            status: 'all',
            sortBy: 'deletedAt',
            sortDirection: 'desc',
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(4);

        const [firstUser, secondUser, thirdUser, fourthUser] =
          response.body.data;

        expect(firstUser.id).toBe(deletedUser2.id);
        expect(secondUser.id).toBe(deletedUser1.id);
        expect(thirdUser.deletedAt).toBeNull();
        expect(fourthUser.deletedAt).toBeNull();
      });

      test('returns users sorted by username asc', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        await Promise.all([
          createTestUser({ username: 'c_user' }),
          createTestUser({ username: 'b_user' }),
          createTestUser({ username: 'a_user' }),
        ]);

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({
            sortBy: 'username',
            sortDirection: 'asc',
          });

        expect(response.status).toBe(200);

        const usernamesArr = response.body.data.map((user) => user.username);

        const ascUsernamesArr = [...usernamesArr].sort((a, b) =>
          a.localeCompare(b),
        );

        expect(usernamesArr).toEqual(ascUsernamesArr);
      });

      test('returns users paginated by page and pageSize', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'employee',
        });

        await Promise.all([
          createTestUser(),
          createTestUser(),
          createTestUser(),
        ]);

        const firstPageResponse = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ page: 1, pageSize: 2 });

        const secondPageResponse = await request(app)
          .get('/api/users')
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
      // To test if requireAuth is in place through usersRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).get('/api/users');

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place through usersRouter.use.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`);

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is not employee or admin', async () => {
          // Creates with user role by default.
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`);

          expectForbiddenResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid sortBy', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'sortBy',
            detailsMessage:
              'Sort by must be one of createdAt, updatedAt, deletedAt, username, email, or role.',
          });
        });

        test('for sortBy that is not a string', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortBy: 123 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'sortBy',
            detailsMessage:
              'Sort by must be one of createdAt, updatedAt, deletedAt, username, email, or role.',
          });
        });

        test('for invalid status', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ status: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'status',
            detailsMessage: 'Status must be one of active, deleted, or all.',
          });
        });

        test('for status that is not a string', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ status: 123 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'status',
            detailsMessage: 'Status must be one of active, deleted, or all.',
          });
        });

        test('for invalid role', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ role: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'role',
            detailsMessage:
              'Role must be one of user, employee, admin, or all.',
          });
        });

        test('for role that is not a string', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ role: 123 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'role',
            detailsMessage:
              'Role must be one of user, employee, admin, or all.',
          });
        });

        test('for empty search', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ search: '' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'search',
            detailsMessage: 'Search cannot be empty.',
          });
        });

        // Since page, pageSize, and sortDirection are in a common schema
        // I only need light testing here.
        test('for invalid page', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ page: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'page',
            detailsMessage: 'Page must be at least 1.',
          });
        });

        test('for invalid pageSize', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ pageSize: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'pageSize',
            detailsMessage: 'Page size must be at least 1.',
          });
        });

        test('for invalid sortDirection', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ sortDirection: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user list query.',
            field: 'sortDirection',
            detailsMessage: 'Sort direction must be either asc or desc.',
          });
        });
      });
    });
  });
});
