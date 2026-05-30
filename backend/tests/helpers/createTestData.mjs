import { TEST_PASSWORD } from './testConstants.mjs';
import { hashPassword } from '../../src/auth/password.js';
import { createUserForRegistration } from '../../src/data-access/users.js';
import { createResource } from '../../src/data-access/resources.js';
import { signAccessToken } from '../../src/auth/authToken.js';
import {
  generateRandomUsername,
  generateRandomEmail,
  generateRandomResourceName,
} from './generateRandomData.mjs';

const testPasswordHash = await hashPassword(TEST_PASSWORD);

export async function createTestUser(overrides = {}) {
  const testUserData = {
    username: generateRandomUsername(),
    passwordHash: testPasswordHash,
    name: 'test name',
    email: generateRandomEmail(),
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

/*
export async function createAuthenticatedTestUser({ role = 'user', ...overrides } = {}) {
  let user = await createTestUser(overrides);

  if (role !== 'user') {
    const result = await db.query(
      `
        UPDATE users
        SET role = $1
        WHERE id = $2
        RETURNING role
      `,
      [role, user.id],
    );

    user = {
      ...user,
      role: result.rows[0].role,
    };
  }

  const accessToken = await signAccessToken(user);

  return {
    user,
    accessToken,
  };
}
*/

// Override ownerId only when the test needs a specific user to own the resource.
export async function createTestResource(overrides = {}) {
  const { id } = await createTestUser();

  const testResourceData = {
    ownerId: id,
    name: generateRandomResourceName(),
    description: 'Test resource description',
    capacity: 10,
    isActive: true,
    ...overrides,
  };

  return await createResource(testResourceData);
}
