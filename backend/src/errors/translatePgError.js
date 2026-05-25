import AppError from './AppError.js';

function translatePgError(error) {
  // ---------------------------------------------------------------------------
  // 23505 = unique violation
  // ---------------------------------------------------------------------------

  if (error.code === '23505') {
    if (error.constraint === 'unique_email_for_non_deleted_user_idx') {
      return AppError.conflict('Email is already in use', {
        code: 'EMAIL_ALREADY_EXISTS',
        cause: error,
      });
    }

    if (error.constraint === 'unique_username_for_non_deleted_user_idx') {
      return AppError.conflict('Username is already in use', {
        code: 'USERNAME_ALREADY_EXISTS',
        cause: error,
      });
    }

    if (error.constraint === 'unique_name_for_non_deleted_resource_per_owner') {
      return AppError.conflict(
        'Resource name is already in use for this owner',
        {
          code: 'RESOURCE_NAME_ALREADY_EXISTS_FOR_OWNER',
          cause: error,
        },
      );
    }

    if (
      error.constraint ===
      'unique_non_soft_deleted_resource_availability_window'
    ) {
      return AppError.conflict(
        'Availability window already exists for this resource and time range',
        {
          code: 'WINDOW_ALREADY_EXISTS',
          cause: error,
        },
      );
    }

    if (error.constraint === 'unique_window_duration_per_window') {
      return AppError.conflict(
        'Duration already exists for this availability window',
        {
          code: 'DURATION_ALREADY_EXISTS_FOR_WINDOW',
          cause: error,
        },
      );
    }

    return AppError.conflict('Unique constraint violation', {
      code: 'DB_UNIQUE_CONSTRAINT_VIOLATION',
      cause: error,
    });
  }

  // ---------------------------------------------------------------------------
  // 23P01 = exclusion constraint violation
  // ---------------------------------------------------------------------------

  if (error.code === '23P01') {
    if (error.constraint === 'availability_windows_no_overlap_or_adjacency') {
      return AppError.conflict(
        'Availability windows for the same resource cannot overlap or touch',
        {
          code: 'WINDOW_OVERLAP_OR_ADJACENCY',
          cause: error,
        },
      );
    }

    if (error.constraint === 'reservations_no_overlap') {
      return AppError.conflict(
        'Reservation overlaps with an existing reservation for this resource',
        {
          code: 'RESERVATION_OVERLAP',
          cause: error,
        },
      );
    }

    return AppError.conflict('Exclusion constraint violation', {
      code: 'DB_EXCLUSION_CONSTRAINT_VIOLATION',
      cause: error,
    });
  }

  // ---------------------------------------------------------------------------
  // 23503 = foreign key violation
  // ---------------------------------------------------------------------------

  if (error.code === '23503') {
    if (error.constraint === 'resources_owner_id_fkey') {
      return AppError.badRequest('Resource owner does not exist', {
        code: 'RESOURCE_OWNER_NOT_FOUND',
        cause: error,
      });
    }

    if (error.constraint === 'availability_windows_resource_id_fkey') {
      return AppError.badRequest('Resource does not exist', {
        code: 'WINDOW_RESOURCE_NOT_FOUND',
        cause: error,
      });
    }

    if (error.constraint === 'awad_aw_id_fkey') {
      return AppError.badRequest('Availability window does not exist', {
        code: 'DURATION_WINDOW_NOT_FOUND',
        cause: error,
      });
    }

    if (error.constraint === 'reservations_user_id_fkey') {
      return AppError.badRequest(
        'The user that is trying to reserve this resource does not exist',
        {
          code: 'USER_NOT_FOUND',
          cause: error,
        },
      );
    }

    if (error.constraint === 'reservations_resource_id_fkey') {
      return AppError.badRequest('The resource being reserved does not exist', {
        code: 'RESOURCE_NOT_FOUND',
        cause: error,
      });
    }

    if (error.constraint === 'reservations_window_resource_fkey') {
      return AppError.badRequest(
        'Availability window must belong to the resource being reserved',
        {
          code: 'RESERVATION_WINDOW_RESOURCE_MISMATCH',
          cause: error,
        },
      );
    }

    return AppError.badRequest('Referenced record does not exist', {
      code: 'DB_FOREIGN_KEY_VIOLATION',
      cause: error,
    });
  }

  // ---------------------------------------------------------------------------
  // 23514 = check constraint violation
  // Only translates check constraints that my Joi schemas do not cover
  // ---------------------------------------------------------------------------

  if (error.code === '23514') {
    if (error.constraint === 'resources_no_multi_space_name_check') {
      return AppError.badRequest(
        'Resource name cannot contain repeated spaces',
        {
          code: 'RESOURCE_NAME_HAS_MULTIPLE_SPACES',
          cause: error,
        },
      );
    }

    // Trigger would cover reverse soft delete,
    // so the only other scenario is to translate
    // a client's request to activate a deleted resource.
    if (error.constraint === 'valid_is_active_deleted_at_check') {
      return AppError.badRequest('You cannot activate a deleted resource', {
        code: 'CANNOT_ACTIVATE_DELETED_RESOURCE',
        cause: error,
      });
    }

    if (error.constraint === 'availability_windows_half_hour_boundary_check') {
      return AppError.badRequest(
        'You can only make a window that is at the :00 or :30 boundary UTC time',
        {
          code: 'WINDOW_INVALID_HALF_HOUR_BOUNDARY',
          cause: error,
        },
      );
    }

    if (error.constraint === 'reservations_half_hour_boundary_check') {
      return AppError.badRequest(
        'Reservation start and end times must be on a UTC :00 or :30 boundary',
        {
          code: 'RESERVATION_INVALID_HALF_HOUR_BOUNDARY',
          cause: error,
        },
      );
    }

    if (error.constraint === 'valid_availability_window_check') {
      return AppError.badRequest(
        'Availability window end time must be greater than the start time',
        {
          code: 'WINDOW_END_TIME_GREATER_THAN_START_TIME',
          cause: error,
        },
      );
    }

    if (error.constraint === 'valid_reservation_time_check') {
      return AppError.badRequest(
        'Reservation end time must be greater than the start time',
        {
          code: 'RESERVATION_END_TIME_GREATER_THAN_START_TIME',
          cause: error,
        },
      );
    }

    return AppError.badRequest('Request violates a database check constraint', {
      code: 'DB_CHECK_CONSTRAINT_VIOLATION',
      cause: error,
    });
  }

  // ---------------------------------------------------------------------------
  // 23502 = not-null violation
  // ---------------------------------------------------------------------------

  if (error.code === '23502') {
    return AppError.badRequest('Required field is missing', {
      code: 'DB_NOT_NULL_VIOLATION',
      cause: error,
    });
  } // joi would cover this, here just for extra protection

  // ---------------------------------------------------------------------------
  // P0001 = PL/pgSQL raise_exception from trigger functions
  // ---------------------------------------------------------------------------

  if (error.code === 'P0001') {
    // -------------------------------------------------------------------------
    // irreversible lifecycle blockers
    // -------------------------------------------------------------------------

    if (error.message.includes('Reservation completion is irreversible.')) {
      return AppError.conflict('Reservation completion is irreversible.', {
        code: 'RESERVATION_COMPLETION_IRREVERSIBLE',
        cause: error,
      });
    }
    // I plan on adding an employee role to the users table in Step 8,
    // so this can be useful for employees and admins, not regular users.
    // A regular user should not be able to modify completion or status at all.

    // -------------------------------------------------------------------------
    // blocked child writes against inactive / soft-deleted parents
    // -------------------------------------------------------------------------

    if (error.message.includes('You cannot reserve a soft deleted resource')) {
      return AppError.conflict(
        'Cannot create a reservation for a deleted resource',
        {
          code: 'RESERVATION_RESOURCE_DELETED',
          cause: error,
        },
      );
    }

    if (error.message.includes('You cannot reserve an inactive resource')) {
      return AppError.conflict(
        'Cannot create a reservation for an inactive resource',
        {
          code: 'RESERVATION_RESOURCE_INACTIVE',
          cause: error,
        },
      );
    }

    if (error.message.includes('A soft deleted user cannot reserve')) {
      return AppError.conflict(
        'A soft-deleted user cannot make a reservation',
        {
          code: 'DELETED_USER_CANNOT_RESERVE',
          cause: error,
        },
      );
    }

    if (
      error.message.includes(
        'You cannot create availability windows for a soft deleted resource',
      )
    ) {
      return AppError.conflict(
        'Cannot create availability windows for a deleted resource',
        {
          code: 'WINDOW_RESOURCE_DELETED',
          cause: error,
        },
      );
    }

    if (
      error.message.includes(
        'You cannot create availability windows for an inactive resource',
      )
    ) {
      return AppError.conflict(
        'Cannot create availability windows for an inactive resource',
        {
          code: 'WINDOW_RESOURCE_INACTIVE',
          cause: error,
        },
      );
    }

    if (
      error.message.includes(
        'You cannot create durations for a soft deleted availability_window',
      )
    ) {
      return AppError.conflict(
        'Cannot create durations for a deleted availability window',
        {
          code: 'DURATION_WINDOW_DELETED',
          cause: error,
        },
      );
    }

    // -------------------------------------------------------------------------
    // default trigger fallback
    // -------------------------------------------------------------------------

    return AppError.badRequest('Database trigger rejected this operation', {
      code: 'DB_TRIGGER_REJECTED_OPERATION',
      cause: error,
    });
  }

  return null;
}

export default translatePgError;
