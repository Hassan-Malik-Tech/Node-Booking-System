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
import {
  expectNoPasswordFields,
  expectInvalidCredentialsResponse,
} from '../../../helpers/assertions.mjs';

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
          .send({ email: testEmail, password: TEST_PASSWORD });

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
        const { email } = await createTestUser();

        const response = await request(app)
          .post('/api/auth/login')
          .send({ email, password: TEST_PASSWORD });

        expect(response.status).toBe(200);
        expectNoPasswordFields(response.body.data.user);
      });
    });

    describe('unhappy path', () => {
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for missing email', async () => {
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
                  field: 'email',
                  message: 'Email is required.',
                },
              ],
            },
          });
        });

        test('for missing password', async () => {
          const { email } = buildRegisterRequestBody();

          const response = await request(app)
            .post('/api/auth/login')
            .send({ email });

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
                  field: 'email',
                  message: 'Email is required.',
                },
              ]),
            },
          });

          expect(response.body.error.details).toHaveLength(2);
        });

        test('for password that exceeds bcrypt max bytes', async () => {
          const { email } = buildRegisterRequestBody();

          const response = await request(app)
            .post('/api/auth/login')
            .send({
              email,
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
        test('when email does not exist', async () => {
          const { email } = buildRegisterRequestBody();

          const response = await request(app)
            .post('/api/auth/login')
            .send({ email, password: TEST_PASSWORD });

          expectInvalidCredentialsResponse(response);
        });

        test('when password is incorrect', async () => {
          const { email } = await createTestUser();

          const response = await request(app)
            .post('/api/auth/login')
            .send({ email, password: '123456789abcdefgh' });

          expectInvalidCredentialsResponse(response);
        });
      });
    });
  });
});
