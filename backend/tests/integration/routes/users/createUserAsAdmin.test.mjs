import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  generateRandomEmail,
  generateRandomUsername,
} from '../../../helpers/generateRandomData.mjs';
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
  expectNoDetailsErrorResponse,
  expectNoPasswordFields,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';
import { TEST_PASSWORD } from '../../../helpers/testConstants.mjs';
import * as db from '../../../../src/db/db.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

const CREATED_NAME = 'created name';

function buildCreateUserAsAdminRequestBody(overrides = {}) {
  return {
    username: generateRandomUsername(),
    email: generateRandomEmail(),
    name: CREATED_NAME,
    password: TEST_PASSWORD,
    role: 'user',
    ...overrides,
  };
}

describe('/api/users', () => {
  describe('POST /', () => {
    describe('happy path', () => {
      test('returns 201 with correct response shape when admin creates user', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const requestBody = buildCreateUserAsAdminRequestBody();

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(requestBody);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: expect.any(Number),
            username: requestBody.username,
            name: requestBody.name,
            email: requestBody.email,
            role: 'user',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            deletedAt: null,
          },
        });

        const createdUserInDb = await db.query(
          `
            SELECT
              id,
              username,
              name,
              email,
              role,
              deleted_at
            FROM users
            WHERE id = $1
          `,
          [response.body.data.id],
        );

        expect(createdUserInDb.rows[0]).toEqual({
          id: response.body.data.id,
          username: requestBody.username,
          name: requestBody.name,
          email: requestBody.email,
          role: 'user',
          deleted_at: null,
        });
      });

      test('returns 201 when admin creates employee', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(
            buildCreateUserAsAdminRequestBody({
              role: 'employee',
            }),
          );

        expect(response.status).toBe(201);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            role: 'employee',
            deletedAt: null,
          }),
        );
      });

      test('normalizes role and email to lowercase', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const uppercaseEmail = generateRandomEmail().toUpperCase();

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(
            buildCreateUserAsAdminRequestBody({
              email: uppercaseEmail,
              role: 'Employee',
            }),
          );

        expect(response.status).toBe(201);
        expect(response.body.data).toEqual(
          expect.objectContaining({
            email: uppercaseEmail.toLowerCase(),
            role: 'employee',
          }),
        );
      });

      test('does not return password or password hash', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });

        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(buildCreateUserAsAdminRequestBody());

        expect(response.status).toBe(201);
        expectNoPasswordFields(response.body.data);
      });

      test('created user can log in', async () => {
        const { accessToken } = await createAuthenticatedTestUser({
          role: 'admin',
        });
        const requestBody = buildCreateUserAsAdminRequestBody();

        const createResponse = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(requestBody);

        expect(createResponse.status).toBe(201);

        const loginResponse = await request(app).post('/api/auth/login').send({
          email: requestBody.email,
          password: requestBody.password,
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.data.user).toEqual(
          expect.objectContaining({
            id: createResponse.body.data.id,
            email: requestBody.email,
            role: requestBody.role,
          }),
        );
        expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));
      });
    });

    describe('unhappy path', () => {
      // To test if requireAuth is in place through usersRouter.use.
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app)
            .post('/api/users')
            .send(buildCreateUserAsAdminRequestBody());

          expectAuthRequiredResponse(response);
        });
      });

      // To test if loadCurrentStateOfAuthUser is in place through usersRouter.use.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          // Keep another active admin so the last-admin trigger does not block
          // soft-deleting the authenticated admin directly in test setup.
          await createTestUser({ role: 'admin' });

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateUserAsAdminRequestBody());

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 403 FORBIDDEN with correct response', () => {
        test('when authenticated user is user role', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'user',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateUserAsAdminRequestBody());

          expectForbiddenResponse(response);
        });

        test('when authenticated user is employee role', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'employee',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(buildCreateUserAsAdminRequestBody());

          expectForbiddenResponse(response);
        });
      });

      describe('returns 409 USER_CREATION_CONFLICT with correct response', () => {
        test('when email already exists', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const existingUser = await createTestUser();

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                email: existingUser.email,
              }),
            );

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'USER_CREATION_CONFLICT',
              message: 'User creation fields are already in use.',
              details: [
                {
                  field: 'email',
                  code: 'EMAIL_ALREADY_EXISTS',
                  message: 'The email you have entered already exists.',
                },
              ],
            },
          });
        });

        test('when username already exists', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const existingUser = await createTestUser();

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                username: existingUser.username,
              }),
            );

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'USER_CREATION_CONFLICT',
              message: 'User creation fields are already in use.',
              details: [
                {
                  field: 'username',
                  code: 'USERNAME_ALREADY_EXISTS',
                  message: 'The username you have entered already exists.',
                },
              ],
            },
          });
        });

        test('when both username and email already exist', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const existingUser = await createTestUser();

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                username: existingUser.username,
                email: existingUser.email,
              }),
            );

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'USER_CREATION_CONFLICT',
              message: 'User creation fields are already in use.',
              details: [
                {
                  field: 'email',
                  code: 'EMAIL_ALREADY_EXISTS',
                  message: 'The email you have entered already exists.',
                },
                {
                  field: 'username',
                  code: 'USERNAME_ALREADY_EXISTS',
                  message: 'The username you have entered already exists.',
                },
              ],
            },
          });
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'body',
            detailsMessage: 'Request body must be an object.',
          });
        });

        test('for missing username', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const requestBody = buildCreateUserAsAdminRequestBody();

          delete requestBody.username;

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(requestBody);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'username',
            detailsMessage: 'Username is required.',
          });
        });

        test('for missing email', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const requestBody = buildCreateUserAsAdminRequestBody();

          delete requestBody.email;

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(requestBody);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'email',
            detailsMessage: 'Email is required.',
          });
        });

        test('for missing password', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const requestBody = buildCreateUserAsAdminRequestBody();

          delete requestBody.password;

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(requestBody);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'password',
            detailsMessage: 'Password is required.',
          });
        });

        test('for missing role', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });
          const requestBody = buildCreateUserAsAdminRequestBody();

          delete requestBody.role;

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(requestBody);

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'role',
            detailsMessage: 'Role is required.',
          });
        });

        test('for invalid username', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                username: 'a',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'username',
            detailsMessage: 'Username must be at least 3 characters.',
          });
        });

        test('for invalid email', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                email: 'not-an-email',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'email',
            detailsMessage: 'Email must be valid.',
          });
        });

        test('for password shorter than minimum length', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                password: 'short',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'password',
            detailsMessage: 'Password must be at least 15 characters.',
          });
        });

        test('for password that exceeds bcrypt max bytes', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                password: 'a'.repeat(73),
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'password',
            detailsMessage: 'Password must be 72 bytes or fewer.',
          });
        });

        test('for unsupported role', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                role: 'admin',
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'role',
            detailsMessage: 'Role must be either user or employee.',
          });
        });

        test('for unknown body field', async () => {
          const { accessToken } = await createAuthenticatedTestUser({
            role: 'admin',
          });

          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(
              buildCreateUserAsAdminRequestBody({
                unknown: true,
              }),
            );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid user create request.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed',
          });
        });
      });
    });
  });
});
