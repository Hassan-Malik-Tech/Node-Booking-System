const ALLOWED_RESOURCES_STATUS = new Set([
  'active',
  'inactive',
  'deleted',
  'all',
]);

export function buildResourcesForManagementWhereClause({
  status = 'active',
  search,
  ownerId,
}) {
  const values = [];
  const conditions = [];

  if (!ALLOWED_RESOURCES_STATUS.has(status)) {
    throw new Error('Invalid resources status filter.');
  }

  if (status === 'active') {
    conditions.push('deleted_at IS NULL', 'is_active = TRUE');
  }

  if (status === 'inactive') {
    conditions.push('deleted_at IS NULL', 'is_active = FALSE');
  }

  if (status === 'deleted') {
    conditions.push('deleted_at IS NOT NULL', 'is_active = FALSE');
  }

  if (search !== undefined) {
    values.push(`%${search}%`);
    const searchPlaceholder = `$${values.length}`;

    conditions.push(`
      (
        name ILIKE ${searchPlaceholder}
        OR description ILIKE ${searchPlaceholder}
      )
    `);
  }

  if (ownerId !== undefined) {
    values.push(ownerId);
    conditions.push(`owner_id = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? conditions.join(' AND ') : 'TRUE';

  return {
    whereClause,
    values,
  };
}

export function buildActiveResourcesWhereClause(search) {
  const values = [];
  const conditions = ['deleted_at IS NULL', 'is_active = TRUE'];

  if (search !== undefined) {
    values.push(`%${search}%`);

    const searchPlaceholder = `$${values.length}`;
    conditions.push(`
      (
        name ILIKE ${searchPlaceholder}
        OR description ILIKE ${searchPlaceholder}
      )
    `);
  }

  const whereClause = conditions.join(' AND ');

  return { values, whereClause };
}
