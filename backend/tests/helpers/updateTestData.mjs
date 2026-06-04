import * as db from '../../src/db/db.js';

export async function softDeleteTestUser(userId) {
  const result = await db.query(
    `
      UPDATE users
      SET deleted_at = NOW()
      WHERE id = $1
      RETURNING deleted_at
    `,
    [userId],
  );

  return result.rows[0];
}

export async function updateTestUserRole({ userId, role }) {
  const result = await db.query(
    `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING role
    `,
    [role, userId],
  );

  return result.rows[0];
}

export async function softDeleteTestResource(resourceId) {
  const result = await db.query(
    `
      UPDATE resources
      SET deleted_at = NOW(),
        is_active = false
      WHERE id = $1
      RETURNING deleted_at
    `,
    [resourceId],
  );

  return result.rows[0];
}

export async function deactivateTestResource(resourceId) {
  const result = await db.query(
    `
      UPDATE resources
      SET is_active = false
      WHERE id = $1
      RETURNING is_active
    `,
    [resourceId],
  );

  return result.rows[0];
}
