import * as availabilityWindowQueries from '../data-access/availabilityWindows.js';
import * as reservationQueries from '../data-access/reservations.js';
import AppError from '../errors/AppError.js';
import caughtError from '../errors/caughtError.js';
import {
  getLimitAndOffset,
  buildPagination,
} from './helpers/paginationHelpers.js';
import { msToMinutes } from '../utils/time.js';
import * as db from '../db/db.js';
import * as resourceRules from './rules/resourceRules.js';
import * as availabilityWindowRules from './rules/availabilityWindowRules.js';
import { createAvailabilityWindowsForResource } from './helpers/availabilityWindowHelpers.js';
import {
  availabilityWindowNotFound,
  availabilityWindowStateChanged,
} from '../errors/commonErrors.js';
import ERROR_CODES from '../errors/errorCodes.js';
import { lockUserOrThrow } from './helpers/userHelpers.js';

function mapAvailabilityWindow(window) {
  return {
    id: window.id,
    resourceId: window.resource_id,
    startTime: window.start_time,
    endTime: window.end_time,
    cancellationNoticeMinutes: window.cancellation_notice_minutes,
    createdAt: window.created_at,
    updatedAt: window.updated_at,
    deletedAt: window.deleted_at,
    allowedDurations: window.allowed_durations,
  };
}

function publicAvailabilityWindowMapper({ window, allowedDurations }) {
  return {
    id: window.id,
    resourceId: window.resource_id,
    startTime: window.start_time,
    endTime: window.end_time,
    cancellationNoticeMinutes: window.cancellation_notice_minutes,
    createdAt: window.created_at,
    updatedAt: window.updated_at,
    allowedDurations: allowedDurations ?? window.allowed_durations,
  };
}

