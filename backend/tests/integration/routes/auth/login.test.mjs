import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import { buildRegisterRequestBody } from '../../../helpers/postRequestBodies.mjs';
import { createTestUser } from '../../../helpers/createTestData.mjs';
import { TEST_PASSWORD } from '../../../helpers/testConstants.mjs';
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
  describe('POST /login', () => {
    describe('happy path', () => {
      test('returns 200 when logging in after successful registration', async () => {
        const registrationData = buildRegisterRequestBody();
        const {
          username: testUsername,
          email: testEmail,
          name: testName,
        } = registrationData;

        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send(registrationData);

        expect(registerResponse.status).toBe(201);

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ username: testUsername, password: TEST_PASSWORD });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body).toEqual({
          success: true,
          data: {
            user: {
              id: expect.any(Number),
              username: testUsername,
              name: testName,
              email: testEmail,
              role: 'user',
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            accessToken: expect.any(String),
            tokenType: 'Bearer',
            expiresIn: expect.any(Number),
          },
        });
      });

      test('does not return password or password hash', async () => {
        const { username } = await createTestUser();

        const response = await request(app)
          .post('/api/auth/login')
          .send({ username, password: TEST_PASSWORD });

        expect(response.status).toBe(200);
        expect(response.body.data.user.password).toBeUndefined();
        expect(response.body.data.user.passwordHash).toBeUndefined();
        expect(response.body.data.user.password_hash).toBeUndefined();
      });
    });

    describe('unhappy path', () => {
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for missing username', async () => {
          const response = await request(app)
            .post('/api/auth/login')
            .send({ password: TEST_PASSWORD });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid login request body.',
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
          const { username } = buildRegisterRequestBody();

          const response = await request(app)
            .post('/api/auth/login')
            .send({ username });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid login request body.',
              details: [
                {
                  field: 'password',
                  message: 'Password is required.',
                },
              ],
            },
          });
        });

        test('for empty request body', async () => {
          const response = await request(app).post('/api/auth/login').send({});

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid login request body.',
              details: expect.arrayContaining([
                {
                  field: 'password',
                  message: 'Password is required.',
                },
                {
                  field: 'username',
                  message: 'Username is required.',
                },
              ]),
            },
          });

          expect(response.body.error.details).toHaveLength(2);
        });

        test('for password that exceeds bcrypt max bytes', async () => {
          const { username } = buildRegisterRequestBody();

          const response = await request(app)
            .post('/api/auth/login')
            .send({
              username,
              password: 'a'.repeat(73),
            });

          expect(response.status).toBe(400);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid login request body.',
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

      describe('returns 401 INVALID_CREDENTIALS with correct unified response', () => {
        test('when username does not exist', async () => {
          const { username } = buildRegisterRequestBody();

          const response = await request(app)
            .post('/api/auth/login')
            .send({ username, password: TEST_PASSWORD });

          expect(response.status).toBe(401);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid username or password.',
            },
          });
        });

        test('when password is incorrect', async () => {
          const { username } = await createTestUser();

          const response = await request(app)
            .post('/api/auth/login')
            .send({ username, password: '123456789abcdefgh' });

          expect(response.status).toBe(401);
          expect(response.body).toEqual({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid username or password.',
            },
          });
        });
      });
    });
  });
});
