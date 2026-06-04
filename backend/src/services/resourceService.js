import * as resourceQueries from '../data-access/resources.js';
import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import caughtError from '../errors/caughtError.js';
import {
  getLimitAndOffset,
  buildPagination,
} from './helpers/paginationHelpers.js';
import { resourceNotFound } from '../errors/commonErrors.js';

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
      data: resources.map(mapResource),
      pagination: buildPagination({ page, pageSize, total }),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function getActiveResourceById(resourceId) {
  try {
    const resource = await resourceQueries.getActiveResourceById(resourceId);

    if (!resource) {
      throw resourceNotFound();
    }

    return {
      data: mapResource(resource),
    };
  } catch (error) {
    throw caughtError(error);
  }
}

export async function createResource({
  resourceData,
  availabilityWindowDataList,
}) {
  const { ownerId, name, description, capacity, isActive } = resourceData;

  let resource;
  if (isActive === false) {
    resource = await resourceQueries.createResource()
  }
}
