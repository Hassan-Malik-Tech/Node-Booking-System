import Joi from 'joi';
import { Buffer } from 'node:buffer'; // Even tho not strictly required, node recommends importing it.
import { BCRYPT_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../auth/password.js';

export const commonListFilters = {
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number.',
    'number.integer': 'Page must be an integer.',
    'number.min': 'Page must be at least 1.',
  }),

  pageSize: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Page size must be a number.',
    'number.integer': 'Page size must be an integer.',
    'number.min': 'Page size must be at least 1.',
    'number.max': 'Page size must be at most 100.',
  }),

  sortDirection: Joi.string()
    .trim()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'string.base': 'Sort direction must be a string.',
      'any.only': 'Sort direction must be either asc or desc.',
    }),
};

export const resourceIdSchema = Joi.number()
  .integer()
  .min(1)
  .messages({
    'number.base': 'Resource id must be a number.',
    'number.integer': 'Resource id must be an integer.',
    'number.min': 'Resource id must be at least 1.',
    'any.required': 'Resource id is required.',
  });

export const resourceOwnerIdSchema = Joi.number().integer().min(1).messages({
  'number.base': 'Resource owner id must be a number.',
  'number.integer': 'Resource owner id must be an integer.',
  'number.min': 'Resource owner id must be at least 1.',
});

export const searchSchema = Joi.string().trim().min(1).max(100).messages({
  'string.base': 'Search must be a string.',
  'string.empty': 'Search cannot be empty.',
  'string.min': 'Search cannot be empty.',
  'string.max': 'Search must be at most 100 characters long.',
});

function validatePasswordByteLength(password, helpers) {
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
    return helpers.error('password.maxBytes');
  }

  return password;
}

// Min is not required as the password passed for login
// would have had to pass the min check in registration
export const passwordSchema = Joi.string()
  .required()
  .custom(validatePasswordByteLength)
  .messages({
    'string.base': 'Password must be a string.',
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.',
    'password.maxBytes': `Password must be ${BCRYPT_MAX_BYTES} bytes or fewer.`,
  });

// For password registration and password reset
export function makeNewPasswordSchema() {
  return passwordSchema.min(PASSWORD_MIN_LENGTH).messages({
    'string.min': `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  });
}
