import * as resourceService from '../services/resourceService.js';
import { success } from '../utils/response.js';

export async function listActiveResources(req, res) {
  const queryParams = req.validated.query;

  const { data, pagination } =
    await resourceService.listActiveResources(queryParams);

  return res.status(200).json(success({ data, pagination }));
}

export async function getActiveResourceById(req, res) {
  const resourceId = req.validated.params.resourceId;

  const { data } = await resourceService.getActiveResourceById(resourceId);

  return res.status(200).json(success({ data }));
}

export async function listResourcesForManagement(req, res) {
  const queryParams = req.validated.query;

  const { data, pagination } =
    await resourceService.listResourcesForManagement(queryParams);

  return res.status(200).json(success({ data, pagination }));
}

export async function getResourceByIdForManagement(req, res) {
  const resourceId = req.validated.params.resourceId;

  const { data } =
    await resourceService.getResourceByIdForManagement(resourceId);

  return res.status(200).json(success({ data }));
}

export async function createResource(req, res) {
  const { resourceData, availabilityWindowDataList } = req.validated.body;
  const authUserId = req.user.id;

  const { data } = await resourceService.createResource({
    resourceData: {
      ...resourceData,
      ownerId: authUserId,
    },
    availabilityWindowDataList,
  });

  return res
    .status(201)
    .location(`/api/resources/${data.resource.id}`)
    .json(success({ data }));
}

export async function updateResource(req, res) {
  const resourceId = req.validated.params.resourceId;
  const authUserId = req.user.id;
  const updateData = req.validated.body;

  const { data } = await resourceService.updateResource({
    resourceId,
    authUserId,
    updateData,
  });

  return res.status(200).json(success({ data }));
}

export async function deactivateResource(req, res) {
  const resourceId = req.validated.params.resourceId;
  const authUserId = req.user.id;

  const { data } = await resourceService.deactivateResource({
    resourceId,
    authUserId,
  });

  return res.status(200).json(success({ data }));
}

export async function activateResource(req, res) {
  const availabilityWindowDataList = req.validated.body;
  const resourceId = req.validated.params.resourceId;
  const authUserId = req.user.id;

  const { data } = await resourceService.activateResource({
    resourceId,
    authUserId,
    availabilityWindowDataList,
  });

  return res.status(200).json(success({ data }));
}

export async function softDeleteResource(req, res) {
  const resourceId = req.validated.params.resourceId;
  const authUserId = req.user.id;

  const { data } = await resourceService.softDeleteResource({
    resourceId,
    authUserId,
  });

  return res.status(200).json(success({ data }));
}
