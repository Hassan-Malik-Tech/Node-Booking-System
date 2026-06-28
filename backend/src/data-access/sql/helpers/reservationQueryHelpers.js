// To avoid over complication things, timing
// should only apply if the status is active.
// Send a validation error to the staff client
// if the combo is bad.
const ALLOWED_RESERVATION_STATUSES = new Set([
  'active',
  'completed',
  'cancelled',
  'all',
]);

const ALLOWED_RESERVATION_TIMINGS = new Set([
  'upcoming',
  'ongoing',
  'ongoingAndUpcoming',
  'past',
  'all',
]);

export function buildReservationsWhereClause(filters) {
  const {
    resourceId,
    resourceOwnerId,
    reservationUserId,
    availabilityWindowId,
    search,
    status = 'active',
    timing,
  } = filters;

  // Default for timing if status is active is ongoingAndUpcoming.
  // This is better than destructuring with a timing default
  // because if status changes and timing does not,
  // then the timing default would be invalid.
  const finalTiming =
    timing ?? (status === 'active' ? 'ongoingAndUpcoming' : 'all');

  if (!ALLOWED_RESERVATION_TIMINGS.has(finalTiming)) {
    throw new Error('Invalid reservation timing filter.');
  }

  if (!ALLOWED_RESERVATION_STATUSES.has(status)) {
    throw new Error('Invalid reservation status filter.');
  }

  if (
    status !== 'active' &&
    finalTiming !== undefined &&
    finalTiming !== 'all'
  ) {
    throw new Error(
      'Timing can only be filtered when reservation status is active.',
    );
  }

  const values = [];
  const conditions = [];
  let resourceJoinClause = '';

  if (resourceOwnerId !== undefined || search !== undefined) {
    resourceJoinClause = 'JOIN resources res ON res.id = r.resource_id';
  }

  if (status !== 'all') {
    values.push(status);
    conditions.push(`r.status = $${values.length}`);
  }

  if (status === 'active') {
    if (finalTiming === 'upcoming') {
      conditions.push('r.start_time > NOW()');
    }

    if (finalTiming === 'ongoing') {
      conditions.push('r.start_time <= NOW()', 'r.end_time > NOW()');
    }

    if (finalTiming === 'ongoingAndUpcoming') {
      conditions.push('r.end_time > NOW()');
    }

    if (finalTiming === 'past') {
      conditions.push('r.end_time <= NOW()');
    }
  }

  if (resourceId !== undefined) {
    values.push(resourceId);
    conditions.push(`r.resource_id = $${values.length}`);
  }

  if (reservationUserId !== undefined) {
    values.push(reservationUserId);
    conditions.push(`r.user_id = $${values.length}`);
  }

  if (availabilityWindowId !== undefined) {
    values.push(availabilityWindowId);
    conditions.push(`r.availability_window_id = $${values.length}`);
  }

  if (resourceOwnerId !== undefined) {
    values.push(resourceOwnerId);
    conditions.push(`res.owner_id = $${values.length}`);
  }

  if (search !== undefined) {
    values.push(`%${search}%`);
    const searchPlaceholder = `$${values.length}`;

    conditions.push(`res.name ILIKE ${searchPlaceholder}`);
  }

  return {
    whereClause: conditions.length > 0 ? conditions.join(' AND ') : 'TRUE',
    values,
    resourceJoinClause,
  };
}
