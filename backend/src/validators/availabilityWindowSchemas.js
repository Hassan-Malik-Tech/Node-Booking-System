import Joi from 'joi';
import {
  commonListFilters,
  resourceIdSchema,
  resourceOwnerIdSchema,
} from './commonSchemas.js';

export const listAvailabilityWindowsQuerySchema = Joi.object({
  ...commonListFilters,
  // sortDirection in commonFilters defaults to desc.
  // For listing windows I want startTime asc.
  sortDirection: Joi.string()
    .trim()
    .valid('asc', 'desc')
    .default('asc')
    .messages({
      'string.base': 'Sort direction must be a string.',
      'any.only': 'Sort direction must be either asc or desc.',
    }),

  sortBy: Joi.string()
    .trim()
    .valid('startTime', 'endTime', 'createdAt', 'updatedAt', 'deletedAt')
    .default('startTime')
    .messages({
      'string.base': 'Sort by must be a string.',
      'any.only':
        'Sort by must be one of startTime, endTime, createdAt, updatedAt, or deletedAt.',
    }),

  status: Joi.string()
    .trim()
    .lowercase()
    .valid('active', 'expired', 'deleted', 'all')
    .default('active')
    .messages({
      'string.base': 'Status must be a string.',
      'any.only': 'Status must be one of active, expired, deleted, or all.',
    }),

  resourceId: Joi.number().integer().min(1).messages({
    'number.base': 'Resource id must be a number.',
    'number.integer': 'Resource id must be an integer.',
    'number.min': 'Resource id must be at least 1.',
  }),

  ownerId: resourceOwnerIdSchema,
}).messages({ 'object.base': 'Query parameters must be an object.' });

export const listActiveAvailabilityWindowsByResourceIdQuerySchema = Joi.object({
  ...commonListFilters,

  sortDirection: Joi.string()
    .trim()
    .valid('asc', 'desc')
    .default('asc')
    .messages({
      'string.base': 'Sort direction must be a string.',
      'any.only': 'Sort direction must be either asc or desc.',
    }),

  sortBy: Joi.string()
    .trim()
    .valid('startTime', 'createdAt')
    .default('startTime')
    .messages({
      'string.base': 'Sort by must be a string.',
      'any.only': 'Sort by must be either startTime or createdAt.',
    }),
}).messages({
  'object.base': 'Query parameters must be an object.',
});

export const availabilityWindowIdSchema = Joi.number()
  .integer()
  .min(1)
  .required()
  .messages({
    'number.base': 'Availability window id must be a number.',
    'number.integer': 'Availability window id must be an integer.',
    'number.min': 'Availability window id must be at least 1.',
    'any.required': 'Availability window id is required.',
  });

export const getAvailabilityWindowByIdParamsSchema = Joi.object({
  availabilityWindowId: availabilityWindowIdSchema.required(),
})
  .required()
  .messages({ 'object.base': 'Parameters must be an object.' });

export const getActiveAvailabilityWindowByResourceIdAndWindowIdParamsSchema =
  Joi.object({
    resourceId: resourceIdSchema.required(),
    availabilityWindowId: availabilityWindowIdSchema.required(),
  })
    .required()
    .messages({ 'object.base': 'Parameters must be an object.' });

// This function only runs after joi converts the time
// into a Date object, as getUTCMinutes() and
// getUTCSeconds() only work on Date objects
function validateUtcHalfHourBoundary(time, helpers) {
  const minutes = time.getUTCMinutes();
  const seconds = time.getUTCSeconds();
  const milliseconds = time.getUTCMilliseconds();

  if (![0, 30].includes(minutes) || seconds !== 0 || milliseconds !== 0) {
    return helpers.error('date.utcHalfHourBoundary');
  }

  return time;
}

const createAvailabilityWindowSchemaShape = {
  // .iso() means Joi only accepts date input that is in ISO 8601 date format.
  // Example: '2026-03-24T09:00:00Z'
  // .greater('now') means greater than now
  startTime: Joi.date()
    .iso()
    .greater('now')
    .custom(validateUtcHalfHourBoundary)
    .required()
    .messages({
      'date.base': 'Start time must be a valid date.',
      'date.format': 'Start time must be an ISO date string.',
      'date.greater': 'Start time must be in the future.',
      'date.utcHalfHourBoundary':
        'Start time must be on a UTC :00 or :30 boundary.',
      'any.required': 'Start time is required.',
    }),

  // Joi.ref('startTime') means that it references startTime
  // endTime > startTime is a must.
  endTime: Joi.date()
    .iso()
    .greater(Joi.ref('startTime'))
    .custom(validateUtcHalfHourBoundary)
    .required()
    .messages({
      'date.base': 'End time must be a valid date.',
      'date.format': 'End time must be an ISO date string.',
      'date.greater': 'End time must be after start time.',
      'date.utcHalfHourBoundary':
        'End time must be on a UTC :00 or :30 boundary.',
      'any.required': 'End time is required.',
    }),

  cancellationNoticeMinutes: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'Cancellation notice minutes must be a number.',
    'number.integer': 'Cancellation notice minutes must be an integer.',
    'number.min': 'Cancellation notice minutes must be at least 0.',
  }),

  allowedDurations: Joi.array()
    .items(
      Joi.number().integer().min(15).multiple(15).messages({
        'number.base': 'Allowed duration must be a number.',
        'number.integer': 'Allowed duration must be an integer.',
        'number.min': 'Allowed duration must be at least 15 minutes.',
        'number.multiple': 'Allowed duration must be a 15 minute interval.',
      }),
    )
    .min(1)
    .unique() // Every item must be a unique number
    .required()
    .messages({
      'array.base': 'Allowed durations must be an array.',
      'array.min': 'At least one allowed duration is required.',
      'array.unique': 'Allowed durations cannot contain duplicates.',
      'any.required': 'Allowed durations are required.',
    }),
};

export const createAvailabilityWindowBodySchema = Joi.object({
  ...createAvailabilityWindowSchemaShape,
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
  });

export const createAvailabilityWindowsBodySchema = Joi.array()
  .items(
    Joi.object({ ...createAvailabilityWindowSchemaShape }).messages({
      'object.base': 'Each availability window must be an object.',
    }),
  )
  .min(1)
  .required()
  .messages({
    'array.base': 'Availability window data list must be an array.',
    'array.min': 'At least one availability window is required.',
    'any.required': 'Availability window data list is required.',
  });
