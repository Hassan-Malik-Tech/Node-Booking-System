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

  search: Joi.string().trim().min(1).max(100).messages({
    'string.base': 'Search must be a string.',
    'string.empty': 'Search cannot be empty.',
    'string.min': 'Search cannot be empty.',
    'string.max': 'Search must be at most 100 characters long.',
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
