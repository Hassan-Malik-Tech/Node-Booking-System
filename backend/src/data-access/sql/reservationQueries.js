import * as db from '../../db/db.js';

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

export async function cancelReservationById({ reservationId, client = db }) {
  const sql = `
    UPDATE reservations
    SET status = 'cancelled',
      cancelled_at = NOW()
    WHERE id = $1
      AND status = 'active'
    RETURNING id
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
