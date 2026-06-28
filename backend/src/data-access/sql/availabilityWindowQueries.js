import * as db from '../../db/db.js';
import {
  getOrderByParts,
  buildSetClause,
} from './helpers/commonQueryHelpers.js';
import { buildAvailabilityWindowsWhereClause } from './helpers/availabilityWindowQueryHelpers.js';

const WINDOW_SORT_COLUMNS = {
  startTime: 'aw.start_time',
  createdAt: 'aw.created_at',
};

export async function listActiveWindowsByResourceId({ resourceId, filters }) {
  const { limit, offset, sortBy, sortDirection } = filters;

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: WINDOW_SORT_COLUMNS,
  });

  // Active availability windows should always have at least one allowed duration.
  // The LEFT JOIN and COALESCE are defensive guards in case a bad DB row
  // somehow exists with zero durations. This keeps the response shape stable
  // and prevents active windows from not appearing in the list.
  const sql = `
    SELECT
      aw.id,
      aw.resource_id,
      aw.start_time,
      aw.end_time,
      aw.cancellation_notice_minutes,
      aw.created_at,
      aw.updated_at,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ad.id,
            'minutes', ad.duration_minutes
          )
          ORDER BY ad.duration_minutes ASC
        ) FILTER (WHERE ad.id IS NOT NULL),
        '[]'
    ) AS allowed_durations
    FROM availability_windows aw
    LEFT JOIN availability_window_allowed_durations ad
      ON aw.id = ad.availability_window_id 
    WHERE aw.resource_id = $1
      AND aw.deleted_at IS NULL
      AND aw.end_time > NOW()
    GROUP BY aw.id
    ORDER BY ${orderByColumn} ${direction}, aw.id DESC
    LIMIT $2
    OFFSET $3
  `;

  const result = await db.query(sql, [resourceId, limit, offset]);

  return result.rows;
}

export async function countActiveAvailabilityWindowsByResourceId(resourceId) {
  const sql = `
    SELECT COUNT(*)::int AS total
    FROM availability_windows 
    WHERE resource_id = $1
      AND deleted_at IS NULL
      AND end_time > NOW()
  `;

  const result = await db.query(sql, [resourceId]);

  return result.rows[0].total;
}

export async function getActiveAvailabilityWindowByResourceIdAndWindowId({
  resourceId,
  windowId,
  forUpdate = false,
  client = db,
}) {
  if (forUpdate === true) {
    await client.query(
      `
        SELECT id
        FROM availability_windows
        WHERE resource_id = $1
          AND id = $2
          AND deleted_at IS NULL
          AND end_time > NOW()
        FOR UPDATE
      `,
      [resourceId, windowId],
    );
  }

  const sql = `
    SELECT
      aw.id,
      aw.resource_id,
      aw.start_time,
      aw.end_time,
      aw.cancellation_notice_minutes,
      aw.created_at,
      aw.updated_at,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ad.id,
            'minutes', ad.duration_minutes
          )
          ORDER BY ad.duration_minutes ASC
        ) FILTER (WHERE ad.id IS NOT NULL),
        '[]'
      ) AS allowed_durations
    FROM availability_windows aw
    LEFT JOIN availability_window_allowed_durations ad
      ON aw.id = ad.availability_window_id 
    WHERE aw.resource_id = $1
      AND aw.id = $2
      AND aw.deleted_at IS NULL
      AND aw.end_time > NOW()
    GROUP BY aw.id
  `;

  const result = await client.query(sql, [resourceId, windowId]);

  return result.rows[0] ?? null;
}

export async function getDurationsByWindowId(windowId) {
  const sql = `
    SELECT duration_minutes
    FROM availability_window_allowed_durations
    WHERE availability_window_id = $1
    ORDER BY duration_minutes ASC
  `;

  const result = await db.query(sql, [windowId]);

  return result.rows.map((row) => row.duration_minutes);
}

// For admin/employee list endpoints, broader filters/sorts are useful.
// They may need audit/history/debug.
const AVAILABILITY_WINDOW_SORT_COLUMNS = {
  startTime: 'aw.start_time',
  endTime: 'aw.end_time',
  createdAt: 'aw.created_at',
  updatedAt: 'aw.updated_at',
  deletedAt: 'aw.deleted_at',
};

