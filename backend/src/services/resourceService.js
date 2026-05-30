import * as resourceQueries from '../data-access/resources.js';
import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import caughtError from '../errors/caughtError.js';

function mapResource(resource) {
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

export async function listActiveResources(filters) {
  try {
    const { page, pageSize, search, sortBy, sortDirection } = filters;

    const limit = pageSize;

    const offset = (page - 1) * limit;

    const queryFilters = {
      limit,
      offset,
      search,
      sortBy,
      sortDirection,
    };

    const [resources, totalResources] = await Promise.all([
      resourceQueries.listActiveResources(queryFilters),
      resourceQueries.countActiveResources(search),
    ]);

    return {
      data: resources.map(mapResource),
      pagination: {
        page,
        pageSize,
        total: totalResources,
        totalPages: Math.ceil(totalResources / pageSize),
      },
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getActiveResourceById(resourceId) {
  try {
    const resource = await resourceQueries.getActiveResourceById(resourceId);

    if (!resource) {
      throw AppError.notFound('Resource not found', {
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
      });
    }

    return {
      data: mapResource(resource),
    };
  } catch (error) {
    throw caughtError(error);
  }
}
