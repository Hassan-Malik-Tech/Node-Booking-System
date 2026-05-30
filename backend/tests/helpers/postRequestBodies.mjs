import { TEST_PASSWORD } from './testConstants.mjs';
import {
  generateRandomUsername,
  generateRandomEmail,
} from './generateRandomData.mjs';

export function buildRegisterRequestBody(overrides = {}) {
  return {
    username: generateRandomUsername(),
    password: TEST_PASSWORD,
    name: 'test name',
    email: generateRandomEmail(),
    ...overrides,
  };
}
