import { rateLimit } from 'express-rate-limit';
import AppError from '../errors/AppError.js';
import config from '../config/index.js';
import ERROR_CODES from '../errors/errorCodes.js';

// Generic, will be used for both login and registration.
const authRateLimit = rateLimit({
  windowMs: config.authRateLimit.windowMs, // Length of the rate-limit window, such as 10 minutes.
  limit: config.authRateLimit.max, // Maximum number of allowed requests within the window.
  standardHeaders: 'draft-8', // Use the newest supported standard RateLimit header format.
  legacyHeaders: false, // Do not send older non-standard X-RateLimit-* headers.
  handler: (req, res, next) => {
    next(
      AppError.tooManyRequests('Too many auth attempts. Try again later.', {
        code: ERROR_CODES.TOO_MANY_AUTH_ATTEMPTS,
      }),
    );
  },
});

export default authRateLimit;

/*
By default, rate limiting is usually keyed by IP. When deployed behind a proxy/load balancer, make sure Express proxy settings are correct, otherwise all users may appear to come from the same IP or IP detection may be inaccurate.
*/
