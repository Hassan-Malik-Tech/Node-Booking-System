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
