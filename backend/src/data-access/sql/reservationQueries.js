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
