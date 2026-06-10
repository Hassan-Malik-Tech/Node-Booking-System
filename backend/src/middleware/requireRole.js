import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';

export default function requireRole(allowedRoles) {
  return function requireRoleMiddleware(req, res, next) {
    if (req.user === undefined) {
      throw new Error(
        'requireRole must be placed after requireAuth and loadCurrentStateOfAuthUser.',
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw AppError.forbidden('Forbidden.');
    }

    return next();
  };
}
