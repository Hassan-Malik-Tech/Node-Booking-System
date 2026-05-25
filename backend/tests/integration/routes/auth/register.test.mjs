import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import { buildRegisterRequestBody } from '../../../helpers/postRequestBodies.mjs';
import { createTestUser } from '../../../helpers/createTestData.mjs';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/auth', () => {
  describe('POST /register', () => {
    describe('happy path', () => {
      test('returns 201 with correct response shape', async () => {
        const registrationData = buildRegisterRequestBody();
        const {
          username: testUsername,
          name: testName,
          email: testEmail,
        } = registrationData;

        const response = await request(app)
          .post('/api/auth/register')
          .send(registrationData);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: expect.any(Number),
            username: testUsername,
            name: testName,
            email: testEmail,
            role: 'user',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        });
      });

      test('returns 201 with no name in request body', async () => {
        const registrationData = buildRegisterRequestBody();
        delete registrationData.name;

        const response = await request(app)
          .post('/api/auth/register')
          .send(registrationData);

        expect(response.status).toBe(201);
        expect(response.body.data.name).toBeNull();
      });

      test('does not return password or password hash', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(buildRegisterRequestBody());

        expect(response.status).toBe(201);
        expect(response.body.data.password).toBeUndefined();
        expect(response.body.data.passwordHash).toBeUndefined();
        expect(response.body.data.password_hash).toBeUndefined();
      });
    });

    describe('unhappy path', () => {
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for missing username', async () => {
          const registrationData = buildRegisterRequestBody();
          delete registrationData.username;

          const response = await request(app)
            .post('/api/auth/register')
            .send(registrationData);

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid registration request body.',
              details: [
                {
                  field: 'username',
                  message: 'Username is required.',
                },
              ],
            },
          });
        });

        test('for missing password', async () => {
          const registrationData = buildRegisterRequestBody();
          delete registrationData.password;

          const response = await request(app)
            .post('/api/auth/register')
            .send(registrationData);

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid registration request body.',
              details: [
                {
                  field: 'password',
                  message: 'Password is required.',
                },
              ],
            },
          });
        });

        test('for missing email', async () => {
          const registrationData = buildRegisterRequestBody();
          delete registrationData.email;

          const response = await request(app)
            .post('/api/auth/register')
            .send(registrationData);

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid registration request body.',
              details: [
                {
                  field: 'email',
                  message: 'Email is required.',
                },
              ],
            },
          });
        });

        test('for empty request body', async () => {
          const response = await request(app)
            .post('/api/auth/register')
            .send({});

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid registration request body.',
              // Testing exact order can be brittle, so arrayContaining makes order not matter.
              details: expect.arrayContaining([
                {
                  field: 'username',
                  message: 'Username is required.',
                },
                {
                  field: 'email',
                  message: 'Email is required.',
                },
                {
                  field: 'password',
                  message: 'Password is required.',
                },
              ]),
            },
          });

          // arrayContaining checks the expected entries exist, but not the total length.
          expect(response.body.error.details).toHaveLength(3);
        });

        test('for password that exceeds bcrypt max bytes', async () => {
          const registrationData = buildRegisterRequestBody({
            password: 'a'.repeat(73),
          });

          const response = await request(app)
            .post('/api/auth/register')
            .send(registrationData);

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid registration request body.',
              details: [
                {
                  field: 'password',
                  message: 'Password must be 72 bytes or fewer.',
                },
              ],
            },
          });
        });
      });

      describe('returns 409 REGISTRATION_CONFLICT with correct response', () => {
        test('when email already exists', async () => {
          const emailOverride = { email: 'testconflict@test.com' };

          await createTestUser(emailOverride);

          const response = await request(app)
            .post('/api/auth/register')
            .send(buildRegisterRequestBody(emailOverride));

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'REGISTRATION_CONFLICT',
              message: 'Registration fields are already in use.',
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
          const usernameOverride = { username: 'test_conflict_user' };

          await createTestUser(usernameOverride);

          const response = await request(app)
            .post('/api/auth/register')
            .send(buildRegisterRequestBody(usernameOverride));

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'REGISTRATION_CONFLICT',
              message: 'Registration fields are already in use.',
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
          const conflictOverrides = {
            username: 'test_conflict_user_2',
            email: 'testconflict2@test.com',
          };

          await createTestUser(conflictOverrides);

          const response = await request(app)
            .post('/api/auth/register')
            .send(buildRegisterRequestBody(conflictOverrides));

          expect(response.status).toBe(409);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'REGISTRATION_CONFLICT',
              message: 'Registration fields are already in use.',
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
