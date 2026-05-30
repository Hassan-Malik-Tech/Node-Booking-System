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
