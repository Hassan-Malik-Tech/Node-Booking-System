import * as resourceServices from '../services/resourceService.js';
import * as resourceSchemas from '../validators/resourceSchemas.js';
import { success } from '../utils/response.js';
import validateRequestInput from '../utils/validateRequestInput.js';

export async function listActiveResourcesController(req, res) {
  const queryParams = validateRequestInput({
    errorMessage: 'Invalid query params',
    schema: resourceSchemas.listActiveResourcesQuerySchema,
    values: req.query,
  });

  const { data, pagination } =
    await resourceServices.listActiveResourcesService(queryParams);

  return res.status(200).json(success({ data, pagination }));
}

export async function getActiveResourceByIdController(req, res) {
  const params = validateRequestInput({
    errorMessage: 'Invalid resourceId parameter',
    schema: resourceSchemas.getActiveResourceByIdParamsSchema,
    values: req.params,
  });

  const { data } = await resourceServices.getActiveResourceByIdService(
    params.resourceId,
  );

  return res.status(200).json(success({ data }));
}
