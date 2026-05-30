import { getActiveUserById } from '../data-access/users.js';
import { invalidTokenError } from '../errors/commonErrors.js';

async function loadCurrentStateOfAuthUser(req, res, next) {
  try {
    const userId = req.auth.userId;
    // Check to see if the token user is still active,
    // and to get the latest role (if it changed) since aquring the token initially.
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

    req.auth = {
      userId,
      role: currentUserState.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export default loadCurrentStateOfAuthUser;
