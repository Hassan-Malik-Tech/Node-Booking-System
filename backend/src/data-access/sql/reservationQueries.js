import * as db from '../../db/db.js';
import { getOrderByParts } from './helpers/commonQueryHelpers.js';
import { buildReservationsWhereClause } from './helpers/reservationQueryHelpers.js';

const RESERVATION_SORT_COLUMNS = {
  startTime: 'r.start_time',
  endTime: 'r.end_time',
  createdAt: 'r.created_at',
  updatedAt: 'r.updated_at',
};

export async function listReservationsForStaff(filters) {
  const {
    limit,
    offset,
    sortBy = 'startTime',
    sortDirection = 'asc',
  } = filters;

  const { whereClause, values, resourceJoinClause } =
    buildReservationsWhereClause(filters);

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: RESERVATION_SORT_COLUMNS,
    defaultSortBy: 'startTime',
  });

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const sql = `
    SELECT
      r.id,
      r.user_id,
      r.resource_id,
      r.availability_window_id,
      r.start_time,
      r.end_time,
      r.party_size,
      r.status,
      r.staff_completed_by_user_id,
      r.system_completed_at,
      r.staff_completed_at,
      r.cancelled_at,
      r.created_at,
      r.updated_at
    FROM reservations r
    ${resourceJoinClause}
    WHERE ${whereClause}
    ORDER BY ${orderByColumn} ${direction}, r.id DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `;

  const result = await db.query(sql, values);

  return result.rows;
}

export async function countReservationsForStaff(filters) {
  const { whereClause, values, resourceJoinClause } =
    buildReservationsWhereClause(filters);

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM reservations r
    ${resourceJoinClause}
    WHERE ${whereClause}
  `;

  const result = await db.query(sql, values);

  return result.rows[0].total;
}

// for /api/me/reservations
export async function listReservationsForUser(filters) {
  return listReservationsForStaff(filters);
}

export async function countReservationsForUser(filters) {
  return countReservationsForStaff(filters);
}

// for /api/me/resources/reservations
export async function listReservationsForResourceOwner(filters) {
  return listReservationsForStaff(filters);
}

export async function countReservationsForResourceOwner(filters) {
  return countReservationsForStaff(filters);
}

export async function cancelUpcomingReservationsOverCapacity({
  resourceId,
  capacity,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE resource_id = $1
      AND status = 'active'
      AND start_time > NOW()
      AND party_size > $2
  `;

  const result = await client.query(sql, [resourceId, capacity]);

  // rowCount counts the number of rows the update affected
  // even without a RETURNING anything.
  return result.rowCount;
}