// For staff only route.
export async function listAvailabilityWindows(filters) {
  const {
    limit,
    offset,
    sortBy,
    sortDirection,
    status = 'active',
    resourceId,
    ownerId,
  } = filters;

  const { whereClause, ownerIdJoinClause, values } =
    buildAvailabilityWindowsWhereClause({ status, resourceId, ownerId });

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: AVAILABILITY_WINDOW_SORT_COLUMNS,
    defaultSortBy: 'startTime',
  });

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  // GROUP BY aw.id means: group all joined rows that belong to the same availability window.

  // With a LEFT JOIN, a window with no durations gets one joined row where ad.* is null.
  // Without FILTER, JSON_AGG would aggregate that row as { id: null, minutes: null }.
  // FILTER prevents JSON_AGG from aggregating that fake null duration row.
  // So JSON_AGG returns null for that window(that has no durations like a deleted window), and COALESCE converts that null into [].
  const sql = `
    SELECT
      aw.id,
      aw.resource_id,
      aw.start_time,
      aw.end_time,
      aw.cancellation_notice_minutes,
      aw.created_at,
      aw.updated_at,
      aw.deleted_at,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ad.id,
            'minutes', ad.duration_minutes
          )
          ORDER BY ad.duration_minutes ASC
        ) FILTER (WHERE ad.id IS NOT NULL),
        '[]'
      ) AS allowed_durations
    FROM availability_windows aw
    LEFT JOIN availability_window_allowed_durations ad
      ON aw.id = ad.availability_window_id
    ${ownerIdJoinClause}
    WHERE ${whereClause}
    GROUP BY aw.id
    ORDER BY ${orderByColumn} ${direction}, aw.id DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `;

  const result = await db.query(sql, values);

  return result.rows;
}

