import * as db from '../../db/db.js';
import { buildActiveUsersWhereClause } from './helpers/userQueryHelpers.js';
import { getOrderByParts } from './helpers/commonQueryHelpers.js';
import { buildSetClause } from './helpers/commonQueryHelpers.js';

const USER_SORT_COLUMNS = {
  createdAt: 'created_at',
  username: 'username',
  email: 'email',
  role: 'role',
}; // enum style allow list for sortBy API to SQL conversion

export async function listActiveUsers(filters) {
  const { limit, offset, role, search, sortBy, sortDirection } = filters;
  // destructures the validated/defaulted filter object
  // for this length, I prefer destructuring it outside of the parameters

  const { values, whereClause } = buildActiveUsersWhereClause({ role, search });

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: USER_SORT_COLUMNS,
  });

  values.push(limit); // limit(pageSize) and offset are either client values or defaults from validation
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
      updated_at
    FROM users
    WHERE ${whereClause}
    ORDER BY ${orderByColumn} ${direction}, id DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `;

  const result = await db.query(sql, values);

  return result.rows;
} // for  GET '/api/users'

// ex or GET request:
// GET /api/users?page=1&pageSize=10&role=user&search=ali&sortBy=createdAt&sortDirection=desc

export async function countActiveUsers(filters) {
  const { role, search } = filters;
  // just to make it consistent,
  // it could easily go in the parameters instead

  const { values, whereClause } = buildActiveUsersWhereClause({ role, search });

  const sql = `
    SELECT
      COUNT(*)::int AS total
    FROM users
    WHERE ${whereClause}
  `;
  // COUNT(*) returns bigint which can possibly go higher than the js max number storage,
  // so without ::int the total may come back as a string instead of a number.

  // :: is the cast operator, ::int converts COUNT(*) into int
  // it is short for CAST(COUNT(*) AS int)

  const result = await db.query(sql, values);

  return result.rows[0].total;
} // this function is for pagination info for '/api/users'

// returns token_version because my test functions use this
// to create new users and sign them, signing requires token_version.
export async function createUserForRegistration(userData) {
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
      updated_at
  `;

  const result = await db.query(sql, [username, passwordHash, name, email]);

  return result.rows[0];
}

export async function activeUsernameExists(username) {
  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM users
      WHERE lower(username) = lower($1)
        AND deleted_at IS NULL
    ) AS exists
  `;

  const result = await db.query(sql, [username]);

  return result.rows[0].exists; // returns a boolean
}

export async function activeEmailExists(email) {
  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM users
      WHERE lower(email) = lower($1)
        AND deleted_at IS NULL
    ) AS exists
  `;

  const result = await db.query(sql, [email]);

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

export async function getActiveUserById(userId) {
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

  const result = await db.query(sql, [userId]);

  return result.rows[0] ?? null;
}

export async function lockUser({ userId, client = db }) {
  const sql = `
    SELECT
      id,
      role
    FROM users
    WHERE id = $1
      AND deleted_at IS NULL
    FOR UPDATE
  `;

  const result = await client.query(sql, [userId]);

  return result.rows[0] ?? null;
}

export async function updateActiveUserById({ userId, updateData }) {
  const { username, name, email } = updateData;

  const { values, setClause } = buildSetClause({ username, name, email });

  // joi should validate the body, just an extra query gaurd.
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
    RETURNING
      id,
      username,
      name,
      email,
      role,
      created_at,
      updated_at
  `;

  const result = await db.query(sql, values);

  // deleted_at IS NULL may match no rows, so use ?? null for that situation.
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
