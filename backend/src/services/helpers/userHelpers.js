import * as userQueries from '../../data-access/users.js';
import * as db from '../../db/db.js';
import AppError from '../../errors/AppError.js';
import ERROR_CODES from '../../errors/errorCodes.js';

export async function lockUserOrThrow({
  userId,
  errorMessage,
  errorCode,
  client = db,
}) {
  if (client === db) {
    throw new Error('Cannot lock user without a transaction client.');
  }

  const lockedUser = await userQueries.lockUser({
    userId,
    client,
  });

  if (!lockedUser) {
    throw AppError.conflict(
      errorMessage ?? 'Authenticated user was deleted during request.',
      {
        code: errorCode ?? ERROR_CODES.AUTH_USER_DELETED_DURING_REQUEST,
      },
    );
  }

  return lockedUser;
}

export async function lockUserIncludingDeletedOrThrow({
  userId,
  notFoundMessage,
  notFoundCode,
  client = db,
}) {
  if (client === db) {
    throw new Error('Cannot lock user without a transaction client.');
  }

  const lockedUser = await userQueries.lockUserIncludingDeleted({
    userId,
    client,
  });

  if (!lockedUser) {
    throw AppError.notFound(notFoundMessage ?? 'User not found.', {
      code: notFoundCode ?? ERROR_CODES.USER_NOT_FOUND,
    });
  }

  return lockedUser;
}

export async function lockAuthUserAndTargetUser({
  authUserId,
  targetUserId,
  targetNotFoundMessage,
  targetNotFoundCode,
  client = db,
}) {
  if (client === db) {
    throw new Error('Cannot lock users without a transaction client.');
  }

  if (authUserId === targetUserId) {
    throw new Error(
      'lockAuthUserAndTargetUser requires different authUserId and targetUserId.',
    );
  }

  // Lock consistently (through out the code base if locking the same table more than once in a single service)
  // in asc order to a avoid deadlock.
  const ascUserIds = [authUserId, targetUserId].sort((a, b) => a - b);

  let authUser;
  let targetUser;

  for (const userId of ascUserIds) {
    if (userId === targetUserId) {
      targetUser = await lockUserIncludingDeletedOrThrow({
        userId,
        notFoundMessage: targetNotFoundMessage,
        notFoundCode: targetNotFoundCode,
        client,
      });
    }

    if (userId === authUserId) {
      authUser = await lockUserOrThrow({
        userId,
        client,
      });
    }
  }

  return {
    authUser,
    targetUser,
  };
}
