import AppError from '../errors/AppError.js';

export default function requireRole(allowedRoles, { forbiddenMessage } = {}) {
  return function requireRoleMiddleware(req, res, next) {
    if (req.user === undefined) {
      throw new Error(
        'requireRole must be placed after requireAuth and loadCurrentStateOfAuthUser.',
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw AppError.forbidden(forbiddenMessage ?? 'Forbidden.');
    }

    return next();
  };
}
