import Joi from 'joi';
import {
  commonListFilters,
  usernameSchema,
  emailSchema,
  nameSchema,
  makeNewPasswordSchema,
} from './commonSchemas.js';

export const listActiveUsersQuerySchema = Joi.object({
  ...commonListFilters,
  role: Joi.string().trim().valid('user', 'admin'),
  sortBy: Joi.string()
    .trim()
    .valid('createdAt', 'username', 'email', 'role')
    .default('createdAt'),
});

export const getActiveUserByIdParamsSchema = Joi.object({
  userId: Joi.number().integer().min(1).required(),
});

export const updateUserBodySchema = Joi.object({
  username: usernameSchema.optional(),
  name: nameSchema,
  email: emailSchema.optional(),
})
  .min(1)
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'object.min': 'At least one profile field is required.',
  });

export const updatePasswordBodySchema = Joi.object({
  password: makeNewPasswordSchema(),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
  });
