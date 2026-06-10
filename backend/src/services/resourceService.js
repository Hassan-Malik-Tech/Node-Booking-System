import * as resourceQueries from '../data-access/resources.js';
import * as reservationQueries from '../data-access/reservations.js';
import * as availabilityWindowQueries from '../data-access/availabilityWindows.js';
import caughtError from '../errors/caughtError.js';
import {
  getLimitAndOffset,
  buildPagination,
} from './helpers/paginationHelpers.js';
import {
  resourceNotFound,
  resourceStateChanged,
  resourceDeleted,
} from '../errors/commonErrors.js';
import { createAvailabilityWindowsForResource } from './helpers/availabilityWindowHelpers.js';
import * as db from '../db/db.js';
import * as resourceRules from './rules/resourceRules.js';

function mapResourceForPublic(resource) {
  return {
    id: resource.id,
    ownerId: resource.owner_id,
    name: resource.name,
    description: resource.description,
    capacity: resource.capacity,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  };
}

function mapResourceWithIsActive(resource) {
  return {
    id: resource.id,
    ownerId: resource.owner_id,
    name: resource.name,
    description: resource.description,
    capacity: resource.capacity,
    isActive: resource.is_active,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
  };
}

function mapResourceForManagement(resource) {
  return {
    id: resource.id,
    ownerId: resource.owner_id,
    name: resource.name,
    description: resource.description,
    capacity: resource.capacity,
    isActive: resource.is_active,
    createdAt: resource.created_at,
    updatedAt: resource.updated_at,
    deletedAt: resource.deleted_at,
  };
}

