import * as resourceQueries from '../../data-access/resources.js';
import AppError from '../../errors/AppError.js';
import {
  forbidden,
  resourceDeleted,
  resourceInactive,
  resourceNotFound,
} from '../../errors/commonErrors.js';
import ERROR_CODES from '../../errors/errorCodes.js';
import * as db from '../../db/db.js';

export async function getResourceOrThrow({
  resourceId,
  forPublic = false,
  forUpdate = false,
  client = db,
}) {
  if (forUpdate && client === db) {
    throw new Error('Cannot use FOR UPDATE without a transaction client.');
  }

  const resource = await resourceQueries.getResourceById({
    resourceId,
    forPublic,
    forUpdate,
    client,
  });

  if (!resource) {
    throw resourceNotFound();
  }

  return resource;
}

export function requireOwner({ resource, authUserId }) {
  if (resource.owner_id !== authUserId) {
    throw forbidden();
  }
}

function requireOwnerOrAdmin({ resource, authUserId, userRole }) {
  if (resource.owner_id !== authUserId && userRole !== 'admin') {
    throw forbidden();
  }
}

export function requireNotDeleted({ resource, message }) {
  if (resource.deleted_at !== null) {
    throw resourceDeleted(message);
  }
}

function requireActive({ resource, message }) {
  if (resource.is_active === false) {
    throw resourceInactive(message);
  }
}

function requireInactive({ resource, message }) {
  if (resource.is_active === true) {
    throw AppError.conflict(message ?? 'Resource is already active.', {
      code: ERROR_CODES.RESOURCE_ALREADY_ACTIVE,
    });
  }
}

export async function requireOwnedNonDeletedResource({
  resourceId,
  authUserId,
  deletedMessage,
  forUpdate = false,
  client = db,
}) {
  const resource = await getResourceOrThrow({ resourceId, forUpdate, client });

  requireOwner({ resource, authUserId });
  requireNotDeleted({ resource, message: deletedMessage });

  return resource;
}

export async function requireOwnedActiveResource({
  resourceId,
  authUserId,
  deletedMessage,
  inactiveMessage,
  forUpdate = false,
  client = db,
}) {
  const resource = await getResourceOrThrow({ resourceId, forUpdate, client });

  requireOwner({ resource, authUserId });
  requireNotDeleted({ resource, message: deletedMessage });
  requireActive({ resource, message: inactiveMessage });

  return resource;
}

export async function requireOwnedInactiveResource({
  resourceId,
  authUserId,
  deletedMessage,
  alreadyActiveMessage,
  forUpdate = false,
  client = db,
}) {
  const resource = await getResourceOrThrow({ resourceId, forUpdate, client });

  requireOwner({ resource, authUserId });
  requireNotDeleted({ resource, message: deletedMessage });
  requireInactive({ resource, message: alreadyActiveMessage });

  return resource;
}

export async function requireOwnedActiveResourceOrAdmin({
  resourceId,
  authUserId,
  userRole,
  deletedMessage,
  inactiveMessage,
  forUpdate = false,
  client = db,
}) {
  const resource = await getResourceOrThrow({ resourceId, forUpdate, client });

  requireOwnerOrAdmin({ resource, authUserId, userRole });
  requireNotDeleted({ resource, message: deletedMessage });
  requireActive({ resource, message: inactiveMessage });

  return resource;
}

export async function requireOwnedNonDeletedResourceOrAdmin({
  resourceId,
  authUserId,
  userRole,
  deletedMessage,
  forUpdate = false,
  client = db,
}) {
  const resource = await getResourceOrThrow({ resourceId, forUpdate, client });

  requireOwnerOrAdmin({ resource, authUserId, userRole });
  requireNotDeleted({ resource, message: deletedMessage });

  return resource;
}

export async function requirePublicResource({
  resourceId,
  forUpdate = false,
  client = db,
}) {
  const resource = await getResourceOrThrow({
    resourceId,
    forPublic: true,
    forUpdate,
    client,
  });

  return resource;
}
