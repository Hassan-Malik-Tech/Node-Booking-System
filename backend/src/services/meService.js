import * as userQueries from '../data-access/users.js';
import * as resourceQueries from '../data-access/resources.js';
import * as reservationQueries from '../data-access/reservations.js';
import * as availabilityWindowQueries from '../data-access/availabilityWindows.js';
import * as reservationRules from './rules/reservationRules.js';
import * as resourceRules from './rules/resourceRules.js';
import * as availabilityWindowRules from './rules/availabilityWindowRules.js';
import * as authRules from './rules/authRules.js';
import caughtError from '../errors/caughtError.js';
import AppError from '../errors/AppError.js';
import { mapUser } from './helpers/commonMappers.js';
import { hashPassword } from '../auth/password.js';
import { invalidTokenError } from '../errors/commonErrors.js';
import ERROR_CODES from '../errors/errorCodes.js';
import { mapResourceForStaff } from './resourceService.js';
import {
  getLimitAndOffset,
  buildPagination,
} from './helpers/paginationHelpers.js';
import { lockUserOrThrow } from './helpers/userHelpers.js';
import { minutesToMs } from '../utils/time.js';
import * as db from '../db/db.js';

function mapResourceForOwner(resource) {
  return mapResourceForStaff(resource);
}

function mapReservationForUser(reservation) {
  // A reservation can be completed by the system and later confirmed by staff.
  // For the completedAt field, show the earliest completion time.
  const isStaffCompleted = reservation.staff_completed_at !== null;
  const isSystemCompleted = reservation.system_completed_at !== null;

  let completedAt = null;

  if (isStaffCompleted && isSystemCompleted) {
    completedAt =
      reservation.staff_completed_at.getTime() <=
      reservation.system_completed_at.getTime()
        ? reservation.staff_completed_at
        : reservation.system_completed_at;
  }

  if (isStaffCompleted && !isSystemCompleted) {
    completedAt = reservation.staff_completed_at;
  }

  if (!isStaffCompleted && isSystemCompleted) {
    completedAt = reservation.system_completed_at;
  }

  return {
    id: reservation.id,
    userId: reservation.user_id,
    resourceId: reservation.resource_id,
    availabilityWindowId: reservation.availability_window_id,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    partySize: reservation.party_size,
    status: reservation.status,
    completedAt,
    cancelledAt: reservation.cancelled_at,
    createdAt: reservation.created_at,
    updatedAt: reservation.updated_at,
  };
}

export function getProfile({ user }) {
  return {
    data: mapUser(user),
  };
}

