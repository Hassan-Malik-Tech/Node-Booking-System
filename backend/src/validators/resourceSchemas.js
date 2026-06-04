import Joi from 'joi';
import { commonListFilters } from './commonSchemas.js';

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
  search: Joi.string().trim().min(1).max(100).messages({
    'string.base': 'Search must be a string.',
    'string.empty': 'Search cannot be empty.',
    'string.min': 'Search cannot be empty.',
    'string.max': 'Search must be at most 100 characters long.',
  }),
}).messages({ 'object.base': 'Query parameters must be an object.' });

export const resourceByIdParamsSchema = Joi.object({
  resourceId: Joi.number().integer().min(1).required().messages({
    'number.base': 'Resource id must be a number.',
    'number.integer': 'Resource id must be an integer.',
    'number.min': 'Resource id must be at least 1.',
    'any.required': 'Resource id is required.',
  }),
})
  .required()
  .messages({ 'object.base': 'Parameters must be an object.' });

  