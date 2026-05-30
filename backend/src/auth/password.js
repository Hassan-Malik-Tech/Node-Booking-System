import bcrypt from 'bcrypt';
import config from '../config/index.js';

export const BCRYPT_MAX_BYTES = 72; // the byte limit for bcrypt
export const PASSWORD_MIN_LENGTH = 15; // 15 is recommeded for SFA

export async function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptCost);
}

export async function verifyPassword({ password, passwordHash }) {
  return bcrypt.compare(password, passwordHash);
}
