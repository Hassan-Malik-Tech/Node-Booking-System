import { forbidden } from '../../errors/commonErrors.js';
import AppError from '../../errors/AppError.js';
import ERROR_CODES from '../../errors/errorCodes.js';

export function isStaff(userRole) {
  return ['employee', 'admin'].includes(userRole);
}

export function isAdmin(userRole) {
  return userRole === 'admin';
}

export function requireStaff({ userRole, forbiddenMessage }) {
  if (!isStaff(userRole)) {
    throw forbidden({ message: forbiddenMessage });
  }
}

export function requireAdmin({ userRole, forbiddenMessage }) {
  if (!isAdmin(userRole)) {
    throw forbidden({ message: forbiddenMessage });
  }
}

export function requireTargetIsNotAuthUser({
  authUserId,
  targetUserId,
  forbiddenMessage,
}) {
  if (authUserId === targetUserId) {
    throw forbidden({
      message:
        forbiddenMessage ??
        'You cannot perform this action on your own account through this route.',
    });
  }
}

export function requireUserNotDeleted({ user, message, code }) {
  if (user.deleted_at !== null) {
    throw AppError.conflict(
      message ?? 'Cannot perform this action on an already deleted account.',
      {
        code: code ?? ERROR_CODES.USER_ALREADY_DELETED,
      },
    );
  }
}

export function requireUserIsNotAdmin({ user, message, code }) {
  if (user.role === 'admin') {
    throw AppError.forbidden(
      message ?? 'Cannot perform this action on an admin account',
      {
        code: code ?? ERROR_CODES.ADMIN_OPERATION_NOT_ALLOWED,
      },
    );
  }
}
