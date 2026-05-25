import crypto from 'node:crypto';
import { TEST_PASSWORD } from './testConstants.mjs';
import generateRandomId from './generateRandomId.mjs';

export function buildRegisterRequestBody(overrides = {}) {
  const id = generateRandomId();

  return {
    username: `test_user_${id}`,
    password: TEST_PASSWORD,
    name: 'test name',
    email: `testemail_${id}@test.com`,
    ...overrides,
  };
}
