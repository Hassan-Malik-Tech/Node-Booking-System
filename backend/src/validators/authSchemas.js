import Joi from 'joi';
import { Buffer } from 'node:buffer'; // Even tho not strictly required, node recommends importing it.
import { PASSWORD_MIN_LENGTH, BCRYPT_MAX_BYTES } from '../auth/password.js';

function validatePasswordByteLength(password, helpers) {
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
    return helpers.error('password.maxBytes');
  }

  return password;
}

// Preserve username casing for display, but compare usernames case-insensitively.
const usernameSchema = Joi.string()
  .trim()
  .min(3)
  .max(30)
  .pattern(/^[a-zA-Z0-9_]+$/)
  .required()
  .messages({
    'string.base': 'Username must be a string.',
    'string.empty': 'Username is required.',
    'string.min': 'Username must be at least 3 characters.',
    'string.max': 'Username must be at most 30 characters long.',
    'string.pattern.base':
      'Username can only contain letters numbers and underscores.', // .base is for regex failure specifically
    'any.required': 'Username is required.',
  });

const emailSchema = Joi.string()
  .trim()
  .lowercase()
  .email()
  .required()
  .messages({
    'string.base': 'Email must be a string.',
    'string.empty': 'Email is required.',
    'string.email': 'Email must be valid.',
    'any.required': 'Email is required.',
  });

const nameSchema = Joi.string().trim().min(1).allow(null).optional().messages({
  'string.base': 'Name must be a string.',
  'string.empty': 'Name cannot be empty.',
  'string.min': 'Name cannot be empty.', // because lower than 1 is 0
});

const registrationPasswordSchema = Joi.string()
  .min(PASSWORD_MIN_LENGTH)
  .required()
  .custom(validatePasswordByteLength)
  .messages({
    'string.base': 'Password must be a string.',
    'string.empty': 'Password is required.',
    'string.min': `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    'any.required': 'Password is required.',
    'password.maxBytes': `Password must be ${BCRYPT_MAX_BYTES} bytes or fewer.`,
  });

// Min is not required as the password passed here
// would have had to pass the min check in registrationPasswordSchema.
const loginPasswordSchema = Joi.string()
  .required()
  .custom(validatePasswordByteLength)
  .messages({
    'string.base': 'Password must be a string.',
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.',
    'password.maxBytes': `Password must be ${BCRYPT_MAX_BYTES} bytes or fewer.`,
  });

const registrationSchema = Joi.object({
  username: usernameSchema,
  email: emailSchema,
  name: nameSchema,
  password: registrationPasswordSchema,
});

const loginSchema = Joi.object({
  username: usernameSchema,
  password: loginPasswordSchema,
});

export { registrationSchema, loginSchema };
