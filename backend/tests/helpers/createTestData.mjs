import { TEST_PASSWORD } from './testConstants.mjs';
import { hashPassword } from '../../src/auth/password.js';
import { createUser } from '../../src/data-access/users.js';
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
import { softDeleteTestResource } from './updateTestData.mjs';
import { createReservation } from '../../src/data-access/reservations.js';
import { minutesToMs } from '../../src/utils/time.js';

const testPasswordHash = await hashPassword(TEST_PASSWORD);

export async function createTestUser({ role = 'user', ...overrides } = {}) {
  const testUserData = {
    username: generateRandomUsername(),
    passwordHash: testPasswordHash,
    name: 'test name',
    email: generateRandomEmail(),
    ...overrides,
  };

  const user = await createUser(testUserData);

  if (role === 'user') {
    return user;
  }

  // So that I can make users that have an employee or admin role for testing.
  const result = await db.query(
    `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING 
        role,
        updated_at
    `,
    [role, user.id],
  );

  return {
    ...user,
    role: result.rows[0].role,
    updated_at: result.rows[0].updated_at,
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
  let updated_at = resource.updated_at;
  let is_active = resource.is_active;

  if (deleted) {
    deletedResource = await softDeleteTestResource(resource.id);
    updated_at = deletedResource.updated_at;
    is_active = deletedResource.is_active;
  }

  return {
    ...resource,
    is_active,
    deleted_at: deleted ? deletedResource.deleted_at : resource.deleted_at,
    updated_at,
    owner: resourceOwner,
  };
}

export async function createTestAvailabilityWindow({
  allowedDurations = [30, 60],
  deleted = false,
  expired = false,
  ongoing = false,
  noDurations = false,
  resource = undefined,
  resourceOwner = undefined,
  ...overrides
} = {}) {
  if (resource !== undefined && resourceOwner !== undefined) {
    throw new Error('resource and resourceOwner cannot both be defined.');
  }

  if (ongoing && expired) {
    throw new Error(
      'Availability window cannot be expired and ongoing at the same time.',
    );
  }

  const testResource =
    resource ?? (await createTestResource({ owner: resourceOwner }));

  let startTime;

  if (ongoing || expired) {
    startTime = '2025-01-01T09:00:00Z';
  }

  let endTime;

  if (ongoing) {
    endTime = '2035-12-01T17:00:00Z';
  } else if (expired) {
    endTime = '2025-01-01T17:00:00Z';
  }

  const testWindowData = {
    resourceId: testResource.id,
    startTime: startTime ?? '2036-01-01T09:00:00Z',
    endTime: endTime ?? '2036-01-01T17:00:00Z',
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
  user = undefined,
  resource = undefined,
  availabilityWindow = undefined,
  ongoing = false,
  expired = false,
  cancelled = false,
  completed = false,
  windowStartTime,
  windowEndTime,
  ...overrides
} = {}) {
  if ((ongoing || expired) && availabilityWindow !== undefined) {
    throw new Error(
      'Cannot use ongoing or expired when passing an availability window.',
    );
  }

  if (cancelled && completed) {
    throw new Error(
      'Reservation cannot be cancelled and completed at the same time.',
    );
  }

  if (
    (windowStartTime === undefined && windowEndTime !== undefined) ||
    (windowStartTime !== undefined && windowEndTime === undefined)
  ) {
    throw new Error(
      'windowStartTime and windowEndTime must be passed together.',
    );
  }

  const testUser = user ?? (await createTestUser());

  const createTestAvailabilityWindowParams =
    windowStartTime !== undefined
      ? {
          resource,
          ongoing,
          expired,
          startTime: windowStartTime,
          endTime: windowEndTime,
        }
      : { resource, ongoing, expired };

  const testWindow =
    availabilityWindow ??
    (await createTestAvailabilityWindow(createTestAvailabilityWindowParams));

  const testResource = resource ?? testWindow.resource;

  const windowStartTimeMs = testWindow.start_time.getTime();

  const reservationDurationMs = minutesToMs(
    testWindow.allowed_durations[0].minutes,
  );

  const reservationStartTime = testWindow.start_time.toISOString();

  const reservationEndTime = ongoing
    ? testWindow.end_time.toISOString()
    : new Date(windowStartTimeMs + reservationDurationMs).toISOString();

  const testReservationData = {
    resourceId: testResource.id,
    availabilityWindowId: testWindow.id,
    startTime: reservationStartTime,
    endTime: reservationEndTime,
    partySize: testResource.capacity,
    ...overrides,
  };

  const reservation = await createReservation({
    userId: testUser.id,
    reservationData: testReservationData,
  });

  let cancelledReservation;
  if (cancelled) {
    cancelledReservation = await db.query(
      `
        UPDATE reservations
        SET status = 'cancelled',
          cancelled_at = NOW()
        WHERE id = $1
        RETURNING 
          status,
          cancelled_at,
          updated_at
      `,
      [reservation.id],
    );
  }

  let completedReservation;
  if (completed) {
    completedReservation = await db.query(
      `
        UPDATE reservations
        SET status = 'completed',
          system_completed_at = NOW()
        WHERE id = $1
        RETURNING 
          status,
          system_completed_at,
          updated_at
      `,
      [reservation.id],
    );
  }

  let status = reservation.status;
  let updated_at = reservation.updated_at;
  let cancelled_at = reservation.cancelled_at;
  let system_completed_at = reservation.system_completed_at;

  if (cancelled) {
    status = cancelledReservation.rows[0].status;
    updated_at = cancelledReservation.rows[0].updated_at;
    cancelled_at = cancelledReservation.rows[0].cancelled_at;
  }

  if (completed) {
    status = completedReservation.rows[0].status;
    updated_at = completedReservation.rows[0].updated_at;
    system_completed_at = completedReservation.rows[0].system_completed_at;
  }

  return {
    ...reservation,
    updated_at,
    status,
    cancelled_at,
    system_completed_at,
    user: testUser,
    resource: testResource,
    availabilityWindow: testWindow,
  };
}
