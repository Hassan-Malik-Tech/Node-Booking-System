import * as sqlresourceQuery from './sql/resourceQueries.js';

export const listActiveResources = sqlresourceQuery.listActiveResources;

export const listResourcesForManagement =
  sqlresourceQuery.listResourcesForManagement;

export const countResourcesForManagement =
  sqlresourceQuery.countResourcesForManagement;

export const countActiveResources = sqlresourceQuery.countActiveResources;

export const getResourceById = sqlresourceQuery.getResourceById;

export const createResource = sqlresourceQuery.createResource;

export const updateResource = sqlresourceQuery.updateResource;

export const softDeleteResourceById = sqlresourceQuery.softDeleteResourceById;

export const deactivateResource = sqlresourceQuery.deactivateResource;

export const activateResource = sqlresourceQuery.activateResource;
