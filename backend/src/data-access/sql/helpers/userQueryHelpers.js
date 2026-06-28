const ALLOWED_USER_STATUSES = new Set(['active', 'deleted', 'all']);
const ALLOWED_USER_ROLES = new Set(['user', 'employee', 'admin', 'all']);

export function buildUsersWhereClause({
  role = 'all',
  search,
  status = 'active',
}) {
  const values = [];
  const conditions = [];

  if (!ALLOWED_USER_STATUSES.has(status)) {
    throw new Error('Invalid user status filter.');
  }

  if (!ALLOWED_USER_ROLES.has(role)) {
    throw new Error('Invalid user role filter.');
  }

  if (status === 'active') {
    conditions.push('deleted_at IS NULL');
  }

  if (status === 'deleted') {
    conditions.push('deleted_at IS NOT NULL');
  }

  if (role !== 'all') {
    values.push(role);
    conditions.push(`role = $${values.length}`);
  }

  if (search !== undefined) {
    values.push(`%${search}%`);
    const searchPlaceholder = `$${values.length}`;

    conditions.push(`(
      username ILIKE ${searchPlaceholder}
      OR email ILIKE ${searchPlaceholder}
      OR name ILIKE ${searchPlaceholder}
    )`);
  }

  return {
    values,
    whereClause: conditions.length > 0 ? conditions.join(' AND ') : 'TRUE',
  };
}