export async function listOwnedResources({ queryParams = {}, authUserId }) {
  try {
    const {
      page,
      pageSize,
      search,
      sortBy = 'createdAt',
      sortDirection = 'desc',
      status = 'active',
    } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    // Reuses the staff function, but forces ownerId
    // and wrap it in a function with the correct name.
    const filters = {
      limit,
      offset,
      search,
      sortBy,
      sortDirection,
      ownerId: authUserId,
      status,
    };

    const [resources, total] = await Promise.all([
      resourceQueries.listResourcesForOwner(filters),
      resourceQueries.countResourcesForOwner(filters),
    ]);

    return {
      data: resources.map((resource) => mapResourceForOwner(resource)),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function listOwnReservations({ queryParams = {}, authUserId }) {
  try {
    const {
      page,
      pageSize,
      sortBy = 'startTime',
      sortDirection = 'asc',
      status = 'active',
      timing,
    } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    // Reuses the staff list function, but forces reservationUserId
    // and omits filters like resourceOwnerId, resourceId,
    // availabilityWindowId, and search.
    // The wrapper gives the user reservation list a correct name.
    const filters = {
      limit,
      offset,
      sortBy,
      sortDirection,
      status,
      timing,
      reservationUserId: authUserId,
    };

    const [reservations, total] = await Promise.all([
      reservationQueries.listReservationsForUser(filters),
      reservationQueries.countReservationsForUser(filters),
    ]);

    return {
      data: reservations.map((reservation) =>
        mapReservationForUser(reservation),
      ),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function listReservationsForOwnedResources({
  queryParams = {},
  authUserId,
}) {
  try {
    const {
      page,
      pageSize,
      sortBy = 'startTime',
      sortDirection = 'asc',
      status = 'active',
      timing,
      resourceId,
      search,
      availabilityWindowId,
      reservationUserId,
    } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    const filters = {
      limit,
      offset,
      sortBy,
      sortDirection,
      status,
      timing,
      resourceId,
      search,
      availabilityWindowId,
      reservationUserId,
      resourceOwnerId: authUserId,
    };

    const [reservations, total] = await Promise.all([
      reservationQueries.listReservationsForResourceOwner(filters),
      reservationQueries.countReservationsForResourceOwner(filters),
    ]);

    return {
      data: reservations.map((reservation) =>
        mapReservationForUser(reservation),
      ),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getOwnReservation({ authUserId, reservationId }) {
  try {
    const reservation =
      await reservationQueries.getReservationByUserIdAndReservationId({
        userId: authUserId,
        reservationId,
      });

    if (!reservation) {
      throw AppError.notFound(
        'No reservation with that id was found for your account.',
        {
          code: ERROR_CODES.RESERVATION_NOT_FOUND,
        },
      );
    }

    return {
      data: mapReservationForUser(reservation),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function updateProfile({ authUserId, updateData }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    const authUser = await lockUserOrThrow({ userId: authUserId, client });

    const { username: newUsername, email: newEmail } = updateData;

    const conflictDetails = [];

    // If the email exists in the request body,
    // it checks to see if the email is already taken
    // not counting the users current email.
    if (
      newEmail !== undefined &&
      newEmail.toLowerCase() !== authUser.email.toLowerCase()
    ) {
      const emailExists = await userQueries.activeEmailExists(newEmail, {
        client,
      });

      if (emailExists) {
        conflictDetails.push({
          field: 'email',
          code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
          message: 'The email you have entered already exists.',
        });
      }
    }

    // If the username exists in the request body,
    // it checks to see if the username is already taken
    // not counting the users current username.
    if (
      newUsername !== undefined &&
      newUsername.toLowerCase() !== authUser.username.toLowerCase()
    ) {
      const usernameExists = await userQueries.activeUsernameExists(
        newUsername,
        { client },
      );

      if (usernameExists) {
        conflictDetails.push({
          field: 'username',
          code: ERROR_CODES.USERNAME_ALREADY_EXISTS,
          message: 'The username you have entered already exists.',
        });
      }
    }

    if (conflictDetails.length > 0) {
      throw AppError.conflict('Update fields are already in use.', {
        code: ERROR_CODES.UPDATE_FIELD_CONFLICT,
        details: conflictDetails,
      });
    }

    const updatedUser = await userQueries.updateActiveUserById({
      userId: authUserId,
      updateData,
      client,
    });

    // Defensive, should never trigger as user is locked.
    if (!updatedUser) {
      throw AppError.conflict('Your account was deleted.', {
        code: ERROR_CODES.USER_ALREADY_DELETED,
      });
    }

    const data = mapUser(updatedUser);

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
          'Failed to rollback update profile transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function updatePassword({ authUserId, newPassword }) {
  try {
    const passwordHash = await hashPassword(newPassword);

    const updatedPassword = await userQueries.updatePassword({
      userId: authUserId,
      passwordHash,
    });

    // This is a gaurd against a race condition.
    // If in the process of updating the password
    // the user is deleted, this gaurds against it.
    if (!updatedPassword) {
      throw invalidTokenError();
    }
  } catch (error) {
    throw caughtError(error);
  }
}

export async function softDeleteOwnAccount({ authUserId }) {
  const now = Date.now();
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    const authUser = await lockUserOrThrow({ userId: authUserId, client });

    // Only admins should delete employees.
    if (authUser.role === 'employee') {
      throw AppError.forbidden(
        'You can no longer delete your own account because your account was changed to an employee account.',
      );
    }

    // Admins can only be deleted in the db with sql not in a route.
    authRules.requireUserIsNotAdmin({
      user: authUser,
      message:
        'You can no longer delete your own account because your account was changed to an admin account.',
    });

    const futureAndOngoingReservations =
      await reservationQueries.getFutureAndOngoingReservationsByUserId({
        userId: authUserId,
        client,
      });

    for (const reservation of futureAndOngoingReservations) {
      reservationRules.requireReservationNotOngoing({
        reservation,
        now,
        message:
          'Cannot delete your account while you have an ongoing reservation.',
        code: ERROR_CODES.USER_HAS_ONGOING_RESERVATION,
      });

      // Cancellation notice does not apply if the reservation user owns the resource.
      const userDoesNotOwnReservationResource =
        reservation.resource_owner_id !== authUserId;

      const isPastCancellationNoticePeriod =
        reservationRules.isPastCancellationNoticePeriod({
          reservation,
          cancellationNoticeMinutes:
            reservation.availability_window_cancellation_notice_minutes,
          now,
        });

      if (userDoesNotOwnReservationResource && isPastCancellationNoticePeriod) {
        throw AppError.conflict(
          'Cannot delete your account while you have an upcoming reservation past its cancellation notice period.',
          {
            code: ERROR_CODES.USER_HAS_NON_CANCELLABLE_RESERVATION,
          },
        );
      }
    }

    const deletedResourceIds =
      await resourceQueries.softDeleteResourcesByOwnerId({
        ownerId: authUserId,
        client,
      });

    const availabilityWindowsDeleted =
      await availabilityWindowQueries.softDeleteAvailabilityWindowsByResourceOwnerId(
        { ownerId: authUserId, client },
      );

    const ownUpcomingReservationsCancelled =
      await reservationQueries.cancelUpcomingReservationsByUserId({
        userId: authUserId,
        client,
      });

    let upcomingReservationsCancelledOnOwnedResources = 0;
    if (deletedResourceIds.length > 0) {
      upcomingReservationsCancelledOnOwnedResources =
        await reservationQueries.cancelUpcomingReservationsByResourceIds({
          resourceIds: deletedResourceIds,
          client,
        });
    }

    const deletedUser = await userQueries.softDeleteUserById({
      userId: authUserId,
      client,
    });

    // Defensive, should never trigger if the locking is done correctly.
    if (!deletedUser) {
      throw AppError.conflict('User account is already deleted.', {
        code: ERROR_CODES.USER_ALREADY_DELETED,
      });
    }

    const data = {
      userId: deletedUser.id,
      deletedAt: deletedUser.deleted_at,
      resourcesDeleted: deletedResourceIds.length,
      availabilityWindowsDeleted,
      upcomingReservationsCancelledOnOwnedResources,
      ownUpcomingReservationsCancelled,
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
          'Failed to rollback soft delete own account transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}
