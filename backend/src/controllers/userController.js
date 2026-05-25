import * as userServices from '../services/userService.js';
import * as userSchemas from '../validators/userSchemas.js';
import { success } from '../utils/response.js';
import validateRequestInput from '../utils/validateRequestInput.js';

export async function listActiveUsersController(req, res) {
  const queryParams = validateRequestInput({
    errorMessage: 'Invalid query parameters',
    schema: userSchemas.listActiveUsersQuerySchema,
    values: req.query,
  });

  const { data, pagination } =
    await userServices.listActiveUsersService(queryParams);

  return res.status(200).json(success({ data, pagination }));
} // for GET '/api/users'

export async function getActiveUserByIdController(req, res) {
  const params = validateRequestInput({
    errorMessage: 'Invalid userId parameter',
    schema: userSchemas.getActiveUserByIdParamsSchema,
    values: req.params,
  });

  const { data } = await userServices.getActiveUserByIdService(params.userId);

  return res.status(200).json(success({ data }));
} // for GET '/api/users/:userId'

export async function createUserController(req, res) {
  const userData = validateRequestInput({
    errorMessage: 'Invalid request body',
    schema: userSchemas.createUserBodySchema,
    values: req.body,
  });

  const { data } = await userServices.createUserService(userData);

  return res
    .status(201)
    .location(`/api/users/${data.id}`)
    .json(success({ data }));
}

export async function updateUserController(req, res) {
  const params = validateRequestInput({
    errorMessage: 'Invalid user id',
    schema: userSchemas.getActiveUserByIdParamsSchema,
    values: req.params,
  });

  const patchFields = validateRequestInput({
    errorMessage: 'Invalid request body',
    schema: userSchemas.updateUserBodySchema,
    values: req.body,
  });

  const userData = {
    userId: params.userId,
    ...patchFields,
  };

  const { data } = await userServices.updateUserService(userData);

  return res.status(200).json(success({ data }));
}
