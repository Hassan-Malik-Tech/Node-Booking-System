import crypto from 'node:crypto';
import { TEST_PASSWORD } from './testConstants.mjs';
import { hashPassword } from '../../src/auth/password.js';
import { createUserForRegistration } from '../../src/data-access/users.js';
import { signAccessToken } from '../../src/auth/authToken.js';
import generateRandomId from './generateRandomId.mjs';

const testPasswordHash = await hashPassword(TEST_PASSWORD);

export async function createTestUser(overrides = {}) {
  const id = generateRandomId();

  const testUserData = {
    username: `test_user_${id}`,
    passwordHash: testPasswordHash,
    name: 'test name',
    email: `testemail_${id}@test.com`,
    ...overrides,
  };

  return await createUserForRegistration(testUserData);
}

export async function createAuthenticatedTestUser(overrides = {}) {
  const user = await createTestUser(overrides);
  const accessToken = await signAccessToken(user);

  return {
    user,
    accessToken,
  };
}
