import Joi from 'joi';
import {
  commonListFilters,
  makeNewPasswordSchema,
  searchSchema,
} from './commonSchemas.js';

export const listUsersForStaffQuerySchema = Joi.object({
  ...commonListFilters,

  sortBy: Joi.string()
    .trim()
    .valid('createdAt', 'updatedAt', 'deletedAt', 'username', 'email', 'role')
    .default('createdAt')
    .messages({
      'string.base': 'Sort by must be a string.',
      'any.only':
        'Sort by must be one of createdAt, updatedAt, deletedAt, username, email, or role.',
    }),

  status: Joi.string()
    .trim()
    .lowercase()
    .valid('active', 'deleted', 'all')
    .default('active')
    .messages({
      'string.base': 'Status must be a string.',
      'any.only': 'Status must be one of active, deleted, or all.',
    }),

  role: Joi.string()
    .trim()
    .lowercase()
    .valid('user', 'employee', 'admin', 'all')
    .default('all')
    .messages({
      'string.base': 'Role must be a string.',
      'any.only': 'Role must be one of user, employee, admin, or all.',
    }),

  search: searchSchema.optional(),
}).messages({ 'object.base': 'Query parameters must be an object.' });

// Preserve username casing for display, but compare usernames case-insensitively.
export const usernameSchema = Joi.string()
  .trim()
  .min(3)
  .max(30)
  .pattern(/^[a-zA-Z0-9_]+$/)
  .messages({
    'string.base': 'Username must be a string.',
    'string.empty': 'Username is required.',
    'string.min': 'Username must be at least 3 characters.',
    'string.max': 'Username must be at most 30 characters long.',
    'string.pattern.base':
      'Username can only contain letters numbers and underscores.', // .base is for regex failure specifically
    'any.required': 'Username is required.',
  });

export const emailSchema = Joi.string().trim().lowercase().email().messages({
  'string.base': 'Email must be a string.',
  'string.empty': 'Email is required.',
  'string.email': 'Email must be valid.',
  'any.required': 'Email is required.',
});

export const nameSchema = Joi.string()
  .trim()
  .min(1)
  .allow(null)
  .optional()
  .messages({
    'string.base': 'Name must be a string.',
    'string.empty': 'Name cannot be empty.',
    'string.min': 'Name cannot be empty.', // because lower than 1 is 0
  });

const newPasswordSchema = makeNewPasswordSchema();

export const userCreationBaseSchemaShape = {
  username: usernameSchema.required(),
  email: emailSchema.required(),
  name: nameSchema.optional(),
  password: newPasswordSchema.required(),
};

export const createUserAsAdminBodySchema = Joi.object({
  ...userCreationBaseSchemaShape,
  role: Joi.string()
    .trim()
    .lowercase()
    .valid('user', 'employee')
    .required()
    .messages({
      'string.base': 'Role must be a string.',
      'string.empty': 'Role is required.',
      'any.only': 'Role must be either user or employee.',
      'any.required': 'Role is required.',
    }),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'any.required': 'User data is required.',
  });

export const updateUserBodySchema = Joi.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  name: nameSchema.optional(),
})
  .min(1)
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'object.min': 'At least one profile field is required.',
    'any.required': 'At least one profile field is required.',
  });

export const updateUserAsAdminBodySchema = Joi.object({
  username: usernameSchema.optional(),
  name: nameSchema.optional(),
})
  .min(1)
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'object.min': 'At least one user field is required.',
    'any.required': 'At least one user field is required.',
  });

export const updatePasswordBodySchema = Joi.object({
  password: makeNewPasswordSchema(),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
  });

export const userIdParamsSchema = Joi.object({
  userId: Joi.number().integer().min(1).required().messages({
    'number.base': 'User id must be a number.',
    'number.integer': 'User id must be an integer.',
    'number.min': 'User id must be at least 1.',
    'any.required': 'User id is required.',
  }),
})
  .required()
  .messages({ 'object.base': 'Parameters must be an object.' });

export const updateUserRoleAsAdminBodySchema = Joi.object({
  newRole: Joi.string()
    .trim()
    .lowercase()
    .valid('user', 'employee')
    .required()
    .messages({
      'string.base': 'New role must be a string.',
      'string.empty': 'New role is required.',
      'any.only': 'New role must be either user or employee.',
      'any.required': 'New role is required.',
    }),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'any.required': 'Request body is required.',
  });
