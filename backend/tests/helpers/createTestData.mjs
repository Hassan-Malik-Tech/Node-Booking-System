import { TEST_PASSWORD } from './testConstants.mjs';
import { hashPassword } from '../../src/auth/password.js';
import { createUserForRegistration } from '../../src/data-access/users.js';
import { createResource } from '../../src/data-access/resources.js';
import {
  createAvailabilityWindow,
  createAllowedDurations,
  softDeleteAvailabilityWindowById,
} from '../../src/data-access/availabilityWindows.js';
import { signAccessToken } from '../../src/auth/authToken.js';
import {
  generateRandomUsername,
  generateRandomEmail,
  generateRandomResourceName,
} from './generateRandomData.mjs';
import * as db from '../../src/db/db.js';
import {
  softDeleteTestResource,
  deactivateTestResource,
} from './updateTestData.mjs';
import { createReservation } from '../../src/data-access/reservations.js';

const testPasswordHash = await hashPassword(TEST_PASSWORD);

export async function createTestUser({ role = 'user', ...overrides } = {}) {
  const testUserData = {
    username: generateRandomUsername(),
    passwordHash: testPasswordHash,
    name: 'test name',
    email: generateRandomEmail(),
    ...overrides,
  };

  const user = await createUserForRegistration(testUserData);

  if (role === 'user') {
    return user;
  }

  // So that I can make users that have an employee or admin role for testing.
  const result = await db.query(
    `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING role
    `,
    [role, user.id],
  );

  return {
    ...user,
    role: result.rows[0].role,
  };
}

export async function createAuthenticatedTestUser({
  role = 'user',
  ...overrides
} = {}) {
  const user = await createTestUser({ role, ...overrides });
  const accessToken = await signAccessToken(user);

  return {
    user,
    accessToken,
  };
}

export async function createTestResource({
  owner = undefined,
  deleted = false,
  inactive = false,
  ...overrides
} = {}) {
  const resourceOwner = owner ?? (await createTestUser());

  const testResourceData = {
    ownerId: resourceOwner.id,
    name: generateRandomResourceName(),
    description: 'Test resource description',
    capacity: 10,
    isActive: inactive ? false : true,
    ...overrides,
  };

  const resource = await createResource({ resourceData: testResourceData });

  let deletedResource;

  if (deleted) {
    deletedResource = await softDeleteTestResource(resource.id);
  }

  return {
    ...resource,
    is_active: inactive ? false : resource.is_active,
    deleted_at: deleted ? deletedResource.deleted_at : resource.deleted_at,
    owner: resourceOwner,
  };
}

export async function createTestAvailabilityWindow({
  allowedDurations = [30, 60],
  deleted = false,
  expired = false,
  noDurations = false,
  resource = undefined,
  resourceOwner = undefined,
  ...overrides
} = {}) {
  if (resource !== undefined && resourceOwner !== undefined) {
    throw new Error('resource and resourceOwner cannot both be defined.');
  }

  const testResource =
    resource ?? (await createTestResource({ owner: resourceOwner }));

  const testWindowData = {
    resourceId: testResource.id,
    startTime: expired ? '2025-01-01T09:00:00Z' : '2036-01-01T09:00:00Z',
    endTime: expired ? '2025-01-01T17:00:00Z' : '2036-01-01T17:00:00Z',
    cancellationNoticeMinutes: 120,
    ...overrides,
  };

  const window = await createAvailabilityWindow({ windowData: testWindowData });

  let allowed_durations;

  if (noDurations === false) {
    allowed_durations = await createAllowedDurations({
      windowId: window.id,
      minutesList: allowedDurations,
    });
  }

  let deletedWindow;

  if (deleted) {
    deletedWindow = await softDeleteAvailabilityWindowById({
      windowId: window.id,
    });
  }

  return {
    ...window,
    allowed_durations: noDurations ? [] : allowed_durations,
    deleted_at: deleted ? deletedWindow.deleted_at : window.deleted_at,
    resource: testResource,
  };
}

export async function createTestReservation({
  user,
  resource,
  availabilityWindow = undefined,
  ...overrides
}) {
  const testWindow =
    availabilityWindow ?? (await createTestAvailabilityWindow({ resource }));

  const testReservationData = {
    resourceId: resource.id,
    availabilityWindowId: testWindow.id,
    startTime: '2036-01-01T09:00:00Z',
    endTime: '2036-01-01T09:30:00Z',
    partySize: resource.capacity,
    ...overrides,
  };

  const reservation = await createReservation({
    userId: user.id,
    reservationData: testReservationData,
  });

  return {
    ...reservation,
    user,
    resource,
    availabilityWindow: testWindow,
  };
}
