import * as userQueries from '../data-access/users.js';
import caughtError from '../errors/caughtError.js';
import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import { mapUser } from './helpers/commonMappers.js';

export async function getProfile(userId) {
  try {
    const profile = await userQueries.getActiveUserById(userId);

    // The auth middleware already checked this user, but the account could be
    // soft deleted before this query runs, This gaurds against that.
    if (!profile) {
      throw AppError.unauthorized('Invalid or expired token.', {
        code: ERROR_CODES.INVALID_TOKEN,
      });
    }

    return {
      data: mapUser(profile),
    };
  } catch (error) {
    throw caughtError(error);
  }
}
