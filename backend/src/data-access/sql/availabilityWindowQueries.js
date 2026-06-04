import * as db from '../../db/db.js';
import { getOrderByParts } from './helpers/commonQueryHelpers.js';
import { buildAvailabilityWindowsWhereClause } from './helpers/availabilityWindowQueryHelpers.js';

const WINDOW_SORT_COLUMNS = {
  startTime: 'start_time',
  createdAt: 'created_at',
};

export async function listActiveWindowsByResourceId(resourceId, filters) {
  const { limit, offset, sortBy, sortDirection } = filters;

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: WINDOW_SORT_COLUMNS,
  });

  // filters out soft deleted and expired windows (end_time > NOW())
  const sql = `
    SELECT
      id,
      resource_id,
      start_time,
      end_time,
      cancellation_notice_minutes,
      created_at,
      updated_at
    FROM availability_windows
    WHERE resource_id = $1
      AND deleted_at IS NULL
      AND end_time > NOW()
    ORDER BY ${orderByColumn} ${direction}, id DESC
    LIMIT $2
    OFFSET $3
  `;

  const result = await db.query(sql, [resourceId, limit, offset]);

  return result.rows;
}

export async function countActiveWindowsByResourceId(resourceId) {
  const sql = `
    SELECT
      COUNT(*)::int AS total
    FROM availability_windows
    WHERE resource_id = $1
      AND deleted_at IS NULL
      AND end_time > NOW()
  `;

  const result = await db.query(sql, [resourceId]);

  return result.rows[0].total;
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

export async function softDeleteAvailabilityWindowById(windowId) {
  const sql = `
    UPDATE availability_windows
    SET deleted_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING deleted_at
  `;

  const result = await db.query(sql, [windowId]);

  return result.rows[0] ?? null;
}

// For admin/employee route
export async function getAvailabilityWindowById(windowId) {
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
    GROUP BY aw.id
  `;

  const result = await db.query(sql, [windowId]);

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

export async function createAvailabilityWindowsWithDurations({
  windowDataList,
  client = db,
}) {
  const availabilityWindows = [];
  const allowedDurationsList = [];

  // Validation should convert the client input into Date objects.
  windowDataList.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  for (const availabilityWindowData of windowDataList) {
    const {
      resourceId,
      startTime,
      endTime,
      cancellationNoticeMinutes,
      allowedDurations,
    } = availabilityWindowData;

    const availabilityWindow = await createAvailabilityWindow({
      windowData: { resourceId, startTime, endTime, cancellationNoticeMinutes },
      client,
    });

    allowedDurations.sort((a, b) => a - b);

    for (const minutes of allowedDurations) {
      const allowedDuration = await createAllowedDuration({
        windowId: availabilityWindow.id,
        minutes,
        client,
      });

      // So that it is clear what window it belongs to.
      allowedDuration.availabilityWindowId = availabilityWindow.id;

      allowedDurationsList.push(allowedDuration);
    }

    availabilityWindows.push(availabilityWindow);
  }

  return {
    availabilityWindows,
    allowedDurations: allowedDurationsList,
  };
}
