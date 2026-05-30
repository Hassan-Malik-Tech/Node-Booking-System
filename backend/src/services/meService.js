import * as userQueries from '../data-access/users.js';
import caughtError from '../errors/caughtError.js';
import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import { mapUser } from './helpers/commonMappers.js';
import { hashPassword } from '../auth/password.js';
import { invalidTokenError } from '../errors/commonErrors.js';

export function getProfile(user) {
  return {
    data: mapUser(user),
  };
}

export async function updateProfile({
  userId,
  updateData,
  currentUsername,
  currentEmail,
}) {
  try {
    const { username, email } = updateData;
    const conflictDetails = [];

    // If the email exists in the request body,
    // it checks to see if the email is already taken
    // not counting the users current email.
    if (
      email !== undefined &&
      email.toLowerCase() !== currentEmail.toLowerCase()
    ) {
      const emailExists = await userQueries.activeEmailExists(email);

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
      username !== undefined &&
      username.toLowerCase() !== currentUsername.toLowerCase()
    ) {
      const usernameExists = await userQueries.activeUsernameExists(username);

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
      userId,
      updateData,
    });

    // If updateActiveUserById returns null it probably means
    // that the user was deleted by an admin in the process of the function running
    // so this is here to account for that.
    if (!updatedUser) {
      throw invalidTokenError();
    }

    return {
      data: mapUser(updatedUser),
    };
  } catch (error) {
    // Keep PG error translation even after prechecks.
    // Another request can claim the same username/email before this UPDATE runs.
    // Race condition
    throw caughtError(error);
  }
}

export async function updatePassword({ userId, newPassword }) {
  try {
    const passwordHash = await hashPassword(newPassword);

    const updatedPassword = await userQueries.updatePassword({
      userId,
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
