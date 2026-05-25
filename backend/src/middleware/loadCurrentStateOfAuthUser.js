import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import { getCurrentUserForAuth } from '../data-access/users.js';

async function loadCurrentStateOfAuthUser(req, res, next) {
  try {
    const userId = req.auth.userId;
    // Check to see if the token user is still active,
    // and to get the latest role (if it changed) since aquring the token initially.
    const currentUser = await getCurrentUserForAuth(userId);

    if (!currentUser) {
      throw AppError.unauthorized('Invalid or expired token.', {
        code: ERROR_CODES.INVALID_TOKEN,
      });
    }

    req.auth = {
      userId,
      role: currentUser.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export default loadCurrentStateOfAuthUser;
