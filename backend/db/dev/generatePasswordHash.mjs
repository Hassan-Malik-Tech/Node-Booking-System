import { hashPassword } from '../../src/auth/password.js';

const DEV_PASSWORD = 'BookingDevPassword';

const devPasswordHash = await hashPassword(DEV_PASSWORD);

console.log(devPasswordHash);