export async function cancelUpcomingReservationsByResourceId({
  resourceId,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE resource_id = $1
      AND status = 'active'
      AND start_time > NOW()
  `;

  const result = await client.query(sql, [resourceId]);

  return result.rowCount;
}

export async function cancelUpcomingReservationsByResourceIds({
  resourceIds,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE resource_id = ANY($1::int[])
      AND status = 'active'
      AND start_time > NOW()
  `;

  const result = await client.query(sql, [resourceIds]);

  return result.rowCount;
}

export async function cancelUpcomingReservationsByUserId({
  userId,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE user_id = $1
      AND status = 'active'
      AND start_time > NOW()
  `;

  const result = await client.query(sql, [userId]);

  return result.rowCount;
}

export async function cancelUpcomingReservationsOutsideAvailabilityWindow({
  windowId,
  newStartTime,
  newEndTime,
  client = db,
}) {
  const values = [windowId];
  const conditions = [];

  // To cancel any reservations that have a start time
  // that is less than the new start time for the updated window.
  if (newStartTime !== undefined) {
    values.push(newStartTime);
    conditions.push(`start_time < $${values.length}`);
  }

  // To cancel any reservations that have an end time
  // that is greater than the new end time for the updated window.
  if (newEndTime !== undefined) {
    values.push(newEndTime);
    conditions.push(`end_time > $${values.length}`);
  }

  // This is a guard, this should never be returned
  // as this function would only be called after
  // verifying that the window updated includes
  // startTime or endTime.
  if (conditions.length === 0) {
    return 0;
  }

  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE availability_window_id = $1
      AND status = 'active'
      AND start_time > NOW()
      AND (${conditions.join(' OR ')})
  `;

  const result = await client.query(sql, values);

  return result.rowCount;
}

export async function cancelUpcomingReservationsByAvailabilityWindowId({
  windowId,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE availability_window_id = $1
      AND status = 'active'
      AND start_time > NOW()
  `;

  const result = await client.query(sql, [windowId]);

  return result.rowCount;
}

export async function createReservation({
  userId,
  reservationData,
  client = db,
}) {
  const { resourceId, availabilityWindowId, startTime, endTime, partySize } =
    reservationData;

  const sql = `
    INSERT INTO reservations (
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'active')
    RETURNING
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
  `;

  const result = await client.query(sql, [
    userId,
    resourceId,
    availabilityWindowId,
    startTime,
    endTime,
    partySize,
  ]);

  return result.rows[0];
}

export async function cancelReservationById({
  reservationId,
  futureOnly = false,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE id = $1
      AND status = 'active'
      ${futureOnly ? 'AND start_time > NOW()' : ''}
    RETURNING 
      id,
      status,
      cancelled_at
  `;

  const result = await client.query(sql, [reservationId]);

  return result.rows[0] ?? null;
}

export async function getFutureActiveReservationsByWindowId({
  windowId,
  forUpdate = false,
  client = db,
}) {
  const sql = `
    SELECT
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
    FROM reservations
    WHERE availability_window_id = $1
      AND status = 'active'
      AND start_time > NOW()
    ${forUpdate ? 'FOR UPDATE' : ''}
  `;

  const result = await client.query(sql, [windowId]);

  return result.rows;
}

// This retry check is useful for reservations because an overlap conflict
// could mean either this user already booked the exact reservation or another
// user's reservation is blocking the slot. For resources/windows, duplicate
// conflicts are less ambiguous because those rows belong to the current owner,
// not to another user competing for the same slot.
export async function getReservationAlreadyBookedByUser({
  authUserId,
  reservationData,
  client = db,
}) {
  const { resourceId, availabilityWindowId, startTime, endTime, partySize } =
    reservationData;

  const sql = `
    SELECT
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
    FROM reservations
    WHERE user_id = $1
      AND resource_id = $2
      AND availability_window_id = $3
      AND start_time = $4
      AND end_time = $5
      AND party_size = $6
      AND status = 'active'
  `;

  const result = await client.query(sql, [
    authUserId,
    resourceId,
    availabilityWindowId,
    startTime,
    endTime,
    partySize,
  ]);

  return result.rows[0] ?? null;
}

export async function getReservationById({
  reservationId,
  futureAndCurrentActive = false,
  futureActiveOnly = false,
  forUpdate = false,
  client = db,
}) {
  if (futureActiveOnly && futureAndCurrentActive) {
    throw new Error(
      'You cannot filter by both futureActiveOnly and futureAndCurrentActive at the same time.',
    );
  }

  const sql = `
    SELECT
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
    FROM reservations
    WHERE id = $1
    ${futureAndCurrentActive ? "AND status = 'active' AND end_time > NOW() " : ''}
    ${futureActiveOnly ? "AND status = 'active' AND start_time > NOW() " : ''}
    ${forUpdate ? 'FOR UPDATE' : ''}
  `;

  const result = await client.query(sql, [reservationId]);

  return result.rows[0] ?? null;
}

export async function completeOngoingOrExpiredReservationByStaff({
  reservationId,
  staffUserId,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET status = 'completed',
      staff_completed_at = NOW(),
      staff_completed_by_user_id = $1
    WHERE id = $2
      AND status = 'active'
      AND start_time <= NOW()
    RETURNING
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
  `;

  const result = await client.query(sql, [staffUserId, reservationId]);

  return result.rows[0] ?? null;
}

export async function updateFutureReservationPartySize({
  reservationId,
  authUserId,
  partySize,
  client = db,
}) {
  const sql = `
    UPDATE reservations
    SET party_size = $1
    WHERE id = $2
      AND user_id = $3
      AND status = 'active'
      AND start_time > NOW()
    RETURNING
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
  `;

  const result = await client.query(sql, [
    partySize,
    reservationId,
    authUserId,
  ]);

  return result.rows[0] ?? null;
}

export async function getFutureAndOngoingReservationsByUserId({
  userId,
  client = db,
}) {
  const sql = `
    SELECT
      r.id,
      r.user_id,
      r.resource_id,
      r.availability_window_id,
      r.start_time,
      r.end_time,
      r.party_size,
      r.status,
      r.staff_completed_by_user_id,
      r.system_completed_at,
      r.staff_completed_at,
      r.cancelled_at,
      r.created_at,
      r.updated_at,
      aw.cancellation_notice_minutes AS availability_window_cancellation_notice_minutes,
      res.owner_id AS resource_owner_id
    FROM reservations r
    JOIN availability_windows aw ON aw.id = r.availability_window_id
    JOIN resources res ON res.id = r.resource_id
    WHERE r.user_id = $1
      AND r.end_time > NOW()
      AND r.status = 'active'
  `;

  const result = await client.query(sql, [userId]);

  return result.rows;
}

export async function getOngoingReservationsByUserId({ userId, client = db }) {
  const sql = `
    SELECT
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
    FROM reservations
    WHERE user_id = $1
      AND start_time <= NOW()
      AND end_time > NOW()
      AND status = 'active'
  `;

  const result = await client.query(sql, [userId]);

  return result.rows;
}

export async function getReservationByUserIdAndReservationId({
  userId,
  reservationId,
}) {
  const sql = `
    SELECT
      id,
      user_id,
      resource_id,
      availability_window_id,
      start_time,
      end_time,
      party_size,
      status,
      staff_completed_by_user_id,
      system_completed_at,
      staff_completed_at,
      cancelled_at,
      created_at,
      updated_at
    FROM reservations
    WHERE user_id = $1
      AND id = $2
  `;

  const result = await db.query(sql, [userId, reservationId]);

  return result.rows[0] ?? null;
}
