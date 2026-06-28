import Joi from 'joi';
import { passwordSchema, makeNewPasswordSchema } from './commonSchemas.js';
import {
  usernameSchema,
  nameSchema,
  emailSchema,
  userCreationBaseSchemaShape,
} from './userSchemas.js';

const registrationSchema = Joi.object({
  ...userCreationBaseSchemaShape,
}).messages({
  'object.base': 'Request body must be an object.',
});

const loginSchema = Joi.object({
  email: emailSchema.required(),
  password: passwordSchema.required(),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'any.required': 'Request body is required.',
  });

export { registrationSchema, loginSchema };
