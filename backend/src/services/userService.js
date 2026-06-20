import * as userQueries from '../data-access/users.js';
import AppError from '../errors/AppError.js';
import caughtError from '../errors/caughtError.js';
import ERROR_CODES from '../errors/errorCodes.js';

function mapUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
} // map one database user row into one API user object

export async function listActiveUsersService(filters) {
  const { page, pageSize, role, search, sortBy, sortDirection } = filters;

  const limit = pageSize;

  const offset = (page - 1) * limit;

  const queryFilters = {
    limit,
    offset,
    role,
    search,
    sortBy,
    sortDirection,
  };

  const users = await userQueries.listActiveUsers(queryFilters);
  const totalUsers = await userQueries.countActiveUsers(queryFilters);

  return {
    data: users.map(mapUser),
    pagination: {
      page,
      pageSize,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / pageSize), // Math.ceil(37 / 10) = 4
    },
  };
} // for GET '/api/users'

export async function getActiveUserByIdService(userId) {
  const user = await userQueries.getActiveUserById(userId);

  if (!user) {
    throw AppError.notFound('User not found', {
      code: ERROR_CODES.USER_NOT_FOUND,
    });
  }

  return {
    data: mapUser(user),
  };
} // for GET '/api/users/:userId'

export async function createUserService(userData) {
  try {
    const createdUser = await userQueries.createUser(userData);

    return {
      data: mapUser(createdUser),
    };
  } catch (error) {
    throw caughtError(error);
  }
} // for POST '/api/users'

export async function updateUserService(userData) {
  try {
    const updatedUser = await userQueries.updateUser(userData);

    if (updatedUser === undefined) {
      throw AppError.notFound('User not found', {
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    return {
      data: mapUser(updatedUser),
    };
  } catch (error) {
    throw caughtError(error);
  }
} // for PATCH '/api/users/:userId'
