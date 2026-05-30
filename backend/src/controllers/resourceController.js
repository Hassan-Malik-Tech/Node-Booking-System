import * as resourceService from '../services/resourceService.js';
import * as resourceSchemas from '../validators/resourceSchemas.js';
import { success } from '../utils/response.js';
import validateRequestInput from '../utils/validateRequestInput.js';

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
