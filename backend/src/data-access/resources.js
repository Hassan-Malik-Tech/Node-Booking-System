import * as sqlresourceQuery from './sql/resourceQueries.js';

export const listActiveResources = sqlresourceQuery.listActiveResources;
export const countActiveResources = sqlresourceQuery.countActiveResources;
export const getActiveResourceById = sqlresourceQuery.getActiveResourceById;
export const createResource = sqlresourceQuery.createResource;
export const softDeleteResourceById = sqlresourceQuery.softDeleteResourceById;
