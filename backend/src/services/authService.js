import * as userQueries from '../data-access/users.js';
import caughtError from '../errors/caughtError.js';
import AppError from '../errors/AppError.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { mapUser } from './helpers/commonMappers.js';
import { signAccessToken } from '../auth/authToken.js';
import config from '../config/index.js';
import ERROR_CODES from '../errors/errorCodes.js';

export async function registerUser(userData) {
  try {
    const { username, password, email, name } = userData;

    const [emailExists, usernameExists] = await Promise.all([
      userQueries.activeEmailExists(email),
      userQueries.activeUsernameExists(username),
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
      throw AppError.conflict('Registration fields are already in use.', {
        code: ERROR_CODES.REGISTRATION_CONFLICT,
        details: conflictDetails,
      });
    }

    const passwordHash = await hashPassword(password);

    // Don't put passwordHash into userData as that would mutate the original object
    // It is better to created a new object using the data from userData.
    const registeredUser = await userQueries.createUserForRegistration({
      username,
      passwordHash,
      name,
      email,
    });

    return {
      data: mapUser(registeredUser),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function loginUser(userData) {
  try {
    const { username, password } = userData;
    const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password.';

    // Checks if the username belongs to an active user, deleted users cannot login.
    const foundUser = await userQueries.getActiveUserByUsername(username);

    if (!foundUser) {
      throw AppError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordIsValid = await verifyPassword({
      password,
      passwordHash: foundUser.password_hash,
    });

    if (!passwordIsValid) {
      throw AppError.unauthorized(INVALID_CREDENTIALS_MESSAGE);
    }

    const accessToken = await signAccessToken(foundUser);

    return {
      data: {
        user: mapUser(foundUser),
        accessToken,
        tokenType: 'Bearer',
        expiresIn: config.jwt.expiresInSeconds,
      },
    };
  } catch (error) {
    throw caughtError(error);
  }
}
