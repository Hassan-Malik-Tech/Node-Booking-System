import * as reservationQueries from '../data-access/reservations.js';
import * as reservationRules from './rules/reservationRules.js';
import * as resourceRules from './rules/resourceRules.js';
import * as authRules from './rules/authRules.js';
import * as availabilityWindowRules from './rules/availabilityWindowRules.js';
import * as userQueries from '../data-access/users.js';
import * as availabilityWindowQueries from '../data-access/availabilityWindows.js';
import * as resourceQueries from '../data-access/resources.js';
import caughtError from '../errors/caughtError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import * as db from '../db/db.js';
import AppError from '../errors/AppError.js';
import {
  forbidden,
  reservationStateChanged,
  resourceStateChanged,
  availabilityWindowStateChanged,
} from '../errors/commonErrors.js';
import { lockUserOrThrow } from './helpers/userHelpers.js';
import {
  getLimitAndOffset,
  buildPagination,
} from './helpers/paginationHelpers.js';
import { minutesToMs, msToMinutes } from '../utils/time.js';

function mapBookedReservation(reservation) {
  return {
    id: reservation.id,
    userId: reservation.user_id,
    resourceId: reservation.resource_id,
    availabilityWindowId: reservation.availability_window_id,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    partySize: reservation.party_size,
    status: reservation.status,
    createdAt: reservation.created_at,
    updatedAt: reservation.updated_at,
  };
}

function mapReservationForStaff(reservation) {
  return {
    id: reservation.id,
    userId: reservation.user_id,
    resourceId: reservation.resource_id,
    availabilityWindowId: reservation.availability_window_id,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    partySize: reservation.party_size,
    status: reservation.status,
    staffCompletedByUserId: reservation.staff_completed_by_user_id,
    systemCompletedAt: reservation.system_completed_at,
    staffCompletedAt: reservation.staff_completed_at,
    cancelledAt: reservation.cancelled_at,
    createdAt: reservation.created_at,
    updatedAt: reservation.updated_at,
  };
}