export async function listActiveResources(queryParams) {
  try {
    const { page, pageSize, search, sortBy, sortDirection } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    const filters = {
      limit,
      offset,
      search,
      sortBy,
      sortDirection,
    };

    const [resources, total] = await Promise.all([
      resourceQueries.listActiveResources(filters),
      resourceQueries.countActiveResources(search),
    ]);

    return {
      data: resources.map((resource) => mapResourceForPublic(resource)),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getActiveResourceById(resourceId) {
  try {
    const resource = await resourceRules.requirePublicResource({ resourceId });

    return {
      data: mapResourceForPublic(resource),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function listResourcesForManagement(queryParams) {
  try {
    const {
      page,
      pageSize,
      search,
      sortBy,
      sortDirection,
      ownerId,
      status = 'active',
    } = queryParams;

    const { limit, offset } = getLimitAndOffset({ pageSize, page });

    const filters = {
      limit,
      offset,
      search,
      sortBy,
      sortDirection,
      ownerId,
      status,
    };

    const [resources, total] = await Promise.all([
      resourceQueries.listResourcesForManagement(filters),
      resourceQueries.countResourcesForManagement(filters),
    ]);

    return {
      data: resources.map((resource) => mapResourceForManagement(resource)),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getResourceByIdForManagement(resourceId) {
  try {
    const resource = await resourceRules.getResourceOrThrow({ resourceId });

    return {
      data: mapResourceForManagement(resource),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function createResource({
  resourceData,
  availabilityWindowDataList,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    const { isActive } = resourceData;

    const resource = await resourceQueries.createResource({
      resourceData,
      client,
    });

    let availabilityWindowSummary;

    if (isActive) {
      availabilityWindowSummary = await createAvailabilityWindowsForResource({
        resourceId: resource.id,
        availabilityWindowDataList,
        client,
      });
    }

    const data = {
      resource: mapResourceWithIsActive(resource),
      availabilityWindowsCreated:
        availabilityWindowSummary?.availabilityWindowsCreated ?? 0,
      allowedDurationsCreated:
        availabilityWindowSummary?.allowedDurationsCreated ?? 0,
      availabilityWindowIds:
        availabilityWindowSummary?.availabilityWindowIds ?? [],
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback create resource transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function updateResource({ resourceId, authUserId, updateData }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await resourceRules.requireOwnedNonDeletedResource({
      resourceId,
      authUserId,
      deletedMessage: 'Cannot update a deleted resource.',
      forUpdate: true,
      client,
    });

    const updatedResource = await resourceQueries.updateResource({
      resourceId,
      updateData,
      client,
    });

    if (!updatedResource) {
      throw resourceStateChanged();
    }

    const { capacity } = updateData;

    let reservationsCancelled = 0;

    // Cancels all upcoming reservations whose
    // party size is greater than the new capacity
    // if capacity is one of the update fields.
    // It does not cancel ongoing reservations.
    if (capacity !== undefined) {
      reservationsCancelled =
        await reservationQueries.cancelUpcomingReservationsOverCapacity({
          resourceId,
          capacity,
          client,
        });
    }

    const data = {
      resource: mapResourceWithIsActive(updatedResource),
      reservationsCancelled,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback update resource transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function deactivateResource({ resourceId, userRole, authUserId }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    // Without locking, two requests can both read the resource as active.
    // Example:
    // R1 starts deactivating the resource and reads active = true.
    // R2 starts creating an availability window and also reads active = true.
    // R1 sets the resource to inactive, deletes current/future windows, and commits.
    // R2 then creates a new availability window and commits.
    // Result: an inactive resource can end up with a newly created window.
    await resourceRules.requireOwnedActiveResourceOrAdmin({
      resourceId,
      authUserId,
      userRole,
      deletedMessage: 'Cannot deactivate a deleted resource.',
      inactiveMessage: 'Resource is already inactive.',
      forUpdate: true,
      client,
    });

    const deactivatedResource = await resourceQueries.deactivateResource({
      resourceId,
      client,
    });

    if (!deactivatedResource) {
      throw resourceStateChanged();
    }

    const availabilityWindowsDeleted =
      await availabilityWindowQueries.softDeleteAvailabilityWindowsByResourceId(
        { resourceId, client },
      );

    const reservationsCancelled =
      await reservationQueries.cancelUpcomingReservationsByResourceId({
        resourceId,
        client,
      });

    const data = {
      resource: mapResourceWithIsActive(deactivatedResource),
      availabilityWindowsDeleted,
      reservationsCancelled,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback deactivate resource transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function activateResource({
  resourceId,
  authUserId,
  availabilityWindowDataList,
}) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await resourceRules.requireOwnedInactiveResource({
      resourceId,
      authUserId,
      deletedMessage: 'Cannot activate a deleted resource.',
      alreadyActiveMessage: 'Resource is already active.',
      forUpdate: true,
      client,
    });

    const activatedResource = await resourceQueries.activateResource({
      resourceId,
      client,
    });

    if (!activatedResource) {
      throw resourceStateChanged();
    }

    const {
      availabilityWindowsCreated,
      allowedDurationsCreated,
      availabilityWindowIds,
    } = await createAvailabilityWindowsForResource({
      resourceId,
      availabilityWindowDataList,
      client,
    });

    const data = {
      resource: mapResourceWithIsActive(activatedResource),
      availabilityWindowsCreated,
      allowedDurationsCreated,
      availabilityWindowIds,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback activate resource transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}

export async function softDeleteResource({ resourceId, authUserId, userRole }) {
  let client;

  try {
    client = await db.getClient();

    await client.query('BEGIN');

    await resourceRules.requireOwnedNonDeletedResourceOrAdmin({
      resourceId,
      authUserId,
      userRole,
      deletedMessage: 'Resource is already deleted.',
      forUpdate: true,
      client,
    });

    const deletedResource = await resourceQueries.softDeleteResourceById({
      resourceId,
      client,
    });

    if (!deletedResource) {
      throw resourceDeleted('Resource is already deleted.');
    }

    const availabilityWindowsDeleted =
      await availabilityWindowQueries.softDeleteAvailabilityWindowsByResourceId(
        { resourceId, client },
      );

    const reservationsCancelled =
      await reservationQueries.cancelUpcomingReservationsByResourceId({
        resourceId,
        client,
      });

    const data = {
      resourceId,
      availabilityWindowsDeleted,
      reservationsCancelled,
    };

    await client.query('COMMIT');

    return {
      data,
    };
  } catch (error) {
    if (client !== undefined) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Failed to rollback soft delete resource transaction:',
          rollbackError,
        );
      }
    }

    throw caughtError(error);
  } finally {
    client?.release();
  }
}
