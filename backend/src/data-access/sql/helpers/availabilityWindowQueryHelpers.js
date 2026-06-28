const ALLOWED_WINDOWS_STATUS = new Set(['active', 'expired', 'deleted', 'all']);

export function buildAvailabilityWindowsWhereClause({
  status = 'active',
  resourceId,
  ownerId,
}) {
  const values = [];
  const conditions = [];
  let ownerIdJoinClause = '';

  if (!ALLOWED_WINDOWS_STATUS.has(status)) {
    throw new Error('Invalid availability windows status filter.');
  }

  if (status === 'active') {
    conditions.push('aw.deleted_at IS NULL', 'aw.end_time > NOW()');
  }

  if (status === 'expired') {
    conditions.push('aw.deleted_at IS NULL', 'aw.end_time <= NOW()');
  }

  if (status === 'deleted') {
    conditions.push('aw.deleted_at IS NOT NULL');
  }

  if (resourceId !== undefined) {
    values.push(resourceId);
    conditions.push(`aw.resource_id = $${values.length}`);
  }

  if (ownerId !== undefined) {
    ownerIdJoinClause = 'JOIN resources r ON r.id = aw.resource_id';
    values.push(ownerId);
    conditions.push(`r.owner_id = $${values.length}`);
  }

  return {
    whereClause: conditions.length > 0 ? conditions.join(' AND ') : 'TRUE',
    ownerIdJoinClause,
    values,
  };
}
