import Joi from 'joi';
import {
  commonListFilters,
  resourceIdSchema,
  resourceOwnerIdSchema,
} from './commonSchemas.js';
import { createAvailabilityWindowsBodySchema } from './availabilityWindowSchemas.js';

const resourceSearchSchema = Joi.string().trim().min(1).max(100).messages({
  'string.base': 'Search must be a string.',
  'string.empty': 'Search cannot be empty.',
  'string.min': 'Search cannot be empty.',
  'string.max': 'Search must be at most 100 characters long.',
});

export const listActiveResourcesQuerySchema = Joi.object({
  ...commonListFilters,
  sortBy: Joi.string()
    .trim()
    .valid('createdAt', 'name')
    .default('createdAt')
    .messages({
      'string.base': 'Sort by must be a string.',
      'any.only': 'Sort by must be either createdAt or name.',
    }),
  search: resourceSearchSchema,
}).messages({ 'object.base': 'Query parameters must be an object.' });

export const listResourcesForManagementQuerySchema = Joi.object({
  ...commonListFilters,
  sortBy: Joi.string()
    .trim()
    .valid('createdAt', 'updatedAt', 'name')
    .default('createdAt')
    .messages({
      'string.base': 'Sort by must be a string.',
      'any.only': 'Sort by must be one of createdAt, updatedAt, or name.',
    }),
  search: resourceSearchSchema,
  ownerId: resourceOwnerIdSchema,
  status: Joi.string()
    .trim()
    .lowercase()
    .valid('active', 'inactive', 'deleted', 'all')
    .default('active')
    .messages({
      'string.base': 'Status must be a string.',
      'any.only': 'Status must be one of active, inactive, deleted, or all.',
    }),
}).messages({ 'object.base': 'Query parameters must be an object.' });

export const resourceByIdParamsSchema = Joi.object({
  resourceId: resourceIdSchema.required(),
})
  .required()
  .messages({ 'object.base': 'Parameters must be an object.' });

function validateResourceNameFormat(name, helpers) {
  if (name.includes('  ')) {
    return helpers.error('string.multipleSpaces');
  }

  if (!/^[a-zA-Z0-9 #'()-]+$/.test(name)) {
    return helpers.error('string.invalidCharacters');
  }

  if (!/[a-zA-Z0-9]/.test(name)) {
    return helpers.error('string.missingAlphaNumeric');
  }

  return name;
}

const resourceNameSchema = Joi.string()
  .trim()
  .min(1)
  .max(100)
  .custom(validateResourceNameFormat)
  .messages({
    'string.base': 'Resource name must be a string.',
    'string.empty': 'Resource name is required.',
    'string.min': 'Resource name cannot be empty.',
    'string.max': 'Resource name must be at most 100 characters long.',
    'string.multipleSpaces': 'Resource name cannot contain multiple spaces.',
    'string.invalidCharacters':
      'Resource name can only contain letters, numbers, spaces, #, apostrophes, parentheses, and hyphens.',
    'string.missingAlphaNumeric':
      'Resource name must contain at least one letter or number.',
    'any.required': 'Resource name is required.',
  });

const descriptionSchema = Joi.string().trim().min(1).allow(null).messages({
  'string.base': 'Description must be a string.',
  'string.empty': 'Description cannot be empty.',
  'string.min': 'Description cannot be empty.',
});

const capacitySchema = Joi.number().integer().min(1).messages({
  'number.base': 'Capacity must be a number.',
  'number.integer': 'Capacity must be an integer.',
  'number.min': 'Capacity must be at least 1.',
  'any.required': 'Capacity is required.',
});

const isActiveSchema = Joi.boolean().messages({
  'boolean.base': 'Active status must be true or false.',
});

export const createResourceBodySchema = Joi.object({
  resourceData: Joi.object({
    name: resourceNameSchema.required(),
    description: descriptionSchema.default(null),
    capacity: capacitySchema.required(),
    isActive: isActiveSchema.default(true),
  })
    .required()
    .messages({
      'object.base': 'Resource data must be an object.',
      'any.required': 'Resource data is required.',
    }),

  availabilityWindowDataList: Joi.when('resourceData.isActive', {
    is: true,
    then: createAvailabilityWindowsBodySchema.required().messages({
      'any.required':
        'At least one availability window is required when creating an active resource.',
    }),
    otherwise: Joi.forbidden().messages({
      // any.unknown since the key becomes unknown when it is forbidden
      'any.unknown':
        'Availability windows are not allowed when creating an inactive resource.',
    }),
  }),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
  });

export const updateResourceBodySchema = Joi.object({
  name: resourceNameSchema.optional(),
  description: descriptionSchema.optional(),
  capacity: capacitySchema.optional(),
})
  .min(1)
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'object.min': 'Request body must have at least one update field.',
    'any.required': 'Request body must have at least one update field.',
  });
