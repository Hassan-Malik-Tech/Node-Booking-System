import { getActiveUserById } from '../data-access/users.js';
import { invalidTokenError } from '../errors/commonErrors.js';

async function loadCurrentStateOfAuthUser(req, res, next) {
  try {
    if (req.auth === undefined) {
      throw new Error(
        'loadCurrentStateOfAuthUser must be placed after requireAuth.',
      );
    }

    const userId = req.auth.userId;
    // Check that the token user is still active,
    // and load the latest user state from the database.
    const currentUserState = await getActiveUserById(userId);

    if (!currentUserState) {
      throw invalidTokenError();
    }

    // To check if the token version changed due to password change
    // if it did then the token is revoked.
    if (req.auth.tokenVersion !== currentUserState.token_version) {
      throw invalidTokenError();
    }

    req.user = currentUserState;

    return next();
  } catch (error) {
    return next(error);
  }
}

export default loadCurrentStateOfAuthUser;
