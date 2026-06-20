import { forbidden } from '../../errors/commonErrors.js';

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