export async function listReservationsForStaff({ queryParams = {} } = {}) {
  try {
    const {
      page,
      pageSize,
      sortBy = 'startTime',
      sortDirection = 'asc',
      resourceId,
      resourceOwnerId,
      reservationUserId,
      availabilityWindowId,
      search,
      status = 'active',
      timing,
    } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    const filters = {
      limit,
      offset,
      sortBy,
      sortDirection,
      resourceId,
      resourceOwnerId,
      reservationUserId,
      availabilityWindowId,
      search,
      status,
      timing,
    };

    const [reservations, total] = await Promise.all([
      reservationQueries.listReservationsForStaff(filters),
      reservationQueries.countReservationsForStaff(filters),
    ]);

    return {
      data: reservations.map((reservation) =>
        mapReservationForStaff(reservation),
      ),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getReservationByIdForStaff({ reservationId }) {
  try {
    const reservation = await reservationRules.getReservationOrThrow({
      reservationId,
    });

    return {
      data: mapReservationForStaff(reservation),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function bookReservation({ authUserId, reservationData }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await lockUserOrThrow({ userId: authUserId, client });

    const { resourceId, availabilityWindowId, startTime, endTime, partySize } =
      reservationData;

    const { resource, availabilityWindow } =
      await resourceRules.requirePublicResourceAndAvailabilityWindow({
        resourceId,
        windowId: availabilityWindowId,
        forUpdate: true,
        client,
      });

    if (
      startTime.getTime() < availabilityWindow.start_time.getTime() ||
      endTime.getTime() > availabilityWindow.end_time.getTime()
    ) {
      throw AppError.badRequest(
        'Reservation must fit within the availability window.',
        {
          code: ERROR_CODES.RESERVATION_OUTSIDE_AVAILABILITY_WINDOW,
        },
      );
    }

    const reservationDurationMinutes = msToMinutes(
      endTime.getTime() - startTime.getTime(),
    );

    // To verify that the reservation duration is equal to one of
    // the allowed durations for the window being booked.
    //
    // Also so that I can lock the duration being used.
    const allowedDuration =
      await availabilityWindowQueries.getAllowedDurationByWindowIdAndMinutes({
        windowId: availabilityWindow.id,
        minutes: reservationDurationMinutes,
        forUpdate: true,
        client,
      });

    if (!allowedDuration) {
      throw AppError.badRequest(
        'Reservation duration is not allowed for this availability window.',
        {
          code: ERROR_CODES.RESERVATION_DURATION_NOT_ALLOWED,
        },
      );
    }

    reservationRules.requirePartySizeWithinResourceCapacity({
      partySize,
      resourceCapacity: resource.capacity,
    });

    // This retry check is useful for reservations because an overlap conflict
    // could mean either this user already booked the exact reservation or another
    // user's reservation is blocking the slot. For resources/windows, duplicate
    // conflicts are less ambiguous because those rows belong to the current owner,
    // not to another user competing for the same slot.
    const existingReservation =
      await reservationQueries.getReservationAlreadyBookedByUser({
        authUserId,
        reservationData,
        client,
      });

    // If created = true, the status code is 201
    // if false then 200.
    let newReservation;
    let created = false;

    if (!existingReservation) {
      newReservation = await reservationQueries.createReservation({
        userId: authUserId,
        reservationData,
        client,
      });

      created = true;
    }

    const data = mapBookedReservation(existingReservation ?? newReservation);

    await client.query('COMMIT');

    return {
      data,
      created,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback book reservation transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function cancelReservation({ reservationId, authUserId }) {
  const now = Date.now();
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    const authUser = await lockUserOrThrow({
      userId: authUserId,
      client,
    });

    const initialFetchedReservation =
      await reservationRules.getReservationOrThrow({
        reservationId,
        client,
      });

    // Resource not found should never throw unless it somehow got hard deleted.
    // The throw is just here as a guard.
    const resource = await resourceRules.getResourceOrThrow({
      resourceId: initialFetchedReservation.resource_id,
      forUpdate: true,
      client,
    });

    const userIsCancellingOwnReservation =
      initialFetchedReservation.user_id === authUser.id;

    const userOwnsReservationResource = resource.owner_id === authUser.id;

    const userIsStaff = authRules.isStaff(authUser.role);

    if (
      !userIsCancellingOwnReservation &&
      !userOwnsReservationResource &&
      !userIsStaff
    ) {
      throw forbidden();
    }

    const availabilityWindow =
      await availabilityWindowRules.getAvailabilityWindowOrThrow({
        windowId: initialFetchedReservation.availability_window_id,
        includeDeleted: true,
        forUpdate: true,
        client,
      });

    const reservation = await reservationRules.getReservationOrThrow({
      reservationId,
      forUpdate: true,
      client,
    });

    reservationRules.requireNotCancelled({
      reservation,
      message: 'Reservation is already cancelled.',
    });

    reservationRules.requireNotCompleted({
      reservation,
      message: 'Cannot cancel a completed reservation.',
    });

    reservationRules.requireActiveReservationHasNotEnded({
      reservation,
      now,
      message: 'Cannot cancel a past reservation.',
    });

    reservationRules.requireReservationNotOngoing({
      reservation,
      now,
      message: 'Cannot cancel a reservation that has already started.',
    });

    // Resource owners can bypass cancellation notice minutes for reservations
    // on their own resources and reservations made by other users on their resource.
    // Staff cannot bypass notice for their own reservations unless they own
    // the resource, but staff can bypass notice when cancelling another user's
    // reservation.

    // The verbosity is to make the business rules clear and easier to reason about.
    const nonStaffUserIsCancellingOwnReservationAndDoesNotOwnResource =
      userIsCancellingOwnReservation &&
      !userIsStaff &&
      !userOwnsReservationResource;

    const staffUserIsCancellingOwnReservationAndDoesNotOwnResource =
      userIsStaff &&
      userIsCancellingOwnReservation &&
      !userOwnsReservationResource;

    if (
      nonStaffUserIsCancellingOwnReservationAndDoesNotOwnResource ||
      staffUserIsCancellingOwnReservationAndDoesNotOwnResource
    ) {
      const isPastCancellationNoticePeriod =
        reservationRules.isPastCancellationNoticePeriod({
          reservation,
          cancellationNoticeMinutes:
            availabilityWindow.cancellation_notice_minutes,
          now,
        });

      if (isPastCancellationNoticePeriod) {
        throw AppError.conflict(
          'You can no longer cancel this reservation because the cancellation notice period has passed.',
          {
            code: ERROR_CODES.RESERVATION_CANCELLATION_NOTICE_PASSED,
          },
        );
      }
    }

    const cancelledReservation = await reservationQueries.cancelReservationById(
      { reservationId, futureOnly: true, client },
    );

    if (!cancelledReservation) {
      throw AppError.conflict('Reservation is no longer cancellable.', {
        code: ERROR_CODES.RESERVATION_NO_LONGER_CANCELLABLE,
      });
    }

    const data = {
      reservationId: cancelledReservation.id,
      status: cancelledReservation.status,
      cancelledAt: cancelledReservation.cancelled_at,
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
          'Failed to rollback cancel reservation transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function completeReservation({ reservationId, authUserId }) {
  const now = Date.now();
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    const authUser = await lockUserOrThrow({
      userId: authUserId,
      client,
    });

    // Extra check as the role could potentially change mid request.
    // Have this as well as requireRole.
    authRules.requireStaff({
      userRole: authUser.role,
      forbiddenMessage: 'You are no longer authorized as a staff member.',
    });

    const reservation = await reservationRules.getReservationOrThrow({
      reservationId,
      forUpdate: true,
      client,
    });

    // A staff memeber cannot complete their own reservation.
    if (authUser.id === reservation.user_id) {
      throw forbidden({ message: 'You cannot complete your own reservation.' });
    }

    reservationRules.requireNotCompleted({
      reservation,
      message: 'Reservation already completed.',
    });

    // Should not be the case, but a guard just in case.
    reservationRules.requireNotCancelled({
      reservation,
      message: 'Cannot complete a cancelled reservation.',
    });

    reservationRules.requireReservationStarted({
      reservation,
      now,
      message: 'You cannot complete a reservation that has not started yet.',
    });

    const completedReservation =
      await reservationQueries.completeOngoingOrExpiredReservationByStaff({
        reservationId,
        staffUserId: authUser.id,
        client,
      });

    // A guard, it should normally never happen.
    if (!completedReservation) {
      throw reservationStateChanged({
        message: 'Reservation is no longer completable.',
      });
    }

    const data = mapReservationForStaff(completedReservation);

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
          'Failed to rollback complete reservation transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function updateReservationPartySize({
  reservationId,
  authUserId,
  partySize,
}) {
  const now = Date.now();
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await lockUserOrThrow({ userId: authUserId, client });

    const initialFetchedReservation =
      await reservationRules.getReservationOrThrow({
        reservationId,
        client,
      });

    reservationRules.requireReservationOwner({
      reservation: initialFetchedReservation,
      authUserId,
    });

    const resource = await resourceRules.getResourceOrThrow({
      resourceId: initialFetchedReservation.resource_id,
      forUpdate: true,
      client,
    });

    const availabilityWindow =
      await availabilityWindowRules.getAvailabilityWindowOrThrow({
        windowId: initialFetchedReservation.availability_window_id,
        includeDeleted: true,
        forUpdate: true,
        client,
      });

    const reservation = await reservationRules.getReservationOrThrow({
      reservationId,
      forUpdate: true,
      client,
    });

    // Not needed for current behavior, just extra defense in case I make a mistake later.
    reservationRules.requireReservationOwner({
      reservation,
      authUserId,
    });

    reservationRules.requireNotCompleted({
      reservation,
      message: 'Cannot update party size for a completed reservation.',
    });

    reservationRules.requireNotCancelled({
      reservation,
      message: 'Cannot update party size for a cancelled reservation.',
    });

    reservationRules.requireActiveReservationHasNotEnded({
      reservation,
      now,
      message: 'Cannot update party size for a past reservation.',
    });

    reservationRules.requireReservationNotOngoing({
      reservation,
      now,
      message:
        'Cannot update party size for a reservation that has already started.',
    });

    // This comes after reservation state checks because a deleted or inactive
    // resource can still have an ongoing reservation if the resource was deleted
    // or deactivated while the reservation was ongoing.
    //
    // These two checks are defensive. Deleting/deactivating the resource
    // or deleting the window should already cancel all future reservations.
    if (resource.deleted_at !== null || resource.is_active === false) {
      throw resourceStateChanged({
        message:
          'You can no longer update this reservation because the resource is no longer bookable.',
      });
    }

    if (availabilityWindow.deleted_at !== null) {
      throw availabilityWindowStateChanged({
        message:
          'You can no longer update this reservation because the availability window is no longer bookable.',
      });
    }

    reservationRules.requirePartySizeWithinResourceCapacity({
      partySize,
      resourceCapacity: resource.capacity,
    });

    const updatedReservation =
      await reservationQueries.updateFutureReservationPartySize({
        reservationId,
        authUserId,
        partySize,
        client,
      });

    if (!updatedReservation) {
      throw reservationStateChanged({
        message: 'Reservation party size is no longer updatable.',
      });
    }

    const data = mapBookedReservation(updatedReservation);

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
          'Failed to rollback update reservation party size transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}