// For staff only list end point.
export async function listAvailabilityWindows({ queryParams = {} } = {}) {
  try {
    const {
      page,
      pageSize,
      sortBy,
      sortDirection,
      status = 'active',
      resourceId,
      ownerId,
    } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    const filters = {
      limit,
      offset,
      sortBy,
      sortDirection,
      status,
      resourceId,
      ownerId,
    };

    const [availabilityWindows, total] = await Promise.all([
      availabilityWindowQueries.listAvailabilityWindows(filters),
      availabilityWindowQueries.countAvailabilityWindows(filters),
    ]);

    return {
      data: availabilityWindows.map((window) => mapAvailabilityWindow(window)),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getAvailabilityWindowById({ windowId }) {
  try {
    const availabilityWindow =
      await availabilityWindowRules.getAvailabilityWindowOrThrow({
        windowId,
        includeDeleted: true,
      });

    return {
      data: mapAvailabilityWindow(availabilityWindow),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

// For public list end point.
export async function listActiveAvailabilityWindowsByResourceId({
  resourceId,
  queryParams = {},
}) {
  try {
    await resourceRules.requirePublicResource({ resourceId });

    const { page, pageSize, sortBy, sortDirection } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    const filters = {
      limit,
      offset,
      sortBy,
      sortDirection,
    };

    const [availabilityWindows, total] = await Promise.all([
      availabilityWindowQueries.listActiveWindowsByResourceId({
        resourceId,
        filters,
      }),
      availabilityWindowQueries.countActiveAvailabilityWindowsByResourceId(
        resourceId,
      ),
    ]);

    return {
      data: availabilityWindows.map((window) =>
        publicAvailabilityWindowMapper({ window }),
      ),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getActiveAvailabilityWindowByResourceIdAndWindowId({
  resourceId,
  windowId,
}) {
  try {
    await resourceRules.requirePublicResource({ resourceId });

    const availabilityWindow =
      await availabilityWindowQueries.getActiveAvailabilityWindowByResourceIdAndWindowId(
        {
          resourceId,
          windowId,
        },
      );

    if (!availabilityWindow) {
      throw availabilityWindowNotFound();
    }

    return {
      data: publicAvailabilityWindowMapper({ window: availabilityWindow }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

// A transaction is needed here cause my rule it to mandate duration
// creation on window creation, so if window creation is good
// but duration creation is bad, then I dont want to end up with
// an active window with no duration.

// This method for transaction  defends against 2 edge cases:
// 1. db.getClient() fails, so there is no client to roll back/release.
// 2. ROLLBACK itself fails, and you don’t want that rollback error to hide the real original error.
export async function createAvailabilityWindow({
  resourceId,
  authUserId,
  availabilityWindowData,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await lockUserOrThrow({ userId: authUserId, client });

    const { startTime, endTime, cancellationNoticeMinutes, allowedDurations } =
      availabilityWindowData;

    // A normal SELECT does not wait for another request's FOR UPDATE lock.
    // If create-window reads the resource without FOR UPDATE, it can see the
    // last committed active = true value and insert a window while deactivate
    // is still running.
    // With FOR UPDATE, create-window waits for deactivate to commit, then reads
    // the latest resource state and rejects if the resource is now inactive.

    // So with FOR UPDATE, SELECT waits for the row if it is already locked
    // (or locks it if not locked). Without FOR UPDATE, SELECT does not wait
    // and reads the current state even while it is being updated.

    // I already have a trigger which blocks writes to inactie resources.
    // The forUpdate here is for consistent responses, the trigger is a
    // back up just incase I forget in the service.
    await resourceRules.requireOwnedActiveResource({
      resourceId,
      authUserId,
      deletedMessage:
        'Cannot create availability window for a deleted resource.',
      inactiveMessage:
        'Cannot create availability window for an inactive resource.',
      forUpdate: true,
      client,
    });

    availabilityWindowRules.validateAllowedDurationsFitWindow({
      startTime,
      endTime,
      allowedDurations,
    });

    const windowData = {
      resourceId,
      startTime,
      endTime,
      cancellationNoticeMinutes,
    };

    const availabilityWindow =
      await availabilityWindowQueries.createAvailabilityWindow({
        windowData,
        client,
      });

    const createdAllowedDurations =
      await availabilityWindowQueries.createAllowedDurations({
        windowId: availabilityWindow.id,
        minutesList: allowedDurations,
        client,
      });

    // Built before COMMIT so mapper errors still roll back the transaction.
    // Without this, the data would be commited and the mapper would throw.
    const data = publicAvailabilityWindowMapper({
      window: availabilityWindow,
      allowedDurations: createdAllowedDurations,
    });

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    // Without this a ROLLBACK error could hide the original error.
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback create availability window transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function createAvailabilityWindowsInBulk({
  resourceId,
  authUserId,
  availabilityWindowDataList,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await lockUserOrThrow({ userId: authUserId, client });

    await resourceRules.requireOwnedActiveResource({
      resourceId,
      authUserId,
      deletedMessage:
        'Cannot create availability window for a deleted resource.',
      inactiveMessage:
        'Cannot create availability window for an inactive resource.',
      forUpdate: true,
      client,
    });

    const data = await createAvailabilityWindowsForResource({
      resourceId,
      availabilityWindowDataList,
      client,
    });

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback create availability windows transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

// Cannot update ongoing or expired windows.
// If the owner does not need an ongoing window
// anymore, then they delete that window instead
// and make a new one.
export async function updateFutureAvailabilityWindow({
  windowId,
  authUserId,
  updateData,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await lockUserOrThrow({ userId: authUserId, client });

    const availabilityWindow =
      await availabilityWindowRules.requireOwnedFutureAvailabilityWindow({
        windowId,
        authUserId,
        forUpdate: true,
        notFutureMessage: 'You can only update future availability windows.',
        deletedResourceMessage:
          'Cannot update availability windows for a deleted resource.',
        inactiveResourceMessage:
          'Cannot update availability windows for an inactive resource.',
        client,
      });

    const { startTime, endTime } = updateData;

    let reservationsCancelled = 0;

    if (startTime !== undefined || endTime !== undefined) {
      // So that I do not place undefined in validateAllowedDurationsFitWindow.
      const startTimeToCheck = startTime ?? availabilityWindow.start_time;
      const endTimeToCheck = endTime ?? availabilityWindow.end_time;

      if (endTimeToCheck.getTime() <= startTimeToCheck.getTime()) {
        throw AppError.badRequest('End time must be after start time.', {
          code: ERROR_CODES.WINDOW_END_TIME_NOT_AFTER_START_TIME,
        });
      }

      const allowedDurations = availabilityWindow.allowed_durations.map(
        (duration) => duration.minutes,
      );

      availabilityWindowRules.validateAllowedDurationsFitWindow({
        startTime: startTimeToCheck,
        endTime: endTimeToCheck,
        allowedDurations,
      });

      reservationsCancelled =
        await reservationQueries.cancelUpcomingReservationsOutsideAvailabilityWindow(
          { windowId, newStartTime: startTime, newEndTime: endTime, client },
        );
    }

    const updatedAvailabilityWindow =
      await availabilityWindowQueries.updateFutureAvailabilityWindow({
        windowId,
        updateData,
        client,
      });

    if (!updatedAvailabilityWindow) {
      throw availabilityWindowStateChanged();
    }

    const data = {
      availabilityWindow: publicAvailabilityWindowMapper({
        window: updatedAvailabilityWindow,
        allowedDurations: availabilityWindow.allowed_durations,
      }),
      reservationsCancelled,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback update future availability window transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function softDeleteAvailabilityWindow({ windowId, authUserId }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    const authUser = await lockUserOrThrow({ userId: authUserId, client });

    // deletedResourceMessage is short since this is a gaurd.
    // Once a resource is deleted all the windows get deleted
    // as well, so this should not normally be sent.
    await availabilityWindowRules.requireOwnedActiveAvailabilityWindowOrAdmin({
      windowId,
      authUserId,
      userRole: authUser.role,
      deletedResourceMessage: 'Resource has been deleted.',
      expiredMessage: 'Cannot delete an expired availability window.',
      forUpdate: true,
      client,
    });

    const availabilityWindow =
      await availabilityWindowQueries.softDeleteAvailabilityWindowById({
        windowId,
        client,
      });

    if (!availabilityWindow) {
      throw availabilityWindowStateChanged();
    }

    const reservationsCancelled =
      await reservationQueries.cancelUpcomingReservationsByAvailabilityWindowId(
        {
          windowId,
          client,
        },
      );

    const data = {
      availabilityWindowId: windowId,
      reservationsCancelled,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback soft delete availability window transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function createAllowedDurations({
  windowId,
  authUserId,
  allowedDurations,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await lockUserOrThrow({ userId: authUserId, client });

    const availabilityWindow =
      await availabilityWindowRules.requireOwnedFutureAvailabilityWindow({
        windowId,
        authUserId,
        forUpdate: true,
        notFutureMessage:
          'You can only create allowed durations for future availability windows.',
        deletedResourceMessage:
          'Cannot create allowed durations for availability windows that belong to a deleted resource.',
        inactiveResourceMessage:
          'Cannot create allowed durations for availability windows that belong to an inactive resource.',
        client,
      });

    await availabilityWindowRules.validateAllowedDurationsFitWindow({
      startTime: availabilityWindow.start_time,
      endTime: availabilityWindow.end_time,
      allowedDurations,
    });

    const createdAllowedDurations =
      await availabilityWindowQueries.createAllowedDurations({
        windowId,
        minutesList: allowedDurations,
        client,
      });

    const data = {
      availabilityWindowId: windowId,
      allowedDurations: createdAllowedDurations,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback create allowed durations transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

// There is a trigger in the db that prevents deletion
// of the last allowed duration of a window.
export async function deleteAllowedDuration({
  windowId,
  durationId,
  authUserId,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await lockUserOrThrow({ userId: authUserId, client });

    const availabilityWindow =
      await availabilityWindowRules.requireOwnedFutureAvailabilityWindow({
        windowId,
        authUserId,
        forUpdate: true,
        notFutureMessage:
          'You can only delete allowed durations for future availability windows.',
        deletedResourceMessage:
          'Cannot delete allowed durations for availability windows that belong to a deleted resource.',
        inactiveResourceMessage:
          'Cannot delete allowed durations for availability windows that belong to an inactive resource.',
        client,
      });

    const allowedDuration =
      await availabilityWindowQueries.getAllowedDurationByDurationIdAndWindowId(
        {
          durationId,
          windowId,
          forUpdate: true,
          client,
        },
      );

    if (!allowedDuration) {
      throw AppError.notFound('Allowed duration not found.', {
        code: ERROR_CODES.ALLOWED_DURATION_NOT_FOUND,
      });
    }

    // Locks the potential effected rows before duration deletion.
    const reservations =
      await reservationQueries.getFutureActiveReservationsByWindowId({
        windowId,
        forUpdate: true,
        client,
      });

    const deletedAllowedDuration =
      await availabilityWindowQueries.deleteAllowedDurationByDurationIdAndWindowId(
        {
          durationId,
          windowId,
          client,
        },
      );

    if (!deletedAllowedDuration) {
      throw AppError.conflict(
        'Allowed duration state changed during request.',
        {
          code: ERROR_CODES.ALLOWED_DURATION_STATE_CHANGED,
        },
      );
    }

    let reservationsCancelled = 0;

    // Comparing against all reamaing durations is better than the one deleted durations.
    // It acts as a gaurd just in case a reservation managed to get through without it fitting
    // into one of the allowed durations.
    if (reservations.length > 0) {
      const remainingAllowedDurations = availabilityWindow.allowed_durations
        .filter((duration) => duration.id !== durationId)
        .map((duration) => duration.minutes);

      for (const reservation of reservations) {
        const reservationDurationMinutes = msToMinutes(
          reservation.end_time.getTime() - reservation.start_time.getTime(),
        );

        if (!remainingAllowedDurations.includes(reservationDurationMinutes)) {
          const cancelledReservation =
            await reservationQueries.cancelReservationById({
              reservationId: reservation.id,
              client,
            });

          // A gaurd just in case cancelReservationById somehow returns null.
          if (cancelledReservation) {
            reservationsCancelled += 1;
          }
        }
      }
    }

    const data = {
      allowedDurationId: durationId,
      reservationsCancelled,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback delete allowed duration transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}
