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
