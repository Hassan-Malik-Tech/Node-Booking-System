import * as db from '../../db/db.js';
import {
  buildActiveResourcesWhereClause,
  buildResourcesForManagementWhereClause,
} from './helpers/resourceQueryHelpers.js';
import {
  getOrderByParts,
  buildSetClause,
} from './helpers/commonQueryHelpers.js';

const MANAGEMENT_RESOURCE_SORT_COLUMNS = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  name: 'name',
};

export async function listResourcesForManagement(filters) {
  const {
    limit,
    offset,
    search,
    sortBy,
    sortDirection,
    ownerId,
    status = 'active',
  } = filters;

  const { whereClause, values } = buildResourcesForManagementWhereClause({
    status,
    search,
    ownerId,
  });

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: MANAGEMENT_RESOURCE_SORT_COLUMNS,
  });

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const sql = `
    SELECT
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at,
      deleted_at
    FROM resources
    WHERE ${whereClause}
    ORDER BY ${orderByColumn} ${direction}, id DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `;

  const result = await db.query(sql, values);

  return result.rows;
}

export async function countResourcesForManagement(filters) {
  const { status = 'active', search, ownerId } = filters;

  const { whereClause, values } = buildResourcesForManagementWhereClause({
    status,
    search,
    ownerId,
  });

  const sql = `
    SELECT
      COUNT(*)::int AS total
    FROM resources
    WHERE ${whereClause}
  `;

  const result = await db.query(sql, values);

  return result.rows[0].total;
}

const PUBLIC_RESOURCE_SORT_COLUMNS = {
  createdAt: 'created_at',
  name: 'name',
}; // add updated_at for the admin options in step 8

export async function listActiveResources(filters) {
  const { limit, offset, search, sortBy, sortDirection } = filters;

  const { values, whereClause } = buildActiveResourcesWhereClause(search);

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: PUBLIC_RESOURCE_SORT_COLUMNS,
  });

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const sql = `
    SELECT
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at
    FROM resources
    WHERE ${whereClause}
    ORDER BY ${orderByColumn} ${direction}, id DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}
  `;

  const result = await db.query(sql, values);

  return result.rows;
}
// public endpoint is only for active reources
// admins should be able to see inactive and soft deleted resources (step 8)

export async function countActiveResources(search) {
  const { values, whereClause } = buildActiveResourcesWhereClause(search);

  const sql = `
    SELECT
      COUNT(*)::int AS total
    FROM resources
    WHERE ${whereClause}
  `;

  const result = await db.query(sql, values);

  return result.rows[0].total;
}

export async function getResourceById({
  resourceId,
  forUpdate = false,
  client = db,
}) {
  const sql = `
    SELECT 
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at,
      deleted_at
    FROM resources
    WHERE id = $1
    ${forUpdate ? 'FOR UPDATE' : ''}
  `;

  const result = await client.query(sql, [resourceId]);

  return result.rows[0] ?? null;
}

export async function createResource({ resourceData, client = db }) {
  const {
    ownerId,
    name,
    description = null,
    capacity,
    isActive = true,
  } = resourceData;

  const sql = `
    INSERT INTO resources (owner_id, name, description, capacity, is_active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await client.query(sql, [
    ownerId,
    name,
    description,
    capacity,
    isActive,
  ]);

  return result.rows[0];
}

export async function softDeleteResourceById({ resourceId, client = db }) {
  const sql = `
    UPDATE resources
    SET deleted_at = NOW(),
      is_active = FALSE
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at,
      deleted_at
  `;

  const result = await client.query(sql, [resourceId]);

  return result.rows[0] ?? null;
}

export async function updateResource({ resourceId, updateData, client = db }) {
  const { name, description, capacity } = updateData;

  const { values, setClause } = buildSetClause({
    name,
    description,
    capacity,
  });

  if (setClause.length === 0) {
    return null;
  }

  values.push(resourceId);
  const resourceIdPlaceholder = `$${values.length}`;

  const sql = `
    UPDATE resources
    SET ${setClause}
    WHERE id = ${resourceIdPlaceholder}
      AND deleted_at IS NULL
    RETURNING
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at
  `;

  const result = await client.query(sql, values);

  return result.rows[0] ?? null;
}

export async function activateResource({ resourceId, client = db }) {
  const sql = `
    UPDATE resources
    SET is_active = TRUE
    WHERE id = $1
      AND deleted_at IS NULL
      AND is_active = FALSE
    RETURNING
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at
  `;

  const result = await client.query(sql, [resourceId]);

  return result.rows[0] ?? null;
}

export async function deactivateResource({ resourceId, client = db }) {
  const sql = `
    UPDATE resources
    SET is_active = FALSE
    WHERE id = $1
      AND deleted_at IS NULL
      AND is_active = TRUE
    RETURNING
      id,
      owner_id,
      name,
      description,
      capacity,
      is_active,
      created_at,
      updated_at
  `;

  const result = await client.query(sql, [resourceId]);

  return result.rows[0] ?? null;
}
