import * as db from '../../db/db.js';
import { buildUsersWhereClause } from './helpers/userQueryHelpers.js';
import { getOrderByParts } from './helpers/commonQueryHelpers.js';
import { buildSetClause } from './helpers/commonQueryHelpers.js';

const USER_SORT_COLUMNS = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  username: 'username',
  email: 'email',
  role: 'role',
};

export async function listUsersForStaff(filters) {
  const {
    limit,
    offset,
    sortBy = 'createdAt',
    sortDirection = 'desc',
    status = 'active',
    role = 'all',
    search,
  } = filters;

  const { values, whereClause } = buildUsersWhereClause({
    role,
    search,
    status,
  });

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: USER_SORT_COLUMNS,
  });

  // If someone wants to sort by deletedAt then they probably dont want
  // to see deletedAt: null at the top as they would want to see deleted
  // users not active.
  const nullsLast =
    sortBy === 'deletedAt' && status === 'all' ? 'NULLS LAST' : '';

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const sql = `
    SELECT
      id,
      username,
      name,
      email,
      role,
      created_at,
      updated_at,
      deleted_at
    FROM users
    WHERE ${whereClause}
    ORDER BY ${orderByColumn} ${direction} ${nullsLast}, id DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `;

  const result = await db.query(sql, values);

  return result.rows;
}

export async function countUsersForStaff(filters) {
  const { role = 'all', search, status = 'active' } = filters;

  const { values, whereClause } = buildUsersWhereClause({
    role,
    search,
    status,
  });

  const sql = `
    SELECT
      COUNT(*)::int AS total
    FROM users
    WHERE ${whereClause}
  `;

  const result = await db.query(sql, values);

  return result.rows[0].total;
}

export async function createUser(userData) {
  const { username, passwordHash, name = null, email } = userData;

  const sql = `
    INSERT INTO users (username, password_hash, name, email, role)
    VALUES ($1, $2, $3, $4, 'user')
    RETURNING
      id,
      username,
      name,
      email,
      role,
      token_version,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await db.query(sql, [username, passwordHash, name, email]);

  return result.rows[0];
}

export async function createUserAsAdmin({ userData, client = db }) {
  const { username, passwordHash, name = null, email, role } = userData;

  if (role === 'admin') {
    throw new Error('createUserAsAdmin cannot create admin users.');
  }

  const sql = `
    INSERT INTO users (username, password_hash, name, email, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      username,
      name,
      email,
      role,
      token_version,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await client.query(sql, [
    username,
    passwordHash,
    name,
    email,
    role,
  ]);

  return result.rows[0];
}

export async function activeUsernameExists(username, { client = db } = {}) {
  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM users
      WHERE lower(username) = lower($1)
        AND deleted_at IS NULL
    ) AS exists
  `;

  const result = await client.query(sql, [username]);

  return result.rows[0].exists; // returns a boolean
}

export async function activeEmailExists(email, { client = db } = {}) {
  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM users
      WHERE lower(email) = lower($1)
        AND deleted_at IS NULL
    ) AS exists
  `;

  const result = await client.query(sql, [email]);

  return result.rows[0].exists;
}

export async function getActiveUserByUsername(username) {
  const sql = `
    SELECT
      id,
      username,
      password_hash,
      name,
      email,
      role,
      token_version,
      created_at,
      updated_at
    FROM users
    WHERE lower(username) = lower($1)
      AND deleted_at IS NULL
  `;

  const result = await db.query(sql, [username]);

  return result.rows[0] ?? null;
}

export async function getActiveUserByEmail({ email }) {
  const sql = `
    SELECT
      id,
      username,
      password_hash,
      name,
      email,
      role,
      token_version,
      created_at,
      updated_at
    FROM users
    WHERE lower(email) = lower($1)
      AND deleted_at IS NULL
  `;

  const result = await db.query(sql, [email]);

  return result.rows[0] ?? null;
}

export async function getActiveUserById(userId, { client = db } = {}) {
  const sql = `
     SELECT
      id,
      username,
      name,
      email,
      role,
      token_version,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
      AND deleted_at IS NULL
  `;

  const result = await client.query(sql, [userId]);

  return result.rows[0] ?? null;
}

export async function lockUser({ userId, client = db }) {
  const sql = `
    SELECT
      id,
      role,
      username,
      email
    FROM users
    WHERE id = $1
      AND deleted_at IS NULL
    FOR UPDATE
  `;

  const result = await client.query(sql, [userId]);

  return result.rows[0] ?? null;
}

export async function updateActiveUserById({
  userId,
  updateData,
  isAdminManagedUpdate = false,
  client = db,
}) {
  const { username, email, name } = updateData;

  const buildSetClauseParams = isAdminManagedUpdate
    ? { username, name }
    : { username, email, name };

  const { values, setClause } = buildSetClause(buildSetClauseParams);

  // joi should validate the body, just an extra query guard.
  // This may be useful if the function is called outside of the service.
  if (setClause.length === 0) {
    return null;
  }

  values.push(userId);
  const idPlaceholder = `$${values.length}`;

  const sql = `
    UPDATE users
    SET ${setClause}
    WHERE id = ${idPlaceholder}
      AND deleted_at IS NULL
      ${isAdminManagedUpdate ? "AND role <> 'admin'" : ''}
    RETURNING
      id,
      username,
      name,
      email,
      role,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await client.query(sql, values);

  return result.rows[0] ?? null;
}

// Return just enough to know that the password update was successful (the id).
// Update token_version to revoke token after updating the password.
// The token version in the current user is compared with the one in the old token (which has the old token_version)
// if they are different, it throws invalidTokenError.
export async function updatePassword({ userId, passwordHash }) {
  const sql = `
    UPDATE users
    SET password_hash = $1,
      token_version = token_version + 1
    WHERE id = $2
      AND deleted_at IS NULL
    RETURNING id
  `;

  const result = await db.query(sql, [passwordHash, userId]);

  return result.rows[0] ?? null;
}

export async function softDeleteUserById({ userId, client = db }) {
  const sql = `
    UPDATE users
    SET deleted_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING
      id,
      username,
      name,
      email,
      role,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await client.query(sql, [userId]);

  return result.rows[0] ?? null;
}

export async function getUserById({ userId, client = db }) {
  const sql = `
    SELECT
      id,
      username,
      name,
      email,
      role,
      created_at,
      updated_at,
      deleted_at
    FROM users
    WHERE id = $1
  `;

  const result = await client.query(sql, [userId]);

  return result.rows[0] ?? null;
}

export async function lockUserIncludingDeleted({ userId, client = db }) {
  const sql = `
    SELECT
      id,
      username,
      name,
      email,
      role,
      created_at,
      updated_at,
      deleted_at
    FROM users
    WHERE id = $1
    FOR UPDATE
  `;

  const result = await client.query(sql, [userId]);

  return result.rows[0] ?? null;
}

export async function updateNonAdminUserRole({ userId, newRole, client = db }) {
  if (newRole === 'admin') {
    throw new Error('updateNonAdminUserRole cannot set role to admin.');
  }

  const sql = `
    UPDATE users
    SET role = $1
    WHERE id = $2
      AND deleted_at IS NULL
      AND role <> 'admin'
    RETURNING
      id,
      username,
      name,
      email,
      role,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await client.query(sql, [newRole, userId]);

  return result.rows[0] ?? null;
}
