import Joi from 'joi';
import { availabilityWindowIdSchema } from './availabilityWindowSchemas.js';
import {
  resourceIdSchema,
  commonListFilters,
  resourceOwnerIdSchema,
  searchSchema,
} from './commonSchemas.js';

export const reservationListBaseQuerySchemaShape = {
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
    .valid('startTime', 'endTime', 'createdAt', 'updatedAt')
    .default('startTime')
    .messages({
      'string.base': 'Sort by must be a string.',
      'any.only':
        'Sort by must be one of startTime, endTime, createdAt, or updatedAt.',
    }),

  status: Joi.string()
    .trim()
    .lowercase()
    .valid('active', 'completed', 'cancelled', 'all')
    .default('active')
    .messages({
      'string.base': 'Status must be a string.',
      'any.only': 'Status must be one of active, completed, cancelled, or all.',
    }),

  timing: Joi.when('status', {
    is: 'active',
    then: Joi.string()
      .trim()
      .valid('upcoming', 'ongoing', 'ongoingAndUpcoming', 'past', 'all')
      .default('ongoingAndUpcoming')
      .messages({
        'string.base': 'Timing must be a string.',
        'any.only':
          'Timing must be one of upcoming, ongoing, ongoingAndUpcoming, past, or all.',
      }),

    otherwise: Joi.string().trim().valid('all').default('all').messages({
      'string.base': 'Timing must be a string.',
      'any.only': 'Timing must be all when reservation status is not active.',
    }),
  }),
};

const reservationUserIdSchema = Joi.number().integer().min(1).messages({
  'number.base': 'Reservation user id must be a number.',
  'number.integer': 'Reservation user id must be an integer.',
  'number.min': 'Reservation user id must be at least 1.',
});

export const listOwnReservationsQuerySchema = Joi.object({
  ...reservationListBaseQuerySchemaShape,
}).messages({ 'object.base': 'Query parameters must be an object.' });

export const listReservationsForOwnedResourcesQuerySchema = Joi.object({
  ...reservationListBaseQuerySchemaShape,

  resourceId: resourceIdSchema.optional(),

  reservationUserId: reservationUserIdSchema.optional(),

  availabilityWindowId: availabilityWindowIdSchema.optional(),

  search: searchSchema.optional(),
}).messages({ 'object.base': 'Query parameters must be an object.' });

export const listReservationsForStaffQuerySchema = Joi.object({
  ...reservationListBaseQuerySchemaShape,

  resourceId: resourceIdSchema.optional(),

  resourceOwnerId: resourceOwnerIdSchema.optional(),

  reservationUserId: reservationUserIdSchema.optional(),

  availabilityWindowId: availabilityWindowIdSchema.optional(),

  search: searchSchema.optional(),
}).messages({ 'object.base': 'Query parameters must be an object.' });

function validateUtcQuarterHourBoundary(time, helpers) {
  const minutes = time.getUTCMinutes();
  const seconds = time.getUTCSeconds();
  const milliseconds = time.getUTCMilliseconds();

  if (
    ![0, 15, 30, 45].includes(minutes) ||
    seconds !== 0 ||
    milliseconds !== 0
  ) {
    return helpers.error('date.utcQuarterHourBoundary');
  }

  return time;
}

const partySizeSchema = Joi.number().integer().min(1).required().messages({
  'number.base': 'Party size must be a number.',
  'number.integer': 'Party size must be an integer.',
  'number.min': 'Party size must be at least 1.',
  'any.required': 'Party size is required.',
});

export const bookReservationBodySchema = Joi.object({
  resourceId: resourceIdSchema.required(),

  availabilityWindowId: availabilityWindowIdSchema.required(),

  startTime: Joi.date()
    .iso()
    .greater('now')
    .custom(validateUtcQuarterHourBoundary)
    .required()
    .messages({
      'date.base': 'Start time must be a valid date.',
      'date.format': 'Start time must be an ISO date string.',
      'date.greater': 'Start time must be in the future.',
      'date.utcQuarterHourBoundary':
        'Start time must be on a UTC :00, :15, :30, or :45 boundary.',
      'any.required': 'Start time is required.',
    }),

  endTime: Joi.date()
    .iso()
    .custom(validateUtcQuarterHourBoundary)
    .greater(Joi.ref('startTime'))
    .required()
    .messages({
      'date.base': 'End time must be a valid date.',
      'date.format': 'End time must be an ISO date string.',
      'date.greater': 'End time must be after start time.',
      'date.utcQuarterHourBoundary':
        'End time must be on a UTC :00, :15, :30, or :45 boundary.',
      'any.required': 'End time is required.',
    }),

  partySize: partySizeSchema.required(),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'any.required': 'Request body is required.',
  });

const reservationIdSchema = Joi.number().integer().min(1).required().messages({
  'number.base': 'Reservation id must be a number.',
  'number.integer': 'Reservation id must be an integer.',
  'number.min': 'Reservation id must be at least 1.',
  'any.required': 'Reservation id is required.',
});

export const reservationIdParamsSchema = Joi.object({
  reservationId: reservationIdSchema.required(),
})
  .required()
  .messages({ 'object.base': 'Parameters must be an object.' });

export const updateReservationPartySizeBodySchema = Joi.object({
  partySize: partySizeSchema.required(),
})
  .required()
  .messages({
    'object.base': 'Request body must be an object.',
    'any.required': 'Request body is required.',
  });