export async function countAvailabilityWindows(filters) {
  const { status = 'active', resourceId, ownerId } = filters;

  const { whereClause, ownerIdJoinClause, values } =
    buildAvailabilityWindowsWhereClause({ status, resourceId, ownerId });

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM availability_windows aw
    ${ownerIdJoinClause}
    WHERE ${whereClause}
  `;

  const result = await db.query(sql, values);

  return result.rows[0].total;
}

export async function createAvailabilityWindow({ windowData, client = db }) {
  const { resourceId, startTime, endTime, cancellationNoticeMinutes } =
    windowData;

  const sql = `
    INSERT INTO availability_windows (
      resource_id,
      start_time,
      end_time,
      cancellation_notice_minutes
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      resource_id,
      start_time,
      end_time,
      cancellation_notice_minutes,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await client.query(sql, [
    resourceId,
    startTime,
    endTime,
    cancellationNoticeMinutes,
  ]);

  return result.rows[0];
}

export async function softDeleteAvailabilityWindowById({
  windowId,
  client = db,
}) {
  const windowSql = `
    UPDATE availability_windows
    SET deleted_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
      AND end_time > NOW()
    RETURNING deleted_at
  `;

  const result = await client.query(windowSql, [windowId]);

  // So that durationsSql does not run when the window
  // does not exist.
  if (result.rowCount === 0) {
    return null;
  }

  const durationsSql = `
    DELETE FROM availability_window_allowed_durations
    WHERE availability_window_id = $1
  `;

  await client.query(durationsSql, [windowId]);

  // Dont need to return null here as zero row handling was done above.
  return result.rows[0];
}

// end_time > NOW() targets current and future windows
// it leaves alone expiered windows.
export async function softDeleteAvailabilityWindowsByResourceId({
  resourceId,
  client = db,
}) {
  const windowSql = `
    UPDATE availability_windows
    SET deleted_at = NOW()
    WHERE resource_id = $1
      AND deleted_at IS NULL
      AND end_time > NOW()
    RETURNING id
  `;

  const windowResult = await client.query(windowSql, [resourceId]);

  const deletedWindowIds = windowResult.rows.map((row) => row.id);

  // WHERE availability_window_id = ANY($1::int[])
  // means:
  // WHERE availability_window_id is equal to any integer inside this array
  if (deletedWindowIds.length > 0) {
    const durationsSql = `
      DELETE FROM availability_window_allowed_durations
      WHERE availability_window_id = ANY($1::int[])
    `;

    await client.query(durationsSql, [deletedWindowIds]);
  }

  return deletedWindowIds.length;
}

export async function softDeleteAvailabilityWindowsByResourceOwnerId({
  ownerId,
  client = db,
}) {
  // Postgres supports joins in UPDATE through FROM.
  const windowsSql = `
    UPDATE availability_windows aw
    SET deleted_at = NOW()
    FROM resources r
    WHERE aw.resource_id = r.id
      AND r.owner_id = $1
      AND aw.deleted_at IS NULL
    RETURNING aw.id
  `;

  const windowsResult = await client.query(windowsSql, [ownerId]);

  const deletedWindowIds = windowsResult.rows.map((row) => row.id);

  if (deletedWindowIds.length > 0) {
    const durationsSql = `
      DELETE FROM availability_window_allowed_durations
      WHERE availability_window_id = ANY($1::int[])
    `;

    await client.query(durationsSql, [deletedWindowIds]);
  }

  return deletedWindowIds.length;
}

export async function getAvailabilityWindowById({
  windowId,
  includeDeleted = false,
  forPublic = false,
  forUpdate = false,
  client = db,
}) {
  if (forPublic && includeDeleted) {
    throw new Error(
      'You cannot filter by both forPublic and includeDeleted at the same time.',
    );
  }

  if (forUpdate === true) {
    await client.query(
      `
    SELECT id
    FROM availability_windows
    WHERE id = $1
    ${forPublic ? 'AND end_time > NOW() AND deleted_at IS NULL' : ''}
    ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
    FOR UPDATE
  `,
      [windowId],
    );
  }

  const sql = `
     SELECT
       aw.id,
       aw.resource_id,
       aw.start_time,
       aw.end_time,
       aw.cancellation_notice_minutes,
       aw.created_at,
       aw.updated_at,
       aw.deleted_at,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'id', ad.id,
             'minutes', ad.duration_minutes
           )
           ORDER BY ad.duration_minutes ASC
         ) FILTER (WHERE ad.id IS NOT NULL),
         '[]'
       ) AS allowed_durations
    FROM availability_windows aw
    LEFT JOIN availability_window_allowed_durations ad
      ON aw.id = ad.availability_window_id
    WHERE aw.id = $1
    ${forPublic ? 'AND end_time > NOW() AND deleted_at IS NULL' : ''}
    ${includeDeleted ? '' : 'AND aw.deleted_at IS NULL'}
    GROUP BY aw.id
  `;

  const result = await client.query(sql, [windowId]);

  return result.rows[0] ?? null;
}

export async function updateFutureAvailabilityWindow({
  windowId,
  updateData,
  client = db,
}) {
  const {
    startTime: start_time,
    endTime: end_time,
    cancellationNoticeMinutes: cancellation_notice_minutes,
  } = updateData;

  const { values, setClause } = buildSetClause({
    start_time,
    end_time,
    cancellation_notice_minutes,
  });

  if (setClause.length === 0) {
    return null;
  }

  values.push(windowId);
  const windowIdPlaceholder = `$${values.length}`;

  const sql = `
    UPDATE availability_windows
    SET ${setClause}
    WHERE id = ${windowIdPlaceholder}
      AND deleted_at IS NULL
      AND start_time > NOW()
    RETURNING
      id,
      resource_id,
      start_time,
      end_time,
      cancellation_notice_minutes,
      created_at,
      updated_at
  `;

  const result = await client.query(sql, values);

  return result.rows[0] ?? null;
}

export async function deleteAllowedDurationByDurationIdAndWindowId({
  durationId,
  windowId,
  client = db,
}) {
  const sql = `
    DELETE FROM availability_window_allowed_durations
    WHERE id = $1
      AND availability_window_id = $2
    RETURNING id
  `;

  const result = await client.query(sql, [durationId, windowId]);

  return result.rows[0] ?? null;
}

export async function getAllowedDurationByDurationIdAndWindowId({
  durationId,
  windowId,
  forUpdate = false,
  client = db,
}) {
  const sql = `
    SELECT
      id,
      availability_window_id,
      duration_minutes
    FROM availability_window_allowed_durations
    WHERE id = $1
      AND availability_window_id = $2
    ${forUpdate ? 'FOR UPDATE' : ''}
  `;

  const result = await client.query(sql, [durationId, windowId]);

  return result.rows[0] ?? null;
}

// Used to put reservationDurationMinutes as minutes
// If it returns something then the reservation minutes
// is valid since it equals one of the allowed durations
// for the window.
//
// It also locks the duration for race condition.
export async function getAllowedDurationByWindowIdAndMinutes({
  windowId,
  minutes,
  forUpdate = false,
  client = db,
}) {
  const sql = `
    SELECT
      id,
      availability_window_id,
      duration_minutes
    FROM availability_window_allowed_durations
    WHERE availability_window_id = $1
      AND duration_minutes = $2
    ${forUpdate ? 'FOR UPDATE' : ''}
  `;

  const result = await client.query(sql, [windowId, minutes]);

  return result.rows[0] ?? null;
}

export async function createAllowedDuration({
  windowId,
  minutes,
  client = db,
}) {
  // Need the double quotes because Postgres would lowercase
  // durationMinutes to durationminutes.
  const sql = `
    INSERT INTO availability_window_allowed_durations (
      availability_window_id,
      duration_minutes
    )
    VALUES ($1, $2)
    RETURNING
      id,
      duration_minutes AS "minutes"
  `;

  const result = await client.query(sql, [windowId, minutes]);

  return result.rows[0];
}

export async function createAllowedDurations({
  windowId,
  minutesList,
  client = db,
}) {
  const allowedDurations = [];

  minutesList.sort((a, b) => a - b);

  for (const minutes of minutesList) {
    const allowedDuration = await createAllowedDuration({
      windowId,
      minutes,
      client,
    });

    allowedDurations.push(allowedDuration);
  }

  return allowedDurations;
}
/*
The functions above if this is passed in:

const rows = await createAllowedDurations({
  windowId: 1,
  minutesList: [90, 30, 60],
});

returns:

[
  {
    id: 1,
    minutes: 30,
  },
  {
    id: 2,
    minutes: 60,
  },
  {
    id: 3,
    minutes: 90,
  },
]

This is the same format as my availability windows list function for JSON_AGG, so It can be used for tests without remapping.
*/
