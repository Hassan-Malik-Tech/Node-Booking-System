import Joi from 'joi';
import {
  usernameSchema,
  nameSchema,
  emailSchema,
  passwordSchema,
  makeNewPasswordSchema,
} from './commonSchemas.js';

const registrationSchema = Joi.object({
  username: usernameSchema.required(),
  email: emailSchema.required(),
  name: nameSchema.optional(),
  password: makeNewPasswordSchema(),
}).messages({
  'object.base': 'Request body must be an object.',
});

const loginSchema = Joi.object({
  username: usernameSchema.required(),
  password: passwordSchema.required(),
}).messages({
  'object.base': 'Request body must be an object.',
});

export { registrationSchema, loginSchema };
