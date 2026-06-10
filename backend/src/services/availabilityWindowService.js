import * as availabilityWindowQueries from '../data-access/availabilityWindows.js';
import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import caughtError from '../errors/caughtError.js';
import {
  getLimitAndOffset,
  buildPagination,
} from './helpers/paginationHelpers.js';
import * as db from '../db/db.js';
import * as resourceRules from './rules/resourceRules.js';
import * as availabilityWindowRules from './rules/availabilityWindowRules.js';
import { createAvailabilityWindowsForResource } from './helpers/availabilityWindowHelpers.js';
import { availabilityWindowNotFound } from '../errors/commonErrors.js';

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
export async function listAvailabilityWindows(queryParams) {
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

export async function getAvailabilityWindowById(windowId) {
  try {
    const availabilityWindow =
      await availabilityWindowQueries.getAvailabilityWindowById(windowId);

    if (!availabilityWindow) {
      throw availabilityWindowNotFound();
    }

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
  queryParams,
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
