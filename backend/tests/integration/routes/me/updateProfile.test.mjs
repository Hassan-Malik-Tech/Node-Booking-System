import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  generateRandomUsername,
  generateRandomEmail,
} from '../../../helpers/generateRandomData.mjs';
import {
  createAuthenticatedTestUser,
  createTestUser,
} from '../../../helpers/createTestData.mjs';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import {
  expectNoPasswordFields,
  expectAuthRequiredResponse,
  expectInvalidTokenResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteTestUser } from '../../../helpers/updateTestData.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

const UPDATED_NAME = 'updated name';

describe('/api/me', () => {
  describe('PATCH /', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape when updating username, name, and email', async () => {
        const { accessToken } = await createAuthenticatedTestUser();
        const updatedUsername = generateRandomUsername();
        const updatedEmail = generateRandomEmail();

        const response = await request(app)
          .patch('/api/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            username: updatedUsername,
            name: UPDATED_NAME,
            email: updatedEmail,
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: expect.any(Number),
            username: updatedUsername,
            name: UPDATED_NAME,
            email: updatedEmail,
            role: 'user',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        });
      });

      test('returns 200 with name updated to null', async () => {
        const { accessToken } = await createAuthenticatedTestUser();

        const response = await request(app)
          .patch('/api/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: null,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBeNull();
      });

      test('returns 200 when username and email are unchanged', async () => {
        const { user, accessToken } = await createAuthenticatedTestUser();
        const { username: oldUsername, email: oldEmail } = user;

        const response = await request(app)
          .patch('/api/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            username: oldUsername,
            email: oldEmail,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.username).toBe(oldUsername);
        expect(response.body.data.email).toBe(oldEmail);
      });

      test('does not return password or password hash', async () => {
        const { accessToken } = await createAuthenticatedTestUser();

        // Dont need to send all 3 fields, just one
        // and name does not require running a function.
        const response = await request(app)
          .patch('/api/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: UPDATED_NAME,
          });

        expect(response.status).toBe(200);
        expectNoPasswordFields(response.body.data);
      });
    });

    // Auth testing was done more extensively in the
    // testing for GET /api/me.
    // This test is here just to prove that auth works in this route.
    // There is no need to repeat it in full here,
    // This tests that the route uses requireAuth()
    describe('unhappy path', () => {
      describe('returns 401 AUTHENTICATION_REQUIRED with correct response', () => {
        test('when Authorization header is missing', async () => {
          const response = await request(app).patch('/api/me').send({
            name: UPDATED_NAME,
          });

          expectAuthRequiredResponse(response);
        });
      });

      // This tests if the route uses loadCurrentStateOfAuthUser()
      // same as above, dont need to test is thoroughly for every route.
      // One route is enough to test it thoroughly, the other routes that
      // use requireAuth and loadCurrentStateOfAuthUser only
      // needs to test if the route actually uses it.
      describe('returns 401 INVALID_TOKEN with correct response', () => {
        test('when token user is soft deleted', async () => {
          const { user, accessToken } = await createAuthenticatedTestUser();

          const deletedUser = await softDeleteTestUser(user.id);

          expect(deletedUser.deleted_at).toEqual(expect.any(Date));

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: UPDATED_NAME,
            });

          expectInvalidTokenResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid username', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              username: 'a',
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid profile update request body.',
              details: [
                {
                  field: 'username',
                  message: 'Username must be at least 3 characters.',
                },
              ],
            },
          });
        });

        test('for invalid email', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              email: 'invalid email',
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid profile update request body.',
              details: [
                {
                  field: 'email',
                  message: 'Email must be valid.',
                },
              ],
            },
          });
        });

        test('for empty name', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              name: '',
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid profile update request body.',
              details: [
                {
                  field: 'name',
                  message: 'Name cannot be empty.',
                },
              ],
            },
          });
        });

        // When Joi rejects the body itself, detail.path is empty.
        // validateRequestInput should use the requestLocation as the field name.
        // This applies to the 2 tests below.
        test('for empty request body', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid profile update request body.',
              details: [
                {
                  field: 'body',
                  message: 'At least one profile field is required.',
                },
              ],
            },
          });
        });

        test('for request body that is not an object', async () => {
          const { accessToken } = await createAuthenticatedTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send([]);

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid profile update request body.',
              details: [
                {
                  field: 'body',
                  message: 'Request body must be an object.',
                },
              ],
            },
          });
        });
      });

      describe('returns 409 UPDATE_FIELD_CONFLICT with correct response', () => {
        test('when email already exists', async () => {
          const { accessToken } = await createAuthenticatedTestUser();
          const { email: takenEmail } = await createTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ email: takenEmail });

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'UPDATE_FIELD_CONFLICT',
              message: 'Update fields are already in use.',
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
          const { accessToken } = await createAuthenticatedTestUser();
          const { username: takenUsername } = await createTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ username: takenUsername });

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'UPDATE_FIELD_CONFLICT',
              message: 'Update fields are already in use.',
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
          const { accessToken } = await createAuthenticatedTestUser();
          const { username: takenUsername, email: takenEmail } =
            await createTestUser();

          const response = await request(app)
            .patch('/api/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ username: takenUsername, email: takenEmail });

          expect(response.status).toBe(409);

          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'UPDATE_FIELD_CONFLICT',
              message: 'Update fields are already in use.',
              details: expect.arrayContaining([
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
              ]),
            },
          });
          expect(response.body.error.details).toHaveLength(2);
        });
      });
    });
  });
});
