import * as userQueries from '../data-access/users.js';
import * as resourceQueries from '../data-access/resources.js';
import * as reservationQueries from '../data-access/reservations.js';
import * as availabilityWindowQueries from '../data-access/availabilityWindows.js';
import AppError from '../errors/AppError.js';
import caughtError from '../errors/caughtError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import * as db from '../db/db.js';
import {
  lockUserOrThrow,
  lockUserIncludingDeletedOrThrow,
  lockAuthUserAndTargetUser,
} from './helpers/userHelpers.js';
import * as authRules from './rules/authRules.js';
import {
  userStateChanged,
  userNotFound,
  forbidden,
} from '../errors/commonErrors.js';
import { hashPassword } from '../auth/password.js';
import {
  getLimitAndOffset,
  buildPagination,
} from './helpers/paginationHelpers.js';

function mapUserForStaff(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    deletedAt: user.deleted_at,
  };
}

export async function listUsersForStaff({ queryParams = {} } = {}) {
  try {
    const {
      page,
      pageSize,
      sortBy = 'createdAt',
      sortDirection = 'desc',
      status = 'active',
      role = 'all',
      search,
    } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    const filters = {
      limit,
      offset,
      sortBy,
      sortDirection,
      status,
      role,
      search,
    };

    const [users, total] = await Promise.all([
      userQueries.listUsersForStaff(filters),
      userQueries.countUsersForStaff(filters),
    ]);

    return {
      data: users.map((user) => mapUserForStaff(user)),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getUserByIdForStaff({ userId }) {
  try {
    const user = await userQueries.getUserById({ userId });

    if (!user) {
      throw userNotFound();
    }

    return {
      data: mapUserForStaff(user),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function softDeleteUserAsAdmin({ authUserId, targetUserId }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    // It is up here to avoid locking the same user twice
    // avoiding by having the same 2 ids in ascUserIds.
    authRules.requireTargetIsNotAuthUser({
      authUserId,
      targetUserId,
      forbiddenMessage:
        'You cannot delete your own account through this route.',
    });

    const { authUser, targetUser } = await lockAuthUserAndTargetUser({
      authUserId,
      targetUserId,
      client,
    });

    authRules.requireAdmin({
      userRole: authUser.role,
      forbiddenMessage: 'You are no longer authorized as an admin.',
    });

    authRules.requireUserNotDeleted({
      user: targetUser,
      message: 'User account is already deleted.',
      code: ERROR_CODES.USER_ALREADY_DELETED,
    });

    // In my system an admin cannot be deleted via an http request.
    // It must happen sql/db side to account for the lack of a super_admin role.
    // An admin cannot delete another admin.
    authRules.requireUserIsNotAdmin({
      user: targetUser,
      message: 'Admin accounts cannot be deleted through this route.',
      code: ERROR_CODES.ADMIN_DELETION_NOT_ALLOWED,
    });

    const ongoingReservations =
      await reservationQueries.getOngoingReservationsByUserId({
        userId: targetUserId,
        client,
      });

    if (ongoingReservations.length > 0) {
      throw AppError.conflict(
        'Cannot delete user while they have an ongoing reservation.',
        {
          code: ERROR_CODES.USER_HAS_ONGOING_RESERVATION,
        },
      );
    }

    const deletedResourceIds =
      await resourceQueries.softDeleteResourcesByOwnerId({
        ownerId: targetUserId,
        client,
      });

    const availabilityWindowsDeleted =
      await availabilityWindowQueries.softDeleteAvailabilityWindowsByResourceOwnerId(
        { ownerId: targetUserId, client },
      );

    const deletedUserUpcomingReservationsCancelled =
      await reservationQueries.cancelUpcomingReservationsByUserId({
        userId: targetUserId,
        client,
      });

    let upcomingReservationsCancelledOnDeletedUserResources = 0;
    if (deletedResourceIds.length > 0) {
      upcomingReservationsCancelledOnDeletedUserResources =
        await reservationQueries.cancelUpcomingReservationsByResourceIds({
          resourceIds: deletedResourceIds,
          client,
        });
    }

    const deletedUser = await userQueries.softDeleteUserById({
      userId: targetUserId,
      client,
    });

    // Defensive, should never trigger if the locking is done correctly.
    if (!deletedUser) {
      throw AppError.conflict('User account is already deleted.', {
        code: ERROR_CODES.USER_ALREADY_DELETED,
      });
    }

    const data = {
      deletedUser: mapUserForStaff(deletedUser),
      resourcesDeleted: deletedResourceIds.length,
      availabilityWindowsDeleted,
      upcomingReservationsCancelledOnDeletedUserResources,
      deletedUserUpcomingReservationsCancelled,
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
          'Failed to rollback soft delete user as admin transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

// Cannot update the role of an admin via an http request.
// That can only be done in the db with sql.
// Can only update user to employee and vice versa.
export async function updateUserRoleAsAdmin({
  authUserId,
  targetUserId,
  newRole,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    authRules.requireTargetIsNotAuthUser({
      authUserId,
      targetUserId,
      forbiddenMessage: 'You cannot update your own role.',
    });

    const { authUser, targetUser } = await lockAuthUserAndTargetUser({
      authUserId,
      targetUserId,
      client,
    });

    authRules.requireAdmin({
      userRole: authUser.role,
      forbiddenMessage: 'You are no longer authorized as an admin.',
    });

    authRules.requireUserNotDeleted({
      user: targetUser,
      message: 'You cannot update the role of a deleted user.',
      code: ERROR_CODES.USER_ALREADY_DELETED,
    });

    authRules.requireUserIsNotAdmin({
      user: targetUser,
      message: 'You cannot update the role of an admin.',
      code: ERROR_CODES.ADMIN_ROLE_UPDATE_NOT_ALLOWED,
    });

    if (targetUser.role === newRole) {
      throw AppError.conflict('User already has this role.', {
        code: ERROR_CODES.USER_ROLE_ALREADY_SET,
      });
    }

    const updatedUser = await userQueries.updateNonAdminUserRole({
      userId: targetUserId,
      newRole,
      client,
    });

    // Defensive, should never trigger if my logic is correct.
    if (!updatedUser) {
      throw userStateChanged({
        message:
          'The role of this user is no longer updatable through this route.',
      });
    }

    const data = mapUserForStaff(updatedUser);

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
          'Failed to rollback update user role as admin transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

// Duplicate usernames are handled by DB unique constraint translation.
export async function updateUserAsAdmin({
  authUserId,
  targetUserId,
  updateData,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    authRules.requireTargetIsNotAuthUser({
      authUserId,
      targetUserId,
      forbiddenMessage:
        'You cannot update your own account through this route.',
    });

    const { authUser, targetUser } = await lockAuthUserAndTargetUser({
      authUserId,
      targetUserId,
      client,
    });

    authRules.requireAdmin({
      userRole: authUser.role,
      forbiddenMessage: 'You are no longer authorized as an admin.',
    });

    authRules.requireUserNotDeleted({
      user: targetUser,
      message: 'You cannot update a deleted user.',
      code: ERROR_CODES.USER_ALREADY_DELETED,
    });

    authRules.requireUserIsNotAdmin({
      user: targetUser,
      message: 'Admin accounts cannot be updated through this route.',
      code: ERROR_CODES.ADMIN_UPDATE_NOT_ALLOWED,
    });

    const updatedUser = await userQueries.updateActiveUserById({
      userId: targetUserId,
      updateData,
      isAdminManagedUpdate: true,
      client,
    });

    // Defensive, should never trigger normally.
    if (!updatedUser) {
      throw userStateChanged({
        message: 'This user is no longer updatable through this route.',
      });
    }

    const data = mapUserForStaff(updatedUser);

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
          'Failed to rollback update user as admin transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function createUserAsAdmin({ authUserId, userData }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    const authUser = await lockUserOrThrow({ userId: authUserId, client });

    authRules.requireAdmin({
      userRole: authUser.role,
      forbiddenMessage: 'You are no longer authorized as an admin.',
    });

    const { username, email, password, name, role } = userData;

    const [emailExists, usernameExists] = await Promise.all([
      userQueries.activeEmailExists(email, { client }),
      userQueries.activeUsernameExists(username, { client }),
    ]);

    const conflictDetails = [];

    if (emailExists) {
      conflictDetails.push({
        field: 'email',
        code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
        message: 'The email you have entered already exists.',
      });
    }

    if (usernameExists) {
      conflictDetails.push({
        field: 'username',
        code: ERROR_CODES.USERNAME_ALREADY_EXISTS,
        message: 'The username you have entered already exists.',
      });
    }

    if (conflictDetails.length > 0) {
      throw AppError.conflict('User creation fields are already in use.', {
        code: ERROR_CODES.USER_CREATION_CONFLICT,
        details: conflictDetails,
      });
    }

    const passwordHash = await hashPassword(password);

    const createdUser = await userQueries.createUserAsAdmin({
      userData: { username, passwordHash, name, email, role },
      client,
    });

    const data = mapUserForStaff(createdUser);

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
          'Failed to rollback create user as admin transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}
