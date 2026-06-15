import * as availabilityWindowQueries from '../../data-access/availabilityWindows.js';
import * as resourceRules from './resourceRules.js';
import AppError from '../../errors/AppError.js';
import ERROR_CODES from '../../errors/errorCodes.js';
import * as db from '../../db/db.js';
import { availabilityWindowNotFound } from '../../errors/commonErrors.js';

export function validateAllowedDurationsFitWindow({
  startTime,
  endTime,
  allowedDurations,
}) {
  // joi validation shold convert these values to Date objects first.
  // getTime gets the time in ms from a Date object since jan 01 1970 midnight.
  const windowLengthMs = endTime.getTime() - startTime.getTime();
  // There are 60000 ms in a min (60 seconds in a min * 1000 ms in a second )
  const windowLengthMins = windowLengthMs / 60000;

  // Returns a boolean, if one of the items returns true, it stops the loop.
  const allowedDurationLongerThanWindow = allowedDurations.some(
    (allowedDuration) => allowedDuration > windowLengthMins,
  );

  if (allowedDurationLongerThanWindow) {
    throw AppError.badRequest(
      'Allowed duration cannot be longer than the availability window.',
      {
        code: ERROR_CODES.ALLOWED_DURATION_LONGER_THAN_WINDOW,
      },
    );
  }
}

export async function getAvailabilityWindowOrThrow({
  windowId,
  includeDeleted = false,
  forUpdate = false,
  client = db,
}) {
  if (forUpdate && client === db) {
    throw new Error('Cannot use FOR UPDATE without a transaction client.');
  }

  const availabilityWindow =
    await availabilityWindowQueries.getAvailabilityWindowById({
      windowId,
      includeDeleted,
      forUpdate,
      client,
    });

  if (!availabilityWindow) {
    throw availabilityWindowNotFound();
  }

  return availabilityWindow;
}

function requireFutureAvailabilityWindow({
  availabilityWindow,
  notFutureMessage,
}) {
  if (availabilityWindow.start_time.getTime() <= Date.now()) {
    throw AppError.conflict(
      notFutureMessage ??
        'This action can only be performed on a future availability window.',
      { code: ERROR_CODES.NOT_A_FUTURE_AVAILABILITY_WINDOW },
    );
  }
}

function requireActiveAvailabilityWindow({
  availabilityWindow,
  expiredMessage,
}) {
  if (availabilityWindow.end_time.getTime() <= Date.now()) {
    throw AppError.conflict(
      expiredMessage ??
        'Cannot perform this action on an expired availability window.',
      { code: ERROR_CODES.AVAILABILITY_WINDOW_EXPIRED },
    );
  }
}

export async function requireOwnedActiveAvailabilityWindowOrAdmin({
  windowId,
  authUserId,
  userRole,
  deletedResourceMessage,
  expiredMessage,
  forUpdate = false,
  client = db,
}) {
  const initialFetchedAvailabilityWindow = await getAvailabilityWindowOrThrow({
    windowId,
    client,
  });

  await resourceRules.requireOwnedNonDeletedResourceOrAdmin({
    resourceId: initialFetchedAvailabilityWindow.resource_id,
    authUserId,
    userRole,
    deletedMessage: deletedResourceMessage,
    forUpdate,
    client,
  });

  const availabilityWindow = await getAvailabilityWindowOrThrow({
    windowId,
    forUpdate,
    client,
  });

  requireActiveAvailabilityWindow({ availabilityWindow, expiredMessage });

  return availabilityWindow;
}

export async function requireOwnedFutureAvailabilityWindow({
  windowId,
  authUserId,
  forUpdate = false,
  notFutureMessage,
  deletedResourceMessage,
  inactiveResourceMessage,
  client = db,
}) {
  // If the first query for windows is locked, it can cause a deadlock.
  // Keep lock order consistent to avoid deadlock.
  // Example(if first query was locked):
  // R1 PATCH window:
  //   - locks window 10
  //   - then tries to lock resource 3
  // R2 deactivate resource:
  //   - locks resource 3
  //   - then tries to update/lock window 10
  // Result:
  //   - R1 waits for resource 3
  //   - R2 waits for window 10
  const initialFetchedAvailabilityWindow = await getAvailabilityWindowOrThrow({
    windowId,
    client,
  });

  await resourceRules.requireOwnedActiveResource({
    resourceId: initialFetchedAvailabilityWindow.resource_id,
    authUserId,
    deletedMessage: deletedResourceMessage,
    inactiveMessage: inactiveResourceMessage,
    forUpdate,
    client,
  });

  const availabilityWindow = await getAvailabilityWindowOrThrow({
    windowId,
    forUpdate,
    client,
  });

  // This comes after requireOwner to avoid revealing this info
  // to someone that is not the owner.
  requireFutureAvailabilityWindow({ availabilityWindow, notFutureMessage });

  return availabilityWindow;
}
