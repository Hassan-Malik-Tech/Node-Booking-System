import * as db from '../../db/db.js';
import { buildActiveResourcesWhereClause } from './helpers/resourceQueryHelpers.js';
import { getOrderByParts } from './helpers/commonQueryHelpers.js';

const RESOURCE_SORT_COLUMNS = {
  createdAt: 'created_at',
  name: 'name',
}; // add updated_at for the admin options in step 8

export async function listActiveResources(filters) {
  const { limit, offset, search, sortBy, sortDirection } = filters;

  const { values, whereClause } = buildActiveResourcesWhereClause(search);

  const { orderByColumn, direction } = getOrderByParts({
    sortBy,
    sortDirection,
    allowList: RESOURCE_SORT_COLUMNS,
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

export async function getActiveResourceById(resourceId) {
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
    WHERE id = $1
      AND deleted_at IS NULL
      AND is_active = TRUE
  `;

  const result = await db.query(sql, [resourceId]);

  return result.rows[0] ?? null;
}

export async function createResource(resourceData) {
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
      updated_at
  `;

  const result = await db.query(sql, [
    ownerId,
    name,
    description,
    capacity,
    isActive,
  ]);

  return result.rows[0];
}

export async function softDeleteResourceById(resourceId) {
  const sql = `
    UPDATE resources
    SET deleted_at = NOW(),
      is_active = false
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id
  `;

  const result = await db.query(sql, [resourceId]);

  return result.rows[0] ?? null;
}
