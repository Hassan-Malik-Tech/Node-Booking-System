import Joi from 'joi';
import { availabilityWindowIdSchema } from './availabilityWindowSchemas.js';
import { resourceIdSchema } from './commonSchemas.js';

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
